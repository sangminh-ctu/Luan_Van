const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockReceiptDetail = sequelize.define('StockReceiptDetail', {
    receipt_id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        allowNull: false 
    },
    book_id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        allowNull: false 
    },
    quantity: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        validate: {
            min: 1
        }
    },
    unit_cost: { 
        type: DataTypes.DECIMAL(12, 2), 
        allowNull: true,
        validate: {
            min: 0
        }
    }
}, {
    tableName: 'stock_receipt_detail',
    timestamps: false
});

module.exports = StockReceiptDetail;
