// ============================================================
// expenses.js — Additional Expenses CRUD (food, transport, etc.)
// ============================================================

import { generateUUID, formatCurrency, formatDate, escapeHtml } from '../utils/helpers.js';
import { getExpenses, saveExpenses } from '../utils/storage.js';
import { getActiveProject } from './projects.js';
import { showToast, showConfirm, openModal, closeModal } from '../utils/ui.js';

const CATEGORIES = ['Food', 'Vehicle', 'Transport', 'Tool Rental', 'Others'];

export function renderExpenses() {
  const project = getActiveProject();
  const container = document.getElementById('section-expenses');

  if (!project) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💸</div><h3>No active project</h3><p>Open a project first.</p></div>`;
    return;
  }

  const expenses = getExpenses().filter(e => e.projectId === project.id);
  const totalValue = expenses.reduce((s, e) => s + e.amount, 0);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">💸 Additional Expenses</h2>
        <p class="section-subtitle">${expenses.length} expense item${expenses.length !== 1 ? 's' : ''} · ${project.name}</p>
      </div>
      <button class="btn btn-primary" id="btn-new-expense">+ Add Expense</button>
    </div>

    ${expenses.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <h3>No additional expenses yet</h3>
        <p>Record additional project expenses like food, fuel, tool rentals, etc.</p>
        <button class="btn btn-primary" id="btn-new-expense-empty">+ Record Expense</button>
      </div>
    ` : `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Expense / Work Description</th>
              <th>Category</th>
              <th>Date</th>
              <th>Amount Spent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(e => renderExpenseRow(e)).join('')}
          </tbody>
          <tfoot>
            <tr class="table-footer-row">
              <td colspan="3"><strong>Total Expenses Value</strong></td>
              <td colspan="2"><strong class="text-accent">${formatCurrency(totalValue)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `}
  `;

  document.getElementById('btn-new-expense')?.addEventListener('click', () => openExpenseModal(project));
  document.getElementById('btn-new-expense-empty')?.addEventListener('click', () => openExpenseModal(project));
  container.querySelectorAll('[data-edit-expense]').forEach(btn =>
    btn.addEventListener('click', () => openExpenseModal(project, btn.dataset.editExpense))
  );
  container.querySelectorAll('[data-delete-expense]').forEach(btn =>
    btn.addEventListener('click', () => deleteExpense(btn.dataset.deleteExpense))
  );
}

function renderExpenseRow(e) {
  return `
    <tr>
      <td><strong>${escapeHtml(e.description)}</strong></td>
      <td><span class="pill pill--blue">${e.category || 'Others'}</span></td>
      <td>${formatDate(e.date)}</td>
      <td class="text-accent"><strong>${formatCurrency(e.amount)}</strong></td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-xs" data-edit-expense="${e.id}">Edit</button>
        <button class="btn btn-danger btn-xs" data-delete-expense="${e.id}">Del</button>
      </td>
    </tr>
  `;
}

function openExpenseModal(project, editId = null) {
  const expenses = getExpenses();
  const exp = editId ? expenses.find(e => e.id === editId) : null;
  const today = new Date().toISOString().split('T')[0];

  const formHtml = `
    <form id="exp-form" autocomplete="off">
      <div class="form-group">
        <label class="form-label">Work / Expense Description *</label>
        <input id="ef-desc" class="form-input" type="text" placeholder="e.g. Labourers' lunch / Diesel for vehicle" required value="${exp ? escapeHtml(exp.description) : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category *</label>
          <select id="ef-cat" class="form-input form-select">
            ${CATEGORIES.map(c => `<option value="${c}" ${exp?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Date *</label>
          <input id="ef-date" class="form-input" type="date" required value="${exp ? exp.date : today}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Amount Spent (LKR) *</label>
        <input id="ef-amount" class="form-input" type="number" min="0.01" step="0.01" placeholder="e.g. 5000" required value="${exp ? exp.amount : ''}">
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${exp ? 'Update Expense' : 'Record Expense'}</button>
      </div>
    </form>
  `;

  openModal(exp ? 'Edit Expense' : 'Record Expense', formHtml);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  
  document.getElementById('exp-form').addEventListener('submit', e => {
    e.preventDefault();
    const description = document.getElementById('ef-desc').value.trim();
    const category = document.getElementById('ef-cat').value;
    const date = document.getElementById('ef-date').value;
    const amount = parseFloat(document.getElementById('ef-amount').value);

    if (!description || !date || isNaN(amount)) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    const allExpenses = getExpenses();
    if (exp) {
      const idx = allExpenses.findIndex(e => e.id === exp.id);
      if (idx !== -1) Object.assign(allExpenses[idx], { description, category, date, amount });
    } else {
      allExpenses.push({
        id: generateUUID(),
        projectId: project.id,
        description, category, date, amount
      });
    }

    saveExpenses(allExpenses);
    closeModal();
    showToast(exp ? 'Expense updated ✓' : 'Expense recorded ✓', 'success');
    renderExpenses();
  });
}

function deleteExpense(id) {
  showConfirm('Delete this expense record?', () => {
    const expenses = getExpenses().filter(e => e.id !== id);
    saveExpenses(expenses);
    showToast('Expense deleted', 'info');
    renderExpenses();
  });
}

