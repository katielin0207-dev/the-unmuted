/**
 * AES-256-GCM encryption utilities using the browser Web Crypto API.
 * All operations are performed locally — no data leaves the device before encryption.
 */

export interface EncryptionResult {
  encryptedBlob: Blob;
  ivHex: string;
  exportedKey: JsonWebKey;
  originalHash: string;   // SHA-256 of the original plaintext file
  encryptedHash: string;  // SHA-256 of the encrypted blob → this goes on-chain
  mimeType: string;
  originalSize: number;
}

export interface KeyBundle {
  key: JsonWebKey;
  iv: string;
  originalHash: string;
  encryptedHash: string;
  mimeType: string;
  originalSize: number;
  createdAt: string;
  note: string;
}

function toHex(buf: ArrayBuffer | ArrayBufferLike): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert a 64-char hex string to a bytes32-compatible 0x-prefixed string */
export function hashToBytes32(hexHash: string): string {
  return '0x' + hexHash.slice(0, 64).padStart(64, '0');
}

/**
 * Encrypt a file Blob using AES-256-GCM.
 * Returns encrypted data, the IV, the exportable key, and SHA-256 hashes.
 */
export async function encryptFile(
  file: Blob,
  mimeType: string
): Promise<EncryptionResult> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const [originalHashBuf, encryptedBuffer] = await Promise.all([
    crypto.subtle.digest('SHA-256', fileBuffer),
    crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileBuffer),
  ]);

  const encryptedHashBuf = await crypto.subtle.digest('SHA-256', encryptedBuffer);

  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    ivHex: toHex(iv.buffer),
    exportedKey: await crypto.subtle.exportKey('jwk', key),
    originalHash: toHex(originalHashBuf),
    encryptedHash: toHex(encryptedHashBuf),
    mimeType,
    originalSize: fileBuffer.byteLength,
  };
}

/** Build a downloadable JSON key bundle the user must keep safe */
export function buildKeyBundle(result: EncryptionResult): KeyBundle {
  return {
    key: result.exportedKey,
    iv: result.ivHex,
    originalHash: result.originalHash,
    encryptedHash: result.encryptedHash,
    mimeType: result.mimeType,
    originalSize: result.originalSize,
    createdAt: new Date().toISOString(),
    note: 'Save this file securely. It is required to decrypt your evidence. Never share it.',
  };
}

/** Trigger browser download of the key bundle as a JSON file */
export function downloadKeyBundle(bundle: KeyBundle, filename = 'evidence-key.json') {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
