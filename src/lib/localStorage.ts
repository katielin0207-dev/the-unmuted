const SOS_HISTORY_KEY = "herguard_sos_history";
const VAULT_RECORDS_KEY = "herguard_vault_records";

export interface VaultRecord {
  id: string;
  mimeType: string;
  originalSize: number;
  originalHash: string;
  encryptedHash: string;
  arweaveTxId: string;
  arweaveUrl: string;
  chainTxHash: string;
  chainExplorerUrl: string;
  blockTimestamp: number;
  isSimulated: boolean;
  createdAt: number; // Date.now()
  status: "anchored" | "local_only";
}

export function loadVaultRecords(): VaultRecord[] {
  try {
    const raw = localStorage.getItem(VAULT_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addVaultRecord(record: VaultRecord) {
  const records = loadVaultRecords();
  records.unshift(record);
  localStorage.setItem(VAULT_RECORDS_KEY, JSON.stringify(records.slice(0, 200)));
}

export interface SOSHistoryRecord {
  latitude: number;
  longitude: number;
  timestamp: number;
  txHash?: string;
  status: "success" | "offline" | "pending";
}

export function loadSOSHistory(): SOSHistoryRecord[] {
  try {
    const raw = localStorage.getItem(SOS_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSOSHistory(record: SOSHistoryRecord) {
  const history = loadSOSHistory();
  history.unshift(record);
  localStorage.setItem(SOS_HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
}
