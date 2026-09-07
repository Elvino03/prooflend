import { chainInfo, proofProvider } from '@gluwa/usc-sdk'
import { JsonRpcProvider } from 'ethers'

const SOURCE_CHAIN_KEY = 1
const PROOF_BUILDER_URL = 'https://prover.cc3-testnet.creditcoin.network'
const CREDITCOIN_RPC_URL = 'https://rpc.cc3-testnet.creditcoin.network'
const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'

function jsonSafe(value) {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(jsonSafe)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]))
  }
  return value
}

export async function getProofStatus(txHash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { status: 400, body: { error: 'A valid Sepolia transaction hash is required.' } }
  }

  const sourceProvider = new JsonRpcProvider(SEPOLIA_RPC_URL)
  const creditcoinProvider = new JsonRpcProvider(CREDITCOIN_RPC_URL)
  const transaction = await sourceProvider.getTransaction(txHash)
  if (!transaction) return { status: 404, body: { error: 'The Sepolia transaction was not found.' } }
  if (!transaction.blockNumber) return { status: 202, body: { pending: true, reason: 'mining' } }

  const chainProvider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider)
  const latest = await chainProvider.getLatestAttestedHeightAndHash(SOURCE_CHAIN_KEY)
  if (BigInt(latest.height) < BigInt(transaction.blockNumber)) {
    return {
      status: 202,
      body: {
        pending: true,
        reason: 'attestation',
        latestHeight: latest.height.toString(),
        targetHeight: transaction.blockNumber.toString(),
      },
    }
  }

  const builder = new proofProvider.service.ProofBuilder(SOURCE_CHAIN_KEY, PROOF_BUILDER_URL)
  const result = await builder.getProof(txHash)
  if (!result.success || !result.data) {
    return {
      status: 202,
      body: {
        pending: true,
        reason: 'proof-builder',
        message: result.error || 'The attested proof is still entering the builder cache.',
        targetHeight: transaction.blockNumber.toString(),
      },
    }
  }
  return { status: 200, body: { data: jsonSafe(result.data) } }
}
