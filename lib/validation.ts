import { z } from 'zod'
import { PROJECT_CATEGORIES } from '@/types'

const safeUrl = z.string().url('Must be a valid URL').optional().or(z.literal('')).transform(v => v || undefined)

export const submitProjectSchema = z.object({
  name:         z.string().min(3, 'At least 3 characters').max(80),
  description:  z.string().min(50, 'At least 50 characters').max(2000),
  website_url:  z.string().url('Enter a valid URL starting with https://'),
  github_url:   safeUrl,
  twitter_url:  safeUrl,
  discord_url:  safeUrl,
  telegram_url: safeUrl,
  docs_url:     safeUrl,
  category:     z.enum(PROJECT_CATEGORIES as [string, ...string[]]),
  logo_url:     z.string().optional(),
})

export type SubmitProjectInput = z.infer<typeof submitProjectSchema>
