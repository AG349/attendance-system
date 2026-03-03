const db = require("../config/db");

// teacher sees sessions they taught
exports.mySessions = (req, res) => {
  const teacherId = req.user.teacher_id;
  db.query(
    `SELECT s.*, c.class_name
     FROM sessions s
     JOIN classes c ON c.id = s.class_id
     WHERE s.teacher_id=?
     ORDER BY s.start_time DESC`,
    [teacherId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, sessions: rows });
    }
  );
};

// teacher sees attendance of a session
exports.sessionAttendance = (req, res) => {
  const teacherId = req.user.teacher_id;
  const { session_id } = req.params;

  db.query(
    "SELECT * FROM sessions WHERE id=? AND teacher_id=?",
    [session_id, teacherId],
    (err, srows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!srows.length) return res.status(403).json({ success: false, error: "Not your session" });

      db.query(
        `SELECT a.*, st.name AS student_name
         FROM attendance a
         LEFT JOIN students st ON st.student_id = a.student_id
         WHERE a.session_id=?
         ORDER BY a.check_in_time DESC`,
        [session_id],
        (err2, arows) => {
          if (err2) return res.status(500).json({ success: false, error: err2.message });
          res.json({ success: true, attendance: arows });
        }
      );
    }
  );
};
