/* PixelPass Worker — worker.js */
const CHUNK_SIZE = 30 * 1024;

async function encodeExact(buffer, meta) {
  const bytes = new Uint8Array(buffer);
  const total = bytes.length;
  let b64 = '';
  const BATCH = 8192;
  for (let i = 0; i < total; i += BATCH) {
    const slice = bytes.subarray(i, i + BATCH);
    b64 += String.fromCharCode.apply(null, slice);
    self.postMessage({ type: 'progress', pct: Math.round((i / total) * 50) });
    await tick();
  }
  const encoded = btoa(b64);
  self.postMessage({ type: 'progress', pct: 55 });
  return buildChunks(encoded, 'exact', meta);
}

async function encodeOptimized(dataUrl, meta) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  self.postMessage({ type: 'progress', pct: 55 });
  return buildChunks(b64, 'optimized', meta);
}

async function buildChunks(b64, mode, meta) {
  const totalChunks = Math.ceil(b64.length / CHUNK_SIZE);
  const header = 'PIXLPASS|v1|mode=' + mode + '|type=' + meta.type + '|name=' + meta.name + '|total=' + totalChunks + '\n';
  const parts = [];
  for (let i = 0; i < totalChunks; i++) {
    parts.push('---PART ' + (i + 1) + '/' + totalChunks + '---\n' + b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    self.postMessage({ type: 'progress', pct: 55 + Math.round(((i + 1) / totalChunks) * 40) });
    await tick();
  }
  return header + parts.join('\n\n');
}

async function decode(text) {
  const firstLine = text.trim().split('\n')[0];
  if (!firstLine.startsWith('PIXLPASS|v1|')) throw new Error('Invalid format: missing PIXLPASS header.');

  const fields = {};
  firstLine.split('|').forEach(function(f) {
    const eq = f.indexOf('=');
    if (eq !== -1) fields[f.slice(0, eq)] = f.slice(eq + 1);
  });

  const totalChunks = parseInt(fields.total, 10);
  const mimeType    = fields.type || 'image/jpeg';
  const mode        = fields.mode || 'exact';

  if (!totalChunks || isNaN(totalChunks)) throw new Error('Invalid header: missing total chunks.');
  self.postMessage({ type: 'progress', pct: 10 });

  const partRegex = /---PART (\d+)\/(\d+)---\n([\s\S]*?)(?=\n\n---PART |\s*$)/g;
  const partsMap  = new Map();
  let match;

  while ((match = partRegex.exec(text)) !== null) {
    const idx  = parseInt(match[1], 10);
    const data = match[3].replace(/[\r\n\s]/g, '');
    if (partsMap.has(idx)) throw new Error('Duplicate chunk: part ' + idx + '.');
    partsMap.set(idx, data);
    await tick();
  }

  self.postMessage({ type: 'progress', pct: 30 });

  const missing = [];
  for (let i = 1; i <= totalChunks; i++) {
    if (!partsMap.has(i)) missing.push(i);
  }
  if (missing.length > 0) throw new Error('Missing chunks: ' + missing.join(', ') + '. Need all ' + totalChunks + ' parts.');

  let fullB64 = '';
  for (let i = 1; i <= totalChunks; i++) {
    fullB64 += partsMap.get(i);
    self.postMessage({ type: 'progress', pct: 30 + Math.round((i / totalChunks) * 40) });
    await tick();
  }

  self.postMessage({ type: 'progress', pct: 75 });

  if (!/^[A-Za-z0-9+/]+=*$/.test(fullB64)) throw new Error('Corrupted data: invalid Base64 characters.');

  const binary = atob(fullB64);
  const len    = binary.length;
  const bytes  = new Uint8Array(len);
  const BATCH  = 8192;

  for (let i = 0; i < len; i += BATCH) {
    const end = Math.min(i + BATCH, len);
    for (let j = i; j < end; j++) bytes[j] = binary.charCodeAt(j);
    self.postMessage({ type: 'progress', pct: Math.min(75 + Math.round(((i + BATCH) / len) * 20), 95) });
    await tick();
  }

  const blob = new Blob([bytes], { type: mimeType });
  self.postMessage({ type: 'progress', pct: 100 });
  return { blob, mimeType, mode };
}

function tick() { return new Promise(function(r) { setTimeout(r, 0); }); }

self.onmessage = async function(e) {
  try {
    if (e.data.task === 'encode-exact') {
      self.postMessage({ type: 'encode-done', result: await encodeExact(e.data.buffer, e.data.meta) });
    } else if (e.data.task === 'encode-optimized') {
      self.postMessage({ type: 'encode-done', result: await encodeOptimized(e.data.dataUrl, e.data.meta) });
    } else if (e.data.task === 'decode') {
      const r = await decode(e.data.text);
      self.postMessage({ type: 'decode-done', blob: r.blob, mimeType: r.mimeType, mode: r.mode });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
