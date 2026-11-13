const crypto = require("node:crypto");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const { Order } = require("../models/associations");
const Payment = require("../models/PaymentTransaction");
const gateway = require("./vnpay.gateway");

const fail = (message, status = 409) =>
  Object.assign(new Error(message), { status, logToConsole: false });
const safeAttributes = [
  "payment_id",
  "reference",
  "status",
  "amount",
  "expires_at",
  "paid_at",
  "response_code",
  "transaction_status",
  "review_reason",
  "provider_transaction_no",
];
const paymentInclude = () => ({
  model: Payment,
  as: "payments",
  attributes: safeAttributes,
  separate: true,
  order: [["payment_id", "DESC"]],
});
const now = async (transaction) =>
  new Date(
    (
      await sequelize.query("SELECT clock_timestamp() AS now", { transaction })
    )[0][0].now,
  );

async function createAttempt(order, transaction, ip) {
  const at = await now(transaction);
  if (new Date(order.payment_expires_at) <= at)
    throw fail("Đã hết thời gian thanh toán. Vui lòng đặt đơn mới.");
  const reference = crypto.randomBytes(16).toString("hex");
  const built = gateway.buildPayment({
    reference,
    amount: Number(order.total_amount),
    now: at,
    expires: order.payment_expires_at,
    ip,
  });
  return Payment.create(
    {
      order_id: order.order_id,
      reference,
      amount: order.total_amount,
      provider: "vnpay",
      currency: "VND",
      status: "pending",
      merchant_code: built.merchantCode,
      create_date: built.createDate,
      payment_url: built.url,
      expires_at: order.payment_expires_at,
    },
    { transaction },
  );
}
async function assertCancellationAllowed(order, transaction) {
  if (order.payment_method !== "vnpay") return;
  if (
    order.payment_status === "paid" ||
    (await Payment.count({
      where: {
        order_id: order.order_id,
        status: { [Op.in]: ["succeeded", "review"] },
      },
      transaction,
    }))
  )
    throw fail(
      "Đơn VNPAY đã nhận tiền hoặc đang cần đối soát. Vui lòng liên hệ quản trị viên để kiểm tra và hoàn tiền trước khi hủy.",
    );
}
async function markCancelled(order, transaction, expired = false) {
  if (order.payment_method !== "vnpay") return;
  await Payment.update(
    { status: expired ? "expired" : "cancelled" },
    { where: { order_id: order.order_id, status: "pending" }, transaction },
  );
  order.payment_status = "failed";
}
async function assertFulfillmentAllowed(order, transaction) {
  if (
    order.payment_method === "vnpay" &&
    (order.payment_status !== "paid" ||
      (await Payment.count({
        where: { order_id: order.order_id, status: "review" },
        transaction,
      })))
  )
    throw fail(
      "Chỉ được xác nhận hoặc giao đơn VNPAY đã thanh toán thành công và không có giao dịch cần đối soát.",
    );
}
function summarize(order) {
  const payments = order.payments || [];
  return {
    payment: payments[0] || null,
    payment_review_required: payments.some((p) => p.status === "review"),
    can_pay:
      order.payment_method === "vnpay" &&
      order.order_status === "processing" &&
      order.payment_status !== "paid" &&
      !payments.some((p) => p.status === "review") &&
      new Date(order.payment_expires_at) > new Date(),
    can_cancel:
      order.order_status === "processing" &&
      (order.payment_method !== "vnpay" ||
        (order.payment_status !== "paid" &&
          !payments.some((p) => p.status === "review"))),
  };
}
async function ownedPayment(reference, actor) {
  if (typeof reference !== "string" || !/^[a-f0-9]{32}$/.test(reference))
    throw fail("Không tìm thấy giao dịch.", 404);
  const payment = await Payment.findOne({ where: { reference } });
  const order = payment && (await Order.findByPk(payment.order_id));
  if (
    !order ||
    (actor.role !== "admin" &&
      Number(order.user_id) !== Number(actor.user_id || actor.id))
  )
    throw fail("Không tìm thấy giao dịch.", 404);
  return { payment, order };
}
async function status(reference, actor) {
  const { payment, order } = await ownedPayment(reference, actor);
  const payments = await Payment.findAll({
    where: { order_id: order.order_id },
    attributes: safeAttributes,
    order: [["payment_id", "DESC"]],
  });
  return {
    reference: payment.reference,
    status: payment.status,
    order_id: order.order_id,
    order_code: order.order_code,
    amount: Number(payment.amount),
    payment_status: order.payment_status,
    order_status: order.order_status,
    expires_at: order.payment_expires_at,
    ...summarize({
      ...order.toJSON(),
      payments: payments.map((p) => p.toJSON()),
    }),
  };
}
async function paymentLink(orderId, actor, ip) {
  if (actor.role === "admin")
    throw fail("Quản trị viên không thanh toán thay khách hàng.", 403);
  if (!Number.isSafeInteger(Number(orderId)) || Number(orderId) <= 0)
    throw fail("Đơn hàng không hợp lệ.", 400);
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findOne({
      where: { order_id: orderId, user_id: actor.user_id || actor.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!order) throw fail("Không tìm thấy đơn hàng.", 404);
    if (order.payment_method !== "vnpay" || order.order_status !== "processing")
      throw fail("Đơn hàng này không thể thanh toán bằng VNPAY.");
    await assertCancellationAllowed(order, transaction);
    if (new Date(order.payment_expires_at) <= (await now(transaction)))
      throw fail("Đã hết thời gian thanh toán. Vui lòng đặt đơn mới.");
    let payment = await Payment.findOne({
      where: { order_id: order.order_id },
      order: [["payment_id", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!payment || payment.status !== "pending")
      payment = await createAttempt(order, transaction, ip);
    order.payment_status = "pending";
    await order.save({ transaction });
    return {
      payment_url: payment.payment_url,
      reference: payment.reference,
      expires_at: payment.expires_at,
    };
  });
}

// Only authenticated provider data reaches this function. Always lock order before payment.
async function applyResult(params, source) {
  const found = await Payment.findOne({
    where: { reference: params.vnp_TxnRef },
  });
  if (!found) return { RspCode: "01", Message: "Order not found" };
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(found.order_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const payment = await Payment.findByPk(found.payment_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const amount = params.vnp_Amount;
    if (
      params.vnp_TmnCode !== payment.merchant_code ||
      !/^\d{1,12}$/.test(amount || "") ||
      Number(amount) !== Number(payment.amount) * 100 ||
      Number(order.total_amount) !== Number(payment.amount)
    )
      return { RspCode: "04", Message: "Invalid amount or merchant" };
    if (
      !/^\d{2}$/.test(params.vnp_ResponseCode || "") ||
      !/^\d{2}$/.test(params.vnp_TransactionStatus || "")
    )
      return { RspCode: "99", Message: "Invalid status" };
    const fingerprint = crypto
      .createHash("sha256")
      .update(`${source}:${gateway.canonical(params)}`)
      .digest("hex");
    const [events] = await sequelize.query(
      `INSERT INTO payment_event(payment_id,fingerprint,source,response_code,transaction_status)
      VALUES(:id,:fingerprint,:source,:code,:state) ON CONFLICT(fingerprint) DO NOTHING RETURNING event_id`,
      {
        replacements: {
          id: payment.payment_id,
          fingerprint,
          source,
          code: params.vnp_ResponseCode,
          state: params.vnp_TransactionStatus,
        },
        transaction,
      },
    );
    const paid =
      params.vnp_ResponseCode === "00" && params.vnp_TransactionStatus === "00";
    const suspicious =
      ["04", "05", "06", "07", "09"].includes(params.vnp_TransactionStatus) ||
      params.vnp_ResponseCode === "07";
    if (
      !events.length ||
      (paid && payment.paid_at) ||
      (payment.status === "succeeded" && !suspicious) ||
      (payment.status === "review" && !paid)
    )
      return { RspCode: "02", Message: "Already confirmed" };
    payment.response_code = params.vnp_ResponseCode;
    payment.transaction_status = params.vnp_TransactionStatus;
    if (paid) {
      if (
        !/^\d{1,32}$/.test(params.vnp_TransactionNo || "") ||
        !gateway.parseDate(params.vnp_PayDate)
      )
        throw fail("Dữ liệu xác nhận thanh toán không hợp lệ.");
      const otherPaid = await Payment.count({
        where: {
          order_id: order.order_id,
          payment_id: { [Op.ne]: payment.payment_id },
          status: { [Op.in]: ["succeeded", "review"] },
        },
        transaction,
      });
      const review =
        payment.status !== "pending" ||
        order.order_status === "cancelled" ||
        order.payment_status === "paid" ||
        otherPaid;
      payment.status = review ? "review" : "succeeded";
      payment.review_reason = review
        ? "Đã nhận tiền sau khi đơn/giao dịch kết thúc hoặc có nhiều giao dịch nhận tiền. Cần đối soát và hoàn tiền qua VNPAY."
        : null;
      payment.paid_at = gateway.parseDate(params.vnp_PayDate);
      payment.provider_transaction_no = params.vnp_TransactionNo;
      order.payment_status = "paid";
      // A different, still-open payment URL must never be offered again for this order.
      await Payment.update(
        { status: "cancelled" },
        {
          where: {
            order_id: order.order_id,
            payment_id: { [Op.ne]: payment.payment_id },
            status: "pending",
          },
          transaction,
        },
      );
    } else if (suspicious || params.vnp_TransactionStatus === "00") {
      payment.status = "review";
      payment.review_reason =
        "VNPAY trả trạng thái cần kiểm tra. Chưa được giao hàng hoặc hoàn lượt tự động.";
    } else if (
      params.vnp_TransactionStatus === "02" &&
      payment.status === "pending"
    ) {
      payment.status = "failed";
      if (
        order.order_status === "processing" &&
        order.payment_status !== "paid"
      )
        order.payment_status = "failed";
    }
    await payment.save({ transaction });
    await order.save({ transaction });
    return { RspCode: "00", Message: "Confirm Success" };
  });
}
async function ipn(params) {
  if (!gateway.verifyIpn(params))
    return { RspCode: "97", Message: "Invalid signature" };
  return applyResult(params, "ipn");
}
async function handleReturn(params) {
  if (!gateway.verifyIpn(params)) return "invalid";
  if (!gateway.allowsSandboxReturn()) return "awaiting_ipn";
  const result = await applyResult(params, "return");
  return ["00", "02"].includes(result.RspCode) ? "verified" : "mismatch";
}
async function reconcilePayment(payment, allowExpiry = false) {
  // Database throttle works across app processes; network calls never hold order locks.
  const [rows] = await sequelize.query(
    `UPDATE payment_transaction SET last_checked_at=clock_timestamp()
    WHERE payment_id=:id AND (last_checked_at IS NULL OR last_checked_at < clock_timestamp()-interval '60 seconds') RETURNING payment_id`,
    { replacements: { id: payment.payment_id } },
  );
  if (!rows.length) return { state: "throttled" };
  let result;
  try {
    result = await gateway.queryTransaction(payment);
  } catch {
    throw fail(
      "Chưa kết nối được VNPAY để xác nhận. Đơn hàng vẫn được giữ để kiểm tra lại; vui lòng thử lại sau.",
      503,
    );
  }
  const notFound = result.vnp_ResponseCode === "91";
  if (result.vnp_ResponseCode === "00") {
    if (result.vnp_TransactionType !== "01")
      throw fail(
        "VNPAY trả giao dịch không phải thanh toán. Cần quản trị viên đối soát.",
        503,
      );
    // Query response code describes the query, not the payment outcome.
    const applied = await applyResult(
      {
        ...result,
        vnp_ResponseCode: result.vnp_TransactionStatus === "00" ? "00" : "99",
      },
      "query",
    );
    if (!["00", "02"].includes(applied.RspCode))
      throw fail("Thông tin VNPAY chưa khớp đơn hàng; cần kiểm tra lại.", 503);
  } else if (!notFound)
    throw fail(
      "VNPAY chưa cung cấp kết quả giao dịch. Vui lòng thử lại sau.",
      503,
    );
  if (
    allowExpiry &&
    (notFound || ["01", "02"].includes(result.vnp_TransactionStatus))
  )
    await require("./order.service").expireOnlineOrder(
      payment.order_id,
      payment.payment_id,
    );
  return {
    state: notFound
      ? "not_found"
      : result.vnp_TransactionStatus === "01"
        ? "pending"
        : "checked",
  };
}
async function reconcile(reference, actor) {
  const { payment } = await ownedPayment(reference, actor);
  let reconciliation;
  if (!["succeeded", "review"].includes(payment.status))
    reconciliation = await reconcilePayment(payment, true);
  return { ...(await status(reference, actor)), reconciliation };
}
async function expirePending() {
  const orders = await Order.findAll({
    where: {
      payment_method: "vnpay",
      order_status: "processing",
      payment_status: { [Op.ne]: "paid" },
      payment_expires_at: { [Op.lt]: new Date(Date.now() - 120000) },
    },
    order: [
      [
        sequelize.literal(
          '(SELECT p.last_checked_at FROM payment_transaction p WHERE p.order_id = "Order".order_id ORDER BY p.payment_id DESC LIMIT 1)',
        ),
        "ASC NULLS FIRST",
      ],
      ["payment_expires_at", "ASC"],
    ],
    limit: 20,
  });
  for (const order of orders) {
    const payment = await Payment.findOne({
      where: { order_id: order.order_id },
      order: [["payment_id", "DESC"]],
    });
    if (!payment || payment.status === "review") continue;
    try {
      if (payment.status === "failed")
        await require("./order.service").expireOnlineOrder(
          order.order_id,
          payment.payment_id,
        );
      else await reconcilePayment(payment, true);
    } catch (error) {
      if (error.logToConsole !== false) console.error(error.stack || error);
    }
  }
}
function startWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await expirePending();
    } catch (error) {
      if (error.logToConsole !== false) console.error(error.stack || error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  return timer;
}
module.exports = {
  handleReturn,
  paymentInclude,
  summarize,
  createAttempt,
  paymentLink,
  status,
  ipn,
  reconcile,
  expirePending,
  startWorker,
  assertCancellationAllowed,
  assertFulfillmentAllowed,
  markCancelled,
};
