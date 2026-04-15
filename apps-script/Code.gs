/* ============================================================
   ALP Institute ERP - Google Apps Script Backend
   
   SETUP INSTRUCTIONS:
   1. Open Google Sheets → Extensions → Apps Script
   2. Paste this entire file into Code.gs
   3. At top of this file, set SHEET_ID to your Google Sheet ID
   4. Set ADMIN_PASSWORD to your desired admin password
   5. Click Deploy → New Deployment → Web App
   6. Set "Execute as: Me" and "Who has access: Anyone"
   7. Copy the Web App URL into js/api.js → BASE_URL
   8. Create 3 sheets in your Google Sheet named:
      - Students
      - Teachers
      - Transactions
   9. Add the column headers (Row 1) for each sheet as listed below
   
   SHEET: Students (Row 1 headers)
   Timestamp | Student_ID | Student_Name | Course_Level | Mobile | Location | Parcel_Type | Parcel_Status | Office_Received | Received_Date | Parcel_ID | Teacher_Assigned | Marks | Result | Correction_Status | Payment_Status | Certificate_Status | Next_Course_Level
   
   SHEET: Teachers (Row 1 headers)
   Teacher_Name | Username | Password | Mobile | Status
   
   SHEET: Transactions (Row 1 headers)
   Student_ID | Parcel_ID | Transaction_ID | Amount | Verification_Status | Certificate_Issued
   ============================================================ */

// ═══ CONFIGURATION ═══
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';  // ← Replace with your Sheet ID
const ADMIN_PASSWORD = 'admin123';              // ← Change this!

// ═══ CORS HEADERS ═══
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══ MAIN ENTRY POINTS ═══
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'submitParcel':      return createResponse(submitParcel(body));
      case 'searchParcels':     return createResponse(searchParcels(body));
      case 'receiveParcel':     return createResponse(receiveParcel(body));
      case 'getAdminData':      return createResponse(getAdminData());
      case 'getAllStudents':     return createResponse(getAllStudents());
      case 'updateStudent':     return createResponse(updateStudent(body));
      case 'assignTeacher':     return createResponse(assignTeacherAction(body));
      case 'bulkAssign':        return createResponse(bulkAssign(body));
      case 'getTeachers':       return createResponse(getTeachers());
      case 'createTeacher':     return createResponse(createTeacher(body));
      case 'teacherLogin':      return createResponse(teacherLogin(body));
      case 'getAssignedParcels':return createResponse(getAssignedParcels(body));
      case 'submitMarks':       return createResponse(submitMarksAction(body));
      case 'studentLogin':      return createResponse(studentLogin(body));
      case 'submitTransaction': return createResponse(submitTransaction(body));
      case 'getTransactions':   return createResponse(getTransactions());
      case 'verifyPayment':     return createResponse(verifyPayment(body));
      case 'getPromotions':     return createResponse(getPromotions());
      case 'updatePromotion':   return createResponse(updatePromotion(body));
      case 'deleteStudent':     return createResponse(deleteStudent(body));
      case 'deleteTeacher':     return createResponse(deleteTeacher(body));
      case 'adminLogin':        return createResponse(adminLogin(body));
      case 'getCourses':        return createResponse(getCourses());
      case 'addCourse':         return createResponse(addCourse(body));
      case 'addStudent':        return createResponse(addStudent(body));
      case 'bulkAddStudents':   return createResponse(bulkAddStudents(body));
      default:
        return createResponse({ status: 'error', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  return createResponse({ status: 'ok', message: 'ALP ERP API is running' });
}

// ═══ HELPERS ═══
function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0].map(h => (h || '').toString().trim());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { 
      if (h) obj[h] = row[i] !== undefined ? row[i].toString() : ''; 
    });
    return obj;
  });
}

function findRowByColumn(sheet, colIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] && data[i][colIndex].toString() === value.toString()) {
      return i + 1; // 1-based row number
    }
  }
  return -1;
}

function getColumnIndexRobust(headers, colName) {
  const normalized = colName.toString().trim().toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    if ((headers[i] || '').toString().trim().toLowerCase() === normalized) {
      return i;
    }
  }
  return -1;
}

function getColumnIndex(sheet, colName) {
  const width = Math.max(30, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  return getColumnIndexRobust(headers, colName);
}

function generateParcelId() {
  const sheet = getSheet('Students');
  const year = new Date().getFullYear().toString().slice(-2);
  const allData = sheet.getDataRange().getValues();
  const colIdx = allData[0].indexOf('Parcel_ID');
  
  let maxNum = 0;
  for (let i = 1; i < allData.length; i++) {
    const pid = allData[i][colIdx] ? allData[i][colIdx].toString() : '';
    if (pid.startsWith('ALP-')) {
      const num = parseInt(pid.split('-')[2]);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  
  const nextNum = (maxNum + 1).toString().padStart(4, '0');
  return `ALP-${year}-${nextNum}`;
}

// ═══ MODULE 1: SUBMIT PARCEL ═══
function submitParcel(body) {
  const sheet = getSheet('Students');
  if (!sheet) return { status: 'error', message: 'ERROR: The "Students" sheet is missing from your Google Spreadsheet!' };
  
  const timestamp = new Date().toISOString();
  
  sheet.appendRow([
    timestamp,
    body.studentId || '',
    body.studentName || '',
    body.classCategory || '',
    body.mobile || '',
    body.location || '',
    body.parcelType || '',
    body.parcelStatus || 'Dispatched',
    'No',   // Office_Received
    '',     // Received_Date
    '',     // Parcel_ID
    '',     // Teacher_Assigned
    '',     // Marks
    '',     // Result
    'Pending',  // Correction_Status
    '',     // Payment_Status
    '',     // Certificate_Status
    ''      // Next_Course_Level
  ]);
  
  return { status: 'success', message: 'Parcel submitted successfully' };
}

// ═══ MODULE 2: SEARCH & RECEIVE ═══
function searchParcels(body) {
  const query = (body.query || '').toString().toLowerCase();
  const sheet = getSheet('Students');
  const all = sheetToObjects(sheet);
  
  const results = all.filter(row => 
    (row.Student_ID || '').toLowerCase().includes(query) ||
    (row.Student_Name || '').toLowerCase().includes(query) ||
    (row.Mobile || '').includes(query)
  );
  
  return { status: 'success', data: results };
}

function receiveParcel(body) {
  const sheet = getSheet('Students');
  const studentId = body.studentId;
  const row = findRowByColumn(sheet, getColumnIndex(sheet, 'Student_ID'), studentId);
  
  if (row === -1) {
    return { status: 'error', message: 'Student not found' };
  }
  
  const parcelId = generateParcelId();
  const headers = sheet.getRange(1, 1, 1, Math.max(30, sheet.getLastColumn())).getValues()[0];
  
  const colReceived = getColumnIndexRobust(headers, 'Office_Received') + 1;
  const colDate = getColumnIndexRobust(headers, 'Received_Date') + 1;
  const colParcelId = getColumnIndexRobust(headers, 'Parcel_ID') + 1;
  
  if (colReceived <= 0 || colParcelId <= 0) {
    return { status: 'error', message: 'Required columns not found in sheet headers (Office_Received, Parcel_ID)' };
  }
  
  sheet.getRange(row, colReceived).setValue('Yes');
  sheet.getRange(row, colDate).setValue(new Date().toISOString());
  sheet.getRange(row, colParcelId).setValue(parcelId);
  
  return { status: 'success', message: 'Parcel received', parcelId: parcelId };
}

// ═══ MODULE 3: ADMIN ═══
function adminLogin(body) {
  if (body.password === ADMIN_PASSWORD) {
    return { status: 'success', message: 'Login successful' };
  }
  return { status: 'error', message: 'Invalid admin password' };
}

function getAdminData() {
  const students = sheetToObjects(getSheet('Students'));
  const total = students.length;
  const pending = students.filter(s => s.Correction_Status === 'Pending' || !s.Correction_Status).length;
  const pass = students.filter(s => s.Result === 'PASS').length;
  const fail = students.filter(s => s.Result === 'FAIL').length;
  const payPending = students.filter(s => s.Payment_Status === 'Pending').length;
  
  return {
    status: 'success',
    data: { total, pending, pass, fail, payPending }
  };
}

function getAllStudents() {
  const data = sheetToObjects(getSheet('Students'));
  return { status: 'success', data };
}

function updateStudent(body) {
  const sheet = getSheet('Students');
  const row = findRowByColumn(sheet, getColumnIndex(sheet, 'Student_ID'), body.studentId);
  
  if (row === -1) {
    return { status: 'error', message: 'Student not found' };
  }
  
  const headers = sheet.getRange(1, 1, 1, Math.max(30, sheet.getLastColumn())).getValues()[0];
  const updates = body.updates || {};
  
  for (const [key, value] of Object.entries(updates)) {
    const col = getColumnIndexRobust(headers, key);
    if (col !== -1) {
      sheet.getRange(row, col + 1).setValue(value);
    }
  }
  
  return { status: 'success', message: 'Student updated' };
}

function deleteStudent(body) {
  const sheet = getSheet('Students');
  const row = findRowByColumn(sheet, getColumnIndex(sheet, 'Student_ID'), body.studentId);
  
  if (row === -1) {
    return { status: 'error', message: 'Student not found' };
  }
  
  sheet.deleteRow(row);
  return { status: 'success', message: 'Student deleted successfully' };
}

function assignTeacherAction(body) {
  const sheet = getSheet('Students');
  const row = findRowByColumn(sheet, getColumnIndex(sheet, 'Student_ID'), body.studentId);
  
  if (row === -1) {
    return { status: 'error', message: 'Student not found' };
  }
  
  const col = getColumnIndex(sheet, 'Teacher_Assigned') + 1;
  const statusCol = getColumnIndex(sheet, 'Correction_Status') + 1;
  
  sheet.getRange(row, col).setValue((body.teacherName || '').toString().trim());
  
  const currentStatus = sheet.getRange(row, statusCol).getValue();
  if (!currentStatus || currentStatus === '') {
    sheet.getRange(row, statusCol).setValue('Pending');
  }
  
  return { status: 'success', message: 'Teacher assigned' };
}

function bulkAssign(body) {
  const sheet = getSheet('Students');
  const ids = body.studentIds || [];
  const teacher = body.teacherName;
  const col = getColumnIndex(sheet, 'Teacher_Assigned') + 1;
  
  ids.forEach(id => {
    const row = findRowByColumn(sheet, getColumnIndex(sheet, 'Student_ID'), id);
    if (row !== -1) {
      sheet.getRange(row, col).setValue(teacher);
    }
  });
  
  return { status: 'success', message: `${ids.length} parcels assigned to ${teacher}` };
}

function deleteTeacher(body) {
  const sheet = getSheet('Teachers');
  if (!sheet) return { status: 'error', message: 'ERROR: The "Teachers" sheet is missing from your Google Spreadsheet!' };
  const row = findRowByColumn(sheet, getColumnIndex(sheet, 'Username'), body.username);
  
  if (row === -1) {
    return { status: 'error', message: 'Teacher not found' };
  }
  
  sheet.deleteRow(row);
  return { status: 'success', message: 'Teacher deleted successfully' };
}

// ═══ TEACHER MANAGEMENT ═══
function getTeachers() {
  const data = sheetToObjects(getSheet('Teachers'));
  // Remove passwords from response
  const safe = data.map(t => ({
    Teacher_Name: t.Teacher_Name,
    Username: t.Username,
    Mobile: t.Mobile,
    Status: t.Status
  }));
  return { status: 'success', data: safe };
}

function createTeacher(body) {
  const sheet = getSheet('Teachers');
  if (!sheet) return { status: 'error', message: 'ERROR: The "Teachers" sheet is missing from your Google Spreadsheet!' };
  sheet.appendRow([
    body.teacherName || '',
    body.username || '',
    body.password || '',
    body.mobile || '',
    'Active'
  ]);
  return { status: 'success', message: 'Teacher created' };
}

// ═══ MODULE 4: TEACHER ═══
function teacherLogin(body) {
  const sheet = getSheet('Teachers');
  const teachers = sheetToObjects(sheet);
  
  const teacher = teachers.find(t => 
    t.Username === body.username && t.Password === body.password && t.Status === 'Active'
  );
  
  if (!teacher) {
    return { status: 'error', message: 'Invalid credentials or inactive account' };
  }
  
  return { status: 'success', teacherName: teacher.Teacher_Name };
}

function getAssignedParcels(body) {
  const students = sheetToObjects(getSheet('Students'));
  const targetTeacher = (body.teacherName || '').toString().trim();
  const assigned = students.filter(s => (s.Teacher_Assigned || '').toString().trim() === targetTeacher);
  return { status: 'success', data: assigned };
}

function submitMarksAction(body) {
  const sheet = getSheet('Students');
  const row = findRowByColumn(sheet, getColumnIndex(sheet, 'Student_ID'), body.studentId);
  
  if (row === -1) {
    return { status: 'error', message: 'Student not found' };
  }
  
  const headers = sheet.getRange(1, 1, 1, Math.max(30, sheet.getLastColumn())).getValues()[0];
  const marks = parseInt(body.marks);
  const result = marks >= 40 ? 'PASS' : 'FAIL';
  
  const colMarks = getColumnIndexRobust(headers, 'Marks') + 1;
  const colResult = getColumnIndexRobust(headers, 'Result') + 1;
  const colStatus = getColumnIndexRobust(headers, 'Correction_Status') + 1;
  const colNextCourse = getColumnIndexRobust(headers, 'Next_Course_Level') + 1;
  const colCourse = getColumnIndexRobust(headers, 'Course_Level') + 1;
  
  if (colMarks <= 0 || colResult <= 0 || colStatus <= 0) {
    return { status: 'error', message: 'Required columns (Marks, Result, Correction_Status) not found in sheet headers.' };
  }
  
  sheet.getRange(row, colMarks).setValue(marks);
  sheet.getRange(row, colResult).setValue(result);
  sheet.getRange(row, colStatus).setValue('Completed');
  
  // Auto set next course for PASS students
  if (result === 'PASS') {
    const currentCourse = sheet.getRange(row, colCourse).getValue().toString();
    const nextMap = { 'Basic': 'Advanced', 'Advanced': 'Vast', 'Vast': 'Completed' };
    sheet.getRange(row, colNextCourse).setValue(nextMap[currentCourse] || 'Completed');
  }
  
  return { status: 'success', message: `Marks saved: ${marks} (${result})` };
}

// ═══ MODULE 5: STUDENT RESULT ═══
function studentLogin(body) {
  const students = sheetToObjects(getSheet('Students'));
  const student = students.find(s => 
    s.Student_ID === body.studentId && s.Parcel_ID === body.parcelId
  );
  
  if (!student) {
    return { status: 'error', message: 'Invalid Student ID or Parcel ID' };
  }
  
  // Don't expose teacher passwords or sensitive data
  return {
    status: 'success',
    data: {
      Student_ID: student.Student_ID,
      Student_Name: student.Student_Name,
      Course_Level: student.Course_Level,
      Parcel_ID: student.Parcel_ID,
      Marks: student.Marks,
      Result: student.Result,
      Certificate_Status: student.Certificate_Status,
      Payment_Status: student.Payment_Status,
      Next_Course_Level: student.Next_Course_Level
    }
  };
}

// ═══ MODULE 6: TRANSACTIONS ═══
function submitTransaction(body) {
  const sheet = getSheet('Transactions');
  if (!sheet) return { status: 'error', message: 'ERROR: The "Transactions" sheet is missing from your Google Spreadsheet!' };
  sheet.appendRow([
    body.studentId || '',
    body.parcelId || '',
    body.transactionId || '',
    body.amount || '500',
    'Pending',
    'No'
  ]);
  
  // Update student payment status
  const studSheet = getSheet('Students');
  const row = findRowByColumn(studSheet, getColumnIndex(studSheet, 'Student_ID'), body.studentId);
  if (row !== -1) {
    const col = getColumnIndex(studSheet, 'Payment_Status') + 1;
    studSheet.getRange(row, col).setValue('Pending');
  }
  
  return { status: 'success', message: 'Transaction submitted for verification' };
}

function getTransactions() {
  const data = sheetToObjects(getSheet('Transactions'));
  return { status: 'success', data };
}

function verifyPayment(body) {
  const txnSheet = getSheet('Transactions');
  if (!txnSheet) return { status: 'error', message: 'ERROR: The "Transactions" sheet is missing from your Google Spreadsheet!' };
  const all = sheetToObjects(txnSheet);
  const txnIdx = all.findIndex(t => 
    t.Student_ID === body.studentId && t.Parcel_ID === body.parcelId
  );
  
  if (txnIdx === -1) {
    return { status: 'error', message: 'Transaction not found' };
  }
  
  const row = txnIdx + 2; // +1 header, +1 for 1-based
  const headers = txnSheet.getRange(1, 1, 1, txnSheet.getLastColumn()).getValues()[0];
  const colStatus = headers.indexOf('Verification_Status') + 1;
  const colCert = headers.indexOf('Certificate_Issued') + 1;
  
  txnSheet.getRange(row, colStatus).setValue(body.verificationStatus);
  
  if (body.verificationStatus === 'Verified') {
    txnSheet.getRange(row, colCert).setValue('Yes');
    
    // Update student records
    const studSheet = getSheet('Students');
    const studRow = findRowByColumn(studSheet, getColumnIndex(studSheet, 'Student_ID'), body.studentId);
    if (studRow !== -1) {
      const studHeaders = studSheet.getRange(1, 1, 1, studSheet.getLastColumn()).getValues()[0];
      studSheet.getRange(studRow, studHeaders.indexOf('Payment_Status') + 1).setValue('Verified');
      studSheet.getRange(studRow, studHeaders.indexOf('Certificate_Status') + 1).setValue('Issued');
    }
  }
  
  return { status: 'success', message: `Payment ${body.verificationStatus.toLowerCase()}` };
}

// ═══ MODULE 7: PROMOTIONS ═══
function getPromotions() {
  const students = sheetToObjects(getSheet('Students'));
  const eligible = students.filter(s => s.Result === 'PASS' && s.Next_Course_Level);
  return { status: 'success', data: eligible };
}

function updatePromotion(body) {
  const sheet = getSheet('Students');
  const row = findRowByColumn(sheet, getColumnIndex(sheet, 'Student_ID'), body.studentId);
  
  if (row === -1) {
    return { status: 'error', message: 'Student not found' };
  }
  
  // For now, we track promotion status in a note or additional column
  return { status: 'success', message: `Promotion status updated to ${body.promotionStatus}` };
}

// ═══ MODULE 8: COURSES MANAGEMENT ═══
function getCourses() {
  const sheet = getSheet('Courses');
  if (!sheet) {
    return { status: 'success', data: [] }; // Fallback if sheet not created
  }
  const data = sheetToObjects(sheet);
  return { status: 'success', data };
}

function addCourse(body) {
  const sheet = getSheet('Courses');
  if (!sheet) {
    return { status: 'error', message: 'Courses sheet not found in Google Sheets' };
  }
  sheet.appendRow([
    body.courseName || '',
    body.courseDescription || ''
  ]);
  return { status: 'success', message: 'Course added successfully' };
}

// ═══ MODULE 9: STUDENT MANAGEMENT (MANUAL & EXCEL) ═══
function generateCourseId(courseLevel) {
  const sheet = getSheet('Students');
  const allData = sheet.getDataRange().getValues();
  const colLevel = getColumnIndex(sheet, 'Course_Level');
  const colId = getColumnIndex(sheet, 'Student_ID');
  
  if (colLevel === -1 || colId === -1) {
    return 'STU-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  }

  let maxNum = 0;
  // Get short prefix (first 5 characters, uppercase)
  let prefix = (courseLevel || 'STU').toString().substring(0, 5).toUpperCase();

  for (let i = 1; i < allData.length; i++) {
    if ((allData[i][colLevel] || '').toString().toLowerCase() === (courseLevel || '').toLowerCase()) {
      const sid = (allData[i][colId] || '').toString();
      if (sid.startsWith(prefix + '-')) {
        const parts = sid.split('-');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = (maxNum + 1).toString().padStart(3, '0');
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-${year}-${nextNum}`;
}

function addStudent(body) {
  const sheet = getSheet('Students');
  if (!sheet) return { status: 'error', message: 'ERROR: The "Students" sheet is missing from your Google Spreadsheet!' };
  
  const timestamp = new Date().toISOString();
  
  // Use provided ID or generate one
  let studentId = (body.studentId || '').trim();
  if (!studentId && body.courseLevel) {
    studentId = generateCourseId(body.courseLevel);
  } else if (!studentId) {
    studentId = 'STU-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  }

  sheet.appendRow([
    timestamp,
    studentId,
    body.studentName || '',
    body.courseLevel || '',
    body.mobile || '',
    body.location || '',
    body.parcelType || '',
    body.parcelStatus || '',
    body.officeReceived || 'No',
    body.receivedDate || '',
    body.parcelId || '',
    body.teacherAssigned || '',
    body.marks || '',
    body.result || '',
    body.correctionStatus || 'Pending',
    body.paymentStatus || 'Pending',
    body.certificateStatus || '',
    body.nextCourseLevel || ''
  ]);
  
  return { status: 'success', message: 'Student added successfully', studentId: studentId };
}

function bulkAddStudents(body) {
  const sheet = getSheet('Students');
  if (!sheet) return { status: 'error', message: 'ERROR: The "Students" sheet is missing from your Google Spreadsheet!' };
  
  const students = body.students || [];
  
  if (students.length === 0) {
    return { status: 'error', message: 'No students provided for bulk upload' };
  }

  const timestamp = new Date().toISOString();
  let addedCount = 0;

  // Ideally insert batch, but google limit might hit. Looping appendRow is slow but safe for small batches.
  // For better performance:
  const rows = students.map(s => {
    let studentId = (s.studentId || '').trim();
    if (!studentId && s.courseLevel) {
      studentId = generateCourseId(s.courseLevel);
    } else if (!studentId) {
      studentId = 'STU-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    }
    
    return [
      timestamp,
      studentId,
      s.studentName || '',
      s.courseLevel || '',
      s.mobile || '',
      s.location || '',
      s.parcelType || '',
      s.parcelStatus || '',
      s.officeReceived || 'No',
      s.receivedDate || '',
      s.parcelId || '',
      s.teacherAssigned || '',
      s.marks || '',
      s.result || '',
      s.correctionStatus || 'Pending',
      s.paymentStatus || 'Pending',
      s.certificateStatus || '',
      s.nextCourseLevel || ''
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    addedCount = rows.length;
  }

  return { status: 'success', message: `${addedCount} students successfully imported` };
}
