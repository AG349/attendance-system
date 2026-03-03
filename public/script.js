console.log("JS LOADED SUCCESSFULLY");
const API_BASE_URL = "/api";

let currentSection = "roleSelection";
let qrScannerInterval = null;
let currentSession = null;
let currentUser = null;
let currentTeacher = null;
let activeClassId = 1;

// Tokens
const ADMIN_TOKEN_KEY = "admin_token";
const TEACHER_TOKEN_KEY = "teacher_token";
const STUDENT_TOKEN_KEY = "student_token";

// =====================================================
// NAVIGATION
// =====================================================
function showSection(sectionId) {
  const sections = [
    "roleSelection",
    "adminLogin",
    "adminDashboard",
    "teacherLogin",
    "teacherDashboard",
    "studentAlternative",
    "studentLogin",
    "studentDashboard",
    "studentCheckIn",
    "qrGunCheckIn",
  ];

  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const target = document.getElementById(sectionId);
  if (target) target.style.display = "block";
  currentSection = sectionId;
}

function showRoleSelection() { showSection("roleSelection"); }
function showAdminLogin() { showSection("adminLogin"); clearAdminStatus(); }
function showAdminDashboard() {
  showSection("adminDashboard");
  adminLoadTeachers();
  adminLoadStudents();
}
function showTeacherLogin() { showSection("teacherLogin"); resetTeacherAuth(); clearTeacherEmailStatus(); }
function showTeacherDashboard() { showSection("teacherDashboard"); loadTeacherDashboard(); }
function showStudentAlternative() { showSection("studentAlternative"); }
function showStudentLogin() { showSection("studentLogin"); clearStudentLoginStatus(); }
function showStudentDashboard() { showSection("studentDashboard"); loadStudentDashboard(); }
function showStudentCheckIn() { showSection("studentCheckIn"); resetStudentForm(); loadActiveSession(); }
function showQRGunCheckIn() { showSection("qrGunCheckIn"); resetQRGunForm(); loadActiveSession(); }

// =====================================================
// TOKEN HELPERS
// =====================================================
function getToken(key) { return localStorage.getItem(key); }
function setToken(key, token) { localStorage.setItem(key, token); }
function clearToken(key) { localStorage.removeItem(key); }


// =====================================================
// TEACHER LOGOUT (FIX)
// =====================================================
function teacherLogout() {
  // clear teacher session/token
  clearTeacherToken();

  // reset runtime state
  currentTeacher = null;
  currentUser = null;
  currentSession = null;

  // stop anything running (safe)
  try { stopQRScanner(); } catch (e) {}

  // go back to home
  showRoleSelection();
}

// Your HTML calls logout(), so make logout an alias:
function logout() {
  teacherLogout();
}

// =====================================================
// ADMIN AUTH + API
// =====================================================
function clearAdminStatus() {
  const el = document.getElementById("adminLoginStatus");
  if (el) { el.className = "status-message"; el.innerHTML = ""; }
}

function getAdminToken() { return getToken(ADMIN_TOKEN_KEY); }
function setAdminToken(token) { setToken(ADMIN_TOKEN_KEY, token); }
function clearAdminToken() { clearToken(ADMIN_TOKEN_KEY); }

async function adminLogin() {
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  const statusEl = document.getElementById("adminLoginStatus");
  statusEl.className = "status-message info";
  statusEl.innerHTML = "Logging in...";

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!data.success) {
      statusEl.className = "status-message error";
      statusEl.innerHTML = "❌ " + (data.error || "Login failed");
      return;
    }

    if (data.role !== "ADMIN") {
      statusEl.className = "status-message error";
      statusEl.innerHTML = "❌ This account is not admin.";
      return;
    }

    setAdminToken(data.token);
    statusEl.className = "status-message success";
    statusEl.innerHTML = "✅ Admin logged in!";
    setTimeout(showAdminDashboard, 350);
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

function adminLogout() {
  clearAdminToken();
  showRoleSelection();
}

function showAdminTab(tabId, btn) {
  document.querySelectorAll(".tab-panel").forEach((p) => (p.style.display = "none"));
  const tab = document.getElementById(tabId);
  if (tab) tab.style.display = "block";

  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

async function adminFetch(url, options = {}) {
  const token = getAdminToken();
  if (!token) {
    alert("Admin not logged in. Please login again.");
    showAdminLogin();
    throw new Error("No admin token");
  }

  const headers = options.headers || {};
  headers["Authorization"] = `Bearer ${token}`;
  headers["Content-Type"] = headers["Content-Type"] || "application/json";

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 || res.status === 403) {
    alert("Admin session expired or forbidden. Login again.");
    adminLogout();
    throw new Error("Unauthorized/Forbidden");
  }
  return data;
}

// =====================================================
// ADMIN - TEACHERS
// =====================================================
async function adminLoadTeachers() {
  const tbody = document.getElementById("teachersTable");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Loading...</td></tr>`;

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/teachers`, { method: "GET" });
    if (!data.success) throw new Error(data.error || "Failed");

    const rows = data.teachers || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-message">No teachers</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((t) => `
      <tr>
        <td>${t.id}</td>
        <td>${escapeHtml(t.name || "")}</td>
        <td>${escapeHtml(t.fingerprint_id || "")}</td>
        <td>${escapeHtml(t.rfid_card || "")}</td>
        <td>
          <button class="btn btn-danger btn-mini" onclick="adminDeleteTeacher(${t.id})">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function adminCreateTeacher() {
  const name = document.getElementById("tName").value.trim();
  const fingerprint_id = document.getElementById("tFp").value.trim();
  const rfid_card = document.getElementById("tRfid").value.trim();
  const statusEl = document.getElementById("tStatus");

  statusEl.className = "status-message info";
  statusEl.innerHTML = "Saving...";

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/teachers`, {
      method: "POST",
      body: JSON.stringify({ name, fingerprint_id, rfid_card }),
    });

    if (!data.success) throw new Error(data.error || "Failed");

    statusEl.className = "status-message success";
    statusEl.innerHTML = `✅ Teacher added (ID: ${data.teacher_id})`;

    document.getElementById("tName").value = "";
    document.getElementById("tFp").value = "";
    document.getElementById("tRfid").value = "";

    adminLoadTeachers();
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

async function adminDeleteTeacher(id) {
  if (!confirm("Delete this teacher? (linked login will also be removed)")) return;
  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/teachers/${id}`, { method: "DELETE" });
    if (!data.success) throw new Error(data.error || "Failed");
    adminLoadTeachers();
  } catch (e) {
    alert("❌ " + e.message);
  }
}

async function adminCreateTeacherLogin() {
  const teacher_id = document.getElementById("tlTeacherId").value.trim();
  const email = document.getElementById("tlEmail").value.trim();
  const password = document.getElementById("tlPassword").value;
  const statusEl = document.getElementById("tlStatus");

  statusEl.className = "status-message info";
  statusEl.innerHTML = "Creating login...";

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/create-teacher-login`, {
      method: "POST",
      body: JSON.stringify({ teacher_id: Number(teacher_id), email, password }),
    });

    if (!data.success) throw new Error(data.error || "Failed");

    statusEl.className = "status-message success";
    statusEl.innerHTML = "✅ " + data.message;

    document.getElementById("tlTeacherId").value = "";
    document.getElementById("tlEmail").value = "";
    document.getElementById("tlPassword").value = "";
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

// =====================================================
// ADMIN - STUDENTS
// =====================================================
async function adminLoadStudents() {
  const tbody = document.getElementById("studentsTable");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Loading...</td></tr>`;

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/students`, { method: "GET" });
    if (!data.success) throw new Error(data.error || "Failed");

    const rows = data.students || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-message">No students</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((s) => `
      <tr>
        <td>${s.id}</td>
        <td>${escapeHtml(s.student_id || "")}</td>
        <td>${escapeHtml(s.name || "")}</td>
        <td>${s.class_id ?? ""}</td>
        <td>
          <button class="btn btn-danger btn-mini" onclick="adminDeleteStudent(${s.id})">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function adminCreateStudent() {
  const student_id = document.getElementById("sStudentId").value.trim();
  const name = document.getElementById("sName").value.trim();
  const class_id = document.getElementById("sClassId").value.trim();
  const statusEl = document.getElementById("sStatus");

  statusEl.className = "status-message info";
  statusEl.innerHTML = "Saving...";

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/students`, {
      method: "POST",
      body: JSON.stringify({ student_id, name, class_id: class_id ? Number(class_id) : null }),
    });

    if (!data.success) throw new Error(data.error || "Failed");

    statusEl.className = "status-message success";
    statusEl.innerHTML = `✅ Student added (Table ID: ${data.student_table_id})`;

    document.getElementById("sStudentId").value = "";
    document.getElementById("sName").value = "";
    document.getElementById("sClassId").value = "";

    adminLoadStudents();
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

async function adminDeleteStudent(id) {
  if (!confirm("Delete this student? (linked login will also be removed)")) return;
  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/students/${id}`, { method: "DELETE" });
    if (!data.success) throw new Error(data.error || "Failed");
    adminLoadStudents();
  } catch (e) {
    alert("❌ " + e.message);
  }
}

async function adminCreateStudentLogin() {
  const student_table_id = document.getElementById("slStudentTableId").value.trim();
  const email = document.getElementById("slEmail").value.trim();
  const password = document.getElementById("slPassword").value;
  const statusEl = document.getElementById("slStatus");

  statusEl.className = "status-message info";
  statusEl.innerHTML = "Creating login...";

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/create-student-login`, {
      method: "POST",
      body: JSON.stringify({ student_table_id: Number(student_table_id), email, password }),
    });

    if (!data.success) throw new Error(data.error || "Failed");

    statusEl.className = "status-message success";
    statusEl.innerHTML = "✅ " + data.message;

    document.getElementById("slStudentTableId").value = "";
    document.getElementById("slEmail").value = "";
    document.getElementById("slPassword").value = "";
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

// =====================================================
// ADMIN - ROUTINE (create/edit/delete/list)
// =====================================================
async function adminLoadRoutine() {
  const tbody = document.getElementById("routineTable");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="empty-message">Loading...</td></tr>`;

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/routine`, { method: "GET" });
    if (!data.success) throw new Error(data.error || "Failed");

    const rows = data.routine || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-message">No routine</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${r.id}</td>
        <td>${escapeHtml(r.class_name || "")} (#${r.class_id})</td>
        <td>${escapeHtml(r.subject_name || "")} (#${r.subject_id})</td>
        <td>${escapeHtml(r.teacher_name || "")} (#${r.teacher_id})</td>
        <td>${escapeHtml(r.day_of_week || "")}</td>
        <td>${escapeHtml(r.start_time || "")}</td>
        <td>${escapeHtml(r.end_time || "")}</td>
        <td>
          <button class="btn btn-danger btn-mini" onclick="adminDeleteRoutine(${r.id})">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-message">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function adminCreateRoutine() {
  const class_id = Number(document.getElementById("rClassId").value.trim());
  const subject_id = Number(document.getElementById("rSubjectId").value.trim());
  const teacher_id = Number(document.getElementById("rTeacherId").value.trim());
  const day_of_week = document.getElementById("rDay").value;
  const start_time = document.getElementById("rStart").value;
  const end_time = document.getElementById("rEnd").value;
  const statusEl = document.getElementById("rStatus");

  statusEl.className = "status-message info";
  statusEl.innerHTML = "Saving...";

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/routine`, {
      method: "POST",
      body: JSON.stringify({ class_id, subject_id, teacher_id, day_of_week, start_time, end_time }),
    });
    if (!data.success) throw new Error(data.error || "Failed");

    statusEl.className = "status-message success";
    statusEl.innerHTML = `✅ Routine added (ID: ${data.routine_id})`;

    document.getElementById("rClassId").value = "";
    document.getElementById("rSubjectId").value = "";
    document.getElementById("rTeacherId").value = "";
    document.getElementById("rStart").value = "";
    document.getElementById("rEnd").value = "";

    adminLoadRoutine();
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

async function adminUpdateRoutine() {
  const id = Number(document.getElementById("ruId").value.trim());
  const class_id = Number(document.getElementById("ruClassId").value.trim());
  const subject_id = Number(document.getElementById("ruSubjectId").value.trim());
  const teacher_id = Number(document.getElementById("ruTeacherId").value.trim());
  const day_of_week = document.getElementById("ruDay").value;
  const start_time = document.getElementById("ruStart").value;
  const end_time = document.getElementById("ruEnd").value;
  const statusEl = document.getElementById("ruStatus");

  statusEl.className = "status-message info";
  statusEl.innerHTML = "Updating...";

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/routine/${id}`, {
      method: "PUT",
      body: JSON.stringify({ class_id, subject_id, teacher_id, day_of_week, start_time, end_time }),
    });
    if (!data.success) throw new Error(data.error || "Failed");

    statusEl.className = "status-message success";
    statusEl.innerHTML = "✅ " + data.message;

    adminLoadRoutine();
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

async function adminDeleteRoutine(id) {
  if (!confirm("Delete this routine?")) return;
  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/routine/${id}`, { method: "DELETE" });
    if (!data.success) throw new Error(data.error || "Failed");
    adminLoadRoutine();
  } catch (e) {
    alert("❌ " + e.message);
  }
}

// =====================================================
// ADMIN - USERS (accounts)
// =====================================================
async function adminLoadUsers() {
  const tbody = document.getElementById("usersTable");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Loading...</td></tr>`;

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/users`, { method: "GET" });
    if (!data.success) throw new Error(data.error || "Failed");

    const rows = data.users || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-message">No users</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((u) => `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.email || "")}</td>
        <td>${escapeHtml(u.role || "")}</td>
        <td>${escapeHtml(u.linked || "-")}</td>
        <td>${escapeHtml(u.created_at || "")}</td>
      </tr>
    `).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function adminResetPassword() {
  const user_id = Number(document.getElementById("rpUserId").value.trim());
  const new_password = document.getElementById("rpNewPass").value;
  const statusEl = document.getElementById("rpStatus");

  statusEl.className = "status-message info";
  statusEl.innerHTML = "Resetting...";

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/users/reset-password`, {
      method: "POST",
      body: JSON.stringify({ user_id, new_password }),
    });
    if (!data.success) throw new Error(data.error || "Failed");

    statusEl.className = "status-message success";
    statusEl.innerHTML = "✅ " + data.message;

    document.getElementById("rpUserId").value = "";
    document.getElementById("rpNewPass").value = "";
    adminLoadUsers();
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

// =====================================================
// TEACHER LOGIN (Email/Password)
// =====================================================
function clearTeacherEmailStatus() {
  const el = document.getElementById("teacherLoginStatus");
  if (el) { el.className = "status-message"; el.innerHTML = ""; }
}

function setTeacherToken(token) { setToken(TEACHER_TOKEN_KEY, token); }
function clearTeacherToken() { clearToken(TEACHER_TOKEN_KEY); }

async function teacherEmailLogin() {
  const email = document.getElementById("teacherEmail").value.trim();
  const password = document.getElementById("teacherPassword").value;

  const statusEl = document.getElementById("teacherLoginStatus");
  statusEl.className = "status-message info";
  statusEl.innerHTML = "Logging in...";

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!data.success) {
      statusEl.className = "status-message error";
      statusEl.innerHTML = "❌ " + (data.error || "Login failed");
      return;
    }

    if (data.role !== "TEACHER") {
      statusEl.className = "status-message error";
      statusEl.innerHTML = "❌ Not a TEACHER account.";
      return;
    }

    setTeacherToken(data.token);
    statusEl.className = "status-message success";
    statusEl.innerHTML = "✅ Teacher logged in!";
    setTimeout(showTeacherDashboard, 350);
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

// =====================================================
// STUDENT LOGIN (Email/Password)
// =====================================================
function clearStudentLoginStatus() {
  const el = document.getElementById("studentLoginStatus");
  if (el) { el.className = "status-message"; el.innerHTML = ""; }
}

function setStudentToken(token) { setToken(STUDENT_TOKEN_KEY, token); }
function clearStudentToken() { clearToken(STUDENT_TOKEN_KEY); }

async function studentLogin() {
  const email = document.getElementById("studentEmail").value.trim();
  const password = document.getElementById("studentPassword").value;

  const statusEl = document.getElementById("studentLoginStatus");
  statusEl.className = "status-message info";
  statusEl.innerHTML = "Logging in...";

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!data.success) {
      statusEl.className = "status-message error";
      statusEl.innerHTML = "❌ " + (data.error || "Login failed");
      return;
    }

    if (data.role !== "STUDENT") {
      statusEl.className = "status-message error";
      statusEl.innerHTML = "❌ Not a STUDENT account.";
      return;
    }

    setStudentToken(data.token);
    statusEl.className = "status-message success";
    statusEl.innerHTML = "✅ Logged in!";
    setTimeout(showStudentDashboard, 350);
  } catch (e) {
    statusEl.className = "status-message error";
    statusEl.innerHTML = "❌ " + e.message;
  }
}

function studentLogout() {
  clearStudentToken();
  showStudentAlternative();
}

async function loadStudentDashboard() {
  const tbody = document.getElementById("studentAttendanceTable");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="3" class="empty-message">Loading...</td></tr>`;

  const token = getToken(STUDENT_TOKEN_KEY);
  if (!token) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-message">Not logged in</td></tr>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty-message">Need backend endpoint for student attendance</td></tr>`;
      return;
    }

    const me = await res.json();
    const nameLabel = document.getElementById("studentNameLabel");
    if (nameLabel) nameLabel.textContent = me.user?.email || "Student";

    tbody.innerHTML = `<tr><td colspan="3" class="empty-message">Connected ✅ (Now add attendance endpoint)</td></tr>`;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-message">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// =====================================================
// TEACHER LOGIN (Fingerprint/RFID) placeholders
// =====================================================
function resetTeacherAuth() {
  const fp = document.getElementById("fingerprintStatus");
  const rfid = document.getElementById("rfidStatus");
  if (fp) { fp.textContent = "Ready to scan"; fp.style.color = "#6c757d"; }
  if (rfid) { rfid.textContent = "Ready to scan"; rfid.style.color = "#6c757d"; }
}

// (keep your old fingerprint/rfid functions if you already have those APIs)

// =====================================================
// TEACHER DASHBOARD / SESSION (kept from your existing)
// =====================================================
async function loadTeacherDashboard() {
  // keep as-is from your project (you already have session endpoints)
}
async function startClass() {
  const token = getToken(TEACHER_TOKEN_KEY);
  if (!token) return alert("Teacher not logged in");

  const res = await fetch(`${API_BASE_URL}/session/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ class_id: activeClassId }),
  });

  const data = await res.json();
  if (!data.success) return alert("❌ " + (data.error || "Failed"));

  currentSession = { session_id: data.session_id };

  document.getElementById("sessionStatus").textContent = "Started";
  document.getElementById("endClassBtn").disabled = false;
  document.getElementById("startClassBtn").disabled = true;

  alert("✅ Class session started. Session ID: " + data.session_id);
}
async function endClass() {
  const token = getToken(TEACHER_TOKEN_KEY);
  if (!token) return alert("Teacher not logged in");
  if (!currentSession?.session_id) return alert("No active session");

  const res = await fetch(`${API_BASE_URL}/session/end`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ session_id: currentSession.session_id }),
  });

  const data = await res.json();
  if (!data.success) return alert("❌ " + (data.error || "Failed"));

  currentSession = null;
  document.getElementById("sessionStatus").textContent = "Ended";
  document.getElementById("endClassBtn").disabled = true;
  document.getElementById("startClassBtn").disabled = false;

  alert("✅ Class ended");
}
// =====================================================
// STUDENT CHECK-IN (no login required)
// =====================================================
let studentData = { benchNumber: "", qrCodeData: "", sessionId: null };

async function loadActiveSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/session/active/${activeClassId}`);
    const data = await response.json();
    studentData.sessionId = data.active ? data.session.session_id : null;
  } catch (error) {
    console.error("Error loading session:", error);
    studentData.sessionId = null;
  }
}

function resetStudentForm() {
  document.getElementById("benchSelect").value = "";
  document.getElementById("qrUpload").value = "";
  document.getElementById("qrStatus").textContent = "Camera is off";
  document.getElementById("qrStatus").style.color = "#6c757d";
  document.getElementById("submitBtn").disabled = true;
  document.getElementById("checkInStatus").innerHTML = "";
  document.getElementById("startScannerBtn").style.display = "inline-block";
  document.getElementById("stopScannerBtn").style.display = "none";
  document.getElementById("benchSelect").disabled = false;

  studentData = { benchNumber: "", qrCodeData: "", sessionId: studentData.sessionId };
  stopQRScanner();
}

function onBenchSelect() {
  studentData.benchNumber = document.getElementById("benchSelect").value;
  checkFormComplete();
}

function onQRCodeScanned(qrData) {
  studentData.qrCodeData = qrData;
  document.getElementById("qrStatus").textContent = "✅ QR Code scanned: " + qrData;
  document.getElementById("qrStatus").style.color = "#28a745";
  stopQRScanner();
  checkFormComplete();
}

function checkFormComplete() {
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = !(studentData.benchNumber && studentData.qrCodeData);
  if (!submitBtn.disabled) document.getElementById("checkInStatus").innerHTML = "";
}

// (keep your submitCheckIn code if already working)

// =====================================================
// QR SCANNER (camera)
// =====================================================
async function startQRScanner() {
  const video = document.getElementById("qrVideo");
  const startBtn = document.getElementById("startScannerBtn");
  const stopBtn = document.getElementById("stopScannerBtn");
  const statusEl = document.getElementById("qrStatus");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    video.style.display = "block";
    video.setAttribute("playsinline", "true");
    await video.play();

    startBtn.style.display = "none";
    stopBtn.style.display = "inline-block";
    statusEl.textContent = "📷 Camera is on - Position QR code in frame";
    statusEl.style.color = "#28a745";
  } catch (err) {
    statusEl.textContent = "❌ Error: Could not access camera";
    statusEl.style.color = "#dc3545";
  }
}

function stopQRScanner() {
  const video = document.getElementById("qrVideo");
  const startBtn = document.getElementById("startScannerBtn");
  const stopBtn = document.getElementById("stopScannerBtn");
  const statusEl = document.getElementById("qrStatus");

  if (qrScannerInterval) { clearInterval(qrScannerInterval); qrScannerInterval = null; }
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }

  if (video) video.style.display = "none";
  if (startBtn) startBtn.style.display = "inline-block";
  if (stopBtn) stopBtn.style.display = "none";
  if (statusEl) {
    statusEl.textContent = "Camera is off";
    statusEl.style.color = "#6c757d";
  }
}

document.getElementById("qrUpload")?.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById("qrStatus");
  statusEl.textContent = "🔄 Processing image...";
  statusEl.style.color = "#ffc107";

  setTimeout(() => {
    onQRCodeScanned(file.name.replace(/\.[^/.]+$/, ""));
  }, 700);
});

// =====================================================
// QR GUN + NUMPAD
// =====================================================
let numpadValue = "";

function resetQRGunForm() {
  numpadValue = "";
  document.getElementById("qrGunInput").value = "";
  document.getElementById("numpadDisplay").value = "";
  document.getElementById("qrGunInput").readOnly = false;
}

function activateQRGun() {
  const inputEl = document.getElementById("qrGunInput");
  inputEl.value = "";
  inputEl.readOnly = false;
  inputEl.focus();
  inputEl.placeholder = "Scan QR or type Student ID";
}

function numpadInput(char) {
  const display = document.getElementById("numpadDisplay");
  if (!display) return;

  const allowed = /^[DRLM0-9]$/;
  if (!allowed.test(String(char))) return;

  const maxLen = 6;
  if (numpadValue.length >= maxLen) return;

  numpadValue += String(char);
  display.value = numpadValue;
}

function numpadBackspace() {
  const display = document.getElementById("numpadDisplay");
  if (!display) return;
  numpadValue = numpadValue.slice(0, -1);
  display.value = numpadValue;
}

function numpadClear() {
  numpadValue = "";
  document.getElementById("numpadDisplay").value = "";
}

async function submitQRGunCheckIn() {
  const qrData = document.getElementById("qrGunInput").value.trim();
  const benchNumber = document.getElementById("numpadDisplay").value.trim();

  if (!qrData) { alert("Please enter or scan Student ID"); return; }
  if (!benchNumber) { alert("Please enter Bench Number"); return; }
  if (!studentData.sessionId) { alert("No active class session. Teacher must start class first!"); return; }

  alert("✅ Ready to submit QR Gun check-in (connect to your /student/checkin API here)");
}

// =====================================================
// UI UTILITIES
// =====================================================
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

// Make functions available to inline HTML onclick=""
window.logout = logout;
window.startClass = startClass;
window.endClass = endClass;

window.showRoleSelection = showRoleSelection;
window.showTeacherLogin = showTeacherLogin;
window.showStudentAlternative = showStudentAlternative;
window.showAdminLogin = showAdminLogin;

window.adminLogin = adminLogin;
window.adminLogout = adminLogout;

window.teacherEmailLogin = teacherEmailLogin;
window.studentLogin = studentLogin;
window.studentLogout = studentLogout;

window.authenticateFingerprint = authenticateFingerprint;
window.authenticateRFID = authenticateRFID;

window.showStudentCheckIn = showStudentCheckIn;
window.showStudentLogin = showStudentLogin;
window.showQRGunCheckIn = showQRGunCheckIn;

window.startQRScanner = startQRScanner;
window.stopQRScanner = stopQRScanner;
window.onBenchSelect = onBenchSelect;
window.submitCheckIn = submitCheckIn;

window.activateQRGun = activateQRGun;
window.numpadInput = numpadInput;
window.numpadClear = numpadClear;
window.numpadBackspace = numpadBackspace;
window.submitQRGunCheckIn = submitQRGunCheckIn;
window.startClass = startClass;
window.endClass = endClass;