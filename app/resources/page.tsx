'use client'

import { BookOpen, Code2, Zap, Users, ExternalLink, TestTube, Gift } from 'lucide-react'

const RESOURCES = [
  {
    icon: BookOpen, color: '#3B82F6',
    name: 'Documentation',
    desc: 'Official GenLayer technical docs, API references, architecture guides, and integration tutorials.',
    url:  'https://docs.genlayer.com',
    label: 'docs.genlayer.com',
  },
  {
    icon: Zap, color: '#22C55E',
    name: 'AI Skills Guide',
    desc: 'Learn how to write, deploy, and integrate GenLayer AI Skills (Intelligent Contracts) into your applications.',
    url:  'https://docs.genlayer.com/developers/intelligent-contracts/introduction',
    label: 'docs.genlayer.com/intelligent-contracts',
  },
  {
    icon: TestTube, color: '#F59E0B',
    name: 'GenLayer Studio + Faucet',
    desc: 'Get testnet tokens, deploy contracts, and test your GenLayer projects in the browser-based studio.',
    url:  'https://studio.genlayer.com',
    label: 'studio.genlayer.com',
  },
  {
    icon: Code2, color: '#8B5CF6',
    name: 'Developer Tools',
    desc: 'SDKs, CLIs, testing frameworks, and local development environments for GenLayer builders.',
    url:  'https://github.com/genlayerlabs',
    label: 'github.com/genlayerlabs',
  },
  {
    icon: Users, color: '#EC4899',
    name: 'Community',
    desc: 'Join the Discord, follow on X, and connect with other GenLayer builders, validators, and contributors.',
    url:  'https://www.genlayer.com/ecosystem#community',
    label: 'genlayer.com/ecosystem',
  },
  {
    icon: Gift, color: '#14B8A6',
    name: 'Ecosystem & Grants',
    desc: 'Explore the GenLayer ecosystem, apply for funding, and discover opportunities for early builders.',
    url:  'https://www.genlayer.com/ecosystem',
    label: 'genlayer.com/ecosystem',
  },
]

export default function ResourcesPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>

      <div style={{ marginBottom: 44 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 36, color: 'var(--text-1)', marginBottom: 10,
        }}>
          Resources
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-2)', maxWidth: 500, lineHeight: 1.7 }}>
          Everything you need to build, evaluate, and participate in the GenLayer ecosystem.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 14,
      }}>
        {RESOURCES.map(({ icon: Icon, color, name, desc, url, label }) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column',
              padding: '22px',
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
              width: 44, height: 44, borderRadius: 10,
              background: `${color}18`,
              border: `1px solid ${color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color, marginBottom: 14,
            }}>
              <Icon size={20}/>
            </div>

            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 15, color: 'var(--text-1)', marginBottom: 7,
            }}>
              {name}
            </p>

            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, flex: 1 }}>
              {desc}
            </p>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              marginTop: 16, fontSize: 12, color,
            }}>
              <ExternalLink size={11}/> {label}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
