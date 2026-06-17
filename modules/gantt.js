// ============================================================
// gantt.js — Custom HTML Gantt Chart (no external libraries)
// ============================================================

import { getTaskEndDate, getStatusColor, formatDate, escapeHtml } from '../utils/helpers.js';
import { getTasks } from '../utils/storage.js';
import { getActiveProject } from './projects.js';

export function renderGantt() {
  const project = getActiveProject();
  const container = document.getElementById('section-gantt');

  if (!project) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><h3>No active project</h3><p>Open a project first.</p></div>`;
    return;
  }

  const tasks = getTasks().filter(t => t.projectId === project.id);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">📊 Gantt Chart</h2>
        <p class="section-subtitle">${tasks.length} task${tasks.length !== 1 ? 's' : ''} · ${project.name}</p>
      </div>
    </div>
    <div class="gantt-legend">
      <span class="legend-item"><span class="legend-dot" style="background:#22c55e"></span>Completed</span>
      <span class="legend-item"><span class="legend-dot" style="background:#eab308"></span>In Progress / Pending</span>
      <span class="legend-item"><span class="legend-dot" style="background:#ef4444"></span>On Hold</span>
    </div>
    <div id="gantt-wrapper"></div>
  `;

  if (tasks.length === 0) {
    document.getElementById('gantt-wrapper').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h3>No tasks to display</h3>
        <p>Add tasks to see the Gantt chart.</p>
      </div>`;
    return;
  }

  buildGanttChart(tasks, document.getElementById('gantt-wrapper'));
}

function buildGanttChart(tasks, wrapper) {
  // Compute date range
  const startDates = tasks.map(t => new Date(t.startDate).getTime());
  const endDates = tasks.map(t => getTaskEndDate(t).getTime());
  const minTime = Math.min(...startDates);
  const maxTime = Math.max(...endDates);

  const totalDays = Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24)) + 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = Math.floor((today.getTime() - minTime) / (1000 * 60 * 60 * 24));

  const CELL_W = Math.max(20, Math.min(36, Math.floor(1200 / totalDays)));
  const ROW_H = 44;
  const LABEL_W = 220;

  // Build month/week headers
  const headerDays = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(minTime + i * 86400000);
    headerDays.push(d);
  }

  // Group by month for header
  const months = [];
  let lastMonth = -1;
  headerDays.forEach((d, i) => {
    if (d.getMonth() !== lastMonth) {
      if (months.length > 0) months[months.length - 1].span = i - months[months.length - 1].start;
      months.push({ label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), start: i, span: 0 });
      lastMonth = d.getMonth();
    }
  });
  if (months.length > 0) months[months.length - 1].span = totalDays - months[months.length - 1].start;

  const totalChartW = totalDays * CELL_W + LABEL_W;

  let html = `
    <div class="gantt-scroll-wrap">
      <div class="gantt-chart" style="min-width:${totalChartW}px">
        <!-- Month header -->
        <div class="gantt-header-row" style="display:flex">
          <div class="gantt-label-col" style="min-width:${LABEL_W}px;max-width:${LABEL_W}px"></div>
          <div style="display:flex;flex:1">
            ${months.map(m => `
              <div class="gantt-month-header" style="min-width:${m.span * CELL_W}px;max-width:${m.span * CELL_W}px">
                ${m.label}
              </div>
            `).join('')}
          </div>
        </div>
        <!-- Day header -->
        <div class="gantt-header-row gantt-day-row" style="display:flex">
          <div class="gantt-label-col" style="min-width:${LABEL_W}px;max-width:${LABEL_W}px;font-size:11px;font-weight:600;color:var(--text-muted)">Task</div>
          <div style="display:flex;flex:1">
            ${headerDays.map((d, i) => `
              <div class="gantt-day-cell ${d.getDay() === 0 || d.getDay() === 6 ? 'gantt-weekend' : ''} ${i === todayOffset ? 'gantt-today-header' : ''}"
                style="min-width:${CELL_W}px;max-width:${CELL_W}px;font-size:9px">
                ${d.getDate()}
              </div>
            `).join('')}
          </div>
        </div>
        <!-- Task rows -->
        ${tasks.map((task, rowIdx) => {
          const taskStart = new Date(task.startDate).getTime();
          const taskEnd = getTaskEndDate(task).getTime();
          const offsetDays = Math.floor((taskStart - minTime) / 86400000);
          const durationDays = Math.ceil((taskEnd - taskStart) / 86400000);
          const color = getStatusColor(task.status);
          const barLeft = offsetDays * CELL_W;
          const barWidth = Math.max(durationDays * CELL_W - 2, CELL_W - 2);

          return `
            <div class="gantt-task-row ${rowIdx % 2 === 0 ? 'gantt-row-even' : ''}" style="display:flex;height:${ROW_H}px;position:relative">
              <div class="gantt-label-col" style="min-width:${LABEL_W}px;max-width:${LABEL_W}px;align-items:center;display:flex;gap:6px;padding:0 8px;overflow:hidden">
                <span class="gantt-task-dot" style="background:${color}"></span>
                <span class="gantt-task-label" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</span>
              </div>
              <div style="position:relative;flex:1;min-width:${totalDays * CELL_W}px">
                <!-- Today line -->
                ${todayOffset >= 0 && todayOffset < totalDays ? `
                  <div class="gantt-today-line" style="left:${todayOffset * CELL_W + CELL_W / 2}px"></div>
                ` : ''}
                <!-- Weekend shading -->
                ${headerDays.map((d, i) => d.getDay() === 0 || d.getDay() === 6
                  ? `<div class="gantt-weekend-shade" style="left:${i * CELL_W}px;width:${CELL_W}px"></div>`
                  : '').join('')}
                <!-- Task bar -->
                <div class="gantt-bar" style="
                  left:${barLeft}px;
                  width:${barWidth}px;
                  background:${color};
                  box-shadow: 0 0 8px ${color}66;
                " title="${escapeHtml(task.name)}: ${formatDate(task.startDate)} → ${formatDate(getTaskEndDate(task))}">
                  <span class="gantt-bar-label">${escapeHtml(task.name)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  wrapper.innerHTML = html;
}

// Mini Gantt for dashboard preview (first N tasks, compact)
export function buildMiniGantt(tasks, wrapper) {
  if (!tasks || tasks.length === 0) return;
  const startDates = tasks.map(t => new Date(t.startDate).getTime());
  const endDates = tasks.map(t => getTaskEndDate(t).getTime());
  const minTime = Math.min(...startDates);
  const maxTime = Math.max(...endDates);
  const totalDays = Math.ceil((maxTime - minTime) / 86400000) + 1;
  const CELL_W = Math.max(8, Math.min(20, Math.floor(700 / totalDays)));
  const LABEL_W = 140;
  const ROW_H = 28;

  let html = `<div style="min-width:${totalDays * CELL_W + LABEL_W}px">`;
  tasks.forEach((task, i) => {
    const taskStart = new Date(task.startDate).getTime();
    const taskEnd = getTaskEndDate(task).getTime();
    const offsetDays = Math.floor((taskStart - minTime) / 86400000);
    const durationDays = Math.ceil((taskEnd - taskStart) / 86400000);
    const color = getStatusColor(task.status);
    const barLeft = LABEL_W + offsetDays * CELL_W;
    const barWidth = Math.max(durationDays * CELL_W - 1, CELL_W - 1);

    html += `
      <div style="display:flex;align-items:center;height:${ROW_H}px;position:relative;${i % 2 === 0 ? 'background:rgba(255,255,255,0.02)' : ''}">
        <div style="min-width:${LABEL_W}px;max-width:${LABEL_W}px;font-size:11px;color:var(--text-muted);padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</div>
        <div style="position:relative;flex:1;height:${ROW_H}px">
          <div style="
            position:absolute;
            left:${offsetDays * CELL_W}px;
            width:${barWidth}px;
            height:16px;
            top:50%;
            transform:translateY(-50%);
            background:${color};
            border-radius:3px;
            box-shadow:0 0 6px ${color}66;
            display:flex;align-items:center;padding-left:4px;overflow:hidden;
          ">
            <span style="font-size:9px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(task.name)}</span>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  wrapper.innerHTML = html;
}
