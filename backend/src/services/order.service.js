const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
    Order,
    OrderItem,
    Shipment,
    Address,
    CartItem,
    Book,
    BookImage,
    Inventory,
    User
} = require('../models/associations');
const catalogService = require('./customer/catalog.service');
const inventoryService = require('./admin/inventory.service');
const {
    FREE_SHIPPING_THRESHOLD,
    STANDARD_SHIPPING_FEE,
    calculateShippingFee
} = require('../config/shipping.config');

// Bảng chuyển trạng thái một chiều hợp lệ dành cho Admin
const ADMIN_ALLOWED_TRANSITIONS = {
    processing: ['confirmed', 'cancelled'],
    confirmed: ['shipping', 'cancelled'],
    shipping: ['delivered'],
    delivered: [],
    cancelled: []
};

class OrderService {
    /**
     * Chuẩn hóa dữ liệu đơn hàng trả về (ép kiểu DECIMAL sang Number)
     */
    formatOrder(orderInstance) {
        if (!orderInstance) return null;
        const raw = typeof orderInstance.toJSON === 'function' ? orderInstance.toJSON() : orderInstance;

        return {
            ...raw,
            subtotal: Number(raw.subtotal || 0),
            shipping_fee: Number(raw.shipping_fee || 0),
            voucher_discount_amount: Number(raw.voucher_discount_amount || 0),
            points_discount: Number(raw.points_discount || 0),
            total_amount: Number(raw.total_amount || 0),
            items: Array.isArray(raw.items)
                ? raw.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity),
                    unit_price_at_purchase: Number(item.unit_price_at_purchase),
                    line_total: Math.round(Number(item.unit_price_at_purchase) * Number(item.quantity))
                }))
                : []
        };
    }

    /**
     * Sinh mã đơn hàng định dạng DH-YYYYMMDD-XXXX
     */
    async generateOrderCode(transaction, attempt = 0) {
        const now = new Date();
        const vnDateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(now).replace(/-/g, '');

        const prefix = `DH-${vnDateStr}`;

        if (attempt === 0) {
            const latestOrder = await Order.findOne({
                where: {
                    order_code: { [Op.like]: `${prefix}-%` }
                },
                order: [['order_id', 'DESC']],
                transaction
            });

            let seq = 1;
            if (latestOrder) {
                const parts = latestOrder.order_code.split('-');
                const lastPart = parts[parts.length - 1];
                const parsed = parseInt(lastPart, 10);
                if (!isNaN(parsed)) {
                    seq = parsed + 1;
                } else {
                    const countToday = await Order.count({
                        where: { order_code: { [Op.like]: `${prefix}-%` } },
                        transaction
                    });
                    seq = countToday + 1;
                }
            }
            const candidate = `${prefix}-${String(seq).padStart(4, '0')}`;
            const exists = await Order.findOne({ where: { order_code: candidate }, attributes: ['order_id'], transaction });
            if (!exists) return candidate;
        }

        // Fallback ngẫu nhiên 4 ký tự chữ hoa + số nếu có tranh chấp đồng thời
        const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let suffix = '';
        for (let i = 0; i < 4; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${prefix}-${suffix}`;
    }

    /**
     * Tạo đơn hàng mới từ các sách đã chọn trong giỏ hàng (POST /api/orders)
     * Client chỉ gửi { book_ids, address_id, payment_method }
     */
    async createOrder(userId, payload) {
        const rawBookIds = payload?.book_ids;
        const rawAddressId = payload?.address_id;
        const rawPaymentMethod = String(payload?.payment_method || '').trim().toLowerCase();

        // 1. Kiểm tra phương thức thanh toán (chỉ cho phép 'cod')
        if (rawPaymentMethod !== 'cod') {
            const err = new Error('Phương thức thanh toán không hợp lệ (hiện tại hệ thống chỉ hỗ trợ COD)');
            err.status = 400;
            throw err;
        }

        // 2. Kiểm tra danh sách book_ids
        if (!Array.isArray(rawBookIds) || rawBookIds.length === 0) {
            const err = new Error('Vui lòng chọn ít nhất một cuốn sách để đặt hàng');
            err.status = 400;
            throw err;
        }

        const parsedIds = rawBookIds.map(id => Number(id));
        if (parsedIds.some(id => !Number.isInteger(id) || id <= 0)) {
            const err = new Error('Danh sách book_ids chứa giá trị không hợp lệ');
            err.status = 400;
            throw err;
        }

        // Loại bỏ trùng lặp và sắp xếp book_id tăng dần để khóa dòng chống Deadlock
        const sortedBookIds = [...new Set(parsedIds)].sort((a, b) => a - b);

        // 3. Kiểm tra address_id thuộc đúng người đang đăng nhập
        const addressId = Number(rawAddressId);
        if (!Number.isInteger(addressId) || addressId <= 0) {
            const err = new Error('address_id không hợp lệ');
            err.status = 400;
            throw err;
        }

        const address = await Address.findOne({
            where: { address_id: addressId, user_id: userId }
        });

        if (!address) {
            const err = new Error('Địa chỉ nhận hàng không tồn tại hoặc không thuộc tài khoản của bạn');
            err.status = 404;
            throw err;
        }

        // 4. Mở Transaction xử lý nguyên tử toàn bộ quá trình đặt hàng
        const transaction = await sequelize.transaction();
        try {
            // Lấy đúng các dòng trong giỏ hàng của user
            const cartItems = await CartItem.findAll({
                where: {
                    user_id: userId,
                    book_id: { [Op.in]: sortedBookIds }
                },
                transaction
            });

            if (cartItems.length !== sortedBookIds.length) {
                const err = new Error('Một hoặc nhiều sản phẩm đã chọn không có trong giỏ hàng của bạn');
                err.status = 400;
                throw err;
            }

            const qtyByBookId = new Map(cartItems.map(item => [Number(item.book_id), Number(item.quantity)]));

            // Khóa các dòng INVENTORY theo thứ tự book_id ASC (chống Deadlock)
            const [lockedInventories] = await sequelize.query(
                `SELECT book_id, stock_quantity
                 FROM inventory
                 WHERE book_id IN (:bookIds)
                 ORDER BY book_id ASC
                 FOR UPDATE`,
                {
                    replacements: { bookIds: sortedBookIds },
                    transaction
                }
            );

            const stockByBookId = new Map(
                lockedInventories.map(inv => [Number(inv.book_id), Number(inv.stock_quantity)])
            );

            // Lấy thông tin sách từ bảng BOOK
            const books = await Book.findAll({
                where: { book_id: { [Op.in]: sortedBookIds } },
                attributes: ['book_id', 'title', 'price', 'discount_percent', 'is_active'],
                order: [['book_id', 'ASC']],
                transaction
            });
            const bookById = new Map(books.map(b => [Number(b.book_id), b]));

            // Kiểm tra trạng thái đang bán và tồn kho của từng sách
            const outOfStockItems = [];
            for (const bookId of sortedBookIds) {
                const book = bookById.get(bookId);
                const requestedQty = qtyByBookId.get(bookId) || 0;
                const availableStock = stockByBookId.get(bookId) ?? 0;

                if (!book || !book.is_active) {
                    outOfStockItems.push({
                        book_id: bookId,
                        title: book ? book.title : `Sách #${bookId}`,
                        requested: requestedQty,
                        available: 0,
                        reason: 'unavailable'
                    });
                } else if (availableStock < requestedQty) {
                    outOfStockItems.push({
                        book_id: bookId,
                        title: book.title,
                        requested: requestedQty,
                        available: availableStock,
                        reason: 'insufficient_stock'
                    });
                }
            }

            if (outOfStockItems.length > 0) {
                const summaryNames = outOfStockItems
                    .map(i =>
                        i.reason === 'unavailable'
                            ? `"${i.title}" (ngừng kinh doanh)`
                            : `"${i.title}" (yêu cầu ${i.requested}, kho còn ${i.available})`
                    )
                    .join(', ');
                const err = new Error(`Không đủ tồn kho hoặc sản phẩm đã ngừng bán: ${summaryNames}`);
                err.status = 409;
                err.outOfStockItems = outOfStockItems;
                throw err;
            }

            // Trừ kho bằng hàm dùng chung adjustStock theo đúng thứ tự book_id ASC
            // và tính tổng tiền theo đúng quy tắc làm tròn của giỏ hàng
            let subtotal = 0;
            const orderItemsPayload = [];

            for (const bookId of sortedBookIds) {
                const book = bookById.get(bookId);
                const qty = qtyByBookId.get(bookId);

                await inventoryService.adjustStock(bookId, -qty, transaction);

                const unitPrice = catalogService.calculateFinalPrice(book.price, book.discount_percent);
                subtotal += unitPrice * qty;

                orderItemsPayload.push({
                    book_id: bookId,
                    quantity: qty,
                    unit_price_at_purchase: unitPrice
                });
            }

            const shippingFee = calculateShippingFee(subtotal);
            const voucherDiscountAmount = 0;
            const pointsDiscount = 0;
            const totalAmount = Math.max(0, subtotal + shippingFee - voucherDiscountAmount - pointsDiscount);

            // Tạo dòng ORDERS với cơ chế SAVEPOINT retry nếu trùng order_code
            let newOrder = null;
            let attempts = 0;
            while (attempts < 5) {
                const savepoint = await sequelize.transaction({ transaction });
                try {
                    const orderCode = await this.generateOrderCode(savepoint, attempts);
                    newOrder = await Order.create({
                        order_code: orderCode,
                        user_id: userId,
                        address_id: addressId,
                        voucher_id: null,
                        order_date: new Date(),
                        subtotal,
                        shipping_fee: shippingFee,
                        voucher_discount_amount: voucherDiscountAmount,
                        points_discount: pointsDiscount,
                        total_amount: totalAmount,
                        payment_method: 'cod',
                        payment_status: 'pending',
                        order_status: 'processing'
                    }, { transaction: savepoint });
                    await savepoint.commit();
                    break;
                } catch (createErr) {
                    await savepoint.rollback();
                    if (createErr.name === 'SequelizeUniqueConstraintError' && attempts < 4) {
                        attempts++;
                        continue;
                    }
                    throw createErr;
                }
            }

            // Tạo các dòng ORDER_ITEM
            const itemsToCreate = orderItemsPayload.map(item => ({
                ...item,
                order_id: newOrder.order_id
            }));
            await OrderItem.bulkCreate(itemsToCreate, { transaction });

            // Tạo dòng SHIPMENT (trạng thái pending)
            await Shipment.create({
                order_id: newOrder.order_id,
                tracking_code: null,
                carrier_name: null,
                shipping_status: 'pending',
                estimated_delivery: null
            }, { transaction });

            // Chỉ xóa các sách đã đặt mua khỏi CART_ITEM
            await CartItem.destroy({
                where: {
                    user_id: userId,
                    book_id: { [Op.in]: sortedBookIds }
                },
                transaction
            });

            await transaction.commit();
            return await this.getCustomerOrderById(userId, newOrder.order_id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Lấy cấu hình phí vận chuyển để Frontend hiển thị đồng nhất
     */
    getShippingConfig() {
        return {
            free_shipping_threshold: FREE_SHIPPING_THRESHOLD,
            standard_shipping_fee: STANDARD_SHIPPING_FEE
        };
    }

    /**
     * Lấy danh sách đơn hàng của khách hàng đang đăng nhập (phân trang mặc định 5 đơn/trang)
     */
    async getCustomerOrders(userId, query = {}) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.max(1, parseInt(query.limit, 10) || 5);
        const offset = (page - 1) * limit;

        const where = { user_id: userId };
        if (query.status && query.status !== 'all') {
            where.order_status = query.status;
        }

        const { rows, count } = await Order.findAndCountAll({
            where,
            include: [
                { model: Address, as: 'address' },
                { model: Shipment, as: 'shipment' },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: Book,
                            as: 'book',
                            attributes: ['book_id', 'title', 'isbn', 'cover_type'],
                            include: [
                                { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'], separate: true }
                            ]
                        }
                    ]
                }
            ],
            distinct: true,
            limit,
            offset,
            order: [['order_date', 'DESC'], ['order_id', 'DESC']]
        });

        return {
            orders: rows.map(o => this.formatOrder(o)),
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit) || 1
            }
        };
    }

    /**
     * Lấy chi tiết 1 đơn hàng của khách hàng theo order_id hoặc order_code
     */
    async getCustomerOrderById(userId, idOrCode) {
        const isNumeric = /^\d+$/.test(String(idOrCode));
        const where = isNumeric
            ? { order_id: Number(idOrCode), user_id: userId }
            : { order_code: String(idOrCode).trim(), user_id: userId };

        const order = await Order.findOne({
            where,
            include: [
                { model: Address, as: 'address' },
                { model: Shipment, as: 'shipment' },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: Book,
                            as: 'book',
                            attributes: ['book_id', 'title', 'isbn', 'cover_type'],
                            include: [
                                { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'], separate: true }
                            ]
                        }
                    ]
                }
            ]
        });

        if (!order) {
            const err = new Error('Không tìm thấy đơn hàng');
            err.status = 404;
            throw err;
        }

        return this.formatOrder(order);
    }

    /**
     * Khách hàng hủy đơn hàng của chính mình (chỉ khi order_status === 'processing')
     */
    async cancelOrderByCustomer(userId, orderId) {
        const transaction = await sequelize.transaction();
        try {
            // Khóa dòng đơn hàng độc lập (không kèm JOIN) chống bấm đúp hoàn kho 2 lần
            const order = await Order.findOne({
                where: { order_id: orderId, user_id: userId },
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            if (!order) {
                const err = new Error('Không tìm thấy đơn hàng');
                err.status = 404;
                throw err;
            }

            if (order.order_status === 'cancelled') {
                const err = new Error('Đơn hàng này đã được hủy trước đó');
                err.status = 409;
                throw err;
            }

            if (order.order_status !== 'processing') {
                const err = new Error(`Không thể hủy đơn hàng khi đã ở trạng thái "${order.order_status}"`);
                err.status = 409;
                throw err;
            }

            // Lấy chi tiết đơn hàng sắp xếp theo book_id ASC để hoàn kho chống Deadlock
            const items = await OrderItem.findAll({
                where: { order_id: order.order_id },
                order: [['book_id', 'ASC']],
                transaction
            });

            for (const item of items) {
                await inventoryService.adjustStock(item.book_id, item.quantity, transaction);
            }

            order.order_status = 'cancelled';
            await order.save({ transaction });

            await Shipment.update(
                { shipping_status: 'failed' },
                { where: { order_id: order.order_id }, transaction }
            );

            await transaction.commit();
            return await this.getCustomerOrderById(userId, order.order_id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * [ADMIN] Lấy danh sách toàn bộ đơn hàng có phân trang, lọc trạng thái và tìm kiếm
     */
    async getAdminOrders(query = {}) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.max(1, parseInt(query.limit, 10) || 10);
        const offset = (page - 1) * limit;

        const where = {};
        if (query.status && query.status !== 'all') {
            where.order_status = query.status;
        }
        if (query.payment_status && query.payment_status !== 'all') {
            where.payment_status = query.payment_status;
        }
        if (query.search && query.search.trim()) {
            where.order_code = { [Op.iLike]: `%${query.search.trim()}%` };
        }

        const { rows, count } = await Order.findAndCountAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['user_id', 'full_name', 'email', 'phone'] },
                { model: Address, as: 'address' },
                { model: Shipment, as: 'shipment' },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        { model: Book, as: 'book', attributes: ['book_id', 'title', 'isbn'] }
                    ]
                }
            ],
            distinct: true,
            limit,
            offset,
            order: [['order_date', 'DESC'], ['order_id', 'DESC']]
        });

        return {
            orders: rows.map(o => this.formatOrder(o)),
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    /**
     * [ADMIN] Xem chi tiết 1 đơn hàng
     */
    async getAdminOrderById(orderId) {
        const order = await Order.findByPk(orderId, {
            include: [
                { model: User, as: 'user', attributes: ['user_id', 'full_name', 'email', 'phone'] },
                { model: Address, as: 'address' },
                { model: Shipment, as: 'shipment' },
                {
                    model: OrderItem,
                    as: 'items',
                    include: [
                        {
                            model: Book,
                            as: 'book',
                            attributes: ['book_id', 'title', 'isbn', 'cover_type'],
                            include: [
                                { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'], separate: true }
                            ]
                        }
                    ]
                }
            ]
        });

        if (!order) {
            const err = new Error('Không tìm thấy đơn hàng');
            err.status = 404;
            throw err;
        }

        return this.formatOrder(order);
    }

    /**
     * [ADMIN] Chuyển trạng thái đơn hàng một chiều & đồng bộ SHIPMENT / INVENTORY
     */
    async updateOrderStatusByAdmin(orderId, payload = {}) {
        const nextStatus = String(payload.order_status || payload.status || '').trim();
        if (!nextStatus) {
            const err = new Error('Trạng thái đích (order_status) là bắt buộc');
            err.status = 400;
            throw err;
        }

        const transaction = await sequelize.transaction();
        try {
            const order = await Order.findByPk(orderId, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            if (!order) {
                const err = new Error('Không tìm thấy đơn hàng');
                err.status = 404;
                throw err;
            }

            const currentStatus = order.order_status;
            const allowedNext = ADMIN_ALLOWED_TRANSITIONS[currentStatus] || [];

            if (!allowedNext.includes(nextStatus)) {
                const err = new Error(
                    `Không thể chuyển trạng thái đơn hàng từ "${currentStatus}" sang "${nextStatus}"`
                );
                err.status = 409;
                throw err;
            }

            // Nếu Admin hủy đơn (từ processing hoặc confirmed) -> Hoàn lại tồn kho
            if (nextStatus === 'cancelled') {
                const items = await OrderItem.findAll({
                    where: { order_id: order.order_id },
                    order: [['book_id', 'ASC']],
                    transaction
                });

                for (const item of items) {
                    await inventoryService.adjustStock(item.book_id, item.quantity, transaction);
                }

                await Shipment.update(
                    { shipping_status: 'failed' },
                    { where: { order_id: order.order_id }, transaction }
                );
            }

            // Nếu chuyển sang shipping -> Cập nhật thông tin vận đơn trong SHIPMENT
            if (nextStatus === 'shipping') {
                const shipmentUpdate = {
                    shipping_status: payload.shipping_status || 'in_transit'
                };
                if (payload.carrier_name !== undefined) {
                    shipmentUpdate.carrier_name = String(payload.carrier_name).trim() || null;
                }
                if (payload.tracking_code !== undefined) {
                    shipmentUpdate.tracking_code = String(payload.tracking_code).trim() || null;
                }
                if (payload.estimated_delivery) {
                    shipmentUpdate.estimated_delivery = new Date(payload.estimated_delivery);
                }

                await Shipment.update(shipmentUpdate, {
                    where: { order_id: order.order_id },
                    transaction
                });
            }

            // Nếu chuyển sang delivered -> COD tự động đặt payment_status = 'paid'
            if (nextStatus === 'delivered') {
                if (order.payment_method === 'cod') {
                    order.payment_status = 'paid';
                }
                await Shipment.update(
                    { shipping_status: 'delivered' },
                    { where: { order_id: order.order_id }, transaction }
                );
            }

            order.order_status = nextStatus;
            await order.save({ transaction });

            await transaction.commit();
            return await this.getAdminOrderById(order.order_id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * [ADMIN] Cập nhật riêng thông tin vận đơn (carrier_name, tracking_code, estimated_delivery)
     */
    async updateShipmentInfoByAdmin(orderId, payload = {}) {
        const order = await Order.findByPk(orderId);
        if (!order) {
            const err = new Error('Không tìm thấy đơn hàng');
            err.status = 404;
            throw err;
        }

        const shipment = await Shipment.findOne({ where: { order_id: orderId } });
        if (!shipment) {
            const err = new Error('Không tìm thấy thông tin vận chuyển của đơn hàng');
            err.status = 404;
            throw err;
        }

        if (payload.carrier_name !== undefined) {
            shipment.carrier_name = String(payload.carrier_name).trim() || null;
        }
        if (payload.tracking_code !== undefined) {
            shipment.tracking_code = String(payload.tracking_code).trim() || null;
        }
        if (payload.estimated_delivery !== undefined) {
            shipment.estimated_delivery = payload.estimated_delivery ? new Date(payload.estimated_delivery) : null;
        }
        if (payload.shipping_status && ['pending', 'picked_up', 'in_transit', 'delivered', 'failed'].includes(payload.shipping_status)) {
            shipment.shipping_status = payload.shipping_status;
        }

        await shipment.save();
        return await this.getAdminOrderById(orderId);
    }
}

module.exports = new OrderService();
