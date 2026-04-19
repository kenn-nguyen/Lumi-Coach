import { describe, expect, it } from 'vitest';
import { createZipArchive } from './zip.js';

function readUint16(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

describe('createZipArchive', () => {
  it('builds a valid store zip with multiple files', () => {
    const archive = createZipArchive([
      { name: 'prompt1.txt', content: 'Prompt body' },
      { name: 'prompt1.output-contract.txt', content: 'Output contract body' },
    ]);

    expect(readUint32(archive, 0)).toBe(0x04034b50);

    const endOffset = archive.length - 22;
    expect(readUint32(archive, endOffset)).toBe(0x06054b50);
    expect(readUint16(archive, endOffset + 8)).toBe(2);
    expect(readUint16(archive, endOffset + 10)).toBe(2);

    const centralDirectoryOffset = readUint32(archive, endOffset + 16);
    expect(readUint32(archive, centralDirectoryOffset)).toBe(0x02014b50);

    const firstNameLength = readUint16(archive, centralDirectoryOffset + 28);
    const firstName = new TextDecoder().decode(
      archive.slice(centralDirectoryOffset + 46, centralDirectoryOffset + 46 + firstNameLength),
    );
    expect(firstName).toBe('prompt1.txt');
  });

  it('throws when no files are supplied', () => {
    expect(() => createZipArchive([])).toThrow('Zip archive requires at least one file.');
  });
});
