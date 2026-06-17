// ============================================================
// storage.js — localStorage helpers with auto-save
// ============================================================

const KEYS = {
  PROJECTS: 'pmPro_projects',
  TASKS: 'pmPro_tasks',
  MATERIALS: 'pmPro_materials',
  SETTINGS: 'pmPro_settings',
  ACTIVE_PROJECT: 'pmPro_activeProject',
  EXPENSES: 'nova_expenses',
};

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}

// Backend sync is disabled for GitHub Pages (no server)
// All data is stored in localStorage on the device
function triggerBackendSync() {
  // No-op for GitHub Pages static hosting
}

function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    triggerBackendSync();
    return true;
  } catch {
    return false;
  }
}

// Projects
export function getProjects() { return load(KEYS.PROJECTS) || []; }
export function saveProjects(projects) { return save(KEYS.PROJECTS, projects); }

// Tasks
export function getTasks() { return load(KEYS.TASKS) || []; }
export function saveTasks(tasks) { return save(KEYS.TASKS, tasks); }

// Materials
export function getMaterials() { return load(KEYS.MATERIALS) || []; }
export function saveMaterials(materials) { return save(KEYS.MATERIALS, materials); }

// Settings
export const DEFAULT_SETTINGS = {
  companyName: 'NOVA Construction',
  defaultMasonRate: 2500,       // Rs. per mason per day
  defaultLabourRate: 1500,      // Rs. per labourer per day
  defaultProfitMargin: 15,
  theme: 'dark',
};
export function getSettings() { return { ...DEFAULT_SETTINGS, ...(load(KEYS.SETTINGS) || {}) }; }
export function saveSettings(settings) { return save(KEYS.SETTINGS, settings); }

// Active Project
export function getActiveProjectId() { return load(KEYS.ACTIVE_PROJECT); }
export function saveActiveProjectId(id) { return save(KEYS.ACTIVE_PROJECT, id); }

// Expenses
export function getExpenses() { return load(KEYS.EXPENSES) || []; }
export function saveExpenses(expenses) { return save(KEYS.EXPENSES, expenses); }

// Backup / Restore
export function exportAllData() {
  return {
    projects: getProjects(),
    tasks: getTasks(),
    materials: getMaterials(),
    expenses: getExpenses(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
  };
}

export function importAllData(data) {
  if (data.projects) saveProjects(data.projects);
  if (data.tasks) saveTasks(data.tasks);
  if (data.materials) saveMaterials(data.materials);
  if (data.expenses) saveExpenses(data.expenses);
  if (data.settings) saveSettings(data.settings);
}

export async function loadWorkspaceFromServer() {
  // No-op for GitHub Pages — data lives in localStorage
  return false;
}

export function clearLocalSessionCache() {
  localStorage.removeItem(KEYS.PROJECTS);
  localStorage.removeItem(KEYS.TASKS);
  localStorage.removeItem(KEYS.MATERIALS);
  localStorage.removeItem(KEYS.EXPENSES);
  localStorage.removeItem(KEYS.SETTINGS);
  localStorage.removeItem(KEYS.ACTIVE_PROJECT);
}
