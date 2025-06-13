// modules/exportCsv.js

import { getFileList, getFileIconState, getFileNote, getFileMetadata, setFileMetadata } from './fileState.js';
import { extractGuanoMetadata, parseGuanoMetadata } from './guanoReader.js';

async function generateCsvRows() {
  const files = getFileList();
  const headers = ['File name','Remark','Date','Time','Latitude','Longitude','Noise','Star','Question'];
  const rows = [headers.join(',')];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let meta = getFileMetadata(i);
    if (!meta || (!meta.date && !meta.time && !meta.latitude && !meta.longitude)) {
      try {
        const txt = await extractGuanoMetadata(file);
        meta = parseGuanoMetadata(txt);
        setFileMetadata(i, meta);
      } catch (err) {
        meta = { date: '', time: '', latitude: '', longitude: '' };
      }
    }

    const flags = getFileIconState(i);
    const note = getFileNote(i);
    const row = [
      file.name,
      note,
      meta.date,
      meta.time,
      meta.latitude,
      meta.longitude,
      flags.trash ? '1' : '0',
      flags.star ? '1' : '0',
      flags.question ? '1' : '0'
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    rows.push(row);
  }

  return rows;
}

async function exportCsv() {
  const rows = await generateCsvRows();
  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'export.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function initExportCsv({ buttonId = 'exportBtn' } = {}) {
  const btn = document.getElementById(buttonId);
  if (!btn) {
    console.warn(`[exportCsv] Button with id '${buttonId}' not found.`);
    return;
  }
  btn.addEventListener('click', exportCsv);
}
