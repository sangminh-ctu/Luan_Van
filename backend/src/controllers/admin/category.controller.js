const Category = require('../../models/Category');

exports.getAll = async (req, res) => {
    try {
        const categories = await Category.findAll({
            order: [['category_id', 'ASC']]
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) return res.status(404).json({ message: 'Không tìm thấy thể loại' });
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { category_name, parent_category_id } = req.body;
        if (!category_name) return res.status(400).json({ message: 'Tên thể loại không được để trống' });
        
        const category = await Category.create({ category_name, parent_category_id });
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: 'Lỗi tạo thể loại', error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) return res.status(404).json({ message: 'Không tìm thấy thể loại' });

        const { category_name, parent_category_id } = req.body;
        await category.update({ category_name, parent_category_id });
        res.json(category);
    } catch (error) {
        res.status(400).json({ message: 'Lỗi cập nhật thể loại', error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) return res.status(404).json({ message: 'Không tìm thấy thể loại' });

        await category.destroy();
        res.json({ message: 'Đã xóa thể loại thành công' });
    } catch (error) {
        const errStr = error.toString().toLowerCase();
        if (error.name === 'SequelizeForeignKeyConstraintError' || errStr.includes('foreign key') || errStr.includes('violate') || errStr.includes('23503')) {
            return res.status(409).json({ message: 'Từ chối xóa: Thể loại này đang chứa sách hoặc danh mục con bên trong.' });
        }
        res.status(500).json({ message: 'Hệ thống gặp sự cố khi xóa dữ liệu: ' + error.message });
    }
};
