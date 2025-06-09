// modules/sidebar.js

import { getFileList, getCurrentIndex, getFileIconState } from './fileState.js';

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
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';     
  
      const nameWithoutExt = file.name.replace(/\.wav$/i, '');

      const left = document.createElement('span');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.flexGrow = '1';
      left.style.minWidth = '0';
      
      const icon = document.createElement('i');
      icon.className = 'fa-regular fa-file-audio';
      icon.style.marginRight = '6px';
      left.appendChild(icon);
  
      const textSpan = document.createElement('span');
      textSpan.className = 'fileNameText';
      textSpan.textContent = nameWithoutExt;
      left.appendChild(textSpan);
      
      li.appendChild(left);

      const flags = document.createElement('span');
      const state = getFileIconState(index);
      if (state.trash) {
        const d = document.createElement('i');
        d.className = 'fa-solid fa-trash';
        d.style.color = 'gray';
        d.style.marginleft = '4px';
        flags.appendChild(d);
      }
      if (state.star) {
        const s = document.createElement('i');
        s.className = 'fa-solid fa-star';
        s.style.color = '#FFD700';
        s.style.marginLeft = '4px';
        flags.appendChild(s);
      }
      if (state.question) {
        const q = document.createElement('i');
        q.className = 'fa-solid fa-question';
        q.style.color = 'red';
        q.style.marginLeft = '4px';
        flags.appendChild(q);
      }
      li.appendChild(flags);
  
      li.addEventListener('click', () => {
        if (typeof onFileSelected === 'function') {
          onFileSelected(index);
        }
      });
  
      if (index === currentIndex) {
        li.style.fontWeight = 'bold';
        li.style.color = '#007bff';
        activeItem = li;
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
