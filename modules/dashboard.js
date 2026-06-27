// ============================================================
// dashboard.js — Dashboard summary & mini Gantt
// ============================================================

import { formatCurrency, getStatusColor, getTaskEndDate, formatDate } from '../utils/helpers.js';
import { getTasks, getMaterials, getProjects, getSettings, getExpenses } from '../utils/storage.js';
import { getActiveProject } from './projects.js';
import { buildMiniGantt } from './gantt.js';

export function renderDashboard() {
  const project = getActiveProject();
  const container = document.getElementById('section-dashboard');
  const settings = getSettings();

  if (!project) {
    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">🏠 Dashboard</h2>
      </div>
      <div class="empty-state">
        <div class="empty-icon">🏗️</div>
        <h3>Welcome to NOVA</h3>
        <p>Create or select a project to see your dashboard.</p>
        <button class="btn btn-primary" onclick="window.navigateTo('projects')">+ Create Project</button>
      </div>
    `;
    return;
  }

  const tasks = getTasks().filter(t => t.projectId === project.id);
  const materials = getMaterials().filter(m => m.projectId === project.id);
  const masonRate  = project.masonRate  || settings.defaultMasonRate;
  const labourRate = project.labourRate || settings.defaultLabourRate;
  const profitMargin = project.profitMargin || settings.defaultProfitMargin;

  const completed = tasks.filter(t => t.status === 'Completed').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const onHold = tasks.filter(t => t.status === 'On Hold').length;
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const invValue = materials.reduce((s, m) => s + m.quantity * m.costPerUnit, 0);

  // Estimated cost
  let totalCost = 0;
  tasks.forEach(task => {
    let matCost = 0;
    (task.materials || []).forEach(m => {
      const mat = materials.find(x => x.id === m.materialId);
      if (mat) matCost += m.quantity * mat.costPerUnit;
    });
    const masonCost  = (task.masons   || 0) * task.duration * masonRate;
    const labourCost = (task.labourers || 0) * task.duration * labourRate;
    const subtotal = matCost + masonCost + labourCost;
    totalCost += subtotal * (1 + profitMargin / 100);
  });

  const expenses = getExpenses().filter(e => e.projectId === project.id);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  totalCost += totalExpenses;


  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">🏠 Dashboard</h2>
        <p class="section-subtitle">${project.name} · ${project.client}</p>
      </div>
      <div class="dashboard-meta">
        <span>📍 ${project.location || '—'}</span>
        <span>📅 ${formatDate(project.startDate)}</span>
        <button class="btn btn-ghost btn-sm" onclick="window.preparePrint('Project Dashboard')">🖨️ Print PDF</button>
      </div>
    </div>

    <!-- KPI Cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card__icon">✅</div>
        <div class="stat-card__val">${tasks.length}</div>
        <div class="stat-card__label">Total Tasks</div>
      </div>
      <div class="stat-card" style="--accent:#22c55e">
        <div class="stat-card__icon">🟢</div>
        <div class="stat-card__val">${completed}</div>
        <div class="stat-card__label">Completed</div>
      </div>
      <div class="stat-card" style="--accent:#eab308">
        <div class="stat-card__icon">🟡</div>
        <div class="stat-card__val">${inProgress}</div>
        <div class="stat-card__label">In Progress</div>
      </div>
      <div class="stat-card" style="--accent:#ef4444">
        <div class="stat-card__icon">🔴</div>
        <div class="stat-card__val">${onHold}</div>
        <div class="stat-card__label">On Hold</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon">📦</div>
        <div class="stat-card__val">${formatCurrency(invValue)}</div>
        <div class="stat-card__label">Inventory Value</div>
      </div>
      <div class="stat-card stat-card--accent">
        <div class="stat-card__icon">💰</div>
        <div class="stat-card__val">${formatCurrency(totalCost)}</div>
        <div class="stat-card__label">Est. Project Cost</div>
      </div>
    </div>

    <!-- Progress -->
    <div class="glass-card" style="margin-top:24px">
      <div class="flex-between">
        <h3 class="card-title">Overall Progress</h3>
        <span class="text-accent" style="font-size:22px;font-weight:700">${progress}%</span>
      </div>
      <div class="progress-bar-wrap" style="margin-top:12px;height:12px;border-radius:6px">
        <div class="progress-bar" style="width:${progress}%;height:12px;border-radius:6px;transition:width 0.6s ease"></div>
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">
        <span class="pill pill--green">${completed} Completed</span>
        <span class="pill pill--yellow">${inProgress} In Progress</span>
        <span class="pill pill--yellow">${pending} Pending</span>
        <span class="pill pill--red">${onHold} On Hold</span>
      </div>
    </div>

    <!-- Mini Gantt -->
    ${tasks.length > 0 ? `
    <div class="glass-card" style="margin-top:24px">
      <h3 class="card-title">📊 Timeline Preview</h3>
      <div id="mini-gantt-wrap" style="margin-top:12px;overflow-x:auto"></div>
    </div>` : ''}

    <!-- Recent Tasks -->
    ${tasks.length > 0 ? `
    <div class="glass-card" style="margin-top:24px">
      <h3 class="card-title">Recent Tasks</h3>
      <div style="margin-top:12px">
        ${tasks.slice(0, 5).map(t => `
          <div class="task-row-mini">
            <div class="task-dot" style="background:${getStatusColor(t.status)}"></div>
            <span class="task-name-mini">${t.name}</span>
            <span class="task-dates-mini">${formatDate(t.startDate)} → ${formatDate(getTaskEndDate(t))}</span>
            <span class="status-badge ${t.status === 'Completed' ? 'status-completed' : t.status === 'On Hold' ? 'status-onhold' : 'status-inprogress'}" style="margin-left:auto">${t.status}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}


  `;

  // Mini Gantt
  if (tasks.length > 0) {
    const miniWrap = document.getElementById('mini-gantt-wrap');
    if (miniWrap) buildMiniGantt(tasks.slice(0, 10), miniWrap);
  }
}

