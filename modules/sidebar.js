// modules/sidebar.js

import { getFileList, getCurrentIndex } from './fileState.js';

export function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const sidebarIcon = document.getElementById('sidebarIcon');
  const fileListUl = document.getElementById('fileList');
  const searchInput = document.getElementById('searchInput');
  const filePathSpan = document.getElementById('currentFilePath');

  toggleBtn.addEventListener('click', () => {
    const isVisible = sidebar.style.display === 'block';
    sidebar.style.display = isVisible ? 'none' : 'block';
    toggleBtn.title = isVisible ? 'Open File List' : 'Collapse File List';
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
      li.textContent = file.name;
      li.style.padding = '3px 0';
      li.style.cursor = 'default';
      if (index === currentIndex) {
        li.style.fontWeight = 'bold';
        li.style.color = '#007bff';
      }
      fileListUl.appendChild(li);
    });
  }

  function updateCurrentPath(filePath) {
    filePathSpan.textContent = filePath || '(no file loaded)';
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
