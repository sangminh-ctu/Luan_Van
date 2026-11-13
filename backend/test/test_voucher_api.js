// Run from backend: node test/test_voucher_api.js
// Uses an isolated PostgreSQL schema; never inserts into the application's tables.
const assert = require("node:assert/strict");
const { Sequelize } = require("sequelize");
const jwt = require("jsonwebtoken");
const config = require("../src/config/database");
const original = config.sequelize;
const schema = `voucher_test_${process.pid}_${Date.now()}`;
const db = new Sequelize(
  original.config.database,
  original.config.username,
  original.config.password,
  {
    host: original.config.host,
    port: original.config.port,
    dialect: "postgres",
    logging: false,
    dialectOptions: { options: `-c search_path=${schema}` },
  },
);
config.sequelize = db;
const service = require("../src/services/admin/voucher.service");
const app = require("../src/app");
let passed = 0,
  server;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
const futureStart = new Date(Date.now() + 8 * 3600000)
  .toISOString()
  .slice(0, 19);
const fixture = (overrides = {}) => ({
  code: "BOOK10",
  discount_type: "percent",
  discount_value: 10,
  max_discount_amount: 50000,
  min_order_value: 100000,
  start_date: futureStart,
  end_date: "2099-01-01T00:00:00",
  usage_limit: 10,
  status: "active",
  ...overrides,
});
async function run() {
  try {
    const [columns] = await original.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'voucher'",
    );
    const expected = [
      "voucher_id",
      "code",
      "discount_type",
      "discount_value",
      "max_discount_amount",
      "min_order_value",
      "start_date",
      "end_date",
      "usage_limit",
      "per_user_limit",
      "min_tier_id",
      "used_count",
      "status",
    ];
    assert.deepEqual(columns.map((c) => c.column_name).sort(), expected.sort());
    console.log(
      "PASS Application voucher schema matches expected columns (read only)",
    );
    await original.query(`CREATE SCHEMA ${schema}`);
    await db.query(`CREATE TABLE voucher (
            voucher_id serial PRIMARY KEY, code varchar(50) NOT NULL UNIQUE,
            discount_type varchar(20) NOT NULL CHECK (discount_type IN ('percent', 'fixed_amount')),
            discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0), max_discount_amount numeric(12,2),
            min_order_value numeric(12,2) NOT NULL DEFAULT 0,
            start_date timestamp NOT NULL, end_date timestamp NOT NULL CHECK (end_date > start_date),
            usage_limit integer, used_count integer NOT NULL DEFAULT 0, per_user_limit integer NOT NULL DEFAULT 1 CHECK (per_user_limit >= 1),
            status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','disabled'))
        ); CREATE TABLE orders (order_id serial PRIMARY KEY, voucher_id integer REFERENCES voucher(voucher_id) ON DELETE SET NULL ON UPDATE CASCADE,
          user_id integer, order_status varchar(30), payment_status varchar(30), subtotal numeric(14,2), voucher_discount_amount numeric(12,2) DEFAULT 0, points_discount numeric(12,2) DEFAULT 0)`);
    await db.query(require('fs').readFileSync(require('path').join(__dirname, '../../database/migrations/011_membership.sql'), 'utf8'));
    await check("Reject invalid values and forged usage count", async () => {
      for (const invalid of [
        { discount_value: 101 },
        { discount_value: 0 },
        { discount_value: true },
        { discount_value: "1.123" },
        { max_discount_amount: 0 },
        { max_discount_amount: 5000000000 },
        {
          discount_type: "fixed_amount",
          discount_value: 5000000000,
          max_discount_amount: null,
        },
        {
          discount_type: "fixed_amount",
          discount_value: 100001,
          max_discount_amount: null,
        },
        { start_now: "true" },
        { min_order_value: -1 },
        { usage_limit: 0 },
        { usage_limit: 1.5 },
        { usage_limit: true },
        { per_user_limit: 0 },
        { per_user_limit: null },
        { per_user_limit: true },
        { per_user_limit: 1.5 },
        { used_count: 4 },
        { code: "BAD CODE" },
        { start_date: "2026-02-30T10:00:00" },
        { end_date: "2019-01-01T00:00:00" },
        { status: "other" },
        { discount_type: "other" },
      ]) {
        assert.throws(
          () => service.validate(fixture(invalid)),
          (e) => e.status === 400,
        );
      }
    });
    await check(
      "Reject backdated creation and changes, preserve existing start on edits",
      async () => {
        await assert.rejects(
          service.save(
            null,
            fixture({ code: "BACKDATED", start_date: "2020-01-01T00:00:00" }),
          ),
          (e) => e.status === 400,
        );
        await assert.rejects(
          service.save(
            null,
            fixture({
              code: "PASTEND",
              start_date: "2020-01-01T00:00:00",
              end_date: "2021-01-01T00:00:00",
              start_now: true,
            }),
          ),
          (e) => e.status === 400,
        );
        const active = await service.save(
          null,
          fixture({ code: "IMMEDIATE", start_now: true }),
        );
        assert.equal(active.effective_status, "active");
        await assert.rejects(
          service.save(
            active.voucher_id,
            fixture({ code: "IMMEDIATE", start_date: "2020-01-01T00:00:00" }),
          ),
          (e) => e.status === 400,
        );
        await service.save(
          active.voucher_id,
          fixture({
            code: "IMMEDIATE",
            start_date: active.start_date,
            end_date: "2099-02-01T00:00:00",
          }),
        );
        assert.equal(
          (
            await service.changeStatus(active.voucher_id, {
              status: "disabled",
            })
          ).effective_status,
          "disabled",
        );
        const boundary = await service.save(
          null,
          fixture({
            code: "BOUNDARY",
            discount_type: "fixed_amount",
            discount_value: 100000,
            max_discount_amount: null,
          }),
        );
        assert.equal(boundary.discount_value, 100000);
        await service.save(
          null,
          fixture({ code: "CAPBOUNDARY", max_discount_amount: 100000 }),
        );
        await assert.rejects(
          service.save(
            boundary.voucher_id,
            fixture({
              code: "BOUNDARY",
              discount_type: "fixed_amount",
              discount_value: 5000000000,
              max_discount_amount: null,
            }),
          ),
          (e) => e.status === 400,
        );
      },
    );
    let row;
    await check(
      "Create, normalize code, preserve Vietnam wall-clock dates",
      async () => {
        row = await service.save(
          null,
          fixture({ code: " book10 ", start_now: true }),
        );
        assert.equal(row.code, "BOOK10");
        assert.equal(row.used_count, 0);
        assert.match(row.start_date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        assert.ok(
          Math.abs(Date.now() - new Date(row.start_date + "+07:00").getTime()) <
            5000,
        );
        assert.equal(row.effective_status, "active");
      },
    );
    await check(
      "Reject duplicate codes including concurrent requests and legacy lowercase",
      async () => {
        await assert.rejects(
          service.save(null, fixture({ code: "book10" })),
          (e) => e.status === 409,
        );
        const results = await Promise.allSettled([
          service.save(null, fixture({ code: "RACE" })),
          service.save(null, fixture({ code: "race" })),
        ]);
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          results.find((r) => r.status === "rejected").reason.status,
          409,
        );
        await db.query(
          "INSERT INTO voucher (code, discount_type, discount_value, start_date, end_date) VALUES ('legacy', 'percent', 10, '2020-01-01', '2099-01-01')",
        );
        await assert.rejects(
          service.save(null, fixture({ code: "LEGACY" })),
          (e) => e.status === 409,
        );
      },
    );
    await check(
      "Update, fixed amount, optional limits and status actions",
      async () => {
        const updated = await service.save(
          row.voucher_id,
          fixture({
            discount_type: "fixed_amount",
            start_date: row.start_date,
            discount_value: 20000,
            max_discount_amount: null,
            usage_limit: null,
          }),
        );
        assert.equal(updated.discount_value, 20000);
        assert.equal(updated.remaining_uses, null);
        assert.equal(
          (await service.changeStatus(row.voucher_id, { status: "disabled" }))
            .effective_status,
          "disabled",
        );
        assert.equal(
          (await service.changeStatus(row.voucher_id, { status: "active" }))
            .effective_status,
          "active",
        );
      },
    );
    await check(
      "Derived statuses, filter, search, statistics and pagination",
      async () => {
        await service.save(
          null,
          fixture({ code: "FUTURE", start_date: "2098-01-01T00:00:00" }),
        );
        await service.save(null, fixture({ code: "PAST" }));
        await db.query(
          "UPDATE voucher SET start_date = '2020-01-01', end_date = '2021-01-01' WHERE code = 'PAST'",
        );
        await service.save(null, fixture({ code: "EXHAUSTED" }));
        await db.query(
          "UPDATE voucher SET used_count = usage_limit WHERE code = 'EXHAUSTED'",
        );
        for (const status of ["active", "scheduled", "expired", "exhausted"]) {
          const result = await service.list({ status, limit: 1 });
          assert.ok(result.vouchers.length);
          assert.equal(result.vouchers[0].effective_status, status);
        }
        const result = await service.list({
          search: "book",
          discount_type: "fixed_amount",
          limit: 1,
        });
        assert.equal(result.pagination.total, 1);
        assert.equal(result.vouchers[0].code, "BOOK10");
        assert.ok(result.stats.total >= 6);
        assert.equal((await service.list({ search: "%" })).pagination.total, 0);
        assert.equal(
          (await service.list({ limit: 1, page: 2 })).pagination.page,
          2,
        );
        await assert.rejects(
          service.list({ status: "wrong" }),
          (e) => e.status === 400,
        );
      },
    );
    await check(
      "History protects edits/deletion, permits extension and higher limits",
      async () => {
        const used = await service.save(null, fixture({ code: "USED" }));
        await db.query(
          "UPDATE voucher SET used_count = 2 WHERE voucher_id = :id",
          { replacements: { id: used.voucher_id } },
        );
        await assert.rejects(
          service.save(
            used.voucher_id,
            fixture({ code: "USED", discount_value: 20 }),
          ),
          (e) => e.status === 409,
        );
        await assert.rejects(
          service.save(
            used.voucher_id,
            fixture({ code: "USED", usage_limit: 1 }),
          ),
          (e) => e.status === 409 || e.status === 400,
        );
        await assert.rejects(
          service.remove(used.voucher_id),
          (e) => e.status === 409,
        );
        const extended = await service.save(
          used.voucher_id,
          fixture({
            code: "USED",
            usage_limit: 20,
            end_date: "2099-02-01T00:00:00",
          }),
        );
        assert.equal(extended.used_count, 2);
        assert.equal(extended.usage_limit, 20);
        const referenced = await service.save(
          null,
          fixture({ code: "REFERENCED" }),
        );
        await db.query("INSERT INTO orders (voucher_id) VALUES (:id)", {
          replacements: { id: referenced.voucher_id },
        });
        assert.equal(
          (await service.detail(referenced.voucher_id)).has_history,
          true,
        );
        await assert.rejects(
          service.remove(referenced.voucher_id),
          (e) => e.status === 409,
        );
        await assert.rejects(
          service.save(referenced.voucher_id, fixture({ code: "RENAMED" })),
          (e) => e.status === 409,
        );
      },
    );
    await check(
      "Delete unused code and reject invalid/missing IDs",
      async () => {
        await service.remove(row.voucher_id);
        await assert.rejects(
          service.detail(row.voucher_id),
          (e) => e.status === 404,
        );
        await assert.rejects(service.detail("1x"), (e) => e.status === 400);
      },
    );
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/admin/vouchers`;
    const token = (role) =>
      jwt.sign(
        { user_id: 1, role },
        process.env.JWT_SECRET || "fallback_secret_key",
      );
    const request = (url = "", method = "GET", body, role = "admin") =>
      fetch(base + url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(role ? { Authorization: `Bearer ${token(role)}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    await check(
      "All admin endpoints enforce authentication and role",
      async () => {
        for (const [path, method, body] of [
          ["", "GET"],
          ["/1", "GET"],
          ["", "POST", fixture()],
          ["/1", "PUT", fixture()],
          ["/1/status", "PATCH", { status: "disabled" }],
          ["/1", "DELETE"],
        ]) {
          assert.equal((await request(path, method, body, null)).status, 401);
          assert.equal(
            (await request(path, method, body, "customer")).status,
            403,
          );
        }
      },
    );
    await check(
      "HTTP admin CRUD, validation and conflict responses",
      async () => {
        let response = await request("", "POST", fixture({ code: "HTTP" }));
        assert.equal(response.status, 201);
        const created = await response.json();
        const duplicate = await request("", "POST", fixture({ code: "http" }));
        assert.equal(duplicate.status, 409);
        assert.match((await duplicate.json()).fieldErrors.code, /HTTP/);
        for (const invalid of [
          { max_discount_amount: 5000000000 },
          {
            discount_type: "fixed_amount",
            discount_value: 5000000000,
            max_discount_amount: null,
          },
          { start_date: "2020-01-01T00:00:00" },
        ]) {
          const invalidResponse = await request(
            "",
            "POST",
            fixture({ code: "FIELD_ERROR", ...invalid }),
          );
          assert.equal(invalidResponse.status, 400);
          const field = Object.keys(invalid).find(
            (key) => key !== "discount_type",
          );
          assert.ok((await invalidResponse.json()).fieldErrors[field]);
          assert.equal(
            (
              await request(
                "",
                "POST",
                fixture({ code: "INVALID_HTTP", ...invalid }),
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await request(
                "/" + created.voucher_id,
                "PUT",
                fixture({ code: "HTTP", ...invalid }),
              )
            ).status,
            400,
          );
        }
        assert.equal((await request()).status, 200);
        assert.equal((await request("/" + created.voucher_id)).status, 200);
        assert.equal(
          (
            await request(
              "/" + created.voucher_id,
              "PUT",
              fixture({ code: "HTTP", discount_value: 15 }),
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request("/" + created.voucher_id + "/status", "PATCH", {
              status: "disabled",
            })
          ).status,
          200,
        );
        assert.equal(
          (await request("", "POST", fixture({ code: "http" }))).status,
          409,
        );
        assert.equal(
          (await request("", "POST", fixture({ discount_value: 101 }))).status,
          400,
        );
        assert.equal(
          (await request("/" + created.voucher_id, "DELETE")).status,
          200,
        );
        assert.equal((await request("/" + created.voucher_id)).status, 404);
      },
    );
    console.log(`Completed ${passed} test groups; application data unchanged.`);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await db.close();
    await original.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await original.close();
  }
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
