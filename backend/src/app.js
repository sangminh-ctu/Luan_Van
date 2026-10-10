const { verifyToken } = require('./middlewares/auth.middleware');
const { requireAdmin } = require('./middlewares/role.middleware');
const express = require('express');
const cors = require('cors');

const app = express();
// Khá»Ÿi táº¡o cÃ¡c má»‘i quan há»‡ Database
require('./models/associations');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Backend Ä‘ang cháº¡y' });
});

// Admin Routes (Giai đoạn 1: Category, Author, Publisher)
app.use('/api/admin/categories', verifyToken, requireAdmin, require('./routes/admin/category.routes'));
app.use('/api/admin/authors', verifyToken, requireAdmin, require('./routes/admin/author.routes'));
app.use('/api/admin/publishers', verifyToken, requireAdmin, require('./routes/admin/publisher.routes'));

// Routes sáº½ Ä‘Äƒng kÃ½ 
// app.use('/api/books', require('./routes/book.routes'));
app.use('/api/categories', require('./routes/category_routes'));
app.use('/api/books', require('./routes/book_routes'));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'ÄÃ£ cÃ³ lá»—i xáº£y ra', error: err.message });
});

app.use('/api/auth', require('./routes/auth.routes'));

module.exports = app;


