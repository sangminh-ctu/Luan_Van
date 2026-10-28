const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Book = sequelize.define('Book', {
    book_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    isbn: { type: DataTypes.STRING(20), unique: true },
    cover_type: { type: DataTypes.STRING(50) },
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    discount_percent: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    current_price: { type: DataTypes.DECIMAL(12, 2) },
    description: { type: DataTypes.TEXT },
    publication_year: { type: DataTypes.INTEGER },
    page_count: { type: DataTypes.INTEGER },
    weight: { type: DataTypes.DECIMAL(6, 2) },
    length: { type: DataTypes.DECIMAL(6, 2) },
    width: { type: DataTypes.DECIMAL(6, 2) },
    height: { type: DataTypes.DECIMAL(6, 2) },
    category_id: { type: DataTypes.INTEGER, allowNull: false },
    publisher_id: { type: DataTypes.INTEGER, allowNull: true },
    supplier_id: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'book',
    timestamps: false
});

module.exports = Book;