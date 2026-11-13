const crypto = require("node:crypto");
const net = require("node:net");
function config() {
  const cfg = {
    tmnCode: process.env.VNPAY_TMN_CODE || process.env.VNP_TMN_CODE || "",
    secret: process.env.VNPAY_HASH_SECRET || process.env.VNP_HASH_SECRET || "",
    url:
      process.env.VNPAY_PAYMENT_URL ||
      process.env.VNP_URL ||
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    returnUrl:
      process.env.VNPAY_RETURN_URL ||
      process.env.VNP_RETURN_URL ||
      "http://localhost:5000/api/vnpay/return",
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
    minutes: Number(process.env.VNPAY_PAYMENT_MINUTES || 15),
  };
  let valid = false;
  try {
    const url = new URL(cfg.url),
      back = new URL(cfg.returnUrl),
      front = new URL(cfg.frontendUrl);
    valid =
      /^[A-Za-z0-9]{8}$/.test(cfg.tmnCode) &&
      cfg.secret.length >= 16 &&
      url.origin === "https://sandbox.vnpayment.vn" &&
      url.pathname === "/paymentv2/vpcpay.html" &&
      ["http:", "https:"].includes(back.protocol) &&
      ["http:", "https:"].includes(front.protocol) &&
      !back.username &&
      !front.username &&
      Number.isInteger(cfg.minutes) &&
      cfg.minutes >= 5 &&
      cfg.minutes <= 60;
  } catch {
    /* Invalid configuration disables online payments, COD still works. */
  }
  return { ...cfg, enabled: valid };
}
function requireConfig() {
  const cfg = config();
  if (!cfg.enabled)
    throw Object.assign(
      new Error(
        "Thanh toán VNPAY chưa được cấu hình đầy đủ. Vui lòng chọn COD hoặc thử lại sau.",
      ),
      { status: 503, code: "PAYMENT_UNAVAILABLE" },
    );
  return cfg;
}
// Local Sandbox demos may verify the signed browser callback when IPN cannot
// reach localhost. Public deployments must still use IPN / signed query.
function allowsSandboxReturn() {
  const cfg = config();
  if (
    !cfg.enabled ||
    process.env.NODE_ENV === "production" ||
    process.env.VNPAY_SANDBOX_RETURN_CONFIRMATION !== "true"
  )
    return false;
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
  return (
    loopback.has(new URL(cfg.returnUrl).hostname) &&
    loopback.has(new URL(cfg.frontendUrl).hostname)
  );
}
function vnDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(date))
    .reduce((out, p) => ({ ...out, [p.type]: p.value }), {});
}
function dateString(date) {
  const p = vnDate(date);
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
}
function parseDate(value) {
  if (typeof value !== "string" || !/^\d{14}$/.test(value)) return null;
  const date = new Date(
    `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+07:00`,
  );
  return Number.isFinite(date.getTime()) && dateString(date) === value
    ? date
    : null;
}
const hmac = (data, secret) =>
  crypto.createHmac("sha512", secret).update(data, "utf8").digest("hex");
const encode = (value) =>
  encodeURIComponent(String(value)).replace(/%20/g, "+");
function canonical(params) {
  return Object.keys(params)
    .filter(
      (key) =>
        key.startsWith("vnp_") &&
        !["vnp_SecureHash", "vnp_SecureHashType"].includes(key),
    )
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key])}`)
    .join("&");
}
function matches(hash, expected) {
  return (
    typeof hash === "string" &&
    /^[a-fA-F0-9]{128}$/.test(hash) &&
    crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(expected, "hex"),
    )
  );
}
function validParams(params) {
  return (
    params &&
    typeof params === "object" &&
    Object.entries(params).every(
      ([key, value]) =>
        !key.startsWith("vnp_") ||
        (typeof value === "string" && value.length <= 1024),
    )
  );
}
function verifyIpn(params) {
  const cfg = requireConfig();
  return (
    validParams(params) &&
    params.vnp_TmnCode === cfg.tmnCode &&
    matches(params.vnp_SecureHash, hmac(canonical(params), cfg.secret))
  );
}
function normalizeIp(ip) {
  const normalized = String(ip || "").replace(/^::ffff:/, "");
  return normalized === "::1" || !net.isIP(normalized)
    ? "127.0.0.1"
    : normalized;
}
function buildPayment({ reference, amount, now, expires, ip }) {
  const cfg = requireConfig();
  if (!Number.isSafeInteger(amount) || amount < 5000 || amount > 9999999999)
    throw Object.assign(
      new Error(
        "VNPAY hỗ trợ đơn từ 5.000đ đến 9.999.999.999đ. Vui lòng chọn COD cho đơn này.",
      ),
      { status: 400 },
    );
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: cfg.tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_CreateDate: dateString(now),
    vnp_ExpireDate: dateString(expires),
    vnp_CurrCode: "VND",
    vnp_IpAddr: normalizeIp(ip),
    vnp_Locale: "vn",
    vnp_OrderInfo: `Thanh toan don hang ${reference}`,
    vnp_OrderType: "other",
    vnp_ReturnUrl: cfg.returnUrl,
    vnp_TxnRef: reference,
  };
  const data = canonical(params);
  return {
    url: `${cfg.url}?${data}&vnp_SecureHash=${hmac(data, cfg.secret)}`,
    createDate: params.vnp_CreateDate,
    merchantCode: cfg.tmnCode,
  };
}
const queryResponseKeys = [
  "vnp_ResponseId",
  "vnp_Command",
  "vnp_ResponseCode",
  "vnp_Message",
  "vnp_TmnCode",
  "vnp_TxnRef",
  "vnp_Amount",
  "vnp_BankCode",
  "vnp_PayDate",
  "vnp_TransactionNo",
  "vnp_TransactionType",
  "vnp_TransactionStatus",
  "vnp_OrderInfo",
  "vnp_PromotionCode",
  "vnp_PromotionAmount",
];
async function queryTransaction(payment) {
  const cfg = requireConfig();
  const fields = {
    vnp_RequestId: crypto.randomBytes(16).toString("hex"),
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: cfg.tmnCode,
    vnp_TxnRef: payment.reference,
    vnp_TransactionDate: payment.create_date,
    vnp_CreateDate: dateString(new Date()),
    vnp_IpAddr: "127.0.0.1",
    vnp_OrderInfo: `Kiem tra giao dich ${payment.reference}`,
  };
  fields.vnp_SecureHash = hmac(Object.values(fields).join("|"), cfg.secret);
  const response = await fetch(
    "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("VNPAY query unavailable");
  const body = await response.json();
  if (
    !validParams(body) ||
    body.vnp_TmnCode !== cfg.tmnCode ||
    body.vnp_TxnRef !== payment.reference ||
    (body.vnp_Command && body.vnp_Command !== "querydr") ||
    !matches(
      body.vnp_SecureHash,
      hmac(
        queryResponseKeys.map((key) => body[key] ?? "").join("|"),
        cfg.secret,
      ),
    )
  )
    throw new Error("Invalid VNPAY query signature");
  return body;
}
module.exports = {
  config,
  requireConfig,
  allowsSandboxReturn,
  dateString,
  parseDate,
  canonical,
  verifyIpn,
  buildPayment,
  queryTransaction,
};
