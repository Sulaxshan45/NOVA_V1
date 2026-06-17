// ============================================================
// helpers.js — UUID, date math, number formatters
// ============================================================

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toISODate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function daysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

export function formatCurrency(amount) {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `Rs.\u00a0${num}`;
}

export function formatNumber(n) {
  return new Intl.NumberFormat('en-LK').format(n || 0);
}

export function getTaskEndDate(task) {
  return addDays(new Date(task.startDate), task.duration);
}

export function getStatusColor(status) {
  const map = {
    'Completed': '#22c55e',
    'In Progress': '#eab308',
    'Pending': '#eab308',
    'On Hold': '#ef4444',
  };
  return map[status] || '#a0a0b0';
}

export function getStatusClass(status) {
  const map = {
    'Completed': 'status-completed',
    'In Progress': 'status-inprogress',
    'Pending': 'status-pending',
    'On Hold': 'status-onhold',
  };
  return map[status] || '';
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text || ''));
  return div.innerHTML;
}

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
