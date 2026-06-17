// ============================================================
// pdf.js — PDF export using jsPDF (loaded via CDN in index.html)
// ============================================================

import { formatCurrency, formatDate, getTaskEndDate, formatNumber } from './helpers.js';
import { getSettings } from './storage.js';

function getDoc() {
  // jsPDF is loaded globally via CDN
  // eslint-disable-next-line no-undef
  return new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

const MARGIN = 15;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addHeader(doc, title, project, client, y) {
  const settings = getSettings();
  // Company name
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 60);
  doc.text(settings.companyName, MARGIN, y);
  y += 8;

  doc.setFontSize(14);
  doc.setTextColor(80, 80, 120);
  doc.text(title, MARGIN, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 80);
  doc.text(`Project: ${project}`, MARGIN, y);
  if (client) { y += 5; doc.text(`Client: ${client}`, MARGIN, y); }
  y += 5;
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, MARGIN, y);
  y += 6;

  // Divider
  doc.setDrawColor(100, 60, 180);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;
  return y;
}

function addTable(doc, headers, rows, y) {
  const colW = CONTENT_W / headers.length;
  const rowH = 8;

  // Header row
  doc.setFillColor(60, 30, 120);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
  headers.forEach((h, i) => {
    doc.text(h, MARGIN + colW * i + 2, y + 5.5);
  });
  y += rowH;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rows.forEach((row, ri) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFillColor(ri % 2 === 0 ? 248 : 240, ri % 2 === 0 ? 248 : 240, ri % 2 === 0 ? 255 : 248);
    doc.setTextColor(30, 30, 60);
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    row.forEach((cell, ci) => {
      doc.text(String(cell ?? ''), MARGIN + colW * ci + 2, y + 5.5);
    });
    y += rowH;
  });
  y += 4;
  return y;
}

function addSummaryBox(doc, items, y) {
  const boxH = items.length * 7 + 8;
  doc.setFillColor(245, 240, 255);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 3, 3, 'F');
  doc.setDrawColor(120, 80, 200);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 3, 3, 'S');
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  items.forEach(([label, value, isTotal]) => {
    doc.setTextColor(isTotal ? 80 : 60, isTotal ? 20 : 60, isTotal ? 160 : 80);
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setFontSize(isTotal ? 11 : 9);
    doc.text(label, MARGIN + 4, y);
    doc.text(value, PAGE_W - MARGIN - 4, y, { align: 'right' });
    y += 7;
  });
  return y + 4;
}

// Export single task invoice
export function exportTaskPDF(task, project, materials) {
  const doc = getDoc();
  let y = MARGIN;

  y = addHeader(doc, 'Task Invoice', project.name, project.client, y);

  // Task details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(50, 50, 80);
  doc.text(`Task: ${task.name}`, MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Start: ${formatDate(task.startDate)}  |  Duration: ${task.duration} days  |  End: ${formatDate(getTaskEndDate(task))}  |  Status: ${task.status}`, MARGIN, y);
  y += 8;

  const settings = getSettings();
  const masonRate  = project.masonRate   || settings.defaultMasonRate;
  const labourRate = project.labourRate  || settings.defaultLabourRate;
  const profitMargin = project.profitMargin || settings.defaultProfitMargin;

  // Materials table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(60, 20, 120);
  doc.text('Materials Schedule', MARGIN, y);
  y += 5;

  const matRows = [];
  let totalMatCost = 0;
  (task.materials || []).forEach(m => {
    const mat = materials.find(x => x.id === m.materialId);
    if (!mat) return;
    const amt = m.quantity * mat.costPerUnit;
    totalMatCost += amt;
    matRows.push([mat.name, mat.unit, formatNumber(m.quantity), formatCurrency(mat.costPerUnit), formatCurrency(amt)]);
  });
  if (matRows.length === 0) matRows.push(['No materials linked', '', '', '', '']);
  y = addTable(doc, ['Material', 'Unit', 'Qty', 'Rate (Rs.)', 'Amount (Rs.)'], matRows, y);

  // Labour table — split mason and labourer rows
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(60, 20, 120);
  doc.text('Labour Schedule', MARGIN, y);
  y += 5;
  const masonCost  = (task.masons   || 0) * task.duration * masonRate;
  const labourCost = (task.labourers || 0) * task.duration * labourRate;
  const labourRows = [];
  if ((task.masons || 0) > 0)   labourRows.push(['Mason',    task.masons,    task.duration, formatCurrency(masonRate),  formatCurrency(masonCost)]);
  if ((task.labourers || 0) > 0) labourRows.push(['Labourer', task.labourers, task.duration, formatCurrency(labourRate), formatCurrency(labourCost)]);
  if (labourRows.length === 0)   labourRows.push(['No workers assigned', '', '', '', '']);
  y = addTable(doc, ['Type', 'Workers', 'Days', 'Rate/Day', 'Amount (Rs.)'], labourRows, y);

  // Summary
  const totalLabourCost = masonCost + labourCost;
  const subtotal = totalMatCost + totalLabourCost;
  const profit = subtotal * (profitMargin / 100);
  const total = subtotal + profit;
  y = addSummaryBox(doc, [
    ['Materials Total', formatCurrency(totalMatCost)],
    ['Mason Labour Total', formatCurrency(masonCost)],
    ['Unskilled Labour Total', formatCurrency(labourCost)],
    ['Subtotal', formatCurrency(subtotal)],
    [`Profit (${profitMargin}%)`, formatCurrency(profit)],
    ['Grand Total', formatCurrency(total), true],
  ], y);

  doc.save(`Task_Invoice_${task.name.replace(/\s+/g, '_')}.pdf`);
}

// Export full project BOQ
export function exportProjectBOQ(project, tasks, materials, expenses = []) {
  const doc = getDoc();
  let y = MARGIN;

  y = addHeader(doc, 'Bill of Quantities (BOQ)', project.name, project.client, y);

  const settings = getSettings();
  const masonRate  = project.masonRate   || settings.defaultMasonRate;
  const labourRate = project.labourRate  || settings.defaultLabourRate;
  const profitMargin = project.profitMargin || settings.defaultProfitMargin;

  // Materials aggregate
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(60, 20, 120);
  doc.text('Materials Schedule (All Tasks)', MARGIN, y);
  y += 5;

  // Aggregate all materials across tasks
  const matMap = {};
  tasks.forEach(task => {
    (task.materials || []).forEach(m => {
      const mat = materials.find(x => x.id === m.materialId);
      if (!mat) return;
      if (!matMap[mat.id]) matMap[mat.id] = { ...mat, usedQty: 0 };
      matMap[mat.id].usedQty += m.quantity;
    });
  });

  const matRows = Object.values(matMap).map(m => {
    const amt = m.usedQty * m.costPerUnit;
    return [m.name, m.unit, formatNumber(m.usedQty), formatCurrency(m.costPerUnit), formatCurrency(amt)];
  });
  let totalMatCost = Object.values(matMap).reduce((s, m) => s + m.usedQty * m.costPerUnit, 0);
  if (matRows.length === 0) matRows.push(['No materials linked', '', '', '', '']);
  y = addTable(doc, ['Material', 'Unit', 'Qty', 'Rate (Rs.)', 'Amount (Rs.)'], matRows, y);

  if (y > 220) { doc.addPage(); y = 20; }

  // Labour breakdown — split mason and labourer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(60, 20, 120);
  doc.text('Labour Schedule (All Tasks)', MARGIN, y);
  y += 5;

  let totalMasonCost = 0;
  let totalLabourCost = 0;
  const labourRows = [];
  tasks.forEach(task => {
    const mc = (task.masons   || 0) * task.duration * masonRate;
    const lc = (task.labourers || 0) * task.duration * labourRate;
    totalMasonCost  += mc;
    totalLabourCost += lc;
    if ((task.masons || 0) > 0)    labourRows.push([task.name + ' (Mason)',    task.masons,    task.duration, formatCurrency(masonRate),  formatCurrency(mc)]);
    if ((task.labourers || 0) > 0) labourRows.push([task.name + ' (Labourer)', task.labourers, task.duration, formatCurrency(labourRate), formatCurrency(lc)]);
  });
  if (labourRows.length === 0) labourRows.push(['No tasks', '', '', '', '']);
  y = addTable(doc, ['Task / Type', 'Workers', 'Days', 'Rate/Day', 'Amount (Rs.)'], labourRows, y);

  // Additional Expenses Schedule
  if (expenses && expenses.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(60, 20, 120);
    doc.text('Additional Expenses (Direct Costs)', MARGIN, y);
    y += 5;

    const expenseRows = expenses.map(e => [
      e.description,
      e.category || 'Others',
      formatDate(e.date),
      formatCurrency(e.amount)
    ]);
    y = addTable(doc, ['Description', 'Category', 'Date', 'Amount (Rs.)'], expenseRows, y);
  }

  if (y > 200) { doc.addPage(); y = 20; }

  // Summary
  const grandLabourCost = totalMasonCost + totalLabourCost;
  const subtotal = totalMatCost + grandLabourCost;
  const profit = subtotal * (profitMargin / 100);
  const totalExpenses = expenses ? expenses.reduce((s, e) => s + e.amount, 0) : 0;
  const total = subtotal + profit + totalExpenses;

  const summaryItems = [
    ['Total Materials Cost', formatCurrency(totalMatCost)],
    ['Total Mason Labour', formatCurrency(totalMasonCost)],
    ['Total Unskilled Labour', formatCurrency(totalLabourCost)],
    ['Subtotal', formatCurrency(subtotal)],
    [`Profit Margin (${profitMargin}%)`, formatCurrency(profit)],
  ];
  if (totalExpenses > 0) {
    summaryItems.push(['Total Additional Expenses', formatCurrency(totalExpenses)]);
  }
  summaryItems.push(['Grand Total Project Cost', formatCurrency(total), true]);

  y = addSummaryBox(doc, summaryItems, y);

  doc.save(`BOQ_${project.name.replace(/\s+/g, '_')}.pdf`);
}
