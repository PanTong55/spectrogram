export async function divideFrequencyByTen(file) {
  if (!file) return null;
  const arrayBuf = await file.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const inputBuffer = await ctx.decodeAudioData(arrayBuf);

  // Downsample to one-tenth the original sample rate
  const downCtx = new OfflineAudioContext(
    inputBuffer.numberOfChannels,
    inputBuffer.length,
    inputBuffer.sampleRate / 10
  );
  const downSrc = downCtx.createBufferSource();
  downSrc.buffer = inputBuffer;
  downSrc.connect(downCtx.destination);
  downSrc.start();
  const downBuffer = await downCtx.startRendering();

  // Upsample back to the original sample rate keeping the same duration
  const upCtx = new OfflineAudioContext(
    inputBuffer.numberOfChannels,
    inputBuffer.length,
    inputBuffer.sampleRate
  );
  const upSrc = upCtx.createBufferSource();
  upSrc.buffer = downBuffer;
  upSrc.playbackRate.value = 10;
  upSrc.connect(upCtx.destination);
  upSrc.start();
  const finalBuffer = await upCtx.startRendering();
  ctx.close();
  return bufferToWav(finalBuffer);
}

function bufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const blockAlign = numChannels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataLength = buffer.length * blockAlign;
  const totalLength = 44 + dataLength;
  const view = new DataView(new ArrayBuffer(totalLength));
  let offset = 0;

  function writeString(s) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset++, s.charCodeAt(i));
    }
  }

  writeString('RIFF');
  view.setUint32(offset, totalLength - 8, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataLength, true); offset += 4;

  const tmp = new Int16Array(dataLength / 2);
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      tmp[i * numChannels + ch] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
  }
  new Uint8Array(view.buffer, offset).set(new Uint8Array(tmp.buffer));
  return new Blob([view.buffer], { type: 'audio/wav' });
}
