// modules/sidebar.js

import { getFileList, getCurrentIndex } from './fileState.js';

export function initSidebar({ onFileSelected } = {}) {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const sidebarIcon = document.getElementById('sidebarIcon');
  const fileListUl = document.getElementById('fileList');
  const searchInput = document.getElementById('searchInput');
  const filePathSpan = document.getElementById('currentFilePath');
  const fileCount = document.getElementById('fileCount');

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
    if (fileCount) {
      const countText = `(Total: ${list.length.toLocaleString()} files)`;
      fileCount.textContent = countText;
    }    
    let activeItem = null;
  
    fileListUl.innerHTML = '';
  
    list.forEach((file, index) => {
      if (filter && !file.name.toLowerCase().includes(filter)) return;
  
      const li = document.createElement('li');
      li.style.padding = '3px 0';
      li.style.cursor = 'pointer';
  
      const nameWithoutExt = file.name.replace(/\.wav$/i, '');
  
      const icon = document.createElement('i');
      icon.className = 'fa-regular fa-file-audio';
      icon.style.marginRight = '6px';
  
      const text = document.createTextNode(nameWithoutExt);
  
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
        activeItem = li;  // <-- 把需要 scroll 的 item 記錄下來
      }
  
      fileListUl.appendChild(li);
    });
  
    // 等待瀏覽器渲染完成後執行 scroll
    if (activeItem) {
      requestAnimationFrame(() => {
        activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
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
