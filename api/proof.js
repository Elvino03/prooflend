import { getProofStatus } from '../server/proof-service.js'

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  try {
    const url = new URL(request.url, 'http://localhost')
    const result = await getProofStatus(url.searchParams.get('txHash') || '')
    response.status(result.status).json(result.body)
  } catch (error) {
    response.status(500).json({ error: error?.message || 'Proof generation failed.' })
  }
}
