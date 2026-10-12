const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Inventory = sequelize.define('Inventory', {
    inventory_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    book_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    stock_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_updated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'inventory',
    timestamps: false
});

module.exports = Inventory;
