// ============================================================
// app.js — SPA Router, State, UI Primitives
// ============================================================

import { initProjects, renderProjects, getActiveProject, setActiveProject } from './modules/projects.js';
import { renderTasks } from './modules/tasks.js';
import { renderInventory } from './modules/inventory.js';
import { renderGantt } from './modules/gantt.js';
import { renderBilling } from './modules/billing.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderExpenses } from './modules/expenses.js';
import { getSettings, saveSettings, getProjects, saveProjects, getTasks, saveTasks, getMaterials, saveMaterials, exportAllData, importAllData, loadWorkspaceFromServer, clearLocalSessionCache } from './utils/storage.js';
import { formatDate } from './utils/helpers.js';

// ============================================================
// GOOGLE CLIENT ID — set this to your Google OAuth Client ID
// ============================================================
const GOOGLE_CLIENT_ID = '341328479224-m81dbansj3tbbruvasn9l1tcqml2qnbs.apps.googleusercontent.com';

// ============================================================
// AUTH STATE & SESSION (localStorage-based — no server needed)
// ============================================================
let currentUser = null;

function checkAuthSession() {
  try {
    const stored = localStorage.getItem('nova_session_user');
    if (stored) {
      currentUser = JSON.parse(stored);
      updateSidebarUser();
      const loginScr = document.getElementById('login-screen');
      const appSh = document.getElementById('app-shell');
      if (loginScr) loginScr.style.display = 'none';
      if (appSh) appSh.style.display = 'flex';
      return true;
    }
  } catch (err) {
    console.error('Session check error:', err);
  }
  currentUser = null;
  updateSidebarUser();
  const loginScr = document.getElementById('login-screen');
  const appSh = document.getElementById('app-shell');
  if (loginScr) loginScr.style.display = 'flex';
  if (appSh) appSh.style.display = 'none';
  return false;
}

function updateSidebarUser() {
  const topbarUser = document.getElementById('topbar-user');
  const avatarEl = document.getElementById('topbar-avatar');
  const nameEl = document.getElementById('topbar-username');
  const emailEl = document.getElementById('topbar-email');
  const companyEl = document.getElementById('topbar-company');

  if (currentUser && topbarUser) {
    topbarUser.style.display = 'inline-block';
    if (avatarEl) avatarEl.src = currentUser.picture || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80';
    if (nameEl) nameEl.textContent = currentUser.name || 'User';
    if (emailEl) emailEl.textContent = currentUser.email || '';
    if (companyEl) {
      const parts = [];
      if (currentUser.designation) parts.push(currentUser.designation);
      if (currentUser.company) parts.push('🏢 ' + currentUser.company);
      if (parts.length) {
        companyEl.innerHTML = parts.join('<br>');
        companyEl.style.display = '';
      } else {
        companyEl.style.display = 'none';
      }
    }
  } else if (topbarUser) {
    topbarUser.style.display = 'none';
  }
}

// ============================================================
// SECTION REGISTRY
// ============================================================
const SECTIONS = {
  dashboard: { id: 'dashboard', icon: '🏠', label: 'Dashboard', render: renderDashboard },
  projects:  { id: 'projects',  icon: '📁', label: 'Projects',  render: renderProjects },
  tasks:     { id: 'tasks',     icon: '✅', label: 'Tasks',     render: renderTasks },
  inventory: { id: 'inventory', icon: '📦', label: 'Inventory', render: renderInventory },
  expenses:  { id: 'expenses',  icon: '💸', label: 'Additional Expenses', render: renderExpenses },
  gantt:     { id: 'gantt',     icon: '📊', label: 'Gantt',     render: renderGantt },
  billing:   { id: 'billing',   icon: '💰', label: 'Billing & BOQ', render: renderBilling },
  projectdata: { id: 'projectdata', icon: '💾', label: 'Project Data', render: renderProjectData },
  chat:      { id: 'chat',      icon: '💬', label: 'Chat',      render: renderChat },
  settings:  { id: 'settings',  icon: '⚙️', label: 'Settings',  render: renderSettings },
};

let currentSection = 'dashboard';

// ============================================================
// NAVIGATION
// ============================================================
window.navigateTo = function(sectionId) {
  if (!SECTIONS[sectionId]) return;
  currentSection = sectionId;

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('nav-item--active', el.dataset.section === sectionId);
  });

  // Show/hide sections
  document.querySelectorAll('.section').forEach(el => {
    el.classList.toggle('section--active', el.id === `section-${sectionId}`);
  });

  // Render section
  SECTIONS[sectionId].render();
  updateTopBar();
  updateSidebarProject();
  updateNavVisibility();
};

// ============================================================
// NAV VISIBILITY — show/hide project-only nav items
// ============================================================
function updateNavVisibility() {
  const project = getActiveProject();
  document.body.classList.toggle('project-active', !!project);
  const chip = document.getElementById('sidebar-project-chip');
  if (chip) chip.style.display = project ? '' : 'none';
}

// ============================================================
// TOP BAR UPDATE
// ============================================================
function updateTopBar() {
  const project = getActiveProject();

  // Section label
  const breadcrumb = document.getElementById('topbar-section');
  if (breadcrumb) breadcrumb.textContent = SECTIONS[currentSection]?.label || '';

  // Project badge — only visible when a project is active
  const sep   = document.getElementById('topbar-sep');
  const badge = document.getElementById('topbar-badge');
  const nameEl = document.getElementById('topbar-project');
  const show = !!project;
  if (sep)    sep.style.display   = show ? '' : 'none';
  if (badge)  badge.style.display = show ? '' : 'none';
  if (nameEl) nameEl.textContent  = project ? project.name : '';
}

function updateSidebarProject() {
  const project = getActiveProject();
  const el = document.getElementById('sidebar-active-project');
  if (el) el.textContent = project ? project.name : 'No project selected';
}

// ============================================================
// THEME TOGGLE
// ============================================================
function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
}

function setupThemeToggle() {
  const settings = getSettings();
  applyTheme(settings.theme || 'dark');

  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light-theme');
    const next = isLight ? 'dark' : 'light';
    const s = getSettings();
    saveSettings({ ...s, theme: next });
    applyTheme(next);
    // Re-render current section to pick up any inline style updates
    if (SECTIONS[currentSection]) SECTIONS[currentSection].render();
  });
}

// ============================================================
// MODAL SYSTEM
// ============================================================
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

function outsideClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}
function escapeKey(e) {
  if (e.key === 'Escape') closeModal();
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

// ============================================================
// SETTINGS MODULE
// ============================================================
function renderSettings() {
  const settings = getSettings();
  const container = document.getElementById('section-settings');
  container.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">⚙️ Settings</h2>
    </div>

    <div class="settings-grid">
      <!-- Company Settings -->
      <div class="glass-card">
        <h3 class="card-title">🏢 Company Settings</h3>
        <form id="settings-form" style="margin-top:16px">
          <div class="form-group">
            <label class="form-label">Company / App Name</label>
            <input id="s-company" class="form-input" type="text" value="${settings.companyName}" placeholder="NOVA Construction">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Default Mason Rate (Rs./mason/day)</label>
              <input id="s-mason" class="form-input" type="number" min="0" value="${settings.defaultMasonRate}" placeholder="2500">
            </div>
            <div class="form-group">
              <label class="form-label">Default Labour Rate (Rs./labourer/day)</label>
              <input id="s-labour" class="form-input" type="number" min="0" value="${settings.defaultLabourRate}" placeholder="1500">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Default Profit Margin (%)</label>
            <input id="s-profit" class="form-input" type="number" min="0" max="100" value="${settings.defaultProfitMargin}">
          </div>
          <button type="submit" class="btn btn-primary">Save Settings</button>
        </form>
      </div>

      <!-- Theme -->
      <div class="glass-card">
        <h3 class="card-title">🎨 Theme</h3>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
          <div class="theme-option ${settings.theme !== 'light' ? 'theme-option--active' : ''}" id="theme-opt-dark" style="cursor:pointer">
            <div class="theme-preview theme-preview--dark"></div>
            <span>Dark ${settings.theme !== 'light' ? '✓ Active' : ''}</span>
          </div>
          <div class="theme-option ${settings.theme === 'light' ? 'theme-option--active' : ''}" id="theme-opt-light" style="cursor:pointer">
            <div class="theme-preview theme-preview--light"></div>
            <span>Light ${settings.theme === 'light' ? '✓ Active' : ''}</span>
          </div>
        </div>
      </div>

      <!-- Data Management -->
      <div class="glass-card">
        <h3 class="card-title">💾 Data Management</h3>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
          <button class="btn btn-ghost" id="btn-export-json">
            📤 Export All Data (JSON)
          </button>
          <label class="btn btn-ghost" style="cursor:pointer">
            📥 Import Data (JSON)
            <input type="file" id="import-file" accept=".json" style="display:none">
          </label>
          <div class="divider"></div>
          <button class="btn btn-danger" id="btn-clear-data">
            🗑️ Clear All Data
          </button>
        </div>
      </div>

      <!-- App Info -->
      <div class="glass-card">
        <h3 class="card-title">ℹ️ App Info</h3>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
          <div class="info-row"><span>Version</span><span>1.0.0</span></div>
          <div class="info-row"><span>Projects</span><span>${getProjects().length}</span></div>
          <div class="info-row"><span>Storage</span><span>localStorage</span></div>
          <div class="info-row"><span>Built with</span><span>Vanilla JS</span></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    saveSettings({
      companyName: document.getElementById('s-company').value.trim() || 'NOVA Construction',
      defaultMasonRate: parseFloat(document.getElementById('s-mason').value) || 2500,
      defaultLabourRate: parseFloat(document.getElementById('s-labour').value) || 1500,
      defaultProfitMargin: parseFloat(document.getElementById('s-profit').value) || 15,
    });
    showToast('Settings saved ✓', 'success');
  });

  // Theme card click handlers
  document.getElementById('theme-opt-dark')?.addEventListener('click', () => {
    const s = getSettings();
    saveSettings({ ...s, theme: 'dark' });
    applyTheme('dark');
    renderSettings();
  });
  document.getElementById('theme-opt-light')?.addEventListener('click', () => {
    const s = getSettings();
    saveSettings({ ...s, theme: 'light' });
    applyTheme('light');
    renderSettings();
  });

  document.getElementById('btn-export-json').addEventListener('click', () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pmPro_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported ✓', 'success');
  });

  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target.result);
        importAllData(data);
        showToast('Data imported ✓', 'success');
        window.navigateTo('dashboard');
      } catch {
        showToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-clear-data').addEventListener('click', () => {
    showConfirm('This will permanently delete ALL projects, tasks, and materials. Are you sure?', () => {
      localStorage.clear();
      showToast('All data cleared', 'info');
      location.reload();
    });
  });
}

// ============================================================
// PROJECT DATA MODULE (Project-specific Import/Export/Clear)
// ============================================================
function renderProjectData() {
  const project = getActiveProject();
  const container = document.getElementById('section-projectdata');
  if (!project) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div><h3>No active project</h3><p>Please open a project first.</p></div>`;
    return;
  }

  const pTasks = getTasks().filter(t => t.projectId === project.id);
  const pMaterials = getMaterials().filter(m => m.projectId === project.id);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">💾 Project Data Management</h2>
        <p class="section-subtitle">${project.name} · Local Storage Data</p>
      </div>
    </div>

    <div class="settings-grid" style="margin-top: 24px;">
      <!-- Project Data Info -->
      <div class="glass-card">
        <h3 class="card-title">ℹ️ Project Summary</h3>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
          <div class="info-row"><span>Project Name</span><span>${project.name}</span></div>
          <div class="info-row"><span>Client</span><span>${project.client}</span></div>
          <div class="info-row"><span>Total Tasks</span><span>${pTasks.length}</span></div>
          <div class="info-row"><span>Inventory Items</span><span>${pMaterials.length}</span></div>
        </div>
      </div>

      <!-- Import / Export / Clear -->
      <div class="glass-card">
        <h3 class="card-title">💾 Project Backup & Restore</h3>
        <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
          <button class="btn btn-ghost" id="btn-export-project-json">
            📤 Export Project Data (JSON)
          </button>
          
          <label class="btn btn-ghost" style="cursor:pointer">
            📥 Import Project Data (JSON)
            <input type="file" id="import-project-file" accept=".json" style="display:none">
          </label>
          
          <div class="divider"></div>
          
          <button class="btn btn-danger" id="btn-clear-project-data">
            🗑️ Clear Project Data
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind Export
  document.getElementById('btn-export-project-json').addEventListener('click', () => {
    const data = {
      version: 'pm-pro-project-1.0',
      project: project,
      tasks: getTasks().filter(t => t.projectId === project.id),
      materials: getMaterials().filter(m => m.projectId === project.id)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Project data exported ✓', 'success');
  });

  // Bind Import
  document.getElementById('import-project-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target.result);
        
        if (!data.project || !Array.isArray(data.tasks) || !Array.isArray(data.materials)) {
          showToast('Invalid Project JSON format.', 'error');
          return;
        }

        // Overwrite active project tasks/materials
        let allTasks = getTasks().filter(t => t.projectId !== project.id);
        let allMaterials = getMaterials().filter(m => m.projectId !== project.id);

        const importedTasks = data.tasks.map(t => {
          t.projectId = project.id;
          return t;
        });
        const importedMaterials = data.materials.map(m => {
          m.projectId = project.id;
          return m;
        });

        allTasks = [...allTasks, ...importedTasks];
        allMaterials = [...allMaterials, ...importedMaterials];

        saveTasks(allTasks);
        saveMaterials(allMaterials);

        // Update project attributes
        const projectsList = getProjects();
        const pIdx = projectsList.findIndex(p => p.id === project.id);
        if (pIdx !== -1) {
          projectsList[pIdx].name = data.project.name || projectsList[pIdx].name;
          projectsList[pIdx].client = data.project.client || projectsList[pIdx].client;
          projectsList[pIdx].location = data.project.location || projectsList[pIdx].location;
          projectsList[pIdx].startDate = data.project.startDate || projectsList[pIdx].startDate;
          projectsList[pIdx].description = data.project.description || projectsList[pIdx].description;
          projectsList[pIdx].masonRate = data.project.masonRate || projectsList[pIdx].masonRate;
          projectsList[pIdx].labourRate = data.project.labourRate || projectsList[pIdx].labourRate;
          projectsList[pIdx].profitMargin = data.project.profitMargin || projectsList[pIdx].profitMargin;
          saveProjects(projectsList);
        }

        showToast('Project data imported ✓', 'success');
        window.dispatchEvent(new CustomEvent('activeProjectChanged'));
      } catch (err) {
        showToast('Error reading file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });

  // Bind Clear
  document.getElementById('btn-clear-project-data').addEventListener('click', () => {
    showConfirm('This will permanently delete all tasks and materials for THIS project. Are you sure?', () => {
      const allTasks = getTasks().filter(t => t.projectId !== project.id);
      const allMaterials = getMaterials().filter(m => m.projectId !== project.id);
      
      saveTasks(allTasks);
      saveMaterials(allMaterials);

      showToast('Project data cleared', 'info');
      window.dispatchEvent(new CustomEvent('tasksChanged'));
      renderProjectData();
    });
  });
}

// ============================================================
// CHAT MODULE (placeholder)
// ============================================================
function renderChat() {
  const container = document.getElementById('section-chat');
  container.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">💬 Team Chat</h2>
      <span class="pill pill--yellow">Coming Soon</span>
    </div>
    <div class="glass-card" style="margin-top:24px;text-align:center;padding:60px 24px">
      <div style="font-size:64px;margin-bottom:16px">💬</div>
      <h3 style="font-size:20px;font-weight:700;margin-bottom:8px">Team Chat — Phase 2</h3>
      <p style="color:var(--text-muted);max-width:400px;margin:0 auto">
        Real-time team messaging, task mentions, and file sharing are planned for the next release.
        Stay tuned!
      </p>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <div class="feature-chip">👥 Team mentions</div>
        <div class="feature-chip">📎 File attachments</div>
        <div class="feature-chip">🔔 Notifications</div>
        <div class="feature-chip">🔍 Search messages</div>
      </div>
    </div>
  `;
}

// ============================================================
// PROFILE SETUP MODAL — shown on first login (guest or Google)
// ============================================================
function showProfileSetup(prefillName, prefillEmail, prefillPicture, onComplete) {
  const formHtml = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:52px;margin-bottom:10px;">👤</div>
      <p style="color:var(--text-muted);font-size:14px;line-height:1.6;">Tell us about yourself to personalise your NOVA workspace</p>
    </div>
    <div class="form-group">
      <label class="form-label">Your Name <span style="color:var(--danger)">*</span></label>
      <input id="setup-name" class="form-input" type="text" placeholder="e.g. Sulaxshan Kumar" value="${prefillName || ''}" autocomplete="name" maxlength="60" />
    </div>
    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">Job Title / Designation</label>
      <input id="setup-designation" class="form-input" type="text" placeholder="e.g. Project Manager, Site Engineer, Owner" maxlength="80" />
    </div>
    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">Company / Organization</label>
      <input id="setup-company" class="form-input" type="text" placeholder="e.g. ABC Construction Pvt. Ltd." autocomplete="organization" maxlength="80" />
    </div>
    <button class="btn btn-primary" id="setup-continue-btn" style="margin-top:20px;width:100%;padding:14px;font-size:15px;">
      ✓ &nbsp;Continue to NOVA
    </button>
  `;
  openModal('Set Up Your Profile', formHtml);

  setTimeout(() => {
    const nameInput = document.getElementById('setup-name');
    if (nameInput) nameInput.focus();

    const doSubmit = () => {
      const name = document.getElementById('setup-name')?.value.trim();
      const designation = document.getElementById('setup-designation')?.value.trim();
      const company = document.getElementById('setup-company')?.value.trim();
      if (!name) {
        const inp = document.getElementById('setup-name');
        inp.style.borderColor = 'var(--danger)';
        inp.placeholder = 'Name is required!';
        inp.focus();
        return;
      }
      closeModal();
      onComplete(name, designation || '', company || '');
    };

    document.getElementById('setup-continue-btn')?.addEventListener('click', doSubmit);
    document.getElementById('setup-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('setup-designation')?.focus(); });
    document.getElementById('setup-designation')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('setup-company')?.focus(); });
    document.getElementById('setup-company')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
  }, 50);
}


// ============================================================
// SIDEBAR TOGGLE (mobile)
// ============================================================
function setupSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('sidebar--open');
  });

  // Close sidebar on nav click (mobile)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 768) sidebar.classList.remove('sidebar--open');
    });
  });
}

// ============================================================
// GOOGLE AUTH HELPERS (initialized once on page load)
// ============================================================
let _googleInited = false;

function handleGoogleCredential(response) {
  try {
    const base64 = response.credential.split('.')[1];
    const profile = JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')));
    // Close any open modal (the fallback Google button modal)
    closeModal();
    showProfileSetup(profile.name, profile.email, profile.picture, (name, designation, company) => {
      const user = {
        id: `google_${profile.sub}`,
        name: name,
        designation: designation,
        company: company,
        email: profile.email,
        picture: profile.picture
      };
      localStorage.setItem('nova_session_user', JSON.stringify(user));
      currentUser = user;
      showToast(`Welcome, ${user.name} ✓`, 'success');
      updateSidebarUser();
      const loginScr = document.getElementById('login-screen');
      const appSh = document.getElementById('app-shell');
      if (loginScr) loginScr.style.display = 'none';
      if (appSh) appSh.style.display = 'flex';
      initProjects();
      updateNavVisibility();
      window.navigateTo(getActiveProject() ? 'dashboard' : 'projects');
    });
  } catch (err) {
    showToast('Google credential error: ' + err.message, 'error');
  }
}

function initGoogleAuth() {
  if (_googleInited || !GOOGLE_CLIENT_ID || !window.google?.accounts?.id) return;
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt: false // FedCM silently blocks on most browsers
  });
  _googleInited = true;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Check localStorage session (no server needed)
  const isLoggedIn = checkAuthSession();

  // Wire sidebar navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) window.navigateTo(section);
    });
  });

  // Modal close button
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);

  // Clear active project / Back buttons logic
  window.clearActiveProject = function() {
    setActiveProject(null);
    window.dispatchEvent(new CustomEvent('activeProjectChanged'));
  };

  document.getElementById('nav-item-back')?.addEventListener('click', window.clearActiveProject);

  // Listen for project/task changes to refresh
  window.addEventListener('activeProjectChanged', () => {
    updateTopBar();
    updateSidebarProject();
    updateNavVisibility();
    const project = getActiveProject();
    if (project) {
      // When a project becomes active, jump to its dashboard
      window.navigateTo('dashboard');
    } else {
      window.navigateTo('projects');
    }
  });
  window.addEventListener('tasksChanged', () => {
    if (currentSection === 'gantt' || currentSection === 'dashboard') {
      window.navigateTo(currentSection);
    }
  });

  setupSidebar();
  setupThemeToggle();
  // Profile Dropdown Toggle
  const userBtn = document.getElementById('topbar-user-btn');
  const userDropdown = document.getElementById('user-dropdown');

  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle('user-dropdown--active');
  });

  window.addEventListener('click', () => {
    if (userDropdown?.classList.contains('user-dropdown--active')) {
      userDropdown.classList.remove('user-dropdown--active');
    }
  });

  // Google Sign-In (client-side GSI — works on GitHub Pages)
  document.getElementById('btn-login-google')?.addEventListener('click', () => {
    if (!GOOGLE_CLIENT_ID) {
      showToast('Google Client ID not configured. Use Guest login.', 'error');
      return;
    }
    if (!window.google?.accounts?.id) {
      showToast('Google Sign-In is still loading — please wait a second and try again.', 'info');
      return;
    }
    try {
      initGoogleAuth();
      // Skip One Tap / FedCM entirely — go straight to official Google button popup
      openModal('Sign in with Google', `
        <div style="text-align:center;padding:16px 0 8px;">
          <div style="font-size:44px;margin-bottom:14px;">🔑</div>
          <p style="color:var(--text-muted);font-size:14px;margin-bottom:24px;line-height:1.6;">
            Click the button below to securely sign in with your Google account.
          </p>
          <div id="google-official-btn" style="display:flex;justify-content:center;min-height:44px;"></div>
          <p style="color:var(--text-muted);font-size:12px;margin-top:18px;opacity:0.7;">
            🔒 A secure Google popup will open to verify your identity.
          </p>
        </div>
      `);
      // Small delay to let modal render before injecting the button
      setTimeout(() => {
        const container = document.getElementById('google-official-btn');
        if (container && window.google?.accounts?.id) {
          google.accounts.id.renderButton(container, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            width: 280
          });
        }
      }, 120);
    } catch (err) {
      showToast('Google Sign-In error: ' + err.message, 'error');
    }
  });


  // Pre-initialize Google as soon as the script is ready (helps with One Tap timing)
  if (window.google?.accounts?.id) {
    initGoogleAuth();
  } else {
    // Wait for the async Google script to load
    const gsiScript = document.querySelector('script[src*="accounts.google.com/gsi"]');
    if (gsiScript) {
      gsiScript.addEventListener('load', initGoogleAuth);
    }
  }

  // Guest Sign In Button
  document.getElementById('btn-login-guest')?.addEventListener('click', () => {
    showProfileSetup('', '', '', (name, designation, company) => {
      const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
      const user = {
        id: guestId,
        name: name,
        designation: designation,
        company: company,
        email: 'guest@nova-construction.com',
        picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
      };
      localStorage.setItem('nova_session_user', JSON.stringify(user));
      currentUser = user;
      showToast(`Welcome, ${user.name} ✓`, 'success');
      updateSidebarUser();
      const loginScr = document.getElementById('login-screen');
      const appSh = document.getElementById('app-shell');
      if (loginScr) loginScr.style.display = 'none';
      if (appSh) appSh.style.display = 'flex';
      initProjects();
      const project = getActiveProject();
      updateNavVisibility();
      window.navigateTo(project ? 'dashboard' : 'projects');
    });
  });

  // Delete Account Button Handler
  document.getElementById('btn-delete-account')?.addEventListener('click', () => {
    userDropdown?.classList.remove('user-dropdown--active');
    showConfirm('This will permanently delete your account and wipe all your data from this device. Are you sure?', () => {
      clearLocalSessionCache();
      localStorage.removeItem('nova_session_user');
      currentUser = null;
      showToast('Account and all data deleted', 'info');
      checkAuthSession();
    });
  });
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.removeItem('nova_session_user');
    clearLocalSessionCache();
    currentUser = null;
    showToast('Logged out successfully', 'info');
    checkAuthSession();
  });

  if (isLoggedIn) {
    // Init projects data if authenticated
    initProjects();
    const project = getActiveProject();
    updateNavVisibility();
    window.navigateTo(project ? 'dashboard' : 'projects');
  }
});
