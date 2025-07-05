// modules/trashProgram.js

import { getTrashFileNames } from './fileState.js';

export function initTrashProgram({ buttonId = 'trashProgramBtn' } = {}) {
  const btn = document.getElementById(buttonId);
  if (!btn) {
    console.warn(`[trashProgram] Button with id '${buttonId}' not found.`);
    return;
  }

  btn.addEventListener('click', () => {
    const names = getTrashFileNames();
    if (names.length === 0) return;

    const lines = [];
    lines.push('@echo off');
    lines.push('setlocal EnableDelayedExpansion');
    lines.push(`set COUNT=${names.length}`);
    lines.push('powershell -NoProfile -Command "Add-Type -AssemblyName Microsoft.VisualBasic; $res=[Microsoft.VisualBasic.Interaction]::MsgBox((\\"This will delete !COUNT! wav file(s).\\"),\\"OkCancel,Exclamation\\",\\"Confirm Delete\\"); if ($res -ne \\"Ok\\") { exit 0 }"');
    lines.push('set DELETED=0');
    lines.push('for %%F in (');
    names.forEach(name => {
      lines.push(`"${name}"`);
    });
    lines.push(') do (');
    lines.push('  if exist "%%F" (');
    lines.push('    del "%%F"');
    lines.push('    if not errorlevel 1 set /a DELETED+=1');
    lines.push('  )');
    lines.push(')');
    lines.push('powershell -NoProfile -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::MsgBox((\\"Deleted !DELETED! wav file(s).\\"),\\"OKOnly,Information\\",\\"Delete Done\\")"');
    lines.push('endlocal');

    const blob = new Blob([lines.join('\r\n')], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'delete_trash_files.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
