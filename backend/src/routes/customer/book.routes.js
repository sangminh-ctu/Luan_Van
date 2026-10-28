const express = require('express');
const router = express.Router();
const bookController = require('../../controllers/customer/book.controller');

router.get('/', bookController.getBooks);
router.get('/filters', bookController.getFilterOptions);
router.get('/:id', bookController.getBookById);
router.get('/:id/related', bookController.getRelatedBooks);

module.exports = router;
