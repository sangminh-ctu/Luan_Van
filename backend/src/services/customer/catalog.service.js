const pricing = require('../pricing.service');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const { Book, Category, Author, Publisher, Supplier, BookImage, Inventory, Tag } = require('../../models/associations');

// Sắp xếp tag theo display_order rồi theo tên
const sortTags = (json) => {
    if (Array.isArray(json.tags)) {
        json.tags.sort((a, b) => a.display_order - b.display_order || a.tag_name.localeCompare(b.tag_name, 'vi'));
    }
    return json;
};

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
     * Lấy danh sách thể loại sách công khai dạng Cây (Tree)
     * - Sắp xếp tiếng Việt có dấu chuẩn xác bằng localeCompare('vi')
     * - Cấu trúc: [ { category_id, category_name, parent_category_id: null, children: [...] }, ... ]
     */
    async getCategories() {
        const rawCategories = await Category.findAll({
            attributes: ['category_id', 'category_name', 'parent_category_id'],
            raw: true
        });

        // Tách danh mục cha (parent_category_id === null) và danh mục con
        const parents = [];
        const childrenMap = new Map();

        for (const cat of rawCategories) {
            if (cat.parent_category_id === null) {
                parents.push({
                    category_id: cat.category_id,
                    category_name: cat.category_name,
                    parent_category_id: null,
                    children: []
                });
            } else {
                const pId = Number(cat.parent_category_id);
                if (!childrenMap.has(pId)) {
                    childrenMap.set(pId, []);
                }
                childrenMap.get(pId).push({
                    category_id: cat.category_id,
                    category_name: cat.category_name,
                    parent_category_id: pId
                });
            }
        }

        // Gắn children vào từng parent và sắp xếp bằng localeCompare('vi')
        for (const parent of parents) {
            const children = childrenMap.get(parent.category_id) || [];
            children.sort((a, b) => {
                const cmp = a.category_name.localeCompare(b.category_name, 'vi');
                return cmp !== 0 ? cmp : a.category_id - b.category_id;
            });
            parent.children = children;
        }

        parents.sort((a, b) => {
            const cmp = a.category_name.localeCompare(b.category_name, 'vi');
            return cmp !== 0 ? cmp : a.category_id - b.category_id;
        });

        return parents;
    }

    /**
     * Lấy danh sách sách mở bán (Public Catalog)
     * - Chỉ lấy sách đang hiển thị (is_active = true)
     * - Loại trừ cột embedding (Vector AI)
     * - Sắp xếp theo giá sau giảm chuẩn xác
     * - Kiểm tra chặt chẽ tính hợp lệ của mọi tham số (trả về lỗi 400 nếu sai)
     */
    async getBooks(query = {}, context = {}) {
        const pricingAt = context.at || await pricing.now();
        // 1. Kiểm tra tính hợp lệ của page
        let page = 1;
        if (query.page !== undefined && query.page !== null && query.page !== '') {
            const rawPage = String(query.page).trim();
            if (!/^[1-9]\d*$/.test(rawPage)) {
                const err = new Error('Số trang (page) không hợp lệ');
                err.status = 400;
                throw err;
            }
            page = parseInt(rawPage, 10);
        }

        // 2. Kiểm tra tính hợp lệ của limit (hỗ trợ các giá trị trên danh sách và trang chủ)
        const ALLOWED_LIMITS = [5, 6, 10, 12, 20, 24, 48];
        let limit = 12;
        if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
            const rawLimit = String(query.limit).trim();
            if (!/^[1-9]\d*$/.test(rawLimit) || !ALLOWED_LIMITS.includes(parseInt(rawLimit, 10))) {
                const err = new Error('Số lượng mỗi trang (limit) không hợp lệ');
                err.status = 400;
                throw err;
            }
            limit = parseInt(rawLimit, 10);
        }

        // 3. Kiểm tra tính hợp lệ của sort
        const ALLOWED_SORTS = ['newest', 'featured', 'discount_desc', 'price_asc', 'price_desc'];
        let sort = 'newest';
        if (query.sort !== undefined && query.sort !== null && query.sort !== '') {
            const rawSort = String(query.sort).trim();
            if (!ALLOWED_SORTS.includes(rawSort)) {
                const err = new Error('Kiểu sắp xếp (sort) không hợp lệ');
                err.status = 400;
                throw err;
            }
            sort = rawSort;
        }

        const offset = (page - 1) * limit;
        const where = { is_active: true };
        let selectedBookIds;
        if (query.book_ids !== undefined) {
            const { ids, invalid } = require('../site-config.validation');
            if (typeof query.book_ids !== 'string' || !/^[1-9]\d*(,[1-9]\d*)*$/.test(query.book_ids)) {
                throw invalid('Danh sách book_ids không hợp lệ.');
            }
            selectedBookIds = ids(query.book_ids.split(',').map(Number), 10, 'Sách tuyển chọn');
            where.book_id = { [Op.in]: selectedBookIds };
        }
        if(context.flashSaleId) where[Op.and] = [sequelize.literal(
            'EXISTS (SELECT 1 FROM flash_sale_item fsi WHERE fsi.book_id = "Book".book_id AND fsi.flash_sale_id = ' + Number(context.flashSaleId) + ')'
        )];

        // 4. Tìm kiếm theo tên hoặc ISBN
        if (query.search && query.search.trim()) {
            const keyword = `%${query.search.trim()}%`;
            where[Op.or] = [
                { title: { [Op.iLike]: keyword } },
                { isbn: { [Op.iLike]: keyword } }
            ];
        }

        // 5. Lọc theo thể loại (Validate chặt chẽ & đệ quy lấy toàn bộ nhánh con)
        if (query.category_id !== undefined && query.category_id !== null && query.category_id !== '') {
            const rawCatId = String(query.category_id).trim();
            if (!/^[1-9]\d*$/.test(rawCatId)) {
                const err = new Error('Mã thể loại (category_id) không hợp lệ');
                err.status = 400;
                throw err;
            }

            const targetCatId = parseInt(rawCatId, 10);
            // Dùng CTE đệ quy PostgreSQL để lấy chính nó và mọi cấp con
            const [descendantRows] = await sequelize.query(`
                WITH RECURSIVE sub_categories AS (
                    SELECT category_id FROM category WHERE category_id = :targetCatId
                    UNION
                    SELECT c.category_id FROM category c
                    INNER JOIN sub_categories sc ON c.parent_category_id = sc.category_id
                )
                SELECT category_id FROM sub_categories;
            `, {
                replacements: { targetCatId }
            });

            const matchedCategoryIds = descendantRows.map(r => Number(r.category_id));
            if (matchedCategoryIds.length === 0) {
                // Danh mục không tồn tại trong CSDL: Trả về danh sách rỗng 200 an toàn
                return {
                    books: [],
                    pagination: {
                        total: 0,
                        page,
                        limit,
                        totalPages: 1
                    }
                };
            }

            where.category_id = { [Op.in]: matchedCategoryIds };
        }

        // 6. Lọc theo nhà xuất bản (publisher_id)
        if (query.publisher_id !== undefined && query.publisher_id !== null && query.publisher_id !== '') {
            const rawPubId = String(query.publisher_id).trim();
            if (!/^[1-9]\d*$/.test(rawPubId)) {
                const err = new Error('Mã nhà xuất bản (publisher_id) không hợp lệ');
                err.status = 400;
                throw err;
            }
            where.publisher_id = parseInt(rawPubId, 10);
        }

        // 7. Lọc theo tác giả (author_id) dùng EXISTS chống nhân bản bản ghi
        if (query.author_id !== undefined && query.author_id !== null && query.author_id !== '') {
            const rawAuthorId = String(query.author_id).trim();
            if (!/^[1-9]\d*$/.test(rawAuthorId)) {
                const err = new Error('Mã tác giả (author_id) không hợp lệ');
                err.status = 400;
                throw err;
            }
            const targetAuthorId = parseInt(rawAuthorId, 10);
            where[Op.and] = [
                ...(where[Op.and] || []),
                sequelize.literal(`EXISTS (
                    SELECT 1 FROM book_author ba 
                    WHERE ba.book_id = "Book"."book_id" 
                      AND ba.author_id = ${targetAuthorId}
                )`)
            ];
        }

        // 8. Lọc theo hình thức bìa (cover_type)
        if (query.cover_type && query.cover_type.trim()) {
            where.cover_type = query.cover_type.trim();
        }

        // 9. Lọc còn hàng (in_stock)
        if (query.in_stock === 'true' || query.in_stock === true) {
            where[Op.and] = [
                ...(where[Op.and] || []),
                sequelize.literal(`EXISTS (
                    SELECT 1 FROM inventory inv 
                    WHERE inv.book_id = "Book"."book_id" 
                      AND inv.stock_quantity > 0
                )`)
            ];
        }

        // 10. Lọc sách đang giảm giá
        if (query.on_sale === 'true' || query.on_sale === true) {
            where.discount_percent = { [Op.gt]: 0 };
        }

        // 11. Lọc theo Tag cố định (Sách mới, Độc quyền, Giới hạn)
        const filterTagName = query.tag ? String(query.tag).trim() : (query.is_new === 'true' || query.is_new === true ? 'Sách mới' : '');
        if (filterTagName) {
            const escapedTag = sequelize.escape(filterTagName.toLowerCase());
            where[Op.and] = [
                ...(where[Op.and] || []),
                sequelize.literal(`EXISTS (
                    SELECT 1 FROM book_tag bt
                    INNER JOIN tag t ON t.tag_id = bt.tag_id
                    WHERE bt.book_id = "Book"."book_id"
                      AND t.is_active = true
                      AND LOWER(t.tag_name) = ${escapedTag}
                )`)
            ];
        }

        // 12. Biểu thức tính giá sau giảm & tổng số lượng đã giao thành công (delivered)
        const finalPriceSql = sequelize.literal(pricing.effectiveSql('"Book"', pricingAt));
        const totalSoldSql = sequelize.literal(`COALESCE((
            SELECT SUM(oi.quantity)
            FROM order_item oi
            INNER JOIN orders o ON o.order_id = oi.order_id
            WHERE oi.book_id = "Book"."book_id"
              AND o.order_status = 'delivered'
        ), 0)::int`);

        // 13. Lọc theo khoảng giá (min_price, max_price) trên giá sau giảm (finalPriceSql)
        let minPrice = null;
        let maxPrice = null;
        if (query.min_price !== undefined && query.min_price !== null && query.min_price !== '') {
            const rawMin = String(query.min_price).trim();
            if (!/^\d+$/.test(rawMin)) {
                const err = new Error('Giá tối thiểu (min_price) không hợp lệ');
                err.status = 400;
                throw err;
            }
            minPrice = Number(rawMin);
        }
        if (query.max_price !== undefined && query.max_price !== null && query.max_price !== '') {
            const rawMax = String(query.max_price).trim();
            if (!/^\d+$/.test(rawMax)) {
                const err = new Error('Giá tối đa (max_price) không hợp lệ');
                err.status = 400;
                throw err;
            }
            maxPrice = Number(rawMax);
        }
        if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
            const err = new Error('Giá tối thiểu (min_price) không được lớn hơn giá tối đa (max_price)');
            err.status = 400;
            throw err;
        }

        if (minPrice !== null && maxPrice !== null) {
            where[Op.and] = [
                ...(where[Op.and] || []),
                sequelize.where(finalPriceSql, { [Op.between]: [minPrice, maxPrice] })
            ];
        } else if (minPrice !== null) {
            where[Op.and] = [
                ...(where[Op.and] || []),
                sequelize.where(finalPriceSql, { [Op.gte]: minPrice })
            ];
        } else if (maxPrice !== null) {
            where[Op.and] = [
                ...(where[Op.and] || []),
                sequelize.where(finalPriceSql, { [Op.lte]: maxPrice })
            ];
        }

        // Lọc chỉ những sách đã bán thành công ít nhất 1 cuốn (phục vụ tab Nổi Bật)
        if (query.only_sold === 'true' || query.only_sold === true) {
            where[Op.and] = [
                ...(where[Op.and] || []),
                sequelize.where(totalSoldSql, { [Op.gt]: 0 })
            ];
        }

        // 14. Thiết lập sắp xếp (Mọi sort đều có ['book_id', 'DESC'] làm khóa phụ chống trùng/nhảy trang)
        let order = [['created_at', 'DESC'], ['book_id', 'DESC']];
        if (sort === 'price_asc') {
            order = [[finalPriceSql, 'ASC'], ['book_id', 'DESC']];
        } else if (sort === 'price_desc') {
            order = [[finalPriceSql, 'DESC'], ['book_id', 'DESC']];
        } else if (sort === 'discount_desc') {
            order = [['discount_percent', 'DESC'], ['created_at', 'DESC'], ['book_id', 'DESC']];
        } else if (sort === 'newest') {
            order = [['created_at', 'DESC'], ['book_id', 'DESC']];
        } else if (sort === 'featured') {
            order = [
                [totalSoldSql, 'DESC'],
                ['discount_percent', 'DESC'],
                ['created_at', 'DESC'],
                ['book_id', 'DESC']
            ];
        }

        if (context.flashSaleId) order = [
            [sequelize.literal('(SELECT fsi.display_order FROM flash_sale_item fsi WHERE fsi.book_id = "Book".book_id AND fsi.flash_sale_id = ' + Number(context.flashSaleId) + ')'), 'ASC'],
            ['book_id', 'ASC']
        ];
        if (selectedBookIds) order = [[sequelize.literal(
            `array_position(ARRAY[${selectedBookIds.join(',')}]::integer[], "Book"."book_id")`
        ), 'ASC']];
        const { rows, count } = await Book.findAndCountAll({
            where,
            attributes: { 
                include: [[totalSoldSql, 'total_sold'], ...pricing.attributes(pricingAt)],
                exclude: ['embedding'] 
            },
            include: [
                { model: Category, as: 'category', attributes: ['category_id', 'category_name'] },
                { 
                    model: Author, 
                    as: 'authors', 
                    attributes: ['author_id', 'author_name'],
                    through: { attributes: ['role'] }
                },
                { model: Publisher, as: 'publisher', attributes: ['publisher_id', 'publisher_name'] },
                { model: Inventory, as: 'inventory', attributes: ['stock_quantity'] },
                { model: BookImage, as: 'images', attributes: ['image_url', 'is_primary'], separate: true },
                { model: Tag, as: 'tags', attributes: ['tag_id', 'tag_name', 'color', 'display_order'], where: { is_active: true }, required: false, through: { attributes: [] } }
            ],
            distinct: true,
            limit,
            offset,
            order
        });

        // Bổ sung final_price, total_sold và cờ is_new (theo tag "Sách mới" do admin chọn) cho từng cuốn sách
        const books = rows.map(b => {
            const json = b.toJSON();
            Object.assign(json, pricing.decorate(json));
            json.total_sold = Number(json.total_sold) || 0;
            sortTags(json);
            json.is_new = Array.isArray(json.tags) && json.tags.some(t => t.tag_name.toLowerCase() === 'sách mới');
            return json;
        });

        return {
            books,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: count === 0 ? 1 : Math.ceil(count / limit)
            }
        };
    }

    /**
     * Lấy danh sách lựa chọn cho bộ lọc (Chỉ lấy NXB, Tác giả, Hình thức bìa có sách is_active = true)
     */
    async getFilterOptions() {
        const publishers = await Publisher.findAll({
            attributes: ['publisher_id', 'publisher_name'],
            where: sequelize.literal(`EXISTS (
                SELECT 1 FROM book b 
                WHERE b.publisher_id = "Publisher"."publisher_id" 
                  AND b.is_active = true
            )`),
            raw: true
        });
        publishers.sort((a, b) => a.publisher_name.localeCompare(b.publisher_name, 'vi'));

        const authors = await Author.findAll({
            attributes: ['author_id', 'author_name'],
            where: sequelize.literal(`EXISTS (
                SELECT 1 FROM book_author ba 
                INNER JOIN book b ON b.book_id = ba.book_id
                WHERE ba.author_id = "Author"."author_id" 
                  AND b.is_active = true
            )`),
            raw: true
        });
        authors.sort((a, b) => a.author_name.localeCompare(b.author_name, 'vi'));

        const rawCoverTypes = await Book.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('cover_type')), 'cover_type']],
            where: {
                is_active: true,
                cover_type: { [Op.ne]: null }
            },
            raw: true
        });
        const coverTypes = rawCoverTypes
            .map(r => r.cover_type)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'vi'));

        return {
            publishers,
            authors,
            coverTypes
        };
    }

    /**
     * Lấy chi tiết một cuốn sách công khai
     */
    async getBookById(bookId) {
        const pricingAt = await pricing.now();
        const totalSoldSql = sequelize.literal(`COALESCE((
            SELECT SUM(oi.quantity)
            FROM order_item oi
            INNER JOIN orders o ON o.order_id = oi.order_id
            WHERE oi.book_id = "Book"."book_id"
              AND o.order_status = 'delivered'
        ), 0)::int`);

        const book = await Book.findOne({
            where: {
                book_id: bookId,
                is_active: true
            },
            attributes: { 
                include: [[totalSoldSql, 'total_sold'], ...pricing.attributes(pricingAt)],
                exclude: ['embedding'] 
            },
            include: [
                { model: Category, as: 'category', attributes: ['category_id', 'category_name'] },
                { model: Publisher, as: 'publisher', attributes: ['publisher_id', 'publisher_name'] },
                { model: Supplier, as: 'supplier', attributes: ['supplier_id', 'supplier_name'] },
                { 
                    model: Author, 
                    as: 'authors', 
                    attributes: ['author_id', 'author_name'],
                    through: { attributes: ['role'] }
                },
                { model: Inventory, as: 'inventory', attributes: ['stock_quantity'] },
                { model: BookImage, as: 'images', attributes: ['image_id', 'image_url', 'is_primary'] },
                { model: Tag, as: 'tags', attributes: ['tag_id', 'tag_name', 'color', 'display_order'], where: { is_active: true }, required: false, through: { attributes: [] } }
            ]
        });

        if (!book) {
            const err = new Error('Sách không tồn tại hoặc đã ngừng kinh doanh');
            err.status = 404;
            throw err;
        }

        const json = book.toJSON();
        Object.assign(json, pricing.decorate(json));
        json.total_sold = Number(json.total_sold) || 0;
        return sortTags(json);
    }

    /**
     * Lấy danh sách sách liên quan (cùng thể loại, khác ID hiện tại)
     */
    async getRelatedBooks(bookId, categoryId, limit = 6) {
        if (!categoryId) return [];
        const pricingAt = await pricing.now();

        const rows = await Book.findAll({
            where: {
                category_id: categoryId,
                book_id: { [Op.ne]: bookId },
                is_active: true
            },
            attributes: { exclude: ['embedding'], include: pricing.attributes(pricingAt) },
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
            Object.assign(json, pricing.decorate(json));
            return json;
        });
    }
}

module.exports = new CatalogService();
