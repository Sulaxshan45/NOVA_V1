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
import { renderChat } from './modules/chat.js';
import { getSettings, saveSettings, getProjects, saveProjects, getTasks, saveTasks, getMaterials, saveMaterials, exportAllData, importAllData, loadWorkspaceFromServer, clearLocalSessionCache } from './utils/storage.js';
import { formatDate } from './utils/helpers.js';
import { openModal, closeModal, showToast, showConfirm } from './utils/ui.js';
export { openModal, closeModal, showToast, showConfirm };

// ============================================================
// FIREBASE AUTHENTICATION
// ============================================================
import { auth, googleProvider, signInWithPopup, getRedirectResult, deleteUser, signOut, db } from './utils/firebase.js';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
    topbarUser.style.display = 'flex';
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

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      const isLight = document.body.classList.contains('light-theme');
      const next = isLight ? 'dark' : 'light';
      const s = getSettings();
      saveSettings({ ...s, theme: next });
      applyTheme(next);
      if (SECTIONS[currentSection]) SECTIONS[currentSection].render();
    });
  }
}

// ============================================================
// MODAL, TOAST, CONFIRM — imported from utils/ui.js
// (kept here as re-exports for backward compatibility)
// ============================================================

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
// Chat module is imported from ./modules/chat.js

// ============================================================
// PROFILE SETUP MODAL — shown on first login (guest or Google)
// ============================================================
function showProfileSetup(prefillName, prefillEmail, prefillPicture, onComplete) {
  const formHtml = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:52px;margin-bottom:10px; position: relative; display: inline-block;">
        <img id="setup-preview-img" src="${prefillPicture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-purple);">
        <label for="setup-picture" style="position: absolute; bottom: 0; right: -10px; background: var(--accent-purple); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">📷</label>
        <input type="file" id="setup-picture" accept="image/*" style="display: none;">
      </div>
      <p style="color:var(--text-muted);font-size:14px;line-height:1.6;">Tell us about yourself to personalise your NOVA workspace</p>
    </div>
    <div class="form-group">
      <label class="form-label">Your Name <span style="color:var(--status-red)">*</span></label>
      <input id="setup-name" class="form-input" type="text" placeholder="e.g. John Doe" value="${prefillName || ''}" autocomplete="name" maxlength="60" />
    </div>
    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">Username (Letters and Numbers only) <span style="color:var(--status-red)">*</span></label>
      <input id="setup-username" class="form-input" type="text" placeholder="e.g. johndoe123" autocomplete="username" maxlength="30" pattern="[a-zA-Z0-9]+" />
      <div id="username-error" style="color:var(--status-red); font-size:12px; margin-top:4px; display:none;"></div>
    </div>
    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">Job Title / Designation <span style="color:var(--status-red)">*</span></label>
      <select id="setup-designation" class="form-input form-select">
        <option value="" disabled selected>Select your designation...</option>
        <optgroup label="Management">
          <option value="Project Director">Project Director</option>
          <option value="Construction Manager">Construction Manager</option>
          <option value="Project Manager">Project Manager</option>
          <option value="Site Manager">Site Manager</option>
          <option value="Contracts Manager">Contracts Manager</option>
        </optgroup>
        <optgroup label="Engineering">
          <option value="Civil Engineer">Civil Engineer</option>
          <option value="Site Engineer">Site Engineer</option>
          <option value="Project Engineer">Project Engineer</option>
          <option value="Resident Engineer">Resident Engineer</option>
          <option value="Structural Engineer">Structural Engineer</option>
          <option value="Geotechnical Engineer">Geotechnical Engineer</option>
          <option value="Highway Engineer">Highway Engineer</option>
          <option value="Water Resources Engineer">Water Resources Engineer</option>
        </optgroup>
        <optgroup label="MEP Engineer">
          <option value="Electrical Engineer">Electrical Engineer</option>
          <option value="Mechanical Engineer">Mechanical Engineer</option>
          <option value="Planning Engineer">Planning Engineer</option>
        </optgroup>
        <optgroup label="Quantity Surveying & Cost Control">
          <option value="Quantity Surveyor">Quantity Surveyor</option>
          <option value="Senior Quantity Surveyor">Senior Quantity Surveyor</option>
          <option value="Cost Engineer">Cost Engineer</option>
          <option value="Estimator">Estimator</option>
        </optgroup>
        <optgroup label="Quality & Safety">
          <option value="Quality Assurance Engineer">Quality Assurance Engineer</option>
          <option value="Quality Control Engineer">Quality Control Engineer</option>
          <option value="Safety Officer">Safety Officer</option>
          <option value="HSE Engineer">HSE Engineer</option>
          <option value="HSE Manager">HSE Manager</option>
        </optgroup>
        <optgroup label="Surveying">
          <option value="Land Surveyor">Land Surveyor</option>
          <option value="Site Surveyor">Site Surveyor</option>
          <option value="GIS Specialist">GIS Specialist</option>
        </optgroup>
        <optgroup label="Supervision">
          <option value="Site Supervisor">Site Supervisor</option>
          <option value="General Foreman">General Foreman</option>
          <option value="Foreman">Foreman</option>
          <option value="Clerk of Works">Clerk of Works</option>
        </optgroup>
        <optgroup label="Administration & Support">
          <option value="Document Controller">Document Controller</option>
          <option value="Site Administrator">Site Administrator</option>
          <option value="Procurement Officer">Procurement Officer</option>
          <option value="Store Keeper">Store Keeper</option>
          <option value="Logistics Coordinator">Logistics Coordinator</option>
        </optgroup>
        <optgroup label="Skilled Trades">
          <option value="Mason">Mason</option>
          <option value="Carpenter">Carpenter</option>
          <option value="Steel Fixer">Steel Fixer</option>
          <option value="Welder">Welder</option>
          <option value="Electrician">Electrician</option>
          <option value="Plumber">Plumber</option>
          <option value="Painter">Painter</option>
          <option value="Tiler">Tiler</option>
          <option value="Scaffolder">Scaffolder</option>
          <option value="Rigger">Rigger</option>
        </optgroup>
        <optgroup label="Equipment & Plant">
          <option value="Heavy Equipment Operator">Heavy Equipment Operator</option>
          <option value="Crane Operator">Crane Operator</option>
          <option value="Excavator Operator">Excavator Operator</option>
          <option value="Plant Mechanic">Plant Mechanic</option>
        </optgroup>
        <optgroup label="Entry-Level Positions">
          <option value="Graduate Engineer Trainee">Graduate Engineer Trainee</option>
          <option value="Assistant Site Engineer">Assistant Site Engineer</option>
          <option value="Junior Quantity Surveyor">Junior Quantity Surveyor</option>
          <option value="Engineering Intern">Engineering Intern</option>
          <option value="Site Technician">Site Technician</option>
        </optgroup>
        <optgroup label="Labor Positions">
          <option value="Construction Worker">Construction Worker</option>
          <option value="General Laborer">General Laborer</option>
          <option value="Helper">Helper</option>
        </optgroup>
      </select>
    </div>
    <div class="form-group" style="margin-top:14px;">
      <label class="form-label">Company / Organization <span style="color:var(--status-red)">*</span></label>
      <input id="setup-company" class="form-input" type="text" placeholder="e.g. ABC Construction Pvt. Ltd." autocomplete="organization" maxlength="80" />
    </div>
    <button class="btn btn-primary" id="setup-continue-btn" style="margin-top:20px;width:100%;padding:14px;font-size:15px;">
      ✓ &nbsp;Continue to NOVA
    </button>
  `;
  openModal('Set Up Your Profile', formHtml, { persistent: true });

  setTimeout(() => {
    const nameInput = document.getElementById('setup-name');
    if (nameInput) nameInput.focus();

    let uploadedPictureBase64 = prefillPicture;

    // Handle profile picture upload
    const pictureInput = document.getElementById('setup-picture');
    const previewImg = document.getElementById('setup-preview-img');
    pictureInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          uploadedPictureBase64 = ev.target.result;
          previewImg.src = uploadedPictureBase64;
        };
        reader.readAsDataURL(file);
      }
    });

    const doSubmit = async () => {
      const name = document.getElementById('setup-name')?.value.trim();
      const username = document.getElementById('setup-username')?.value.trim();
      const designation = document.getElementById('setup-designation')?.value.trim();
      const company = document.getElementById('setup-company')?.value.trim();
      const usernameError = document.getElementById('username-error');
      
      let hasError = false;
      if (usernameError) usernameError.style.display = 'none';

      // Validate required fields
      if (!name) {
        document.getElementById('setup-name').style.borderColor = 'var(--status-red)';
        hasError = true;
      } else {
        document.getElementById('setup-name').style.borderColor = '';
      }

      if (!username || !/^[a-zA-Z0-9]+$/.test(username)) {
        document.getElementById('setup-username').style.borderColor = 'var(--status-red)';
        if (usernameError) {
           usernameError.textContent = 'Username must be letters and numbers only.';
           usernameError.style.display = 'block';
        }
        hasError = true;
      } else {
        document.getElementById('setup-username').style.borderColor = '';
      }

      if (!designation) {
        document.getElementById('setup-designation').style.borderColor = 'var(--status-red)';
        hasError = true;
      } else {
        document.getElementById('setup-designation').style.borderColor = '';
      }

      if (!company) {
        document.getElementById('setup-company').style.borderColor = 'var(--status-red)';
        hasError = true;
      } else {
        document.getElementById('setup-company').style.borderColor = '';
      }

      if (hasError) {
        showToast('Please fill all required fields correctly.', 'error');
        return;
      }

      const btn = document.getElementById('setup-continue-btn');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Checking...';
      btn.disabled = true;

      try {
        // Check username uniqueness globally
        const q = query(collection(db, 'users'), where('username', '==', username));
        const qs = await getDocs(q);
        
        if (!qs.empty) {
          document.getElementById('setup-username').style.borderColor = 'var(--status-red)';
          if (usernameError) {
             usernameError.textContent = 'Username is already taken. Please choose another.';
             usernameError.style.display = 'block';
          }
          btn.innerHTML = originalText;
          btn.disabled = false;
          return;
        }

        closeModal();
        onComplete(name, username, designation, company, uploadedPictureBase64);
      } catch (err) {
        console.warn('Firestore check error (proceeding anyway):', err);
        // If Firestore is unavailable/not enabled, skip the uniqueness check
        // and allow the user to log in — Firestore will be checked once enabled
        closeModal();
        onComplete(name, username, designation, company, uploadedPictureBase64);
      }
    };

    document.getElementById('setup-continue-btn')?.addEventListener('click', doSubmit);
    document.getElementById('setup-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('setup-designation')?.focus(); });
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

async function handleFirebaseAuth(firebaseUser) {
  try {
    const userId = `google_${firebaseUser.uid}`;
    
    // Check if user already exists in Firestore
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const user = userSnap.data();
      localStorage.setItem('nova_session_user', JSON.stringify(user));
      currentUser = user;
      showToast(`Welcome back, ${user.name} ✓`, 'success');
      updateSidebarUser();
      const loginScr = document.getElementById('login-screen');
      const appSh = document.getElementById('app-shell');
      if (loginScr) loginScr.style.display = 'none';
      if (appSh) appSh.style.display = 'flex';
      initProjects();
      updateNavVisibility();
      window.navigateTo(getActiveProject() ? 'dashboard' : 'projects');
      return;
    }

    const profile = {
      name: firebaseUser.displayName || 'Google User',
      email: firebaseUser.email,
      picture: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      sub: firebaseUser.uid
    };

    closeModal();
    showProfileSetup(profile.name, profile.email, profile.picture, async (name, username, designation, company, picture) => {
      const user = {
        id: userId,
        name: name,
        username: username,
        designation: designation,
        company: company,
        email: profile.email,
        picture: picture,
        firebaseUid: firebaseUser.uid
      };
      
      // Save to Firestore
      try {
        await setDoc(doc(db, 'users', user.id), user);
      } catch (err) {
        console.error("Error saving user to Firestore:", err);
      }

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
    showToast('Firebase auth error: ' + err.message, 'error');
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Check localStorage session (no server needed)
  const isLoggedIn = checkAuthSession();

  // Handle Google redirect result (after signInWithRedirect returns)
  getRedirectResult(auth).then(result => {
    if (result && result.user) {
      handleFirebaseAuth(result.user);
    }
  }).catch(err => {
    console.warn('Redirect result error:', err.message);
  });

  // If already logged in (session restored), initialize app state
  if (isLoggedIn) {
    // Refresh user from Firestore to catch company/invite updates
    try {
      if (currentUser && currentUser.id) {
        const userRef = doc(db, 'users', currentUser.id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          currentUser = userSnap.data();
          localStorage.setItem('nova_session_user', JSON.stringify(currentUser));
          updateSidebarUser();
        }
      }
    } catch (err) {
      console.warn("Failed to refresh user data from Firestore:", err);
    }
    initProjects();
    updateNavVisibility();
    window.navigateTo(getActiveProject() ? 'dashboard' : 'projects');
  }

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
  // Profile Dropdown — move to body to escape topbar stacking context (backdrop-filter creates one)
  const userBtn = document.getElementById('topbar-user-btn');
  const userDropdown = document.getElementById('user-dropdown');

  if (userBtn && userDropdown) {
    // Move dropdown to body so it's NOT clipped by topbar's stacking context
    document.body.appendChild(userDropdown);

    // Style as fixed so it doesn't depend on parent context
    userDropdown.style.position = 'fixed';
    userDropdown.style.zIndex = '99999';
    userDropdown.style.display = 'none';

    function positionDropdown() {
      const rect = userBtn.getBoundingClientRect();
      userDropdown.style.top = (rect.bottom + 8) + 'px';
      userDropdown.style.left = '';
      userDropdown.style.right = (window.innerWidth - rect.right) + 'px';
    }

    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userDropdown.style.display === 'block') {
        userDropdown.style.display = 'none';
      } else {
        positionDropdown();
        userDropdown.style.display = 'block';
      }
    });

    document.addEventListener('click', (e) => {
      if (!userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.style.display = 'none';
      }
    });

    window.addEventListener('resize', () => {
      if (userDropdown.style.display === 'block') positionDropdown();
    });
  }

  // NOTE: Logout and Delete Account handlers are defined below (lines ~1046+)

  // Firebase Google Sign-In
  document.getElementById('btn-login-google')?.addEventListener('click', async () => {
    try {
      showToast('Opening Google Sign-In...', 'info');
      // Using popup instead of redirect to avoid the 404 /__/firebase/init.json error on unconfigured auth domains
      const result = await signInWithPopup(auth, googleProvider);
      if (result && result.user) {
        handleFirebaseAuth(result.user);
      }
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        showToast('Login failed: ' + error.message, 'error');
      }
    }
  });

  // Guest Sign In Button
  document.getElementById('btn-login-guest')?.addEventListener('click', () => {
    showProfileSetup('', '', '', async (name, username, designation, company, picture) => {
      const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
      const user = {
        id: guestId,
        name: name,
        username: username,
        designation: designation,
        company: company,
        email: 'guest@nova-construction.com',
        picture: picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
      };

      // Save to Firestore
      try {
        await setDoc(doc(db, 'users', user.id), user);
      } catch (err) {
        console.error("Error saving guest to Firestore:", err);
      }

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

  // ============================================================
  // EMAILJS CONFIGURATION
  // ============================================================
  const EMAILJS_SERVICE_ID = 'service_vleyg5b';
  const EMAILJS_TEMPLATE_ID = 'template_mx85zt9';
  const EMAILJS_PUBLIC_KEY = 'CES5n8wtVaFXM5HYQ';

  // Process Account Deletion Link from Email
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('delete_user')) {
    const userIdToDelete = urlParams.get('delete_user');
    // We must ensure the user is logged in and matches the ID
    if (currentUser && currentUser.id === userIdToDelete) {
      showConfirm('Final Confirmation: Delete this account permanently?', async () => {
        try {
          if (auth.currentUser) {
            await deleteUser(auth.currentUser);
          }
          clearLocalSessionCache();
          localStorage.removeItem('nova_session_user');
          currentUser = null;
          showToast('Account successfully deleted.', 'success');
          // Clean the URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          if (err.code === 'auth/requires-recent-login') {
            showToast('Security required: Please log out, log back in, and click the link again.', 'error');
          } else {
            showToast('Failed to delete account: ' + err.message, 'error');
          }
        }
      });
    } else {
      showToast('Deletion failed: You must be logged into the account you are trying to delete.', 'error');
    }
  }

  // Delete Account Button Handler
  document.getElementById('btn-delete-account')?.addEventListener('click', () => {
    userDropdown?.classList.remove('user-dropdown--active');
    
    // Guest users cannot use email deletion
    if (currentUser?.id.startsWith('guest_')) {
      showConfirm('Guest accounts are not linked to an email. Delete local data?', () => {
        clearLocalSessionCache();
        localStorage.removeItem('nova_session_user');
        currentUser = null;
        showToast('Guest data wiped.', 'info');
        checkAuthSession();
      });
      return;
    }

    showConfirm('We will send a confirmation link to your email. You must click it to delete your account. Proceed?', async () => {
      // Generate the secure deletion link
      const deleteLink = `${window.location.origin}${window.location.pathname}?delete_user=${currentUser.id}`;

      const templateParams = {
        name: currentUser.name,
        user_name: currentUser.name,
        user_email: currentUser.email,
        email: currentUser.email,
        to_email: currentUser.email,
        reply_to: currentUser.email,
        delete_link: deleteLink
      };

      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
        showToast('Deletion email sent! Please check your inbox.', 'success');
      } catch (err) {
        showToast('Failed to send email. Please try again later.', 'error');
        console.error('EmailJS Error:', err);
      }
    });
  });
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (e) {
      console.error('Firebase signout error', e);
    }
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
