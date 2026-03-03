const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes"); // you'll add this next
const { ensureDefaultAdmin } = require("./controllers/auth.controller");

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "../public")));

// Health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend running" });
});

// Auth
app.use("/api/auth", authRoutes);

// Admin (protected inside admin.routes.js)
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  ensureDefaultAdmin(); // auto-create admin if missing
});
