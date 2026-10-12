const bookService = require('../../services/admin/book.service');

// Lấy danh sách sách
exports.getAllBooks = async (req, res) => {
    try {
        const result = await bookService.getAllBooks(req.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi tải danh sách sách', error: error.message });
    }
};

// Lấy chi tiết sách
exports.getBookById = async (req, res) => {
    try {
        const book = await bookService.getBookById(req.params.id);
        if (!book) return res.status(404).json({ message: 'Không tìm thấy sách' });
        res.json(book);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi tải thông tin sách', error: error.message });
    }
};

// Tạo sách mới
exports.createBook = async (req, res) => {
    try {
        const { title, price, category_id, authors, images, isbn } = req.body;

        // Validate cơ bản
        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Tên sách không được để trống' });
        }
        if (title.trim().length > 255) {
            return res.status(400).json({ message: 'Tên sách không được vượt quá 255 ký tự' });
        }
        if (price === undefined || isNaN(price) || parseFloat(price) < 0) {
            return res.status(400).json({ message: 'Giá sách phải là số lớn hơn hoặc bằng 0' });
        }
        if (!category_id) {
            return res.status(400).json({ message: 'Vui lòng chọn thể loại cho sách' });
        }
        if (!authors || !Array.isArray(authors) || authors.length === 0) {
            return res.status(400).json({ message: 'Sách phải có ít nhất 1 tác giả' });
        }

        // Validate ISBN định dạng
        if (isbn && isbn.trim()) {
            const cleanIsbn = isbn.replace(/-/g, '').trim();
            if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
                return res.status(400).json({ message: 'Mã ISBN phải gồm 10 hoặc 13 chữ số' });
            }
        }

        const newBook = await bookService.createBook(req.body);
        res.status(201).json(newBook);
    } catch (error) {
        // Bắt lỗi trùng lặp ISBN hoặc lỗi khóa ngoại
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Mã ISBN đã tồn tại trong hệ thống' });
        }
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({ message: 'Thể loại hoặc Nhà xuất bản không tồn tại' });
        }
        res.status(500).json({ message: 'Lỗi tạo sách: ' + error.message });
    }
};

// Cập nhật sách
exports.updateBook = async (req, res) => {
    try {
        const updatedBook = await bookService.updateBook(req.params.id, req.body);
        res.json(updatedBook);
    } catch (error) {
        if (error.status === 404) return res.status(404).json({ message: error.message });
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Mã ISBN đã tồn tại trong hệ thống' });
        }
        res.status(500).json({ message: 'Lỗi cập nhật sách: ' + error.message });
    }
};

// Ẩn / Hiện sách (Soft Toggle)
exports.toggleActive = async (req, res) => {
    try {
        const { is_active } = req.body;
        const book = await bookService.toggleActiveBook(req.params.id, is_active);
        res.json({ message: `Đã ${book.is_active ? 'kích hoạt hiển thị' : 'ẩn'} sách thành công`, book });
    } catch (error) {
        if (error.status === 404) return res.status(404).json({ message: error.message });
        res.status(500).json({ message: 'Lỗi đổi trạng thái sách: ' + error.message });
    }
};

// Xóa sách vĩnh viễn (Chỉ xóa khi không dính giao dịch)
exports.deleteBook = async (req, res) => {
    try {
        const result = await bookService.deleteBook(req.params.id);
        res.json(result);
    } catch (error) {
        if (error.status === 404) return res.status(404).json({ message: error.message });
        if (error.name === 'SequelizeForeignKeyConstraintError' || error.parent?.code === '23503') {
            return res.status(409).json({ 
                message: 'Không thể xóa vĩnh viễn: Sách này đã phát sinh giao dịch (đơn hàng hoặc phiếu nhập xuất). Vui lòng dùng tính năng Ẩn sách.' 
            });
        }
        res.status(500).json({ message: 'Lỗi xóa sách: ' + error.message });
    }
};

// Upload ảnh bìa sách
exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng chọn file ảnh để tải lên' });
        }
        // Trả về đường dẫn ảnh tĩnh
        const imageUrl = `/uploads/books/${req.file.filename}`;
        res.status(201).json({
            message: 'Tải ảnh thành công',
            image_url: imageUrl,
            filename: req.file.filename
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi tải ảnh: ' + error.message });
    }
};
