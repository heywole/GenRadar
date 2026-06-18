#!/usr/bin/env node
// ================================================================
// scripts/deploy-contract.js
//
// Deploys contracts/project_evaluator.py to whichever GenLayer network
// GENLAYER_NETWORK in .env.local points to (defaults to studionet —
// must match whatever GENLAYER_NETWORK is set to in your live Vercel
// deployment, or the app will be calling a contract address that
// doesn't exist on the network it's actually talking to).
//
// Usage: npm run contract:deploy
//
// What you need first:
//   1. A wallet private key in .env.local as GENLAYER_PRIVATE_KEY
//   2. Testnet GEN tokens for whatever network you're deploying to
//      (https://studio.genlayer.com → Faucet tab for studionet)
//   3. npm install already run (genlayer-js must be installed)
// ================================================================

const path = require('path')
const fs   = require('fs')

// Load .env.local manually
const envPath = path.join(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
}

// Same alias map as lib/genlayerAI.ts — keep these in sync. genlayer-js
// 1.x exports: localnet, studionet, testnetAsimov, testnetBradbury.
// A plain "testnet" export does NOT exist — using it here used to
// silently fall back to localnet (127.0.0.1), which is only reachable
// from your own machine, never from a deployed site.
const NETWORK_ALIASES = {
  studionet:          'studionet',
  localnet:           'localnet',
  testnet:            'testnetBradbury',
  'testnet-asimov':   'testnetAsimov',
  testnetasimov:      'testnetAsimov',
  'testnet-bradbury': 'testnetBradbury',
  testnetbradbury:    'testnetBradbury',
}

function resolveNetworkKey() {
  return (process.env.GENLAYER_NETWORK || 'studionet').trim().toLowerCase()
}

async function deploy() {
  const privateKeyRaw = process.env.GENLAYER_PRIVATE_KEY

  if (!privateKeyRaw) {
    console.error('\n❌ GENLAYER_PRIVATE_KEY is not set in .env.local\n')
    console.log('  Add it like this:')
    console.log('  GENLAYER_PRIVATE_KEY=0x_your_wallet_private_key\n')
    console.log('  You can get a wallet from MetaMask, then export the private key.\n')
    process.exit(1)
  }

  const contractPath = path.join(__dirname, '../contracts/project_evaluator.py')
  if (!fs.existsSync(contractPath)) {
    console.error(`\n❌ Contract file not found: ${contractPath}\n`)
    process.exit(1)
  }

  const privateKey = privateKeyRaw.startsWith('0x')
    ? privateKeyRaw
    : `0x${privateKeyRaw}`

  const networkKey = resolveNetworkKey()
  const chains      = require('genlayer-js/chains')
  const exportName  = NETWORK_ALIASES[networkKey]
  const chain        = exportName ? chains[exportName] : undefined

  if (!chain) {
    console.error(`\n❌ Unknown GENLAYER_NETWORK "${process.env.GENLAYER_NETWORK}".`)
    console.error(`   Valid values: studionet, testnet-asimov, testnet-bradbury, localnet.\n`)
    process.exit(1)
  }

  console.log(`\n🚀 Deploying ProjectEvaluator to GenLayer (${networkKey})...\n`)
  console.log('   Contract: contracts/project_evaluator.py')
  console.log(`   Network:  ${exportName}\n`)

  try {
    const { createClient, createAccount } = require('genlayer-js')
    const contractCode = fs.readFileSync(contractPath, 'utf8')

    const account = createAccount(privateKey)
    const client  = createClient({ chain, account })

    console.log('📡 Sending deployment transaction...')

    const txHash = await client.deployContract({
      code:            contractCode,
      args:            [],
      leaderOnly:      false,
    })

    console.log(`✅ Transaction sent: ${txHash}`)
    console.log('⏳ Waiting for deployment to finalize (may take 1–3 minutes)...\n')

    const { TransactionStatus } = require('genlayer-js/types')
    const receipt = await client.waitForTransactionReceipt({
      hash:     txHash,
      status:   TransactionStatus.FINALIZED,
      retries:  120,
      interval: 3000,
    })

    if (!receipt) {
      throw new Error('Deployment timed out — transaction never finalized')
    }

    const contractAddress = receipt.contractAddress || receipt.data?.contractAddress

    if (!contractAddress) {
      console.error('❌ Could not extract contract address from receipt:')
      console.error(JSON.stringify(receipt, null, 2))
      process.exit(1)
    }

    console.log('\n✅ Contract deployed successfully!\n')
    console.log(`📋 Contract Address: ${contractAddress}\n`)

    // Auto-write the new address to .env.local. We deliberately do NOT
    // touch GENLAYER_NETWORK here — it stays whatever you already have it
    // set to, since that's what decides which network this just deployed to.
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''

    if (envContent.includes('GENLAYER_CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(
        /GENLAYER_CONTRACT_ADDRESS=.*/g,
        `GENLAYER_CONTRACT_ADDRESS=${contractAddress}`
      )
    } else {
      envContent += `\nGENLAYER_CONTRACT_ADDRESS=${contractAddress}\n`
    }

    fs.writeFileSync(envPath, envContent)
    console.log('✅ GENLAYER_CONTRACT_ADDRESS saved to .env.local automatically\n')
    console.log('⚠️  IMPORTANT: also update GENLAYER_CONTRACT_ADDRESS in your Vercel project')
    console.log('   (Settings → Environment Variables, Production) — .env.local only')
    console.log('   affects your own machine, not the live site.\n')
    console.log('👉 Now restart your dev server:  npm run dev\n')

  } catch (err) {
    console.error('\n❌ Deployment failed:\n')
    console.error(err.message || err)
    console.log('\n── Troubleshooting ──────────────────────────────────────')
    console.log('  1. Make sure you have testnet GEN tokens for this network')
    console.log('     → https://studio.genlayer.com → Faucet tab')
    console.log('  2. Make sure GENLAYER_PRIVATE_KEY starts with 0x')
    console.log('  3. Make sure you ran "npm install" first')
    console.log('  4. Check network status: https://docs.genlayer.com/developers/networks')
    console.log('─────────────────────────────────────────────────────────\n')
    process.exit(1)
  }
}

deploy()
