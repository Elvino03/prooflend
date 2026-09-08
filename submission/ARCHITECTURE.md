# ProofLend architecture

```mermaid
flowchart LR
    U[User wallet] -->|1. requestEligibility| S[ProofLendSignal<br/>Ethereum Sepolia]
    S -->|EligibilityRequested event| B[Attested Sepolia block]
    A[Attestcoin attestors] -->|commit source-chain state| B
    W[ProofLend web app] -->|2. transaction hash| P[Serverless proof API<br/>official USC SDK]
    P -->|check latest attested height| C[Creditcoin ChainInfo precompile]
    P -->|3. request proof| G[Attestcoin Proof Builder]
    G -->|encoded transaction<br/>Merkle + continuity proofs| W
    U -->|4. approve proof transaction| W
    W -->|executeEligibilityProof| E[ProofLendEligibility<br/>Creditcoin Testnet]
    E -->|5. verifyAndEmit| V[Native verifier<br/>0x0FD2]
    V -->|valid proof| E
    E -->|decode approved event<br/>reject replay<br/>record request ID| R[Verified eligibility state]
```

## Trust boundaries

- The wallet signs both state-changing transactions.
- The proof API gathers public proof material and never receives a private key.
- The Creditcoin contract accepts state changes only after the native verifier accepts the proof.
- The contract checks the Sepolia source contract and event signature before decoding the applicant.
- Each Attestcoin query ID can be processed only once.

