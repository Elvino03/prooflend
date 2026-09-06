import { useState } from 'react'
import contracts from './generated/contracts.json'

const SEPOLIA = { id: '0xaa36a7', name: 'Ethereum Sepolia' }
const CREDITCOIN = {
  id: '0x18e8f',
  name: 'Creditcoin Testnet',
  params: {
    chainId: '0x18e8f',
    chainName: 'Creditcoin Testnet',
    nativeCurrency: { name: 'Test CTC', symbol: 'tCTC', decimals: 18 },
    rpcUrls: ['https://rpc.cc3-testnet.creditcoin.network'],
    blockExplorerUrls: ['https://creditcoin-testnet.blockscout.com/'],
  },
}

function encodeAddressConstructor(bytecode, address) {
  return `${bytecode}${address.toLowerCase().replace('0x', '').padStart(64, '0')}`
}

async function switchChain(provider, chain) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chain.id }] })
  } catch (error) {
    if (error.code !== 4902 || !chain.params) throw error
    await provider.request({ method: 'wallet_addEthereumChain', params: [chain.params] })
  }
}

async function waitForReceipt(provider, hash) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] })
    if (receipt) return receipt
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error('Transaction is still pending. Check it in the block explorer.')
}

function assertHexData(data) {
  if (!/^0x[0-9a-fA-F]+$/.test(data) || data.length % 2 !== 0) {
    throw new Error('Deployment bytecode is not valid hex. Rebuild the contract artifacts before retrying.')
  }
}

function DeploymentPanel({ account }) {
  const [signalAddress, setSignalAddress] = useState(() => localStorage.getItem('prooflend.signalAddress') || '')
  const [eligibilityAddress, setEligibilityAddress] = useState(() => localStorage.getItem('prooflend.eligibilityAddress') || '')
  const [status, setStatus] = useState('Ready to deploy the Sepolia signal contract.')
  const [busy, setBusy] = useState(false)

  const deploy = async (network, data, onMined) => {
    if (!window.ethereum || !account) {
      setStatus('Connect your Rabby test account first.')
      return
    }
    try {
      setBusy(true)
      assertHexData(data)
      setStatus(`Switching Rabby to ${network.name}…`)
      await switchChain(window.ethereum, network)
      setStatus(`Review and approve the ${network.name} deployment in Rabby.`)
      const hash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: account, data }],
      })
      setStatus('Transaction submitted. Waiting for confirmation…')
      const receipt = await waitForReceipt(window.ethereum, hash)
      if (receipt.status !== '0x1') throw new Error('The deployment transaction failed.')
      onMined(receipt.contractAddress)
    } catch (error) {
      setStatus(error.code === 4001 ? 'Deployment cancelled in Rabby.' : error.message)
    } finally {
      setBusy(false)
    }
  }

  const deploySignal = () => deploy(SEPOLIA, contracts.signal.bytecode, (address) => {
    setSignalAddress(address)
    localStorage.setItem('prooflend.signalAddress', address)
    setStatus('Sepolia signal contract deployed. Creditcoin deployment is now unlocked.')
  })

  const deployEligibility = () => {
    const data = encodeAddressConstructor(contracts.eligibility.bytecode, signalAddress)
    return deploy(CREDITCOIN, data, (address) => {
      setEligibilityAddress(address)
      localStorage.setItem('prooflend.eligibilityAddress', address)
      setStatus('Both ProofLend contracts are deployed successfully.')
    })
  }

  return (
    <section className="deployment-panel" aria-labelledby="deployment-title">
      <p className="eyebrow">Private setup screen</p>
      <h2 id="deployment-title">Deploy ProofLend contracts</h2>
      <p className="deployment-copy">Only use your funded test account. Each button creates one testnet transaction that Rabby will show before anything is sent.</p>
      <div className="deployment-step">
        <div><strong>1. Ethereum Sepolia</strong><span>{signalAddress || 'Not deployed'}</span></div>
        <button className="primary-button" disabled={busy || !account || signalAddress} onClick={deploySignal}>{signalAddress ? 'Deployed' : 'Deploy signal contract'}</button>
      </div>
      <div className="deployment-step">
        <div><strong>2. Creditcoin Testnet</strong><span>{eligibilityAddress || 'Waiting for Sepolia contract'}</span></div>
        <button className="primary-button" disabled={busy || !signalAddress || eligibilityAddress} onClick={deployEligibility}>{eligibilityAddress ? 'Deployed' : 'Deploy eligibility contract'}</button>
      </div>
      <p className="deployment-status" role="status">{status}</p>
      {eligibilityAddress && <p className="deployment-warning">Save both addresses. They are public deployment identifiers, not wallet secrets.</p>}
    </section>
  )
}

export default DeploymentPanel
