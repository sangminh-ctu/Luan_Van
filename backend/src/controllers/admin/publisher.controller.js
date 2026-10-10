const Publisher = require('../../models/Publisher');

exports.getAll = async (req, res) => {
    try {
        const publishers = await Publisher.findAll({
            order: [['publisher_id', 'ASC']]
        });
        res.json(publishers);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const publisher = await Publisher.findByPk(req.params.id);
        if (!publisher) return res.status(404).json({ message: 'Không tìm thấy nhà xuất bản' });
        res.json(publisher);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { publisher_name, address } = req.body;
        if (!publisher_name) return res.status(400).json({ message: 'Tên nhà xuất bản không được để trống' });
        
        const publisher = await Publisher.create({ publisher_name, address });
        res.status(201).json(publisher);
    } catch (error) {
        res.status(400).json({ message: 'Lỗi tạo nhà xuất bản', error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const publisher = await Publisher.findByPk(req.params.id);
        if (!publisher) return res.status(404).json({ message: 'Không tìm thấy nhà xuất bản' });

        const { publisher_name, address } = req.body;
        await publisher.update({ publisher_name, address });
        res.json(publisher);
    } catch (error) {
        res.status(400).json({ message: 'Lỗi cập nhật nhà xuất bản', error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const publisher = await Publisher.findByPk(req.params.id);
        if (!publisher) return res.status(404).json({ message: 'Không tìm thấy nhà xuất bản' });

        await publisher.destroy();
        res.json({ message: 'Đã xóa nhà xuất bản thành công' });
    } catch (error) {
        const errStr = error.toString().toLowerCase();
        if (error.name === 'SequelizeForeignKeyConstraintError' || errStr.includes('foreign key') || errStr.includes('violate') || errStr.includes('23503')) {
            return res.status(409).json({ message: 'Từ chối xóa: Nhà xuất bản này đang được gán cho sách trong hệ thống.' });
        }
        res.status(500).json({ message: 'Hệ thống gặp sự cố khi xóa dữ liệu: ' + error.message });
    }
};
