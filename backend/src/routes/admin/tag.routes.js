const express = require('express');
const router = express.Router();
const tagService = require('../../services/admin/tag.service');

router.get('/', async (req, res) => {
    try {
        res.json(await tagService.getAll());
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Lỗi tải danh sách tag: ' + error.message });
    }
});

module.exports = router;
