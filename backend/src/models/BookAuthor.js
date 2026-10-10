const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BookAuthor = sequelize.define('BookAuthor', {
    book_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    author_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING(30),
        primaryKey: true, 
        defaultValue: 'author'
    }
}, {
    tableName: 'book_author',
    timestamps: false
});

module.exports = BookAuthor;
