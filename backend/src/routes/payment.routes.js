const router = require("express").Router();
const { verifyToken } = require("../middlewares/auth.middleware");
const payments = require("../services/payment.service");
const gateway = require("../services/vnpay.gateway");

router.get("/config", (req, res) => {
  const cfg = gateway.config();
  res.json({
    vnpay_enabled: cfg.enabled,
    min_amount: 5000,
    reservation_minutes: cfg.minutes,
  });
});
// Unsigned browser claims never change payment state. The opt-in local Sandbox
// fallback verifies exactly the same provider signature, amount and locks as IPN.
router.get("/return", async (req, res) => {
  const target = new URL("/payment/vnpay-return", gateway.config().frontendUrl);
  if (
    typeof req.query.vnp_TxnRef === "string" &&
    /^[a-f0-9]{32}$/.test(req.query.vnp_TxnRef)
  )
    target.searchParams.set("reference", req.query.vnp_TxnRef);
  try {
    target.searchParams.set(
      "return_status",
      await payments.handleReturn(req.query),
    );
  } catch {
    target.searchParams.set("return_status", "unavailable");
  }
  res.redirect(303, target.toString());
});
router.get("/ipn", async (req, res) => {
  try {
    res.json(await payments.ipn(req.query));
  } catch {
    res.json({ RspCode: "99", Message: "Unable to confirm payment" });
  }
});
router.use(verifyToken);
router.get("/:reference/status", async (req, res, next) => {
  try {
    res.json(await payments.status(req.params.reference, req.user));
  } catch (error) {
    next(error);
  }
});
router.post("/:reference/reconcile", async (req, res, next) => {
  try {
    res.json(await payments.reconcile(req.params.reference, req.user));
  } catch (error) {
    next(error);
  }
});
router.post("/orders/:id/link", async (req, res, next) => {
  try {
    res.json(await payments.paymentLink(req.params.id, req.user, req.ip));
  } catch (error) {
    next(error);
  }
});
module.exports = router;
