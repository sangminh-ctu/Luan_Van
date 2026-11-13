const path = require("node:path"),
  fs = require("node:fs");
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
          path.join(
            __dirname,
            "../../database/migrations/013_vnpay_signed_return.sql",
          ),
          "utf8",
        ),
        { transaction },
      ),
    );
    console.log(
      "Migration 013 hoàn tất: phân biệt callback Return đã xác minh.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
