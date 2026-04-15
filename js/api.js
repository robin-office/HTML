/* ============================================
   ALP ERP - API Module
   Centralized API communication layer
   ============================================ */

const API = (() => {
  // ← Replace with your deployed Apps Script Web App URL
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbxemPEdexmpai0DvdH5S0ieroG2h4Ewgng2omr-COYbcE-eZ2tKB4U6_YcCBtV_7qODRQ/exec';

  // Cache configuration
  const CACHE_PREFIX = 'alp_cache_';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ── Core fetch wrapper ──
  async function request(action, data = {}, options = {}) {
    const { useCache = false, cacheKey = null } = options;

    // Check cache first
    if (useCache && cacheKey) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }

    try {
      const payload = { action, ...data };
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'error') {
        throw new Error(result.message || 'Unknown server error');
      }

      // Store in cache
      if (useCache && cacheKey) {
        setCache(cacheKey, result);
      }

      return result;

    } catch (error) {
      console.error(`API Error [${action}]:`, error);

      // Fallback to cache on network failure
      if (cacheKey) {
        const cached = getCache(cacheKey, true);
        if (cached) {
          console.warn('Using stale cache due to network error');
          return { ...cached, _stale: true };
        }
      }

      throw error;
    }
  }

  // ── Cache helpers ──
  function setCache(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) { /* Storage full - ignore */ }
  }

  function getCache(key, ignoreExpiry = false) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (!ignoreExpiry && Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearCache() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }

  // ── Module 1: Student Parcel Entry ──
  async function submitParcel(formData) {
    return request('submitParcel', formData);
  }

  // ── Module 2: Staff Parcel Receive ──
  async function searchParcels(query) {
    return request('searchParcels', { query });
  }

  async function receiveParcel(studentId) {
    return request('receiveParcel', { studentId });
  }

  // ── Module 3: Admin Dashboard ──
  async function getAdminData() {
    return request('getAdminData', {}, { useCache: true, cacheKey: 'admin_data' });
  }

  async function getAllStudents() {
    return request('getAllStudents', {}, { useCache: true, cacheKey: 'all_students' });
  }

  async function updateStudent(studentId, updates) {
    clearCache();
    return request('updateStudent', { studentId, updates });
  }

  async function deleteStudent(studentId) {
    clearCache();
    return request('deleteStudent', { studentId });
  }

  async function assignTeacher(studentId, teacherName) {
    clearCache();
    return request('assignTeacher', { studentId, teacherName });
  }

  async function bulkAssign(studentIds, teacherName) {
    clearCache();
    return request('bulkAssign', { studentIds, teacherName });
  }

  async function getTeachers() {
    return request('getTeachers', {}, { useCache: true, cacheKey: 'teachers' });
  }

  async function createTeacher(teacherData) {
    clearCache();
    return request('createTeacher', teacherData);
  }

  async function deleteTeacher(username) {
    clearCache();
    return request('deleteTeacher', { username });
  }

  // ── Module 4: Teacher ──
  async function teacherLogin(username, password) {
    return request('teacherLogin', { username, password });
  }

  async function getAssignedParcels(teacherName) {
    return request('getAssignedParcels', { teacherName });
  }

  async function submitMarks(studentId, marks) {
    clearCache();
    return request('submitMarks', { studentId, marks });
  }

  // ── Module 5: Student Result ──
  async function studentLogin(studentId, parcelId) {
    return request('studentLogin', { studentId, parcelId });
  }

  // ── Module 6: Transactions ──
  async function submitTransaction(transactionData) {
    return request('submitTransaction', transactionData);
  }

  async function getTransactions() {
    return request('getTransactions', {}, { useCache: true, cacheKey: 'transactions' });
  }

  async function verifyPayment(studentId, parcelId, status) {
    clearCache();
    return request('verifyPayment', { studentId, parcelId, verificationStatus: status });
  }

  // ── Module 7: Course Promotion ──
  async function getPromotions() {
    return request('getPromotions', {}, { useCache: true, cacheKey: 'promotions' });
  }

  async function updatePromotion(studentId, status) {
    clearCache();
    return request('updatePromotion', { studentId, promotionStatus: status });
  }

  // ── Admin Login ──
  async function adminLogin(password) {
    return request('adminLogin', { password });
  }

  // ── Courses Management ──
  async function getCourses() {
    return request('getCourses', {}, { useCache: true, cacheKey: 'courses' });
  }

  async function addCourse(courseData) {
    clearCache();
    return request('addCourse', courseData);
  }

  // ── Student Management ──
  async function addStudent(studentData) {
    clearCache();
    return request('addStudent', studentData);
  }

  async function bulkAddStudents(studentsArray) {
    clearCache();
    return request('bulkAddStudents', { students: studentsArray });
  }

  // Public API
  return {
    submitParcel,
    searchParcels,
    receiveParcel,
    getAdminData,
    getAllStudents,
    updateStudent,
    deleteStudent,
    assignTeacher,
    bulkAssign,
    getTeachers,
    createTeacher,
    deleteTeacher,
    teacherLogin,
    getAssignedParcels,
    submitMarks,
    studentLogin,
    submitTransaction,
    getTransactions,
    verifyPayment,
    getPromotions,
    updatePromotion,
    adminLogin,
    getCourses,
    addCourse,
    addStudent,
    bulkAddStudents,
    clearCache
  };
})();
