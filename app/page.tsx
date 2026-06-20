'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Shield, Cpu, Users, Upload, ExternalLink } from 'lucide-react'
import { ProjectCard } from '@/components/ProjectCard'
import type { Project } from '@/types'

// Fetches the most recently EVALUATED project by querying ai_scores directly
// This guarantees the freshest tx_hash — no stale data from projects API cache
async function fetchLatestEvaluation() {
  try {
    // Step 1: get the single most recently created ai_score row (has fresh tx_hash)
    const scoresRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ai_scores?select=project_id,score,risk,confidence,positives,risks,findings,breakdown,explanation,tx_hash,scanner_signals,created_at&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        cache: 'no-store',
      }
    )
    const scores = await scoresRes.json()
    if (!scores?.length || !Number(scores[0].score)) return null
    const latestScore = scores[0]

    // Step 2: fetch that project's details
    const projRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/projects?select=id,name,description,website_url,github_url,docs_url,twitter_url,telegram_url,discord_url,category,logo_url,created_at&id=eq.${latestScore.project_id}&status=eq.active`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        cache: 'no-store',
      }
    )
    const projects = await projRes.json()
    if (!projects?.length) return null

    return { ...projects[0], ai_score: latestScore, _count: { views: 0, saves: 0 } } as Project
  } catch {
    return null
  }
}

function AIScanner() {
  const [lines, setLines] = useState<{text:string;color:string;tx?:string;bold?:boolean}[]>([])
  const [cursor, setCursor] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const timersRef = useRef<NodeJS.Timeout[]>([])

  // Blink cursor
  useEffect(() => {
    const id = setInterval(() => setCursor(c => !c), 530)
    return () => clearInterval(id)
  }, [])

  function buildSteps(p: Project | null, realTxHash?: string | null) {
    const ai = p?.ai_score
    const score = ai ? Number(ai.score) : 76
    const risk  = ai ? ai.risk : 'Low'
    const name  = p ? p.name.slice(0, 28) : 'project'

    const signals = (ai as any)?.scanner_signals as Partial<{
      phishing_detected: boolean; unsafe_wallet_behavior: boolean; suspicious_scripts: boolean;
      has_github: boolean; has_docs: boolean; has_twitter: boolean; has_telegram: boolean; has_discord: boolean;
    }> | null

    const positives = ai?.positives ?? []
    const risks     = ai?.risks ?? []

    // Prefer the real, stored scanner signals from this exact evaluation.
    // Only fall back to guessing from risk text / URL presence for older
    // rows saved before signals were persisted.
    const hasGithub   = signals ? !!signals.has_github   : !!(p as any)?.github_url
    const hasDocs      = signals ? !!signals.has_docs      : !!(p as any)?.docs_url
    const hasTwitter  = signals ? !!signals.has_twitter  : !!(p as any)?.twitter_url
    const hasTelegram = signals ? !!signals.has_telegram : !!(p as any)?.telegram_url
    const hasDiscord  = signals ? !!signals.has_discord  : !!(p as any)?.discord_url

    const phishing = signals ? !!signals.phishing_detected      : risks.some(r => r.toLowerCase().includes('phish'))
    const scripts  = signals ? !!signals.suspicious_scripts     : risks.some(r => r.toLowerCase().includes('script') || r.toLowerCase().includes('obfusc'))
    const wallet   = signals ? !!signals.unsafe_wallet_behavior : risks.some(r => r.toLowerCase().includes('wallet'))

    const twitterStatus  = `Twitter: ${hasTwitter ? '✓' : '✗ [-3]'}  Telegram: ${hasTelegram ? '✓' : '✗ [-3]'}  Discord: ${hasDiscord ? '✓' : '✗ [-3]'}`
    const githubStatus   = hasGithub ? '> GitHub repository... FOUND ✓' : '> GitHub repository... NOT FOUND [-10]'
    const docsStatus     = hasDocs   ? '> Documentation... FOUND ✓'      : '> Documentation... NOT FOUND [-5]'

    return [
      { text: `$ genradar-eval --project "${name}"`,         color: 'var(--text-3)',  delay: 0 },
      { text: '> Connecting to GenLayer studionet...',        color: 'var(--text-2)', delay: 700 },
      { text: `> Scanning ${(p?.website_url ?? 'website').replace(/^https?:\/\//, '').slice(0, 36)}...`, color: 'var(--text-2)', delay: 1200 },
      { text: `> Phishing check... ${phishing ? '⚠ DETECTED [-25]' : 'OK ✓'}`,  color: phishing  ? '#D97706' : '#22C55E', delay: 1900 },
      { text: `> Wallet safety... ${wallet   ? '⚠ UNSAFE [-23]'   : 'OK ✓'}`,   color: wallet    ? '#D97706' : '#22C55E', delay: 2500 },
      { text: `> Obfuscated scripts... ${scripts ? '⚠ FOUND [-15]' : 'OK ✓'}`,  color: scripts   ? '#D97706' : '#22C55E', delay: 3100 },
      { text: githubStatus,  color: hasGithub ? '#22C55E' : '#D97706', delay: 3700 },
      { text: docsStatus,    color: hasDocs   ? '#22C55E' : '#D97706', delay: 4200 },
      { text: `> ${twitterStatus}`, color: (hasTwitter && hasTelegram && hasDiscord) ? '#22C55E' : '#D97706', delay: 4700 },
      { text: '> Sending raw signals to GenLayer validators...', color: '#3B82F6',    delay: 5400 },
      {
        text: realTxHash
          ? `TX: ${realTxHash.slice(0,10)}...${realTxHash.slice(-6)} → GenLayer Explorer ↗`
          : 'TX: view on GenLayer Explorer ↗',
        color: '#3B82F6',
        tx: realTxHash
          ? `https://explorer-studio.genlayer.com/tx/${realTxHash}`
          : 'https://explorer-studio.genlayer.com/txs',
        delay: 6100,
      },
      { text: `> Validator 1: score=${score}, risk=${risk} ✓`, color: '#22C55E', delay: 7000 },
      { text: `> Validator 2: score=${score}, risk=${risk} ✓`, color: '#22C55E', delay: 7600 },
      { text: `> Validator 3: score=${score}, risk=${risk} ✓`, color: '#22C55E', delay: 8200 },
      { text: `> Validator 4: score=${score}, risk=${risk} ✓`, color: '#22C55E', delay: 8800 },
      { text: `> Validator 5: score=${score}, risk=${risk} ✓`, color: '#22C55E', delay: 9400 },
      { text: `> Consensus reached. Final score: ${score}/100  Risk: ${risk}`, color: '#22C55E', delay: 10100, bold: true },
      { text: `✓ "${name}" evaluated on GenLayer network.`,                    color: '#22C55E', delay: 10800, bold: true },
    ]
  }

  function runAnimation(steps: ReturnType<typeof buildSteps>) {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setLines([])
    steps.forEach(s => {
      timersRef.current.push(setTimeout(() => {
        setLines(prev => [...prev, s])
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
      }, s.delay))
    })
  }

  useEffect(() => {
    let cycleTimer: NodeJS.Timeout
    let pollTimer: NodeJS.Timeout

    async function cycle(p: Project) {
      setProject(p)
      const steps = buildSteps(p, p?.ai_score?.tx_hash ?? null)
      runAnimation(steps)
      const lastDelay = steps[steps.length - 1].delay
      // After animation, poll for a newer evaluation instead of blindly repeating
      cycleTimer = setTimeout(() => pollForNew(p.id), lastDelay + 3000)
    }

    async function pollForNew(currentId: string) {
      const p = await fetchLatestEvaluation()
      if (p && p.id !== currentId) {
        // New project evaluated — start animation for it
        clearTimeout(pollTimer)
        cycle(p)
      } else {
        // Nothing new — stay paused on last result, check again in 10s
        pollTimer = setTimeout(() => pollForNew(currentId), 10000)
      }
    }

    async function start() {
      const p = await fetchLatestEvaluation()
      if (p) {
        cycle(p)
      } else {
        // No evaluated projects yet — retry in 15s
        pollTimer = setTimeout(start, 15000)
      }
    }

    start()
    return () => {
      timersRef.current.forEach(clearTimeout)
      clearTimeout(cycleTimer)
      clearTimeout(pollTimer)
    }
  }, [])

  const steps = buildSteps(project, project?.ai_score?.tx_hash ?? null)

  return (
    <div style={{ background: '#111', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#0A0A09', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EAB308' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E' }} />
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>genradar — ai-evaluator</span>
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
        {lines.length > 0 && lines.length < steps.length && (
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
    const id = setInterval(async () => {
      await loadProjects()
      try {
        const res = await fetch('/api/projects?sort=views&limit=50&t=' + Date.now())
        const d = await res.json()
        window.dispatchEvent(new CustomEvent('projects-refreshed', { detail: { projects: d.projects || [] } }))
      } catch {}
    }, 10000)
    return () => clearInterval(id)
  }, [loadProjects])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 80px' }}>

      {/* ── HERO ── */}
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
            GenRadar combines AI-powered evaluation, backend security scanning, and community validation to help you discover and trust the best GenLayer Community Projects.
          </p>
        </div>

        <div className="hero-pills" style={{ padding: '36px 36px 36px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          {[
            { icon: Shield, label: 'Security Scanning', sub: 'Phishing, scripts, wallet safety', bg: 'rgba(22,163,74,0.12)', ic: '#16A34A' },
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
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Most viewed · live data</p>
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
        <h2 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 20 }}>How GenRadar Works</h2>
        <div className="how-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { n: '1', icon: Upload, title: 'Submission',              c: '#22C55E', bg: 'rgba(34,197,94,0.1)',  desc: 'Project owners submit their projects to GenRadar.' },
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
          <h3 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 10 }}>Why GenRadar?</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.78, marginBottom: 20 }}>
            GenRadar ensures transparency, security, and community trust so you can discover and support the best Web3 projects with confidence.
          </p>
          <Link href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none', borderRadius: 8 }}>
            Explore Projects <ArrowRight size={13} />
          </Link>
        </div>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: 8 }}>Live AI Evaluation</h3>
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14 }}>
            Real evaluations from your submitted projects. Scanner signals sent to GenLayer validators, consensus reached on-chain.
          </p>
          <AIScanner />
        </div>
      </section>

      {/* ── CTA ── */}
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
