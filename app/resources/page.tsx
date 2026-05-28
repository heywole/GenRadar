'use client'

import {
  BookOpen, Code2, Zap, Users, ExternalLink,
  TestTube, Gift, Terminal, Globe, Shield,
  Cpu, FlaskConical, Rocket, FileCode2,
  ChevronDown, ChevronUp, Star,
} from 'lucide-react'
import { useState } from 'react'

// ── Step-by-step guide ────────────────────────────────────────
const BUILD_STEPS = [
  {
    n: '01', color: '#3B82F6',
    title: 'Understand GenLayer',
    desc: 'GenLayer is the world\'s first blockchain with Intelligent Contracts — AI-powered smart contracts written in Python that can read the web in real time, call LLMs (like GPT-4 or Llama), and reach consensus across multiple AI validators. Unlike Solidity contracts, they handle ambiguous, real-world logic.',
    links: [
      { label: 'What is GenLayer?', url: 'https://docs.genlayer.com/understand-genlayer-protocol/what-is-genlayer' },
      { label: 'What are Intelligent Contracts?', url: 'https://docs.genlayer.com/understand-genlayer-protocol/what-are-intelligent-contracts' },
      { label: 'How Optimistic Democracy works', url: 'https://docs.genlayer.com/understand-genlayer-protocol/optimistic-democracy-how-genlayer-works' },
      { label: 'Use cases & ideas', url: 'https://docs.genlayer.com/developers/intelligent-contracts/ideas' },
    ],
  },
  {
    n: '02', color: '#22C55E',
    title: 'Set Up Your Development Environment',
    desc: 'You write Intelligent Contracts in Python. Install the GenLayer CLI, connect to studionet (the live testnet), and get your wallet funded via the faucet. You can also use GenLayer Studio in the browser — no setup needed — to write and test contracts instantly.',
    links: [
      { label: 'Development setup guide', url: 'https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup' },
      { label: 'GenLayer Studio (browser IDE + faucet)', url: 'https://studio.genlayer.com' },
      { label: 'Networks & RPC endpoints', url: 'https://docs.genlayer.com/developers/networks' },
      { label: 'GenLayer CLI reference', url: 'https://docs.genlayer.com/api-references/genlayer-cli' },
    ],
  },
  {
    n: '03', color: '#F59E0B',
    title: 'Write Your First Contract',
    desc: 'Intelligent Contracts are Python classes that extend `gl.Contract`. Use `@gl.public.view` for read methods and `@gl.public.write` for state-changing ones. Put all non-deterministic logic (LLM calls, web fetches) inside a `nondet` block — this is how GenLayer handles AI consensus safely.',
    links: [
      { label: 'Your first contract (basic storage)', url: 'https://docs.genlayer.com/developers/intelligent-contracts/first-contract' },
      { label: 'Your first Intelligent Contract (with LLM)', url: 'https://docs.genlayer.com/developers/intelligent-contracts/first-intelligent-contract' },
      { label: 'Introduction to Intelligent Contracts', url: 'https://docs.genlayer.com/developers/intelligent-contracts/introduction' },
      { label: 'Example: LLM Hello World', url: 'https://docs.genlayer.com/developers/intelligent-contracts/examples/llm-hello-world' },
      { label: 'Example: Fetch web content', url: 'https://docs.genlayer.com/developers/intelligent-contracts/examples/fetch-web-content' },
    ],
  },
  {
    n: '04', color: '#8B5CF6',
    title: 'Use AI & Web Features',
    desc: 'Call any LLM (GPT-4o, Claude, Llama 3) directly from your contract. Fetch live data from any URL or API. Use the Equivalence Principle — GenLayer\'s consensus checks whether all validator outputs are "equivalent enough", not byte-identical. This lets your contracts reason about real-world data.',
    links: [
      { label: 'Calling LLMs from contracts', url: 'https://docs.genlayer.com/developers/intelligent-contracts/features/calling-llms' },
      { label: 'Web access in contracts', url: 'https://docs.genlayer.com/developers/intelligent-contracts/features/web-access' },
      { label: 'The Equivalence Principle', url: 'https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle' },
      { label: 'Non-determinism handling', url: 'https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism' },
      { label: 'Prompt & data techniques', url: 'https://docs.genlayer.com/developers/intelligent-contracts/crafting-prompts' },
    ],
  },
  {
    n: '05', color: '#EC4899',
    title: 'Test Your Contract',
    desc: 'Use the GenLayer test framework (`genlayer test`) to write unit tests for your contracts locally. Test both deterministic logic and LLM-powered flows. The Studio also has a built-in simulator that replicates the validator consensus environment so you can see exactly how your contract behaves on-chain.',
    links: [
      { label: 'Testing guide', url: 'https://docs.genlayer.com/developers/intelligent-contracts/testing' },
      { label: 'GenLayer Test API reference', url: 'https://docs.genlayer.com/api-references/genlayer-test' },
      { label: 'Debugging contracts', url: 'https://docs.genlayer.com/developers/intelligent-contracts/debugging' },
      { label: 'Security: prompt injection prevention', url: 'https://docs.genlayer.com/developers/intelligent-contracts/security-and-best-practices/prompt-injection' },
    ],
  },
  {
    n: '06', color: '#14B8A6',
    title: 'Deploy to Studionet',
    desc: 'Deploy using the CLI (`genlayer deploy`), a deploy script in JavaScript/TypeScript via genlayer-js, or directly from the Studio UI. Point to the studionet RPC endpoint. After deployment you get a contract address — use it to read state and write transactions from your frontend via genlayer-js.',
    links: [
      { label: 'Deploying contracts overview', url: 'https://docs.genlayer.com/developers/intelligent-contracts/deploying' },
      { label: 'CLI deployment', url: 'https://docs.genlayer.com/developers/intelligent-contracts/deploying/cli-deployment' },
      { label: 'Deploy scripts (JS/TS)', url: 'https://docs.genlayer.com/developers/intelligent-contracts/deploying/deploy-scripts' },
      { label: 'Network configuration', url: 'https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration' },
    ],
  },
  {
    n: '07', color: '#F97316',
    title: 'Build Your Frontend (DApp)',
    desc: 'Connect your UI to GenLayer using `genlayer-js`. Use `createClient` with the studionet chain. Call `readContract` for queries (free, instant) and `writeContract` to send transactions. Poll for transaction receipts to track on-chain execution. Works with React, Next.js, Vue — any JS framework.',
    links: [
      { label: 'DApp development workflow', url: 'https://docs.genlayer.com/developers/dapp-development-workflow' },
      { label: 'genlayer-js SDK', url: 'https://docs.genlayer.com/api-references/genLayerjs' },
      { label: 'Reading from contracts', url: 'https://docs.genlayer.com/developers/genlayerjs/reading-data-from-intelligent-contracts' },
      { label: 'Writing to contracts', url: 'https://docs.genlayer.com/developers/genlayerjs/writing-data-to-intelligent-contracts' },
      { label: 'Querying transactions', url: 'https://docs.genlayer.com/developers/genlayerjs/querying-a-transaction' },
    ],
  },
  {
    n: '08', color: '#6366F1',
    title: 'Submit to GenScout & Earn Rewards',
    desc: 'Once your project is live, submit it to GenScout to get an AI trust score evaluated on-chain by GenLayer validators. Then apply to the Builder Program via the GenLayer Portal to earn rewards for shipping real projects on the ecosystem. Early builders get priority access to grants and recognition.',
    links: [
      { label: 'Submit your project to GenScout', url: '/submit' },
      { label: 'GenLayer Builder Portal', url: 'https://portal.genlayer.foundation/#/builders/resources' },
      { label: 'Ecosystem & grants', url: 'https://www.genlayer.com/ecosystem' },
      { label: 'Community (Discord, X, Telegram)', url: 'https://www.genlayer.com/ecosystem#community' },
    ],
  },
]

// ── Quick-access resource cards ───────────────────────────────
const QUICK = [
  {
    icon: BookOpen, color: '#3B82F6',
    name: 'Official Docs',
    desc: 'Full technical documentation — protocol, contracts, SDK, CLI, and API references.',
    url: 'https://docs.genlayer.com',
    label: 'docs.genlayer.com',
  },
  {
    icon: TestTube, color: '#22C55E',
    name: 'GenLayer Studio',
    desc: 'Browser-based IDE. Write, simulate, deploy, and get testnet tokens — no setup needed.',
    url: 'https://studio.genlayer.com',
    label: 'studio.genlayer.com',
  },
  {
    icon: Terminal, color: '#F59E0B',
    name: 'GenLayer CLI',
    desc: 'Command-line tool for deploying contracts, running tests, and managing your project.',
    url: 'https://docs.genlayer.com/api-references/genlayer-cli',
    label: 'CLI Reference',
  },
  {
    icon: Code2, color: '#8B5CF6',
    name: 'genlayer-js SDK',
    desc: 'JavaScript/TypeScript library for connecting your frontend to GenLayer contracts.',
    url: 'https://docs.genlayer.com/api-references/genLayerjs',
    label: 'JS SDK Reference',
  },
  {
    icon: FileCode2, color: '#EC4899',
    name: 'GitHub',
    desc: 'Source code, example contracts, boilerplates, and developer tooling from GenLayer Labs.',
    url: 'https://github.com/genlayerlabs',
    label: 'github.com/genlayerlabs',
  },
  {
    icon: Globe, color: '#14B8A6',
    name: 'Studionet Explorer',
    desc: 'View live transactions, contract deployments, and validator consensus results on studionet.',
    url: 'https://explorer-studio.genlayer.com',
    label: 'explorer-studio.genlayer.com',
  },
  {
    icon: Users, color: '#F97316',
    name: 'Community',
    desc: 'Join Discord, Telegram, and X. Get dev support, share your project, and meet other builders.',
    url: 'https://www.genlayer.com/ecosystem#community',
    label: 'genlayer.com/ecosystem',
  },
  {
    icon: Gift, color: '#6366F1',
    name: 'Builder Portal',
    desc: 'Apply to the incentivized builder program. Earn rewards for shipping on GenLayer early.',
    url: 'https://portal.genlayer.foundation/#/builders/resources',
    label: 'portal.genlayer.foundation',
  },
  {
    icon: Cpu, color: '#0EA5E9',
    name: 'GenLayer Skills',
    desc: 'Pre-built AI skills you can plug into your Intelligent Contracts — oracles, evaluators, and more.',
    url: 'https://skills.genlayer.com',
    label: 'skills.genlayer.com',
  },
  {
    icon: FlaskConical, color: '#A855F7',
    name: 'GenLayer Blog',
    desc: 'Product updates, deep dives into the protocol, and tutorials for builders.',
    url: 'https://blog.genlayer.com',
    label: 'blog.genlayer.com',
  },
  {
    icon: Shield, color: '#10B981',
    name: 'Whitepaper',
    desc: 'Technical whitepaper covering the protocol architecture, consensus, and economic model.',
    url: 'https://www.genlayer.com/whitepaper',
    label: 'genlayer.com/whitepaper',
  },
  {
    icon: Star, color: '#F59E0B',
    name: 'Project Boilerplate',
    desc: 'Starter templates for DApps on GenLayer — includes contract, deploy script, and frontend.',
    url: 'https://docs.genlayer.com/developers/project-boilerplate',
    label: 'Project Boilerplate',
  },
]

function StepCard({ step, open, toggle }: { step: typeof BUILD_STEPS[0]; open: boolean; toggle: () => void }) {
  return (
    <div style={{
      border: `1px solid ${open ? step.color + '50' : 'var(--border)'}`,
      borderRadius: 12,
      background: open ? `${step.color}08` : 'var(--bg-card)',
      overflow: 'hidden',
      transition: 'all 0.15s',
    }}>
      <button onClick={toggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 16,
        padding: '18px 20px', background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `${step.color}18`, border: `1px solid ${step.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, color: step.color, fontFamily: 'var(--font-mono)',
        }}>
          {step.n}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', margin: 0 }}>{step.title}</p>
        </div>
        {open
          ? <ChevronUp size={16} color="var(--text-3)" />
          : <ChevronDown size={16} color="var(--text-3)" />
        }
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px 76px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75, marginBottom: 14 }}>
            {step.desc}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {step.links.map(l => (
              <a key={l.url} href={l.url}
                target={l.url.startsWith('/') ? '_self' : '_blank'}
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: step.color, textDecoration: 'none',
                  fontFamily: 'var(--font-mono)',
                }}>
                <ExternalLink size={10} /> {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResourcesPage() {
  const [openStep, setOpenStep] = useState<number | null>(0)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand)', marginBottom: 8 }}>
          Resources
        </p>
        <h1 style={{ fontWeight: 900, fontSize: 36, letterSpacing: '-0.03em', color: 'var(--text-1)', marginBottom: 12 }}>
          Build on GenLayer
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 560, lineHeight: 1.75 }}>
          Everything you need to go from zero to a live Intelligent Contract on GenLayer —
          step by step. GenLayer lets you write AI-powered smart contracts in Python that
          read the web, call LLMs, and reach consensus on-chain.
        </p>
      </div>

      {/* Step-by-step guide */}
      <div style={{ marginBottom: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Rocket size={16} color="var(--brand)" />
          <h2 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', margin: 0 }}>
            Step-by-Step: How to Build on GenLayer
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.65 }}>
          Follow these 8 steps from understanding the protocol all the way to submitting your project and earning builder rewards. Click any step to expand it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BUILD_STEPS.map((step, i) => (
            <StepCard
              key={step.n}
              step={step}
              open={openStep === i}
              toggle={() => setOpenStep(openStep === i ? null : i)}
            />
          ))}
        </div>
      </div>

      {/* Quick access cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Zap size={16} color="var(--brand)" />
          <h2 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', margin: 0 }}>
            Quick Access
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
          All the key links in one place.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {QUICK.map(({ icon: Icon, color, name, desc, url, label }) => (
            <a key={name} href={url}
              target={url.startsWith('/') ? '_self' : '_blank'}
              rel="noopener noreferrer"
              style={{
                display: 'flex', flexDirection: 'column',
                padding: '18px 20px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                textDecoration: 'none',
                transition: 'border-color .15s, transform .15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border-hi)'
                el.style.transform   = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border)'
                el.style.transform   = 'translateY(0)'
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${color}18`, border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, marginBottom: 12,
              }}>
                <Icon size={18} />
              </div>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 6 }}>
                {name}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, flex: 1 }}>
                {desc}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 11, color, fontFamily: 'var(--font-mono)' }}>
                <ExternalLink size={10} /> {label}
              </div>
            </a>
          ))}
        </div>
      </div>

    </div>
  )
}
