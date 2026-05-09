/**
 * Solana on-chain timestamp anchoring via the Memo Program.
 *
 * Strategy: write a compact JSON memo containing the encrypted-file SHA-256
 * and Arweave TX ID as a Solana transaction. The block timestamp becomes the
 * immutable proof-of-time. No custom program deployment needed — the Memo
 * Program is a permanent, audited Solana native program.
 *
 * Memo Program ID (v1): MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
 * Network: Solana Devnet (switch RPC to mainnet-beta for production)
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export const SOLANA_NETWORK = "devnet";
export const SOLANA_RPC = clusterApiUrl(SOLANA_NETWORK);
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export interface AnchorResult {
  txHash: string;
  blockTimestamp: number;
  explorerUrl: string;
  isSimulated: boolean;
  network: string;
}

/** Phantom / any window.solana wallet interface */
interface SolanaWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  isConnected: boolean;
}

function getSolanaWallet(): SolanaWallet | null {
  const sol = (window as any).solana;
  if (sol?.isConnected && sol?.publicKey) return sol as SolanaWallet;
  return null;
}

/**
 * Anchor an encrypted-file hash on Solana via a Memo transaction.
 *
 * Memo payload (kept compact to minimise fees):
 *   {"h":"<first 32 hex chars of encryptedHash>","a":"<arweaveTxId>"}
 *
 * @param encryptedHash  64-char hex SHA-256 of the encrypted file
 * @param arweaveTxId    43-char Arweave TX ID
 */
export async function anchorOnChain(
  encryptedHash: string,
  arweaveTxId: string
): Promise<AnchorResult> {
  const wallet = getSolanaWallet();

  if (wallet) {
    try {
      return await anchorWithPhantom(wallet, encryptedHash, arweaveTxId);
    } catch (err) {
      console.warn("Solana anchor failed, falling back to simulation:", err);
    }
  }

  return simulateAnchor(encryptedHash);
}

async function anchorWithPhantom(
  wallet: SolanaWallet,
  encryptedHash: string,
  arweaveTxId: string
): Promise<AnchorResult> {
  const connection = new Connection(SOLANA_RPC, "confirmed");

  // Auto-airdrop on devnet if balance is zero (gasless UX for victims)
  try {
    const balance = await connection.getBalance(wallet.publicKey);
    if (balance < 5000) {
      // < ~0.000005 SOL — not enough for a tx
      await connection.requestAirdrop(wallet.publicKey, 0.01 * LAMPORTS_PER_SOL);
      // Wait one slot for the airdrop to land
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch {
    // Airdrop may fail on mainnet — ignore
  }

  const memo = JSON.stringify({
    h: encryptedHash.slice(0, 32), // first 128 bits of SHA-256
    a: arweaveTxId,
    t: "hera", // product tag
  });

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: wallet.publicKey,
  }).add(instruction);

  const signed = await wallet.signTransaction(tx);
  const txSig = await connection.sendRawTransaction(signed.serialize());

  await connection.confirmTransaction(
    { signature: txSig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  const txInfo = await connection.getTransaction(txSig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  const blockTimestamp =
    txInfo?.blockTime ?? Math.floor(Date.now() / 1000);

  return {
    txHash: txSig,
    blockTimestamp,
    explorerUrl: `https://solscan.io/tx/${txSig}?cluster=${SOLANA_NETWORK}`,
    isSimulated: false,
    network: SOLANA_NETWORK,
  };
}

function simulateAnchor(encryptedHash: string): AnchorResult {
  // Deterministic-looking base58 TX signature from the hash
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let sig = "";
  for (let i = 0; i < 88; i++) {
    const code = parseInt(encryptedHash[(i * 2) % 64] + encryptedHash[(i * 2 + 1) % 64], 16);
    sig += chars[code % chars.length];
  }

  return {
    txHash: sig,
    blockTimestamp: Math.floor(Date.now() / 1000),
    explorerUrl: `https://solscan.io/tx/${sig}?cluster=${SOLANA_NETWORK}`,
    isSimulated: true,
    network: SOLANA_NETWORK,
  };
}
