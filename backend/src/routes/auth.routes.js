const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/admin/login', authController.adminLogin);
router.get('/me', verifyToken, authController.me);

// TEMP - xóa sau khi test
router.get('/admin-only', verifyToken, requireAdmin, (req, res) => {
    res.status(200).json({ message: "Chào mừng Admin!" });
});

module.exports = router;
