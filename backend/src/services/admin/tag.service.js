const { sequelize } = require('../../config/database');
const { Tag, BookTag } = require('../../models/associations');

// 3 tag cố định của hệ thống
const SYSTEM_TAGS = [
    { tag_name: 'Sách mới',  color: '#0d6efd', display_order: 1 },
    { tag_name: 'Độc quyền', color: '#c92127', display_order: 2 },
    { tag_name: 'Giới hạn',  color: '#d97706', display_order: 3 }
];

function fail(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    throw err;
}

class TagService {
    async ensureSystemTags() {
        const allowedNames = SYSTEM_TAGS.map(t => t.tag_name);
        // Xóa mọi tag ngoài 3 tag chuẩn để không có tag lạ
        await Tag.destroy({
            where: sequelize.where(
                sequelize.fn('lower', sequelize.col('tag_name')),
                { [require('sequelize').Op.notIn]: allowedNames.map(n => n.toLowerCase()) }
            )
        });
        for (const item of SYSTEM_TAGS) {
            const existing = await Tag.findOne({
                where: sequelize.where(
                    sequelize.fn('lower', sequelize.col('tag_name')),
                    item.tag_name.toLowerCase()
                )
            });
            if (!existing) {
                await Tag.create({ ...item, is_active: true });
            } else if (existing.display_order !== item.display_order || !existing.is_active) {
                await existing.update({ display_order: item.display_order, is_active: true });
            }
        }
    }

    async getAll() {
        await this.ensureSystemTags();
        return Tag.findAll({
            attributes: {
                include: [[
                    sequelize.literal('(SELECT COUNT(*)::int FROM book_tag bt WHERE bt.tag_id = "Tag"."tag_id")'),
                    'book_count'
                ]]
            },
            order: [['display_order', 'ASC'], ['tag_id', 'ASC']]
        });
    }

    /**
     * Gán lại tag cho một cuốn sách (chỉ cho phép chọn trong 3 tag cố định)
     */
    async setBookTags(bookId, tagIds, transaction) {
        if (!Array.isArray(tagIds)) return;
        const ids = [...new Set(tagIds.map(Number))].filter(n => Number.isInteger(n) && n > 0);

        if (ids.length) {
            const found = await Tag.count({ where: { tag_id: ids }, transaction });
            if (found !== ids.length) fail('Một số tag không hợp lệ');
        }

        await BookTag.destroy({ where: { book_id: bookId }, transaction });
        if (ids.length) {
            await BookTag.bulkCreate(ids.map(tag_id => ({ book_id: bookId, tag_id })), { transaction });
        }
    }
}

module.exports = new TagService();
