// ============================================================
// billing.js — Billing & BOQ module
// ============================================================

import { formatCurrency, getTaskEndDate, formatDate, escapeHtml } from '../utils/helpers.js';
import { getTasks, getMaterials, getSettings, getExpenses } from '../utils/storage.js';
import { getActiveProject } from './projects.js';
import { exportTaskPDF, exportProjectBOQ } from '../utils/pdf.js';
import { showToast } from '../utils/ui.js';

export function renderBilling() {
  const project = getActiveProject();
  const container = document.getElementById('section-billing');

  if (!project) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><h3>No active project</h3><p>Open a project first.</p></div>`;
    return;
  }

  const settings = getSettings();
  const allTasks = getTasks().filter(t => t.projectId === project.id);
  const tasks = allTasks.filter(t => t.status === 'Completed');
  const allMaterials = getMaterials().filter(m => m.projectId === project.id);
  const expenses = getExpenses().filter(e => e.projectId === project.id);

  const masonRate   = project.masonRate   || settings.defaultMasonRate;
  const labourRate  = project.labourRate  || settings.defaultLabourRate;
  const profitMargin = project.profitMargin || settings.defaultProfitMargin;

  // Compute costs per task
  let grandMatCost = 0;
  let grandLabourCost = 0;

  const taskRows = tasks.map(task => {
    let matCost = 0;
    (task.materials || []).forEach(m => {
      const mat = allMaterials.find(x => x.id === m.materialId);
      if (mat) matCost += m.quantity * mat.costPerUnit;
    });
    const masonCost  = (task.masons   || 0) * task.duration * masonRate;
    const labourCost = (task.labourers || 0) * task.duration * labourRate;
    const totalLabourCost = masonCost + labourCost;
    const subtotal = matCost + totalLabourCost;
    const profit = subtotal * (profitMargin / 100);
    const total = subtotal + profit;
    grandMatCost += matCost;
    grandLabourCost += totalLabourCost;
    return { task, matCost, masonCost, labourCost, totalLabourCost, subtotal, profit, total };
  });

  const grandSubtotal = grandMatCost + grandLabourCost;
  const grandProfit = grandSubtotal * (profitMargin / 100);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const grandTotal = grandSubtotal + grandProfit + totalExpenses;

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">💰 Billing &amp; BOQ</h2>
        <p class="section-subtitle">
          ${project.name} · Mason: ${formatCurrency(masonRate)}/day · Labour: ${formatCurrency(labourRate)}/day · Margin: ${profitMargin}%
        </p>
      </div>
      <button class="btn btn-primary" id="btn-export-boq">📄 Export BOQ PDF</button>
    </div>

    <!-- Summary cards -->
    <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
      <div class="stat-card">
        <div class="stat-card__icon">🧱</div>
        <div class="stat-card__val">${formatCurrency(grandMatCost)}</div>
        <div class="stat-card__label">Tasks Materials Cost</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon">👷</div>
        <div class="stat-card__val">${formatCurrency(grandLabourCost)}</div>
        <div class="stat-card__label">Tasks Labour Cost</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon">📈</div>
        <div class="stat-card__val">${formatCurrency(grandProfit)}</div>
        <div class="stat-card__label">Margin Profit (${profitMargin}%)</div>
      </div>
      <div class="stat-card" style="--accent:#ef4444">
        <div class="stat-card__icon">💸</div>
        <div class="stat-card__val">${formatCurrency(totalExpenses)}</div>
        <div class="stat-card__label">Additional Expenses</div>
      </div>
      <div class="stat-card stat-card--accent">
        <div class="stat-card__icon">💰</div>
        <div class="stat-card__val">${formatCurrency(grandTotal)}</div>
        <div class="stat-card__label">Grand Total Bill</div>
      </div>
    </div>

    <!-- Task breakdown -->
    <h3 class="card-title" style="margin-top:24px;margin-bottom:12px">🛠️ Billed Tasks (Completed Only)</h3>
    ${tasks.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <h3>No completed tasks yet</h3>
        <p>Tasks with status "Completed" will appear here for billing.</p>
      </div>
    ` : `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Duration</th>
              <th>Masons</th>
              <th>Labourers</th>
              <th>Material Cost</th>
              <th>Mason Cost</th>
              <th>Labour Cost</th>
              <th>Subtotal</th>
              <th>Profit</th>
              <th>Total</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows.map(({ task, matCost, masonCost, labourCost, totalLabourCost, subtotal, profit, total }) => `
              <tr>
                <td>${escapeHtml(task.name)}</td>
                <td>${task.duration}d</td>
                <td>${task.masons || 0}</td>
                <td>${task.labourers || 0}</td>
                <td>${formatCurrency(matCost)}</td>
                <td>${formatCurrency(masonCost)}</td>
                <td>${formatCurrency(labourCost)}</td>
                <td>${formatCurrency(subtotal)}</td>
                <td>${formatCurrency(profit)}</td>
                <td class="text-accent"><strong>${formatCurrency(total)}</strong></td>
                <td>
                  <button class="btn btn-ghost btn-xs" data-export-task="${task.id}">📄 PDF</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="table-footer-row">
              <td colspan="4"><strong>TOTAL TASKS</strong></td>
              <td><strong>${formatCurrency(grandMatCost)}</strong></td>
              <td colspan="2"><strong>${formatCurrency(grandLabourCost)}</strong></td>
              <td><strong>${formatCurrency(grandSubtotal)}</strong></td>
              <td><strong>${formatCurrency(grandProfit)}</strong></td>
              <td colspan="2"><strong class="text-accent">${formatCurrency(grandSubtotal + grandProfit)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `}

    <!-- Additional Expenses breakdown -->
    <h3 class="card-title" style="margin-top:32px;margin-bottom:12px">💸 Additional Expenses (Direct Costs)</h3>
    ${expenses.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <h3>No additional expenses recorded</h3>
        <p>Expenses recorded in the Additional Expenses tab will appear here for billing.</p>
      </div>
    ` : `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Work / Expense Description</th>
              <th>Category</th>
              <th>Date</th>
              <th>Amount Spent</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(e => `
              <tr>
                <td><strong>${escapeHtml(e.description)}</strong></td>
                <td><span class="pill pill--blue">${e.category || 'Others'}</span></td>
                <td>${formatDate(e.date)}</td>
                <td class="text-accent"><strong>${formatCurrency(e.amount)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="table-footer-row">
              <td colspan="3"><strong>TOTAL ADDITIONAL EXPENSES</strong></td>
              <td><strong class="text-accent">${formatCurrency(totalExpenses)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `}
  `;

  document.getElementById('btn-export-boq')?.addEventListener('click', () => {
    try {
      exportProjectBOQ(project, tasks, allMaterials, expenses);
      showToast('BOQ PDF exported ✓', 'success');
    } catch (err) {
      showToast('PDF export failed: ' + err.message, 'error');
    }
  });

  container.querySelectorAll('[data-export-task]').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.dataset.exportTask;
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      try {
        exportTaskPDF(task, project, allMaterials);
        showToast('Invoice exported ✓', 'success');
      } catch (err) {
        showToast('PDF export failed: ' + err.message, 'error');
      }
    });
  });
}

