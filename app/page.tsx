'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Shield, Cpu, Users, Upload, ExternalLink } from 'lucide-react'
import { ProjectCard } from '@/components/ProjectCard'
import type { Project } from '@/types'

function AIScanner() {
  const [lines, setLines] = useState<{text:string;color:string;tx?:string;bold?:boolean}[]>([])
  const [cursor, setCursor] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  const STEPS = [
    { text: '$ genscout-eval --network studionet', color: 'var(--text-3)', delay: 0 },
    { text: '> Connecting to GenLayer validators...', color: 'var(--text-2)', delay: 700 },
    { text: '> Scanning website for phishing... OK', color: '#22C55E', delay: 1400 },
    { text: '> Checking wallet safety... OK', color: '#22C55E', delay: 2100 },
    { text: '> Detecting obfuscated scripts... OK', color: '#22C55E', delay: 2800 },
    { text: '> GitHub repository... NOT FOUND [-10]', color: '#D97706', delay: 3500 },
    { text: '> Documentation... NOT FOUND [-5]', color: '#D97706', delay: 4200 },
    { text: '> Twitter: ✓  Telegram: ✗ [-3]  Discord: ✗ [-3]', color: '#D97706', delay: 4900 },
    { text: '> Sending raw signals to AI consensus...', color: '#3B82F6', delay: 5600 },
    { text: 'TX: 0x2AFe...8c23 → GenLayer Explorer ↗', color: '#3B82F6', tx: 'https://studio.genlayer.com/transactions', delay: 6300 },
    { text: '> Validator 1: score=76, risk=Low ✓', color: '#22C55E', delay: 7400 },
    { text: '> Validator 2: score=76, risk=Low ✓', color: '#22C55E', delay: 8100 },
    { text: '> Validator 3: score=76, risk=Low ✓', color: '#22C55E', delay: 8800 },
    { text: '> Consensus reached. Final score: 76/100', color: '#22C55E', delay: 9500, bold: true },
    { text: '✓ Verified on GenLayer network.', color: '#22C55E', delay: 10200, bold: true },
  ]

  useEffect(() => {
    let timers: NodeJS.Timeout[] = []
    function run() {
      setLines([])
      STEPS.forEach((s, i) => {
        timers.push(setTimeout(() => {
          setLines(prev => [...prev, s])
          if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
        }, s.delay))
      })
      timers.push(setTimeout(run, 13000))
    }
    run()
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setCursor(c => !c), 530)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ background: '#111', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#0A0A09', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EAB308' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E' }} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>genscout — ai-evaluator</span>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', animation: 'pulse 2s infinite' }} />
      </div>
      <div ref={ref} style={{ height: 230, overflowY: 'auto', padding: '12px 14px', scrollbarWidth: 'none' }}>
        {lines.map((line, i) =>
          line.tx ? (
            <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, marginBottom: 2 }}>
              <a href={line.tx} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                style={{ color: '#3B82F6', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {line.text} <ExternalLink size={10} />
              </a>
            </div>
          ) : (
            <div key={i} style={{ color: line.color, fontWeight: line.bold ? 700 : 400, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, marginBottom: 2 }}>
              {line.text}
            </div>
          )
        )}
        {lines.length > 0 && lines.length < STEPS.length && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#22C55E', opacity: cursor ? 1 : 0 }}>█</span>
        )}
      </div>
    </div>
  )
}

export default function HomePage() {
  const [projects,    setProjects]    = useState<Project[]>([])
  const [totalCount,  setTotalCount]  = useState(0)
  const [scoredCount, setScoredCount] = useState(0)
  const [loading,     setLoading]     = useState(true)

  const loadProjects = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects?sort=views&limit=50&t=${Date.now()}`, {
        cache: 'no-store', headers: { 'Cache-Control': 'no-cache, no-store' },
      })
      const d = await r.json()
      const all: Project[] = d.projects ?? []
      setTotalCount(all.length)
      setScoredCount(all.filter(p => p.ai_score).length)
      setProjects(all.slice(0, 4))
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProjects()
    const id = setInterval(loadProjects, 20000)
    return () => clearInterval(id)
  }, [loadProjects])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 80px' }}>

      {/* ── HERO ── uses className for theme-aware bg */}
      <section className="hero-section hero-grid" style={{
        marginTop: 20, marginBottom: 28,
        borderRadius: 20, overflow: 'hidden',
        border: '1px solid var(--border)',
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        minHeight: 340,
      }}>
        <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ fontWeight: 900, fontSize: 'clamp(26px, 3.5vw, 48px)', letterSpacing: '-0.04em', lineHeight: 1.05, color: 'var(--text-1)', marginBottom: 16 }}>
            Discover Trusted<br />Projects on<br />
            <span style={{ color: 'var(--brand)' }}>GenLayer</span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.78, maxWidth: 380, marginBottom: 28 }}>
            GenScout combines AI-powered evaluation, backend security scanning, and community validation to help you discover and trust the best Web3 projects.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 20px', background: 'var(--text-1)', color: 'var(--bg)', fontWeight: 700, fontSize: 13, textDecoration: 'none', borderRadius: 10 }}>
              Explore Projects <ArrowRight size={14} />
            </Link>
            <Link href="/submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 20px', background: 'transparent', color: 'var(--text-1)', border: '1.5px solid var(--border-hi)', fontWeight: 600, fontSize: 13, textDecoration: 'none', borderRadius: 10 }}>
              Submit Your Project
            </Link>
          </div>
        </div>

        <div className="hero-pills" style={{ padding: '36px 36px 36px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          {[
            { icon: Shield, label: 'AI Security Scanning',  sub: 'Phishing, scripts, wallet safety',  bg: 'rgba(22,163,74,0.12)',  ic: '#16A34A' },
            { icon: Cpu,    label: 'GenLayer AI Consensus',  sub: 'On-chain validator scoring',        bg: 'rgba(37,99,235,0.12)',  ic: '#2563EB' },
            { icon: Users,  label: 'Community Validation',   sub: 'Real users vote and review',        bg: 'rgba(232,99,10,0.12)',  ic: '#E8630A' },
          ].map(({ icon: Icon, label, sub, bg, ic }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={20} color={ic} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRENDING ── */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', margin: 0 }}>Trending Projects</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Most viewed — live data</p>
          </div>
          <Link href="/explore" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>
            View all <ArrowRight size={13} />
          </Link>
        </div>
        {!loading && projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-secondary)', borderRadius: 14 }}>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 14 }}>No projects yet. Be the first!</p>
            <Link href="/submit" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', borderRadius: 8 }}>
              Submit a project <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="proj-grid-home" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {projects.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 20 }}>How GenScout Works</h2>
        <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { n: '1', icon: Upload, title: 'Submission',              c: '#22C55E', bg: 'rgba(34,197,94,0.1)',  desc: 'Project owners submit their projects to GenScout.' },
            { n: '2', icon: Shield, title: 'Backend Scanning',        c: '#EAB308', bg: 'rgba(234,179,8,0.1)',  desc: 'Automated scans detect risks, phishing, and vulnerabilities.' },
            { n: '3', icon: Cpu,    title: 'GenLayer AI Evaluation',  c: '#7C3AED', bg: 'rgba(124,58,237,0.1)', desc: 'GenLayer consensus evaluates across multiple dimensions.' },
            { n: '4', icon: Users,  title: 'Community Feedback',      c: '#22C55E', bg: 'rgba(34,197,94,0.1)',  desc: 'Community reviews improve trust over time.' },
          ].map(({ n, icon: Icon, title, c, bg, desc }) => (
            <div key={n} style={{ padding: '22px 16px', background: 'var(--bg-secondary)', borderRadius: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: c }}>{n}</span>
              </div>
              <Icon size={24} color={c} style={{ marginBottom: 12, display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY GENSCOUT + AI SCANNER ── */}
      <section className="why-ai-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: '28px' }}>
          <h3 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 10 }}>Why GenScout?</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.78, marginBottom: 20 }}>
            GenScout ensures transparency, security, and community trust so you can discover and support the best Web3 projects with confidence.
          </p>
          <Link href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', borderRadius: 8 }}>
            Explore Projects <ArrowRight size={13} />
          </Link>
        </div>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 8 }}>Live AI Evaluation</h3>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14 }}>
            Exactly what happens on every submission — scanner sends raw signals to GenLayer validators, consensus is reached on-chain.
          </p>
          <AIScanner />
        </div>
      </section>

      {/* ── CTA ── uses className for theme-aware colors */}
      <section>
        <div className="cta-section" style={{ borderRadius: 16, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h2 className="cta-title" style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', marginBottom: 6 }}>Have a project to share?</h2>
            <p className="cta-sub" style={{ fontSize: 14, lineHeight: 1.6 }}>Free AI evaluation. Runs automatically on GenLayer consensus.</p>
          </div>
          <Link href="/submit" className="cta-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', fontWeight: 700, fontSize: 14, textDecoration: 'none', borderRadius: 10, whiteSpace: 'nowrap' }}>
            Submit Your Project <ArrowRight size={15} />
          </Link>
        </div>
      </section>

    </div>
  )
}
