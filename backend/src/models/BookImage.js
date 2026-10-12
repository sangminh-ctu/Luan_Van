const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BookImage = sequelize.define('BookImage', {
    image_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    book_id: { type: DataTypes.INTEGER, allowNull: false },
    image_url: { type: DataTypes.STRING(500), allowNull: false },
    is_primary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // embedding_vector hỗ trợ pgvector, tạm thời map TEXT hoặc để trống khi chưa xử lý AI
    embedding_vector: { type: DataTypes.TEXT, allowNull: true },
    model_version: { type: DataTypes.STRING(50), allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'book_image',
    timestamps: false
});

module.exports = BookImage;
