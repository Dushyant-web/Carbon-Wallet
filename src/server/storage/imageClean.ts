/**
 * Photo checks for uploads people take on their phones (removal requests): only real JPEG / PNG files,
 * and metadata stripped before they are stored, so no GPS position, camera serial or timestamp leaves the phone
 * through us. The browser already re-encodes photos to JPEG; this is the server's own guarantee.
 */
export type CleanImage = { mime: "image/jpeg" | "image/png"; data: Buffer };

export function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

/** Drops APP1–APP15 (EXIF, XMP, IPTC…) and comments; keeps APP0 (JFIF) and the image data. */
export function stripJpeg(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) throw new Error("Not a valid JPEG");
    const marker = buf[i + 1];
    if (marker === 0xda) {
      out.push(buf.subarray(i)); // start of scan: the rest is image data
      return Buffer.concat(out);
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) throw new Error("Not a valid JPEG");
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  throw new Error("Not a valid JPEG");
}

/** Drops text and EXIF chunks (tEXt, iTXt, zTXt, eXIf, tIME). */
export function stripPng(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString("latin1");
    const end = i + 12 + len;
    if (end > buf.length) throw new Error("Not a valid PNG");
    if (!["tEXt", "iTXt", "zTXt", "eXIf", "tIME"].includes(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === "IEND") return Buffer.concat(out);
  }
  throw new Error("Not a valid PNG");
}

export function cleanImage(buf: Buffer): CleanImage | null {
  const mime = sniffImage(buf);
  if (!mime) return null;
  try {
    return { mime, data: mime === "image/jpeg" ? stripJpeg(buf) : stripPng(buf) };
  } catch {
    return null;
  }
}
