const express = require("express");
const router = express.Router();
const student = require("../controllers/student.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

router.use(requireAuth, requireRole("STUDENT"));

router.get("/attendance", student.myAttendance);

module.exports = router;
