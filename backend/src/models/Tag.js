const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Tag = sequelize.define('Tag', {
    tag_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tag_name: { type: DataTypes.STRING(50), allowNull: false },
    color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#0d6efd' },
    display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'tag',
    timestamps: false
});

module.exports = Tag;
