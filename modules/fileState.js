// modules/fileState.js

let fileList = [];
let currentIndex = -1;
let fileIcons = {}; // { index: { trash: bool, star: bool, question: bool } }
let fileNotes = {}; // { index: string }

export function setFileList(list, index = 0) {
  fileList = list;
  currentIndex = index;
  fileIcons = {};
  fileNotes = {};
}

export function addFilesToList(list, index = 0) {
  if (!Array.isArray(list) || list.length === 0) return;
  const startIndex = fileList.length;
  fileList = fileList.concat(list);
  currentIndex = startIndex + index;
}

export function getFileList() {
  return fileList;
}

export function getCurrentIndex() {
  return currentIndex;
}

export function setCurrentIndex(index) {
  if (index >= 0 && index < fileList.length) {
    currentIndex = index;
  }
}

export function getCurrentFile() {
  if (currentIndex >= 0 && currentIndex < fileList.length) {
    return fileList[currentIndex];
  }
  return null;
}

export function toggleFileIcon(index, type) {
  if (!fileIcons[index]) {
    fileIcons[index] = { trash: false, star: false, question: false };
  }
  if (type in fileIcons[index]) {
    fileIcons[index][type] = !fileIcons[index][type];
  }
}

export function getFileIconState(index) {
  return fileIcons[index] || { trash: false, star: false, question: false };
}

export function clearFileList() {
  fileList = [];
  currentIndex = -1;
  fileIcons = {};
  fileNotes = {};
}

export function setFileNote(index, note) {
  fileNotes[index] = note;
}

export function getFileNote(index) {
  return fileNotes[index] || '';
}

// Remove files that match the given name from the current list. This also resets
// any stored icon or note state. The currentIndex will be set to -1 so that the
// caller can decide which file to load next.
export function removeFilesByName(name) {
  const filtered = fileList.filter(f => f.name !== name);
  if (filtered.length !== fileList.length) {
    fileList = filtered;
    currentIndex = -1;
    fileIcons = {};
    fileNotes = {};
  }
}
