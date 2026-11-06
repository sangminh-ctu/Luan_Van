const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BookTag = sequelize.define('BookTag', {
    book_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    tag_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false }
}, {
    tableName: 'book_tag',
    timestamps: false
});

module.exports = BookTag;
