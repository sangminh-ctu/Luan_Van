const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const {
  Order,
  OrderItem,
  Shipment,
  Address,
  CartItem,
  Book,
  BookImage,
  Inventory,
  User,
  Voucher,
} = require("../models/associations");
const pricing = require("./pricing.service");
const vouchers = require("./voucher.service");
const inventoryService = require("./admin/inventory.service");
const payments = require("./payment.service");
const gateway = require("./vnpay.gateway");
const {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
  calculateShippingFee,
} = require("../config/shipping.config");

// Bảng chuyển trạng thái một chiều hợp lệ dành cho Admin
const ADMIN_ALLOWED_TRANSITIONS = {
  processing: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["delivered"],
  delivered: [],
  cancelled: [],
};

class OrderService {
  async preview(userId, payload = {}, existingTransaction = null) {
    const ids = payload.book_ids;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 100 ||
      ids.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)
    )
      throw Object.assign(
        new Error("Vui lòng chọn danh sách sách hợp lệ trong giỏ hàng."),
        { status: 400 },
      );
    const bookIds = [...new Set(ids.map(Number))].sort((a, b) => a - b);
    const build = async (transaction) => {
      const [items] = await sequelize.query(
        `SELECT c.book_id, c.quantity, b.title, b.is_active,
                coalesce(i.stock_quantity, 0) AS stock_quantity FROM cart_item c
                JOIN book b ON b.book_id = c.book_id LEFT JOIN inventory i ON i.book_id = b.book_id
                WHERE c.user_id = :userId AND c.book_id IN (:ids) ORDER BY c.book_id`,
        { replacements: { userId, ids: bookIds }, transaction },
      );
      if (items.length !== bookIds.length)
        throw Object.assign(
          new Error(
            "Sản phẩm đã chọn không còn trong giỏ hàng. Vui lòng tải lại giỏ hàng.",
          ),
          { status: 409, code: "CART_CHANGED" },
        );
      if (
        items.some(
          (item) => !item.is_active || item.quantity > item.stock_quantity,
        )
      )
        throw Object.assign(
          new Error(
            "Một số sản phẩm đã ngừng bán hoặc không đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.",
          ),
          { status: 409, code: "CART_CHANGED" },
        );
      const at = await pricing.now(transaction);
      const prices = await pricing.getEffectivePrices(bookIds, {
        transaction,
        at,
      });
      const subtotal = items.reduce(
        (sum, item) =>
          sum +
          Math.round(prices.get(item.book_id).effective_price * item.quantity),
        0,
      );
      const applied = await vouchers.evaluate(
        payload.voucher_code,
        userId,
        subtotal,
        { transaction },
      );
      return {
        ...applied,
        subtotal,
        shipping_fee: calculateShippingFee(subtotal),
        total_amount:
          subtotal -
          applied.voucher_discount_amount +
          calculateShippingFee(subtotal),
        expected_prices: Object.fromEntries(
          bookIds.map((id) => [id, prices.get(id).effective_price]),
        ),
        items: items.map((item) => ({
          book_id: item.book_id,
          quantity: item.quantity,
          title: item.title,
          unit_price: prices.get(item.book_id).effective_price,
          subtotal: Math.round(
            prices.get(item.book_id).effective_price * item.quantity,
          ),
        })),
      };
    };
    return existingTransaction
      ? build(existingTransaction)
      : sequelize.transaction({ isolationLevel: "REPEATABLE READ" }, build);
  }
  async voucherSuggestions(userId, payload = {}) {
    return sequelize.transaction(
      { isolationLevel: "REPEATABLE READ" },
      async (transaction) => {
        const quote = await this.preview(
          userId,
          { book_ids: payload.book_ids },
          transaction,
        );
        const offers = await vouchers.customerOffers(userId, { transaction });
        const suggestions = offers.vouchers
          .filter((v) => v.eligible && quote.subtotal >= v.min_order_value)
          .map((v) => ({
            voucher_id: v.voucher_id,
            code: v.code,
            end_date: v.end_date,
            min_order_value: v.min_order_value,
            min_tier_name: v.min_tier_name,
            user_remaining_uses: v.user_remaining_uses,
            voucher_discount_amount: vouchers.calculateDiscount(
              v,
              quote.subtotal,
            ),
          }))
          .filter((v) => v.voucher_discount_amount > 0)
          .sort(
            (a, b) =>
              b.voucher_discount_amount - a.voucher_discount_amount ||
              a.end_date.localeCompare(b.end_date) ||
              a.code.localeCompare(b.code) ||
              a.voucher_id - b.voucher_id,
          )
          .slice(0, 3)
          .map((v) => ({
            ...v,
            total_amount:
              quote.subtotal - v.voucher_discount_amount + quote.shipping_fee,
          }));
        return {
          membership: offers.membership,
          subtotal: quote.subtotal,
          shipping_fee: quote.shipping_fee,
          suggestions,
        };
      },
    );
  }
  /**
   * Chuẩn hóa dữ liệu đơn hàng trả về (ép kiểu DECIMAL sang Number)
   */
  formatOrder(orderInstance) {
    if (!orderInstance) return null;
    const raw =
      typeof orderInstance.toJSON === "function"
        ? orderInstance.toJSON()
        : orderInstance;

    return {
      ...raw,
      ...payments.summarize(raw),
      subtotal: Number(raw.subtotal || 0),
      shipping_fee: Number(raw.shipping_fee || 0),
      voucher_discount_amount: Number(raw.voucher_discount_amount || 0),
      points_discount: Number(raw.points_discount || 0),
      total_amount: Number(raw.total_amount || 0),
      items: Array.isArray(raw.items)
        ? raw.items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            unit_price_at_purchase: Number(item.unit_price_at_purchase),
            line_total: Math.round(
              Number(item.unit_price_at_purchase) * Number(item.quantity),
            ),
          }))
        : [],
    };
  }

  /**
   * Sinh mã đơn hàng định dạng DH-YYYYMMDD-XXXX
   */
  async generateOrderCode(transaction, attempt = 0) {
    const now = new Date();
    const vnDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(now)
      .replace(/-/g, "");

    const prefix = `DH-${vnDateStr}`;

    if (attempt === 0) {
      const latestOrder = await Order.findOne({
        where: {
          order_code: { [Op.like]: `${prefix}-%` },
        },
        order: [["order_id", "DESC"]],
        transaction,
      });

      let seq = 1;
      if (latestOrder) {
        const parts = latestOrder.order_code.split("-");
        const lastPart = parts[parts.length - 1];
        const parsed = parseInt(lastPart, 10);
        if (!isNaN(parsed)) {
          seq = parsed + 1;
        } else {
          const countToday = await Order.count({
            where: { order_code: { [Op.like]: `${prefix}-%` } },
            transaction,
          });
          seq = countToday + 1;
        }
      }
      const candidate = `${prefix}-${String(seq).padStart(4, "0")}`;
      const exists = await Order.findOne({
        where: { order_code: candidate },
        attributes: ["order_id"],
        transaction,
      });
      if (!exists) return candidate;
    }

    // Fallback ngẫu nhiên 4 ký tự chữ hoa + số nếu có tranh chấp đồng thời
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let suffix = "";
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${suffix}`;
  }

  /**
   * Tạo đơn hàng mới từ các sách đã chọn trong giỏ hàng (POST /api/orders)
   * Client gửi { book_ids, address_id, payment_method, expected_prices }. Giá do backend quyết định.
   */
  async createOrder(userId, payload, context = {}) {
    const voucherCode = vouchers.normalizeCode(payload?.voucher_code);
    const expectedQuote = payload?.expected_quote;
    const quoteFields = [
      "subtotal",
      "shipping_fee",
      "voucher_discount_amount",
      "total_amount",
    ];
    if (
      (voucherCode || expectedQuote !== undefined) &&
      (!expectedQuote ||
        quoteFields.some(
          (key) =>
            typeof expectedQuote[key] !== "number" ||
            !Number.isSafeInteger(expectedQuote[key]) ||
            expectedQuote[key] < 0,
        ))
    )
      throw Object.assign(
        new Error("Vui lòng kiểm tra lại tổng thanh toán trước khi đặt hàng."),
        { status: 400, code: "CHECKOUT_PREVIEW_REQUIRED" },
      );
    const rawBookIds = payload?.book_ids;
    const rawAddressId = payload?.address_id;
    const rawPaymentMethod = String(payload?.payment_method || "")
      .trim()
      .toLowerCase();

    // Price and payment URL are both determined by the backend.
    if (!["cod", "vnpay"].includes(rawPaymentMethod)) {
      const err = new Error("Vui lòng chọn thanh toán COD hoặc VNPAY.");
      err.status = 400;
      throw err;
    }
    if (rawPaymentMethod === "vnpay") gateway.requireConfig();

    // 2. Kiểm tra danh sách book_ids
    if (!Array.isArray(rawBookIds) || rawBookIds.length === 0) {
      const err = new Error("Vui lòng chọn ít nhất một cuốn sách để đặt hàng");
      err.status = 400;
      throw err;
    }

    const parsedIds = rawBookIds.map((id) => Number(id));
    if (parsedIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      const err = new Error("Danh sách book_ids chứa giá trị không hợp lệ");
      err.status = 400;
      throw err;
    }

    // Loại bỏ trùng lặp và sắp xếp book_id tăng dần để khóa dòng chống Deadlock
    const sortedBookIds = [...new Set(parsedIds)].sort((a, b) => a - b);

    const expected = payload?.expected_prices;
    if (
      !expected ||
      typeof expected !== "object" ||
      Array.isArray(expected) ||
      sortedBookIds.some(
        (id) =>
          typeof expected[id] !== "number" ||
          !Number.isFinite(expected[id]) ||
          expected[id] < 0,
      )
    ) {
      const error = new Error(
        "Vui lòng tải lại giỏ hàng để xác nhận giá sản phẩm.",
      );
      error.status = 400;
      throw error;
    }
    // 3. Kiểm tra address_id thuộc đúng người đang đăng nhập
    const addressId = Number(rawAddressId);
    if (!Number.isInteger(addressId) || addressId <= 0) {
      const err = new Error("address_id không hợp lệ");
      err.status = 400;
      throw err;
    }

    const address = await Address.findOne({
      where: { address_id: addressId, user_id: userId },
    });

    if (!address) {
      const err = new Error(
        "Địa chỉ nhận hàng không tồn tại hoặc không thuộc tài khoản của bạn",
      );
      err.status = 404;
      throw err;
    }

    // 4. Mở Transaction xử lý nguyên tử toàn bộ quá trình đặt hàng
    const transaction = await sequelize.transaction({
      isolationLevel: "READ COMMITTED",
    });
    let createdOrderId;
    try {
      // Lấy đúng các dòng trong giỏ hàng của user
      const cartItems = await CartItem.findAll({
        where: {
          user_id: userId,
          book_id: { [Op.in]: sortedBookIds },
        },
        transaction,
        order: [["book_id", "ASC"]],
        lock: transaction.LOCK.UPDATE,
      });

      if (cartItems.length !== sortedBookIds.length) {
        const err = new Error(
          "Một hoặc nhiều sản phẩm đã chọn không có trong giỏ hàng của bạn",
        );
        err.status = 400;
        throw err;
      }

      const qtyByBookId = new Map(
        cartItems.map((item) => [Number(item.book_id), Number(item.quantity)]),
      );
      const expectedQuantities = payload?.expected_quantities;
      if (
        (voucherCode || expectedQuantities !== undefined) &&
        (!expectedQuantities ||
          sortedBookIds.some(
            (id) =>
              !Number.isInteger(expectedQuantities[id]) ||
              expectedQuantities[id] < 1,
          ))
      )
        throw Object.assign(
          new Error("Vui lòng tải lại thông tin số lượng trước khi đặt hàng."),
          { status: 400, code: "CHECKOUT_PREVIEW_REQUIRED" },
        );
      if (
        expectedQuantities &&
        sortedBookIds.some(
          (id) => expectedQuantities[id] !== qtyByBookId.get(id),
        )
      )
        throw Object.assign(
          new Error(
            "Số lượng trong giỏ hàng đã thay đổi. Vui lòng kiểm tra lại trước khi đặt hàng.",
          ),
          { status: 409, code: "CHECKOUT_CHANGED" },
        );

      // Khóa các dòng INVENTORY theo thứ tự book_id ASC (chống Deadlock)
      const [lockedInventories] = await sequelize.query(
        `SELECT book_id, stock_quantity
                 FROM inventory
                 WHERE book_id IN (:bookIds)
                 ORDER BY book_id ASC
                 FOR UPDATE`,
        {
          replacements: { bookIds: sortedBookIds },
          transaction,
        },
      );

      const stockByBookId = new Map(
        lockedInventories.map((inv) => [
          Number(inv.book_id),
          Number(inv.stock_quantity),
        ]),
      );

      // Lấy thông tin sách từ bảng BOOK
      const books = await Book.findAll({
        where: { book_id: { [Op.in]: sortedBookIds } },
        attributes: [
          "book_id",
          "title",
          "price",
          "discount_percent",
          "is_active",
        ],
        order: [["book_id", "ASC"]],
        transaction,
      });
      const bookById = new Map(books.map((b) => [Number(b.book_id), b]));

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
            reason: "unavailable",
          });
        } else if (availableStock < requestedQty) {
          outOfStockItems.push({
            book_id: bookId,
            title: book.title,
            requested: requestedQty,
            available: availableStock,
            reason: "insufficient_stock",
          });
        }
      }

      if (outOfStockItems.length > 0) {
        const summaryNames = outOfStockItems
          .map((i) =>
            i.reason === "unavailable"
              ? `"${i.title}" (ngừng kinh doanh)`
              : `"${i.title}" (yêu cầu ${i.requested}, kho còn ${i.available})`,
          )
          .join(", ");
        const err = new Error(
          `Không đủ tồn kho hoặc sản phẩm đã ngừng bán: ${summaryNames}`,
        );
        err.status = 409;
        err.outOfStockItems = outOfStockItems;
        throw err;
      }

      const priceAt = await pricing.now(transaction);
      const prices = await pricing.getEffectivePrices(sortedBookIds, {
        transaction,
        at: priceAt,
      });
      const priceChanges = sortedBookIds
        .filter((id) => expected[id] !== prices.get(id).effective_price)
        .map((id) => ({
          book_id: id,
          title: bookById.get(id).title,
          old_price: expected[id],
          new_price: prices.get(id).effective_price,
        }));
      if (priceChanges.length) {
        const error = new Error(
          "Giá sản phẩm đã thay đổi. Vui lòng xác nhận lại trước khi đặt hàng.",
        );
        error.status = 409;
        error.code = "PRICE_CHANGED";
        error.priceChanges = priceChanges;
        throw error;
      }
      // Trừ kho bằng hàm dùng chung adjustStock theo đúng thứ tự book_id ASC
      // và tính tổng tiền theo đúng quy tắc làm tròn của giỏ hàng
      let subtotal = 0;
      const orderItemsPayload = [];

      for (const bookId of sortedBookIds) {
        const book = bookById.get(bookId);
        const qty = qtyByBookId.get(bookId);

        await inventoryService.adjustStock(bookId, -qty, transaction);

        const unitPrice = prices.get(bookId).effective_price;
        subtotal += Math.round(unitPrice * qty);

        orderItemsPayload.push({
          book_id: bookId,
          quantity: qty,
          unit_price_at_purchase: unitPrice,
          flash_sale_item_id: prices.get(bookId).flash_sale_item_id,
        });
      }

      const shippingFee = calculateShippingFee(subtotal);
      const applied = await vouchers.evaluate(voucherCode, userId, subtotal, {
        transaction,
        lock: true,
      });
      const voucherDiscountAmount = applied.voucher_discount_amount;
      const pointsDiscount = 0;
      const totalAmount = Math.max(
        0,
        subtotal + shippingFee - voucherDiscountAmount - pointsDiscount,
      );
      const actualQuote = {
        ...applied,
        subtotal,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
      };
      if (
        expectedQuote &&
        quoteFields.some((key) => expectedQuote[key] !== actualQuote[key])
      )
        throw Object.assign(
          new Error(
            "Tổng thanh toán đã thay đổi. Vui lòng xem và xác nhận lại trước khi đặt hàng.",
          ),
          { status: 409, code: "CHECKOUT_CHANGED", quote: actualQuote },
        );

      // Tạo dòng ORDERS với cơ chế SAVEPOINT retry nếu trùng order_code
      let newOrder = null;
      let attempts = 0;
      while (attempts < 5) {
        const savepoint = await sequelize.transaction({ transaction });
        try {
          const orderCode = await this.generateOrderCode(savepoint, attempts);
          newOrder = await Order.create(
            {
              order_code: orderCode,
              user_id: userId,
              address_id: addressId,
              voucher_id: applied.voucher?.voucher_id ?? null,
              order_date: new Date(),
              subtotal,
              shipping_fee: shippingFee,
              voucher_discount_amount: voucherDiscountAmount,
              points_discount: pointsDiscount,
              total_amount: totalAmount,
              payment_method: rawPaymentMethod,
              payment_expires_at:
                rawPaymentMethod === "vnpay"
                  ? new Date(
                      priceAt.getTime() + gateway.config().minutes * 60000,
                    )
                  : null,
              payment_status: "pending",
              order_status: "processing",
            },
            { transaction: savepoint },
          );
          await savepoint.commit();
          break;
        } catch (createErr) {
          await savepoint.rollback();
          if (
            createErr.name === "SequelizeUniqueConstraintError" &&
            attempts < 4
          ) {
            attempts++;
            continue;
          }
          throw createErr;
        }
      }

      if (rawPaymentMethod === "vnpay")
        await payments.createAttempt(newOrder, transaction, context.ip);
      if (applied.voucher)
        await vouchers.consume(applied.voucher.voucher_id, transaction);
      // Tạo các dòng ORDER_ITEM
      const itemsToCreate = orderItemsPayload.map((item) => ({
        ...item,
        order_id: newOrder.order_id,
      }));
      await OrderItem.bulkCreate(itemsToCreate, { transaction });

      // Tạo dòng SHIPMENT (trạng thái pending)
      await Shipment.create(
        {
          order_id: newOrder.order_id,
          tracking_code: null,
          carrier_name: null,
          shipping_status: "pending",
          estimated_delivery: null,
        },
        { transaction },
      );

      // Chỉ xóa các sách đã đặt mua khỏi CART_ITEM
      await CartItem.destroy({
        where: {
          user_id: userId,
          book_id: { [Op.in]: sortedBookIds },
        },
        transaction,
      });

      await transaction.commit();
      createdOrderId = newOrder.order_id;
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
    return this.getCustomerOrderById(userId, createdOrderId);
  }

  /**
   * Lấy cấu hình phí vận chuyển để Frontend hiển thị đồng nhất
   */
  getShippingConfig() {
    return {
      free_shipping_threshold: FREE_SHIPPING_THRESHOLD,
      standard_shipping_fee: STANDARD_SHIPPING_FEE,
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
    if (query.status && query.status !== "all") {
      where.order_status = query.status;
    }

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        payments.paymentInclude(),
        { model: Voucher, as: "voucher", attributes: ["voucher_id", "code"] },
        { model: Address, as: "address" },
        { model: Shipment, as: "shipment" },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Book,
              as: "book",
              attributes: ["book_id", "title", "isbn", "cover_type"],
              include: [
                {
                  model: BookImage,
                  as: "images",
                  attributes: ["image_url", "is_primary"],
                  separate: true,
                },
              ],
            },
          ],
        },
      ],
      distinct: true,
      limit,
      offset,
      order: [
        ["order_date", "DESC"],
        ["order_id", "DESC"],
      ],
    });

    return {
      orders: rows.map((o) => this.formatOrder(o)),
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
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
        payments.paymentInclude(),
        { model: Voucher, as: "voucher", attributes: ["voucher_id", "code"] },
        { model: Address, as: "address" },
        { model: Shipment, as: "shipment" },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Book,
              as: "book",
              attributes: ["book_id", "title", "isbn", "cover_type"],
              include: [
                {
                  model: BookImage,
                  as: "images",
                  attributes: ["image_url", "is_primary"],
                  separate: true,
                },
              ],
            },
          ],
        },
      ],
    });

    if (!order) {
      const err = new Error("Không tìm thấy đơn hàng");
      err.status = 404;
      throw err;
    }

    return this.formatOrder(order);
  }

  /**
   * Khách hàng hủy đơn hàng của chính mình (chỉ khi order_status === 'processing')
   */
  async cancelOrderByCustomer(userId, orderId, expiryPaymentId = null) {
    const transaction = await sequelize.transaction({
      isolationLevel: "READ COMMITTED",
    });
    let cancelledOrderId;
    try {
      // Khóa dòng đơn hàng độc lập (không kèm JOIN) chống bấm đúp hoàn kho 2 lần
      const order = await Order.findOne({
        where: { order_id: orderId, user_id: userId },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!order) {
        const err = new Error("Không tìm thấy đơn hàng");
        err.status = 404;
        throw err;
      }

      if (expiryPaymentId !== null) {
        const Payment = require("../models/PaymentTransaction");
        const latest = await Payment.findOne({
          where: { order_id: order.order_id },
          order: [["payment_id", "DESC"]],
          transaction,
        });
        const at = await pricing.now(transaction);
        if (
          order.payment_method !== "vnpay" ||
          order.order_status !== "processing" ||
          order.payment_status === "paid" ||
          !latest ||
          latest.payment_id !== expiryPaymentId ||
          new Date(order.payment_expires_at).getTime() + 120000 > at.getTime()
        ) {
          await transaction.commit();
          return null;
        }
      }

      if (order.order_status === "cancelled") {
        const err = new Error("Đơn hàng này đã được hủy trước đó");
        err.status = 409;
        throw err;
      }

      if (order.order_status !== "processing") {
        const err = new Error(
          `Không thể hủy đơn hàng khi đã ở trạng thái "${order.order_status}"`,
        );
        err.status = 409;
        throw err;
      }

      await payments.assertCancellationAllowed(order, transaction);
      // Lấy chi tiết đơn hàng sắp xếp theo book_id ASC để hoàn kho chống Deadlock
      const items = await OrderItem.findAll({
        where: { order_id: order.order_id },
        order: [["book_id", "ASC"]],
        transaction,
      });

      for (const item of items) {
        await inventoryService.adjustStock(
          item.book_id,
          item.quantity,
          transaction,
        );
      }

      await vouchers.restore(order.voucher_id, transaction);

      order.order_status = "cancelled";
      await payments.markCancelled(
        order,
        transaction,
        expiryPaymentId !== null,
      );
      await order.save({ transaction });

      await Shipment.update(
        { shipping_status: "failed" },
        { where: { order_id: order.order_id }, transaction },
      );

      await transaction.commit();
      cancelledOrderId = order.order_id;
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
    return this.getCustomerOrderById(userId, cancelledOrderId);
  }

  async expireOnlineOrder(orderId, paymentId) {
    const order = await Order.findByPk(orderId);
    if (order)
      return this.cancelOrderByCustomer(order.user_id, orderId, paymentId);
  }

  /**
   * [ADMIN] Lấy danh sách toàn bộ đơn hàng có phân trang, lọc trạng thái và tìm kiếm
   */
  async getAdminOrders(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, parseInt(query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    const where = {};
    if (query.status && query.status !== "all") {
      where.order_status = query.status;
    }
    if (query.payment_status && query.payment_status !== "all") {
      where.payment_status = query.payment_status;
    }
    if (query.search && query.search.trim()) {
      where.order_code = { [Op.iLike]: `%${query.search.trim()}%` };
    }

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        payments.paymentInclude(),
        { model: Voucher, as: "voucher", attributes: ["voucher_id", "code"] },
        {
          model: User,
          as: "user",
          attributes: ["user_id", "full_name", "email", "phone"],
        },
        { model: Address, as: "address" },
        { model: Shipment, as: "shipment" },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Book,
              as: "book",
              attributes: ["book_id", "title", "isbn"],
            },
          ],
        },
      ],
      distinct: true,
      limit,
      offset,
      order: [
        ["order_date", "DESC"],
        ["order_id", "DESC"],
      ],
    });

    return {
      orders: rows.map((o) => this.formatOrder(o)),
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * [ADMIN] Xem chi tiết 1 đơn hàng
   */
  async getAdminOrderById(orderId) {
    const order = await Order.findByPk(orderId, {
      include: [
        payments.paymentInclude(),
        { model: Voucher, as: "voucher", attributes: ["voucher_id", "code"] },
        {
          model: User,
          as: "user",
          attributes: ["user_id", "full_name", "email", "phone"],
        },
        { model: Address, as: "address" },
        { model: Shipment, as: "shipment" },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Book,
              as: "book",
              attributes: ["book_id", "title", "isbn", "cover_type"],
              include: [
                {
                  model: BookImage,
                  as: "images",
                  attributes: ["image_url", "is_primary"],
                  separate: true,
                },
              ],
            },
          ],
        },
      ],
    });

    if (!order) {
      const err = new Error("Không tìm thấy đơn hàng");
      err.status = 404;
      throw err;
    }

    return this.formatOrder(order);
  }

  /**
   * [ADMIN] Chuyển trạng thái đơn hàng một chiều & đồng bộ SHIPMENT / INVENTORY
   */
  async updateOrderStatusByAdmin(orderId, payload = {}) {
    const nextStatus = String(
      payload.order_status || payload.status || "",
    ).trim();
    if (!nextStatus) {
      const err = new Error("Trạng thái đích (order_status) là bắt buộc");
      err.status = 400;
      throw err;
    }

    const transaction = await sequelize.transaction({
      isolationLevel: "READ COMMITTED",
    });
    try {
      const order = await Order.findByPk(orderId, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!order) {
        const err = new Error("Không tìm thấy đơn hàng");
        err.status = 404;
        throw err;
      }

      const currentStatus = order.order_status;
      const allowedNext = ADMIN_ALLOWED_TRANSITIONS[currentStatus] || [];

      if (!allowedNext.includes(nextStatus)) {
        const err = new Error(
          `Không thể chuyển trạng thái đơn hàng từ "${currentStatus}" sang "${nextStatus}"`,
        );
        err.status = 409;
        throw err;
      }

      // Nếu Admin hủy đơn (từ processing hoặc confirmed) -> Hoàn lại tồn kho
      if (nextStatus === "cancelled") {
        await payments.assertCancellationAllowed(order, transaction);
        const items = await OrderItem.findAll({
          where: { order_id: order.order_id },
          order: [["book_id", "ASC"]],
          transaction,
        });

        for (const item of items) {
          await inventoryService.adjustStock(
            item.book_id,
            item.quantity,
            transaction,
          );
        }

        await vouchers.restore(order.voucher_id, transaction);
        await payments.markCancelled(order, transaction);

        await Shipment.update(
          { shipping_status: "failed" },
          { where: { order_id: order.order_id }, transaction },
        );
      }

      if (nextStatus !== "cancelled")
        await payments.assertFulfillmentAllowed(order, transaction);

      // Nếu chuyển sang shipping -> Cập nhật thông tin vận đơn trong SHIPMENT
      if (nextStatus === "shipping") {
        const shipmentUpdate = {
          shipping_status: payload.shipping_status || "in_transit",
        };
        if (payload.carrier_name !== undefined) {
          shipmentUpdate.carrier_name =
            String(payload.carrier_name).trim() || null;
        }
        if (payload.tracking_code !== undefined) {
          shipmentUpdate.tracking_code =
            String(payload.tracking_code).trim() || null;
        }
        if (payload.estimated_delivery) {
          shipmentUpdate.estimated_delivery = new Date(
            payload.estimated_delivery,
          );
        }

        await Shipment.update(shipmentUpdate, {
          where: { order_id: order.order_id },
          transaction,
        });
      }

      // Nếu chuyển sang delivered -> COD tự động đặt payment_status = 'paid'
      if (nextStatus === "delivered") {
        if (order.payment_method === "cod") {
          order.payment_status = "paid";
        }
        await Shipment.update(
          { shipping_status: "delivered" },
          { where: { order_id: order.order_id }, transaction },
        );
      }

      order.order_status = nextStatus;
      await order.save({ transaction });

      await transaction.commit();
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
    return this.getAdminOrderById(orderId);
  }

  /**
   * [ADMIN] Cập nhật riêng thông tin vận đơn (carrier_name, tracking_code, estimated_delivery)
   */
  async updateShipmentInfoByAdmin(orderId, payload = {}) {
    await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(orderId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) {
        const err = new Error("Không tìm thấy đơn hàng");
        err.status = 404;
        throw err;
      }

      if (
        payload.shipping_status &&
        ["picked_up", "in_transit", "delivered"].includes(
          payload.shipping_status,
        )
      )
        await payments.assertFulfillmentAllowed(order, transaction);
      const shipment = await Shipment.findOne({
        where: { order_id: orderId },
        transaction,
      });
      if (!shipment) {
        const err = new Error(
          "Không tìm thấy thông tin vận chuyển của đơn hàng",
        );
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
        shipment.estimated_delivery = payload.estimated_delivery
          ? new Date(payload.estimated_delivery)
          : null;
      }
      if (
        payload.shipping_status &&
        ["pending", "picked_up", "in_transit", "delivered", "failed"].includes(
          payload.shipping_status,
        )
      ) {
        shipment.shipping_status = payload.shipping_status;
      }

      await shipment.save({ transaction });
    });
    return await this.getAdminOrderById(orderId);
  }
}

module.exports = new OrderService();
