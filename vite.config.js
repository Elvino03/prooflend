import react from '@vitejs/plugin-react'
import { chainInfo, proofProvider } from '@gluwa/usc-sdk'
import { JsonRpcProvider } from 'ethers'
import { defineConfig } from 'vite'

const SOURCE_CHAIN_KEY = 1
const PROOF_BUILDER_URL = 'https://prover.cc3-testnet.creditcoin.network'
const CREDITCOIN_RPC_URL = 'https://rpc.cc3-testnet.creditcoin.network'
const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
const proofCache = new Map()

function jsonSafe(value) {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(jsonSafe)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]))
  return value
}

function proofApi() {
  return {
    name: 'prooflend-proof-api',
    configureServer(server) {
      server.middlewares.use('/api/proof', async (request, response) => {
        response.setHeader('Content-Type', 'application/json')
        try {
          const url = new URL(request.url, 'http://localhost')
          const txHash = url.searchParams.get('txHash') || ''
          if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
            response.statusCode = 400
            response.end(JSON.stringify({ error: 'A valid Sepolia transaction hash is required.' }))
            return
          }
          if (proofCache.has(txHash)) {
            response.end(JSON.stringify({ data: proofCache.get(txHash) }))
            return
          }
          const sourceProvider = new JsonRpcProvider(SEPOLIA_RPC_URL)
          const creditcoinProvider = new JsonRpcProvider(CREDITCOIN_RPC_URL)
          const transaction = await sourceProvider.getTransaction(txHash)
          if (!transaction?.blockNumber) throw new Error('The Sepolia transaction is not mined yet.')
          const builder = new proofProvider.service.ProofBuilder(SOURCE_CHAIN_KEY, PROOF_BUILDER_URL)
          const chainProvider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider)
          const latest = await chainProvider.getLatestAttestedHeightAndHash(SOURCE_CHAIN_KEY)
          if (BigInt(latest.height) < BigInt(transaction.blockNumber)) await builder.waitUntilHeightAttested(SOURCE_CHAIN_KEY, transaction.blockNumber, 15_000, 1_200_000)
          const result = await builder.getProof(txHash)
          if (!result.success || !result.data) throw new Error(result.error || 'The proof builder returned no proof.')
          const data = jsonSafe(result.data)
          proofCache.set(txHash, data)
          response.end(JSON.stringify({ data }))
        } catch (error) {
          response.statusCode = 500
          response.end(JSON.stringify({ error: error?.message || 'Proof generation failed.' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), proofApi()],
})
