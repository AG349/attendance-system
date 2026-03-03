const db = require("../config/db");

// student sees THEIR attendance history
exports.myAttendance = (req, res) => {
  const studentTableId = req.user.student_id; // users.student_id -> students.id

  db.query("SELECT student_id FROM students WHERE id=?", [studentTableId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!rows.length) return res.status(400).json({ success: false, error: "Student record missing" });

    const studentIdString = rows[0].student_id;

    db.query(
      `SELECT a.*, s.start_time, s.end_time, c.class_name
       FROM attendance a
       JOIN sessions s ON s.id = a.session_id
       JOIN classes c ON c.id = s.class_id
       WHERE a.student_id=?
       ORDER BY s.start_time DESC`,
      [studentIdString],
      (err2, arows) => {
        if (err2) return res.status(500).json({ success: false, error: err2.message });
        res.json({ success: true, attendance: arows });
      }
    );
  });
};
