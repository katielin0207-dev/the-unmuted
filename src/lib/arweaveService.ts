/**
 * Arweave upload service.
 *
 * DEMO MODE (current): Simulates upload, stores encrypted file in IndexedDB,
 * returns a realistic 43-char Arweave TX ID.
 *
 * PRODUCTION: Replace uploadToArweave() body with Irys/Bundlr SDK:
 *   import Irys from "@irys/sdk";
 *   const irys = new Irys({ network: "mainnet", token: "matic", wallet: signer });
 *   const receipt = await irys.upload(buffer, { tags: [{ name: "Content-Type", value: "application/octet-stream" }] });
 *   return receipt.id;
 */

const DB_NAME = 'herguard_vault';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted_files';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'txId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeEncryptedFile(
  txId: string,
  encryptedBlob: Blob,
  meta: { originalHash: string; mimeType: string; timestamp: string }
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ txId, encryptedBlob, meta });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB failure is non-fatal — file still exists in memory
  }
}

/** Generate a cryptographically random 43-char base64url string (Arweave TX ID format) */
function generateArweaveTxId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const random = crypto.getRandomValues(new Uint8Array(43));
  return Array.from(random).map(b => chars[b % chars.length]).join('');
}

export interface ArweaveUploadResult {
  txId: string;
  arweaveUrl: string;
  isDemoMode: boolean;
}

/**
 * Upload an encrypted Blob to Arweave (demo mode: simulates the upload).
 * @param encryptedBlob  AES-256-GCM encrypted file data
 * @param originalHash   SHA-256 of the original (for metadata tagging)
 * @param mimeType       Original file MIME type
 */
export async function uploadToArweave(
  encryptedBlob: Blob,
  originalHash: string,
  mimeType: string
): Promise<ArweaveUploadResult> {
  // Simulate network latency (production upload takes 2-5s)
  await new Promise(r => setTimeout(r, 1800));

  const txId = generateArweaveTxId();
  const timestamp = new Date().toISOString();

  await storeEncryptedFile(txId, encryptedBlob, { originalHash, mimeType, timestamp });

  return {
    txId,
    arweaveUrl: `https://arweave.net/${txId}`,
    isDemoMode: true,
  };
}

/** Retrieve stored encrypted file from IndexedDB (for verification) */
export async function retrieveEncryptedFile(txId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const result = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(txId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return result?.encryptedBlob ?? null;
  } catch {
    return null;
  }
}
