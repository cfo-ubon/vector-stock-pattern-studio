// Minimal ZIP writer (STORE method — files are kept byte-for-byte, no
// recompression, so vector exports land on disk exactly as generated).
// Implemented by hand to keep the app dependency-free; covers exactly what
// the download bundle needs: a flat list of UTF-8-named files.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function buildZip(files: ZipEntry[]): Blob {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const now = dosDateTime(new Date());
  const enc = new TextEncoder();

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true); // version needed to extract
    local.setUint16(6, 0x0800, true); // general purpose flag: UTF-8 names
    local.setUint16(8, 0, true); // method: STORE
    local.setUint16(10, now.time, true);
    local.setUint16(12, now.date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true); // compressed size (= raw for STORE)
    local.setUint32(22, f.data.length, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra field length
    chunks.push(new Uint8Array(local.buffer), nameBytes, f.data);

    const cdir = new DataView(new ArrayBuffer(46));
    cdir.setUint32(0, 0x02014b50, true); // central directory signature
    cdir.setUint16(4, 20, true); // version made by
    cdir.setUint16(6, 20, true); // version needed
    cdir.setUint16(8, 0x0800, true);
    cdir.setUint16(10, 0, true);
    cdir.setUint16(12, now.time, true);
    cdir.setUint16(14, now.date, true);
    cdir.setUint32(16, crc, true);
    cdir.setUint32(20, f.data.length, true);
    cdir.setUint32(24, f.data.length, true);
    cdir.setUint16(28, nameBytes.length, true);
    cdir.setUint32(42, offset, true); // offset of local header
    central.push(new Uint8Array(cdir.buffer), nameBytes);

    offset += 30 + nameBytes.length + f.data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); // end of central directory signature
  eocd.setUint16(8, files.length, true); // entries on this disk
  eocd.setUint16(10, files.length, true); // total entries
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true); // central directory offset
  chunks.push(...central, new Uint8Array(eocd.buffer));

  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}
