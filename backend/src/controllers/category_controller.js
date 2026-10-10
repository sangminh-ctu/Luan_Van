const Category = require('../models/Category');

// [GET] Lấy toàn bộ danh mục
exports.getAllCategories = async (req, res, next) => {
    try {
        const categories = await Category.findAll();
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        next(error); // Đẩy lỗi về cho hàm xử lý lỗi ở app.js
    }
};

// [POST] Tạo danh mục mới
exports.createCategory = async (req, res, next) => {
    try {
        const { category_name, parent_category_id } = req.body;
        
        if (!category_name) {
            return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc' });
        }

        const newCategory = await Category.create({
            category_name,
            parent_category_id: parent_category_id || null
        });

        res.status(201).json({ success: true, message: 'Tạo thành công!', data: newCategory });
    } catch (error) {
        next(error);
    }
};