const express = require('express');
const router = express.Router();
const publisherController = require('../../controllers/admin/publisher.controller');

router.get('/', publisherController.getAll);
router.get('/:id', publisherController.getById);
router.post('/', publisherController.create);
router.put('/:id', publisherController.update);
router.delete('/:id', publisherController.delete);

module.exports = router;
