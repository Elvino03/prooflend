# ProofLend contracts

ProofLend uses a two-chain, testnet-only flow:

1. `ProofLendSignal` runs on Ethereum Sepolia. It emits `EligibilityRequested` when a user starts an eligibility request.
2. An off-chain worker obtains the transaction inclusion proof from the Attestcoin Proof Builder API.
3. `ProofLendEligibility` runs on Creditcoin CC3 Testnet. It calls Creditcoin's native Attestcoin query-verifier precompile, decodes the proven Sepolia receipt with the official `EvmV1Decoder`, and records the verified request.

The `ProofLendEligibility` contract only accepts logs emitted by the configured `ProofLendSignal` contract. This prevents a different Sepolia contract from fabricating eligibility events.

## Safety

- All deployment and interaction is testnet-only.
- No contract asks for or stores a wallet private key.
- Eligibility is a demo status based on a verifiable testnet event. It is not a real credit score or lending decision.

## Local compile

From the repository root:

```bash
forge build
```

## Testnet deployments

Deployed on September 6, 2026:

- Ethereum Sepolia `ProofLendSignal`: `0xa91ebc1dc12aa9c43e7acc2ac4227309bdd7188f`
- Creditcoin Testnet `ProofLendEligibility`: `0xa91ebc1dc12aa9c43e7acc2ac4227309bdd7188f`

The addresses match because the same deployer account used the same deployment
nonce on both chains. They refer to different bytecode on different networks.

## Successful Attestcoin execution

- Sepolia request transaction: `0xd5ba4fa9041a7de72bcbee6ca12ef32c8e188c4ef828564469989a69ad820345`
- Creditcoin proof transaction: `0xdec3d335a1d178fa92e05af5818b607669fa8d9de0c1b4fc6d6e2626e5a13096`
- Verified applicant: `0xFC99c75De3188eB27f5331E24c51F4B68F1F4286`
- Verified request ID: `1`
