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
    sidebarIcon.src = isVisible ? 'icons/sidebar_open.svg' : 'icons/sidebar_close.svg';
    toggleBtn.style.filter = isVisible ? 'none' : 'brightness(0) saturate(100%) invert(31%) sepia(99%) saturate(1607%) hue-rotate(199deg) brightness(92%) contrast(91%)';
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
