/**
 * Peak Control Module
 * 管理 Peak Mode 的切換和 Spectrogram 重新渲染
 */

let peakModeActive = false;

/**
 * 初始化 Peak Control
 * @param {Object} options - 配置選項
 * @param {string} options.peakBtnId - Peak Button 的 ID
 * @param {Function} options.onPeakModeToggled - Peak mode 切換時的回調函數 (newState)
 */
export function initPeakControl(options = {}) {
  const {
    peakBtnId = 'peakBtn',
    onPeakModeToggled = () => {}
  } = options;

  const peakBtn = document.getElementById(peakBtnId);
  if (!peakBtn) {
    console.warn(`[peakControl] Button with ID "${peakBtnId}" not found`);
    return { toggle: () => {}, isActive: () => peakModeActive };
  }

  peakBtn.addEventListener('click', () => {
    togglePeakMode();
    onPeakModeToggled(peakModeActive);
  });

  return {
    toggle: togglePeakMode,
    isActive: () => peakModeActive,
    getState: () => ({ peakModeActive })
  };
}

/**
 * 切換 Peak Mode 狀態
 */
function togglePeakMode() {
  peakModeActive = !peakModeActive;
  updatePeakButtonUI();
}

/**
 * 更新 Peak Button 的 UI 狀態
 */
function updatePeakButtonUI() {
  const peakBtn = document.getElementById('peakBtn');
  if (!peakBtn) return;

  if (peakModeActive) {
    peakBtn.classList.add('active');
    peakBtn.title = 'Peak Tracking Mode (Active)';
  } else {
    peakBtn.classList.remove('active');
    peakBtn.title = 'Peak Tracking Mode';
  }
}

/**
 * 獲取 Peak Mode 的狀態
 */
export function isPeakModeActive() {
  return peakModeActive;
}

/**
 * 設置 Peak Mode 狀態
 */
export function setPeakModeActive(active) {
  peakModeActive = active;
  updatePeakButtonUI();
}
