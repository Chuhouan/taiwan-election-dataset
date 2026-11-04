const encoder = new TextEncoder();
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
// Uncompressed ZIP: deterministic bytes, UTF-8 filenames, no browser dependency.
export function zipFiles(files) {
  const local = [], central = []; let offset = 0, directorySize = 0;
  const header = (size) => { const bytes = new Uint8Array(size); return [bytes, new DataView(bytes.buffer)]; };
  for (const file of files) {
    const name = encoder.encode(file.name), data = typeof file.data === "string" ? encoder.encode(file.data) : file.data, crc = crc32(data),
      [lh, l] = header(30), [ch, c] = header(46);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true);
    l.setUint16(12, 0x21, true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    local.push(lh, name, data); central.push(ch, name); offset += lh.length + name.length + data.length; directorySize += ch.length + name.length;
  }
  const [end, e] = header(22); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  const bytes = new Uint8Array(offset + directorySize + 22); let cursor = 0;
  for (const part of [...local, ...central, end]) { bytes.set(part, cursor); cursor += part.length; }
  return bytes;
}
