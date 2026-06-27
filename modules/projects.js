// ============================================================
// projects.js — Project CRUD + rendering
// ============================================================

import { generateUUID, formatDate, escapeHtml } from '../utils/helpers.js';
import { getProjects, saveProjects, getTasks, saveTasks, getMaterials, saveMaterials, getActiveProjectId, saveActiveProjectId } from '../utils/storage.js';
import { showToast, showConfirm, openModal, closeModal } from '../utils/ui.js';

let projects = [];

export function initProjects() {
  projects = getProjects();
}

export function getActiveProject() {
  const id = getActiveProjectId();
  return projects.find(p => p.id === id) || null;
}

export function setActiveProject(id) {
  saveActiveProjectId(id);
}

export function renderProjects() {
  projects = getProjects();
  const container = document.getElementById('section-projects');
  const activeId = getActiveProjectId();

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">📁 Projects</h2>
        <p class="section-subtitle">${projects.length} project${projects.length !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary" id="btn-new-project">
        <span>+</span> New Project
      </button>
    </div>

    ${projects.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>No projects yet</h3>
        <p>Create your first construction project to get started.</p>
        <button class="btn btn-primary" id="btn-new-project-empty">+ Create Project</button>
      </div>
    ` : `
      <div class="project-grid">
        ${projects.map(p => renderProjectCard(p, activeId)).join('')}
      </div>
    `}
  `;

  // Bind events
  document.getElementById('btn-new-project')?.addEventListener('click', openProjectModal);
  document.getElementById('btn-new-project-empty')?.addEventListener('click', openProjectModal);
  container.querySelectorAll('[data-open-project]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.openProject;
      saveActiveProjectId(id);
      window.dispatchEvent(new CustomEvent('activeProjectChanged'));
      window.navigateTo('dashboard');
    });
  });
  container.querySelectorAll('[data-delete-project]').forEach(btn => {
    btn.addEventListener('click', () => deleteProject(btn.dataset.deleteProject));
  });
  container.querySelectorAll('[data-edit-project]').forEach(btn => {
    btn.addEventListener('click', () => openProjectModal(btn.dataset.editProject));
  });
}

function renderProjectCard(p, activeId) {
  const isActive = p.id === activeId;
  const tasks = getTasks().filter(t => t.projectId === p.id);
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  return `
    <div class="project-card ${isActive ? 'project-card--active' : ''}">
      ${isActive ? '<div class="active-badge">● Active</div>' : ''}
      <div class="project-card__header">
        <h3 class="project-card__name">${escapeHtml(p.name)}</h3>
        <span class="project-card__client">${escapeHtml(p.client)}</span>
      </div>
      <div class="project-card__meta">
        <span>📍 ${escapeHtml(p.location)}</span>
        <span>📅 ${formatDate(p.startDate)}</span>
      </div>
      ${p.description ? `<p class="project-card__desc">${escapeHtml(p.description)}</p>` : ''}
      <div class="project-card__stats">
        <div class="stat-mini">
          <span class="stat-mini__val">${tasks.length}</span>
          <span class="stat-mini__label">Tasks</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini__val">${completed}</span>
          <span class="stat-mini__label">Done</span>
        </div>
        <div class="stat-mini">
          <span class="stat-mini__val">${progress}%</span>
          <span class="stat-mini__label">Progress</span>
        </div>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${progress}%"></div>
      </div>
      <div class="project-card__actions">
        <button class="btn btn-primary btn-sm" data-open-project="${p.id}">Open</button>
        <button class="btn btn-ghost btn-sm" data-edit-project="${p.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-delete-project="${p.id}">Delete</button>
      </div>
    </div>
  `;
}

function openProjectModal(editIdOrEvent) {
  const editId = (typeof editIdOrEvent === 'string') ? editIdOrEvent : null;
  const project = editId ? projects.find(p => p.id === editId) : null;

  const formHtml = `
    <form id="project-form" autocomplete="off">
      <div class="form-group">
        <label class="form-label">Project Name *</label>
        <input id="pf-name" class="form-input" type="text" placeholder="e.g. Office Block A" required value="${project ? escapeHtml(project.name) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Client Name *</label>
        <input id="pf-client" class="form-input" type="text" placeholder="Client / Company" required value="${project ? escapeHtml(project.client) : ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Location</label>
          <input id="pf-location" class="form-input" type="text" placeholder="City / Site" value="${project ? escapeHtml(project.location) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Start Date *</label>
          <input id="pf-startdate" class="form-input" type="date" required value="${project ? project.startDate : ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="pf-desc" class="form-input form-textarea" placeholder="Brief project description...">${project ? escapeHtml(project.description) : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Mason Rate (Rs./mason/day) *</label>
          <input id="pf-masonrate" class="form-input" type="number" min="0" placeholder="2500" required value="${project ? project.masonRate || '' : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Labour Rate (Rs./labourer/day) *</label>
          <input id="pf-labourrate" class="form-input" type="number" min="0" placeholder="1500" required value="${project ? project.labourRate || '' : ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Profit Margin (%) *</label>
        <input id="pf-profit" class="form-input" type="number" min="0" max="100" placeholder="15" required value="${project ? project.profitMargin || '' : ''}">
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary">${project ? 'Update Project' : 'Create Project'}</button>
      </div>
    </form>
  `;

  openModal(project ? 'Edit Project' : 'New Project', formHtml);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('project-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('pf-name').value.trim();
    const client = document.getElementById('pf-client').value.trim();
    const location = document.getElementById('pf-location').value.trim();
    const startDate = document.getElementById('pf-startdate').value;
    const description = document.getElementById('pf-desc').value.trim();
    const masonRate = parseFloat(document.getElementById('pf-masonrate').value) || null;
    const labourRate = parseFloat(document.getElementById('pf-labourrate').value) || null;
    const profitMargin = parseFloat(document.getElementById('pf-profit').value) || null;

    if (!name || !client || !startDate) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    if (project) {
      Object.assign(project, { name, client, location, startDate, description, masonRate, labourRate, profitMargin });
    } else {
      const newProject = {
        id: generateUUID(),
        name, client, location, startDate, description,
        masonRate, labourRate, profitMargin,
        createdAt: Date.now(),
      };
      projects.push(newProject);
      saveActiveProjectId(newProject.id);
    }

    saveProjects(projects);
    closeModal();
    showToast(project ? 'Project updated ✓' : 'Project created ✓', 'success');
    renderProjects();
    window.dispatchEvent(new CustomEvent('activeProjectChanged'));
  });
}

function deleteProject(id) {
  showConfirm('Delete this project? All its tasks and materials will also be removed. This cannot be undone.', () => {
    projects = projects.filter(p => p.id !== id);
    saveProjects(projects);

    // Cascade delete
    const tasks = getTasks().filter(t => t.projectId !== id);
    saveTasks(tasks);
    const materials = getMaterials().filter(m => m.projectId !== id);
    saveMaterials(materials);

    if (getActiveProjectId() === id) {
      saveActiveProjectId(projects[0]?.id || null);
      window.dispatchEvent(new CustomEvent('activeProjectChanged'));
    }
    showToast('Project deleted', 'info');
    renderProjects();
  });
}

