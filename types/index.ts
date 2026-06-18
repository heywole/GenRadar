export type RiskLevel       = 'Low' | 'Medium' | 'High'
export type ConfidenceLevel = 'Low' | 'Medium' | 'High'
export type ProjectStatus   = 'pending' | 'active' | 'flagged' | 'removed' | 'rejected'
export type EvaluationStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface AIScoreBreakdown {
  security:     number
  transparency: number
  community:    number
}

export interface AIScore {
  score:       number
  risk:        RiskLevel
  confidence:  ConfidenceLevel
  positives:   string[]
  risks:       string[]
  breakdown?:  AIScoreBreakdown | null
  findings?:   string[]
  explanation?: string
  tx_hash?:    string | null
}

export interface Project {
  id:           string
  name:         string
  description:  string
  website_url:  string
  github_url?:  string
  twitter_url?: string
  discord_url?: string
  telegram_url?: string
  docs_url?:    string
  category:     string
  logo_url?:    string
  created_by?:  string
  created_at:   string
  status?:      ProjectStatus
  ai_score?:    AIScore | null
  community_score?: number
  rating_count?:    number
  // Evaluation pipeline tracking — only ever set by the server.
  // A score is only ever attached once GenLayer actually returns one;
  // these fields are what the UI uses to know "still waiting" vs "done".
  evaluation_status?:          EvaluationStatus | null
  evaluation_error?:           string | null
  evaluation_tx_hash?:         string | null
  evaluation_started_at?:      string | null
  evaluation_last_polled_at?:  string | null
  _count?: { views: number; saves: number; reports: number }
}

export interface SubmitProjectPayload {
  name:         string
  description:  string
  website_url:  string
  github_url?:  string
  twitter_url?: string
  discord_url?: string
  telegram_url?: string
  docs_url?:    string
  category:     string
  logo_url?:    string
}

export const PROJECT_CATEGORIES = [
  'Infra', 'AI', 'DeFi', 'Lending', 'Derivatives', 'Stable',
  'Payments', 'Wallet', 'Identity', 'Custody', 'Bridge',
  'DevTools', 'Analytics', 'Oracle', 'DAO', 'LaunchPad',
  'RWA', 'Game', 'NFT', 'Social', 'Prediction Market', 'Other'
] as const

export type ProjectCategory = typeof PROJECT_CATEGORIES[number]
