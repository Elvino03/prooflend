# ProofLend

ProofLend is a testnet lending-eligibility demo that turns an Ethereum Sepolia signal into a verifiable result on Creditcoin. It uses Attestcoin Protocol to prove that the source transaction and its `EligibilityRequested` event really occurred before Creditcoin records the applicant as eligible.

## Why it matters

Cross-chain lending applications often depend on a trusted indexer or backend claiming that a user did something on another chain. ProofLend demonstrates a more transparent route: the destination contract validates a transaction-inclusion proof using Creditcoin's native Attestcoin verifier and decodes the proven receipt on-chain.

## Architecture

1. The connected user calls `requestEligibility(bytes32)` on `ProofLendSignal` on Ethereum Sepolia.
2. The contract emits `EligibilityRequested(address,uint256,bytes32)`.
3. The local proof service uses the official `@gluwa/usc-sdk` and Attestcoin Proof Builder to obtain the transaction proof.
4. Rabby submits that proof to `ProofLendEligibility` on Creditcoin Testnet.
5. The destination contract calls the native verifier precompile, checks that the event came from the configured source contract, decodes the applicant and request ID with the official `EvmV1Decoder`, and stores the result.

The wallet signs both testnet transactions. ProofLend never requests or stores a seed phrase or private key.

## Verified demo

- Applicant: `0xFC99c75De3188eB27f5331E24c51F4B68F1F4286`
- Request ID: `1`
- [Sepolia eligibility request](https://sepolia.etherscan.io/tx/0xd5ba4fa9041a7de72bcbee6ca12ef32c8e188c4ef828564469989a69ad820345)
- [Creditcoin proof execution](https://creditcoin-testnet.blockscout.com/tx/0xdec3d335a1d178fa92e05af5818b607669fa8d9de0c1b4fc6d6e2626e5a13096)
- Attestcoin query ID: `0x3170fd6faa955e2fbbd3d3aab9c36f8185f1d727fc98ba045001198c4b47ba22`

## Deployed contracts

- Ethereum Sepolia `ProofLendSignal`: `0xa91ebc1dc12aa9c43e7acc2ac4227309bdd7188f`
- Creditcoin Testnet `ProofLendEligibility`: `0xa91ebc1dc12aa9c43e7acc2ac4227309bdd7188f`

The addresses match because the same deployer used the same nonce on both networks. They are separate contracts with different bytecode.

## Run locally

Requirements: Node.js 24+, npm, and a Rabby test wallet funded with Sepolia ETH and tCTC.

```bash
npm install
npm run contracts:check
npm run dev
```

Open `http://127.0.0.1:5173/`. Proof generation commonly takes several minutes while the Sepolia block is attested on Creditcoin.

## Validate

```bash
npm run lint
npm run build
npm run contracts:check
```

## Safety and scope

ProofLend is a hackathon demonstration using testnets only. Eligibility represents a verified demo signal, not a real credit score, loan offer, or financial recommendation.
