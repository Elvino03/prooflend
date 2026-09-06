const fs = require('fs')
const path = require('path')
const solc = require('solc')

const contractFiles = [
  'contracts/src/ProofLendSignal.sol',
  'contracts/src/ProofLendEligibility.sol',
]

const sources = Object.fromEntries(
  contractFiles.map((file) => [file, { content: fs.readFileSync(file, 'utf8') }]),
)

function findImports(importPath) {
  for (const base of ['.', 'node_modules']) {
    const candidate = path.join(base, importPath)
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, 'utf8') }
    }
  }
  return { error: `Import not found: ${importPath}` }
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: 'shanghai',
    libraries: {
      '@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol': {
        EvmV1Decoder: '0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f',
      },
    },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }))
for (const issue of output.errors ?? []) console.log(issue.formattedMessage)

if ((output.errors ?? []).some((issue) => issue.severity === 'error')) process.exit(1)

const compiledContracts = Object.entries(output.contracts)
  .flatMap(([file, contracts]) => Object.keys(contracts).map((contract) => `${file}:${contract}`))

const artifacts = {
  signal: output.contracts['contracts/src/ProofLendSignal.sol'].ProofLendSignal,
  eligibility: output.contracts['contracts/src/ProofLendEligibility.sol'].ProofLendEligibility,
}

const browserArtifacts = Object.fromEntries(
  Object.entries(artifacts).map(([name, artifact]) => [name, {
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
  }]),
)

for (const [name, artifact] of Object.entries(browserArtifacts)) {
  if (!/^0x[0-9a-fA-F]+$/.test(artifact.bytecode)) {
    throw new Error(`${name} contains unresolved or malformed deployment bytecode`)
  }
}

fs.mkdirSync('src/generated', { recursive: true })
fs.writeFileSync('src/generated/contracts.json', `${JSON.stringify(browserArtifacts, null, 2)}\n`)

console.log(`Solidity compilation succeeded: ${compiledContracts.join(', ')}`)
console.log('Browser deployment artifacts written to src/generated/contracts.json')
