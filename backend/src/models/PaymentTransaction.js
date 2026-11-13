const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
module.exports = sequelize.define(
  "PaymentTransaction",
  {
    payment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    reference: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    provider: DataTypes.STRING(20),
    amount: DataTypes.DECIMAL(14, 2),
    currency: DataTypes.STRING(3),
    status: DataTypes.STRING(20),
    merchant_code: DataTypes.STRING(32),
    provider_transaction_no: DataTypes.STRING(32),
    create_date: DataTypes.STRING(14),
    payment_url: DataTypes.TEXT,
    expires_at: DataTypes.DATE,
    created_at: DataTypes.DATE,
    paid_at: DataTypes.DATE,
    last_checked_at: DataTypes.DATE,
    response_code: DataTypes.STRING(10),
    transaction_status: DataTypes.STRING(10),
    review_reason: DataTypes.STRING(255),
  },
  { tableName: "payment_transaction", timestamps: false },
);
