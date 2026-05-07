const CHUNK_SIZE = 30 * 1024;

self.onmessage = async e => {

  const data = e.data;

  try {

    if (data.action === 'encodeExact') {

      const result = await encodeExact(data.buffer, data.meta);

      self.postMessage({
        type: 'encodeDone',
        result
      });

      return;
    }

    if (data.action === 'encodeOptimized') {

      const result = await encodeOptimized(data.dataUrl, data.meta);

      self.postMessage({
        type: 'encodeDone',
        result
      });

      return;
    }

    if (data.action === 'decode') {

      const result = await decode(data.text);

      self.postMessage({
        type: 'decodeDone',
        blob: result.bytes.buffer,
        mimeType: result.mimeType,
        mode: result.mode
      }, [result.bytes.buffer]);

      return;
    }

  } catch (err) {

    self.postMessage({
      type: 'error',
      message: err.message
    });
  }
};

async function encodeExact(buffer, meta) {

  const bytes = new Uint8Array(buffer);

  const total = bytes.length;

  let binary = '';

  const BATCH = 8192;

  for (let i = 0; i < total; i += BATCH) {

    const slice = bytes.subarray(i, i + BATCH);

    binary += String.fromCharCode.apply(null, slice);

    progress('encode-progress', Math.round((i / total) * 50));

    await tick();
  }

  const encoded = btoa(binary);

  progress('encode-progress', 55);

  return buildChunks(encoded, 'exact', meta);
}

async function encodeOptimized(dataUrl, meta) {

  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

  progress('encode-progress', 55);

  return buildChunks(b64, 'optimized', meta);
}

async function buildChunks(b64, mode, meta) {

  const totalChunks = Math.ceil(b64.length / CHUNK_SIZE);

  const header =
    'PIXLPASS|v1|mode=' + mode +
    '|type=' + meta.type +
    '|name=' + meta.name +
    '|total=' + totalChunks + '\n';

  const parts = [];

  for (let i = 0; i < totalChunks; i++) {

    parts.push(
      '---PART ' + (i + 1) + '/' + totalChunks + '---\n' +
      b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    );

    progress(
      'encode-progress',
      55 + Math.round(((i + 1) / totalChunks) * 40)
    );

    await tick();
  }

  return header + parts.join('\n\n');
}

async function decode(text) {

  const firstLine = text.trim().split('\n')[0];

  if (!firstLine.startsWith('PIXLPASS|v1|')) {
    throw new Error('Invalid format: missing PIXLPASS header.');
  }

  const fields = {};

  firstLine.split('|').forEach(f => {

    const eq = f.indexOf('=');

    if (eq !== -1) {
      fields[f.slice(0, eq)] = f.slice(eq + 1);
    }
  });

  const totalChunks = parseInt(fields.total, 10);

  const mimeType = fields.type || 'image/jpeg';

  const mode = fields.mode || 'exact';

  if (!totalChunks || isNaN(totalChunks)) {
    throw new Error('Invalid header: missing total chunks.');
  }

  progress('decode-progress', 10);

  const partRegex =
    /---PART (\d+)\/(\d+)---\n([\s\S]*?)(?=\n\n---PART |\s*$)/g;

  const partsMap = new Map();

  let match;

  while ((match = partRegex.exec(text)) !== null) {

    const idx = parseInt(match[1], 10);

    const data = match[3].replace(/[\r\n\s]/g, '');

    if (partsMap.has(idx)) {
      throw new Error('Duplicate chunk: part ' + idx + '.');
    }

    partsMap.set(idx, data);

    await tick();
  }

  progress('decode-progress', 30);

  const missing = [];

  for (let i = 1; i <= totalChunks; i++) {

    if (!partsMap.has(i)) {
      missing.push(i);
    }
  }

  if (missing.length > 0) {

    throw new Error(
      'Missing chunks: ' +
      missing.join(', ') +
      '. Need all ' +
      totalChunks +
      ' parts.'
    );
  }

  let fullB64 = '';

  for (let i = 1; i <= totalChunks; i++) {

    fullB64 += partsMap.get(i);

    progress(
      'decode-progress',
      30 + Math.round((i / totalChunks) * 40)
    );

    await tick();
  }

  progress('decode-progress', 75);

  if (!/^[A-Za-z0-9+/]+=*$/.test(fullB64)) {
    throw new Error('Corrupted data: invalid Base64 characters.');
  }

  const binary = atob(fullB64);

  const len = binary.length;

  const bytes = new Uint8Array(len);

  const BATCH = 8192;

  for (let i = 0; i < len; i += BATCH) {

    const end = Math.min(i + BATCH, len);

    for (let j = i; j < end; j++) {
      bytes[j] = binary.charCodeAt(j);
    }

    progress(
      'decode-progress',
      Math.min(
        75 + Math.round(((i + BATCH) / len) * 20),
        95
      )
    );

    await tick();
  }

  progress('decode-progress', 100);

  return {
    bytes,
    mimeType,
    mode
  };
}

function progress(id, value) {

  self.postMessage({
    type: 'progress',
    id,
    value
  });
}

function tick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}