/* ============================================
   ALP ERP - Auth & UI Utilities Module
   Session management, role guards, dark mode,
   toast notifications, and shared UI helpers
   ============================================ */

const Auth = (() => {
  const SESSION_KEY = 'alp_session';

  function setSession(role, data = {}) {
    const session = { role, ...data, loginTime: Date.now() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch { return null; }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function getRole() {
    const s = getSession();
    return s ? s.role : null;
  }

  function isLoggedIn(requiredRole) {
    const s = getSession();
    if (!s) return false;
    if (requiredRole && s.role !== requiredRole) return false;
    return true;
  }

  function requireRole(role, redirectUrl = '../index.html') {
    if (!isLoggedIn(role)) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }

  function logout(redirectUrl = '../index.html') {
    clearSession();
    window.location.href = redirectUrl;
  }

  return { setSession, getSession, clearSession, getRole, isLoggedIn, requireRole, logout };
})();

// ── Dark Mode ──
const Theme = (() => {
  const THEME_KEY = 'alp_theme';

  function init() {
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateToggleIcon(saved);
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateToggleIcon(next);
  }

  function updateToggleIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const iconName = theme === 'dark' ? 'sun' : 'moon';
    btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] });
  }

  return { init, toggle };
})();

// ── Toast Notifications ──
const Toast = (() => {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(type, title, message, duration = 4000) {
    const icons = {
      success: 'check-circle',
      error: 'x-circle',
      warning: 'alert-triangle',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon"><i data-lucide="${icons[type] || icons.info}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <span class="toast-close" onclick="this.closest('.toast').remove()"><i data-lucide="x"></i></span>
    `;

    getContainer().appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [toast] });
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  return {
    success: (title, msg) => show('success', title, msg),
    error: (title, msg) => show('error', title, msg),
    warning: (title, msg) => show('warning', title, msg),
    info: (title, msg) => show('info', title, msg)
  };
})();

// ── Sidebar Mobile Toggle ──
const Sidebar = (() => {
  function init() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }
  }

  return { init };
})();

// ── Success Animation ──
const SuccessAnim = (() => {
  function show(duration = 2000) {
    let el = document.getElementById('successAnimation');
    if (!el) {
      el = document.createElement('div');
      el.className = 'success-animation';
      el.id = 'successAnimation';
      el.innerHTML = `<div class="success-checkmark"><i data-lucide="check"></i></div>`;
      document.body.appendChild(el);
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [el] });
    }
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  }
  return { show };
})();

// ── Form Validation ──
const Validator = (() => {
  function validateField(input, rules = {}) {
    const value = input.value.trim();
    let error = '';

    if (rules.required && !value) {
      error = rules.requiredMsg || 'This field is required';
    } else if (rules.minLength && value.length < rules.minLength) {
      error = `Minimum ${rules.minLength} characters required`;
    } else if (rules.pattern && !rules.pattern.test(value)) {
      error = rules.patternMsg || 'Invalid format';
    } else if (rules.mobile && !/^[6-9]\d{9}$/.test(value)) {
      error = 'Enter valid 10-digit mobile number';
    }

    const group = input.closest('.form-group');
    const errorEl = group?.querySelector('.form-error');

    if (error) {
      input.classList.add('is-error');
      if (group) group.classList.add('has-error');
      if (errorEl) { errorEl.textContent = error; errorEl.style.display = 'block'; }
      return false;
    } else {
      input.classList.remove('is-error');
      if (group) group.classList.remove('has-error');
      if (errorEl) { errorEl.style.display = 'none'; }
      return true;
    }
  }

  function validateForm(formEl, rulesMap) {
    let valid = true;
    for (const [name, rules] of Object.entries(rulesMap)) {
      const input = formEl.querySelector(`[name="${name}"]`);
      if (input && !validateField(input, rules)) {
        valid = false;
      }
    }
    return valid;
  }

  return { validateField, validateForm };
})();

// ── Loading State Helpers ──
const Loading = (() => {
  function setButton(btn, loading) {
    if (loading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Processing...`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
  }

  function showSkeleton(container, count = 3) {
    container.innerHTML = Array(count).fill('').map(() => `
      <div class="skeleton-row" style="padding: 16px; display: flex; gap: 12px; align-items: center;">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex:1;">
          <div class="skeleton skeleton-text w-75"></div>
          <div class="skeleton skeleton-text w-50"></div>
        </div>
      </div>
    `).join('');
  }

  return { setButton, showSkeleton };
})();

// ── Animated Counter ──
function animateCounter(element, target, duration = 1500) {
  const start = 0;
  const startTime = performance.now();
  target = parseInt(target) || 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ── WhatsApp Helper ──
function openWhatsApp(mobile, message) {
  const phone = mobile.replace(/\D/g, '');
  const fullPhone = phone.startsWith('91') ? phone : '91' + phone;
  const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ── Export Helpers ──
function exportTableToExcel(tableId, filename = 'export') {
  if (typeof XLSX === 'undefined') {
    Toast.error('Export Error', 'SheetJS library not loaded');
    return;
  }
  const table = document.getElementById(tableId);
  const wb = XLSX.utils.table_to_book(table, { sheet: 'Sheet1' });
  XLSX.writeFile(wb, `${filename}.xlsx`);
  Toast.success('Exported', 'Excel file downloaded successfully');
}

// ── Date Formatter ──
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Init on DOM Ready ──
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Sidebar.init();

  // AOS init if available
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 600, once: true, offset: 50 });
  }
});
