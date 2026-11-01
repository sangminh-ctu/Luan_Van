const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
module.exports = sequelize.define(
  "FlashSale",
  {
    flash_sale_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    start_at: { type: DataTypes.DATE, allowNull: false },
    end_at: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "draft",
    },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "flash_sale",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);
