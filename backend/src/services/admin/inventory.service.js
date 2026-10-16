const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const { 
    Book, 
    Category, 
    Inventory, 
    StockReceipt, 
    StockReceiptDetail,
    BookImage
} = require('../../models/associations');

const LOW_STOCK_THRESHOLD = 5;

class InventoryService {
    /**
     * Hàm dùng chung điều chỉnh số lượng tồn kho (Atomic & Idempotent)
     * Dùng cho: Phiếu nhập/xuất kho, Đơn đặt hàng (trừ kho), Hủy đơn hàng (hoàn kho).
     * @param {number} bookId - ID sách
     * @param {number} delta - Số lượng thay đổi (dương: cộng kho, âm: trừ kho)
     * @param {object} transaction - Transaction Sequelize bắt buộc
     */
    async adjustStock(bookId, delta, transaction) {
        const intDelta = parseInt(delta, 10);
        if (isNaN(intDelta) || intDelta === 0) return;

        if (intDelta > 0) {
            // Chiều cộng kho: Đảm bảo bản ghi tồn tại rồi cộng nguyên tử
            await Inventory.findOrCreate({
                where: { book_id: bookId },
                defaults: { stock_quantity: 0, last_updated: new Date() },
                transaction
            });

            await Inventory.update({
                stock_quantity: sequelize.literal(`stock_quantity + ${intDelta}`),
                last_updated: new Date()
            }, {
                where: { book_id: bookId },
                transaction
            });
        } else {
            // Chiều trừ kho: Phép trừ có điều kiện nguyên tử (stock_quantity >= abs(delta))
            const deductQty = Math.abs(intDelta);
            const [affected] = await Inventory.update({
                stock_quantity: sequelize.literal(`stock_quantity - ${deductQty}`),
                last_updated: new Date()
            }, {
                where: {
                    book_id: bookId,
                    stock_quantity: { [Op.gte]: deductQty }
                },
                transaction
            });

            if (affected === 0) {
                const book = await Book.findByPk(bookId, { attributes: ['title'], transaction });
                const title = book ? book.title : `#${bookId}`;
                const err = new Error(`Sách "${title}" không đủ số lượng tồn kho để xuất (yêu cầu xuất: ${deductQty})`);
                err.status = 409;
                throw err;
            }
        }
    }

    /**
     * Sinh mã phiếu tự động chuẩn theo ngày giờ Việt Nam (Asia/Ho_Chi_Minh)
     * Dạng: NK-YYYYMMDD-XXXX (Nhập) hoặc XK-YYYYMMDD-XXXX (Xuất)
     */
    async generateReceiptCode(type, transaction) {
        const now = new Date();
        const vnDateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(now).replace(/-/g, '');

        const prefix = `${type === 'import' ? 'NK' : 'XK'}-${vnDateStr}`;

        const latestReceipt = await StockReceipt.findOne({
            where: {
                receipt_code: { [Op.like]: `${prefix}-%` }
            },
            order: [['receipt_code', 'DESC']],
            transaction
        });

        let seq = 1;
        if (latestReceipt) {
            const parts = latestReceipt.receipt_code.split('-');
            const lastNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastNum)) seq = lastNum + 1;
        }

        return `${prefix}-${String(seq).padStart(4, '0')}`;
    }

    /**
     * Lập phiếu Nhập / Xuất kho mới
     * Hỗ trợ cờ auto_complete = true (Lưu & Hoàn tất trong cùng 1 transaction)
     */
    async createReceipt(data) {
        const { type, supplier_name, note, details, auto_complete } = data;

        // 1. Validate loại phiếu
        if (!['import', 'export'].includes(type)) {
            const err = new Error('Loại phiếu không hợp lệ (chỉ chấp nhận import hoặc export)');
            err.status = 400;
            throw err;
        }

        // Với phiếu nhập, bắt buộc có thông tin Nhà cung cấp / Đối tác
        if (type === 'import' && (!supplier_name || !supplier_name.trim())) {
            const err = new Error('Phiếu nhập kho bắt buộc phải nhập Nhà cung cấp / Đối tác');
            err.status = 400;
            throw err;
        }

        // Với phiếu xuất, bắt buộc có ghi chú lý do xuất
        if (type === 'export' && (!note || !note.trim())) {
            const err = new Error('Phiếu xuất kho bắt buộc phải nhập lý do vào ô Ghi chú');
            err.status = 400;
            throw err;
        }

        // 2. Validate danh sách chi tiết sách
        if (!details || !Array.isArray(details) || details.length === 0) {
            const err = new Error('Phiếu phải có ít nhất một cuốn sách');
            err.status = 400;
            throw err;
        }

        // Gộp các dòng sách trùng lặp ID (Merge duplicate books)
        const mergedMap = new Map();
        for (const item of details) {
            const bId = parseInt(item.book_id, 10);
            const qty = parseInt(item.quantity, 10);
            const unitCost = item.unit_cost !== undefined && item.unit_cost !== null && item.unit_cost !== ''
                ? Math.round(parseFloat(item.unit_cost))
                : (type === 'import' ? null : 0);

            if (isNaN(bId) || isNaN(qty) || qty <= 0) {
                const err = new Error('Số lượng sách phải là số nguyên lớn hơn 0');
                err.status = 400;
                throw err;
            }
            if (type === 'import' && (unitCost === null || isNaN(unitCost) || unitCost < 0)) {
                const err = new Error('Đơn giá nhập phải là số lớn hơn hoặc bằng 0');
                err.status = 400;
                throw err;
            }

            if (mergedMap.has(bId)) {
                const existing = mergedMap.get(bId);
                existing.quantity += qty;
                if (unitCost !== null) existing.unit_cost = unitCost;
            } else {
                mergedMap.set(bId, { book_id: bId, quantity: qty, unit_cost: unitCost });
            }
        }

        const processedDetails = Array.from(mergedMap.values());

        // Kiểm tra tất cả book_id có tồn tại trong hệ thống không
        const bookIds = processedDetails.map(d => d.book_id);
        const existingBooks = await Book.findAll({
            where: { book_id: { [Op.in]: bookIds } },
            attributes: ['book_id', 'title']
        });

        if (existingBooks.length !== bookIds.length) {
            const err = new Error('Một số sách trong danh sách không tồn tại');
            err.status = 400;
            throw err;
        }

        // Tính tổng tiền toàn bộ phiếu trên server
        const totalCost = processedDetails.reduce((sum, item) => sum + (item.quantity * (item.unit_cost || 0)), 0);

        // 3. Thực thi Transaction
        const transaction = await sequelize.transaction();
        try {
            // Sinh mã phiếu có retry phòng ngừa tranh chấp
            let receiptCode = '';
            let attempts = 0;
            let newReceipt = null;

            while (attempts < 3) {
                try {
                    receiptCode = await this.generateReceiptCode(type, transaction);
                    newReceipt = await StockReceipt.create({
                        receipt_code: receiptCode,
                        type,
                        supplier_name: type === 'import' ? (supplier_name ? supplier_name.trim() : null) : null,
                        note: note ? note.trim() : null,
                        total_cost: totalCost,
                        status: auto_complete ? 'completed' : 'pending',
                        created_date: new Date()
                    }, { transaction });
                    break;
                } catch (codeErr) {
                    if (codeErr.name === 'SequelizeUniqueConstraintError' && attempts < 2) {
                        attempts++;
                        continue;
                    }
                    throw codeErr;
                }
            }

            // Lưu chi tiết các dòng sách
            const detailRecords = processedDetails.map(d => ({
                receipt_id: newReceipt.receipt_id,
                book_id: d.book_id,
                quantity: d.quantity,
                unit_cost: d.unit_cost
            }));
            await StockReceiptDetail.bulkCreate(detailRecords, { transaction });

            // Nếu người dùng chọn "Lưu & Hoàn tất ngay"
            if (auto_complete) {
                // Sắp xếp book_id tăng dần để chống deadlock
                const sortedDetails = [...processedDetails].sort((a, b) => a.book_id - b.book_id);
                for (const item of sortedDetails) {
                    if (type === 'import') {
                        await this.adjustStock(item.book_id, item.quantity, transaction);
                    } else {
                        await this.adjustStock(item.book_id, -item.quantity, transaction);
                    }
                }
            }

            await transaction.commit();
            return await this.getReceiptById(newReceipt.receipt_id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Duyệt hoàn tất phiếu (Chống click đúp, chống race condition và deadlock)
     */
    async completeReceipt(receiptId) {
        const transaction = await sequelize.transaction();
        try {
            // KHÓA DÒNG bằng FOR UPDATE độc lập KHÔNG KÈM JOIN (tránh lỗi Postgres FOR UPDATE on joins)
            const receipt = await StockReceipt.findByPk(receiptId, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            if (!receipt) {
                const err = new Error('Không tìm thấy phiếu nhập/xuất kho');
                err.status = 404;
                throw err;
            }

            if (receipt.status !== 'pending') {
                const err = new Error(`Phiếu ${receipt.receipt_code} đã ở trạng thái "${receipt.status}", không thể duyệt lại.`);
                err.status = 409;
                throw err;
            }

            // Lấy chi tiết sách của phiếu, sắp xếp book_id tăng dần chống Deadlock
            const details = await StockReceiptDetail.findAll({
                where: { receipt_id: receiptId },
                order: [['book_id', 'ASC']],
                transaction
            });

            if (details.length === 0) {
                const err = new Error('Phiếu không có dòng chi tiết nào để duyệt');
                err.status = 400;
                throw err;
            }

            // Điều chỉnh tồn kho từng cuốn sách
            for (const item of details) {
                if (receipt.type === 'import') {
                    await this.adjustStock(item.book_id, item.quantity, transaction);
                } else {
                    await this.adjustStock(item.book_id, -item.quantity, transaction);
                }
            }

            receipt.status = 'completed';
            await receipt.save({ transaction });

            await transaction.commit();
            return await this.getReceiptById(receiptId);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Hủy phiếu (Chỉ cho phép khi phiếu còn ở trạng thái Pending)
     */
    async cancelReceipt(receiptId, reason) {
        const transaction = await sequelize.transaction();
        try {
            const receipt = await StockReceipt.findByPk(receiptId, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });

            if (!receipt) {
                const err = new Error('Không tìm thấy phiếu');
                err.status = 404;
                throw err;
            }

            if (receipt.status !== 'pending') {
                const err = new Error('Chỉ có thể hủy phiếu đang ở trạng thái chờ duyệt (Pending). Phiếu đã hoàn tất vui lòng lập phiếu điều chỉnh ngược chiều.');
                err.status = 409;
                throw err;
            }

            if (reason && reason.trim()) {
                receipt.cancel_reason = reason.trim();
            }

            receipt.status = 'cancelled';
            await receipt.save({ transaction });

            await transaction.commit();
            return receipt;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Lấy danh sách phiếu có phân trang, tìm kiếm và lọc
     */
    async getReceipts(query) {
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const where = {};
        if (query.type) where.type = query.type;
        if (query.status) where.status = query.status;
        if (query.search) {
            where[Op.or] = [
                { receipt_code: { [Op.iLike]: `%${query.search.trim()}%` } },
                { supplier_name: { [Op.iLike]: `%${query.search.trim()}%` } },
                { note: { [Op.iLike]: `%${query.search.trim()}%` } },
                { cancel_reason: { [Op.iLike]: `%${query.search.trim()}%` } }
            ];
        }

        const { rows, count } = await StockReceipt.findAndCountAll({
            where,
            include: [
                {
                    model: StockReceiptDetail,
                    as: 'details',
                    include: [
                        { model: Book, as: 'book', attributes: ['book_id', 'title', 'isbn'] }
                    ]
                }
            ],
            distinct: true,
            limit,
            offset,
            order: [['created_date', 'DESC']]
        });

        return {
            receipts: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    /**
     * Lấy chi tiết 1 phiếu theo ID
     */
    async getReceiptById(receiptId) {
        return await StockReceipt.findByPk(receiptId, {
            include: [
                {
                    model: StockReceiptDetail,
                    as: 'details',
                    include: [
                        {
                            model: Book,
                            as: 'book',
                            include: [
                                { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'] },
                                { model: Category, as: 'category', attributes: ['category_name'] },
                                { model: Inventory, as: 'inventory', attributes: ['stock_quantity'] }
                            ]
                        }
                    ]
                }
            ]
        });
    }

    /**
     * Báo cáo tồn kho toàn bộ sách (LEFT JOIN INVENTORY)
     * Thống kê 3 mức không chồng chéo:
     * - Hết hàng: stock = 0
     * - Sắp hết hàng: 1 <= stock <= 5 (LOW_STOCK_THRESHOLD)
     * - Còn hàng: stock > 5
     */
    async getInventorySummary(query) {
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const bookWhere = {};
        if (query.search) {
            bookWhere[Op.or] = [
                { title: { [Op.iLike]: `%${query.search.trim()}%` } },
                { isbn: { [Op.iLike]: `%${query.search.trim()}%` } }
            ];
        }
        if (query.category_id) {
            bookWhere.category_id = parseInt(query.category_id, 10);
        }

        // Lọc theo trạng thái tồn kho (COALESCE để sách chưa có dòng inventory vẫn tính là tồn = 0)
        const stockExpr = sequelize.fn('COALESCE', sequelize.col('inventory.stock_quantity'), 0);
        if (query.stock_status === 'out_of_stock') {
            bookWhere[Op.and] = [sequelize.where(stockExpr, 0)];
        } else if (query.stock_status === 'low_stock') {
            bookWhere[Op.and] = [
                sequelize.where(stockExpr, { [Op.gt]: 0, [Op.lte]: LOW_STOCK_THRESHOLD })
            ];
        } else if (query.stock_status === 'in_stock') {
            bookWhere[Op.and] = [
                sequelize.where(stockExpr, { [Op.gt]: LOW_STOCK_THRESHOLD })
            ];
        }

        const { rows, count } = await Book.findAndCountAll({
            where: bookWhere,
            include: [
                {
                    model: Inventory,
                    as: 'inventory',
                    required: false
                },
                { model: Category, as: 'category', attributes: ['category_id', 'category_name'] },
                { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'], separate: true }
            ],
            distinct: true,
            subQuery: false,
            limit,
            offset,
            order: [
                [stockExpr, 'ASC'],
                ['created_at', 'DESC']
            ]
        });

        // Tính các chỉ số thống kê kho tổng quan
        const totalBooks = await Book.count();
        const totalQuantity = (await Inventory.sum('stock_quantity')) || 0;
        const inStockCount = await Inventory.count({
            where: { stock_quantity: { [Op.gt]: LOW_STOCK_THRESHOLD } }
        });
        const lowStockCount = await Inventory.count({
            where: { stock_quantity: { [Op.gt]: 0, [Op.lte]: LOW_STOCK_THRESHOLD } }
        });
        const outOfStockCount = Math.max(0, totalBooks - inStockCount - lowStockCount);

        return {
            inventory: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            },
            stats: {
                total_books: totalBooks,
                total_quantity: totalQuantity,
                low_stock_count: lowStockCount,
                out_of_stock_count: outOfStockCount,
                low_stock_threshold: LOW_STOCK_THRESHOLD
            }
        };
    }
}

module.exports = new InventoryService();
