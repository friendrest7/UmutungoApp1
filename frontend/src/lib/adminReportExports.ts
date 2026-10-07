import { AdminReport } from './umutungoApi';

export type AdminActivityExportRecord = {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  activity_type: string;
  summary: string;
  created_at: string;
};

type ReportColumn = { label: string; value: (report: AdminReport) => string };

const columns: ReportColumn[] = [
  { label: 'Report ID', value: (report) => report.id },
  { label: 'Listing', value: (report) => report.listing_title || 'Account report' },
  { label: 'Reporter', value: (report) => report.reporter_name || '-' },
  { label: 'Reported user', value: (report) => report.reported_user_name || '-' },
  { label: 'Reason', value: (report) => report.reason },
  { label: 'Details', value: (report) => report.details || '-' },
  { label: 'Status', value: (report) => report.status },
  { label: 'Created', value: (report) => formatDate(report.created_at) },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function escapeHtml(value: string) {
  return escapeXml(value);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReportsExcel(reports: AdminReport[]) {
  const header = columns.map((column) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(column.label)}</Data></Cell>`).join('');
  const body = reports.map((report) => `<Row>${columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.value(report))}</Data></Cell>`).join('')}</Row>`).join('');
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#d8f1dc" ss:Pattern="Solid"/></Style></Styles>
  <Worksheet ss:Name="Admin reports"><Table><Row>${header}</Row>${body || '<Row><Cell ss:MergeAcross="7"><Data ss:Type="String">No reports found</Data></Cell></Row>'}</Table></Worksheet>
</Workbook>`;
  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }), `umutungo-admin-reports-${new Date().toISOString().slice(0, 10)}.xls`);
}

function wrapText(value: string, maxLength: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > maxLength) {
      if (current) lines.push(current);
      for (let index = 0; index < word.length; index += maxLength) lines.push(word.slice(index, index + maxLength));
      current = '';
    } else if (!current) current = word;
    else if (`${current} ${word}`.length <= maxLength) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function pdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function downloadReportsPdf(reports: AdminReport[]) {
  const lines = [`UMUTUNGO ADMIN REPORTS`, `Generated: ${new Date().toLocaleString()}`, `Total reports: ${reports.length}`, ''];
  if (!reports.length) lines.push('No reports found.');
  reports.forEach((report, index) => {
    lines.push(`Report ${index + 1}: ${report.listing_title || 'Account report'}`);
    columns.slice(0, 1).forEach((column) => lines.push(`${column.label}: ${column.value(report)}`));
    lines.push(`Reporter: ${report.reporter_name || '-'}`);
    lines.push(`Reported user: ${report.reported_user_name || '-'}`);
    lines.push(`Reason: ${report.reason}`);
    lines.push(`Details: ${report.details || '-'}`);
    lines.push(`Status: ${report.status} | Created: ${formatDate(report.created_at)}`);
    lines.push('');
  });
  const wrapped = lines.flatMap((line) => wrapText(line, 92));
  const pageSize = 34;
  const pages = Array.from({ length: Math.max(1, Math.ceil(wrapped.length / pageSize)) }, (_, index) => wrapped.slice(index * pageSize, (index + 1) * pageSize));
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const pageObjectNumbers: number[] = [];
  pages.forEach((pageLines) => {
    const pageNumber = objects.length + 1;
    const contentNumber = pageNumber + 1;
    pageObjectNumbers.push(pageNumber);
    const content = ['BT', '/F1 11 Tf', '54 742 Td', ...pageLines.map((line, index) => `${index === 0 ? '/F1 16 Tf' : '/F1 11 Tf'} (${pdfText(line)}) Tj 0 -20 Td`), 'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${contentNumber + 1} 0 R >> >> /Contents ${contentNumber} 0 R >>`);
    objects.push(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);
  });
  const fontNumber = objects.length + 1;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    object = object.replace(/\/F1 \d+ 0 R/g, `/F1 ${fontNumber} 0 R`);
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), `umutungo-admin-reports-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function reportsSvg(reports: AdminReport[]) {
  const rowHeight = 78;
  const width = 1600;
  const height = 190 + Math.max(1, reports.length) * rowHeight;
  const rows = reports.length ? reports.map((report, index) => {
    const y = 155 + index * rowHeight;
    return `<g><rect x="36" y="${y - 42}" width="1528" height="${rowHeight - 8}" rx="12" fill="${index % 2 ? '#f4f8f4' : '#ffffff'}"/><text x="60" y="${y - 12}" class="title">${escapeHtml(report.listing_title || 'Account report')}</text><text x="60" y="${y + 12}" class="body">${escapeHtml(report.reason)} - ${escapeHtml(report.status)} - ${escapeHtml(formatDate(report.created_at))}</text><text x="60" y="${y + 36}" class="muted">Reporter: ${escapeHtml(report.reporter_name || '-')} - ${escapeHtml(report.details || 'No details')}</text></g>`;
  }).join('') : '<text x="60" y="170" class="body">No reports found.</text>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbfdfb"/><rect width="100%" height="112" fill="#0b5d31"/><text x="36" y="50" class="heading">UMUTUNGO ADMIN REPORTS</text><text x="36" y="83" class="subheading">${reports.length} report${reports.length === 1 ? '' : 's'} - Generated ${escapeHtml(new Date().toLocaleString())}</text><style>.heading{font:700 31px Arial;fill:#fff}.subheading{font:400 17px Arial;fill:#d8f1dc}.title{font:700 21px Arial;fill:#173a22}.body{font:400 17px Arial;fill:#2b5c39}.muted{font:400 14px Arial;fill:#66816d}</style>${rows}</svg>`;
}

export async function downloadReportsImage(reports: AdminReport[]) {
  const svg = reportsSvg(reports);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Report image could not be rendered.')); image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || 1600;
    canvas.height = image.naturalHeight || 300;
    canvas.getContext('2d')?.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Report image could not be created.');
    downloadBlob(blob, `umutungo-admin-reports-${new Date().toISOString().slice(0, 10)}.png`);
  } finally { URL.revokeObjectURL(url); }
}

const activityColumns: Array<{ label: string; value: (item: AdminActivityExportRecord) => string }> = [
  { label: 'Date', value: (item) => formatDate(item.created_at) },
  { label: 'User', value: (item) => item.actor_name },
  { label: 'Role', value: (item) => item.actor_role.replaceAll('_', ' ') },
  { label: 'Activity', value: (item) => item.activity_type.replaceAll('_', ' ') },
  { label: 'Details', value: (item) => item.summary },
  { label: 'User ID', value: (item) => item.actor_id },
];

function activityFilename(extension: string) {
  return `umutungo-user-activity-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function downloadActivityExcel(items: AdminActivityExportRecord[]) {
  const header = activityColumns.map((column) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(column.label)}</Data></Cell>`).join('');
  const body = items.map((item) => `<Row>${activityColumns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column.value(item))}</Data></Cell>`).join('')}</Row>`).join('');
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#d8f1dc" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="User activity"><Table><Row>${header}</Row>${body}</Table></Worksheet></Workbook>`;
  downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }), activityFilename('xls'));
}

export function downloadActivityPdf(items: AdminActivityExportRecord[]) {
  const lines = ['UMUTUNGO · USER ACTIVITY', `Generated: ${new Date().toLocaleString()}`, `Activities: ${items.length}`, ''];
  if (!items.length) lines.push('No recorded activities.');
  items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.actor_name} · ${item.actor_role.replaceAll('_', ' ')}`);
    lines.push(`${item.activity_type.replaceAll('_', ' ')} · ${formatDate(item.created_at)}`);
    lines.push(item.summary, `User ID: ${item.actor_id}`, '');
  });
  const wrapped = lines.flatMap((line) => wrapText(line, 92));
  const pages = Array.from({ length: Math.max(1, Math.ceil(wrapped.length / 34)) }, (_, i) => wrapped.slice(i * 34, (i + 1) * 34));
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const pageNumbers: number[] = [];
  pages.forEach((pageLines) => {
    const pageNumber = objects.length + 1;
    const contentNumber = pageNumber + 1;
    pageNumbers.push(pageNumber);
    const content = ['BT', '/F1 11 Tf', '54 742 Td', ...pageLines.map((line, index) => `${index === 0 ? '/F1 16 Tf' : '/F1 11 Tf'} (${pdfText(line)}) Tj 0 -20 Td`), 'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${contentNumber + 1} 0 R >> >> /Contents ${contentNumber} 0 R >>`);
    objects.push(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);
  });
  const fontNumber = objects.length + 1;
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects[1] = `<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageNumbers.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { object = object.replace(/\/F1 \d+ 0 R/g, `/F1 ${fontNumber} 0 R`); offsets.push(new TextEncoder().encode(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), activityFilename('pdf'));
}

export async function downloadActivityImage(items: AdminActivityExportRecord[]) {
  const width = 1600;
  const rowHeight = 88;
  const displayItems = items.slice(0, 10);
  const height = 205 + Math.max(1, displayItems.length) * rowHeight;
  const rows = displayItems.length ? displayItems.map((item, index) => {
    const y = 164 + index * rowHeight;
    return `<g><rect x="36" y="${y - 40}" width="1528" height="76" rx="8" fill="${index % 2 ? '#f3f7f2' : '#fff'}"/><text x="58" y="${y - 10}" class="title">${escapeHtml(item.actor_name)} · ${escapeHtml(item.actor_role.replaceAll('_', ' '))}</text><text x="58" y="${y + 15}" class="body">${escapeHtml(item.summary)}</text><text x="58" y="${y + 37}" class="muted">${escapeHtml(item.activity_type.replaceAll('_', ' '))} · ${escapeHtml(formatDate(item.created_at))}</text></g>`;
  }).join('') : '<text x="58" y="170" class="body">No recorded activities.</text>';
  const imageNote = items.length > displayItems.length ? ` · showing newest ${displayItems.length}` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbfdfb"/><rect width="100%" height="112" fill="#0b5d31"/><text x="36" y="50" class="heading">UMUTUNGO · USER ACTIVITY</text><text x="36" y="83" class="subheading">${items.length} activities${escapeHtml(imageNote)} · Generated ${escapeHtml(new Date().toLocaleString())}</text><style>.heading{font:700 30px Arial;fill:#fff}.subheading{font:400 16px Arial;fill:#d8f1dc}.title{font:700 20px Arial;fill:#173a22}.body{font:400 16px Arial;fill:#2b5c39}.muted{font:400 13px Arial;fill:#66816d}</style>${rows}</svg>`;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Report image could not be rendered.')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Report image could not be created.');
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Report image could not be created.');
    downloadBlob(blob, activityFilename('png'));
  } finally { URL.revokeObjectURL(url); }
}
