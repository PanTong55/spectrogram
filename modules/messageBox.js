// modules/messageBox.js

export function showMessageBox({
  message = '',
  title = '',
  confirmText = 'OK',
  cancelText = null,
  onConfirm,
  onCancel,
  width = 420
} = {}) {
  const popup = document.createElement('div');
  popup.className = 'map-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.width = `${width}px`;
  popup.style.height = 'auto';
  popup.style.display = 'block';

  const dragBar = document.createElement('div');
  dragBar.className = 'popup-drag-bar';
  if (title) {
    const titleSpan = document.createElement('span');
    titleSpan.className = 'popup-title';
    titleSpan.textContent = title;
    dragBar.appendChild(titleSpan);
  }
  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close-btn';
  closeBtn.title = 'Close';
  closeBtn.innerHTML = '&times;';
  dragBar.appendChild(closeBtn);
  popup.appendChild(dragBar);

  const content = document.createElement('div');
  content.style.padding = '10px';
  content.style.whiteSpace = 'pre-line';
  content.style['font-size'] = '14px';
  content.textContent = message;
  popup.appendChild(content);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'center';
  actions.style.gap = '30px';
  actions.style.marginBottom = '10px';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'flat-icon-button';
  confirmBtn.textContent = confirmText;
  actions.appendChild(confirmBtn);

  let cancelBtn = null;
  if (cancelText) {
    cancelBtn = document.createElement('button');
    cancelBtn.className = 'flat-icon-button';
    cancelBtn.textContent = cancelText;
    actions.appendChild(cancelBtn);
  }
  popup.appendChild(actions);

  function close(result) {
    popup.remove();
    if (result === 'confirm' && typeof onConfirm === 'function') {
      onConfirm();
    } else if (result === 'cancel' && typeof onCancel === 'function') {
      onCancel();
    }
  }

  confirmBtn.addEventListener('click', () => close('confirm'));
  cancelBtn?.addEventListener('click', () => close('cancel'));
  closeBtn.addEventListener('click', () => close('close'));

  document.body.appendChild(popup);
}
