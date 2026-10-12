const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyToken } = require('./middlewares/auth.middleware');
const { requireAdmin } = require('./middlewares/role.middleware');

const app = express();

// Khởi tạo các mối quan hệ Database
require('./models/associations');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình Static Files cho thư mục uploads (để Frontend và AI truy cập ảnh)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend đang chạy' });
});

// Auth Routes
app.use('/api/auth', require('./routes/auth.routes'));

// Admin Routes
app.use('/api/admin/categories', verifyToken, requireAdmin, require('./routes/admin/category.routes'));
app.use('/api/admin/authors', verifyToken, requireAdmin, require('./routes/admin/author.routes'));
app.use('/api/admin/publishers', verifyToken, requireAdmin, require('./routes/admin/publisher.routes'));
app.use('/api/admin/books', verifyToken, requireAdmin, require('./routes/admin/book.routes'));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra', error: err.message });
});

module.exports = app;
