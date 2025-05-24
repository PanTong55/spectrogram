// modules/scrollSync.js

export function initScrollSync({ scrollSourceId, scrollTargetId }) {
  const source = document.getElementById(scrollSourceId);
  const target = document.getElementById(scrollTargetId);

  if (!source || !target) {
    console.warn(`[scrollSync] One or both elements not found.`);
    return;
  }

  let isSyncingSource = false;
  let isSyncingTarget = false;

  source.addEventListener('scroll', () => {
    if (isSyncingTarget) return;
    isSyncingSource = true;
    target.scrollLeft = source.scrollLeft;
    isSyncingSource = false;
  });

  target.addEventListener('scroll', () => {
    if (isSyncingSource) return;
    isSyncingTarget = true;
    source.scrollLeft = target.scrollLeft;
    isSyncingTarget = false;
  });
}
