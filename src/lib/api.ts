import type { Announcement, Highlight, Match, SiteSettings, StaticPage } from '../types'
import { demoAnnouncements, demoHighlights, demoMatches, demoPages, demoSettings } from './demo-data'
import { isSupabaseConfigured, supabase } from './supabase'

const matchSelect = `
  id, slug, title, starts_at, ends_at, status, home_score, away_score, clock, venue, featured, is_demo,
  home_team:teams!matches_home_team_id_fkey(id,name,short_name,slug,logo_url,country),
  away_team:teams!matches_away_team_id_fkey(id,name,short_name,slug,logo_url,country),
  competition:competitions(id,name,slug,country,logo_url,sport:sports(id,name,slug)),
  match_streams(id,source_type,embed_url,source_page_url,territory,status,priority,provider:approved_sources(provider_name,provider_domain))
`

export async function getMatches(): Promise<Match[]> {
  if (!isSupabaseConfigured) return demoMatches
  const { data, error } = await supabase
    .from('matches')
    .select(matchSelect)
    .gte('starts_at', new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString())
    .lte('starts_at', new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(150)
  if (error) throw error
  return (data ?? []) as unknown as Match[]
}

export async function getMatch(slug: string): Promise<Match | null> {
  if (!isSupabaseConfigured) return demoMatches.find((match) => match.slug === slug) ?? null
  const { data, error } = await supabase.from('matches').select(matchSelect).eq('slug', slug).maybeSingle()
  if (error) throw error
  return data as unknown as Match | null
}

export async function getHighlights(): Promise<Highlight[]> {
  if (!isSupabaseConfigured) return demoHighlights
  const { data, error } = await supabase.from('highlights').select('id,title,thumbnail_url,video_url,published_at,provider_name').eq('active', true).order('published_at', { ascending: false }).limit(16)
  if (error) throw error
  return data as Highlight[]
}

export async function getSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured) return demoSettings
  const { data, error } = await supabase.from('site_settings').select('site_name,tagline,default_language,logo_url,favicon_url,primary_color,discovery_threshold,discovery_interval_minutes,ads_enabled,social_links,footer_text').eq('id', 1).maybeSingle()
  if (error) throw error
  return (data as SiteSettings | null) ?? demoSettings
}

export async function getAnnouncements(): Promise<Announcement[]> {
  if (!isSupabaseConfigured) return demoAnnouncements
  const { data, error } = await supabase.from('announcements').select('id,message_en,message_bn').eq('active', true).lte('starts_at', new Date().toISOString()).or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`).order('priority', { ascending: false })
  if (error) throw error
  return data as Announcement[]
}

export async function getPage(slug: string): Promise<StaticPage | null> {
  if (!isSupabaseConfigured) return demoPages.find((page) => page.slug === slug) ?? null
  const { data, error } = await supabase.from('pages').select('slug,title_en,title_bn,body_en,body_bn').eq('slug', slug).eq('published', true).maybeSingle()
  if (error) throw error
  return data as StaticPage | null
}
