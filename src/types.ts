export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled'
export type SportSlug = 'football' | 'cricket' | 'tennis' | 'basketball' | 'motorsports' | 'wrestling' | 'other'

export interface Team {
  id: string
  name: string
  short_name: string
  slug: string
  logo_url: string | null
  country: string | null
}

export interface Competition {
  id: string
  name: string
  slug: string
  country: string | null
  logo_url: string | null
  sport?: { id: string; name: string; slug: SportSlug } | null
}

export interface MatchStream {
  id: string
  source_type: 'youtube_embed' | 'official_embed' | 'licensed_hls' | 'licensed_dash' | 'external_official_link'
  embed_url: string | null
  source_page_url: string
  territory: string[]
  status: 'active' | 'disabled' | 'expired'
  priority: number
  provider?: { provider_name: string; provider_domain: string } | null
}

export interface Match {
  id: string
  slug: string
  title: string | null
  starts_at: string
  ends_at: string | null
  status: MatchStatus
  home_score: number | null
  away_score: number | null
  clock: string | null
  venue: string | null
  featured: boolean
  is_demo?: boolean
  home_team: Team
  away_team: Team
  competition: Competition
  match_streams?: MatchStream[]
}

export interface Highlight {
  id: string
  title: string
  thumbnail_url: string | null
  video_url: string
  published_at: string
  provider_name: string
}

export interface SiteSettings {
  site_name: string
  tagline: string
  default_language: 'en' | 'bn'
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  discovery_threshold: number
  discovery_interval_minutes: number
  ads_enabled: boolean
  social_links: Record<string, string>
  footer_text: string
}

export interface Announcement {
  id: string
  message_en: string
  message_bn: string | null
}

export interface StaticPage {
  slug: string
  title_en: string
  title_bn: string | null
  body_en: string
  body_bn: string | null
}

export interface Profile {
  id: string
  display_name: string | null
  role: 'user' | 'admin'
  language: 'en' | 'bn'
}
