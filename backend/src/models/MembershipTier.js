const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
module.exports = sequelize.define(
  "MembershipTier",
  {
    tier_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tier_code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    tier_name: { type: DataTypes.STRING(50), allowNull: false },
    level: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    min_spend: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      unique: true,
    },
  },
  { tableName: "membership_tier", timestamps: false },
);
