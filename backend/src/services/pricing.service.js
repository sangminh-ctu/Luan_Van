const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// SQL builders only accept internal aliases; dates are escaped by Sequelize.
function regularSql(alias = '"Book"') {
  return (
    "ROUND(" +
    alias +
    ".price * (1 - COALESCE(" +
    alias +
    ".discount_percent, 0) / 100.0))"
  );
}
function flashSelect(column, alias, at) {
  return (
    "(SELECT " +
    column +
    " FROM flash_sale_item fsi JOIN flash_sale fs ON fs.flash_sale_id = fsi.flash_sale_id" +
    " WHERE fsi.book_id = " +
    alias +
    ".book_id AND fs.status = 'published'" +
    " AND fs.start_at <= " +
    sequelize.escape(at) +
    "::timestamptz AND fs.end_at > " +
    sequelize.escape(at) +
    "::timestamptz AND fsi.sale_price < " +
    regularSql(alias) +
    " LIMIT 1)"
  );
}
function effectiveSql(alias, at) {
  return (
    "LEAST(" +
    regularSql(alias) +
    ", COALESCE(" +
    flashSelect("fsi.sale_price", alias, at) +
    ", " +
    regularSql(alias) +
    "))"
  );
}
function attributes(at, alias = '"Book"') {
  return [
    [sequelize.literal(effectiveSql(alias, at)), "effective_price"],
    [
      sequelize.literal(flashSelect("fsi.flash_sale_item_id", alias, at)),
      "flash_sale_item_id",
    ],
    [sequelize.literal(flashSelect("fs.end_at", alias, at)), "flash_end_at"],
  ];
}
function decorate(book) {
  const base = Number(book.price);
  const regular = Math.round(
    base * (1 - Number(book.discount_percent || 0) / 100),
  );
  const effective = Number(book.effective_price ?? regular);
  return {
    ...book,
    base_price: base,
    regular_price: regular,
    effective_price: effective,
    final_price: effective,
    flash_price: book.flash_sale_item_id ? effective : null,
    effective_discount_percent:
      base > 0 ? Math.round((1 - effective / base) * 100) : 0,
  };
}
async function now(transaction) {
  const [row] = await sequelize.query("SELECT clock_timestamp() AS now", {
    type: QueryTypes.SELECT,
    transaction,
  });
  return row.now;
}
async function getEffectivePrices(bookIds, { transaction, at } = {}) {
  if (!bookIds.length) return new Map();
  const timestamp = at || (await now(transaction));
  const rows = await sequelize.query(
    "SELECT b.*, " +
      effectiveSql("b", timestamp) +
      " AS effective_price, " +
      flashSelect("fsi.flash_sale_item_id", "b", timestamp) +
      " AS flash_sale_item_id, " +
      flashSelect("fs.end_at", "b", timestamp) +
      " AS flash_end_at FROM book b WHERE b.book_id IN (:ids)",
    { replacements: { ids: bookIds }, type: QueryTypes.SELECT, transaction },
  );
  return new Map(rows.map((row) => [Number(row.book_id), decorate(row)]));
}
module.exports = {
  regularSql,
  effectiveSql,
  attributes,
  decorate,
  now,
  getEffectivePrices,
};
