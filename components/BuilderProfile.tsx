'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Github, MessageCircle, Globe, ExternalLink,
  LayoutGrid, List, Shield, Eye, MessageSquare, Star,
  CheckCircle, Loader2, User
} from 'lucide-react'
import { ProjectCard } from '@/components/ProjectCard'
import type { Project } from '@/types'

// Same bold X glyph used on project cards, so the logo matches everywhere
// on the site rather than using lucide's generic, thinner X mark.
function XIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> }

interface BuilderStats {
  totalProjects:  number
  totalViews:     number
  totalFeedback:  number
  avgScore:       number | null
}

interface BuilderData {
  profile: any
  projects: Project[]
  stats: BuilderStats
  isVerified: boolean
}

interface Props { builderId: string }

// Convert ISO 3166-1 alpha-2 country code to emoji flag
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  // Each letter: subtract 'A' (65) then add regional indicator base (0x1F1E6)
  const cp1 = 0x1F1E6 + (code.toUpperCase().charCodeAt(0) - 65)
  const cp2 = 0x1F1E6 + (code.toUpperCase().charCodeAt(1) - 65)
  return String.fromCodePoint(cp1, cp2)
}

// Map code to country name
const COUNTRY_NAMES: Record<string, string> = {
  AF:'Afghanistan',AL:'Albania',DZ:'Algeria',AR:'Argentina',AU:'Australia',
  AT:'Austria',BD:'Bangladesh',BE:'Belgium',BR:'Brazil',CA:'Canada',
  CL:'Chile',CN:'China',CO:'Colombia',HR:'Croatia',CZ:'Czech Republic',
  DK:'Denmark',EG:'Egypt',ET:'Ethiopia',FI:'Finland',FR:'France',
  DE:'Germany',GH:'Ghana',GR:'Greece',GT:'Guatemala',HU:'Hungary',
  IN:'India',ID:'Indonesia',IE:'Ireland',IL:'Israel',IT:'Italy',
  JP:'Japan',KE:'Kenya',KR:'South Korea',MY:'Malaysia',MX:'Mexico',
  MA:'Morocco',NL:'Netherlands',NZ:'New Zealand',NG:'Nigeria',NO:'Norway',
  PK:'Pakistan',PE:'Peru',PH:'Philippines',PL:'Poland',PT:'Portugal',
  RO:'Romania',RU:'Russia',SA:'Saudi Arabia',SN:'Senegal',ZA:'South Africa',
  ES:'Spain',SE:'Sweden',CH:'Switzerland',TW:'Taiwan',TH:'Thailand',
  TN:'Tunisia',TR:'Turkey',UA:'Ukraine',GB:'United Kingdom',US:'United States',
  VN:'Vietnam',ZW:'Zimbabwe',
}

export function BuilderProfile({ builderId }: Props) {
  const router = useRouter()
  const [data,     setData]     = useState<BuilderData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (!builderId) { setLoading(false); return }
    fetch(`/api/builder-profile?user_id=${builderId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [builderId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-3)' }} />
      </div>
    )
  }

  if (!data?.profile) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-secondary)', borderRadius: 14 }}>
        <User size={32} color="var(--text-3)" style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>No builder profile yet</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
          If you own this project, go to your{' '}
          <span onClick={() => router.push('/profile')} style={{ color: 'var(--brand)', cursor: 'pointer', textDecoration: 'underline' }}>
            profile
          </span>
          {' '}and create a builder profile.
        </p>
      </div>
    )
  }

  const { profile, projects, stats, isVerified } = data

  const flag        = profile.country ? countryFlag(profile.country) : ''
  const countryName = profile.country ? (COUNTRY_NAMES[profile.country] ?? profile.country) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── IDENTITY ── */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Avatar */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-secondary)', border: '2px solid var(--border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {(profile.display_avatar_url || profile.avatar_url)
            ? <img src={profile.display_avatar_url || profile.avatar_url} alt="builder" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            : <User size={28} color="var(--text-3)" />
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Name + flag + verified badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <h3 style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>
              {profile.display_name || profile.name || 'Builder'}
            </h3>

            {/* Country flag — shown right after the name */}
            {flag && (
              <span title={countryName} style={{
                fontSize: 22,
                lineHeight: 1,
                cursor: 'default',
                display: 'inline-flex',
                alignItems: 'center',
              }}>
                {flag}
              </span>
            )}

            {isVerified && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, background: 'var(--brand-bg)', border: '1px solid var(--brand-bd)', fontSize: 10, fontWeight: 700, color: 'var(--brand)', fontFamily: 'var(--font-mono)' }}>
                <Shield size={9} /> VERIFIED BUILDER
              </span>
            )}
          </div>

          {/* Country name text (subtle, below name) */}
          {countryName && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 8, marginTop: -2 }}>
              {countryName}
            </p>
          )}

          {profile.bio && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 10, maxWidth: 500 }}>{profile.bio}</p>
          )}

          {/* Social links */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {profile.twitter_url  && <a href={profile.twitter_url}  target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}><XIcon /></a>}
            {profile.github_url   && <a href={profile.github_url}   target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}><Github size={12} /> GitHub</a>}
            {profile.telegram_url && <a href={profile.telegram_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}><MessageCircle size={12} /> Telegram</a>}
            {profile.discord_url  && <a href={profile.discord_url}  target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}><MessageCircle size={12} /> Discord</a>}
            {profile.website_url  && <a href={profile.website_url}  target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)', textDecoration: 'none' }}><Globe size={12} /> Website</a>}
            {profile.other_links  && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{profile.other_links}</span>}
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {[
          { icon: LayoutGrid,   label: 'Projects',    value: stats.totalProjects },
          { icon: Eye,          label: 'Total Views', value: stats.totalViews    },
          { icon: MessageSquare,label: 'Feedback',    value: stats.totalFeedback },
          { icon: Star,         label: 'Reputation',  value: stats.avgScore !== null ? `${stats.avgScore}/100` : '—' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
            <Icon size={16} color="var(--brand)" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── MORE FROM THIS BUILDER ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', margin: 0 }}>More from this builder</h4>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setViewMode('grid')} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7,
              border: '1px solid var(--border-hi)', cursor: 'pointer', fontSize: 11,
              background: viewMode === 'grid' ? 'var(--brand)' : 'transparent',
              color:      viewMode === 'grid' ? '#fff'         : 'var(--text-2)',
            }}>
              <LayoutGrid size={11} /> Grid
            </button>
            <button onClick={() => setViewMode('list')} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7,
              border: '1px solid var(--border-hi)', cursor: 'pointer', fontSize: 11,
              background: viewMode === 'list' ? 'var(--brand)' : 'transparent',
              color:      viewMode === 'list' ? '#fff'         : 'var(--text-2)',
            }}>
              <List size={11} /> List
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>
            No additional projects from this builder yet.
          </p>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {projects.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projects.map(p => (
              <div key={p.id} onClick={() => window.location.href = `/project/${p.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 12, cursor: 'pointer', border: '1px solid var(--border)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {p.logo_url
                    ? <img src={p.logo_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-2)' }}>{p.name.slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{p.category}</div>
                </div>
                {p.ai_score && (
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: Number(p.ai_score.score) >= 75 ? 'var(--green)' : Number(p.ai_score.score) >= 50 ? 'var(--yellow)' : 'var(--red)', letterSpacing: '-0.02em' }}>
                      {p.ai_score.score}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>/100</div>
                  </div>
                )}
                <ExternalLink size={13} color="var(--text-3)" style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
