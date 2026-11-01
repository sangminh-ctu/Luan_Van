// Integration tests use a disposable database. No customer data is copied or modified.
// Requires a PostgreSQL role with CREATEDB and a matching pg_dump executable.
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
  quiet: true,
});
const fs = require("fs"),
  assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { Sequelize } = require("sequelize");
const sourceName = process.env.DB_NAME;
const testName = "flash_sale_test_" + Date.now() + "_" + process.pid;
const admin = new Sequelize(
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
function ok(name) {
  passed++;
  console.log("PASS " + name);
}
async function rejects(fn, predicate) {
  await assert.rejects(fn, predicate);
}
async function run() {
  const pgDump =
    process.env.PG_DUMP_PATH ||
    (process.platform === "win32"
      ? "C:/Program Files/PostgreSQL/18/bin/pg_dump.exe"
      : "pg_dump");
  const schema = execFileSync(
    pgDump,
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
    .filter((line) => !line.trimStart().startsWith(String.fromCharCode(92)))
    .join("\n")
    .replace("CREATE SCHEMA public;", "CREATE SCHEMA IF NOT EXISTS public;");
  await admin.query('CREATE DATABASE "' + testName + '"');
  created = true;
  process.env.DB_NAME = testName;
  db = require("../src/config/database").sequelize;
  await db.query(schema);
  await db.query("SET search_path TO public");
  const [tables] = await db.query(
    "SELECT to_regclass('public.flash_sale') AS sale",
  );
  if (!tables[0].sale)
    await db.query(
      fs.readFileSync(
        path.join(__dirname, "../../database/migrations/007_flash_sale.sql"),
        "utf8",
      ),
    );
  const models = require("../src/models/associations");
  const {
    Book,
    Category,
    Inventory,
    User,
    Address,
    CartItem,
    Order,
    OrderItem,
    FlashSale,
    FlashSaleItem,
  } = models;
  const service = require("../src/services/flash-sale.service");
  const pricing = require("../src/services/pricing.service");
  const catalog = require("../src/services/customer/catalog.service");
  const cart = require("../src/services/customer/cart.service");
  const orders = require("../src/services/order.service");
  const category = await Category.create({ category_name: "Flash test" });
  const book = await Book.create({
    title: "Flash test book",
    price: 100000,
    discount_percent: 10,
    category_id: category.category_id,
    is_active: true,
  });
  const second = await Book.create({
    title: "Second test book",
    price: 80000,
    discount_percent: 0,
    category_id: category.category_id,
    is_active: true,
  });
  await Inventory.bulkCreate([
    { book_id: book.book_id, stock_quantity: 20 },
    { book_id: second.book_id, stock_quantity: 20 },
  ]);
  const user = await User.create({
    full_name: "Test customer",
    email: "flash-test@example.invalid",
    password: "unused-test-hash",
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
  await db.transaction(async (transaction) => {
    const [started] = await db.query("SELECT now() AS started", {
      transaction,
    });
    await db.query("SELECT pg_sleep(0.03)", { transaction });
    assert.ok(+(await pricing.now(transaction)) > +started[0].started);
  });
  ok("pricing clock advances after transaction start");
  const instant = +(await pricing.now());
  const payload = (name, start, end) => ({
    name,
    start_at: new Date(start).toISOString(),
    end_at: new Date(end).toISOString(),
    items: [{ book_id: book.book_id, sale_price: 70000 }],
  });
  const upcoming = await service.save(
    null,
    payload("Upcoming", instant + 3600000, instant + 7200000),
    null,
  );
  assert.equal(upcoming.display_status, "draft");
  await service.action(upcoming.flash_sale_id, "publish");
  assert.equal(
    (await service.detail(upcoming.flash_sale_id)).display_status,
    "upcoming",
  );
  ok("draft and publish upcoming");
  let prices = await pricing.getEffectivePrices([book.book_id], {
    at: new Date(instant + 3600000),
  });
  assert.equal(prices.get(book.book_id).effective_price, 70000);
  prices = await pricing.getEffectivePrices([book.book_id], {
    at: new Date(instant + 7200000),
  });
  assert.equal(prices.get(book.book_id).effective_price, 90000);
  ok("inclusive start and exclusive end boundaries");
  const collision = await service.save(
    null,
    payload("Collision", instant + 3600001, instant + 7200001),
    null,
  );
  await rejects(
    () => service.action(collision.flash_sale_id, "publish"),
    (e) => e.original?.code === "23P01",
  );
  ok("database rejects published overlap");
  const adjacent = await service.save(
    null,
    payload("Adjacent", instant + 7200000, instant + 10800000),
    null,
  );
  await service.action(adjacent.flash_sale_id, "publish");
  ok("adjacent schedules allowed");
  const races = await Promise.all([
    service.save(
      null,
      payload("Race A", instant + 14400000, instant + 18000000),
      null,
    ),
    service.save(
      null,
      payload("Race B", instant + 14400000, instant + 18000000),
      null,
    ),
  ]);
  const raceResults = await Promise.allSettled(
    races.map((s) => service.action(s.flash_sale_id, "publish")),
  );
  assert.equal(raceResults.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    raceResults.find((r) => r.status === "rejected").reason.original.code,
    "23P01",
  );
  ok("concurrent publish has exactly one winner");
  await service.action(upcoming.flash_sale_id, "cancel");
  await service.action(adjacent.flash_sale_id, "cancel");
  for (const s of races) {
    if ((await service.detail(s.flash_sale_id)).status === "published")
      await service.action(s.flash_sale_id, "cancel");
  }
  const active = await service.save(
    null,
    payload("Active", instant - 3600000, instant + 3600000),
    null,
  );
  await service.action(active.flash_sale_id, "publish");
  await rejects(
    () =>
      service.save(
        active.flash_sale_id,
        payload("Illegal edit", instant - 3600000, instant + 3600000),
      ),
    (e) => e.status === 409,
  );
  await rejects(
    () => service.action(active.flash_sale_id, "delete"),
    (e) => e.status === 409,
  );
  ok("active programs cannot be edited or deleted");
  const price = await pricing.getEffectivePrices([book.book_id]);
  assert.equal(price.get(book.book_id).regular_price, 90000);
  assert.equal(price.get(book.book_id).effective_price, 70000);
  const list = await catalog.getBooks({
    sort: "price_asc",
    limit: 10,
    max_price: 75000,
  });
  assert.deepEqual(
    list.books.map((b) => b.book_id),
    [book.book_id],
  );
  assert.equal(list.books[0].final_price, 70000);
  assert.equal(
    (await catalog.getBookById(book.book_id)).effective_price,
    70000,
  );
  assert.equal(
    (await catalog.getRelatedBooks(second.book_id, category.category_id, 5))[0]
      .effective_price,
    70000,
  );
  ok(
    "catalog detail, related books, filtering and sorting use effective prices",
  );
  await CartItem.create({
    user_id: user.user_id,
    book_id: book.book_id,
    quantity: 2,
  });
  assert.equal(
    (await cart.getCart(user.user_id)).items[0].book.effective_price,
    70000,
  );
  await rejects(
    () =>
      orders.createOrder(user.user_id, {
        book_ids: [book.book_id],
        address_id: address.address_id,
        payment_method: "cod",
      }),
    (e) => e.status === 400,
  );
  ok("checkout requires prices explicitly confirmed by the client");
  const orderPayload = {
    book_ids: [book.book_id],
    address_id: address.address_id,
    payment_method: "cod",
    expected_prices: { [book.book_id]: 90000 },
  };
  await rejects(
    () => orders.createOrder(user.user_id, orderPayload),
    (e) => e.code === "PRICE_CHANGED",
  );
  assert.equal(
    (await Inventory.findOne({ where: { book_id: book.book_id } }))
      .stock_quantity,
    20,
  );
  assert.equal(await Order.count(), 0);
  ok("price conflict rolls back stock and does not create order");
  const order = await orders.createOrder(user.user_id, {
    ...orderPayload,
    expected_prices: { [book.book_id]: 70000 },
  });
  assert.equal(order.items[0].unit_price_at_purchase, 70000);
  assert.ok(order.items[0].flash_sale_item_id);
  assert.equal(
    (await service.current()).books.find((b) => b.book_id === book.book_id)
      .placed_count,
    2,
  );
  ok("checkout stores flash reference and placed quantity");
  await orders.cancelOrderByCustomer(user.user_id, order.order_id);
  assert.equal(
    (await service.current()).books.find((b) => b.book_id === book.book_id)
      .placed_count,
    0,
  );
  ok("cancelled orders excluded from placed count");
  await Book.update(
    { discount_percent: 40 },
    { where: { book_id: book.book_id } },
  );
  const lowered = (await pricing.getEffectivePrices([book.book_id])).get(
    book.book_id,
  );
  assert.equal(lowered.effective_price, 60000);
  assert.equal(lowered.flash_sale_item_id, null);
  ok("regular price wins without flash attribution when it is cheaper");
  await Book.update(
    { discount_percent: 10 },
    { where: { book_id: book.book_id } },
  );
  await CartItem.create({
    user_id: user.user_id,
    book_id: book.book_id,
    quantity: 1,
  });
  await service.action(active.flash_sale_id, "end");
  assert.equal(
    (await service.detail(active.flash_sale_id)).display_status,
    "ended",
  );
  assert.equal(
    (await pricing.getEffectivePrices([book.book_id])).get(book.book_id)
      .effective_price,
    90000,
  );
  await rejects(
    () =>
      orders.createOrder(user.user_id, {
        ...orderPayload,
        expected_prices: { [book.book_id]: 70000 },
      }),
    (e) => e.code === "PRICE_CHANGED",
  );
  ok("early end restores regular price and rejects stale checkout");
  await rejects(
    () => FlashSale.destroy({ where: { flash_sale_id: active.flash_sale_id } }),
    (e) => ["23503", "23001"].includes(e.original?.code),
  );
  ok("order references protect flash-sale history");
  const latest = await service.save(
    null,
    payload("API schedule", instant + 21600000, instant + 25200000),
    null,
  );
  await service.action(latest.flash_sale_id, "publish");
  const app = require("../src/app");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const jwt = require("jsonwebtoken");
  const token = jwt.sign(
    { user_id: user.user_id, role: "admin" },
    process.env.JWT_SECRET || "fallback_secret_key",
  );
  assert.equal((await fetch(base + "/api/admin/flash-sales")).status, 401);
  const customerToken = jwt.sign(
    { user_id: user.user_id, role: "customer" },
    process.env.JWT_SECRET || "fallback_secret_key",
  );
  assert.equal(
    (
      await fetch(base + "/api/admin/flash-sales", {
        headers: { Authorization: "Bearer " + customerToken },
      })
    ).status,
    403,
  );
  const api = await fetch(base + "/api/flash-sales/current");
  assert.equal(api.status, 200);
  assert.ok((await api.json()).server_now);
  const duplicate = await fetch(
    base + "/api/admin/flash-sales/" + collision.flash_sale_id + "/publish",
    { method: "POST", headers: { Authorization: "Bearer " + token } },
  );
  // This draft no longer conflicts after cancellation; it should now publish successfully.
  assert.equal(duplicate.status, 200);
  const other = await service.save(
    null,
    payload("HTTP conflict", instant + 3600001, instant + 7200001),
    null,
  );
  const rejected = await fetch(
    base + "/api/admin/flash-sales/" + other.flash_sale_id + "/publish",
    { method: "POST", headers: { Authorization: "Bearer " + token } },
  );
  assert.equal(rejected.status, 409);
  ok("public API, admin authorization and overlap HTTP mapping");
  console.log(
    "SUCCESS " + passed + " integration groups; only disposable database used.",
  );
}
run()
  .catch((error) => {
    console.error(error.original?.message || error.message);
    console.error(error.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.close();
    if (created && /^flash_sale_test_d+_d+$/.test(testName))
      await admin.query('DROP DATABASE "' + testName + '"');
    await admin.close();
  });
