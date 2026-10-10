const Author = require('../../models/Author');

exports.getAll = async (req, res) => {
    try {
        const authors = await Author.findAll({
            order: [['author_id', 'ASC']]
        });
        res.json(authors);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const author = await Author.findByPk(req.params.id);
        if (!author) return res.status(404).json({ message: 'Không tìm thấy tác giả' });
        res.json(author);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { author_name, bio } = req.body;
        if (!author_name) return res.status(400).json({ message: 'Tên tác giả không được để trống' });
        
        const author = await Author.create({ author_name, bio });
        res.status(201).json(author);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Tên tác giả đã tồn tại' });
        }
        res.status(400).json({ message: 'Lỗi tạo tác giả', error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const author = await Author.findByPk(req.params.id);
        if (!author) return res.status(404).json({ message: 'Không tìm thấy tác giả' });

        const { author_name, bio } = req.body;
        await author.update({ author_name, bio });
        res.json(author);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Tên tác giả đã tồn tại' });
        }
        res.status(400).json({ message: 'Lỗi cập nhật tác giả', error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const author = await Author.findByPk(req.params.id);
        if (!author) return res.status(404).json({ message: 'Không tìm thấy tác giả' });

        await author.destroy();
        res.json({ message: 'Đã xóa tác giả thành công' });
    } catch (error) {
        const errStr = error.toString().toLowerCase();
        if (error.name === 'SequelizeForeignKeyConstraintError' || errStr.includes('foreign key') || errStr.includes('violate') || errStr.includes('23503')) {
            return res.status(409).json({ message: 'Từ chối xóa: Tác giả này đang có sách trong hệ thống.' });
        }
        res.status(500).json({ message: 'Hệ thống gặp sự cố khi xóa dữ liệu: ' + error.message });
    }
};
