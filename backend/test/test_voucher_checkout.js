// Real transactions and concurrent requests in a disposable database; schema only is copied.
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { Sequelize } = require("sequelize");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
  quiet: true,
});
const sourceName = process.env.DB_NAME;
const testName = `voucher_checkout_test_${Date.now()}_${process.pid}`;
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
  passed = 0;
const ok = (name) => {
  passed++;
  console.log("PASS " + name);
};
const rejectCode = (promise, code) =>
  assert.rejects(promise, (e) => e.code === code);
async function run() {
  try {
    const dump = execFileSync(
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
    await db.query(dump);
    await db.query("SET search_path TO public");
    await db.query(
      fs.readFileSync(
        path.join(
          __dirname,
          "../../database/migrations/010_voucher_checkout.sql",
        ),
        "utf8",
      ),
    );
    const models = require("../src/models/associations");
    const {
      User,
      Address,
      Category,
      Book,
      Inventory,
      CartItem,
      Voucher,
      Order,
      Shipment,
      FlashSale,
      FlashSaleItem,
    } = models;
    const orders = require("../src/services/order.service");
    const vouchers = require("../src/services/voucher.service");
    const adminVouchers = require("../src/services/admin/voucher.service");
    const category = await Category.create({ category_name: "Voucher tests" });
    const books = await Book.bulkCreate([
      {
        title: "A",
        price: 100000,
        discount_percent: 10,
        category_id: category.category_id,
      },
      {
        title: "B",
        price: 80000,
        discount_percent: 0,
        category_id: category.category_id,
      },
    ]);
    await Inventory.bulkCreate(
      books.map((book) => ({ book_id: book.book_id, stock_quantity: 10000 })),
    );
    let serial = 0;
    async function customer() {
      const user = await User.create({
        full_name: "Voucher test",
        email: `customer-${++serial}@example.invalid`,
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
      return { id: user.user_id, address: address.address_id };
    }
    async function cart(user, book = books[0], quantity = 1) {
      await CartItem.upsert({
        user_id: user.id,
        book_id: book.book_id,
        quantity,
      });
    }
    async function voucher(overrides = {}) {
      const [rows] = await db.query(
        `INSERT INTO voucher (code, discount_type, discount_value, min_order_value, max_discount_amount, start_date, end_date, usage_limit, per_user_limit)
                VALUES (:code, :type, :value, :min, :cap, (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') - interval '1 hour', (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '1 hour', :limit, :per) RETURNING *`,
        {
          replacements: {
            code: `TEST_${++serial}`,
            type: "percent",
            value: 10,
            min: 10000,
            cap: null,
            limit: 100,
            per: 1,
            ...overrides,
          },
        },
      );
      return rows[0];
    }
    async function payload(user, code, ids = [books[0].book_id]) {
      const quote = await orders.preview(user.id, {
        book_ids: ids,
        voucher_code: code,
      });
      return {
        book_ids: ids,
        address_id: user.address,
        payment_method: "cod",
        voucher_code: code,
        expected_prices: quote.expected_prices,
        expected_quantities: Object.fromEntries(
          quote.items.map((item) => [item.book_id, item.quantity]),
        ),
        expected_quote: Object.fromEntries(
          [
            "subtotal",
            "shipping_fee",
            "voucher_discount_amount",
            "total_amount",
          ].map((key) => [key, quote[key]]),
        ),
      };
    }
    const used = async (v) => (await Voucher.findByPk(v.voucher_id)).used_count;
    const stock = async (book) =>
      (await Inventory.findByPk(book.book_id)).stock_quantity;

    const user = await customer();
    await cart(user);
    const percent = await voucher();
    const quote = await orders.preview(user.id, {
      book_ids: [books[0].book_id],
      voucher_code: percent.code.toLowerCase(),
    });
    assert.equal(quote.subtotal, 90000);
    assert.equal(quote.voucher_discount_amount, 9000);
    assert.equal(quote.total_amount, 111000);
    assert.equal(quote.voucher.user_remaining_uses, 1);
    assert.equal(await used(percent), 0);
    ok(
      "preview uses discounted book prices, normalizes code and does not consume a use",
    );
    assert.equal(
      vouchers.calculateDiscount(
        {
          discount_type: "percent",
          discount_value: "12.50",
          max_discount_amount: "10000.00",
        },
        90000,
      ),
      10000,
    );
    assert.equal(
      vouchers.calculateDiscount(
        { discount_type: "fixed_amount", discount_value: "999999.00" },
        90000,
      ),
      90000,
    );
    assert.equal(
      vouchers.calculateDiscount(
        {
          discount_type: "percent",
          discount_value: "0.50",
          max_discount_amount: null,
        },
        101,
      ),
      1,
    );
    ok("percentage cap, whole-VND rounding and subtotal clamp");

    const flash = await FlashSale.create({
      name: "Voucher flash",
      start_at: new Date(Date.now() - 60000),
      end_at: new Date(Date.now() + 3600000),
      status: "published",
    });
    await FlashSaleItem.create({
      flash_sale_id: flash.flash_sale_id,
      book_id: books[0].book_id,
      sale_price: 70000,
    });
    const flashQuote = await orders.preview(user.id, {
      book_ids: [books[0].book_id],
      voucher_code: percent.code,
    });
    assert.equal(flashQuote.subtotal, 70000);
    assert.equal(flashQuote.voucher_discount_amount, 7000);
    const flashOrder = await orders.createOrder(
      user.id,
      await payload(user, percent.code),
    );
    assert.equal(flashOrder.items[0].unit_price_at_purchase, 70000);
    assert.equal(flashOrder.voucher.code, percent.code);
    assert.equal(await used(percent), 1);
    await FlashSale.update(
      { status: "cancelled" },
      { where: { flash_sale_id: flash.flash_sale_id } },
    );
    ok(
      "checkout combines Flash Sale and voucher and persists the order discount",
    );
    await cart(user);
    await rejectCode(
      orders.preview(user.id, {
        book_ids: [books[0].book_id],
        voucher_code: percent.code,
      }),
      "VOUCHER_USER_LIMIT",
    );
    const another = await customer();
    await cart(another);
    await orders.createOrder(another.id, await payload(another, percent.code));
    assert.equal(await used(percent), 2);
    ok(
      "per-account limit blocks reuse while another account can use the same code",
    );

    await orders.cancelOrderByCustomer(user.id, flashOrder.order_id);
    assert.equal(await used(percent), 1);
    const reused = await orders.createOrder(
      user.id,
      await payload(user, percent.code),
    );
    await orders.updateOrderStatusByAdmin(reused.order_id, {
      status: "confirmed",
    });
    await orders.updateOrderStatusByAdmin(reused.order_id, {
      status: "cancelled",
    });
    assert.equal(await used(percent), 1);
    ok("customer and admin cancellation restore total and personal uses");

    const cancelledUser = await customer();
    await cart(cancelledUser);
    const cancelCode = await voucher();
    const cancelOrder = await orders.createOrder(
      cancelledUser.id,
      await payload(cancelledUser, cancelCode.code),
    );
    const stockBeforeCancel = await stock(books[0]);
    const cancellations = await Promise.allSettled([
      orders.cancelOrderByCustomer(cancelledUser.id, cancelOrder.order_id),
      orders.updateOrderStatusByAdmin(cancelOrder.order_id, {
        status: "cancelled",
      }),
    ]);
    assert.equal(
      cancellations.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(await used(cancelCode), 0);
    assert.equal(await stock(books[0]), stockBeforeCancel + 1);
    ok("simultaneous customer/admin cancellation restores exactly once");

    const a = await customer(),
      b = await customer();
    await cart(a);
    await cart(b, books[1]);
    const last = await voucher({ limit: 1 });
    const [pa, pb] = await Promise.all([
      payload(a, last.code),
      payload(b, last.code, [books[1].book_id]),
    ]);
    const race = await Promise.allSettled([
      orders.createOrder(a.id, pa),
      orders.createOrder(b.id, pb),
    ]);
    assert.equal(
      race.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      race.find((result) => result.status === "rejected").reason.code,
      "VOUCHER_EXHAUSTED",
    );
    assert.equal(await used(last), 1);
    ok(
      "two different accounts racing for last total use have exactly one winner",
    );

    const personal = await customer();
    await cart(personal);
    await cart(personal, books[1]);
    const personalCode = await voucher();
    const [p1, p2] = await Promise.all([
      payload(personal, personalCode.code),
      payload(personal, personalCode.code, [books[1].book_id]),
    ]);
    const personalRace = await Promise.allSettled([
      orders.createOrder(personal.id, p1),
      orders.createOrder(personal.id, p2),
    ]);
    assert.equal(
      personalRace.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      personalRace.find((result) => result.status === "rejected").reason.code,
      "VOUCHER_USER_LIMIT",
    );
    assert.equal(await used(personalCode), 1);
    ok(
      "same account racing with separate carts cannot exceed its personal limit",
    );

    const duplicate = await customer();
    await cart(duplicate);
    const duplicateCode = await voucher({ per: 5 });
    const duplicatePayload = await payload(duplicate, duplicateCode.code);
    const duplicateRace = await Promise.allSettled([
      orders.createOrder(duplicate.id, duplicatePayload),
      orders.createOrder(duplicate.id, duplicatePayload),
    ]);
    assert.equal(
      duplicateRace.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(await used(duplicateCode), 1);
    ok("duplicate checkout requests cannot buy the same cart twice");

    const rollbackUser = await customer();
    await cart(rollbackUser);
    const rollbackCode = await voucher();
    const rollbackPayload = await payload(rollbackUser, rollbackCode.code);
    const stockBefore = await stock(books[0]);
    Shipment.addHook("beforeCreate", "voucher-failure", () => {
      throw new Error("INJECTED_SHIPMENT_FAILURE");
    });
    try {
      await assert.rejects(
        orders.createOrder(rollbackUser.id, rollbackPayload),
        /INJECTED_SHIPMENT_FAILURE/,
      );
    } finally {
      Shipment.removeHook("beforeCreate", "voucher-failure");
    }
    assert.equal(await used(rollbackCode), 0);
    assert.equal(await stock(books[0]), stockBefore);
    assert.equal(await Order.count({ where: { user_id: rollbackUser.id } }), 0);
    assert.equal(
      await CartItem.count({ where: { user_id: rollbackUser.id } }),
      1,
    );
    const rollbackOrder = await orders.createOrder(
      rollbackUser.id,
      rollbackPayload,
    );
    Shipment.addHook("beforeBulkUpdate", "cancel-failure", () => {
      throw new Error("INJECTED_CANCEL_FAILURE");
    });
    try {
      await assert.rejects(
        orders.cancelOrderByCustomer(rollbackUser.id, rollbackOrder.order_id),
        /INJECTED_CANCEL_FAILURE/,
      );
    } finally {
      Shipment.removeHook("beforeBulkUpdate", "cancel-failure");
    }
    assert.equal(await used(rollbackCode), 1);
    assert.equal(await stock(books[0]), stockBefore - 1);
    assert.equal(
      (await Order.findByPk(rollbackOrder.order_id)).order_status,
      "processing",
    );
    ok(
      "failures after consumption and restoration roll back order, cart, stock and uses",
    );

    const validationUser = await customer();
    await cart(validationUser);
    for (const [changes, code] of [
      [{ status: "disabled" }, "VOUCHER_DISABLED"],
      [{ status: "expired" }, "VOUCHER_EXPIRED"],
      [{ usage_limit: 0 }, "VOUCHER_EXHAUSTED"],
      [
        {
          start_date: new Date(Date.now() + 7200000),
          end_date: new Date(Date.now() + 10800000),
        },
        "VOUCHER_NOT_STARTED",
      ],
      [{ min_order_value: 200000 }, "VOUCHER_MIN_ORDER"],
    ]) {
      const v = await voucher();
      // Wall-clock timestamps are updated explicitly for schedule fixtures.
      if (changes.start_date)
        await db.query(
          "UPDATE voucher SET start_date = (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '2 hours', end_date = (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '3 hours' WHERE voucher_id = :id",
          { replacements: { id: v.voucher_id } },
        );
      else
        await Voucher.update(changes, { where: { voucher_id: v.voucher_id } });
      await rejectCode(
        orders.preview(validationUser.id, {
          book_ids: [books[0].book_id],
          voucher_code: v.code,
        }),
        code,
      );
    }
    await rejectCode(
      orders.preview(validationUser.id, {
        book_ids: [books[0].book_id],
        voucher_code: "NO_SUCH_CODE",
      }),
      "VOUCHER_NOT_FOUND",
    );
    ok(
      "preview rejects disabled, expired, future, exhausted and below-minimum codes",
    );

    const changed = await voucher();
    const stale = await payload(validationUser, changed.code);
    await Voucher.update(
      { discount_value: 20 },
      { where: { voucher_id: changed.voucher_id } },
    );
    await rejectCode(
      orders.createOrder(validationUser.id, stale),
      "CHECKOUT_CHANGED",
    );
    await Voucher.update(
      { status: "disabled" },
      { where: { voucher_id: changed.voucher_id } },
    );
    await rejectCode(
      orders.createOrder(validationUser.id, stale),
      "VOUCHER_DISABLED",
    );
    assert.equal(await used(changed), 0);
    const noCode = await payload(validationUser, null);
    await CartItem.update(
      { quantity: 2 },
      { where: { user_id: validationUser.id } },
    );
    await rejectCode(
      orders.createOrder(validationUser.id, noCode),
      "CHECKOUT_CHANGED",
    );
    const plainOrder = await orders.createOrder(
      validationUser.id,
      await payload(validationUser, null),
    );
    assert.equal(plainOrder.voucher_id, null);
    assert.equal(plainOrder.voucher_discount_amount, 0);
    ok(
      "stale quotes, disabled-after-preview and cart quantity changes require reconfirmation; plain checkout works",
    );

    const thresholdUser = await customer();
    await cart(thresholdUser, books[1], 4);
    const fixed = await voucher({
      type: "fixed_amount",
      value: 50000,
      min: 100000,
    });
    const thresholdQuote = await orders.preview(thresholdUser.id, {
      book_ids: [books[1].book_id],
      voucher_code: fixed.code,
    });
    assert.equal(thresholdQuote.subtotal, 320000);
    assert.equal(thresholdQuote.shipping_fee, 0);
    assert.equal(thresholdQuote.total_amount, 270000);
    ok(
      "shipping threshold uses pre-voucher subtotal and fixed discounts do not reduce shipping",
    );

    const repeatUser = await customer();
    const repeatCode = await voucher({ per: 2, limit: null });
    for (let i = 0; i < 2; i++) {
      await cart(repeatUser);
      await orders.createOrder(
        repeatUser.id,
        await payload(repeatUser, repeatCode.code),
      );
    }
    await cart(repeatUser);
    await rejectCode(
      orders.preview(repeatUser.id, {
        book_ids: [books[0].book_id],
        voucher_code: repeatCode.code,
      }),
      "VOUCHER_USER_LIMIT",
    );
    assert.equal(await used(repeatCode), 2);
    ok(
      "personal limit greater than one works independently of an unlimited total limit",
    );

    const adminRecord = await adminVouchers.save(null, {
      code: "ADMIN_PER_USER",
      discount_type: "percent",
      discount_value: 10,
      min_order_value: 100000,
      start_date: "2020-01-01T00:00:00",
      start_now: true,
      end_date: "2099-01-01T00:00:00",
      per_user_limit: 2,
    });
    assert.equal(adminRecord.per_user_limit, 2);
    await db.query(
      "INSERT INTO orders (order_code,user_id,address_id,voucher_id,subtotal,total_amount,payment_method) VALUES (:code,:user,:address,:v,100000,90000,'cod')",
      {
        replacements: {
          code: "ADMIN_HISTORY",
          user: user.id,
          address: user.address,
          v: adminRecord.voucher_id,
        },
      },
    );
    const adminBody = {
      code: adminRecord.code,
      discount_type: adminRecord.discount_type,
      discount_value: adminRecord.discount_value,
      min_order_value: adminRecord.min_order_value,
      start_date: adminRecord.start_date,
      end_date: adminRecord.end_date,
      per_user_limit: 1,
    };
    await assert.rejects(
      adminVouchers.save(adminRecord.voucher_id, adminBody),
      (e) => !!e.fieldErrors?.per_user_limit,
    );
    assert.equal(
      (
        await adminVouchers.save(adminRecord.voucher_id, {
          ...adminBody,
          per_user_limit: 3,
        })
      ).per_user_limit,
      3,
    );
    ok(
      "admin accepts configurable personal limit and protects history from limit reductions",
    );

    const app = require("../src/app");
    const jwt = require("jsonwebtoken");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/orders`;
    const token = (role) =>
      jwt.sign(
        { user_id: thresholdUser.id, role },
        process.env.JWT_SECRET || "fallback_secret_key",
      );
    const request = (role, body) =>
      fetch(base + "/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(role ? { Authorization: "Bearer " + token(role) } : {}),
        },
        body: JSON.stringify(body),
      });
    const body = {
      book_ids: [books[1].book_id],
      voucher_code: fixed.code,
      user_id: user.id,
      subtotal: 1,
    };
    assert.equal((await request(null, body)).status, 401);
    assert.equal((await request("admin", body)).status, 403);
    const httpQuote = await (await request("customer", body)).json();
    assert.equal(httpQuote.subtotal, 320000);
    const invalid = await request("customer", {
      ...body,
      voucher_code: "INVALID",
    });
    assert.equal(invalid.status, 409);
    assert.ok((await invalid.json()).fieldErrors.voucher_code);
    ok(
      "preview HTTP enforces login/customer role, ignores forged totals/user id and returns field errors",
    );
    console.log(
      `Completed ${passed} integration groups in disposable database.`,
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.close();
    if (created) {
      assert.match(testName, /^voucher_checkout_test_\d+_\d+$/);
      await source.query(`DROP DATABASE "${testName}" WITH (FORCE)`);
    }
    await source.close();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
