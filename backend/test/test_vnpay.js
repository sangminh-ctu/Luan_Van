// Isolated database, schema only. Fake merchant keys; never sends sandbox requests.
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { Sequelize } = require("sequelize");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
  quiet: true,
});
Object.assign(process.env, {
  VNPAY_TMN_CODE: "TEST1234",
  VNPAY_HASH_SECRET: "test-secret-for-local-tests-only",
  VNPAY_PAYMENT_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  VNPAY_RETURN_URL: "http://localhost:5000/api/vnpay/return",
  VNPAY_SANDBOX_RETURN_CONFIRMATION: "false",
  FRONTEND_URL: "http://localhost:5173",
});
const sourceName = process.env.DB_NAME,
  testName = `vnpay_test_${Date.now()}_${process.pid}`;
const source = new Sequelize(
  sourceName,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
  },
);
let db,
  server,
  created = false,
  serial = 0,
  passed = 0;
const ok = (message) => {
  passed++;
  console.log("PASS " + message);
};
const sign = (params) => {
  const encoded = Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key]).replace(/%20/g, "+")}`,
    )
    .join("&");
  return {
    ...params,
    vnp_SecureHash: crypto
      .createHmac("sha512", process.env.VNPAY_HASH_SECRET)
      .update(encoded)
      .digest("hex"),
  };
};
async function run() {
  try {
    const schema = execFileSync(
      process.env.PG_DUMP_PATH ||
        (process.platform === "win32"
          ? "C:/Program Files/PostgreSQL/18/bin/pg_dump.exe"
          : "pg_dump"),
      [
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "-h",
        process.env.DB_HOST || "localhost",
        "-p",
        process.env.DB_PORT || "5432",
        "-U",
        process.env.DB_USER,
        "-d",
        sourceName,
      ],
      {
        env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD },
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    )
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("\\"))
      .join("\n")
      .replace("CREATE SCHEMA public;", "CREATE SCHEMA IF NOT EXISTS public;");
    await source.query(`CREATE DATABASE "${testName}"`);
    created = true;
    process.env.DB_NAME = testName;
    db = require("../src/config/database").sequelize;
    await db.query(schema);
    await db.query("SET search_path TO public");
    for (const file of ["011_membership.sql", "012_vnpay.sql", "012_vnpay.sql"])
      await db.query(
        fs.readFileSync(
          path.join(__dirname, "../../database/migrations", file),
          "utf8",
        ),
      );
    const {
      User,
      Address,
      Category,
      Book,
      Inventory,
      CartItem,
      Order,
      Voucher,
    } = require("../src/models/associations");
    const Payment = require("../src/models/PaymentTransaction"),
      orders = require("../src/services/order.service"),
      payments = require("../src/services/payment.service"),
      gateway = require("../src/services/vnpay.gateway");
    const category = await Category.create({ category_name: "Payment tests" });
    const book = await Book.create({
      title: "Payment book",
      price: 100000,
      discount_percent: 10,
      category_id: category.category_id,
    });
    await Inventory.create({ book_id: book.book_id, stock_quantity: 10000 });
    const stock = async () =>
      (await Inventory.findByPk(book.book_id)).stock_quantity;
    async function customer() {
      const user = await User.create({
        full_name: "Payment test",
        email: `payment-${++serial}@example.invalid`,
        password: "unused",
        role: "customer",
      });
      const address = await Address.create({
        user_id: user.user_id,
        recipient_name: "Test",
        recipient_phone: "0900000000",
        province: "Test",
        district: "Test",
        ward: "Test",
        street_detail: "Test",
      });
      return {
        id: user.user_id,
        address: address.address_id,
        actor: { user_id: user.user_id, role: "customer" },
      };
    }
    async function voucher() {
      return (
        await db.query(
          `INSERT INTO voucher(code,discount_type,discount_value,min_order_value,start_date,end_date,usage_limit,per_user_limit)
        VALUES(:code,'percent',10,10000,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')-interval '1 hour',
        (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')+interval '1 day',100,1) RETURNING *`,
          { replacements: { code: `PAY_${++serial}` } },
        )
      )[0][0];
    }
    async function prepare(user, v) {
      await CartItem.upsert({
        user_id: user.id,
        book_id: book.book_id,
        quantity: 1,
      });
      const quote = await orders.preview(user.id, {
        book_ids: [book.book_id],
        voucher_code: v?.code,
      });
      return {
        book_ids: [book.book_id],
        address_id: user.address,
        voucher_code: v?.code,
        payment_method: "vnpay",
        expected_prices: quote.expected_prices,
        expected_quantities: { [book.book_id]: 1 },
        expected_quote: Object.fromEntries(
          [
            "subtotal",
            "shipping_fee",
            "voucher_discount_amount",
            "total_amount",
          ].map((k) => [k, quote[k]]),
        ),
      };
    }
    const makeOrder = async (user, v) =>
      orders.createOrder(user.id, await prepare(user, v), { ip: "127.0.0.1" });
    async function callback(order, override = {}) {
      const p = await Payment.findOne({
        where: { order_id: order.order_id },
        order: [["payment_id", "DESC"]],
      });
      return sign({
        vnp_TxnRef: p.reference,
        vnp_TmnCode: "TEST1234",
        vnp_Amount: String(Number(p.amount) * 100),
        vnp_ResponseCode: "00",
        vnp_TransactionStatus: "00",
        vnp_TransactionNo: String(1000000 + ++serial),
        vnp_PayDate: gateway.dateString(new Date()),
        ...override,
      });
    }
    const user = await customer(),
      stranger = await customer(),
      v = await voucher();
    const before = await stock(),
      order = await makeOrder(user, v);
    assert.equal(order.total_amount, 111000);
    assert.equal(order.payment_status, "pending");
    assert.equal(order.payment_method, "vnpay");
    assert.equal(await stock(), before - 1);
    assert.equal((await Voucher.findByPk(v.voucher_id)).used_count, 1);
    assert.equal(order.payment.payment_url, undefined);
    assert.equal(order.payment.merchant_code, undefined);
    const links = await Promise.all([
      payments.paymentLink(order.order_id, user.actor, "::1"),
      payments.paymentLink(order.order_id, user.actor, "::1"),
    ]);
    assert.equal(links[0].reference, links[1].reference);
    assert.equal(
      await Payment.count({ where: { order_id: order.order_id } }),
      1,
    );
    const parsed = Object.fromEntries(
      new URL(links[0].payment_url).searchParams,
    );
    assert.equal(parsed.vnp_Amount, "11100000");
    assert.equal(parsed.vnp_CreateDate.length, 14);
    assert.equal(parsed.vnp_IpAddr, "127.0.0.1");
    const { vnp_SecureHash: builtHash, ...unsigned } = parsed;
    assert.equal(builtHash, sign(unsigned).vnp_SecureHash);
    assert.equal(
      gateway.dateString(new Date("2026-11-13T00:00:00Z")),
      "20261113070000",
    );
    ok(
      "atomic reservation, backend price, signed URL, GMT+7 and concurrent link reuse",
    );
    await assert.rejects(
      payments.paymentLink(order.order_id, stranger.actor),
      (e) => e.status === 404,
    );
    await assert.rejects(
      payments.paymentLink(order.order_id, { role: "admin" }),
      (e) => e.status === 403,
    );
    await assert.rejects(
      payments.status(links[0].reference, stranger.actor),
      (e) => e.status === 404,
    );
    await assert.rejects(
      orders.updateOrderStatusByAdmin(order.order_id, { status: "confirmed" }),
      (e) => e.status === 409,
    );
    await assert.rejects(
      orders.updateShipmentInfoByAdmin(order.order_id, {
        shipping_status: "delivered",
      }),
      (e) => e.status === 409,
    );
    ok(
      "ownership and admin guards prevent reading other payments or fulfilling unpaid orders",
    );
    const valid = await callback(order);
    assert.equal(
      (await payments.ipn({ ...valid, vnp_Amount: "1" })).RspCode,
      "97",
    );
    assert.equal(
      (await payments.ipn(sign({ ...unsigned, vnp_TxnRef: "0".repeat(32) })))
        .RspCode,
      "01",
    );
    assert.equal(
      (await payments.ipn(await callback(order, { vnp_Amount: "100" })))
        .RspCode,
      "04",
    );
    assert.equal(
      (
        await payments.ipn({
          ...valid,
          vnp_TxnRef: [valid.vnp_TxnRef, valid.vnp_TxnRef],
        })
      ).RspCode,
      "97",
    );
    assert.equal(
      (await Order.findByPk(order.order_id)).payment_status,
      "pending",
    );
    const confirmed = await Promise.all([
      payments.ipn(valid),
      payments.ipn(valid),
    ]);
    assert.deepEqual(confirmed.map((r) => r.RspCode).sort(), ["00", "02"]);
    assert.equal((await Order.findByPk(order.order_id)).payment_status, "paid");
    assert.equal(await stock(), before - 1);
    assert.equal((await Voucher.findByPk(v.voucher_id)).used_count, 1);
    await assert.rejects(
      orders.cancelOrderByCustomer(user.id, order.order_id),
      (e) => e.status === 409,
    );
    await assert.rejects(
      orders.updateOrderStatusByAdmin(order.order_id, { status: "cancelled" }),
      (e) => e.status === 409,
    );
    await orders.updateOrderStatusByAdmin(order.order_id, {
      status: "confirmed",
    });
    await orders.updateOrderStatusByAdmin(order.order_id, {
      status: "shipping",
    });
    await orders.updateOrderStatusByAdmin(order.order_id, {
      status: "delivered",
    });
    assert.equal(
      (await require("../src/services/membership.service").get(user.id))
        .eligible_spend,
      81000,
    );
    ok(
      "forged/duplicate IPN is safe; paid order fulfills normally and cannot be cancelled without refund",
    );

    const retryUser = await customer(),
      retryVoucher = await voucher(),
      retryOrder = await makeOrder(retryUser, retryVoucher);
    const oldRef = retryOrder.payment.reference;
    await payments.ipn(
      await callback(retryOrder, {
        vnp_ResponseCode: "24",
        vnp_TransactionStatus: "02",
        vnp_TransactionNo: "0",
      }),
    );
    assert.equal(
      (await Order.findByPk(retryOrder.order_id)).payment_status,
      "failed",
    );
    const retry = await payments.paymentLink(
      retryOrder.order_id,
      retryUser.actor,
    );
    assert.notEqual(retry.reference, oldRef);
    assert.equal(
      new Date(retry.expires_at).getTime(),
      new Date(retryOrder.payment_expires_at).getTime(),
    );
    assert.equal(
      (await Voucher.findByPk(retryVoucher.voucher_id)).used_count,
      1,
    );
    await payments.ipn(await callback(retryOrder));
    const lateOld = await callback(retryOrder, { vnp_TxnRef: oldRef });
    await payments.ipn(lateOld);
    assert.equal(
      (await orders.getCustomerOrderById(retryUser.id, retryOrder.order_id))
        .payment_review_required,
      true,
    );
    await assert.rejects(
      orders.updateOrderStatusByAdmin(retryOrder.order_id, {
        status: "confirmed",
      }),
      (e) => e.status === 409,
    );
    ok(
      "failed attempt retries with a fresh reference and original expiry; double payment requires review",
    );

    const cancelUser = await customer(),
      cancelVoucher = await voucher(),
      cancelled = await makeOrder(cancelUser, cancelVoucher),
      cancelPaid = await callback(cancelled);
    const stockReserved = await stock();
    const cancels = await Promise.allSettled([
      orders.cancelOrderByCustomer(cancelUser.id, cancelled.order_id),
      orders.updateOrderStatusByAdmin(cancelled.order_id, {
        status: "cancelled",
      }),
    ]);
    assert.equal(cancels.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await stock(), stockReserved + 1);
    assert.equal(
      (await Voucher.findByPk(cancelVoucher.voucher_id)).used_count,
      0,
    );
    await payments.ipn(cancelPaid);
    await payments.ipn(cancelPaid);
    const late = await orders.getCustomerOrderById(
      cancelUser.id,
      cancelled.order_id,
    );
    assert.equal(late.order_status, "cancelled");
    assert.equal(late.payment_status, "paid");
    assert.equal(late.payment_review_required, true);
    assert.equal(await stock(), stockReserved + 1);
    assert.equal(
      (await Voucher.findByPk(cancelVoucher.voucher_id)).used_count,
      0,
    );
    ok(
      "customer/admin cancellation restores once; late money is recorded for review without reopening order",
    );

    const raceUser = await customer(),
      raceOrder = await makeOrder(raceUser),
      racePaid = await callback(raceOrder),
      raceStock = await stock();
    await Promise.allSettled([
      payments.ipn(racePaid),
      orders.cancelOrderByCustomer(raceUser.id, raceOrder.order_id),
    ]);
    const raced = await orders.getCustomerOrderById(
      raceUser.id,
      raceOrder.order_id,
    );
    assert.equal(raced.payment_status, "paid");
    assert.equal(
      await stock(),
      raceStock + (raced.order_status === "cancelled" ? 1 : 0),
    );
    assert.equal(
      raced.payment_review_required,
      raced.order_status === "cancelled",
    );
    ok("payment and cancellation race serializes on order lock");

    const rollbackUser = await customer(),
      rollbackVoucher = await voucher(),
      body = await prepare(rollbackUser, rollbackVoucher),
      rollbackStock = await stock(),
      orderCount = await Order.count();
    const originalCreate = payments.createAttempt;
    payments.createAttempt = async () => {
      throw new Error("injected payment storage failure");
    };
    try {
      await assert.rejects(
        orders.createOrder(rollbackUser.id, body),
        /injected/,
      );
    } finally {
      payments.createAttempt = originalCreate;
    }
    assert.equal(await stock(), rollbackStock);
    assert.equal(await Order.count(), orderCount);
    assert.equal(
      (await Voucher.findByPk(rollbackVoucher.voucher_id)).used_count,
      0,
    );
    assert.equal(
      await CartItem.count({ where: { user_id: rollbackUser.id } }),
      1,
    );
    ok("payment creation failure rolls back order, stock, cart and voucher");

    const lastVoucher = await voucher(),
      lastA = await customer(),
      lastB = await customer();
    await Voucher.update(
      { usage_limit: 1 },
      { where: { voucher_id: lastVoucher.voucher_id } },
    );
    const lastPayloads = await Promise.all([
      prepare(lastA, lastVoucher),
      prepare(lastB, lastVoucher),
    ]);
    const lastStock = await stock();
    const lastResults = await Promise.allSettled([
      orders.createOrder(lastA.id, lastPayloads[0]),
      orders.createOrder(lastB.id, lastPayloads[1]),
    ]);
    assert.equal(lastResults.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await stock(), lastStock - 1);
    assert.equal(
      (await Voucher.findByPk(lastVoucher.voucher_id)).used_count,
      1,
    );
    const winner = lastResults.find((r) => r.status === "fulfilled").value;
    const originalCancel = payments.markCancelled;
    payments.markCancelled = async (...args) => {
      await originalCancel(...args);
      throw new Error("injected cancellation failure");
    };
    try {
      await assert.rejects(
        orders.cancelOrderByCustomer(winner.user_id, winner.order_id),
        /injected/,
      );
    } finally {
      payments.markCancelled = originalCancel;
    }
    assert.equal(
      (await Order.findByPk(winner.order_id)).order_status,
      "processing",
    );
    assert.equal(
      (await Payment.findOne({ where: { order_id: winner.order_id } })).status,
      "pending",
    );
    assert.equal(await stock(), lastStock - 1);
    assert.equal(
      (await Voucher.findByPk(lastVoucher.voucher_id)).used_count,
      1,
    );
    ok(
      "online orders race for last voucher use; cancellation failure rolls back payment, stock and voucher together",
    );

    const expUser = await customer(),
      expV = await voucher(),
      expOrder = await makeOrder(expUser, expV);
    await db.query(
      `UPDATE orders SET payment_expires_at=clock_timestamp()-interval '3 minutes' WHERE order_id=:id`,
      { replacements: { id: expOrder.order_id } },
    );
    const queryOriginal = gateway.queryTransaction,
      expStock = await stock();
    try {
      gateway.queryTransaction = async () => {
        throw new Error("network");
      };
      await payments.expirePending();
      assert.equal(
        (await Order.findByPk(expOrder.order_id)).order_status,
        "processing",
      );
      assert.equal(await stock(), expStock);
      await db.query(
        "UPDATE payment_transaction SET last_checked_at=NULL WHERE order_id=:id",
        { replacements: { id: expOrder.order_id } },
      );
      gateway.queryTransaction = async (p) => ({
        vnp_TmnCode: p.merchant_code,
        vnp_TxnRef: p.reference,
        vnp_ResponseCode: "91",
      });
      await payments.expirePending();
      await payments.expirePending();
      assert.equal(
        (await Order.findByPk(expOrder.order_id)).order_status,
        "cancelled",
      );
      assert.equal(await stock(), expStock + 1);
      assert.equal((await Voucher.findByPk(expV.voucher_id)).used_count, 0);
      await payments.ipn(await callback(expOrder));
      assert.equal(
        (await orders.getCustomerOrderById(expUser.id, expOrder.order_id))
          .payment_review_required,
        true,
      );
    } finally {
      gateway.queryTransaction = queryOriginal;
    }
    ok(
      "expiry waits for provider reconciliation; releases once; late success after expiry requires review",
    );

    const reviewUser = await customer(),
      reviewOrder = await makeOrder(reviewUser);
    await payments.ipn(
      await callback(reviewOrder, {
        vnp_ResponseCode: "07",
        vnp_TransactionStatus: "07",
      }),
    );
    assert.equal(
      (await orders.getCustomerOrderById(reviewUser.id, reviewOrder.order_id))
        .payment_review_required,
      true,
    );
    await assert.rejects(
      payments.paymentLink(reviewOrder.order_id, reviewUser.actor),
      (e) => e.status === 409,
    );
    await assert.rejects(
      orders.cancelOrderByCustomer(reviewUser.id, reviewOrder.order_id),
      (e) => e.status === 409,
    );
    const reviewPaid = await callback(reviewOrder);
    await payments.ipn(reviewPaid);
    const recordedReview = await Payment.findOne({
      where: { order_id: reviewOrder.order_id },
    });
    assert.equal(recordedReview.status, "review");
    assert.ok(recordedReview.paid_at);
    assert.equal(
      (await Order.findByPk(reviewOrder.order_id)).payment_status,
      "paid",
    );
    assert.equal((await payments.ipn(reviewPaid)).RspCode, "02");
    ok(
      "suspicious result blocks fulfillment/retry/cancel; subsequent captured payment is still recorded once",
    );

    const queryUser = await customer(),
      queryOrder = await makeOrder(queryUser),
      queryPayment = await Payment.findOne({
        where: { reference: queryOrder.payment.reference },
      });
    const realFetch = global.fetch;
    const responseKeys = [
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
    let badQuery = false,
      queryCalls = 0;
    global.fetch = async (url, options) => {
      queryCalls++;
      const request = JSON.parse(options.body),
        { vnp_SecureHash, ...data } = request;
      assert.equal(
        vnp_SecureHash,
        crypto
          .createHmac("sha512", process.env.VNPAY_HASH_SECRET)
          .update(Object.values(data).join("|"))
          .digest("hex"),
      );
      const response = {
        vnp_ResponseId: "request",
        vnp_Command: "querydr",
        vnp_ResponseCode: "00",
        vnp_Message: "Success",
        vnp_TmnCode: "TEST1234",
        vnp_TxnRef: queryPayment.reference,
        vnp_Amount: String(Number(queryPayment.amount) * 100),
        vnp_PayDate: gateway.dateString(new Date()),
        vnp_TransactionNo: String(++serial + 1000000),
        vnp_TransactionType: "01",
        vnp_TransactionStatus: "00",
      };
      response.vnp_SecureHash = crypto
        .createHmac("sha512", process.env.VNPAY_HASH_SECRET)
        .update(responseKeys.map((k) => response[k] || "").join("|"))
        .digest("hex");
      if (badQuery) response.vnp_Amount = "1";
      return { ok: true, json: async () => response };
    };
    try {
      badQuery = true;
      await assert.rejects(gateway.queryTransaction(queryPayment), /signature/);
      badQuery = false;
      await payments.reconcile(queryPayment.reference, queryUser.actor);
      assert.equal(
        (await Order.findByPk(queryOrder.order_id)).payment_status,
        "paid",
      );
      await payments.reconcile(queryPayment.reference, queryUser.actor);
      assert.equal(queryCalls, 2);
    } finally {
      global.fetch = realFetch;
    }
    ok(
      "signed query request/response, tamper rejection and duplicate reconciliation",
    );

    const app = require("../src/app"),
      jwt = require("jsonwebtoken");
    server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const token = (who) =>
      jwt.sign(who, process.env.JWT_SECRET || "fallback_secret_key");
    const returned = await fetch(
      `${base}/vnpay/return?${new URLSearchParams({ ...(await callback(queryOrder)), vnp_ResponseCode: "00" })}`,
      { redirect: "manual" },
    );
    assert.equal(returned.status, 303);
    assert.ok(
      returned.headers
        .get("location")
        .includes("/payment/vnpay-return?reference="),
    );
    const pendingReturn = await makeOrder(stranger);
    await fetch(
      `${base}/vnpay/return?${new URLSearchParams(await callback(pendingReturn))}`,
      { redirect: "manual" },
    );
    assert.equal(
      (await Order.findByPk(pendingReturn.order_id)).payment_status,
      "pending",
    );
    assert.equal(
      (await fetch(`${base}/vnpay/${pendingReturn.payment.reference}/status`))
        .status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/vnpay/${pendingReturn.payment.reference}/status`, {
          headers: { Authorization: `Bearer ${token(user.actor)}` },
        })
      ).status,
      404,
    );
    const cfg = await (await fetch(`${base}/payments/vnpay/config`)).json();
    assert.equal(cfg.vnpay_enabled, true);
    assert.equal(cfg.secret, undefined);
    const publicIpn = await (
      await fetch(
        `${base}/vnpay/ipn?${new URLSearchParams(await callback(pendingReturn))}`,
      )
    ).json();
    assert.equal(publicIpn.RspCode, "00");
    ok(
      "HTTP public IPN works, Return is read-only, status is owner-only, config exposes no keys",
    );
    process.env.VNPAY_SANDBOX_RETURN_CONFIRMATION = "true";
    assert.equal(gateway.allowsSandboxReturn(), true);
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    assert.equal(gateway.allowsSandboxReturn(), false);
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    process.env.FRONTEND_URL = "https://shop.example.invalid";
    assert.equal(gateway.allowsSandboxReturn(), false);
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.VNPAY_RETURN_URL =
      "https://backend.example.invalid/api/vnpay/return";
    assert.equal(gateway.allowsSandboxReturn(), false);
    process.env.VNPAY_RETURN_URL = "http://localhost:5000/api/vnpay/return";
    const returnUser = await customer(),
      returnOrder = await makeOrder(returnUser),
      returnPaid = await callback(returnOrder);
    const returnRequest = async (params) =>
      fetch(`${base}/vnpay/return?${new URLSearchParams(params)}`, {
        redirect: "manual",
      });
    const invalidReturn = await returnRequest({
      ...returnPaid,
      vnp_Amount: "1",
    });
    assert.ok(
      invalidReturn.headers.get("location").includes("return_status=invalid"),
    );
    assert.equal(
      (await Order.findByPk(returnOrder.order_id)).payment_status,
      "pending",
    );
    const mismatchedReturn = await returnRequest(
      await callback(returnOrder, { vnp_Amount: "100" }),
    );
    assert.ok(
      mismatchedReturn.headers
        .get("location")
        .includes("return_status=mismatch"),
    );
    assert.equal(
      (await Order.findByPk(returnOrder.order_id)).payment_status,
      "pending",
    );
    const returnStock = await stock();
    await Promise.all([returnRequest(returnPaid), payments.ipn(returnPaid)]);
    await returnRequest(returnPaid);
    const returnedOrder = await orders.getCustomerOrderById(
      returnUser.id,
      returnOrder.order_id,
    );
    assert.equal(returnedOrder.payment_status, "paid");
    assert.equal(returnedOrder.payment_review_required, false);
    assert.equal(await stock(), returnStock);
    const [returnEvents] = await db.query(
      `SELECT count(*)::int AS count FROM payment_event e JOIN payment_transaction p USING(payment_id) WHERE p.reference=:reference AND e.source='return'`,
      { replacements: { reference: returnPaid.vnp_TxnRef } },
    );
    assert.equal(returnEvents[0].count, 1);
    ok(
      "opt-in localhost Sandbox verifies signed Return, rejects tampering/amount mismatch, serializes with IPN and cannot enable on public/production",
    );

    const lateReturnUser = await customer(),
      lateReturnOrder = await makeOrder(lateReturnUser),
      lateReturnPaid = await callback(lateReturnOrder);
    await orders.cancelOrderByCustomer(
      lateReturnUser.id,
      lateReturnOrder.order_id,
    );
    await returnRequest(lateReturnPaid);
    const reviewedReturn = await orders.getCustomerOrderById(
      lateReturnUser.id,
      lateReturnOrder.order_id,
    );
    assert.equal(reviewedReturn.order_status, "cancelled");
    assert.equal(reviewedReturn.payment_status, "paid");
    assert.equal(reviewedReturn.payment_review_required, true);
    const failedReturnUser = await customer(),
      failedReturnOrder = await makeOrder(failedReturnUser);
    await returnRequest(
      await callback(failedReturnOrder, {
        vnp_ResponseCode: "24",
        vnp_TransactionStatus: "02",
      }),
    );
    assert.equal(
      (await Order.findByPk(failedReturnOrder.order_id)).payment_status,
      "failed",
    );
    ok(
      "verified failure Return is actionable; late paid Return preserves cancelled order and requires review",
    );
    process.env.VNPAY_SANDBOX_RETURN_CONFIRMATION = "false";
    console.log(`Completed ${passed} VNPAY integration groups.`);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.close();
    if (created) {
      assert.match(testName, /^vnpay_test_\d+_\d+$/);
      await source.query(`DROP DATABASE "${testName}" WITH (FORCE)`);
    }
    await source.close();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
