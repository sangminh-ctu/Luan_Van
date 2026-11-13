// Integration tests copy schema only into a disposable database; no customer data is changed.
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { Sequelize } = require("sequelize");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
  quiet: true,
});
const sourceName = process.env.DB_NAME,
  testName = `membership_test_${Date.now()}_${process.pid}`;
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
    const migration = fs.readFileSync(
      path.join(__dirname, "../../database/migrations/011_membership.sql"),
      "utf8",
    );
    await db.query(migration);
    await db.query(migration);
    const {
      User,
      Address,
      Order,
      Voucher,
      Category,
      Book,
      Inventory,
      CartItem,
    } = require("../src/models/associations");
    const membership = require("../src/services/membership.service"),
      vouchers = require("../src/services/voucher.service"),
      orders = require("../src/services/order.service");
    const adminVouchers = require("../src/services/admin/voucher.service");
    const tiers = await membership.list();
    const [silver, gold, diamond] = tiers;
    assert.equal(tiers.length, 3);
    assert.equal(gold.min_spend, 1000000);
    assert.equal(diamond.min_spend, 3000000);
    ok(
      "migration seeds three tiers idempotently without restricting old vouchers",
    );
    async function customer() {
      const user = await User.create({
        full_name: "Membership test",
        email: `test-${++serial}@example.invalid`,
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
    async function history(user, subtotal, overrides = {}) {
      return Order.create({
        order_code: `HISTORY-${++serial}`,
        user_id: user.id,
        address_id: user.address,
        subtotal,
        shipping_fee: 30000,
        total_amount: subtotal + 30000,
        payment_method: "cod",
        payment_status: "paid",
        order_status: "delivered",
        order_date: new Date("2020-01-01T00:00:00Z"),
        ...overrides,
      });
    }
    async function voucher(options = {}) {
      const [rows] = await db.query(
        `INSERT INTO voucher(code,discount_type,discount_value,max_discount_amount,min_order_value,start_date,end_date,usage_limit,per_user_limit,min_tier_id)
              VALUES(:code,:type,:value,:cap,:min,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') - interval '1 day',
                (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '2 days',:limit,1,:tier) RETURNING *`,
        {
          replacements: {
            code: `V_${++serial}`,
            type: "fixed_amount",
            value: 10000,
            cap: null,
            min: 100000,
            limit: 100,
            tier: null,
            ...options,
          },
        },
      );
      return rows[0];
    }
    const newbie = await customer();
    let member = await membership.get(newbie.id);
    assert.equal(member.current_tier.tier_id, silver.tier_id);
    assert.equal(member.remaining_spend, 1000000);
    assert.equal(member.progress_percent, 0);
    const boundary = await customer();
    await history(boundary, 999999);
    assert.equal((await membership.get(boundary.id)).current_tier.level, 1);
    await history(boundary, 1);
    member = await membership.get(boundary.id);
    assert.equal(member.current_tier.level, 2);
    assert.equal(member.remaining_spend, 2000000);
    await history(boundary, 2000000);
    member = await membership.get(boundary.id);
    assert.equal(member.current_tier.level, 3);
    assert.equal(member.next_tier, null);
    assert.equal(member.progress_percent, 100);
    ok(
      "exact tier boundaries, next-tier progress, highest tier and historical orders",
    );
    const net = await customer();
    await history(net, 1200000, {
      voucher_discount_amount: 200000,
      points_discount: 10000,
    });
    for (const overrides of [
      { order_status: "processing" },
      { order_status: "shipping" },
      { order_status: "cancelled" },
      { payment_status: "pending" },
      { payment_status: "refunded" },
    ])
      await history(net, 9000000, overrides);
    member = await membership.get(net.id);
    assert.equal(member.eligible_spend, 990000);
    assert.equal(member.current_tier.level, 1);
    await User.update(
      { reward_points_balance: 9999999 },
      { where: { user_id: net.id } },
    );
    assert.equal((await membership.get(net.id)).current_tier.level, 1);
    ok(
      "spend excludes shipping, discounts, pending/unpaid/refunded/cancelled orders and reward balance",
    );

    const category = await Category.create({ category_name: "Test" });
    const book = await Book.create({
      title: "Test",
      price: 250000,
      category_id: category.category_id,
    });
    await Inventory.create({ book_id: book.book_id, stock_quantity: 100 });
    for (const user of [newbie, boundary, net])
      await CartItem.create({
        user_id: user.id,
        book_id: book.book_id,
        quantity: 1,
      });
    const publicCode = await voucher(),
      goldCode = await voucher({ tier: gold.tier_id, value: 20000 }),
      diamondCode = await voucher({ tier: diamond.tier_id, value: 30000 });
    await assert.rejects(
      orders.preview(newbie.id, {
        book_ids: [book.book_id],
        voucher_code: goldCode.code,
      }),
      (e) => e.code === "VOUCHER_TIER_REQUIRED",
    );
    const highQuote = await orders.preview(boundary.id, {
      book_ids: [book.book_id],
      voucher_code: goldCode.code,
    });
    assert.equal(highQuote.voucher_discount_amount, 20000);
    await orders.preview(newbie.id, {
      book_ids: [book.book_id],
      voucher_code: publicCode.code,
    });
    ok(
      "tier restrictions apply in preview; higher tiers inherit lower-tier codes and public codes still work",
    );
    const spoof = {
      book_ids: [book.book_id],
      address_id: newbie.address,
      payment_method: "cod",
      expected_prices: { [book.book_id]: 250000 },
      expected_quantities: { [book.book_id]: 1 },
      voucher_code: goldCode.code,
      expected_quote: {
        subtotal: 250000,
        shipping_fee: 30000,
        voucher_discount_amount: 20000,
        total_amount: 260000,
      },
      tier_id: diamond.tier_id,
      eligible_spend: 9999999,
    };
    await assert.rejects(
      orders.createOrder(newbie.id, spoof),
      (e) => e.code === "VOUCHER_TIER_REQUIRED",
    );
    assert.equal((await Inventory.findByPk(book.book_id)).stock_quantity, 100);
    ok(
      "checkout recalculates tier, ignores forged membership and rolls stock back on rejection",
    );
    const ownUpgrade = await customer();
    await history(ownUpgrade, 900000);
    await CartItem.create({
      user_id: ownUpgrade.id,
      book_id: book.book_id,
      quantity: 1,
    });
    await assert.rejects(
      orders.preview(ownUpgrade.id, {
        book_ids: [book.book_id],
        voucher_code: goldCode.code,
      }),
      (e) => e.code === "VOUCHER_TIER_REQUIRED",
    );
    const noVoucherQuote = await orders.preview(ownUpgrade.id, {
      book_ids: [book.book_id],
    });
    const placed = await orders.createOrder(ownUpgrade.id, {
      book_ids: [book.book_id],
      address_id: ownUpgrade.address,
      payment_method: "cod",
      expected_prices: noVoucherQuote.expected_prices,
    });
    assert.equal((await membership.get(ownUpgrade.id)).current_tier.level, 1);
    for (const status of ["confirmed", "shipping", "delivered"])
      await orders.updateOrderStatusByAdmin(placed.order_id, { status });
    assert.equal((await membership.get(ownUpgrade.id)).current_tier.level, 2);
    ok(
      "current order does not upgrade itself; completion immediately unlocks the next tier",
    );

    const percent = await voucher({
      type: "percent",
      value: 50,
      cap: 15000,
      code: "HIGH_PERCENT",
    });
    const fixed = await voucher({ value: 25000, code: "BEST_FIXED" });
    const locked = await voucher({
      tier: gold.tier_id,
      value: 90000,
      code: "LOCKED",
    });
    const disabled = await voucher({ value: 80000 });
    await Voucher.update(
      { status: "disabled" },
      { where: { voucher_id: disabled.voucher_id } },
    );
    const expired = await voucher({ value: 70000 });
    await db.query(
      "UPDATE voucher SET end_date=(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')-interval '1 hour' WHERE voucher_id=:id",
      { replacements: { id: expired.voucher_id } },
    );
    const exhausted = await voucher({ value: 60000, limit: 1 });
    await Voucher.update(
      { used_count: 1 },
      { where: { voucher_id: exhausted.voucher_id } },
    );
    const personal = await voucher({ value: 50000 });
    await history(newbie, 100000, {
      voucher_id: personal.voucher_id,
      order_status: "processing",
      payment_status: "pending",
    });
    const belowMin = await voucher({ value: 40000, min: 500000 });
    let result = await orders.voucherSuggestions(newbie.id, {
      book_ids: [book.book_id],
      subtotal: 99999999,
      user_id: boundary.id,
    });
    assert.equal(result.subtotal, 250000);
    assert.equal(result.suggestions[0].code, fixed.code);
    assert.equal(result.suggestions[0].voucher_discount_amount, 25000);
    assert.ok(result.suggestions.find((v) => v.code === percent.code));
    const excluded = [
      locked,
      disabled,
      expired,
      exhausted,
      personal,
      belowMin,
    ].map((v) => v.code);
    assert.ok(result.suggestions.every((v) => !excluded.includes(v.code)));
    assert.ok(result.suggestions.length <= 3);
    assert.equal((await Voucher.findByPk(fixed.voucher_id)).used_count, 0);
    ok(
      "suggestions compare actual discounts/caps and exclude tier, minimum, personal and total failures without consuming uses",
    );
    const tieA = await voucher({ value: 35000, code: "TIE_A" }),
      tieB = await voucher({ value: 35000, code: "TIE_B" });
    await db.query(
      "UPDATE voucher SET end_date='2099-01-01' WHERE voucher_id IN (:ids)",
      { replacements: { ids: [tieA.voucher_id, tieB.voucher_id] } },
    );
    result = await orders.voucherSuggestions(newbie.id, {
      book_ids: [book.book_id],
    });
    assert.deepEqual(
      result.suggestions.slice(0, 2).map((v) => v.code),
      ["TIE_A", "TIE_B"],
    );
    await db.query(
      "UPDATE voucher SET end_date='2098-01-01' WHERE voucher_id=:id",
      { replacements: { id: tieB.voucher_id } },
    );
    assert.equal(
      (await orders.voucherSuggestions(newbie.id, { book_ids: [book.book_id] }))
        .suggestions[0].code,
      "TIE_B",
    );
    ok("equal savings have deterministic expiry/code ordering");

    const offers = await vouchers.customerOffers(newbie.id);
    assert.ok(
      offers.vouchers.some((v) => v.code === goldCode.code && !v.eligible),
    );
    assert.ok(!offers.vouchers.find((v) => v.code === personal.code));
    assert.equal(
      offers.available_count,
      offers.vouchers.filter((v) => v.eligible).length,
    );
    ok(
      "account wallet labels locked codes and excludes used-up codes from available count",
    );
    const adminBody = {
      code: "ADMIN_TIER",
      discount_type: "percent",
      discount_value: 10,
      min_order_value: 100000,
      start_date: "2020-01-01T00:00:00",
      end_date: "2099-01-01T00:00:00",
      start_now: true,
      min_tier_id: gold.tier_id,
    };
    const adminCode = await adminVouchers.save(null, adminBody);
    assert.equal(adminCode.min_tier_name, "Vàng");
    await history(newbie, 100000, { voucher_id: adminCode.voucher_id });
    await assert.rejects(
      adminVouchers.save(adminCode.voucher_id, {
        ...adminBody,
        start_now: false,
        start_date: adminCode.start_date,
        min_tier_id: null,
      }),
      (e) => e.status === 409,
    );
    await assert.rejects(
      adminVouchers.save(null, {
        ...adminBody,
        code: "BAD_TIER",
        min_tier_id: 999999,
      }),
      (e) => !!e.fieldErrors?.min_tier_id,
    );
    ok("admin validates minimum tier and freezes it after usage history");
    const saveTiers = (goldSpend, diamondSpend) =>
      membership.save({
        tiers: tiers.map((t) => ({
          tier_id: t.tier_id,
          min_spend:
            t.level === 1 ? 0 : t.level === 2 ? goldSpend : diamondSpend,
        })),
      });
    for (const [g, d] of [
      [0, 3000000],
      [3000000, 2000000],
      [-1, 3000000],
      [1.5, 3000000],
      [true, 3000000],
    ])
      await assert.rejects(saveTiers(g, d), (e) => e.status === 400);
    await saveTiers(3000000, 4000000);
    assert.equal((await membership.get(ownUpgrade.id)).current_tier.level, 1);
    await saveTiers(500000, 1000000);
    assert.equal((await membership.get(ownUpgrade.id)).current_tier.level, 3);
    await saveTiers(1000000, 3000000);
    ok(
      "atomic threshold edits validate ascending integers, avoid uniqueness collisions and recalculate ranks",
    );
    // Recreate the cart consumed above to test a formerly eligible quote after a config change.
    await CartItem.upsert({
      user_id: ownUpgrade.id,
      book_id: book.book_id,
      quantity: 1,
    });
    const before = await orders.preview(ownUpgrade.id, {
      book_ids: [book.book_id],
      voucher_code: goldCode.code,
    });
    await saveTiers(2000000, 4000000);
    await assert.rejects(
      orders.createOrder(ownUpgrade.id, {
        ...spoof,
        address_id: ownUpgrade.address,
        expected_prices: before.expected_prices,
      }),
      (e) => e.code === "VOUCHER_TIER_REQUIRED",
    );
    await saveTiers(1000000, 3000000);
    ok(
      "checkout rejects a formerly eligible code after admin raises thresholds",
    );

    const app = require("../src/app"),
      jwt = require("jsonwebtoken");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = (url, role = "customer", method = "GET", body) =>
      fetch(base + url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(role
            ? {
                Authorization:
                  "Bearer " +
                  jwt.sign(
                    { user_id: newbie.id, role },
                    process.env.JWT_SECRET || "fallback_secret_key",
                  ),
              }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    assert.equal((await request("/membership", null)).status, 401);
    assert.equal((await request("/admin/membership-tiers")).status, 403);
    assert.equal(
      (await request("/admin/membership-tiers", "admin")).status,
      200,
    );
    assert.equal(
      (
        await request("/admin/membership-tiers", "customer", "PUT", {
          tiers: [],
        })
      ).status,
      403,
    );
    const me = await (await request("/auth/me")).json();
    assert.ok(me.membership);
    assert.equal(
      me.available_voucher_count,
      me.vouchers.filter((v) => v.eligible).length,
    );
    assert.equal(me.tiers.length, 3);
    const suggestions = await request(
      "/orders/voucher-suggestions",
      "customer",
      "POST",
      { book_ids: [book.book_id], user_id: boundary.id },
    );
    assert.equal(suggestions.status, 200);
    const noAccess = await request(
      "/orders/voucher-suggestions",
      "admin",
      "POST",
      { book_ids: [book.book_id] },
    );
    assert.equal(noAccess.status, 403);
    ok(
      "HTTP authorization, account membership response and customer suggestion endpoint",
    );
    console.log(`Completed ${passed} membership integration groups.`);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.close();
    if (created) {
      assert.match(testName, /^membership_test_\d+_\d+$/);
      await source.query(`DROP DATABASE "${testName}" WITH (FORCE)`);
    }
    await source.close();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
