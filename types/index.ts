export type RiskLevel       = 'Low' | 'Medium' | 'High'
export type ConfidenceLevel = 'Low' | 'Medium' | 'High'
export type ProjectStatus   = 'pending' | 'active' | 'flagged' | 'removed'

export interface AIScoreBreakdown {
  security:     number
  transparency: number
  community:    number
}

export interface AIScore {
  score:      number
  risk:       RiskLevel
  confidence: ConfidenceLevel
  positives:  string[]
  risks:      string[]
  breakdown?: AIScoreBreakdown | null
  findings?:  string[]
}

export interface Project {
  id:           string
  name:         string
  description:  string
  website_url:  string
  github_url?:  string
  twitter_url?: string
  discord_url?: string
  docs_url?:    string
  category:     string
  logo_url?:    string
  created_by?:  string
  created_at:   string
  status?:      ProjectStatus
  ai_score?:    AIScore | null
  community_score?: number
  rating_count?:    number
  _count?: { views: number; saves: number; reports: number }
}

export interface SubmitProjectPayload {
  name:         string
  description:  string
  website_url:  string
  github_url?:  string
  twitter_url?: string
  discord_url?: string
  docs_url?:    string
  category:     string
  logo_url?:    string
}

export const PROJECT_CATEGORIES = [
  'Infra', 'AI', 'DeFi', 'Lending', 'Derivatives', 'Stable',
  'Payments', 'Wallet', 'Identity', 'Custody', 'Bridge',
  'DevTools', 'Analytics', 'Oracle', 'DAO', 'LaunchPad',
  'RWA', 'Game', 'NFT', 'Social', 'Other'
] as const

export type ProjectCategory = typeof PROJECT_CATEGORIES[number]
