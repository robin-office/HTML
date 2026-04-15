/* ============================================
   ALP ERP - Admin Dashboard Logic
   Charts, data management, filtering, tabs
   ============================================ */

let allStudents = [];
let allTeachers = [];
let allTransactions = [];
let allCourses = [];
let currentFilter = 'all';
let monthlyChart = null;
let workloadChart = null;

// ── Admin Login ──
document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = document.getElementById('adminPass').value;
  const btn = document.getElementById('loginBtn');

  if (!pass) {
    Toast.error('Error', 'Password is required');
    return;
  }

  Loading.setButton(btn, true);
  try {
    await API.adminLogin(pass);
    Auth.setSession('admin', { name: 'Admin' });
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('dashboardApp').style.display = 'flex';
    Sidebar.init();
    loadDashboardData();
  } catch (error) {
    Toast.error('Login Failed', error.message || 'Invalid credentials');
  } finally {
    Loading.setButton(btn, false);
  }
});

// Check existing session
document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn('admin')) {
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('dashboardApp').style.display = 'flex';
    setTimeout(() => {
      Sidebar.init();
      loadDashboardData();
    }, 100);
  }
});

// ── Tab Switching ──
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  const titles = {
    overview: ['Dashboard Overview', 'Welcome back, Admin'],
    students: ['Student Records', 'View and manage all students'],
    teachers: ['Teacher Management', 'Create and manage teacher accounts'],
    courses: ['Course Management', 'Manage astrological courses'],
    assign: ['Parcel Assignment', 'Assign parcels to teachers for correction'],
    payments: ['Payment Verification', 'Verify and manage certificate payments'],
    promotion: ['Course Promotions', 'Track and manage course promotions']
  };

  if (titles[tab]) {
    document.getElementById('pageTitle').textContent = titles[tab][0];
    document.getElementById('pageSubtitle').textContent = titles[tab][1];
  }

  // Lazy-load tab data
  if (tab === 'students') renderStudentsTable();
  if (tab === 'teachers') renderTeachersTable();
  if (tab === 'courses') renderCoursesTable();
  if (tab === 'assign') renderAssignTable();
  if (tab === 'payments') renderPaymentsTable();
  if (tab === 'promotion') renderPromotionTable();
}

// ── Load All Data ──
async function loadDashboardData() {
  try {
    const [adminData, students, teachers, transactions, courses] = await Promise.all([
      API.getAdminData(),
      API.getAllStudents(),
      API.getTeachers(),
      API.getTransactions(),
      API.getCourses()
    ]);

    allStudents = students.data || [];
    allTeachers = teachers.data || [];
    allTransactions = transactions.data || [];
    allCourses = courses.data || [];

    updateStats();
    renderCharts();
    renderRecentTable();
    populateTeacherDropdowns();
    populateDynamicCourses();

    document.getElementById('studentCountBadge').textContent = allStudents.length;
  } catch (error) {

    Toast.error('Load Failed', 'Could not fetch dashboard data. ' + error.message);
    allStudents = [];
    allTeachers = [];
    allTransactions = [];
    allCourses = [];
    updateStats();
    renderCharts();
    renderRecentTable();
    populateTeacherDropdowns();
    populateDynamicCourses();
  }
}

function refreshData() {
  API.clearCache();
  loadDashboardData();
  Toast.info('Refreshing', 'Loading latest data...');
}



// ── Update Stats ──
function updateStats() {
  const total = allStudents.length;
  const pending = allStudents.filter(s => s.Correction_Status === 'Pending' || !s.Correction_Status).length;
  const pass = allStudents.filter(s => s.Result === 'PASS').length;
  const fail = allStudents.filter(s => s.Result === 'FAIL').length;
  const payPending = allStudents.filter(s => s.Payment_Status === 'Pending').length;

  animateCounter(document.getElementById('statTotal'), total);
  animateCounter(document.getElementById('statPending'), pending);
  animateCounter(document.getElementById('statPass'), pass);
  animateCounter(document.getElementById('statFail'), fail);
  animateCounter(document.getElementById('statPayments'), payPending);
}

// ── Charts ──
function renderCharts() {
  if (typeof Chart === 'undefined') return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#94a3b8' : '#6b7280';

  // Monthly Chart
  const monthlyCtx = document.getElementById('chartMonthly')?.getContext('2d');
  if (monthlyCtx) {
    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Corrections',
          data: [12, 19, 28, 15, 22, 30, 18, 25, 33, 20, 16, 24],
          backgroundColor: 'rgba(99,102,241,0.7)',
          borderRadius: 6,
          borderSkipped: false
        }, {
          label: 'Pass',
          data: [8, 14, 22, 11, 18, 25, 14, 20, 28, 16, 12, 20],
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor } }
        }
      }
    });
  }

  // Workload Chart
  const workloadCtx = document.getElementById('chartWorkload')?.getContext('2d');
  if (workloadCtx) {
    const teacherNames = allTeachers.map(t => t.Teacher_Name);
    const teacherCounts = teacherNames.map(name =>
      allStudents.filter(s => s.Teacher_Assigned === name).length
    );

    if (workloadChart) workloadChart.destroy();
    workloadChart = new Chart(workloadCtx, {
      type: 'doughnut',
      data: {
        labels: teacherNames.length ? teacherNames : ['No Teachers'],
        datasets: [{
          data: teacherCounts.length && teacherCounts.some(c => c > 0) ? teacherCounts : [1],
          backgroundColor: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, padding: 16 } }
        },
        cutout: '65%'
      }
    });
  }
}

// ── Recent Table ──
function renderRecentTable() {
  const tbody = document.getElementById('recentTable');
  const recent = allStudents.slice(-8).reverse();

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:40px;">No records found</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(s => `
    <tr>
      <td><strong>${s.Student_ID}</strong></td>
      <td>${s.Student_Name}</td>
      <td><span class="badge badge-primary">${s.Course_Level}</span></td>
      <td>${s.Parcel_ID || '—'}</td>
      <td>${getStatusBadge(s)}</td>
      <td>${getResultBadge(s.Result)}</td>
    </tr>
  `).join('');
}

// ── Students Table ──
function renderStudentsTable() {
  const tbody = document.getElementById('studentsBody');
  let data = [...allStudents];

  // Apply filter
  if (currentFilter !== 'all') {
    data = data.filter(s => {
      switch(currentFilter) {
        case 'Interested': return s.Course_Level === 'Interested' || !s.Course_Level;
        case 'Received': return s.Office_Received === 'Yes';
        case 'Not Received': return s.Office_Received !== 'Yes';
        case 'Assigned': return !!s.Teacher_Assigned;
        case 'Pending': return s.Correction_Status === 'Pending' || !s.Correction_Status;
        case 'PASS': return s.Result === 'PASS';
        case 'FAIL': return s.Result === 'FAIL';
        default: return true;
      }
    });
  }

  // Apply search
  const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || '';
  if (searchTerm) {
    data = data.filter(s =>
      s.Student_ID?.toLowerCase().includes(searchTerm) ||
      s.Student_Name?.toLowerCase().includes(searchTerm) ||
      s.Mobile?.includes(searchTerm)
    );
  }

  // Apply course filter
  const courseFilter = document.getElementById('studentCourseFilter')?.value;
  if (courseFilter) {
    data = data.filter(s => s.Course_Level === courseFilter);
  }

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted" style="padding: 40px;">No records match the filter</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td><input type="checkbox" class="student-check" value="${s.Student_ID}"></td>
      <td><strong>${s.Student_ID}</strong></td>
      <td>${s.Student_Name}</td>
      <td><span class="badge badge-primary">${s.Course_Level}</span></td>
      <td>${s.Mobile}</td>
      <td>${s.Parcel_ID || '—'}</td>
      <td>${s.Teacher_Assigned || '<span class="text-muted">Unassigned</span>'}</td>
      <td>${s.Marks || '—'}</td>
      <td>${getResultBadge(s.Result)}</td>
      <td>${getPaymentBadge(s.Payment_Status)}</td>
      <td style="white-space: nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="openWhatsAppModal('${s.Mobile}')" title="WhatsApp" style="color:#25D366;">
          <i data-lucide="message-circle"></i>
        </button>
        <button class="btn btn-ghost btn-sm" onclick="editStudent('${s.Student_ID}')" title="Edit">
          <i data-lucide="edit-2"></i>
        </button>
        <button class="btn btn-ghost btn-sm text-danger" onclick="deleteStudent('${s.Student_ID}')" title="Delete">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    </tr>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function filterBy(filter, chipEl) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chipEl.classList.add('active');
  renderStudentsTable();
}

function filterStudentTable() { renderStudentsTable(); }

function toggleSelectAll(checkbox) {
  document.querySelectorAll('.student-check').forEach(c => c.checked = checkbox.checked);
}

// ── Teachers Table ──
function renderTeachersTable() {
  const tbody = document.getElementById('teachersBody');
  if (allTeachers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 40px;">No teachers found</td></tr>`;
    return;
  }

  tbody.innerHTML = allTeachers.map(t => {
    const assignedCount = allStudents.filter(s => s.Teacher_Assigned === t.Teacher_Name).length;
    return `
      <tr>
        <td><strong>${t.Teacher_Name}</strong></td>
        <td>${t.Username}</td>
        <td>${t.Mobile || '—'}</td>
        <td><span class="badge ${t.Status === 'Active' ? 'badge-success' : 'badge-gray'} badge-dot">${t.Status}</span></td>
        <td><span class="badge badge-primary">${assignedCount} parcels</span></td>
        <td>
          <button class="btn btn-ghost btn-sm text-danger" onclick="deleteTeacher('${t.Username}')" title="Delete">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function addTeacher() {
  const form = document.getElementById('addTeacherForm');
  const data = {
    teacherName: form.querySelector('[name="teacherName"]').value.trim(),
    username: form.querySelector('[name="username"]').value.trim(),
    password: form.querySelector('[name="password"]').value.trim(),
    mobile: form.querySelector('[name="mobile"]').value.trim()
  };

  if (!data.teacherName || !data.username || !data.password) {
    Toast.error('Error', 'Please fill all required fields');
    return;
  }

  const btn = document.getElementById('addTeacherBtn');
  Loading.setButton(btn, true);

  try {
    await API.createTeacher(data);
    Toast.success('Teacher Created', `${data.teacherName} has been added successfully`);
    closeModal('addTeacherModal');
    form.reset();
    allTeachers.push({ Teacher_Name: data.teacherName, Username: data.username, Mobile: data.mobile, Status: 'Active' });
    renderTeachersTable();
    populateTeacherDropdowns();
  } catch (error) {
    Toast.error('Error', error.message);
  } finally {
    Loading.setButton(btn, false);
  }
}

// ── Assignment Tab ──
function renderAssignTable() {
  const tbody = document.getElementById('assignBody');
  const received = allStudents.filter(s => s.Office_Received === 'Yes');

  if (received.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 40px;">No parcels to assign</td></tr>`;
    return;
  }

  tbody.innerHTML = received.map(s => `
    <tr>
      <td><input type="checkbox" class="assign-check" value="${s.Student_ID}"></td>
      <td><strong>${s.Student_ID}</strong></td>
      <td>${s.Student_Name}</td>
      <td><span class="badge badge-primary">${s.Course_Level}</span></td>
      <td>${s.Parcel_ID || '—'}</td>
      <td>${s.Teacher_Assigned || '<span class="text-muted">Not Assigned</span>'}</td>
      <td>
        <select class="form-control" style="width: 160px; padding: 6px 10px; font-size: 12px;" id="teacher-${s.Student_ID}" onchange="assignSingle('${s.Student_ID}', this.value)">
          <option value="">Select Teacher</option>
          ${allTeachers.filter(t => t.Status === 'Active').map(t => `<option value="${t.Teacher_Name}" ${s.Teacher_Assigned === t.Teacher_Name ? 'selected' : ''}>${t.Teacher_Name}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('');
}

async function assignSingle(studentId, teacherName) {
  if (!teacherName) return;
  try {
    await API.assignTeacher(studentId, teacherName);
    const student = allStudents.find(s => s.Student_ID === studentId);
    if (student) student.Teacher_Assigned = teacherName;
    Toast.success('Assigned', `Parcel assigned to ${teacherName}`);
  } catch (error) {
    Toast.error('Error', error.message);
  }
}

async function bulkAssignTeacher() {
  const teacherName = document.getElementById('bulkTeacherSelect').value;
  if (!teacherName) {
    Toast.warning('Select Teacher', 'Please select a teacher for bulk assignment');
    return;
  }

  const selected = Array.from(document.querySelectorAll('.assign-check:checked')).map(c => c.value);
  if (selected.length === 0) {
    Toast.warning('Select Parcels', 'Please select parcels to assign');
    return;
  }

  try {
    await API.bulkAssign(selected, teacherName);
    selected.forEach(id => {
      const s = allStudents.find(st => st.Student_ID === id);
      if (s) s.Teacher_Assigned = teacherName;
    });
    renderAssignTable();
    Toast.success('Bulk Assigned', `${selected.length} parcels assigned to ${teacherName}`);
  } catch (error) {
    Toast.error('Error', error.message);
  }
}

function toggleSelectAllAssign(cb) {
  document.querySelectorAll('.assign-check').forEach(c => c.checked = cb.checked);
}

// ── Payments Table ──
function renderPaymentsTable() {
  const tbody = document.getElementById('paymentsBody');
  if (allTransactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 40px;">No transactions found</td></tr>`;
    return;
  }

  tbody.innerHTML = allTransactions.map(t => `
    <tr>
      <td><strong>${t.Student_ID}</strong></td>
      <td>${t.Parcel_ID}</td>
      <td>${t.Transaction_ID || '—'}</td>
      <td>₹${t.Amount || '0'}</td>
      <td>${getPaymentBadge(t.Verification_Status)}</td>
      <td>
        ${t.Verification_Status !== 'Verified' ? `
          <button class="btn btn-success btn-sm" onclick="verifyPay('${t.Student_ID}', '${t.Parcel_ID}', 'Verified')"><i data-lucide="check"></i> Verify</button>
          <button class="btn btn-danger btn-sm" onclick="verifyPay('${t.Student_ID}', '${t.Parcel_ID}', 'Rejected')"><i data-lucide="x"></i></button>
        ` : `<span class="badge badge-success badge-dot">Verified</span>`}
      </td>
    </tr>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function verifyPay(studentId, parcelId, status) {
  try {
    await API.verifyPayment(studentId, parcelId, status);
    const txn = allTransactions.find(t => t.Student_ID === studentId && t.Parcel_ID === parcelId);
    if (txn) txn.Verification_Status = status;
    renderPaymentsTable();
    Toast.success('Payment Updated', `Payment ${status.toLowerCase()}`);
  } catch (error) {
    Toast.error('Error', error.message);
  }
}

// ── Promotion Table ──
function renderPromotionTable() {
  const tbody = document.getElementById('promotionBody');
  const eligible = allStudents.filter(s => s.Result === 'PASS' && s.Next_Course_Level);

  if (eligible.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 40px;">No promotions available</td></tr>`;
    return;
  }

  tbody.innerHTML = eligible.map(s => {
    const nextCourse = s.Next_Course_Level || getNextCourse(s.Course_Level);
    return `
      <tr>
        <td><strong>${s.Student_ID}</strong></td>
        <td>${s.Student_Name}</td>
        <td><span class="badge badge-primary">${s.Course_Level}</span></td>
        <td><span class="badge badge-success">${nextCourse}</span></td>
        <td>${getPromotionBadge(s._promotionStatus)}</td>
        <td>
          <button class="btn btn-whatsapp btn-sm" onclick="sendPromotionWhatsApp('${s.Student_Name}', '${s.Mobile}', '${nextCourse}')">
            <i data-lucide="message-circle"></i> Invite
          </button>
        </td>
      </tr>
    `;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function sendPromotionWhatsApp(name, mobile, nextCourse) {
  const message = `Hello ${name},\nCongratulations on passing your exam! 🎉\nYou're eligible for the ${nextCourse} course.\nWould you like to join? Reply to confirm.\n– ALP Institute`;
  openWhatsApp(mobile, message);
}

function getNextCourse(current) {
  const map = { 'Basic': 'Advanced', 'Advanced': 'Vast', 'Vast': 'Completed' };
  return map[current] || 'Completed';
}

// ── Helper Badges ──
function getStatusBadge(s) {
  if (s.Office_Received === 'Yes') return `<span class="badge badge-success badge-dot">Received</span>`;
  return `<span class="badge badge-warning badge-dot">Pending</span>`;
}

function getResultBadge(result) {
  if (result === 'PASS') return `<span class="badge badge-success">PASS</span>`;
  if (result === 'FAIL') return `<span class="badge badge-danger">FAIL</span>`;
  return `<span class="badge badge-gray">—</span>`;
}

function getPaymentBadge(status) {
  const map = {
    'Pending': 'badge-warning',
    'Verified': 'badge-success',
    'Rejected': 'badge-danger',
    'Completed': 'badge-success'
  };
  return status ? `<span class="badge ${map[status] || 'badge-gray'} badge-dot">${status}</span>` : `<span class="badge badge-gray">—</span>`;
}

function getPromotionBadge(status) {
  const map = {
    'Interested': 'badge-primary',
    'Joined': 'badge-success',
    'Rejected': 'badge-danger'
  };
  return status ? `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>` : `<span class="badge badge-gray">Pending</span>`;
}

// ── Populate Teacher Dropdowns ──
function populateTeacherDropdowns() {
  const selects = document.querySelectorAll('#bulkTeacherSelect');
  selects.forEach(sel => {
    const current = sel.value;
    sel.innerHTML = `<option value="">Select Teacher</option>` +
      allTeachers.filter(t => t.Status === 'Active').map(t =>
        `<option value="${t.Teacher_Name}">${t.Teacher_Name}</option>`
      ).join('');
    sel.value = current;
  });
}

// ── Edit Student ──
function editStudent(studentId) {
  const student = allStudents.find(s => s.Student_ID === studentId);
  if (!student) {
    Toast.error('Error', 'Student not found');
    return;
  }
  
  // Populate teacher dropdown dynamically
  const teacherSelect = document.getElementById('edit_Teacher_Assigned');
  teacherSelect.innerHTML = `<option value="">None</option>` +
    allTeachers.map(t => `<option value="${t.Teacher_Name}">${t.Teacher_Name}</option>`).join('');

  // Populate all inputs
  document.getElementById('edit_Student_ID').value = student.Student_ID || '';
  document.getElementById('edit_Student_Name').value = student.Student_Name || '';
  document.getElementById('edit_Course_Level').value = student.Course_Level || 'Basic';
  document.getElementById('edit_Mobile').value = student.Mobile || '';
  document.getElementById('edit_Location').value = student.Location || '';
  document.getElementById('edit_Parcel_Type').value = student.Parcel_Type || '';
  document.getElementById('edit_Parcel_Status').value = student.Parcel_Status || '';
  document.getElementById('edit_Office_Received').value = student.Office_Received || 'No';
  // Date input requires YYYY-MM-DD format
  let dateVal = '';
  if (student.Received_Date) {
    try { dateVal = new Date(student.Received_Date).toISOString().split('T')[0]; } catch(e){}
  }
  document.getElementById('edit_Received_Date').value = dateVal;
  document.getElementById('edit_Parcel_ID').value = student.Parcel_ID || '';
  document.getElementById('edit_Teacher_Assigned').value = student.Teacher_Assigned || '';
  document.getElementById('edit_Marks').value = student.Marks || '';
  document.getElementById('edit_Result').value = student.Result || '';
  document.getElementById('edit_Correction_Status').value = student.Correction_Status || 'Pending';
  document.getElementById('edit_Payment_Status').value = student.Payment_Status || 'Pending';
  document.getElementById('edit_Certificate_Status').value = student.Certificate_Status || '';
  document.getElementById('edit_Next_Course_Level').value = student.Next_Course_Level || '';

  openModal('editStudentModal');
}

async function saveStudentEdit() {
  const studentId = document.getElementById('edit_Student_ID').value;
  if (!studentId) return;

  const btn = document.getElementById('saveStudentEditBtn');
  Loading.setButton(btn, true);

  const updates = {
    Student_Name: document.getElementById('edit_Student_Name').value,
    Course_Level: document.getElementById('edit_Course_Level').value,
    Mobile: document.getElementById('edit_Mobile').value,
    Location: document.getElementById('edit_Location').value,
    Parcel_Type: document.getElementById('edit_Parcel_Type').value,
    Parcel_Status: document.getElementById('edit_Parcel_Status').value,
    Office_Received: document.getElementById('edit_Office_Received').value,
    Received_Date: document.getElementById('edit_Received_Date').value,
    Parcel_ID: document.getElementById('edit_Parcel_ID').value,
    Teacher_Assigned: document.getElementById('edit_Teacher_Assigned').value,
    Marks: document.getElementById('edit_Marks').value,
    Result: document.getElementById('edit_Result').value,
    Correction_Status: document.getElementById('edit_Correction_Status').value,
    Payment_Status: document.getElementById('edit_Payment_Status').value,
    Certificate_Status: document.getElementById('edit_Certificate_Status').value,
    Next_Course_Level: document.getElementById('edit_Next_Course_Level').value
  };

  try {
    await API.updateStudent(studentId, updates);
    
    // Update local state and UI
    const student = allStudents.find(s => s.Student_ID === studentId);
    if (student) {
      Object.assign(student, updates);
    }
    
    closeModal('editStudentModal');
    Toast.success('Updated', `Student ${studentId} saved successfully.`);
    renderStudentsTable();
    updateStats();
    renderCharts();
  } catch (error) {
    Toast.error('Update Failed', error.message);
  } finally {
    Loading.setButton(btn, false);
  }
}

// ── Modal Helpers ──
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function confirmAction(title, message, onConfirm) {
  document.getElementById('confirmTitle').innerText = title;
  document.getElementById('confirmMessage').innerText = message;
  const btn = document.getElementById('confirmBtn');
  
  // Clone button to remove previous event listeners
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  newBtn.addEventListener('click', () => {
    closeModal('confirmModal');
    onConfirm();
  });
  
  openModal('confirmModal');
}

// ── Delete Functions ──
async function deleteStudent(studentId) {
  confirmAction('Delete Student', `Are you sure you want to completely delete student ${studentId}? This cannot be undone.`, async () => {
    try {
      Toast.info('Deleting', `Deleting ${studentId}...`);
      await API.deleteStudent(studentId);
      allStudents = allStudents.filter(s => s.Student_ID !== studentId);
      Toast.success('Deleted', `Student ${studentId} deleted successfully.`);
      renderStudentsTable();
      updateStats();
      renderCharts();
    } catch (error) {
      Toast.error('Delete Failed', error.message);
    }
  });
}

async function deleteTeacher(username) {
  confirmAction('Delete Teacher', `Are you sure you want to completely delete teacher ${username}? This cannot be undone.`, async () => {
    try {
      Toast.info('Deleting', `Deleting teacher ${username}...`);
      await API.deleteTeacher(username);
      allTeachers = allTeachers.filter(t => t.Username !== username);
      Toast.success('Deleted', `Teacher ${username} deleted successfully.`);
      renderTeachersTable();
      populateTeacherDropdowns();
    } catch (error) {
      Toast.error('Delete Failed', error.message);
    }
  });
}

// ── Courses Management ──
function renderCoursesTable() {
  const tbody = document.getElementById('coursesBody');
  if (allCourses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted" style="padding: 40px;">No courses found. Add a course to start.</td></tr>`;
    return;
  }
  tbody.innerHTML = allCourses.map(c => `
    <tr>
      <td><strong>${c.Course_Name}</strong></td>
      <td>${c.Description || '—'}</td>
    </tr>
  `).join('');
}

function populateDynamicCourses() {
  const selects = document.querySelectorAll('.dynamic-course-dropdown');
  selects.forEach(sel => {
    const current = sel.value;
    const defaultText = sel.id === 'studentCourseFilter' ? 'All Courses' : 'Select Course';
    sel.innerHTML = `<option value="">${defaultText}</option>` + allCourses.map(c => `<option value="${c.Course_Name}">${c.Course_Name}</option>`).join('');
    if (current) sel.value = current;
  });
}

async function submitNewCourse() {
  const name = document.getElementById('newCourseName').value.trim();
  const desc = document.getElementById('newCourseDesc').value.trim();
  if(!name) { Toast.error('Validation', 'Course name is required'); return; }
  
  const btn = document.getElementById('addCourseBtn');
  Loading.setButton(btn, true);
  try {
    await API.addCourse({ courseName: name, courseDescription: desc });
    allCourses.push({ Course_Name: name, Description: desc });
    renderCoursesTable();
    populateDynamicCourses();
    closeModal('addCourseModal');
    document.getElementById('addCourseForm').reset();
    Toast.success('Success', 'Course added successfully');
  } catch(e) { Toast.error('Error', e.message); } finally { Loading.setButton(btn, false); }
}

// ── Student Management (Manual + Excel) ──
async function submitNewStudent() {
  const data = {
    studentId: document.getElementById('add_Student_ID').value.trim(),
    studentName: document.getElementById('add_Student_Name').value.trim(),
    courseLevel: document.getElementById('add_Course_Level').value || 'Interested',
    mobile: document.getElementById('add_Mobile').value.trim(),
    location: document.getElementById('add_Location').value.trim(),
  };
  
  if(!data.studentName) {
    Toast.error('Validation', 'Name is required'); return;
  }
  
  const btn = document.getElementById('saveNewStudentBtn');
  Loading.setButton(btn, true);
  try {
    const res = await API.addStudent(data);
    refreshData();
    closeModal('addStudentModal');
    document.getElementById('addStudentForm').reset();
    Toast.success('Success', `Student added. ID: ${res.studentId}`);
  } catch(e) { Toast.error('Error', e.message); } finally { Loading.setButton(btn, false); }
}

function downloadExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    Toast.error('Error', 'Excel library not loaded.');
    return;
  }
  const headers = [['Student_ID', 'Student_Name', 'Course_Level', 'Mobile', 'Location']];
  const sample = [['', 'John Doe', 'Numerology', '9876543210', 'Mumbai']];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "ALP_Student_Import_Template.xlsx");
}

function processExcelImport() {
  const fileInput = document.getElementById('excelFileInput');
  if(!fileInput.files.length) { Toast.error('Select File', 'Please choose an Excel file first.'); return; }
  
  if (typeof XLSX === 'undefined') {
    Toast.error('Error', 'Excel library not loaded.');
    return;
  }
  
  const file = fileInput.files[0];
  const reader = new FileReader();
  const btn = document.getElementById('processExcelBtn');
  Loading.setButton(btn, true);
  
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type: 'array'});
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet);
      
      if(rows.length === 0) { throw new Error("Excel file is empty"); }
      
      const studentsToImport = rows.map(r => ({
        studentId: r.Student_ID ? String(r.Student_ID).trim() : '',
        studentName: r.Student_Name ? String(r.Student_Name).trim() : '',
        courseLevel: r.Course_Level ? String(r.Course_Level).trim() : '',
        mobile: r.Mobile ? String(r.Mobile).trim() : '',
        location: r.Location ? String(r.Location).trim() : ''
      })).filter(s => s.studentName && s.courseLevel);
      
      if(studentsToImport.length === 0) { throw new Error("No valid student rows found. Make sure Student_Name and Course_Level are filled."); }
      
      await API.bulkAddStudents(studentsToImport);
      refreshData();
      closeModal('importExcelModal');
      fileInput.value = '';
      Toast.success('Import Success', `${studentsToImport.length} students imported.`);
      
    } catch(err) {
      Toast.error('Import Failed', err.message);
    } finally {
      Loading.setButton(btn, false);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── WhatsApp Messaging ──
function openWhatsAppModal(mobile) {
  if(!mobile || mobile === 'undefined') { 
    Toast.error('Error', 'No mobile number on file for this student'); 
    return; 
  }
  document.getElementById('wa_mobile').value = mobile;
  document.getElementById('wa_message').value = '';
  openModal('whatsappModal');
}

function sendWhatsAppMessage() {
  const note = document.getElementById('wa_message').value.trim();
  let mobile = document.getElementById('wa_mobile').value.replace(/[^0-9]/g, '');
  
  if(!note) { Toast.error('Validation', 'Please write a message first'); return; }
  
  // Implicitly assume Indian number layout
  if(mobile.length === 10) { mobile = '91' + mobile; }
  
  const url = `https://wa.me/${mobile}?text=${encodeURIComponent(note)}`;
  window.open(url, '_blank');
  
  closeModal('whatsappModal');
  Toast.success('Sending', 'Opening WhatsApp Web...');
}
