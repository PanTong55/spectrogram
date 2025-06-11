// modules/exportCsv.js

import { getFileList, getFileMetadata, getFileIconState, getFileNote } from './fileState.js';

export function exportFileListCsv(filename = 'export.csv') {
  const header = [
    'File name',
    'Date',
    'Time',
    'Latitude',
    'Longitude',
    'Noise',
    'Star',
    'Question',
    'Remark'
  ];
  const rows = [header];
  const files = getFileList();
  files.forEach((file, idx) => {
    const meta = getFileMetadata(idx);
    const icon = getFileIconState(idx);
    const note = getFileNote(idx);
    let date = '';
    let time = '';
    if (meta.timestamp) {
      const [d, t] = meta.timestamp.split('T');
      if (d) date = d.replace(/-/g, '/');
      if (t) time = t.substring(0, 5).replace(':', '');
    }
    rows.push([
      file.name,
      date,
      time,
      meta.lat || '',
      meta.lon || '',
      icon.trash ? 1 : '',
      icon.star ? 1 : '',
      icon.question ? 1 : '',
      note || ''
    ]);
  });

  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
