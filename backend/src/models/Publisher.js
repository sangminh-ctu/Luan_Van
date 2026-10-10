const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Publisher = sequelize.define('Publisher', {
    publisher_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    publisher_name: { type: DataTypes.STRING(150), allowNull: false },
    address: { type: DataTypes.STRING(255) }
}, {
    tableName: 'publisher',
    timestamps: false
});

module.exports = Publisher;
