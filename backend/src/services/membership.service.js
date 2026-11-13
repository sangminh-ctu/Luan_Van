const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const query = (sql, replacements = {}, transaction) =>
  sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
const formatTier = (tier) => ({ ...tier, min_spend: Number(tier.min_spend) });
async function list(transaction) {
  return (
    await query("SELECT * FROM membership_tier ORDER BY level", {}, transaction)
  ).map(formatTier);
}
async function get(userId, { transaction, lockConfig = false } = {}) {
  if (lockConfig) {
    if (!transaction)
      throw new Error("Membership config lock requires a transaction");
    await sequelize.query("LOCK TABLE membership_tier IN SHARE MODE", {
      transaction,
    });
  }
  const tiers = await list(transaction);
  if (tiers.length !== 3 || tiers[0].min_spend !== 0)
    throw new Error("Cấu hình hạng thành viên chưa sẵn sàng.");
  const [row] = await query(
    `SELECT COALESCE(SUM(GREATEST(0, subtotal - voucher_discount_amount - points_discount)), 0) AS spend
        FROM orders WHERE user_id = :userId AND order_status = 'delivered' AND payment_status = 'paid'`,
    { userId },
    transaction,
  );
  const spend = Number(row.spend);
  const current = tiers.filter((tier) => spend >= tier.min_spend).at(-1);
  const next = tiers.find((tier) => tier.level > current.level) || null;
  return {
    eligible_spend: spend,
    current_tier: current,
    next_tier: next,
    remaining_spend: next ? Math.max(0, next.min_spend - spend) : 0,
    progress_percent: next
      ? Math.min(
          100,
          Math.floor(
            (100 * (spend - current.min_spend)) /
              (next.min_spend - current.min_spend),
          ),
        )
      : 100,
  };
}
async function overview(userId) {
  return sequelize.transaction(
    { isolationLevel: "REPEATABLE READ" },
    async (transaction) => ({
      tiers: await list(transaction),
      membership: await get(userId, { transaction }),
    }),
  );
}
async function save(data) {
  if (!data || !Array.isArray(data.tiers) || data.tiers.length !== 3)
    throw Object.assign(
      new Error("Vui lòng gửi đầy đủ ngưỡng của ba hạng thành viên."),
      { status: 400 },
    );
  return sequelize.transaction(async (transaction) => {
    await sequelize.query("LOCK TABLE membership_tier IN EXCLUSIVE MODE", {
      transaction,
    });
    const tiers = await list(transaction);
    const ids = data.tiers.map((tier) => tier?.tier_id);
    if (
      new Set(ids).size !== 3 ||
      tiers.some((tier) => !ids.includes(tier.tier_id))
    )
      throw Object.assign(
        new Error("Danh sách hạng không hợp lệ. Vui lòng tải lại trang."),
        { status: 400 },
      );
    const values = tiers.map(
      (tier) =>
        data.tiers.find((item) => item.tier_id === tier.tier_id).min_spend,
    );
    const errors = {};
    values.forEach((value, index) => {
      if (
        !["number", "string"].includes(typeof value) ||
        !/^\d+$/.test(String(value)) ||
        Number(value) > 999999999999
      )
        errors[tiers[index].tier_code] =
          "Ngưỡng chi tiêu phải là số nguyên từ 0 đến 999.999.999.999đ.";
      else if (index === 0 && Number(value) !== 0)
        errors.silver = "Hạng Bạc luôn bắt đầu từ 0đ.";
      else if (index > 0 && Number(value) <= Number(values[index - 1]))
        errors[tiers[index].tier_code] =
          "Ngưỡng phải lớn hơn ngưỡng của hạng liền trước.";
    });
    if (Object.keys(errors).length)
      throw Object.assign(new Error("Vui lòng kiểm tra các ngưỡng chi tiêu."), {
        status: 400,
        fieldErrors: errors,
      });
    // Move higher thresholds first when increasing, lower ones first when decreasing, preserving uniqueness.
    const increasing = Number(values[1]) >= tiers[1].min_spend;
    for (const index of increasing ? [2, 1] : [1, 2]) {
      await sequelize.query(
        "UPDATE membership_tier SET min_spend = :value WHERE tier_id = :id",
        {
          replacements: {
            value: Number(values[index]),
            id: tiers[index].tier_id,
          },
          transaction,
        },
      );
    }
    return {
      tiers: await list(transaction),
      message:
        "Đã cập nhật hạng thành viên. Hạng khách hàng được tính lại theo ngưỡng mới.",
    };
  });
}
module.exports = { list, get, overview, save };
