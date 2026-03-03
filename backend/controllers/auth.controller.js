const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function signToken(userRow) {
  return jwt.sign(
    {
      id: userRow.id,
      email: userRow.email,
      role: userRow.role,
      teacher_id: userRow.teacher_id || null,
      student_id: userRow.student_id || null
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Create default admin if missing
exports.ensureDefaultAdmin = () => {
  const adminEmail = "admin";
  const adminPassword = "Arnab@040207";

  db.query("SELECT id FROM users WHERE role='ADMIN' AND email=? LIMIT 1", [adminEmail], (err, rows) => {
    if (err) {
      console.error("❌ Admin check failed:", err.message);
      return;
    }
    if (rows.length) {
      console.log("✅ Default admin exists");
      return;
    }

    const hash = bcrypt.hashSync(adminPassword, 10);
    db.query(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'ADMIN')",
      [adminEmail, hash],
      (err2) => {
        if (err2) {
          console.error("❌ Default admin create failed:", err2.message);
          return;
        }
        console.log("✅ Default admin created (email: admin)");
      }
    );
  });
};

// Email/password login
exports.login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: "email and password required" });

  db.query("SELECT * FROM users WHERE email=? LIMIT 1", [email], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!rows.length) return res.status(401).json({ success: false, error: "Invalid credentials" });

    const user = rows[0];
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, error: "Invalid credentials" });

    const token = signToken(user);
    res.json({ success: true, token, role: user.role });
  });
};

exports.me = (req, res) => {
  res.json({ success: true, user: req.user });
};
