import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { getProofStatus } from './server/proof-service.js'
const proofCache = new Map()

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
          const result = await getProofStatus(txHash)
          response.statusCode = result.status
          if (result.status === 200) proofCache.set(txHash, result.body.data)
          response.end(JSON.stringify(result.body))
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
