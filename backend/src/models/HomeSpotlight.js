const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HomeSpotlight = sequelize.define('HomeSpotlight', {
    spotlight_id: { type: DataTypes.SMALLINT, primaryKey: true, defaultValue: 1 },
    title: { type: DataTypes.STRING(150), allowNull: false },
    banner_url: DataTypes.STRING(500),
    banner_alt: { type: DataTypes.STRING(200), defaultValue: '' },
    manual_tab_label: { type: DataTypes.STRING(80), defaultValue: 'Tuyển chọn' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'home_spotlight', timestamps: false });

const HomeSpotlightBook = sequelize.define('HomeSpotlightBook', {
    spotlight_id: { type: DataTypes.SMALLINT, primaryKey: true },
    book_id: { type: DataTypes.INTEGER, primaryKey: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'home_spotlight_book', timestamps: false });

const HomeSpotlightCategory = sequelize.define('HomeSpotlightCategory', {
    spotlight_id: { type: DataTypes.SMALLINT, primaryKey: true },
    category_id: { type: DataTypes.INTEGER, primaryKey: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'home_spotlight_category', timestamps: false });

module.exports = { HomeSpotlight, HomeSpotlightBook, HomeSpotlightCategory };
