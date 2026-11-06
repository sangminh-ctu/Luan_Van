const fs = require('node:fs/promises');
const path = require('node:path');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { HomeSpotlight, HomeSpotlightBook, HomeSpotlightCategory, Book, Category, BookImage, Inventory } = require('../models/associations');
const catalog = require('./customer/catalog.service');
const pricing = require('./pricing.service');
const { validateConfig, invalid } = require('./site-config.validation');

async function read() {
    const row = await HomeSpotlight.findByPk(1, { include: [
        { model: HomeSpotlightBook, as: 'selected_books', include: [
            { model: Book, as: 'book', attributes: ['book_id', 'title', 'isbn', 'price', 'is_active'], include: [
                { model: BookImage, as: 'images', separate: true },
                { model: Inventory, as: 'inventory', attributes: ['stock_quantity'] }
            ] }
        ] },
        { model: HomeSpotlightCategory, as: 'selected_categories', include: [{ model: Category, as: 'category' }] }
    ] });
    if (!row) throw Object.assign(new Error('Chưa có cấu hình trang chủ. Hãy chạy migration 009.'), { status: 503 });
    const data = row.toJSON();
    data.selected_books.sort((a, b) => a.sort_order - b.sort_order);
    data.selected_categories.sort((a, b) => a.sort_order - b.sort_order);
    const { selected_books, selected_categories, ...config } = data;
    return { ...config,
        book_ids: selected_books.map(item => item.book_id),
        category_ids: selected_categories.map(item => item.category_id),
        books: selected_books.map(item => item.book).filter(Boolean),
        categories: selected_categories.map(item => item.category).filter(Boolean)
    };
}

async function save(input) {
    const data = validateConfig(input);
    if (data.banner_url) {
        try { await fs.access(path.join(__dirname, '../../', data.banner_url.slice(1))); }
        catch { throw invalid('Ảnh banner không tồn tại. Vui lòng tải ảnh lại.'); }
    }
    await sequelize.transaction(async transaction => {
        const row = await HomeSpotlight.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row) throw invalid('Chưa có cấu hình. Hãy chạy migration 009.');
        const [books, categories] = await Promise.all([
            Book.findAll({ where: { book_id: { [Op.in]: data.book_ids } }, attributes: ['book_id', 'is_active'], transaction }),
            Category.count({ where: { category_id: { [Op.in]: data.category_ids } }, transaction })
        ]);
        if (books.length !== data.book_ids.length) throw invalid('Một số sách đã bị xóa. Vui lòng tải lại cấu hình.');
        if (categories !== data.category_ids.length) throw invalid('Một số danh mục đã bị xóa. Vui lòng tải lại cấu hình.');
        if (data.is_active && !data.category_ids.length && !books.some(book => book.is_active)) {
            throw invalid('Các sách tuyển chọn đều đang ẩn. Hãy chọn ít nhất một sách đang hiển thị.');
        }
        const { book_ids, category_ids, ...fields } = data;
        await row.update({ ...fields, updated_at: new Date() }, { transaction });
        await HomeSpotlightBook.destroy({ where: { spotlight_id: 1 }, transaction });
        await HomeSpotlightCategory.destroy({ where: { spotlight_id: 1 }, transaction });
        await HomeSpotlightBook.bulkCreate(book_ids.map((book_id, sort_order) => ({ spotlight_id: 1, book_id, sort_order })), { transaction });
        await HomeSpotlightCategory.bulkCreate(category_ids.map((category_id, sort_order) => ({ spotlight_id: 1, category_id, sort_order })), { transaction });
    });
    return read();
}

async function populate(config) {
    const context = { at: await pricing.now() };
    const [manual, categories] = await Promise.all([
        config.book_ids.length ? catalog.getBooks({ book_ids: config.book_ids.join(','), limit: 10 }, context) : { books: [] },
        Promise.all(config.category_ids.map(async category_id => {
            const category = await Category.findByPk(category_id, { attributes: ['category_id', 'category_name'], raw: true });
            if (!category) return null;
            const result = await catalog.getBooks({ category_id, limit: 10, sort: 'newest' }, context);
            return { ...category, books: result.books, total: result.pagination.total };
        }))
    ]);
    return {
        title: config.title, banner_url: config.banner_url, banner_alt: config.banner_alt,
        manual_tab_label: config.manual_tab_label, is_active: config.is_active,
        updated_at: config.updated_at,
        manual_books: manual.books,
        categories: categories.filter(Boolean)
    };
}

async function publicSpotlight() {
    const config = await read();
    if (!config.is_active) return null;
    const result = await populate(config);
    result.categories = result.categories.filter(category => category.books.length);
    return result.manual_books.length || result.categories.length ? result : null;
}

module.exports = { read, save, publicSpotlight, preview: input => populate(validateConfig(input)) };
