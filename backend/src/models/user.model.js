const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    user_id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    full_name: { 
        type: DataTypes.STRING(150), 
        allowNull: false 
    },
    email: { 
        type: DataTypes.STRING(150), 
        allowNull: false, 
        unique: true 
    },
    password: { 
        type: DataTypes.STRING(255), 
        allowNull: false 
    },
    phone: { 
        type: DataTypes.STRING(20) 
    },
    role: { 
        type: DataTypes.STRING(20), 
        allowNull: false, 
        defaultValue: 'customer' 
    },
    reward_points_balance: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0 
    },
    created_at: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    tableName: 'users',
    timestamps: false
});

module.exports = User;
