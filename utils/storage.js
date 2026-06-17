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

async function triggerBackendSync() {
  const data = exportAllData();
  try {
    const res = await fetch('/api/sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      console.warn('Backend sync failed:', res.statusText);
    }
  } catch (err) {
    console.error('Backend sync connection error:', err);
  }
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
  try {
    const res = await fetch('/api/sync/load');
    if (res.ok) {
      const data = await res.json();
      if (data.projects) localStorage.setItem(KEYS.PROJECTS, JSON.stringify(data.projects));
      if (data.tasks) localStorage.setItem(KEYS.TASKS, JSON.stringify(data.tasks));
      if (data.materials) localStorage.setItem(KEYS.MATERIALS, JSON.stringify(data.materials));
      if (data.expenses) localStorage.setItem(KEYS.EXPENSES, JSON.stringify(data.expenses));
      if (data.settings) localStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      return true;
    }
  } catch (err) {
    console.error('Failed to load workspace from server:', err);
  }
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
