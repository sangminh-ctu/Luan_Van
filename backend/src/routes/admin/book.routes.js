const express = require('express');
const router = express.Router();
const bookController = require('../../controllers/admin/book.controller');
const uploadBookImage = require('../../middlewares/upload.middleware');

// 1. Upload ảnh sách riêng biệt
router.post('/upload-image', uploadBookImage.single('image'), bookController.uploadImage);

// 2. CRUD sách
router.get('/', bookController.getAllBooks);
router.get('/:id', bookController.getBookById);
router.post('/', bookController.createBook);
router.put('/:id', bookController.updateBook);
router.patch('/:id/toggle-active', bookController.toggleActive);
router.delete('/:id', bookController.deleteBook);

module.exports = router;
