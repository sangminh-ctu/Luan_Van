const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

function fail(message, status = 400, field) {
  throw Object.assign(new Error(message), {
    status,
    ...(field ? { fieldErrors: { [field]: message } } : {}),
  });
}
const effectiveStatus = `CASE
    WHEN v.status = 'disabled' THEN 'disabled'
    WHEN v.status = 'expired' OR v.end_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh') THEN 'expired'
    WHEN v.usage_limit IS NOT NULL AND v.used_count >= v.usage_limit THEN 'exhausted'
    WHEN v.start_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh') THEN 'scheduled'
    ELSE 'active' END`;
const columns = `v.*, to_char(v.start_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_date,
    to_char(v.end_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS end_date,
    ${effectiveStatus} AS effective_status,
    (v.used_count > 0 OR EXISTS (SELECT 1 FROM orders o WHERE o.voucher_id = v.voucher_id)) AS has_history`;
const select = (sql, replacements = {}, transaction) =>
  sequelize.query(sql, { replacements, transaction, type: QueryTypes.SELECT });
function idValue(id) {
  if (!/^[1-9]\d*$/.test(String(id)) || Number(id) > 2147483647)
    fail("ID mã giảm giá không hợp lệ");
  return Number(id);
}
function money(value, label, optional = false) {
  if (optional && (value === null || value === "" || value === undefined))
    return null;
  if (
    !["string", "number"].includes(typeof value) ||
    !/^\d+(\.\d{1,2})?$/.test(String(value)) ||
    Number(value) > 9999999999.99
  )
    fail(
      `${label} phải là số không âm, tối đa 2 chữ số thập phân`,
      400,
      {
        "Giá trị giảm": "discount_value",
        "Giảm tối đa": "max_discount_amount",
        "Đơn tối thiểu": "min_order_value",
      }[label],
    );
  return Number(value);
}
function dateValue(value, field) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)
  )
    fail("Vui lòng chọn ngày và giờ hợp lệ theo giờ Việt Nam.", 400, field);
  const canonical = value.length === 16 ? value + ":00" : value;
  const date = new Date(canonical + "Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 19) !== canonical ||
    Number(value.slice(0, 4)) < 2000
  )
    fail("Ngày giờ không hợp lệ. Vui lòng chọn lại ngày và giờ.", 400, field);
  return canonical;
}
function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("Dữ liệu không hợp lệ");
  if (Object.hasOwn(data, "used_count"))
    fail("Không được chỉnh sửa số lượt đã dùng");
  const code =
    typeof data.code === "string" ? data.code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9_-]{1,50}$/.test(code))
    fail(
      "Mã gồm 1–50 ký tự: chữ không dấu, số, dấu - hoặc _. Vui lòng kiểm tra lại mã.",
      400,
      "code",
    );
  if (!["percent", "fixed_amount"].includes(data.discount_type))
    fail("Vui lòng chọn loại giảm giá hợp lệ.", 400, "discount_type");
  const discount_value = money(data.discount_value, "Giá trị giảm");
  if (
    discount_value <= 0 ||
    (data.discount_type === "percent" && discount_value > 100)
  )
    fail(
      "Giá trị giảm phải lớn hơn 0; phần trăm không vượt quá 100.",
      400,
      "discount_value",
    );
  const max_discount_amount = money(
    data.max_discount_amount,
    "Giảm tối đa",
    true,
  );
  if (
    max_discount_amount !== null &&
    (max_discount_amount <= 0 || data.discount_type !== "percent")
  )
    fail(
      "Giảm tối đa phải lớn hơn 0 và chỉ dùng cho giảm phần trăm.",
      400,
      "max_discount_amount",
    );
  const min_order_value = money(data.min_order_value ?? 0, "Đơn tối thiểu");
  if (data.discount_type === "fixed_amount" && discount_value > min_order_value)
    fail(
      "Số tiền giảm không được vượt đơn tối thiểu. Hãy tăng đơn tối thiểu hoặc giảm số tiền giảm.",
      400,
      "discount_value",
    );
  if (max_discount_amount !== null && max_discount_amount > min_order_value)
    fail(
      "Giảm tối đa không được vượt đơn tối thiểu. Hãy giảm mức giảm tối đa hoặc tăng đơn tối thiểu.",
      400,
      "max_discount_amount",
    );
  if (data.start_now !== undefined && typeof data.start_now !== "boolean")
    fail("Lựa chọn áp dụng ngay không hợp lệ");
  const start_date = dateValue(data.start_date, "start_date"),
    end_date = dateValue(data.end_date, "end_date");
  if (end_date <= start_date)
    fail(
      "Ngày kết thúc phải sau ngày bắt đầu. Vui lòng chọn lại thời gian kết thúc.",
      400,
      "end_date",
    );
  const usage_limit =
    data.usage_limit === "" || data.usage_limit == null
      ? null
      : Number(data.usage_limit);
  if (
    usage_limit !== null &&
    (!["number", "string"].includes(typeof data.usage_limit) ||
      !/^\d+$/.test(String(data.usage_limit)) ||
      usage_limit < 1 ||
      usage_limit > 2147483647)
  )
    fail(
      "Giới hạn lượt dùng phải là số nguyên dương; để trống nếu không giới hạn.",
      400,
      "usage_limit",
    );
  const status = data.status ?? "active";
  if (!["active", "disabled", "expired"].includes(status))
    fail("Vui lòng chọn trạng thái hợp lệ.", 400, "status");
  return {
    code,
    discount_type: data.discount_type,
    discount_value,
    max_discount_amount,
    min_order_value,
    start_date,
    end_date,
    usage_limit,
    status,
  };
}
function serialize(row) {
  for (const key of [
    "discount_value",
    "max_discount_amount",
    "min_order_value",
  ])
    if (row[key] !== null) row[key] = Number(row[key]);
  row.remaining_uses =
    row.usage_limit === null
      ? null
      : Math.max(0, row.usage_limit - row.used_count);
  return row;
}
async function detail(id, transaction) {
  const [row] = await select(
    `SELECT ${columns} FROM voucher v WHERE v.voucher_id = :id`,
    { id: idValue(id) },
    transaction,
  );
  if (!row) fail("Không tìm thấy mã giảm giá", 404);
  return serialize(row);
}
async function list(query = {}) {
  const page = Math.min(1000000, Math.max(1, parseInt(query.page, 10) || 1));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const clauses = [],
    replacements = { limit, offset: (page - 1) * limit };
  if (query.search) {
    if (typeof query.search !== "string" || query.search.length > 50)
      fail("Từ khóa tìm kiếm tối đa 50 ký tự");
    clauses.push("strpos(upper(v.code), :search) > 0");
    replacements.search = query.search.trim().toUpperCase();
  }
  if (query.discount_type) {
    if (!["percent", "fixed_amount"].includes(query.discount_type))
      fail("Bộ lọc loại giảm không hợp lệ");
    clauses.push("v.discount_type = :type");
    replacements.type = query.discount_type;
  }
  if (query.status) {
    if (
      !["active", "scheduled", "expired", "exhausted", "disabled"].includes(
        query.status,
      )
    )
      fail("Bộ lọc trạng thái không hợp lệ");
    clauses.push(`(${effectiveStatus}) = :status`);
    replacements.status = query.status;
  }
  const where = clauses.length ? "WHERE " + clauses.join(" AND ") : "";
  const [count] = await select(
    `SELECT count(*)::int AS total FROM voucher v ${where}`,
    replacements,
  );
  const rows = await select(
    `SELECT ${columns} FROM voucher v ${where} ORDER BY v.voucher_id DESC LIMIT :limit OFFSET :offset`,
    replacements,
  );
  const stats = {
    total: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
    exhausted: 0,
    disabled: 0,
  };
  for (const row of await select(
    `SELECT ${effectiveStatus} AS state, count(*)::int AS count FROM voucher v GROUP BY 1`,
  )) {
    stats[row.state] = row.count;
    stats.total += row.count;
  }
  return {
    vouchers: rows.map(serialize),
    stats,
    pagination: {
      page,
      limit,
      total: count.total,
      totalPages: Math.max(1, Math.ceil(count.total / limit)),
    },
  };
}
async function lock(id, transaction) {
  const [row] = await select(
    "SELECT voucher_id FROM voucher WHERE voucher_id = :id FOR UPDATE",
    { id: idValue(id) },
    transaction,
  );
  if (!row) fail("Không tìm thấy mã giảm giá", 404);
  return detail(id, transaction);
}
async function save(id, data) {
  const payload = validate(data);
  try {
    return await sequelize.transaction(async (transaction) => {
      let old;
      if (id !== null) {
        old = await lock(id, transaction);
        if (data.start_now) fail("Chỉ được chọn áp dụng ngay khi tạo mã mới");
        if (old.has_history) {
          for (const key of [
            "code",
            "discount_type",
            "discount_value",
            "max_discount_amount",
            "min_order_value",
            "start_date",
          ])
            if (old[key] !== payload[key])
              fail(
                "Mã đã sử dụng: không được thay đổi mã hoặc điều kiện giảm giá",
                409,
              );
          if (
            payload.end_date < old.end_date ||
            (old.usage_limit === null && payload.usage_limit !== null) ||
            (old.usage_limit !== null &&
              payload.usage_limit !== null &&
              payload.usage_limit < old.usage_limit)
          )
            fail(
              "Mã đã sử dụng: chỉ được gia hạn hoặc tăng giới hạn lượt dùng",
              409,
            );
        }
        if (
          payload.usage_limit !== null &&
          payload.usage_limit < old.used_count
        )
          fail(
            "Giới hạn không được thấp hơn số lượt đã dùng. Hãy tăng giới hạn.",
            400,
            "usage_limit",
          );
      }
      // Serialize normalized-code checks across concurrent admin requests, including legacy lowercase codes.
      await select(
        "SELECT pg_advisory_xact_lock(74021, hashtext(:code))",
        { code: payload.code },
        transaction,
      );
      const duplicates = await select(
        "SELECT voucher_id FROM voucher WHERE upper(btrim(code)) = :code AND (:id IS NULL OR voucher_id <> :id)",
        { code: payload.code, id: id === null ? null : idValue(id) },
        transaction,
      );
      if (duplicates.length)
        fail(
          `Mã “${payload.code}” đã được sử dụng. Vui lòng nhập mã khác.`,
          409,
          "code",
        );
      const [clock] = await select(
        `SELECT to_char(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:MI:SS') AS now`,
        {},
        transaction,
      );
      if (id === null && data.start_now) payload.start_date = clock.now;
      else if (
        (!old || payload.start_date !== old.start_date) &&
        payload.start_date < clock.now
      )
        fail(
          "Ngày bắt đầu không được trong quá khứ. Chọn thời gian tương lai hoặc áp dụng ngay khi tạo mã.",
          400,
          "start_date",
        );
      if (
        (!old || payload.end_date !== old.end_date) &&
        payload.end_date <= clock.now
      )
        fail(
          "Ngày kết thúc đã qua. Hãy chọn thời gian sau hiện tại.",
          400,
          "end_date",
        );
      if (payload.end_date <= payload.start_date)
        fail(
          "Ngày kết thúc phải sau ngày bắt đầu. Vui lòng chọn lại thời gian kết thúc.",
          400,
          "end_date",
        );
      let savedId = id;
      if (id === null) {
        const keys = Object.keys(payload);
        const [created] = await select(
          `INSERT INTO voucher (${keys.join(", ")}) VALUES (${keys.map((key) => ":" + key).join(", ")}) RETURNING voucher_id`,
          payload,
          transaction,
        );
        savedId = created.voucher_id;
      } else {
        await sequelize.query(
          `UPDATE voucher SET ${Object.keys(payload)
            .map((key) => key + " = :" + key)
            .join(", ")} WHERE voucher_id = :id`,
          { replacements: { ...payload, id: idValue(id) }, transaction },
        );
      }
      return detail(savedId, transaction);
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError")
      fail(
        `Mã “${payload.code}” đã được sử dụng. Vui lòng nhập mã khác.`,
        409,
        "code",
      );
    throw error;
  }
}
async function changeStatus(id, data) {
  if (!data || !["active", "disabled"].includes(data.status))
    fail("Chỉ được bật hoặc tắt mã");
  return sequelize.transaction(async (transaction) => {
    await lock(id, transaction);
    await sequelize.query(
      "UPDATE voucher SET status = :status WHERE voucher_id = :id",
      { replacements: { id: idValue(id), status: data.status }, transaction },
    );
    return detail(id, transaction);
  });
}
async function remove(id) {
  return sequelize.transaction(async (transaction) => {
    const row = await lock(id, transaction);
    if (row.has_history)
      fail(
        "Mã đã được sử dụng hoặc có đơn hàng tham chiếu. Hãy tắt mã thay vì xóa.",
        409,
      );
    await sequelize.query("DELETE FROM voucher WHERE voucher_id = :id", {
      replacements: { id: idValue(id) },
      transaction,
    });
    return { message: "Đã xóa mã giảm giá" };
  });
}
module.exports = { list, detail, save, changeStatus, remove, validate };
