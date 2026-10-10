const Book = require('../models/Book');
const Category = require('../models/Category'); 
const Author = require('../models/Author');    

// [GET] Lấy danh sách toàn bộ sách
exports.getAllBooks = async (req, res, next) => {
    try {
        const books = await Book.findAll({
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: Category,
                    as: 'category',
                    attributes: ['category_name'] // Chỉ lấy tên danh mục cho nhẹ
                },
                {
                    model: Author,
                    as: 'authors', 
                    attributes: ['author_name'], // Chỉ lấy tên tác giả
                    through: { attributes: ['role'] } // Lấy thêm vai trò (author/translator) từ bảng trung gian
                }
            ]
        });
        res.status(200).json({ success: true, data: books });
    } catch (error) {
        next(error);
    }
};

const { sequelize } = require('../config/database');
const BookAuthor = require('../models/BookAuthor');

// [POST] Thêm một cuốn sách mới kèm Tác giả
exports.createBook = async (req, res, next) => {
    // Khởi tạo Transaction (Giao dịch) để đảm bảo an toàn dữ liệu
    const transaction = await sequelize.transaction();

    try {
        const { title, isbn, price, discount_percent, category_id, publisher_id, description, authors } = req.body;
        
        if (!title || !price || !category_id) {
            return res.status(400).json({ success: false, message: 'Tên sách, giá và danh mục là bắt buộc!' });
        }

        // Bước 1: Tạo sách
        const newBook = await Book.create({
            title,
            isbn,
            price,
            discount_percent: discount_percent || 0,
            category_id,
            publisher_id,
            description
        }, { transaction }); // gán transaction vào đây

        // Bước 2: Lưu danh sách tác giả (nếu có)
        if (authors && Array.isArray(authors) && authors.length > 0) {
            // Chuẩn bị mảng dữ liệu để chèn vào bảng book_author
            const bookAuthorsData = authors.map(author => ({
                book_id: newBook.book_id,
                author_id: author.author_id,
                role: author.role || 'author'
            }));

            // Chèn nhiều dòng cùng lúc bằng bulkCreate
            await BookAuthor.bulkCreate(bookAuthorsData, { transaction });
        }

        // Nếu mọi thứ thành công, xác nhận lưu vào CSDL
        await transaction.commit();

        res.status(201).json({ success: true, message: 'Thêm sách và tác giả thành công!', data: newBook });
    } catch (error) {
        // Nếu có bất kỳ lỗi gì xảy ra, hủy bỏ toàn bộ thay đổi (Rollback)
        await transaction.rollback();
        next(error);
    }
};