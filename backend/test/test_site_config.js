// Integration checks run in a disposable database cloned from schema only.
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { validateConfig } = require('../src/services/site-config.validation');
const valid = { title: 'Tháng 11 đọc gì?', banner_url: null, banner_alt: '', manual_tab_label: 'Tuyển chọn', is_active: true, book_ids: [1], category_ids: [] };
let passed = 0;
function ok(label) { passed++; console.log('PASS ' + label); }
for (const change of [
    { book_ids: [1, 1] }, { book_ids: ['1'] }, { book_ids: [0] },
    { book_ids: Array.from({ length: 11 }, (_, i) => i + 1) },
    { category_ids: [1, 2, 3, 4, 5, 6, 7] }, { title: ' ' },
    { manual_tab_label: '' }, { is_active: 'true' },
    { banner_url: '/uploads/banners/../../.env' },
    { book_ids: [], category_ids: [] }
]) assert.throws(() => validateConfig({ ...valid, ...change }), error => error.status === 400);
ok('input validation: duplicate, malformed, oversized, empty and unsafe values');

const testName = `spotlight_test_${Date.now()}_${process.pid}`;
const control = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST, port: process.env.DB_PORT, dialect: 'postgres', logging: false
});
let db, server, created = false, uploadedFile;
async function run() {
    const schema = execFileSync(process.env.PG_DUMP_PATH || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe' : 'pg_dump'), [
        '--schema-only', '--no-owner', '--no-privileges', '-h', process.env.DB_HOST || 'localhost',
        '-p', process.env.DB_PORT || '5432', '-U', process.env.DB_USER, '-d', process.env.DB_NAME
    ], { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
        .split(/\r?\n/).filter(line => !line.trimStart().startsWith('\\')).join('\n')
        .replace('CREATE SCHEMA public;', 'CREATE SCHEMA IF NOT EXISTS public;');
    await control.query(`CREATE DATABASE "${testName}"`);
    created = true;
    process.env.DB_NAME = testName;
    db = require('../src/config/database').sequelize;
    await db.query(schema);
    await db.query('SET search_path TO public');
    for (const migration of ['007_flash_sale.sql', '008_book_tag.sql', '009_home_spotlight.sql']) {
        const table = { '007_flash_sale.sql': 'flash_sale', '008_book_tag.sql': 'tag', '009_home_spotlight.sql': 'home_spotlight' }[migration];
        const [rows] = await db.query(`SELECT to_regclass('public.${table}') AS name`);
        if (!rows[0].name || migration === '009_home_spotlight.sql') await db.query(fs.readFileSync(path.join(__dirname, '../../database/migrations', migration), 'utf8'));
    }
    // Running migration twice must preserve the singleton and its configuration.
    await db.query(fs.readFileSync(path.join(__dirname, '../../database/migrations/009_home_spotlight.sql'), 'utf8'));
    const { Book, Category, Inventory, Tag, BookTag, FlashSale, FlashSaleItem, HomeSpotlightBook } = require('../src/models/associations');
    const service = require('../src/services/site-config.service');
    const catalog = require('../src/services/customer/catalog.service');
    assert.equal(await service.publicSpotlight(), null);
    ok('idempotent migration and disabled default');
    const category = await Category.create({ category_name: 'Văn học thử nghiệm' });
    const child = await Category.create({ category_name: 'Truyện thầy cô', parent_category_id: category.category_id });
    const empty = await Category.create({ category_name: 'Chưa có sách' });
    const books = [];
    for (let i = 0; i < 3; i++) books.push(await Book.create({ title: `Tuyển chọn ${i}`, price: 100000, discount_percent: 10, category_id: child.category_id, is_active: i !== 2 }));
    await Inventory.bulkCreate(books.map((book, i) => ({ book_id: book.book_id, stock_quantity: i ? 0 : 10 })));
    const tag = await Tag.create({ tag_name: 'Chủ đề test', color: '#123456' });
    await BookTag.create({ book_id: books[0].book_id, tag_id: tag.tag_id });
    const sale = await FlashSale.create({ name: 'Spotlight flash', start_at: new Date(Date.now() - 60000), end_at: new Date(Date.now() + 3600000), status: 'published' });
    await FlashSaleItem.create({ flash_sale_id: sale.flash_sale_id, book_id: books[0].book_id, sale_price: 60000 });
    const input = { ...valid, book_ids: [books[1].book_id, books[2].book_id, books[0].book_id], category_ids: [empty.category_id, category.category_id] };
    const saved = await service.save(input);
    assert.deepEqual(saved.book_ids, input.book_ids);
    assert.deepEqual(saved.category_ids, input.category_ids);
    assert.equal(saved.books.find(book => book.book_id === books[2].book_id).is_active, false);
    ok('admin round-trip preserves order and warns about hidden books');
    const result = await service.publicSpotlight();
    assert.deepEqual(result.manual_books.map(book => book.book_id), [books[1].book_id, books[0].book_id]);
    assert.equal(result.manual_books[0].inventory.stock_quantity, 0);
    assert.equal(result.manual_books[1].final_price, 60000);
    assert.equal(result.manual_books[1].tags[0].tag_name, 'Chủ đề test');
    assert.equal(result.manual_books[1].total_sold, 0);
    assert.deepEqual(result.categories.map(c => c.category_id), [category.category_id]);
    assert.equal(result.categories[0].books.length, 2);
    ok('public data: manual order, hidden exclusion, stock, Flash Sale, tags, descendants and empty tabs');
    const sorted = await catalog.getBooks({ book_ids: `${books[1].book_id},${books[0].book_id}`, sort: 'price_asc', limit: 10 });
    assert.deepEqual(sorted.books.map(book => book.book_id), [books[1].book_id, books[0].book_id]);
    await assert.rejects(() => catalog.getBooks({ book_ids: '1 OR 1=1', limit: 10 }), error => error.status === 400);
    await assert.rejects(() => catalog.getBooks({ book_ids: '1,1', limit: 10 }), error => error.status === 400);
    ok('manual order overrides sort and rejects unsafe filters');
    await assert.rejects(() => service.save({ ...input, category_ids: [2147483647] }), error => error.status === 400);
    assert.deepEqual((await service.read()).category_ids, input.category_ids);
    // Force failure after deleting associations to verify transaction rollback.
    const originalBulkCreate = HomeSpotlightBook.bulkCreate;
    HomeSpotlightBook.bulkCreate = async () => { throw new Error('forced test failure'); };
    try { await assert.rejects(() => service.save({ ...input, title: 'Must roll back' })); }
    finally { HomeSpotlightBook.bulkCreate = originalBulkCreate; }
    assert.equal((await service.read()).title, input.title);
    assert.deepEqual((await service.read()).book_ids, input.book_ids);
    ok('invalid references and mid-save failures preserve previous configuration');
    const alternatives = [
        { ...input, title: 'Concurrent A', book_ids: [books[0].book_id], category_ids: [category.category_id] },
        { ...input, title: 'Concurrent B', book_ids: [books[1].book_id], category_ids: [empty.category_id] }
    ];
    await Promise.all(alternatives.map(data => service.save(data)));
    const concurrent = await service.read();
    const winner = alternatives.find(data => data.title === concurrent.title);
    assert.ok(winner);
    assert.deepEqual(concurrent.book_ids, winner.book_ids);
    assert.deepEqual(concurrent.category_ids, winner.category_ids);
    await service.save(input);
    ok('concurrent saves serialize without mixing book and category selections');
    const beforePreview = await service.read();
    const preview = await service.preview({ ...input, title: 'Chưa lưu', is_active: false });
    assert.equal(preview.title, 'Chưa lưu');
    assert.equal(preview.categories[0].books.length, 0);
    assert.equal((await service.read()).title, beforePreview.title);
    await service.save({ ...input, book_ids: [] });
    assert.equal((await service.publicSpotlight()).manual_books.length, 0);
    await service.save({ ...input, category_ids: [] });
    assert.equal((await service.publicSpotlight()).categories.length, 0);
    await service.save({ ...input, book_ids: [], category_ids: [empty.category_id] });
    assert.equal(await service.publicSpotlight(), null);
    ok('preview does not publish; category-only, manual-only and empty content');
    // Cyclic category data must not hang recursive filtering.
    await category.update({ parent_category_id: child.category_id });
    assert.equal((await catalog.getBooks({ category_id: category.category_id, limit: 10 })).books.length, 2);
    await category.update({ parent_category_id: null });
    ok('recursive category filtering terminates with cyclic data');

    const app = require('../src/app');
    server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const jwt = require('jsonwebtoken');
    const token = role => jwt.sign({ user_id: 1, role }, process.env.JWT_SECRET || 'fallback_secret_key');
    const headers = { Authorization: `Bearer ${token('admin')}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(base + '/admin/site-config')).status, 401);
    assert.equal((await fetch(base + '/admin/site-config', { headers: { Authorization: `Bearer ${token('customer')}` } })).status, 403);
    assert.equal((await fetch(base + '/admin/site-config', { headers })).status, 200);
    const update = await fetch(base + '/admin/site-config', { method: 'PUT', headers, body: JSON.stringify(input) });
    assert.equal(update.status, 200);
    const publicResponse = await fetch(base + '/site-config/spotlight');
    assert.equal(publicResponse.status, 200);
    assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    assert.equal((await publicResponse.json()).manual_books.length, 2);
    const previewResponse = await fetch(base + '/admin/site-config/preview', { method: 'POST', headers, body: JSON.stringify({ ...input, title: 'Preview HTTP' }) });
    assert.equal(previewResponse.status, 200);
    assert.equal((await service.read()).title, input.title);
    ok('HTTP authentication, authorization, save, public output and isolated preview');
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ioAAAAASUVORK5CYII=', 'base64');
    const multipart = new FormData();
    multipart.append('image', new Blob([image], { type: 'image/png' }), 'banner.png');
    const uploaded = await fetch(base + '/admin/site-config/upload-banner', { method: 'POST', headers: { Authorization: headers.Authorization }, body: multipart });
    assert.equal(uploaded.status, 201);
    const { banner_url } = await uploaded.json();
    assert.match(banner_url, /^\/uploads\/banners\/[a-f0-9]{32}\.png$/);
    uploadedFile = path.resolve(__dirname, '../', banner_url.slice(1));
    const allowedDir = path.resolve(__dirname, '../uploads/banners') + path.sep;
    assert.ok(uploadedFile.startsWith(allowedDir));
    await service.save({ ...input, banner_url });
    assert.equal((await service.publicSpotlight()).banner_url, banner_url);
    const unauthenticatedUpload = new FormData();
    unauthenticatedUpload.append('image', new Blob([image], { type: 'image/png' }), 'banner.png');
    assert.equal((await fetch(base + '/admin/site-config/upload-banner', { method: 'POST', body: unauthenticatedUpload })).status, 401);
    const bad = new FormData();
    bad.append('image', new Blob(['<svg></svg>'], { type: 'image/png' }), 'fake.png');
    assert.equal((await fetch(base + '/admin/site-config/upload-banner', { method: 'POST', headers: { Authorization: headers.Authorization }, body: bad })).status, 400);
    ok('banner upload checks content signature and persists uploaded path');
    await books[1].destroy();
    assert.ok(!(await service.read()).book_ids.includes(books[1].book_id));
    await service.save({ ...input, book_ids: [books[0].book_id], is_active: false });
    assert.equal(await service.publicSpotlight(), null);
    ok('deleted selections cascade and disabling hides the block');
}
run().then(() => console.log(`${passed} groups passed.`)).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (db) await db.close();
    if (uploadedFile) fs.unlinkSync(uploadedFile);
    if (created) await control.query(`DROP DATABASE "${testName}" WITH (FORCE)`);
    await control.close();
});
