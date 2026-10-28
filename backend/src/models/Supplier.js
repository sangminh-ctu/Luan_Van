const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Supplier = sequelize.define('Supplier', {
    supplier_id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    supplier_code: { 
        type: DataTypes.STRING(20) 
    },
    supplier_name: { 
        type: DataTypes.STRING(150), 
        allowNull: false 
    },
    contact_person: { 
        type: DataTypes.STRING(100) 
    },
    phone: { 
        type: DataTypes.STRING(20) 
    },
    email: { 
        type: DataTypes.STRING(100) 
    },
    address: { 
        type: DataTypes.STRING(255) 
    },
    note: { 
        type: DataTypes.STRING(255) 
    },
    is_active: { 
        type: DataTypes.BOOLEAN, 
        allowNull: false, 
        defaultValue: true 
    },
    created_at: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    },
    updated_at: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    tableName: 'supplier',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Supplier;
