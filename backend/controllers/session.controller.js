const db = require("../config/db");

exports.start = (req, res) => {
  // Only teachers/admin should start sessions
  if (req.user.role !== "TEACHER" && req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const class_id = Number(req.body.class_id || 1);
  const teacher_id = req.user.teacher_id;

  if (!teacher_id) {
    return res.status(400).json({ success: false, error: "Teacher not linked to this account" });
  }

  db.query(
    "INSERT INTO class_sessions (class_id, teacher_id, started_at, active) VALUES (?, ?, NOW(), 1)",
    [class_id, teacher_id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, session_id: result.insertId });
    }
  );
};

exports.end = (req, res) => {
  if (req.user.role !== "TEACHER" && req.user.role !== "ADMIN") {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  const session_id = Number(req.body.session_id);
  if (!session_id) return res.status(400).json({ success: false, error: "session_id required" });

  db.query(
    "UPDATE class_sessions SET active=0, ended_at=NOW() WHERE id=?",
    [session_id],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: "Session ended" });
    }
  );
};

exports.active = (req, res) => {
  const classId = Number(req.params.classId);

  db.query(
    "SELECT * FROM class_sessions WHERE class_id=? AND active=1 ORDER BY id DESC LIMIT 1",
    [classId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!rows.length) return res.json({ active: false });
      res.json({ active: true, session: { session_id: rows[0].id } });
    }
  );
};