const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Shipment = sequelize.define('Shipment', {
    shipment_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    tracking_code: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    carrier_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    shipping_status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'pending'
    },
    estimated_delivery: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'shipment',
    timestamps: false
});

module.exports = Shipment;
