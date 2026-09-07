import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from 'ethers'
import { useEffect, useRef, useState } from 'react'
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

const sepoliaNetwork = {
  chainId: SEPOLIA_ID,
  chainName: 'Ethereum Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
  blockExplorerUrls: [deployments.sepolia.explorer],
}

function ChevronDown({ open = false }) {
  return <svg className={`menu-chevron ${open ? 'menu-chevron-open' : ''}`} viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
}

function CopyIcon() {
  return <svg className="menu-action-icon" viewBox="0 0 18 18" aria-hidden="true"><rect x="6.25" y="5.25" width="8" height="8" rx="1.5" /><path d="M11.5 5.25V4.5A1.5 1.5 0 0 0 10 3H4.5A1.5 1.5 0 0 0 3 4.5V10A1.5 1.5 0 0 0 4.5 11.5h1.75" /></svg>
}

function PowerIcon() {
  return <svg className="menu-action-icon" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2.75v6" /><path d="M5.15 5.05a6 6 0 1 0 7.7 0" /></svg>
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
  const [chainId, setChainId] = useState('')
  const [networkStatus, setNetworkStatus] = useState('idle')
  const [networkError, setNetworkError] = useState('')
  const [networkMenuOpen, setNetworkMenuOpen] = useState(false)
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('idle')
  const navActionsRef = useRef(null)
  const [flow, setFlow] = useState(() => {
    const txHash = localStorage.getItem('prooflend-source-tx') || ''
    return { stage: txHash ? 'source-confirmed' : 'ready', txHash, proof: null, destinationTx: '', error: '', progress: '' }
  })
  const showDeployment = new URLSearchParams(window.location.search).get('deploy') === '1'

  useEffect(() => {
    const provider = window.ethereum
    if (!provider) return undefined
    const updateAccount = (accounts) => {
      const disconnectedFromSite = sessionStorage.getItem('prooflend-wallet-disconnected') === '1'
      setWallet(accounts[0] && !disconnectedFromSite
        ? { status: 'connected', address: accounts[0], error: '' }
        : { status: 'idle', address: '', error: '' })
    }
    provider.request({ method: 'eth_accounts' }).then(updateAccount).catch(() => {})
    provider.request({ method: 'eth_chainId' }).then(setChainId).catch(() => {})
    provider.on?.('accountsChanged', updateAccount)
    provider.on?.('chainChanged', setChainId)
    return () => {
      provider.removeListener?.('accountsChanged', updateAccount)
      provider.removeListener?.('chainChanged', setChainId)
    }
  }, [])

  useEffect(() => {
    const closeMenus = (event) => {
      if (!navActionsRef.current?.contains(event.target)) {
        setNetworkMenuOpen(false)
        setWalletMenuOpen(false)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setNetworkMenuOpen(false)
        setWalletMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const connectWallet = async () => {
    const provider = window.ethereum
    if (!provider) {
      setWallet({ status: 'error', address: '', error: 'Rabby was not detected. Open this app in the browser where Rabby is installed.' })
      return
    }
    try {
      setWallet({ status: 'connecting', address: '', error: '' })
      sessionStorage.removeItem('prooflend-wallet-disconnected')
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      setWallet({ status: 'connected', address: accounts[0], error: '' })
    } catch (error) {
      setWallet({ status: 'error', address: '', error: friendlyError(error) })
    }
  }

  const changeNetwork = async (targetChainId) => {
    if (!targetChainId || !window.ethereum) return
    try {
      setNetworkStatus('switching')
      setNetworkMenuOpen(false)
      setNetworkError('')
      const network = targetChainId === SEPOLIA_ID ? sepoliaNetwork : creditcoinNetwork
      await switchChain(window.ethereum, targetChainId, network)
      setChainId(await window.ethereum.request({ method: 'eth_chainId' }))
    } catch (error) {
      setNetworkError(friendlyError(error))
    } finally {
      setNetworkStatus('idle')
    }
  }

  const copyAddress = async () => {
    if (!wallet.address) return
    try {
      await navigator.clipboard.writeText(wallet.address)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch {
      setCopyStatus('error')
    }
  }

  const disconnectWallet = async () => {
    sessionStorage.setItem('prooflend-wallet-disconnected', '1')
    setWalletMenuOpen(false)
    setWallet({ status: 'idle', address: '', error: '' })
    try {
      await window.ethereum?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
    } catch {
      // Some wallets do not expose permission revocation; local disconnect still succeeds.
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
  const currentNetwork = chainId === SEPOLIA_ID
    ? 'Ethereum Sepolia'
    : chainId === CREDITCOIN_ID
      ? 'Creditcoin Testnet'
      : chainId
        ? 'Unsupported network'
        : 'Network unavailable'
  const supportedNetwork = chainId === SEPOLIA_ID || chainId === CREDITCOIN_ID
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
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="ProofLend home"><span className="brand-mark">P</span>ProofLend</a>
        <div className="nav-actions" ref={navActionsRef}>
          <div className="nav-menu-wrap">
            <button className={`network-pill current-network ${chainId && !supportedNetwork ? 'network-warning' : ''}`} onClick={() => { setNetworkMenuOpen((open) => !open); setWalletMenuOpen(false) }} disabled={!chainId || networkStatus === 'switching'} aria-haspopup="menu" aria-expanded={networkMenuOpen}>
              <span className="network-dot" aria-hidden="true" />
              <span>{networkStatus === 'switching' ? 'Switching…' : currentNetwork}</span>
              <ChevronDown open={networkMenuOpen} />
            </button>
            {networkMenuOpen && <div className="nav-popover network-menu" role="menu" aria-label="Choose wallet network">
              <p className="popover-label">Switch network</p>
              <button className={chainId === SEPOLIA_ID ? 'menu-option menu-option-active' : 'menu-option'} onClick={() => changeNetwork(SEPOLIA_ID)} role="menuitem"><span className="chain-icon chain-icon-sepolia">S</span><span><strong>Ethereum Sepolia</strong><small>Source signal</small></span><span className="menu-check">{chainId === SEPOLIA_ID ? '✓' : ''}</span></button>
              <button className={chainId === CREDITCOIN_ID ? 'menu-option menu-option-active' : 'menu-option'} onClick={() => changeNetwork(CREDITCOIN_ID)} role="menuitem"><span className="chain-icon chain-icon-creditcoin">C</span><span><strong>Creditcoin Testnet</strong><small>Proof destination</small></span><span className="menu-check">{chainId === CREDITCOIN_ID ? '✓' : ''}</span></button>
            </div>}
          </div>
          <div className="nav-menu-wrap">
            <button className={`nav-wallet ${wallet.status === 'connected' ? 'nav-wallet-connected' : ''}`} onClick={wallet.status === 'connected' ? () => { setWalletMenuOpen((open) => !open); setNetworkMenuOpen(false) } : connectWallet} disabled={wallet.status === 'connecting'} aria-haspopup={wallet.status === 'connected' ? 'menu' : undefined} aria-expanded={wallet.status === 'connected' ? walletMenuOpen : undefined}><span className="wallet-symbol" aria-hidden="true">◇</span>{wallet.status === 'connected' ? shortAddress : wallet.status === 'connecting' ? 'Connecting…' : 'Connect wallet'}{wallet.status === 'connected' && <ChevronDown open={walletMenuOpen} />}</button>
            {walletMenuOpen && wallet.address && <div className="nav-popover wallet-menu" role="menu" aria-label="Wallet options">
              <p className="popover-label">Connected wallet</p>
              <p className="wallet-full-address">{wallet.address}</p>
              <button className="wallet-menu-action" onClick={copyAddress} role="menuitem"><CopyIcon />{copyStatus === 'copied' ? 'Address copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy address'}<span className="action-status">{copyStatus === 'copied' ? '✓' : ''}</span></button>
              <button className="wallet-menu-action wallet-disconnect" onClick={disconnectWallet} role="menuitem"><PowerIcon />Disconnect from site</button>
            </div>}
          </div>
        </div>
      </nav>
      <section className="hero" id="top">
        <p className="eyebrow">Cross-chain lending, made verifiable</p><h1>Prove your on-chain activity. Unlock a fairer loan decision.</h1>
        <p className="hero-copy">ProofLend uses Attestcoin Protocol to verify a signal from another chain, then makes an explainable lending decision on Creditcoin.</p>
        <div className="hero-actions"><a className="primary-button" href="#verify">Try ProofLend <span aria-hidden="true">↓</span></a><a className="text-button" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a></div>
        {wallet.status === 'connected' && <p className="connection-note" role="status">Rabby connected. Transactions always require your approval.</p>}{wallet.status === 'error' && <p className="connection-error" role="alert">{wallet.error}</p>}{networkError && <p className="connection-error" role="alert">{networkError}</p>}
      </section>
      <section className="decision-card" id="verify" aria-label="Eligibility verification">
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
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-intro">
            <a className="brand footer-brand" href="#top" aria-label="ProofLend home"><span className="brand-mark">P</span>ProofLend</a>
            <p>Portable proof for fairer on-chain lending decisions.</p>
            <span className="footer-live"><span aria-hidden="true" />Live on testnet</span>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <div>
              <p>Explore</p>
              <a href="#how-it-works">How it works</a>
              <a href="https://github.com/Elvino03/prooflend" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
              <a href="https://dorahacks.io/hackathon/buidl-ctc-2026-fall/detail" target="_blank" rel="noreferrer">BUIDL CTC <span aria-hidden="true">↗</span></a>
            </div>
            <div>
              <p>Verified demo</p>
              <a href="https://sepolia.etherscan.io/tx/0xd5ba4fa9041a7de72bcbee6ca12ef32c8e188c4ef828564469989a69ad820345" target="_blank" rel="noreferrer">Sepolia request <span aria-hidden="true">↗</span></a>
              <a href="https://creditcoin-testnet.blockscout.com/tx/0xdec3d335a1d178fa92e05af5818b607669fa8d9de0c1b4fc6d6e2626e5a13096" target="_blank" rel="noreferrer">Creditcoin proof <span aria-hidden="true">↗</span></a>
            </div>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>Built solo for BUIDL CTC 2026</p>
          <p>Testnet only <span aria-hidden="true">·</span> Never share your seed phrase</p>
        </div>
      </footer>
    </main>
  )
}

export default App
