const catalogService = require('../../services/customer/catalog.service');

exports.getBooks = async (req, res, next) => {
    try {
        const result = await catalogService.getBooks(req.query);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

exports.getBookById = async (req, res, next) => {
    try {
        const bookId = parseInt(req.params.id, 10);
        if (isNaN(bookId)) {
            return res.status(400).json({ message: 'ID sách không hợp lệ' });
        }
        const book = await catalogService.getBookById(bookId);
        res.status(200).json(book);
    } catch (error) {
        next(error);
    }
};

exports.getRelatedBooks = async (req, res, next) => {
    try {
        const bookId = parseInt(req.params.id, 10);
        const categoryId = parseInt(req.query.category_id, 10);
        const limit = parseInt(req.query.limit, 10) || 10;
        if (isNaN(bookId) || isNaN(categoryId)) {
            return res.status(400).json({ message: 'Tham số không hợp lệ' });
        }
        const related = await catalogService.getRelatedBooks(bookId, categoryId, limit);
        res.status(200).json(related);
    } catch (error) {
        next(error);
    }
};
