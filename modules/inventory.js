// ============================================================
// inventory.js — Materials Inventory CRUD
// ============================================================

import { generateUUID, formatCurrency, formatNumber, escapeHtml } from '../utils/helpers.js';
import { getMaterials, saveMaterials } from '../utils/storage.js';
import { getActiveProject } from './projects.js';
import { showToast, showConfirm, openModal, closeModal } from '../utils/ui.js';

const UNITS = ['Bags', 'm³', 'Kg', 'L', 'MT', 'Pieces', 'Meters', 'Sq.m', 'Sq.ft', 'Nos'];

export function renderInventory() {
  const project = getActiveProject();
  const container = document.getElementById('section-inventory');

  if (!project) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><h3>No active project</h3><p>Open a project first.</p></div>`;
    return;
  }

  const materials = getMaterials().filter(m => m.projectId === project.id);
  const totalValue = materials.reduce((s, m) => s + (m.quantity * m.costPerUnit), 0);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">📦 Inventory</h2>
        <p class="section-subtitle">${materials.length} material${materials.length !== 1 ? 's' : ''} · ${project.name}</p>
      </div>
      <button class="btn btn-primary" id="btn-new-material">+ Add Material</button>
    </div>

    ${materials.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <h3>No materials yet</h3>
        <p>Add construction materials to the inventory.</p>
      </div>
    ` : `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material Name</th>
              <th>Unit</th>
              <th>Quantity</th>
              <th>Cost/Unit (Rs)</th>
              <th>Total Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${materials.map(m => renderMaterialRow(m)).join('')}
          </tbody>
          <tfoot>
            <tr class="table-footer-row">
              <td colspan="4"><strong>Total Inventory Value</strong></td>
              <td colspan="2"><strong class="text-accent">${formatCurrency(totalValue)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `}
  `;

  document.getElementById('btn-new-material')?.addEventListener('click', () => openMaterialModal(project));
  container.querySelectorAll('[data-edit-material]').forEach(btn =>
    btn.addEventListener('click', () => openMaterialModal(project, btn.dataset.editMaterial))
  );
  container.querySelectorAll('[data-delete-material]').forEach(btn =>
    btn.addEventListener('click', () => deleteMaterial(btn.dataset.deleteMaterial))
  );
}

function renderMaterialRow(m) {
  const total = m.quantity * m.costPerUnit;
  return `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td>${m.unit}</td>
      <td>${formatNumber(m.quantity)}</td>
      <td>${formatCurrency(m.costPerUnit)}</td>
      <td class="text-accent">${formatCurrency(total)}</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-xs" data-edit-material="${m.id}">Edit</button>
        <button class="btn btn-danger btn-xs" data-delete-material="${m.id}">Del</button>
      </td>
    </tr>
  `;
}

function openMaterialModal(project, editId = null) {
  const materials = getMaterials();
  const mat = editId ? materials.find(m => m.id === editId) : null;

  const formHtml = `
    <form id="mat-form" autocomplete="off">
      <div class="form-group">
        <label class="form-label">Material Name *</label>
        <input id="mf-name" class="form-input" type="text" placeholder="e.g. Cement (OPC 53)" required value="${mat ? escapeHtml(mat.name) : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Unit *</label>
          <select id="mf-unit" class="form-input form-select">
            ${UNITS.map(u => `<option value="${u}" ${mat?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity *</label>
          <input id="mf-qty" class="form-input" type="number" min="0" step="0.01" placeholder="e.g. 500" required value="${mat ? mat.quantity : ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Cost per Unit (Rs) *</label>
        <input id="mf-cost" class="form-input" type="number" min="0" step="0.01" placeholder="e.g. 380" required value="${mat ? mat.costPerUnit : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Estimated Total Value</label>
        <div class="form-value-display" id="mf-total">—</div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${mat ? 'Update Material' : 'Add Material'}</button>
      </div>
    </form>
  `;

  openModal(mat ? 'Edit Material' : 'Add Material', formHtml);

  const updateTotal = () => {
    const qty = parseFloat(document.getElementById('mf-qty').value) || 0;
    const cost = parseFloat(document.getElementById('mf-cost').value) || 0;
    document.getElementById('mf-total').textContent = formatCurrency(qty * cost);
  };

  document.getElementById('mf-qty').addEventListener('input', updateTotal);
  document.getElementById('mf-cost').addEventListener('input', updateTotal);
  if (mat) updateTotal();

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('mat-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('mf-name').value.trim();
    const unit = document.getElementById('mf-unit').value;
    const quantity = parseFloat(document.getElementById('mf-qty').value);
    const costPerUnit = parseFloat(document.getElementById('mf-cost').value);

    if (!name || isNaN(quantity) || isNaN(costPerUnit)) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    const allMaterials = getMaterials();
    if (mat) {
      const idx = allMaterials.findIndex(m => m.id === mat.id);
      if (idx !== -1) Object.assign(allMaterials[idx], { name, unit, quantity, costPerUnit });
    } else {
      allMaterials.push({
        id: generateUUID(),
        projectId: project.id,
        name, unit, quantity, costPerUnit,
      });
    }

    saveMaterials(allMaterials);
    closeModal();
    showToast(mat ? 'Material updated ✓' : 'Material added ✓', 'success');
    renderInventory();
  });
}

function deleteMaterial(id) {
  showConfirm('Delete this material?', () => {
    const materials = getMaterials().filter(m => m.id !== id);
    saveMaterials(materials);
    showToast('Material deleted', 'info');
    renderInventory();
  });
}

