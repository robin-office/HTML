/* ============================================
   ALP ERP - Teacher Panel Logic
   Marks submission, PDF/Excel export
   ============================================ */

let teacherParcels = [];
let teacherName = '';

// ── Teacher Login ──
document.getElementById('teacherLoginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('teacherUser').value.trim();
  const password = document.getElementById('teacherPass').value.trim();
  const btn = document.getElementById('loginBtn');

  if (!username || !password) {
    Toast.error('Error', 'Please fill all fields');
    return;
  }

  Loading.setButton(btn, true);
  try {
    const result = await API.teacherLogin(username, password);
    teacherName = result.teacherName || username;
    Auth.setSession('teacher', { name: teacherName, username });
    showDashboard();
  } catch (error) {
    Toast.error('Login Failed', error.message || 'Invalid credentials');
  } finally {
    Loading.setButton(btn, false);
  }
});

// Check session
document.addEventListener('DOMContentLoaded', () => {
  const session = Auth.getSession();
  if (session && session.role === 'teacher') {
    teacherName = session.name;
    showDashboard();
  }
});

function showDashboard() {
  document.getElementById('loginGate').style.display = 'none';
  document.getElementById('teacherApp').style.display = 'flex';
  document.getElementById('teacherNameDisplay').textContent = teacherName;
  document.getElementById('teacherAvatar').textContent = teacherName.charAt(0).toUpperCase();
  document.getElementById('teacherSubtitle').textContent = `Welcome, ${teacherName}`;
  setTimeout(() => { Sidebar.init(); loadParcels(); }, 100);
}

// ── Load Assigned Parcels ──
async function loadParcels() {
  try {
    const result = await API.getAssignedParcels(teacherName);
    teacherParcels = result.data || [];
  } catch (error) {
    Toast.error('Error', 'Could not load your assigned parcels: ' + error.message);
    teacherParcels = [];
  }
  updateTeacherStats();
  renderTeacherTable();
}

function updateTeacherStats() {
  const total = teacherParcels.length;
  const pending = teacherParcels.filter(p => p.Correction_Status === 'Pending' || !p.Marks).length;
  const done = total - pending;

  animateCounter(document.getElementById('tStatTotal'), total);
  animateCounter(document.getElementById('tStatPending'), pending);
  animateCounter(document.getElementById('tStatDone'), done);
}

function renderTeacherTable() {
  const tbody = document.getElementById('teacherBody');
  if (teacherParcels.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <i data-lucide="inbox" style="font-size: 48px;"></i>
        <h3>No Parcels Assigned</h3>
        <p>You don't have any parcels pending for correction</p>
      </div>
    </td></tr>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  tbody.innerHTML = teacherParcels.map(p => {
    const isCompleted = p.Correction_Status === 'Completed' && p.Marks;
    const marks = p.Marks || '';
    const result = p.Result || '';
    const resultBadge = result === 'PASS'
      ? `<span class="badge badge-success">PASS</span>`
      : result === 'FAIL'
        ? `<span class="badge badge-danger">FAIL</span>`
        : `<span class="badge badge-gray">—</span>`;
    const statusBadge = isCompleted
      ? `<span class="badge badge-success badge-dot">Completed</span>`
      : `<span class="badge badge-warning badge-dot">Pending</span>`;

    return `<tr>
      <td><strong>${p.Student_ID}</strong></td>
      <td>${p.Student_Name}</td>
      <td><span class="badge badge-primary">${p.Course_Level}</span></td>
      <td>${p.Parcel_ID}</td>
      <td>${p.Parcel_Type}</td>
      <td>
        <input type="number" class="form-control" style="width: 80px; padding: 6px 10px; font-size: 13px; text-align: center;"
          value="${marks}" min="0" max="100" id="marks-${p.Student_ID}"
          ${isCompleted ? 'disabled' : ''}
          onchange="previewResult(this, '${p.Student_ID}')">
      </td>
      <td id="result-${p.Student_ID}">${resultBadge}</td>
      <td>${statusBadge}</td>
      <td>
        ${!isCompleted ? `<button class="btn btn-success btn-sm" onclick="saveMarks('${p.Student_ID}')" id="saveBtn-${p.Student_ID}">
          <i data-lucide="save"></i> Save
        </button>` : `<i data-lucide="check-circle" style="color: var(--success-500);"></i>`}
      </td>
    </tr>`;
  }).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Preview result while typing
function previewResult(input, studentId) {
  const marks = parseInt(input.value);
  const cell = document.getElementById(`result-${studentId}`);
  if (isNaN(marks)) {
    cell.innerHTML = `<span class="badge badge-gray">—</span>`;
  } else if (marks >= 40) {
    cell.innerHTML = `<span class="badge badge-success">PASS</span>`;
  } else {
    cell.innerHTML = `<span class="badge badge-danger">FAIL</span>`;
  }
}

// Save marks
async function saveMarks(studentId) {
  const input = document.getElementById(`marks-${studentId}`);
  const marks = parseInt(input.value);

  if (isNaN(marks) || marks < 0 || marks > 100) {
    Toast.error('Invalid Marks', 'Please enter marks between 0 and 100');
    return;
  }

  const btn = document.getElementById(`saveBtn-${studentId}`);
  Loading.setButton(btn, true);

  try {
    await API.submitMarks(studentId, marks);
    const parcel = teacherParcels.find(p => p.Student_ID === studentId);
    if (parcel) {
      parcel.Marks = marks.toString();
      parcel.Result = marks >= 40 ? 'PASS' : 'FAIL';
      parcel.Correction_Status = 'Completed';
    }
    Toast.success('Marks Saved', `${studentId}: ${marks} marks — ${marks >= 40 ? 'PASS' : 'FAIL'}`);
    updateTeacherStats();
    renderTeacherTable();
  } catch (error) {
    Toast.error('Save Failed', 'Could not save marks: ' + error.message);
  } finally {
    Loading.setButton(btn, false);
  }
}

// ── Export PDF ──
function exportPDF() {
  if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
    Toast.error('Error', 'PDF library not loaded');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ALP Institute - Correction Report', 14, 22);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Teacher: ${teacherName}`, 14, 32);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 38);

  const tableData = teacherParcels.map(p => [
    p.Student_ID, p.Student_Name, p.Course_Level, p.Parcel_ID, p.Marks || '—', p.Result || '—', p.Correction_Status
  ]);

  doc.autoTable({
    startY: 46,
    head: [['Student ID', 'Name', 'Course', 'Parcel ID', 'Marks', 'Result', 'Status']],
    body: tableData,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [99, 102, 241] },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });

  doc.setFontSize(8);
  doc.text('Generated by ALP Institute ERP — Developed by Santhosh A', 14, doc.internal.pageSize.height - 10);
  doc.save(`Correction_Report_${teacherName.replace(/\s/g, '_')}.pdf`);
  Toast.success('PDF Exported', 'Report downloaded successfully');
}

function exportReport() { exportPDF(); }
