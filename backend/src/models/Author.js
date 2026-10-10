const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Author = sequelize.define('Author', {
    author_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    author_name: { type: DataTypes.STRING(150), allowNull: false },
    bio: { type: DataTypes.TEXT }
}, {
    tableName: 'author',
    timestamps: false
});

module.exports = Author;