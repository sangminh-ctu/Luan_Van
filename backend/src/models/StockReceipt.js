const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockReceipt = sequelize.define('StockReceipt', {
    receipt_id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    receipt_code: { 
        type: DataTypes.STRING(50), 
        allowNull: false, 
        unique: true 
    },
    type: { 
        type: DataTypes.STRING(20), 
        allowNull: false,
        validate: {
            isIn: [['import', 'export']]
        }
    },
    supplier_name: { 
        type: DataTypes.STRING(255), 
        allowNull: true 
    },
    note: { 
        type: DataTypes.STRING(500), 
        allowNull: true 
    },
    cancel_reason: { 
        type: DataTypes.STRING(500), 
        allowNull: true 
    },
    created_date: { 
        type: DataTypes.DATE, 
        allowNull: false, 
        defaultValue: DataTypes.NOW 
    },
    total_cost: { 
        type: DataTypes.DECIMAL(14, 2), 
        allowNull: false, 
        defaultValue: 0 
    },
    status: { 
        type: DataTypes.STRING(20), 
        allowNull: false, 
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'completed', 'cancelled']]
        }
    }
}, {
    tableName: 'stock_receipt',
    timestamps: false
});

module.exports = StockReceipt;
