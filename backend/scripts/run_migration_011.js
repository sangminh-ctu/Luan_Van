const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
  quiet: true,
});
const { sequelize } = require("../src/config/database");
(async () => {
  try {
    await sequelize.transaction((transaction) =>
      sequelize.query(
        fs.readFileSync(
          path.join(__dirname, "../../database/migrations/011_membership.sql"),
          "utf8",
        ),
        { transaction },
      ),
    );
    console.log(
      "Migration 011 hoàn tất: hạng thành viên và điều kiện voucher. Mã cũ không bị giới hạn hạng.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
