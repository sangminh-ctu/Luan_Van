const { Op, QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const {
  FlashSale,
  FlashSaleItem,
  Book,
  BookImage,
  Inventory,
} = require("../models/associations");
const pricing = require("./pricing.service");
function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function state(sale, at) {
  if (sale.status !== "published") return sale.status;
  if (new Date(at) < new Date(sale.start_at)) return "upcoming";
  return new Date(at) < new Date(sale.end_at) ? "active" : "ended";
}
function id(value) {
  if (!/^[1-9]d*$/.test(String(value))) fail("Mã chương trình không hợp lệ");
  return Number(value);
}
const includes = [
  {
    model: FlashSaleItem,
    as: "items",
    include: [
      {
        model: Book,
        as: "book",
        include: [
          { model: BookImage, as: "images" },
          { model: Inventory, as: "inventory" },
        ],
      },
    ],
  },
];
async function detail(saleId, transaction) {
  const sale = await FlashSale.findByPk(id(saleId), {
    include: includes,
    transaction,
  });
  if (!sale) fail("Không tìm thấy chương trình Flash Sale", 404);
  const result = sale.toJSON();
  result.items.sort(
    (a, b) =>
      a.display_order - b.display_order ||
      a.flash_sale_item_id - b.flash_sale_item_id,
  );
  result.display_status = state(result, await pricing.now(transaction));
  return result;
}
async function validate(payload, transaction, publish = false) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const start = new Date(payload.start_at),
    end = new Date(payload.end_at);
  if (!name || name.length > 150)
    fail("Tên chương trình phải từ 1 đến 150 ký tự");
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || +end <= +start)
    fail("Thời gian kết thúc phải sau thời gian bắt đầu");
  // Require an explicit timezone; datetime-local must be converted by the form.
  if (
    ![payload.start_at, payload.end_at].every(
      (v) => typeof v === "string" && /(?:Z|[+-]d{2}:d{2})$/i.test(v),
    )
  )
    fail("Thời gian phải kèm múi giờ");
  if (!Array.isArray(payload.items) || payload.items.length > 200)
    fail("Danh sách sách không hợp lệ (tối đa 200 sách)");
  if (publish && !payload.items.length)
    fail("Chọn ít nhất một sách trước khi bật chương trình");
  const ids = payload.items.map((item) => id(item.book_id));
  if (new Set(ids).size !== ids.length)
    fail("Một sách chỉ được xuất hiện một lần trong chương trình");
  const prices = await pricing.getEffectivePrices(ids, { transaction });
  const items = payload.items.map((item, index) => {
    const book = prices.get(Number(item.book_id));
    const price = Number(item.sale_price);
    if (!book) fail("Sách không tồn tại: " + item.book_id);
    if (
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      price >= book.regular_price
    )
      fail(
        "Giá Flash Sale phải là số đồng nguyên, lớn hơn 0 và thấp hơn giá bán thường: " +
          book.title,
      );
    if (publish && !book.is_active)
      fail("Không thể bật chương trình có sách ngừng bán: " + book.title);
    return {
      book_id: Number(item.book_id),
      sale_price: price,
      display_order: index,
    };
  });
  if (publish && +end <= +(await pricing.now(transaction)))
    fail("Chương trình đã hết thời gian");
  return { name, start_at: start, end_at: end, items };
}
async function save(saleId, payload, userId) {
  return sequelize.transaction(async (transaction) => {
    let sale;
    if (saleId) {
      sale = await FlashSale.findByPk(id(saleId), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!sale) fail("Không tìm thấy chương trình", 404);
      const current = state(sale, await pricing.now(transaction));
      if (!["draft", "upcoming"].includes(current))
        fail("Chỉ sửa được bản nháp hoặc chương trình chưa bắt đầu", 409);
    }
    const data = await validate(
      payload,
      transaction,
      sale?.status === "published",
    );
    if (sale) {
      await sale.update(
        { name: data.name, start_at: data.start_at, end_at: data.end_at },
        { transaction },
      );
      await FlashSaleItem.destroy({
        where: { flash_sale_id: sale.flash_sale_id },
        transaction,
      });
    } else
      sale = await FlashSale.create(
        {
          name: data.name,
          start_at: data.start_at,
          end_at: data.end_at,
          created_by: userId,
        },
        { transaction },
      );
    await FlashSaleItem.bulkCreate(
      data.items.map((item) => ({
        ...item,
        flash_sale_id: sale.flash_sale_id,
      })),
      { transaction },
    );
    return detail(sale.flash_sale_id, transaction);
  });
}
async function action(saleId, actionName) {
  return sequelize.transaction(async (transaction) => {
    const sale = await FlashSale.findByPk(id(saleId), {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!sale) fail("Không tìm thấy chương trình", 404);
    const at = await pricing.now(transaction),
      current = state(sale, at);
    if (actionName === "publish") {
      if (current !== "draft") fail("Chỉ bật được chương trình nháp", 409);
      const data = await detail(sale.flash_sale_id, transaction);
      await validate(
        {
          ...data,
          start_at: new Date(data.start_at).toISOString(),
          end_at: new Date(data.end_at).toISOString(),
        },
        transaction,
        true,
      );
      await sale.update({ status: "published" }, { transaction });
    } else if (actionName === "cancel") {
      if (current !== "upcoming")
        fail("Chỉ hủy được chương trình đã bật nhưng chưa bắt đầu", 409);
      await sale.update({ status: "cancelled" }, { transaction });
    } else if (actionName === "end") {
      if (current !== "active")
        fail("Chỉ kết thúc sớm được chương trình đang chạy", 409);
      await sale.update({ end_at: at }, { transaction });
    } else if (actionName === "delete") {
      if (current !== "draft") fail("Chỉ xóa được chương trình nháp", 409);
      await sale.destroy({ transaction });
      return { message: "Đã xóa bản nháp" };
    }
    return detail(sale.flash_sale_id, transaction);
  });
}
async function list(query = {}) {
  const page = Math.max(1, Number(query.page) || 1),
    limit = 10;
  if (!Number.isInteger(page)) fail("Trang không hợp lệ");
  const { count, rows } = await FlashSale.findAndCountAll({
    order: [
      ["start_at", "DESC"],
      ["flash_sale_id", "DESC"],
    ],
    offset: (page - 1) * limit,
    limit,
  });
  const at = await pricing.now();
  return {
    sales: rows.map((s) => ({ ...s.toJSON(), display_status: state(s, at) })),
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    },
  };
}
async function current(query = {}) {
  const at = await pricing.now();
  const sale = await FlashSale.findOne({
    where: { status: "published", end_at: { [Op.gt]: at } },
    order: [["start_at", "ASC"]],
  });
  if (!sale)
    return {
      server_now: at,
      sale: null,
      books: [],
      pagination: { page: 1, totalPages: 1, total: 0 },
    };
  const catalog = require("./customer/catalog.service");
  const result = await catalog.getBooks(
    { page: query.page || 1, limit: 10, sort: "newest" },
    { at, flashSaleId: sale.flash_sale_id },
  );
  const sold = await sequelize.query(
    "SELECT fsi.book_id, COALESCE(SUM(oi.quantity) FILTER (WHERE o.order_status IN ('processing','confirmed','shipping','delivered')),0)::int AS placed_count FROM flash_sale_item fsi LEFT JOIN order_item oi ON oi.flash_sale_item_id=fsi.flash_sale_item_id LEFT JOIN orders o ON o.order_id=oi.order_id WHERE fsi.flash_sale_id=:id GROUP BY fsi.book_id",
    { replacements: { id: sale.flash_sale_id }, type: QueryTypes.SELECT },
  );
  const counts = new Map(sold.map((r) => [r.book_id, r.placed_count]));
  return {
    server_now: at,
    sale: { ...sale.toJSON(), display_status: state(sale, at) },
    ...result,
    books: result.books.map((b) => ({
      ...b,
      placed_count: counts.get(b.book_id) || 0,
    })),
  };
}
module.exports = { detail, save, action, list, current, state };
