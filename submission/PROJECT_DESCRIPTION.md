# ProofLend submission copy

## Basic details

**Project name:** ProofLend

**Track:** DeFi

**Tagline:** Cross-chain lending eligibility backed by an on-chain Attestcoin proof.

**One-sentence summary:** ProofLend proves that an eligibility signal occurred on Ethereum Sepolia, verifies the proof inside a Creditcoin smart contract, and records an inspectable lending decision without trusting a private indexer.

**Live demo:** https://prooflend.vercel.app/

**Source code:** https://github.com/Elvino03/prooflend

## Short description

ProofLend is a testnet lending eligibility application built on Creditcoin and the Attestcoin Protocol. A user creates an eligibility request on Ethereum Sepolia. After Attestcoin has attested the source block, ProofLend obtains a Merkle proof and continuity proof and submits them to Creditcoin. The destination contract verifies the proof with Creditcoin's native verifier, confirms that the expected event came from the approved Sepolia contract, and records the applicant as eligible.

## Full project description

Lending applications often need facts that live outside the chain where a loan decision executes. A common solution is to let a private backend or indexer read another network and report what happened. That creates an extra party that users and lending contracts must trust.

ProofLend demonstrates a different design. The source fact begins as an `EligibilityRequested` event emitted by `ProofLendSignal` on Ethereum Sepolia. Attestcoin attestors commit source-chain state to Creditcoin. ProofLend's proof service waits until the relevant block has been attested, then uses the official `@gluwa/usc-sdk` and Proof Builder to obtain the encoded transaction, Merkle proof, and continuity proof.

The user's wallet submits those values to `ProofLendEligibility` on Creditcoin Testnet. The contract calls the native verifier precompile at `0x0FD2`. It then uses `EvmV1Decoder` to read the proven receipt, checks the emitting contract and event signature, extracts the applicant and request ID, prevents the same query from being processed twice, and records the verified request on-chain.

The result is a working reference for lending rules that depend on activity from another chain. The current eligibility signal is deliberately simple so the cross-chain verification path remains easy to inspect. A production version could replace it with repayment history, collateral events, or other lending signals while retaining the same verification pattern.

## Problem

Cross-chain lending decisions usually depend on middleware that tells the destination chain what occurred elsewhere. If that middleware is wrong, compromised, or unavailable, the lending contract cannot independently verify the claim.

## Solution

ProofLend gives the Creditcoin contract the source transaction and cryptographic proofs needed to verify the claim itself. The off-chain service gathers proof material, but it cannot make an applicant eligible by assertion. Only a proof accepted by Creditcoin's native verifier and an event accepted by the destination contract can update eligibility.

## Why Attestcoin is essential

- The Merkle proof establishes that the source transaction belongs to the claimed Sepolia block.
- The continuity proof links that block to source-chain state attested on Creditcoin.
- Creditcoin verifies both proofs synchronously through the native `0x0FD2` precompile.
- ProofLend decodes and validates the proven event before changing lending state.
- Replay protection prevents the same cross-chain query from being applied twice.

Without Attestcoin verification, the Creditcoin contract has no trusted input and cannot record eligibility.

## User flow

1. Connect an EVM-compatible browser wallet.
2. Approve an eligibility request on Ethereum Sepolia.
3. Wait while ProofLend tracks Attestcoin's latest attested height and builds the proof.
4. Review and approve the proof transaction on Creditcoin Testnet.
5. Inspect the verified result and both transactions in public explorers.

## Key features

- End-to-end cross-chain proof flow on public testnets
- Native on-chain proof verification on Creditcoin
- Source-contract and event-signature validation
- Replay protection for processed queries
- Automatic attestation polling and recovery from temporary proof-service errors
- EIP-6963 discovery for multiple compatible browser wallets
- In-app network switching between Sepolia and Creditcoin Testnet
- No private keys, seed phrases, or custody in the application

## Technology

**Frontend:** React, Vite, ethers.js

**Backend:** Vercel Function, Node.js, official `@gluwa/usc-sdk`

**Contracts:** Solidity, `@gluwa/usc-contracts`, `EvmV1Decoder`

**Networks:** Ethereum Sepolia and Creditcoin Testnet

**Attestcoin components:** Proof Builder, ChainInfo precompile, Native Query Verifier precompile

## Deployed contracts

- Ethereum Sepolia `ProofLendSignal`: `0xa91ebc1dc12aa9c43e7acc2ac4227309bdd7188f`
- Creditcoin Testnet `ProofLendEligibility`: `0xa91ebc1dc12aa9c43e7acc2ac4227309bdd7188f`

The matching addresses identify separate contracts on separate networks. The deployer used the same nonce on both networks.

## Verified public demo

- Applicant: `0xFC99c75De3188eB27f5331E24c51F4B68F1F4286`
- Request ID: `1`
- Sepolia request: https://sepolia.etherscan.io/tx/0xd5ba4fa9041a7de72bcbee6ca12ef32c8e188c4ef828564469989a69ad820345
- Creditcoin proof: https://creditcoin-testnet.blockscout.com/tx/0xdec3d335a1d178fa92e05af5818b607669fa8d9de0c1b4fc6d6e2626e5a13096
- Attestcoin query ID: `0x3170fd6faa955e2fbbd3d3aab9c36f8185f1d727fc98ba045001198c4b47ba22`

## What I built during the hackathon

I built ProofLend as a solo participant. The submission includes two deployed Solidity contracts, the Attestcoin proof service, the complete browser workflow, multi-wallet discovery, testnet network management, transaction recovery, and a deployed web interface.

## Next steps

The next version would support verified repayment and collateral events instead of a demo commitment. A lending policy contract could combine several proven signals, while privacy-preserving commitments could limit the personal data exposed in public events. Proof batching and relayed destination transactions could also reduce cost and remove the second manual transaction from the user flow.

## Safety and scope

ProofLend is a hackathon prototype operating only on public testnets. Eligibility is a verified demo signal, not a credit score, loan offer, or financial recommendation. The application never requests or stores a wallet seed phrase or private key.

## References

- BUIDL CTC 2026 Fall: https://buidl.creditcoin.org/
- Attestcoin architecture: https://docs.creditcoin.org/usc/overview/usc-architecture-overview
- Query, proof, and verification: https://docs.creditcoin.org/usc/creditcoin-oracle-subsystems/proving

