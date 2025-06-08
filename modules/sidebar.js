// modules/sidebar.js

import { getFileList, getCurrentIndex } from './fileState.js';

export function initSidebar({ onFileSelected } = {}) {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const sidebarIcon = document.getElementById('sidebarIcon');
  const fileListUl = document.getElementById('fileList');
  const searchInput = document.getElementById('searchInput');
  const filePathSpan = document.getElementById('currentFilePath');

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    toggleBtn.title = isCollapsed ? 'Open File List' : 'Collapse File List';
  });

  searchInput.addEventListener('input', () => {
    renderFileList(searchInput.value.trim().toLowerCase());
  });

  function renderFileList(filter = '') {
    const list = getFileList();
    const currentIndex = getCurrentIndex();
  
    fileListUl.innerHTML = '';
  
    list.forEach((file, index) => {
      if (filter && !file.name.toLowerCase().includes(filter)) return;
  
      const li = document.createElement('li');
      li.style.padding = '3px 0';
      li.style.cursor = 'pointer';
  
      // 先處理副檔名
      const nameWithoutExt = file.name.replace(/\.wav$/i, '');
  
      // 建立 icon
      const icon = document.createElement('i');
      icon.className = 'fa-regular fa-file-audio';
      icon.style.marginRight = '6px';
  
      // 建立文字節點
      const text = document.createTextNode(nameWithoutExt);
  
      // 插入 icon 和文字
      li.appendChild(icon);
      li.appendChild(text);
  
      li.addEventListener('click', () => {
        if (typeof onFileSelected === 'function') {
          onFileSelected(index);
        }
      });
  
      if (index === currentIndex) {
        li.style.fontWeight = 'bold';
        li.style.color = '#007bff';
      }
  
      fileListUl.appendChild(li);
    });
  }

  function updateCurrentPath(filePath) {
    const fileNameText = document.getElementById('fileNameText');
    fileNameText.textContent = filePath ? filePath : 'Upload wav file(s)';
  }
  
  return {
    refresh: (filePath, resetSearch = true) => {
      updateCurrentPath(filePath);
      if (resetSearch) {
        searchInput.value = '';
      }
      renderFileList(searchInput.value.trim().toLowerCase());
    }
  };
}
