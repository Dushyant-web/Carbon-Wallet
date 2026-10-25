// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @notice Anchors Merkle roots of salted monthly carbon statements, plus hashes of the
/// emission-factor sets they were computed with. No personal data is ever stored on-chain.
/// See Docs/blockchain.md. Compiled by scripts/compile-contract.mjs into contracts/build/CarbonAnchor.json.
contract CarbonAnchor is Ownable {
    struct Batch {
        bytes32 root;
        bytes32 factorSetHash;
        uint64 anchoredAt;
        string period;
    }

    Batch[] public batches;
    mapping(bytes32 => string) public factorSetVersion;

    event FactorSetPublished(bytes32 indexed hash, string version);
    event BatchAnchored(uint256 indexed id, bytes32 root, bytes32 indexed factorSetHash, string period);

    constructor() Ownable(msg.sender) {}

    function publishFactorSet(bytes32 hash, string calldata version) external onlyOwner {
        require(bytes(factorSetVersion[hash]).length == 0, "already published");
        factorSetVersion[hash] = version;
        emit FactorSetPublished(hash, version);
    }

    function anchor(bytes32 root, bytes32 factorSetHash, string calldata period)
        external
        onlyOwner
        returns (uint256 id)
    {
        require(bytes(factorSetVersion[factorSetHash]).length != 0, "unknown factor set");
        id = batches.length;
        batches.push(Batch(root, factorSetHash, uint64(block.timestamp), period));
        emit BatchAnchored(id, root, factorSetHash, period);
    }

    function verify(uint256 id, bytes32[] calldata proof, bytes32 leaf) external view returns (bool) {
        return MerkleProof.verify(proof, batches[id].root, leaf);
    }
}
