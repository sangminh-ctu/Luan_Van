const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const { 
    Book, 
    Category, 
    Author, 
    Publisher, 
    BookAuthor, 
    BookImage, 
    Inventory 
} = require('../../models/associations');

class BookService {
    /**
     * Lấy danh sách sách có phân trang, tìm kiếm và lọc
     */
    async getAllBooks(query) {
        const page = parseInt(query.page, 10) || 1;
        const limit = parseInt(query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const where = {};
        
        // Lọc theo trạng thái ẩn/hiển thị (Nếu không chọn hoặc rỗng thì xem tất cả)
        if (query.is_active !== undefined && query.is_active !== '' && query.is_active !== null) {
            where.is_active = query.is_active === 'true' || query.is_active === true;
        }

        // Tìm kiếm theo từ khóa (tiêu đề sách hoặc ISBN)
        if (query.search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${query.search.trim()}%` } },
                { isbn: { [Op.iLike]: `%${query.search.trim()}%` } }
            ];
        }

        // Lọc theo Thể loại: Nếu là thể loại cha, cần lấy tất cả thể loại con
        if (query.category_id) {
            const targetCatId = parseInt(query.category_id, 10);
            const childCategories = await Category.findAll({
                where: { parent_category_id: targetCatId },
                attributes: ['category_id']
            });
            const catIds = [targetCatId, ...childCategories.map(c => c.category_id)];
            where.category_id = { [Op.in]: catIds };
        }

        // Lọc theo Nhà xuất bản
        if (query.publisher_id) {
            where.publisher_id = parseInt(query.publisher_id, 10);
        }

        // Nếu lọc theo tác giả, lấy danh sách book_id trước để tránh đếm sai
        if (query.author_id) {
            const bookAuthors = await BookAuthor.findAll({
                where: { author_id: parseInt(query.author_id, 10) },
                attributes: ['book_id']
            });
            const bookIdsWithAuthor = bookAuthors.map(ba => ba.book_id);
            where.book_id = { [Op.in]: bookIdsWithAuthor };
        }

        // Truy vấn phân trang an toàn với distinct: true để đếm đúng
        const { rows, count } = await Book.findAndCountAll({
            where,
            include: [
                { model: Category, as: 'category', attributes: ['category_id', 'category_name'] },
                { model: Publisher, as: 'publisher', attributes: ['publisher_id', 'publisher_name'] },
                { 
                    model: BookAuthor, 
                    as: 'book_authors',
                    include: [{ model: Author, as: 'author', attributes: ['author_id', 'author_name'] }]
                },
                { model: BookImage, as: 'images' },
                { model: Inventory, as: 'inventory', attributes: ['stock_quantity', 'last_updated'] }
            ],
            distinct: true,
            limit,
            offset,
            order: [['created_at', 'DESC']]
        });

        return {
            books: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    /**
     * Lấy chi tiết một cuốn sách theo ID
     */
    async getBookById(bookId) {
        const book = await Book.findByPk(bookId, {
            include: [
                { model: Category, as: 'category' },
                { model: Publisher, as: 'publisher' },
                { 
                    model: BookAuthor, 
                    as: 'book_authors',
                    include: [{ model: Author, as: 'author' }]
                },
                { model: BookImage, as: 'images' },
                { model: Inventory, as: 'inventory' }
            ]
        });
        return book;
    }

    /**
     * Tạo sách mới kèm Tác giả, Hình ảnh và Khởi tạo Tồn kho = 0 
     */
    async createBook(data) {
        const transaction = await sequelize.transaction();
        try {
            const {
                title, isbn, cover_type, price, discount_percent,
                description, publication_year, page_count, weight,
                length, width, height,
                category_id, publisher_id, authors, images
            } = data;

            // 1. Tạo bản ghi Sách
            const newBook = await Book.create({
                title: title.trim(),
                isbn: isbn ? isbn.trim() : null,
                cover_type,
                price: parseFloat(price),
                discount_percent: discount_percent !== undefined ? parseFloat(discount_percent) : 0,
                description,
                publication_year: publication_year ? parseInt(publication_year, 10) : null,
                page_count: page_count ? parseInt(page_count, 10) : null,
                weight: weight !== undefined && weight !== null && weight !== '' ? parseFloat(weight) : null,
                length: length !== undefined && length !== null && length !== '' ? parseFloat(length) : null,
                width: width !== undefined && width !== null && width !== '' ? parseFloat(width) : null,
                height: height !== undefined && height !== null && height !== '' ? parseFloat(height) : null,
                category_id: parseInt(category_id, 10),
                publisher_id: publisher_id ? parseInt(publisher_id, 10) : null,
                is_active: true
            }, { transaction });

            const bookId = newBook.book_id;

            // 2. Thêm Tác giả (Lọc trùng lặp cặp author_id + role)
            if (authors && Array.isArray(authors) && authors.length > 0) {
                const uniqueAuthorsMap = new Map();
                for (const item of authors) {
                    const key = `${item.author_id}-${item.role || 'author'}`;
                    if (!uniqueAuthorsMap.has(key)) {
                        uniqueAuthorsMap.set(key, {
                            book_id: bookId,
                            author_id: parseInt(item.author_id, 10),
                            role: item.role === 'translator' ? 'translator' : 'author'
                        });
                    }
                }
                const authorRecords = Array.from(uniqueAuthorsMap.values());
                await BookAuthor.bulkCreate(authorRecords, { transaction });
            }

            // 3. Thêm Hình ảnh sách (Đảm bảo đúng 1 ảnh chính)
            if (images && Array.isArray(images) && images.length > 0) {
                let hasPrimary = false;
                const imageRecords = images.map((img, index) => {
                    const isPrimary = (img.is_primary === true || img.is_primary === 'true') && !hasPrimary;
                    if (isPrimary) hasPrimary = true;

                    return {
                        book_id: bookId,
                        image_url: img.image_url,
                        is_primary: isPrimary || (index === 0 && !hasPrimary)
                    };
                });
                await BookImage.bulkCreate(imageRecords, { transaction });
            }

            // 4. Khởi tạo Tồn kho ban đầu = 0
            await Inventory.create({
                book_id: bookId,
                stock_quantity: 0
            }, { transaction });

            await transaction.commit();

            // Trả về cuốn sách vừa tạo kèm đầy đủ quan hệ
            return await this.getBookById(bookId);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Cập nhật sách: Bảo toàn embedding_vector của ảnh cũ (So khớp image_id)
     */
    async updateBook(bookId, data) {
        const transaction = await sequelize.transaction();
        try {
            const book = await Book.findByPk(bookId, { transaction });
            if (!book) {
                const err = new Error('Không tìm thấy sách cần cập nhật');
                err.status = 404;
                throw err;
            }

            const {
                title, isbn, cover_type, price, discount_percent,
                description, publication_year, page_count, weight,
                length, width, height,
                category_id, publisher_id, is_active, authors, images
            } = data;

            // 1. Cập nhật thông tin cơ bản
            await book.update({
                title: title !== undefined ? title.trim() : book.title,
                isbn: isbn !== undefined ? (isbn ? isbn.trim() : null) : book.isbn,
                cover_type: cover_type !== undefined ? cover_type : book.cover_type,
                price: price !== undefined ? parseFloat(price) : book.price,
                discount_percent: discount_percent !== undefined ? parseFloat(discount_percent) : book.discount_percent,
                description: description !== undefined ? description : book.description,
                publication_year: publication_year !== undefined ? (publication_year ? parseInt(publication_year, 10) : null) : book.publication_year,
                page_count: page_count !== undefined ? (page_count ? parseInt(page_count, 10) : null) : book.page_count,
                weight: weight !== undefined ? (weight !== null && weight !== '' ? parseFloat(weight) : null) : book.weight,
                length: length !== undefined ? (length !== null && length !== '' ? parseFloat(length) : null) : book.length,
                width: width !== undefined ? (width !== null && width !== '' ? parseFloat(width) : null) : book.width,
                height: height !== undefined ? (height !== null && height !== '' ? parseFloat(height) : null) : book.height,
                category_id: category_id !== undefined ? parseInt(category_id, 10) : book.category_id,
                publisher_id: publisher_id !== undefined ? (publisher_id ? parseInt(publisher_id, 10) : null) : book.publisher_id,
                is_active: is_active !== undefined ? is_active : book.is_active
            }, { transaction });

            // 2. Cập nhật Tác giả (Xóa cũ và chèn lại với danh sách mới đã lọc trùng)
            if (authors && Array.isArray(authors)) {
                await BookAuthor.destroy({ where: { book_id: bookId }, transaction });

                const uniqueAuthorsMap = new Map();
                for (const item of authors) {
                    const key = `${item.author_id}-${item.role || 'author'}`;
                    if (!uniqueAuthorsMap.has(key)) {
                        uniqueAuthorsMap.set(key, {
                            book_id: bookId,
                            author_id: parseInt(item.author_id, 10),
                            role: item.role === 'translator' ? 'translator' : 'author'
                        });
                    }
                }
                const authorRecords = Array.from(uniqueAuthorsMap.values());
                if (authorRecords.length > 0) {
                    await BookAuthor.bulkCreate(authorRecords, { transaction });
                }
            }

            // 3. Cập nhật Hình ảnh SO KHỚP THEO image_id (Bảo toàn embedding_vector)
            if (images && Array.isArray(images)) {
                const currentImages = await BookImage.findAll({ where: { book_id: bookId }, transaction });
                const currentImgIds = currentImages.map(img => img.image_id);
                const incomingImgIds = images.filter(img => img.image_id).map(img => img.image_id);

                // Xóa những ảnh không còn trong danh sách gửi lên
                const idsToDelete = currentImgIds.filter(id => !incomingImgIds.includes(id));
                if (idsToDelete.length > 0) {
                    await BookImage.destroy({ where: { image_id: { [Op.in]: idsToDelete } }, transaction });
                }

                // Cập nhật hoặc chèn mới
                for (const img of images) {
                    if (img.image_id) {
                        // Ảnh đã tồn tại: chỉ cập nhật trạng thái is_primary, KHÔNG đụng đến embedding_vector
                        await BookImage.update({
                            is_primary: img.is_primary === true || img.is_primary === 'true'
                        }, { where: { image_id: img.image_id }, transaction });
                    } else {
                        // Ảnh mới hoàn toàn: chèn mới
                        await BookImage.create({
                            book_id: bookId,
                            image_url: img.image_url,
                            is_primary: img.is_primary === true || img.is_primary === 'true'
                        }, { transaction });
                    }
                }
            }

            await transaction.commit();
            return await this.getBookById(bookId);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Chuyển trạng thái Ẩn / Hiển thị sách (Khuyên dùng thay cho xóa cứng)
     */
    async toggleActiveBook(bookId, isActive) {
        const book = await Book.findByPk(bookId);
        if (!book) {
            const err = new Error('Không tìm thấy sách');
            err.status = 404;
            throw err;
        }
        await book.update({ is_active: isActive });
        return book;
    }

    /**
     * Xóa cứng sách: Chỉ cho phép khi sách chưa phát sinh bất kỳ giao dịch nào
     */
    async deleteBook(bookId) {
        const book = await Book.findByPk(bookId);
        if (!book) {
            const err = new Error('Không tìm thấy sách để xóa');
            err.status = 404;
            throw err;
        }

        // Xóa sách (Database ON DELETE CASCADE sẽ dọn dẹp book_author, book_image, inventory)
        // Nếu sách đã có trong đơn hàng hoặc phiếu nhập xuất, PostgreSQL sẽ chặn với lỗi khóa ngoại
        await book.destroy();
        return { message: 'Đã xóa sách vĩnh viễn thành công' };
    }
}

module.exports = new BookService();
