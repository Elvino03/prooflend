// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ProofLendSignal
/// @notice The Sepolia-side contract that creates a verifiable eligibility signal.
/// @dev Attestcoin later proves this emitted event on Creditcoin; it does not
///      move funds or make a real-world credit decision.
contract ProofLendSignal {
    uint256 public nextRequestId = 1;

    event EligibilityRequested(
        address indexed applicant,
        uint256 indexed requestId,
        bytes32 profileCommitment
    );

    function requestEligibility(bytes32 profileCommitment) external returns (uint256 requestId) {
        requestId = nextRequestId++;
        emit EligibilityRequested(msg.sender, requestId, profileCommitment);
    }
}
