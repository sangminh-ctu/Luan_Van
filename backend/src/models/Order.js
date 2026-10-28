const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
    order_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    order_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    address_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    voucher_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    order_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    subtotal: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false
    },
    shipping_fee: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    voucher_discount_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    points_discount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    total_amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false
    },
    payment_method: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    payment_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'pending'
    },
    order_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'processing'
    }
}, {
    tableName: 'orders',
    timestamps: false
});

module.exports = Order;
