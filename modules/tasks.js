// ============================================================
// tasks.js — Task CRUD + rendering
// ============================================================

import { generateUUID, formatDate, getTaskEndDate, getStatusClass, escapeHtml } from '../utils/helpers.js';
import { getTasks, saveTasks, getMaterials } from '../utils/storage.js';
import { getActiveProject } from './projects.js';
import { showToast, showConfirm, openModal, closeModal } from '../utils/ui.js';

export function renderTasks() {
  const project = getActiveProject();
  const container = document.getElementById('section-tasks');

  if (!project) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div><h3>No active project</h3><p>Please open a project from the Projects section first.</p></div>`;
    return;
  }

  const tasks = getTasks().filter(t => t.projectId === project.id);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">✅ Tasks</h2>
        <p class="section-subtitle">${tasks.length} task${tasks.length !== 1 ? 's' : ''} · ${project.name}</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" onclick="window.preparePrint('Task Schedule')">🖨️ Print PDF</button>
        <button class="btn btn-primary" id="btn-new-task">+ Add Task</button>
      </div>
    </div>

    ${tasks.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <h3>No tasks yet</h3>
        <p>Add the first task for <strong>${escapeHtml(project.name)}</strong>.</p>
      </div>
    ` : `
      <div class="table-wrap">
        <table class="data-table" id="tasks-table">
          <thead>
            <tr>
              <th>Task Name</th>
              <th>Start Date</th>
              <th>Duration</th>
              <th>End Date</th>
              <th>Masons</th>
              <th>Labourers</th>
              <th>Status</th>
              <th>Materials</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t => renderTaskRow(t)).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;

  document.getElementById('btn-new-task')?.addEventListener('click', () => openTaskModal(project));
  container.querySelectorAll('[data-edit-task]').forEach(btn =>
    btn.addEventListener('click', () => openTaskModal(project, btn.dataset.editTask))
  );
  container.querySelectorAll('[data-delete-task]').forEach(btn =>
    btn.addEventListener('click', () => deleteTask(btn.dataset.deleteTask))
  );
  container.querySelectorAll('[data-manage-materials]').forEach(btn =>
    btn.addEventListener('click', () => openMaterialsModal(btn.dataset.manageMaterials, project))
  );

  container.querySelectorAll('.status-inline-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const taskId = e.target.dataset.taskId;
      const newStatus = e.target.value;
      const allTasks = getTasks();
      const taskIndex = allTasks.findIndex(t => t.id === taskId);
      if (taskIndex > -1) {
        allTasks[taskIndex].status = newStatus;
        saveTasks(allTasks);
        renderTasks();
      }
    });
  });
}

function renderTaskRow(t) {
  const endDate = getTaskEndDate(t);
  const matCount = (t.materials || []).length;
  return `
    <tr>
      <td><span class="task-name">${escapeHtml(t.name)}</span></td>
      <td>${formatDate(t.startDate)}</td>
      <td>${t.duration}d</td>
      <td>${formatDate(endDate)}</td>
      <td>${t.masons || 0}</td>
      <td>${t.labourers || 0}</td>
      <td>
        <select class="form-select status-inline-select ${getStatusClass(t.status)}" data-task-id="${t.id}" style="padding: 2px 24px 2px 8px; font-size: 11px; height: 24px; border-radius: 12px; font-weight: 600; cursor: pointer; outline: none; -webkit-appearance: none; appearance: none; background-position: right 6px center; background-size: 10px;">
          ${STATUSES.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''} style="color:var(--text); background:var(--bg-body);">${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <button class="btn btn-ghost btn-xs" data-manage-materials="${t.id}">
          📦 ${matCount > 0 ? matCount + ' linked' : 'Link'}
        </button>
      </td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-xs" data-edit-task="${t.id}">Edit</button>
        <button class="btn btn-danger btn-xs" data-delete-task="${t.id}">Del</button>
      </td>
    </tr>
  `;
}

const STATUSES = ['Pending', 'In Progress', 'Completed', 'On Hold'];

function openTaskModal(project, editId = null) {
  const allTasks = getTasks();
  const task = editId ? allTasks.find(t => t.id === editId) : null;

  const formHtml = `
    <form id="task-form" autocomplete="off">
      <div class="form-group">
        <label class="form-label">Task Name *</label>
        <input id="tf-name" class="form-input" type="text" placeholder="e.g. Foundation Excavation" required value="${task ? escapeHtml(task.name) : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Start Date *</label>
          <input id="tf-start" class="form-input" type="date" required value="${task ? task.startDate : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Duration (days) *</label>
          <input id="tf-duration" class="form-input" type="number" min="1" placeholder="e.g. 14" required value="${task ? task.duration : ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">No. of Masons *</label>
          <input id="tf-masons" class="form-input" type="number" min="0" placeholder="e.g. 4" required value="${task ? (task.masons || 0) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">No. of Labourers *</label>
          <input id="tf-labourers" class="form-input" type="number" min="0" placeholder="e.g. 6" required value="${task ? (task.labourers || 0) : ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="tf-status" class="form-input form-select">
          ${STATUSES.map(s => `<option value="${s}" ${task?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${task ? 'Update Task' : 'Add Task'}</button>
      </div>
    </form>
  `;

  openModal(task ? 'Edit Task' : 'Add Task', formHtml);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('task-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('tf-name').value.trim();
    const startDate = document.getElementById('tf-start').value;
    const duration = parseInt(document.getElementById('tf-duration').value);
    const masons = parseInt(document.getElementById('tf-masons').value) || 0;
    const labourers = parseInt(document.getElementById('tf-labourers').value) || 0;
    const status = document.getElementById('tf-status').value;

    if (!name || !startDate || !duration) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    const tasks = getTasks();
    if (task) {
      const idx = tasks.findIndex(t => t.id === task.id);
      if (idx !== -1) Object.assign(tasks[idx], { name, startDate, duration, masons, labourers, status });
    } else {
      tasks.push({
        id: generateUUID(),
        projectId: project.id,
        name, startDate, duration, masons, labourers, status,
        materials: [],
      });
    }
    saveTasks(tasks);
    closeModal();
    showToast(task ? 'Task updated ✓' : 'Task added ✓', 'success');
    renderTasks();
    window.dispatchEvent(new CustomEvent('tasksChanged'));
  });
}

function deleteTask(id) {
  showConfirm('Delete this task?', () => {
    const tasks = getTasks().filter(t => t.id !== id);
    saveTasks(tasks);
    showToast('Task deleted', 'info');
    renderTasks();
    window.dispatchEvent(new CustomEvent('tasksChanged'));
  });
}

// ---- Link materials to a task ----
function openMaterialsModal(taskId, project) {
  const allTasks = getTasks();
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;

  const materials = getMaterials().filter(m => m.projectId === project.id);
  task.materials = task.materials || [];

  const buildMaterialRows = () => task.materials.map((tm, idx) => {
    const mat = materials.find(m => m.id === tm.materialId);
    return `
      <tr>
        <td>${mat ? escapeHtml(mat.name) : '—'}</td>
        <td>${mat ? mat.unit : ''}</td>
        <td>
          <input class="form-input form-input-xs tm-qty" type="number" min="0.01" step="0.01"
            data-idx="${idx}" value="${tm.quantity}" style="width:80px">
        </td>
        <td><button class="btn btn-danger btn-xs tm-remove" data-idx="${idx}">×</button></td>
      </tr>
    `;
  }).join('');

  const render = () => {
    const tbody = document.getElementById('tm-tbody');
    if (tbody) tbody.innerHTML = buildMaterialRows();
    bindMaterialRowEvents();
  };

  const formHtml = `
    <div class="form-group">
      <label class="form-label">Add Material to Task</label>
      <div class="form-row" style="gap:8px;align-items:flex-end">
        <select id="tm-select" class="form-input form-select" style="flex:2">
          <option value="">— Select material —</option>
          ${materials.map(m => `<option value="${m.id}">${escapeHtml(m.name)} (${m.unit})</option>`).join('')}
        </select>
        <input id="tm-qty" class="form-input" type="number" min="0.01" step="0.01" placeholder="Qty" style="flex:1;width:80px">
        <button class="btn btn-primary btn-sm" id="tm-add">Add</button>
      </div>
    </div>
    ${materials.length === 0 ? '<p class="text-muted" style="font-size:13px">No materials in inventory for this project. Add materials first.</p>' : ''}
    <div class="table-wrap" style="max-height:260px;overflow-y:auto">
      <table class="data-table">
        <thead><tr><th>Material</th><th>Unit</th><th>Quantity</th><th></th></tr></thead>
        <tbody id="tm-tbody">${buildMaterialRows()}</tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
      <button type="button" class="btn btn-primary" id="tm-save">Save Links</button>
    </div>
  `;

  openModal(`Link Materials — ${task.name}`, formHtml);

  function bindMaterialRowEvents() {
    document.querySelectorAll('.tm-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        task.materials.splice(parseInt(btn.dataset.idx), 1);
        render();
      });
    });
    document.querySelectorAll('.tm-qty').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.idx);
        task.materials[idx].quantity = parseFloat(inp.value) || 0;
      });
    });
  }

  document.getElementById('tm-add').addEventListener('click', () => {
    const matId = document.getElementById('tm-select').value;
    const qty = parseFloat(document.getElementById('tm-qty').value);
    if (!matId) { showToast('Select a material', 'error'); return; }
    if (!qty || qty <= 0) { showToast('Enter valid quantity', 'error'); return; }

    const existing = task.materials.find(m => m.materialId === matId);
    if (existing) { existing.quantity += qty; }
    else { task.materials.push({ materialId: matId, quantity: qty }); }
    document.getElementById('tm-qty').value = '';
    render();
  });

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('tm-save').addEventListener('click', () => {
    const allTasks = getTasks();
    const idx = allTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) allTasks[idx].materials = task.materials;
    saveTasks(allTasks);
    closeModal();
    showToast('Materials linked ✓', 'success');
    renderTasks();
  });

  bindMaterialRowEvents();
}

