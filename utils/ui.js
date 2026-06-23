// ============================================================
// ui.js — Shared UI primitives (Modal, Toast, Confirm)
// Extracted from app.js to avoid circular imports with modules
// ============================================================

// ============================================================
// MODAL SYSTEM
// ============================================================
function outsideClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}
function escapeKey(e) {
  if (e.key === 'Escape') closeModal();
}

export function openModal(title, contentHtml) {
  const overlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  modalTitle.textContent = title;
  modalBody.innerHTML = contentHtml;
  overlay.classList.add('modal-overlay--active');
  overlay.addEventListener('click', outsideClick);
  document.addEventListener('keydown', escapeKey);
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('modal-overlay--active');
  overlay.removeEventListener('click', outsideClick);
  document.removeEventListener('keydown', escapeKey);
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
const TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || '●'}</span>
    <span class="toast-msg">${message}</span>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
export function showConfirm(message, onConfirm) {
  const formHtml = `
    <div class="confirm-body">
      <div class="confirm-icon">⚠️</div>
      <p class="confirm-message">${message}</p>
      <div class="modal-footer" style="justify-content:center;gap:16px">
        <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-ok">Delete</button>
      </div>
    </div>
  `;
  openModal('Confirm Action', formHtml);
  document.getElementById('confirm-cancel').addEventListener('click', closeModal);
  document.getElementById('confirm-ok').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}
