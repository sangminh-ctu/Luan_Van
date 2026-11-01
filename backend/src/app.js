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

// Customer & Public Routes
app.use('/api/categories', require('./routes/customer/category.routes'));
app.use('/api/books', require('./routes/customer/book.routes'));
app.use('/api/cart', require('./routes/customer/cart.routes'));
app.use('/api/addresses', require('./routes/customer/address.routes'));
app.use('/api/orders', require('./routes/customer/order.routes'));

app.use('/api/flash-sales', require('./routes/customer/flash-sale.routes'));

// Admin Routes
app.use('/api/admin/flash-sales', verifyToken, requireAdmin, require('./routes/admin/flash-sale.routes'));
app.use('/api/admin/categories', verifyToken, requireAdmin, require('./routes/admin/category.routes'));
app.use('/api/admin/authors', verifyToken, requireAdmin, require('./routes/admin/author.routes'));
app.use('/api/admin/publishers', verifyToken, requireAdmin, require('./routes/admin/publisher.routes'));
app.use('/api/admin/suppliers', verifyToken, requireAdmin, require('./routes/admin/supplier.routes'));
app.use('/api/admin/books', verifyToken, requireAdmin, require('./routes/admin/book.routes'));
app.use('/api/admin/orders', verifyToken, requireAdmin, require('./routes/admin/order.routes'));
app.use('/api/admin', verifyToken, requireAdmin, require('./routes/admin/inventory.routes'));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack || err);
    const dbCode = err.original?.code || err.parent?.code;
    if (dbCode === '23P01') { err.status = 409; err.message = 'Thời gian trùng với một chương trình Flash Sale đã bật.'; }
    if (['23503', '23001'].includes(dbCode) && !err.status) { err.status = 409; err.message = 'Dữ liệu đang được tham chiếu và không thể xóa.'; }
    const status = err.status || err.statusCode || 500;
    const responseBody = {
        message: err.message || 'Đã có lỗi xảy ra',
        error: err.message
    };
    if (err.outOfStockItems) {
        responseBody.out_of_stock_items = err.outOfStockItems;
    }
    if (err.code) responseBody.code = err.code;
    if (err.priceChanges) responseBody.price_changes = err.priceChanges;
    res.status(status).json(responseBody);
});

module.exports = app;
