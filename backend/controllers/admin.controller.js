const db = require("../config/db");
const bcrypt = require("bcryptjs");

// ------- USERS (create logins) -------
exports.createTeacherLogin = (req, res) => {
  const { teacher_id, email, password } = req.body;
  if (!teacher_id || !email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "teacher_id, email, password required" });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.query(
    "INSERT INTO users (email, password_hash, role, teacher_id) VALUES (?, ?, 'TEACHER', ?)",
    [email, hash, teacher_id],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: "Teacher login created" });
    }
  );
};

exports.createStudentLogin = (req, res) => {
  const { student_table_id, email, password } = req.body; // students.id
  if (!student_table_id || !email || !password) {
    return res
      .status(400)
      .json({ success: false, error: "student_table_id, email, password required" });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.query(
    "INSERT INTO users (email, password_hash, role, student_id) VALUES (?, ?, 'STUDENT', ?)",
    [email, hash, student_table_id],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: "Student login created" });
    }
  );
};

// ✅ list all accounts (NO plaintext passwords, NO hashes exposed)
exports.listUsers = (req, res) => {
  const sql = `
    SELECT
      u.id, u.email, u.role, u.teacher_id, u.student_id, u.created_at,
      t.name AS teacher_name,
      s.name AS student_name,
      s.student_id AS student_code
    FROM users u
    LEFT JOIN teachers t ON t.id = u.teacher_id
    LEFT JOIN students s ON s.id = u.student_id
    ORDER BY u.id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const users = (rows || []).map((r) => {
      let linked = "-";
      if (r.role === "TEACHER") linked = `Teacher: ${r.teacher_name || ("#" + r.teacher_id)}`;
      if (r.role === "STUDENT")
        linked = `Student: ${r.student_name || ("#" + r.student_id)} (${r.student_code || ""})`;
      if (r.role === "ADMIN") linked = "Admin";

      return {
        id: r.id,
        email: r.email,
        role: r.role,
        teacher_id: r.teacher_id,
        student_id: r.student_id,
        linked,
        created_at: r.created_at,
      };
    });

    res.json({ success: true, users });
  });
};

// ✅ reset password (admin sets a new password)
exports.resetUserPassword = (req, res) => {
  const { user_id, new_password } = req.body;
  if (!user_id || !new_password) {
    return res.status(400).json({ success: false, error: "user_id and new_password required" });
  }

  const hash = bcrypt.hashSync(new_password, 10);

  db.query("UPDATE users SET password_hash=? WHERE id=?", [hash, user_id], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!result.affectedRows) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, message: "Password reset successfully" });
  });
};

// ------- TEACHERS -------
exports.listTeachers = (req, res) => {
  db.query("SELECT * FROM teachers ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, teachers: rows });
  });
};

exports.createTeacher = (req, res) => {
  const { name, fingerprint_id, rfid_card } = req.body;
  if (!name) return res.status(400).json({ success: false, error: "name required" });

  db.query(
    "INSERT INTO teachers (name, fingerprint_id, rfid_card) VALUES (?, ?, ?)",
    [name, fingerprint_id || null, rfid_card || null],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, teacher_id: result.insertId });
    }
  );
};

exports.updateTeacher = (req, res) => {
  const { id } = req.params;
  const { name, fingerprint_id, rfid_card } = req.body;

  db.query(
    "UPDATE teachers SET name=?, fingerprint_id=?, rfid_card=? WHERE id=?",
    [name, fingerprint_id || null, rfid_card || null, id],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: "Teacher updated" });
    }
  );
};

exports.deleteTeacher = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM users WHERE teacher_id=?", [id], (err1) => {
    if (err1) return res.status(500).json({ success: false, error: err1.message });

    db.query("DELETE FROM teachers WHERE id=?", [id], (err2) => {
      if (err2) return res.status(500).json({ success: false, error: err2.message });
      res.json({ success: true, message: "Teacher deleted" });
    });
  });
};

// ------- STUDENTS -------
exports.listStudents = (req, res) => {
  db.query("SELECT * FROM students ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, students: rows });
  });
};

exports.createStudent = (req, res) => {
  const { student_id, name, class_id } = req.body;
  if (!student_id || !name)
    return res.status(400).json({ success: false, error: "student_id and name required" });

  db.query(
    "INSERT INTO students (student_id, name, class_id) VALUES (?, ?, ?)",
    [student_id, name, class_id || null],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, student_table_id: result.insertId });
    }
  );
};

exports.updateStudent = (req, res) => {
  const { id } = req.params;
  const { student_id, name, class_id } = req.body;

  db.query(
    "UPDATE students SET student_id=?, name=?, class_id=? WHERE id=?",
    [student_id, name, class_id || null, id],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: "Student updated" });
    }
  );
};

exports.deleteStudent = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM users WHERE student_id=?", [id], (err1) => {
    if (err1) return res.status(500).json({ success: false, error: err1.message });

    db.query("DELETE FROM students WHERE id=?", [id], (err2) => {
      if (err2) return res.status(500).json({ success: false, error: err2.message });
      res.json({ success: true, message: "Student deleted" });
    });
  });
};

// ------- CLASSES -------
exports.listClasses = (req, res) => {
  db.query("SELECT * FROM classes ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, classes: rows });
  });
};

exports.createClass = (req, res) => {
  const { class_name } = req.body;
  if (!class_name) return res.status(400).json({ success: false, error: "class_name required" });

  db.query("INSERT INTO classes (class_name) VALUES (?)", [class_name], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, class_id: result.insertId });
  });
};

exports.deleteClass = (req, res) => {
  db.query("DELETE FROM classes WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Class deleted" });
  });
};

// ------- SUBJECTS -------
exports.listSubjects = (req, res) => {
  db.query("SELECT * FROM subjects ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, subjects: rows });
  });
};

exports.createSubject = (req, res) => {
  const { subject_name } = req.body;
  if (!subject_name) return res.status(400).json({ success: false, error: "subject_name required" });

  db.query("INSERT INTO subjects (subject_name) VALUES (?)", [subject_name], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, subject_id: result.insertId });
  });
};

exports.deleteSubject = (req, res) => {
  db.query("DELETE FROM subjects WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Subject deleted" });
  });
};

// ------- TEACHER_SUBJECTS -------
exports.assignTeacherSubject = (req, res) => {
  const { teacher_id, subject_id } = req.body;
  if (!teacher_id || !subject_id)
    return res.status(400).json({ success: false, error: "teacher_id and subject_id required" });

  db.query(
    "INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)",
    [teacher_id, subject_id],
    (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, message: "Assigned teacher to subject" });
    }
  );
};

exports.unassignTeacherSubject = (req, res) => {
  db.query("DELETE FROM teacher_subjects WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Unassigned" });
  });
};

// ------- ROUTINE -------
exports.listRoutine = (req, res) => {
  db.query(
    `SELECT cr.*, c.class_name, s.subject_name, t.name AS teacher_name
     FROM class_routine cr
     JOIN classes c ON c.id = cr.class_id
     JOIN subjects s ON s.id = cr.subject_id
     JOIN teachers t ON t.id = cr.teacher_id
     ORDER BY cr.id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, routine: rows });
    }
  );
};

exports.createRoutine = (req, res) => {
  const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time } = req.body;
  if (!class_id || !subject_id || !teacher_id || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({
      success: false,
      error: "class_id, subject_id, teacher_id, day_of_week, start_time, end_time required",
    });
  }

  db.query(
    "INSERT INTO class_routine (class_id, subject_id, teacher_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)",
    [class_id, subject_id, teacher_id, day_of_week, start_time, end_time],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, routine_id: result.insertId });
    }
  );
};

// ✅ NEW: update routine
exports.updateRoutine = (req, res) => {
  const { id } = req.params;
  const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time } = req.body;

  if (!class_id || !subject_id || !teacher_id || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({
      success: false,
      error: "class_id, subject_id, teacher_id, day_of_week, start_time, end_time required",
    });
  }

  db.query(
    "UPDATE class_routine SET class_id=?, subject_id=?, teacher_id=?, day_of_week=?, start_time=?, end_time=? WHERE id=?",
    [class_id, subject_id, teacher_id, day_of_week, start_time, end_time, id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!result.affectedRows) return res.status(404).json({ success: false, error: "Routine not found" });
      res.json({ success: true, message: "Routine updated" });
    }
  );
};

exports.deleteRoutine = (req, res) => {
  db.query("DELETE FROM class_routine WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, message: "Routine deleted" });
  });
};