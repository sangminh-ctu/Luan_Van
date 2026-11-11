const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");

function fail(code, message, status = 409) {
  throw Object.assign(new Error(message), {
    status,
    code,
    fieldErrors: { voucher_code: message },
  });
}
function normalizeCode(value) {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^[A-Z0-9_-]{1,50}$/.test(value.trim().toUpperCase())
  )
    fail(
      "VOUCHER_INVALID",
      "Mã giảm giá gồm tối đa 50 ký tự: chữ không dấu, số, dấu - hoặc _.",
      400,
    );
  return value.trim().toUpperCase();
}
const cents = (value) => {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
};
function calculateDiscount(voucher, subtotal) {
  // Work in 1/10000 VND, apply the cap before rounding once to whole VND.
  let amount =
    voucher.discount_type === "percent"
      ? BigInt(subtotal) * cents(voucher.discount_value)
      : cents(voucher.discount_value) * 100n;
  if (
    voucher.discount_type === "percent" &&
    voucher.max_discount_amount !== null
  ) {
    const cap = cents(voucher.max_discount_amount) * 100n;
    if (amount > cap) amount = cap;
  }
  const result = Number((amount + 5000n) / 10000n);
  return Math.max(0, Math.min(subtotal, result));
}
async function evaluate(
  code,
  userId,
  subtotal,
  { transaction, lock = false } = {},
) {
  const normalized = normalizeCode(code);
  if (!normalized) return { voucher: null, voucher_discount_amount: 0 };
  if (lock && !transaction)
    throw new Error("Voucher consumption requires a transaction");
  const rows = await sequelize.query(
    `SELECT *, to_char(start_date, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS starts,
        to_char(end_date, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS ends
        FROM voucher WHERE upper(btrim(code)) = :code ORDER BY voucher_id ${lock ? "FOR UPDATE" : ""}`,
    {
      replacements: { code: normalized },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  if (rows.length !== 1)
    fail(
      "VOUCHER_NOT_FOUND",
      "Mã giảm giá không tồn tại hoặc không còn khả dụng. Vui lòng kiểm tra lại mã.",
    );
  const row = rows[0];
  // Read the clock after acquiring the row lock, not at transaction start.
  const [clock] = await sequelize.query(
    `SELECT to_char(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS now`,
    { type: QueryTypes.SELECT, transaction },
  );
  if (row.status === "disabled")
    fail(
      "VOUCHER_DISABLED",
      "Mã giảm giá này đã bị tắt. Vui lòng chọn mã khác.",
    );
  if (row.status === "expired" || row.ends <= clock.now)
    fail("VOUCHER_EXPIRED", "Mã giảm giá đã hết hạn. Vui lòng chọn mã khác.");
  if (row.starts > clock.now)
    fail("VOUCHER_NOT_STARTED", "Mã giảm giá chưa đến thời gian áp dụng.");
  if (row.status !== "active")
    fail("VOUCHER_INVALID", "Mã giảm giá không còn khả dụng.");
  if (row.usage_limit !== null && row.used_count >= row.usage_limit)
    fail("VOUCHER_EXHAUSTED", "Mã giảm giá đã hết lượt sử dụng.");
  const [usage] = await sequelize.query(
    `SELECT count(*)::int AS count FROM orders
        WHERE voucher_id = :id AND user_id = :userId AND order_status <> 'cancelled'`,
    {
      replacements: { id: row.voucher_id, userId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  if (usage.count >= row.per_user_limit)
    fail(
      "VOUCHER_USER_LIMIT",
      `Bạn đã dùng hết lượt của mã này (tối đa ${row.per_user_limit} lần mỗi tài khoản).`,
    );
  if (subtotal < Number(row.min_order_value))
    fail(
      "VOUCHER_MIN_ORDER",
      `Mã yêu cầu đơn tối thiểu ${Number(row.min_order_value).toLocaleString("vi-VN")}đ. Bạn cần mua thêm ${(Number(row.min_order_value) - subtotal).toLocaleString("vi-VN")}đ tiền hàng.`,
    );
  return {
    voucher: {
      voucher_id: row.voucher_id,
      code: row.code,
      per_user_limit: row.per_user_limit,
      user_remaining_uses: row.per_user_limit - usage.count,
    },
    voucher_discount_amount: calculateDiscount(row, subtotal),
  };
}
async function consume(voucherId, transaction) {
  if (!transaction)
    throw new Error("Voucher consumption requires a transaction");
  const rows = await sequelize.query(
    `UPDATE voucher SET used_count = used_count + 1
        WHERE voucher_id = :id AND (usage_limit IS NULL OR used_count < usage_limit) RETURNING voucher_id`,
    {
      replacements: { id: voucherId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  if (!rows.length)
    fail("VOUCHER_EXHAUSTED", "Mã giảm giá đã hết lượt sử dụng.");
}
async function restore(voucherId, transaction) {
  if (!voucherId) return;
  if (!transaction)
    throw new Error("Voucher restoration requires a transaction");
  const rows = await sequelize.query(
    `UPDATE voucher SET used_count = used_count - 1
        WHERE voucher_id = :id AND used_count > 0 RETURNING voucher_id`,
    {
      replacements: { id: voucherId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  if (!rows.length)
    throw Object.assign(
      new Error(
        "Không thể hoàn lượt mã giảm giá. Vui lòng liên hệ quản trị viên để đối chiếu dữ liệu.",
      ),
      { status: 409 },
    );
}
module.exports = {
  normalizeCode,
  calculateDiscount,
  evaluate,
  consume,
  restore,
};
