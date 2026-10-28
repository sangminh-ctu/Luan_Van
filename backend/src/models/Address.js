const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Address = sequelize.define('Address', {
    address_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    recipient_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    recipient_phone: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    province: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    district: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    ward: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    street_detail: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'address',
    timestamps: false
});

module.exports = Address;
