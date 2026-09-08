# ProofLend demo video script

## Recommended format

**Target length:** 3 minutes 20 seconds

**Recording:** 1080p, browser zoom at 100%, microphone close to the speaker, notifications disabled

**Tabs prepared before recording:**

1. ProofLend live application
2. Verified Sepolia transaction
3. Verified Creditcoin transaction
4. GitHub repository, opened at `ProofLendEligibility.sol`

Use a funded test wallet with no real assets. Avoid showing the wallet's account list, balances unrelated to the demo, or any private information.

## Script and shot list

### 0:00-0:15 — Opening

**On screen:** ProofLend home page, hero section.

**Narration:**

“Hi, I’m Elvino, and I built ProofLend as a solo project for the DeFi track of BUIDL CTC. ProofLend turns activity on Ethereum into a lending eligibility result that a Creditcoin contract can verify for itself.”

### 0:15-0:38 — The problem

**On screen:** Scroll from the hero to the verification card.

**Narration:**

“Cross-chain lending apps often rely on a backend or indexer to report what a user did on another network. That report becomes a trusted input. ProofLend replaces the report with transaction data and an Attestcoin proof verified on Creditcoin.”

### 0:38-1:05 — Connect and create the source signal

**On screen:** Click **Connect wallet**, select a compatible wallet, and show the current-network control. Click **Request verification**. Show the wallet confirmation without exposing unrelated account details.

**Narration:**

“I connect an EVM-compatible wallet and request verification. ProofLend switches to Sepolia and calls the source contract. The contract emits an `EligibilityRequested` event with my address, a request ID, and a profile commitment.”

**Editing note:** Stop before approving if you do not want to create another source transaction. You can instead cut to the verified Sepolia transaction prepared in the next segment.

### 1:05-1:35 — Show the source evidence

**On screen:** Open the prepared Sepolia transaction and highlight the transaction status, contract address, and emitted event.

**Narration:**

“Here is a completed request on Sepolia. The event came from the deployed `ProofLendSignal` contract. Attestcoin attestors observe the source chain and commit attested state to Creditcoin.”

**Visible evidence:**

- Transaction: `0xd5ba4fa9041a7de72bcbee6ca12ef32c8e188c4ef828564469989a69ad820345`
- Source contract: `0xa91ebc1dc12aa9c43e7acc2ac4227309bdd7188f`

### 1:35-2:05 — Explain proof generation

**On screen:** Return to ProofLend. Show **Build Attestcoin proof** and the progress state. Then cut to the architecture diagram.

**Narration:**

“ProofLend waits until the Sepolia block is attested. Its serverless proof service uses the official SDK and Proof Builder to obtain the encoded transaction, a Merkle inclusion proof, and a continuity proof. The service only gathers proof material. It does not sign for the user, and its response cannot update eligibility by itself.”

**Editing note:** A fresh attestation commonly takes several minutes. Record the start of the wait, then cut to the completed proof flow. Do not leave a long wait in the final video.

### 2:05-2:35 — Verify on Creditcoin

**On screen:** Show the wallet switching to Creditcoin Testnet and the proof transaction confirmation. If using the prepared result, open the verified Creditcoin transaction and show its successful status.

**Narration:**

“My wallet submits the proof to `ProofLendEligibility` on Creditcoin Testnet. The contract calls Creditcoin’s native verifier at `0x0FD2`, checks the approved source contract and event signature, decodes the applicant and request ID, and rejects replayed queries.”

**Visible evidence:**

- Transaction: `0xdec3d335a1d178fa92e05af5818b607669fa8d9de0c1b4fc6d6e2626e5a13096`
- Destination contract: `0xa91ebc1dc12aa9c43e7acc2ac4227309bdd7188f`

### 2:35-2:57 — Result and code

**On screen:** Show **Activity verified** in ProofLend, then switch to `ProofLendEligibility.sol`. Briefly highlight `verifyAndEmit`, the source-contract check, `processedQueries`, and `verifiedRequestId`.

**Narration:**

“The successful transaction records the verified request on-chain. These contract checks make Attestcoin essential to the product: without a valid proof and the expected event, no eligibility state changes.”

### 2:57-3:20 — Close

**On screen:** Return to the hero, then show the GitHub repository and live URL.

**Narration:**

“This prototype uses a simple eligibility signal so the complete verification path stays easy to inspect. The same pattern can support repayment history, collateral events, and other lending inputs. ProofLend is live on testnet, and the complete source code and verified transactions are public. Thank you.”

## Recording checklist

- Keep the final video under the platform’s stated limit.
- Show the live URL and repository URL clearly.
- Keep explorer transaction hashes readable for several seconds.
- Remove wallet popups that expose unrelated addresses or balances.
- Cut the attestation wait while stating that the video was shortened.
- Confirm that narration, screen actions, and cursor movements stay synchronized.
- Export as MP4 using H.264 video and AAC audio for broad compatibility.

## Thirty-second fallback pitch

“ProofLend is a cross-chain lending eligibility demo built on Creditcoin. A user emits an eligibility request on Ethereum Sepolia. Attestcoin supplies Merkle and continuity proofs, and the Creditcoin contract verifies them through the native `0x0FD2` precompile before decoding the approved event and recording eligibility. The proof service gathers data, but it cannot grant eligibility. Both deployed contracts, the web app, and verified testnet transactions are public.”

