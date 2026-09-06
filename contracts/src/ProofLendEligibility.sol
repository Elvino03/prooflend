// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";

interface INativeQueryVerifier {
    struct MerkleProofEntry {
        bytes32 hash;
        bool isLeft;
    }

    struct MerkleProof {
        bytes32 root;
        MerkleProofEntry[] siblings;
    }

    struct ContinuityProof {
        bytes32 lowerEndpointDigest;
        bytes32[] roots;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool);

    function calculateTxIndex(MerkleProof memory merkleProof) external view returns (uint64);
}

/// @title ProofLendEligibility
/// @notice Creditcoin-side consumer of an Attestcoin proof from Ethereum Sepolia.
/// @dev The contract accepts only the event emitted by the configured Sepolia
///      signal contract. The native verifier precompile rejects invalid proofs.
contract ProofLendEligibility {
    address private constant VERIFIER_PRECOMPILE = 0x0000000000000000000000000000000000000FD2;
    bytes32 public constant ELIGIBILITY_REQUESTED_SIGNATURE =
        keccak256("EligibilityRequested(address,uint256,bytes32)");

    address public immutable owner;
    address public sourceSignalContract;
    INativeQueryVerifier public immutable verifier;
    mapping(bytes32 queryId => bool processed) public processedQueries;
    mapping(address applicant => uint256 requestId) public verifiedRequestId;

    event SourceSignalContractUpdated(address indexed sourceSignalContract);
    event EligibilityVerified(address indexed applicant, uint256 indexed requestId, bytes32 indexed queryId);

    error OnlyOwner();
    error QueryAlreadyProcessed();
    error InvalidProof();
    error UnexpectedSourceContract();
    error MissingEligibilityEvent();
    error InvalidEligibilityEvent();

    constructor(address initialSourceSignalContract) {
        owner = msg.sender;
        verifier = INativeQueryVerifier(VERIFIER_PRECOMPILE);
        _setSourceSignalContract(initialSourceSignalContract);
    }

    function setSourceSignalContract(address newSourceSignalContract) external {
        if (msg.sender != owner) revert OnlyOwner();
        _setSourceSignalContract(newSourceSignalContract);
    }

    /// @notice Verify a Sepolia transaction through Attestcoin and record its applicant.
    /// @dev A worker obtains the proof data from the official Proof Builder API.
    function executeEligibilityProof(
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (address applicant, uint256 requestId) {
        bytes32 queryId = _computeQueryId(chainKey, blockHeight, merkleRoot, siblings);
        if (processedQueries[queryId]) revert QueryAlreadyProcessed();

        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        INativeQueryVerifier.ContinuityProof memory continuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots});

        if (!verifier.verifyAndEmit(chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof)) {
            revert InvalidProof();
        }
        processedQueries[queryId] = true;

        (applicant, requestId) = _decodeEligibilityEvent(encodedTransaction);
        verifiedRequestId[applicant] = requestId;
        emit EligibilityVerified(applicant, requestId, queryId);
    }

    function isEligible(address applicant) external view returns (bool) {
        return verifiedRequestId[applicant] != 0;
    }

    function _decodeEligibilityEvent(bytes calldata encodedTransaction)
        internal
        view
        returns (address applicant, uint256 requestId)
    {
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        EvmV1Decoder.LogEntry[] memory logs =
            EvmV1Decoder.getLogsByEventSignature(receipt, ELIGIBILITY_REQUESTED_SIGNATURE);
        if (logs.length == 0) revert MissingEligibilityEvent();

        EvmV1Decoder.LogEntry memory eligibilityLog = logs[0];
        if (eligibilityLog.address_ != sourceSignalContract) revert UnexpectedSourceContract();
        if (eligibilityLog.topics.length != 3) revert InvalidEligibilityEvent();

        applicant = address(uint160(uint256(eligibilityLog.topics[1])));
        requestId = uint256(eligibilityLog.topics[2]);
    }

    function _computeQueryId(
        uint64 chainKey,
        uint64 blockHeight,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings
    ) internal view returns (bytes32 queryId) {
        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        uint256 txIndex = verifier.calculateTxIndex(merkleProof);
        queryId = keccak256(abi.encodePacked(chainKey, blockHeight, txIndex));
    }

    function _setSourceSignalContract(address newSourceSignalContract) internal {
        if (newSourceSignalContract == address(0)) revert UnexpectedSourceContract();
        sourceSignalContract = newSourceSignalContract;
        emit SourceSignalContractUpdated(newSourceSignalContract);
    }
}
