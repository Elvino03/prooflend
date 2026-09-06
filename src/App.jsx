import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from 'ethers'
import { useEffect, useState } from 'react'
import './App.css'
import DeploymentPanel from './DeploymentPanel'
import { deployments } from './config'
import compiled from './generated/contracts.json'

const SEPOLIA_ID = '0xaa36a7'
const CREDITCOIN_ID = '0x18e8f'

const steps = [
  ['01', 'Connect wallet', 'Use a testnet wallet—not a wallet holding real funds.'],
  ['02', 'Request proof', 'Attestcoin verifies your eligibility signal from Sepolia.'],
  ['03', 'Get a decision', 'ProofLend records the verified result on Creditcoin.'],
]

const creditcoinNetwork = {
  chainId: CREDITCOIN_ID,
  chainName: 'Creditcoin Testnet',
  nativeCurrency: { name: 'Test CTC', symbol: 'tCTC', decimals: 18 },
  rpcUrls: ['https://rpc.cc3-testnet.creditcoin.network'],
  blockExplorerUrls: [deployments.creditcoinTestnet.explorer],
}

function friendlyError(error) {
  if (error?.code === 4001 || error?.code === 'ACTION_REJECTED') return 'The request was cancelled in Rabby.'
  return error?.shortMessage || error?.reason || error?.message || 'Something went wrong.'
}

async function switchChain(provider, chainId, network) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] })
  } catch (error) {
    if (error?.code !== 4902 || !network) throw error
    await provider.request({ method: 'wallet_addEthereumChain', params: [network] })
  }
}

function App() {
  const [wallet, setWallet] = useState({ status: 'idle', address: '', error: '' })
  const [flow, setFlow] = useState(() => {
    const txHash = localStorage.getItem('prooflend-source-tx') || ''
    return { stage: txHash ? 'source-confirmed' : 'ready', txHash, proof: null, destinationTx: '', error: '', progress: '' }
  })
  const showDeployment = new URLSearchParams(window.location.search).get('deploy') === '1'

  useEffect(() => {
    const provider = window.ethereum
    if (!provider) return undefined
    const updateAccount = (accounts) => setWallet(accounts[0]
      ? { status: 'connected', address: accounts[0], error: '' }
      : { status: 'idle', address: '', error: '' })
    provider.request({ method: 'eth_accounts' }).then(updateAccount).catch(() => {})
    provider.on?.('accountsChanged', updateAccount)
    return () => provider.removeListener?.('accountsChanged', updateAccount)
  }, [])

  const connectWallet = async () => {
    const provider = window.ethereum
    if (!provider) {
      setWallet({ status: 'error', address: '', error: 'Rabby was not detected. Open this app in the browser where Rabby is installed.' })
      return
    }
    try {
      setWallet({ status: 'connecting', address: '', error: '' })
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      setWallet({ status: 'connected', address: accounts[0], error: '' })
    } catch (error) {
      setWallet({ status: 'error', address: '', error: friendlyError(error) })
    }
  }

  const requestSignal = async () => {
    try {
      setFlow((current) => ({ ...current, stage: 'requesting', error: '' }))
      await switchChain(window.ethereum, SEPOLIA_ID)
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const signal = new Contract(deployments.sepolia.signalContract, compiled.signal.abi, signer)
      const commitment = keccak256(toUtf8Bytes(`prooflend:${wallet.address.toLowerCase()}`))
      const transaction = await signal.requestEligibility(commitment)
      setFlow((current) => ({ ...current, stage: 'mining-source', txHash: transaction.hash }))
      const receipt = await transaction.wait()
      if (receipt.status !== 1) throw new Error('The Sepolia transaction did not succeed.')
      localStorage.setItem('prooflend-source-tx', transaction.hash)
      setFlow({ stage: 'source-confirmed', txHash: transaction.hash, proof: null, destinationTx: '', error: '', progress: '' })
    } catch (error) {
      setFlow((current) => ({ ...current, stage: current.txHash ? 'source-confirmed' : 'ready', error: friendlyError(error) }))
    }
  }

  const generateProof = async () => {
    try {
      setFlow((current) => ({ ...current, stage: 'building-proof', error: '' }))
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const response = await fetch(`/api/proof?txHash=${encodeURIComponent(flow.txHash)}`)
        const result = await response.json()
        if (!response.ok && response.status !== 202) throw new Error(result.error || 'Proof generation failed.')
        if (result.data) {
          setFlow((current) => ({ ...current, stage: 'proof-ready', proof: result.data, progress: '' }))
          return
        }
        const progress = result.targetHeight
          ? `Attested through ${Number(result.latestHeight).toLocaleString()} · waiting for ${Number(result.targetHeight).toLocaleString()}`
          : 'Waiting for the Sepolia transaction to be mined…'
        setFlow((current) => ({ ...current, progress }))
        await new Promise((resolve) => setTimeout(resolve, 15_000))
      }
      throw new Error('Attestation did not arrive within 20 minutes. You can safely try again.')
    } catch (error) {
      setFlow((current) => ({ ...current, stage: 'source-confirmed', error: friendlyError(error) }))
    }
  }

  const submitProof = async () => {
    try {
      setFlow((current) => ({ ...current, stage: 'submitting-proof', error: '' }))
      await switchChain(window.ethereum, CREDITCOIN_ID, creditcoinNetwork)
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const eligibility = new Contract(deployments.creditcoinTestnet.eligibilityContract, compiled.eligibility.abi, signer)
      const proof = flow.proof
      const params = [proof.chainKey, proof.headerNumber, proof.txBytes, proof.merkleProof.root, proof.merkleProof.siblings, proof.continuityProof.lowerEndpointDigest, proof.continuityProof.roots]
      let gasLimit
      try {
        gasLimit = (await eligibility.executeEligibilityProof.estimateGas(...params) * 135n) / 100n
      } catch {
        gasLimit = 2_500_000n
      }
      const transaction = await eligibility.executeEligibilityProof(...params, { gasLimit })
      setFlow((current) => ({ ...current, stage: 'mining-proof', destinationTx: transaction.hash }))
      const receipt = await transaction.wait()
      if (receipt.status !== 1) throw new Error('The Creditcoin transaction did not succeed.')
      localStorage.removeItem('prooflend-source-tx')
      setFlow((current) => ({ ...current, stage: 'verified', error: '' }))
    } catch (error) {
      setFlow((current) => ({ ...current, stage: 'proof-ready', error: friendlyError(error) }))
    }
  }

  const resetFlow = () => {
    localStorage.removeItem('prooflend-source-tx')
    setFlow({ stage: 'ready', txHash: '', proof: null, destinationTx: '', error: '', progress: '' })
  }

  const shortAddress = wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : ''
  const isBusy = ['requesting', 'mining-source', 'building-proof', 'submitting-proof', 'mining-proof'].includes(flow.stage)
  const status = flow.stage === 'verified' ? 'Verified' : flow.stage === 'proof-ready' ? 'Proof ready' : flow.txHash ? 'In progress' : 'Awaiting proof'
  const action = !wallet.address
    ? { label: 'Connect Rabby to begin', run: connectWallet }
    : flow.stage === 'source-confirmed'
      ? { label: 'Build Attestcoin proof', run: generateProof }
      : flow.stage === 'proof-ready'
        ? { label: 'Submit proof on Creditcoin', run: submitProof }
        : flow.stage === 'verified'
          ? { label: 'Start another verification', run: resetFlow }
          : { label: flow.stage === 'requesting' ? 'Confirm in Rabby…' : flow.stage === 'mining-source' ? 'Confirming on Sepolia…' : flow.stage === 'building-proof' ? 'Waiting for attestation…' : flow.stage === 'submitting-proof' ? 'Confirm in Rabby…' : flow.stage === 'mining-proof' ? 'Confirming on Creditcoin…' : 'Request verification', run: requestSignal }

  return (
    <main>
      <nav className="nav" aria-label="Main navigation"><a className="brand" href="#top" aria-label="ProofLend home"><span className="brand-mark">P</span>ProofLend</a><span className="network-pill">Sepolia → Creditcoin</span></nav>
      <section className="hero" id="top">
        <p className="eyebrow">Cross-chain lending, made verifiable</p><h1>Prove your on-chain activity. Unlock a fairer loan decision.</h1>
        <p className="hero-copy">ProofLend uses Attestcoin Protocol to verify a signal from another chain, then makes an explainable lending decision on Creditcoin.</p>
        <div className="hero-actions"><button className="primary-button" onClick={connectWallet} disabled={wallet.status === 'connecting'}>{wallet.status === 'connected' ? shortAddress : wallet.status === 'connecting' ? 'Connecting…' : 'Connect Rabby wallet'}</button><a className="text-button" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div>
        {wallet.status === 'connected' && <p className="connection-note" role="status">Rabby connected. Transactions always require your approval.</p>}{wallet.status === 'error' && <p className="connection-error" role="alert">{wallet.error}</p>}
      </section>
      <section className="decision-card" aria-label="Eligibility verification">
        <div className="card-heading"><div><p className="card-label">Eligibility request</p><h2>{flow.stage === 'verified' ? 'Activity verified' : 'Verify your signal'}</h2></div><span className={`status ${flow.stage === 'verified' ? 'status-success' : 'status-pending'}`}>{status}</span></div>
        <div className="signal-row"><div><p className="signal-label">Cross-chain signal</p><p className="signal-value">ProofLend eligibility request</p></div><span className="signal-chain">Ethereum Sepolia</span></div>
        <div className="signal-row"><div><p className="signal-label">Verification result</p><p className="signal-value">{flow.stage === 'verified' ? 'Eligible · proof recorded' : 'Pending Attestcoin proof'}</p></div><span className="signal-chain">Creditcoin</span></div>
        <button className="wide-button wide-button-active" onClick={action.run} disabled={isBusy}>{action.label} <span aria-hidden="true">→</span></button>
        {flow.stage === 'building-proof' && <p className="card-footnote" role="status">{flow.progress || 'Checking Attestcoin attestation status…'} This commonly takes about 8 minutes; keep this tab open.</p>}
        {flow.txHash && <a className="transaction-link" href={`${deployments.sepolia.explorer}/tx/${flow.txHash}`} target="_blank" rel="noreferrer">View Sepolia request ↗</a>}
        {flow.destinationTx && <a className="transaction-link" href={`${deployments.creditcoinTestnet.explorer}/tx/${flow.destinationTx}`} target="_blank" rel="noreferrer">View Creditcoin proof ↗</a>}
        {flow.error && <p className="flow-error" role="alert">{flow.error}</p>}{!flow.txHash && <p className="card-footnote">Testnet only. The first Rabby prompt creates the Sepolia signal.</p>}
      </section>
      {showDeployment && <DeploymentPanel account={wallet.address} />}
      <section className="steps" id="how-it-works"><div className="section-intro"><p className="eyebrow">How it works</p><h2>Cross-chain data that users can inspect.</h2></div><div className="step-grid">{steps.map(([number, title, copy]) => <article className="step" key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section className="principles"><p>Built for a hackathon demo · Uses testnet only · Never request a seed phrase</p></section>
    </main>
  )
}

export default App
