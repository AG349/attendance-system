const express = require("express");
const router = express.Router();
const teacher = require("../controllers/teacher.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

router.use(requireAuth, requireRole("TEACHER"));

router.get("/sessions", teacher.mySessions);
router.get("/sessions/:session_id/attendance", teacher.sessionAttendance);

module.exports = router;
