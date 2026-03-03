// =====================================================
// SMART ATTENDANCE SYSTEM - JavaScript (Connected to Backend)
// =====================================================

// IMPORTANT: Use relative URL so it works on localhost + public hosting
const API_BASE_URL = '/api';

let currentSection = 'roleSelection';
let videoStream = null;
let qrScannerInterval = null;
let currentSession = null;
let currentUser = null;
let currentTeacher = null;
let activeClassId = 1;

// Admin token storage
const ADMIN_TOKEN_KEY = "admin_token";

// =====================================================
// NAVIGATION FUNCTIONS
// =====================================================

function showSection(sectionId) {
  const sections = [
    'roleSelection',
    'adminLogin',
    'adminDashboard',
    'teacherLogin',
    'teacherDashboard',
    'studentCheckIn',
    'studentAlternative',
    'qrGunCheckIn'
  ];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.style.display = 'block';
    targetSection.classList.add('fadeIn');
  }
  currentSection = sectionId;
}

function showRoleSelection() { showSection('roleSelection'); }
function showAdminLogin() { showSection('adminLogin'); clearAdminStatus(); }
function showAdminDashboard() { showSection('adminDashboard'); adminLoadTeachers(); adminLoadStudents(); }

function showTeacherLogin() { showSection('teacherLogin'); resetTeacherAuth(); }
function showTeacherDashboard() { showSection('teacherDashboard'); loadTeacherDashboard(); }
function showStudentCheckIn() { showSection('studentCheckIn'); resetStudentForm(); loadActiveSession(); }
function showStudentAlternative() { showSection('studentAlternative'); }
function showQRGunCheckIn() { showSection('qrGunCheckIn'); resetQRGunForm(); loadActiveSession(); }

// =====================================================
// ADMIN FUNCTIONS
// =====================================================

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}
function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}
function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function clearAdminStatus() {
  const el = document.getElementById("adminLoginStatus");
  if (el) { el.className = "status-message"; el.innerHTML = ""; }
}

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
      body: JSON.stringify({ email, password })
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
    setTimeout(showAdminDashboard, 500);

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
  document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
  document.getElementById(tabId).style.display = "block";

  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
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

// --- Teachers ---
async function adminLoadTeachers() {
  const tbody = document.getElementById("teachersTable");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Loading...</td></tr>`;

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/teachers`, { method: "GET" });
    if (!data.success) throw new Error(data.error || "Failed");

    const rows = data.teachers || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-message">No teachers</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(t => `
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
      body: JSON.stringify({ name, fingerprint_id, rfid_card })
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
  if (!confirm("Delete this teacher?")) return;

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
      body: JSON.stringify({ teacher_id: Number(teacher_id), email, password })
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

// --- Students ---
async function adminLoadStudents() {
  const tbody = document.getElementById("studentsTable");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-message">Loading...</td></tr>`;

  try {
    const data = await adminFetch(`${API_BASE_URL}/admin/students`, { method: "GET" });
    if (!data.success) throw new Error(data.error || "Failed");

    const rows = data.students || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-message">No students</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(s => `
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
      body: JSON.stringify({ student_id, name, class_id: class_id ? Number(class_id) : null })
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
  if (!confirm("Delete this student?")) return;

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
      body: JSON.stringify({ student_table_id: Number(student_table_id), email, password })
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
// TEACHER FUNCTIONS (your existing logic kept)
// =====================================================

function resetTeacherAuth() {
  document.getElementById('fingerprintStatus').textContent = 'Ready to scan';
  document.getElementById('fingerprintStatus').style.color = '#6c757d';
  document.getElementById('rfidStatus').textContent = 'Ready to scan';
  document.getElementById('rfidStatus').style.color = '#6c757d';
}

async function authenticateFingerprint() {
  const statusEl = document.getElementById('fingerprintStatus');
  statusEl.textContent = '🔄 Scanning...';
  statusEl.style.color = '#ffc107';
  try {
    const response = await fetch(`${API_BASE_URL}/teacher/login/fingerprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint_id: 'FP001' })
    });
    const data = await response.json();
    if (data.success) {
      statusEl.textContent = '✅ Fingerprint verified!';
      statusEl.style.color = '#28a745';
      currentTeacher = data.teacher;
      setTimeout(() => showTeacherDashboard(), 1000);
    } else {
      statusEl.textContent = '❌ ' + data.error;
      statusEl.style.color = '#dc3545';
    }
  } catch (error) {
    statusEl.textContent = '❌ Error: ' + error.message;
    statusEl.style.color = '#dc3545';
  }
}

async function authenticateRFID() {
  const statusEl = document.getElementById('rfidStatus');
  statusEl.textContent = '🔄 Waiting for card...';
  statusEl.style.color = '#ffc107';
  try {
    const response = await fetch(`${API_BASE_URL}/teacher/login/rfid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfid_card: 'RFID001' })
    });
    const data = await response.json();
    if (data.success) {
      statusEl.textContent = '✅ RFID card verified!';
      statusEl.style.color = '#28a745';
      currentTeacher = data.teacher;
      setTimeout(() => showTeacherDashboard(), 1000);
    } else {
      statusEl.textContent = '❌ ' + data.error;
      statusEl.style.color = '#dc3545';
    }
  } catch (error) {
    statusEl.textContent = '❌ Error: ' + error.message;
    statusEl.style.color = '#dc3545';
  }
}

// NOTE: Your dashboard/session endpoints must exist in backend.
// Keeping your original calls as-is.
async function loadTeacherDashboard() {
  await checkActiveSession();
  await loadClassesForTeacher();
  if (currentSession) { await updateDashboard(); }
  setInterval(async () => {
    if (currentSection === 'teacherDashboard') {
      await checkActiveSession();
      if (currentSession) await updateDashboard();
    }
  }, 10000);
}

async function checkActiveSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/session/active/${activeClassId}`);
    const data = await response.json();
    currentSession = data.active ? data.session : null;
  } catch (error) {
    console.error('Error checking session:', error);
    currentSession = null;
  }
}

async function loadClassesForTeacher() {
  try {
    const response = await fetch(`${API_BASE_URL}/classes`);
    const classes = await response.json();
    if (classes.length > 0) { activeClassId = classes[0].id; }
  } catch (error) {
    console.error('Error loading classes:', error);
  }
}

async function updateDashboard() {
  if (!currentSession) {
    document.getElementById('className').textContent = 'No Active Session';
    document.getElementById('teacherName').textContent = currentTeacher ? currentTeacher.name : '-';
    document.getElementById('sessionStatus').textContent = 'Not Started';
    document.getElementById('startTime').textContent = '-';
    document.getElementById('bufferEnd').textContent = '-';
    document.getElementById('presentCount').textContent = '0';
    document.getElementById('absentCount').textContent = '0';
    document.getElementById('pendingCount').textContent = '0';
    document.getElementById('startClassBtn').disabled = false;
    document.getElementById('endClassBtn').disabled = true;
    document.getElementById('attendanceTable').innerHTML =
      '<tr><td colspan="5" class="empty-message">No students checked in yet</td></tr>';
    return;
  }
  document.getElementById('className').textContent = currentSession.class_name || 'Computer Science 101';
  document.getElementById('teacherName').textContent = currentTeacher?.name || '-';
  document.getElementById('sessionStatus').textContent = 'In Progress';
  document.getElementById('startTime').textContent = new Date(currentSession.start_time).toLocaleTimeString();
  document.getElementById('bufferEnd').textContent = new Date(currentSession.buffer_end_time).toLocaleTimeString();
  document.getElementById('startClassBtn').disabled = true;
  document.getElementById('endClassBtn').disabled = false;

  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/${currentSession.session_id}`);
    const stats = await response.json();
    document.getElementById('presentCount').textContent = stats.present || 0;
    document.getElementById('absentCount').textContent = stats.absent || 0;
    document.getElementById('pendingCount').textContent = stats.pending || 0;
  } catch (error) { console.error('Error loading stats:', error); }

  try {
    const response = await fetch(`${API_BASE_URL}/attendance/${currentSession.session_id}`);
    const attendance = await response.json();
    loadAttendanceTable(attendance);
  } catch (error) { console.error('Error loading attendance:', error); }
}

function loadAttendanceTable(attendance) {
  const tbody = document.getElementById('attendanceTable');
  if (!attendance || attendance.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-message">No students checked in yet</td></tr>';
    return;
  }
  tbody.innerHTML = attendance.map(record => {
    const statusClass = `status-${record.status}`;
    const validationIcon = record.validated_by_camera ? '✅' : '⏳';
    const time = record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString() : '--';
    return `<tr><td><strong>${escapeHtml(record.bench_id)}</strong></td><td>${escapeHtml(record.student_name)}</td><td>${time}</td><td><span class="status-badge ${statusClass}">${escapeHtml(String(record.status).toUpperCase())}</span></td><td>${validationIcon}</td></tr>`;
  }).join('');
}

async function startClass() {
  if (!currentTeacher) { alert('Please login first'); return; }
  showLoading('Starting class session...');
  try {
    const response = await fetch(`${API_BASE_URL}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: activeClassId, teacher_id: currentTeacher.id })
    });
    const data = await response.json();
    hideLoading();
    if (data.success) {
      alert('Class session started! 10-minute buffer activated.');
      currentSession = { session_id: data.session_id, start_time: data.start_time, buffer_end_time: data.buffer_end_time };
      updateDashboard();
    } else { alert('Error: ' + data.error); }
  } catch (error) { hideLoading(); alert('Error: ' + error.message); }
}

async function endClass() {
  if (!currentSession) { alert('No active session'); return; }
  if (!confirm('Are you sure you want to end the class session?')) { return; }
  showLoading('Ending class session...');
  try {
    const response = await fetch(`${API_BASE_URL}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSession.session_id })
    });
    const data = await response.json();
    hideLoading();
    if (data.success) {
      alert('Class session ended. Final attendance has been saved.');
      currentSession = null;
      showRoleSelection();
    } else { alert('Error: ' + data.error); }
  } catch (error) { hideLoading(); alert('Error: ' + error.message); }
}

function logout() { currentUser = null; currentTeacher = null; currentSession = null; showRoleSelection(); }

// =====================================================
// STUDENT CHECK-IN FUNCTIONS (your existing logic kept)
// =====================================================

let studentData = { benchNumber: '', qrCodeData: '', sessionId: null };

async function loadActiveSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/session/active/${activeClassId}`);
    const data = await response.json();
    if (data.active) { studentData.sessionId = data.session.session_id; }
    else { studentData.sessionId = null; }
  } catch (error) { console.error('Error loading session:', error); studentData.sessionId = null; }
}

function resetStudentForm() {
  document.getElementById('benchSelect').value = '';
  document.getElementById('qrUpload').value = '';
  document.getElementById('qrStatus').textContent = 'Camera is off';
  document.getElementById('qrStatus').style.color = '#6c757d';
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('checkInStatus').innerHTML = '';
  document.getElementById('startScannerBtn').style.display = 'inline-block';
  document.getElementById('stopScannerBtn').style.display = 'none';
  document.getElementById('benchSelect').disabled = false;
  studentData = { benchNumber: '', qrCodeData: '', sessionId: studentData.sessionId };
  stopQRScanner();
}

function onBenchSelect() {
  studentData.benchNumber = document.getElementById('benchSelect').value;
  checkFormComplete();
}

function onQRCodeScanned(qrData) {
  studentData.qrCodeData = qrData;
  document.getElementById('qrStatus').textContent = '✅ QR Code scanned: ' + qrData;
  document.getElementById('qrStatus').style.color = '#28a745';
  stopQRScanner();
  checkFormComplete();
}

function checkFormComplete() {
  const submitBtn = document.getElementById('submitBtn');
  if (studentData.benchNumber && studentData.qrCodeData) {
    submitBtn.disabled = false;
    document.getElementById('checkInStatus').innerHTML = '';
  } else {
    submitBtn.disabled = true;
  }
}

async function submitCheckIn() {
  if (!studentData.benchNumber || !studentData.qrCodeData) { showStatusMessage('Please fill in all fields', 'error'); return; }
  if (!studentData.sessionId) { showStatusMessage('No active class session', 'error'); return; }
  showLoading('Submitting attendance...');
  try {
    const response = await fetch(`${API_BASE_URL}/student/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: studentData.sessionId, student_id: studentData.qrCodeData, bench_id: studentData.benchNumber, method: 'qr_scan' })
    });
    const data = await response.json();
    hideLoading();
    if (data.success) {
      showStatusMessage('✅ Attendance marked! Status: ' + data.status.toUpperCase(), 'success');
      document.getElementById('benchSelect').disabled = true;
      document.getElementById('submitBtn').disabled = true;
    } else { showStatusMessage('❌ ' + data.error, 'error'); }
  } catch (error) { hideLoading(); showStatusMessage('❌ Error: ' + error.message, 'error'); }
}

function showStatusMessage(message, type) {
  const statusEl = document.getElementById('checkInStatus');
  statusEl.className = 'status-message ' + type;
  statusEl.innerHTML = message;
}

// =====================================================
// QR CODE SCANNER FUNCTIONS
// =====================================================

async function startQRScanner() {
  const video = document.getElementById('qrVideo');
  const startBtn = document.getElementById('startScannerBtn');
  const stopBtn = document.getElementById('stopScannerBtn');
  const statusEl = document.getElementById('qrStatus');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.style.display = 'block';
    video.play();
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    statusEl.textContent = '📷 Camera is on - Position QR code in frame';
    statusEl.style.color = '#28a745';
  } catch (err) {
    statusEl.textContent = '❌ Error: Could not access camera';
    statusEl.style.color = '#dc3545';
  }
}

function stopQRScanner() {
  const video = document.getElementById('qrVideo');
  const startBtn = document.getElementById('startScannerBtn');
  const stopBtn = document.getElementById('stopScannerBtn');
  const statusEl = document.getElementById('qrStatus');
  if (qrScannerInterval) { clearInterval(qrScannerInterval); qrScannerInterval = null; }
  if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); video.srcObject = null; }
  video.style.display = 'none';
  startBtn.style.display = 'inline-block';
  stopBtn.style.display = 'none';
  statusEl.textContent = 'Camera is off';
  statusEl.style.color = '#6c757d';
}

document.getElementById('qrUpload')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('qrStatus');
  statusEl.textContent = '🔄 Processing image...';
  statusEl.style.color = '#ffc107';
  setTimeout(() => { onQRCodeScanned(file.name.replace(/\.[^/.]+$/, "")); }, 800);
});

// =====================================================
// QR GUN + NUMPAD FUNCTIONS
// =====================================================

let qrGunData = '';
let numpadValue = '';

function resetQRGunForm() {
  qrGunData = '';
  numpadValue = '';
  document.getElementById('qrGunInput').value = '';
  document.getElementById('numpadDisplay').value = '';
  document.getElementById('qrGunInput').readOnly = false;
}

function activateQRGun() {
  const inputEl = document.getElementById('qrGunInput');
  inputEl.value = '';
  inputEl.readOnly = false;
  inputEl.focus();

  inputEl.oninput = function(e) {
    qrGunData = e.target.value;
    console.log('QR Gun Data:', qrGunData);
  };

  document.getElementById('qrGunInput').placeholder = 'Scan QR or type Student ID';
}

function numpadInput(num) {
  if (numpadValue.length < 5) {
    numpadValue += num;
    document.getElementById('numpadDisplay').value = numpadValue;
  }
}

function numpadClear() {
  numpadValue = '';
  document.getElementById('numpadDisplay').value = '';
}

async function submitQRGunCheckIn() {
  const qrData = document.getElementById('qrGunInput').value.trim();
  const benchNumber = document.getElementById('numpadDisplay').value;

  if (!qrData) { alert('Please enter or scan Student ID'); return; }
  if (!benchNumber) { alert('Please enter Bench Number'); return; }
  if (!studentData.sessionId) { alert('No active class session. Teacher must start class first!'); return; }

  showLoading('Submitting attendance...');

  try {
    const response = await fetch(`${API_BASE_URL}/student/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: studentData.sessionId,
        student_id: qrData,
        bench_id: benchNumber,
        method: 'qr_gun'
      })
    });
    const data = await response.json();
    hideLoading();

    if (data.success) {
      alert('✅ Attendance marked! Status: ' + data.status.toUpperCase());
      showRoleSelection();
    } else {
      alert('❌ Error: ' + data.error);
    }
  } catch (error) {
    hideLoading();
    alert('❌ Connection Error: ' + error.message);
  }
}

// =====================================================
// UI UTILITIES
// =====================================================

function showLoading(msg) {
  const overlay = document.getElementById("loadingOverlay");
  const txt = document.getElementById("loadingMessage");
  if (txt) txt.textContent = msg || "Processing...";
  if (overlay) overlay.style.display = "flex";
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
