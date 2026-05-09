import { useState, useRef, useCallback } from 'react';
import { encryptFile, buildKeyBundle, downloadKeyBundle, type EncryptionResult } from '@/lib/evidenceCrypto';
import { uploadToArweave, type ArweaveUploadResult } from '@/lib/arweaveService';
import { anchorOnChain, type AnchorResult } from '@/lib/evidenceContract';
import { addVaultRecord, loadVaultRecords, type VaultRecord } from '@/lib/localStorage';

export type VaultStep = 'idle' | 'encrypting' | 'uploading' | 'anchoring' | 'done' | 'error';

export interface VaultStepStatus {
  encrypting: 'pending' | 'running' | 'done' | 'error';
  uploading:  'pending' | 'running' | 'done' | 'error';
  anchoring:  'pending' | 'running' | 'done' | 'error';
}

export interface VaultResult {
  record: VaultRecord;
  encryptionResult: EncryptionResult;
}

export function useEvidenceVault() {
  const [step, setStep] = useState<VaultStep>('idle');
  const [steps, setSteps] = useState<VaultStepStatus>({
    encrypting: 'pending',
    uploading:  'pending',
    anchoring:  'pending',
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VaultResult | null>(null);
  const [history, setHistory] = useState<VaultRecord[]>(() => loadVaultRecords());
  const latestResult = useRef<EncryptionResult | null>(null);

  const setStepStatus = (
    key: keyof VaultStepStatus,
    status: VaultStepStatus[keyof VaultStepStatus]
  ) => setSteps(prev => ({ ...prev, [key]: status }));

  const processFile = useCallback(async (blob: Blob, mimeType: string) => {
    setStep('encrypting');
    setError(null);
    setResult(null);
    setSteps({ encrypting: 'running', uploading: 'pending', anchoring: 'pending' });

    let encResult: EncryptionResult;
    let arweaveResult: ArweaveUploadResult;
    let anchorResult: AnchorResult;

    // Step 1 — AES-256-GCM local encryption
    try {
      encResult = await encryptFile(blob, mimeType);
      latestResult.current = encResult;
      setStepStatus('encrypting', 'done');
    } catch (e) {
      setStepStatus('encrypting', 'error');
      setError('加密失败：' + (e instanceof Error ? e.message : String(e)));
      setStep('error');
      return;
    }

    // Step 2 — Upload encrypted file to Arweave
    setStep('uploading');
    setStepStatus('uploading', 'running');
    try {
      arweaveResult = await uploadToArweave(
        encResult.encryptedBlob,
        encResult.originalHash,
        mimeType
      );
      setStepStatus('uploading', 'done');
    } catch (e) {
      setStepStatus('uploading', 'error');
      setError('Arweave 上传失败：' + (e instanceof Error ? e.message : String(e)));
      setStep('error');
      return;
    }

    // Step 3 — Anchor hash on Solana via Memo Program
    setStep('anchoring');
    setStepStatus('anchoring', 'running');
    try {
      anchorResult = await anchorOnChain(encResult.encryptedHash, arweaveResult.txId);
      setStepStatus('anchoring', 'done');
    } catch (e) {
      setStepStatus('anchoring', 'error');
      setError('链上存证失败：' + (e instanceof Error ? e.message : String(e)));
      setStep('error');
      return;
    }

    const record: VaultRecord = {
      id: crypto.randomUUID(),
      mimeType,
      originalSize: encResult.originalSize,
      originalHash: encResult.originalHash,
      encryptedHash: encResult.encryptedHash,
      arweaveTxId: arweaveResult.txId,
      arweaveUrl: arweaveResult.arweaveUrl,
      chainTxHash: anchorResult.txHash,
      chainExplorerUrl: anchorResult.explorerUrl,
      blockTimestamp: anchorResult.blockTimestamp,
      isSimulated: anchorResult.isSimulated,
      createdAt: Date.now(),
      status: 'anchored',
    };

    addVaultRecord(record);
    setHistory(loadVaultRecords());
    setResult({ record, encryptionResult: encResult });
    setStep('done');
  }, []);

  const downloadKey = useCallback(() => {
    if (!latestResult.current || !result) return;
    const bundle = buildKeyBundle(latestResult.current);
    const ts = new Date(result.record.createdAt).toISOString().slice(0, 10);
    downloadKeyBundle(bundle, `hera-key-${ts}.json`);
  }, [result]);

  const reset = useCallback(() => {
    setStep('idle');
    setSteps({ encrypting: 'pending', uploading: 'pending', anchoring: 'pending' });
    setError(null);
    setResult(null);
    latestResult.current = null;
  }, []);

  return { step, steps, error, result, history, processFile, downloadKey, reset };
}
