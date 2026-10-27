import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { supabaseKeyHeaders } from "./supabaseAuth";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

/**
 * Encrypted-at-rest file storage for uploaded bills (AES-256-GCM, key from STORAGE_KEY).
 * Layout: [12-byte IV][16-byte auth tag][ciphertext]. Files are only ever streamed back through authorised
 * API routes. Where they live:
 *   - a local folder (STORAGE_DIR, default ./storage) for development and single servers;
 *   - a private Supabase Storage bucket when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (Netlify's
 *     functions have no lasting disk). Supabase only ever sees ciphertext; the key stays with this server.
 */

const ROOT = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"));
const SAFE_SEGMENT = /^[A-Za-z0-9_.-]{1,80}$/;

function key(): Buffer {
  const raw = process.env.STORAGE_KEY;
  if (!raw) throw new Error("STORAGE_KEY is not configured");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("STORAGE_KEY must be 32 bytes, base64-encoded");
  return buf;
}

function resolveSafe(segments: string[]): string {
  if (!segments.every((s) => SAFE_SEGMENT.test(s) && s !== "." && s !== "..")) {
    throw new Error("Unsafe storage path");
  }
  const full = path.resolve(ROOT, ...segments);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Unsafe storage path");
  return full;
}

export function encrypt(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decrypt(blob: Buffer): Buffer {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}

// --- Supabase Storage (REST), used when configured ---------------------------------------------------------
function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const bucket = process.env.SUPABASE_BUCKET || "private-files";
  const headers = supabaseKeyHeaders(key);
  const base = `${url.replace(/\/$/, "")}/storage/v1`;
  return {
    async put(objectPath: string, body: Buffer) {
      const res = await fetch(`${base}/object/${bucket}/${objectPath}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/octet-stream", "x-upsert": "true" },
        body: new Uint8Array(body),
      });
      if (!res.ok) throw new Error(`storage put failed (${res.status})`);
    },
    async get(objectPath: string) {
      const res = await fetch(`${base}/object/authenticated/${bucket}/${objectPath}`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`storage get failed (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    },
    async removePrefix(prefix: string) {
      // the folder itself, or a single file
      const list = await fetch(`${base}/object/list/${bucket}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000 }),
      });
      const names = list.ok ? ((await list.json()) as { name: string; id: string | null }[]) : [];
      const files: string[] = [];
      for (const n of names) {
        if (n.id) files.push(`${prefix}/${n.name}`);
        else files.push(...(await this.listDeep(`${prefix}/${n.name}`)));
      }
      const targets = files.length ? files : [prefix];
      await fetch(`${base}/object/${bucket}`, { method: "DELETE", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ prefixes: targets }) });
    },
    async listDeep(prefix: string): Promise<string[]> {
      const res = await fetch(`${base}/object/list/${bucket}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000 }),
      });
      const rows = res.ok ? ((await res.json()) as { name: string; id: string | null }[]) : [];
      const out: string[] = [];
      for (const r of rows) out.push(...(r.id ? [`${prefix}/${r.name}`] : await this.listDeep(`${prefix}/${r.name}`)));
      return out;
    },
  };
}

function objectPath(segments: string[]) {
  resolveSafe(segments); // same name rules as on disk
  return segments.join("/");
}

export async function putEncrypted(segments: string[], data: Buffer): Promise<string> {
  const remote = supabase();
  if (remote) {
    await remote.put(objectPath(segments), encrypt(data));
    return segments.join("/");
  }
  const full = resolveSafe(segments);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, encrypt(data), { mode: 0o600 });
  return segments.join("/");
}

export async function getEncrypted(segments: string[]): Promise<Buffer> {
  const remote = supabase();
  if (remote) return decrypt(await remote.get(objectPath(segments)));
  return decrypt(await readFile(resolveSafe(segments)));
}

export async function removeStored(segments: string[]): Promise<void> {
  const remote = supabase();
  if (remote) return remote.removePrefix(objectPath(segments));
  await rm(resolveSafe(segments), { recursive: true, force: true });
}
