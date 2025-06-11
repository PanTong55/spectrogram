// modules/guanoReader.js

export async function extractGuanoMetadata(file) {
  if (!file) return { raw: '(no file selected)', parsed: {} };
  
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const textDecoder = new TextDecoder("utf-8");
  let pos = 12;
  let foundGuano = null;

  while (pos < view.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(pos),
      view.getUint8(pos + 1),
      view.getUint8(pos + 2),
      view.getUint8(pos + 3)
    );

    const chunkSize = view.getUint32(pos + 4, true);
    const chunkData = new Uint8Array(buffer, pos + 8, chunkSize);
    const chunkText = textDecoder.decode(chunkData);

    if (chunkText.includes("GUANO|Version:")) {
      foundGuano = chunkText;
      break;
    }

    pos += 8 + chunkSize;
    if (chunkSize % 2 === 1) pos += 1; // word alignment
  }

  const rawText = foundGuano || '(No GUANO metadata found in file)';
  const parsed = {};

  if (foundGuano) {
    const lines = foundGuano.split(/\r?\n/);
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key === 'Timestamp') {
        parsed.timestamp = val;
      } else if (key === 'Loc Position') {
        const [lat, lon] = val.split(/\s+/);
        parsed.lat = lat;
        parsed.lon = lon;
      }
    }
  }

  return { raw: rawText, parsed };
}
