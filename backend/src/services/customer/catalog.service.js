const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const { Book, Category, Author, Publisher, BookImage, Inventory } = require('../../models/associations');

class CatalogService {
    /**
     * Hàm tính giá bán sau giảm chuẩn xác
     */
    calculateFinalPrice(price, discountPercent) {
        const numPrice = Number(price) || 0;
        const discount = Number(discountPercent) || 0;
        return Math.round(numPrice * (1 - discount / 100));
    }

    /**
     * Lấy danh sách thể loại sách công khai
     */
    async getCategories() {
        return await Category.findAll({
            order: [['category_name', 'ASC']]
        });
    }

    /**
     * Lấy danh sách sách mở bán (Public Catalog)
     * - Chỉ lấy sách đang hiển thị (is_active = true)
     * - Loại trừ cột embedding (Vector AI)
     * - Sắp xếp theo giá sau giảm chuẩn xác
     */
    async getBooks(query) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));
        const offset = (page - 1) * limit;

        const where = { is_active: true };

        // 1. Tìm kiếm theo tên hoặc ISBN
        if (query.search && query.search.trim()) {
            const keyword = `%${query.search.trim()}%`;
            where[Op.or] = [
                { title: { [Op.iLike]: keyword } },
                { isbn: { [Op.iLike]: keyword } }
            ];
        }

        // 2. Lọc theo thể loại
        if (query.category_id) {
            where.category_id = parseInt(query.category_id, 10);
        }

        // 3. Lọc sách đang giảm giá (Flash sale / Discount)
        if (query.on_sale === 'true' || query.on_sale === true) {
            where.discount_percent = { [Op.gt]: 0 };
        }

        // 4. Sắp xếp
        let order = [['created_at', 'DESC']];
        const finalPriceSql = sequelize.literal('ROUND("Book"."price" * (1 - COALESCE("Book"."discount_percent", 0) / 100.0))');

        if (query.sort === 'price_asc') {
            order = [[finalPriceSql, 'ASC']];
        } else if (query.sort === 'price_desc') {
            order = [[finalPriceSql, 'DESC']];
        } else if (query.sort === 'discount_desc') {
            order = [['discount_percent', 'DESC'], ['created_at', 'DESC']];
        } else if (query.sort === 'newest') {
            order = [['created_at', 'DESC']];
        }

        const { rows, count } = await Book.findAndCountAll({
            where,
            attributes: { exclude: ['embedding'] },
            include: [
                { model: Category, as: 'category', attributes: ['category_id', 'category_name'] },
                { 
                    model: Author, 
                    as: 'authors', 
                    attributes: ['author_id', 'author_name'],
                    through: { attributes: ['role'] }
                },
                { model: Inventory, as: 'inventory', attributes: ['stock_quantity'] },
                { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'], separate: true }
            ],
            distinct: true,
            limit,
            offset,
            order
        });

        // Bổ sung final_price đã tính toán cho từng cuốn sách
        const books = rows.map(b => {
            const json = b.toJSON();
            json.final_price = this.calculateFinalPrice(json.price, json.discount_percent);
            return json;
        });

        return {
            books,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    /**
     * Lấy chi tiết một cuốn sách công khai
     */
    async getBookById(bookId) {
        const book = await Book.findOne({
            where: {
                book_id: bookId,
                is_active: true
            },
            attributes: { exclude: ['embedding'] },
            include: [
                { model: Category, as: 'category', attributes: ['category_id', 'category_name'] },
                { model: Publisher, as: 'publisher', attributes: ['publisher_id', 'publisher_name'] },
                { 
                    model: Author, 
                    as: 'authors', 
                    attributes: ['author_id', 'author_name'],
                    through: { attributes: ['role'] }
                },
                { model: Inventory, as: 'inventory', attributes: ['stock_quantity'] },
                { model: BookImage, as: 'images', attributes: ['image_id', 'image_url', 'is_primary'] }
            ]
        });

        if (!book) {
            const err = new Error('Sách không tồn tại hoặc đã ngừng kinh doanh');
            err.status = 404;
            throw err;
        }

        const json = book.toJSON();
        json.final_price = this.calculateFinalPrice(json.price, json.discount_percent);
        return json;
    }

    /**
     * Lấy danh sách sách liên quan (cùng thể loại, khác ID hiện tại)
     */
    async getRelatedBooks(bookId, categoryId, limit = 6) {
        if (!categoryId) return [];

        const rows = await Book.findAll({
            where: {
                category_id: categoryId,
                book_id: { [Op.ne]: bookId },
                is_active: true
            },
            attributes: { exclude: ['embedding'] },
            include: [
                { model: Category, as: 'category', attributes: ['category_id', 'category_name'] },
                { model: Inventory, as: 'inventory', attributes: ['stock_quantity'] },
                { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'], separate: true }
            ],
            limit,
            order: [['created_at', 'DESC']]
        });

        return rows.map(b => {
            const json = b.toJSON();
            json.final_price = this.calculateFinalPrice(json.price, json.discount_percent);
            return json;
        });
    }
}

module.exports = new CatalogService();
