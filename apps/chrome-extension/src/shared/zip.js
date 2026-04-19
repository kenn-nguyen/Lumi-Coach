const textEncoder = new TextEncoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function computeCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function normalizeFileEntry(file) {
  if (!file || typeof file.name !== 'string') {
    throw new Error('Zip entry must include a file name.');
  }

  const normalizedName = file.name.trim();
  if (!normalizedName) {
    throw new Error('Zip entry file name cannot be empty.');
  }

  const content =
    typeof file.content === 'string' ? file.content : String(file.content ?? '');

  const nameBytes = textEncoder.encode(normalizedName);
  const contentBytes = textEncoder.encode(content);

  return {
    name: normalizedName,
    nameBytes,
    contentBytes,
    crc32: computeCrc32(contentBytes),
  };
}

export function createZipArchive(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Zip archive requires at least one file.');
  }

  const entries = files.map(normalizeFileEntry);
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;

  for (const entry of entries) {
    const localHeader = new Uint8Array(30 + entry.nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, entry.crc32);
    writeUint32(localView, 18, entry.contentBytes.length);
    writeUint32(localView, 22, entry.contentBytes.length);
    writeUint16(localView, 26, entry.nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(entry.nameBytes, 30);

    localChunks.push(localHeader, entry.contentBytes);

    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, entry.crc32);
    writeUint32(centralView, 20, entry.contentBytes.length);
    writeUint32(centralView, 24, entry.contentBytes.length);
    writeUint16(centralView, 28, entry.nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralHeader.set(entry.nameBytes, 46);
    centralChunks.push(centralHeader);

    localOffset += localHeader.length + entry.contentBytes.length;
  }

  const centralDirectorySize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, entries.length);
  writeUint16(endView, 10, entries.length);
  writeUint32(endView, 12, centralDirectorySize);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);

  const totalSize =
    localChunks.reduce((sum, chunk) => sum + chunk.length, 0) +
    centralDirectorySize +
    endRecord.length;
  const archive = new Uint8Array(totalSize);

  let writeOffset = 0;
  for (const chunk of [...localChunks, ...centralChunks, endRecord]) {
    archive.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return archive;
}
