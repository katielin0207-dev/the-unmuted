// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * EvidenceAnchor — 零知识匿名存证合约 (Hera's Shield)
 *
 * 链上存储：加密文件的 SHA-256 哈希 + Arweave 永久存储的 TX ID + 不可篡改时间戳
 * 设计原则：合约本身不存储任何可识别信息，调用者可使用匿名钱包。
 */
contract EvidenceAnchor {

    struct AnchorRecord {
        bytes32 fileHash;     // SHA-256 of encrypted file
        string  arweaveTxId;  // Arweave permanent storage TX
        uint256 timestamp;    // block.timestamp (immutable proof of time)
    }

    uint256 private _total;

    // fileHash → block.timestamp when first anchored (dedup protection)
    mapping(bytes32 => uint256) public firstAnchoredAt;

    // recordId → record
    mapping(uint256 => AnchorRecord) private _records;

    event EvidenceAnchored(
        uint256 indexed recordId,
        bytes32 indexed fileHash,
        string  arweaveTxId,
        uint256 timestamp
    );

    /**
     * @notice Anchor an encrypted-file hash with its Arweave storage TX.
     * @param fileHash     SHA-256 of the AES-256-GCM encrypted file (bytes32)
     * @param arweaveTxId  Arweave transaction ID of the encrypted upload
     * @return recordId    Sequential ID for this anchor record
     */
    function anchor(
        bytes32 fileHash,
        string calldata arweaveTxId
    ) external returns (uint256 recordId) {
        recordId = _total++;

        _records[recordId] = AnchorRecord({
            fileHash:    fileHash,
            arweaveTxId: arweaveTxId,
            timestamp:   block.timestamp
        });

        // Record first-seen timestamp for this hash (idempotent)
        if (firstAnchoredAt[fileHash] == 0) {
            firstAnchoredAt[fileHash] = block.timestamp;
        }

        emit EvidenceAnchored(recordId, fileHash, arweaveTxId, block.timestamp);
    }

    /** @notice Returns the block.timestamp when a hash was first anchored (0 = not found). */
    function verifyHash(bytes32 fileHash) external view returns (uint256) {
        return firstAnchoredAt[fileHash];
    }

    /** @notice Fetch a stored anchor record by ID. */
    function getRecord(uint256 recordId) external view returns (
        bytes32 fileHash,
        string memory arweaveTxId,
        uint256 timestamp
    ) {
        AnchorRecord storage r = _records[recordId];
        return (r.fileHash, r.arweaveTxId, r.timestamp);
    }

    function totalAnchored() external view returns (uint256) {
        return _total;
    }
}
