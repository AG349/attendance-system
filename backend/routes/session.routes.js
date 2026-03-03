const express = require("express");
const router = express.Router();
const session = require("../controllers/session.controller");
const { requireAuth } = require("../middleware/auth.middleware");

router.post("/start", requireAuth, session.start);
router.post("/end", requireAuth, session.end);
router.get("/active/:classId", session.active);

module.exports = router;