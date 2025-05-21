export function setupFileLoader(fileInput, ws, specPluginRef, updateCallback) {
  let lastObjectUrl = null;

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    if (specPluginRef.current?.destroy) {
      specPluginRef.current.destroy();
    }
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = fileUrl;

    await ws.load(fileUrl);
    updateCallback(fileUrl);
  });
}
