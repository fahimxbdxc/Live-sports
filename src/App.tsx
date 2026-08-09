import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import {
  Activity,
  Airplay,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  CirclePlay,
  Clock3,
  Database,
  ExternalLink,
  Eye,
  FileText,
  Film,
  Flag,
  Globe2,
  Heart,
  House,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  MoonStar,
  Play,
  Radio,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Tv,
  Users,
  Video,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { getAnnouncements, getHighlights, getMatch, getMatches, getPage, getSettings } from './lib/api'
import type { Enums, TablesInsert, TablesUpdate } from './lib/database.types'
import { demoSettings } from './lib/demo-data'
import { isSupabaseConfigured, supabase, workerApiUrl } from './lib/supabase'
import { formatLocalDate, isApprovedEmbedUrl, isSafeExternalUrl, matchTitle, statusLabel, timeUntil } from './lib/utils'
import type { Highlight, Match, MatchStream, Profile, SiteSettings, SportSlug } from './types'

type Language = 'en' | 'bn'

const copy = {
  en: {
    home: 'Home', live: 'Live', upcoming: 'Upcoming', highlights: 'Highlights', favourites: 'Favourites',
    search: 'Search teams, leagues or matches', watch: 'Watch now', details: 'Match details', all: 'All',
    recent: 'Recent', football: 'Football', cricket: 'Cricket', noMatches: 'No matches found for this filter.',
    officialOnly: 'Official sources only', unavailable: 'No official free stream is currently available.',
    notify: 'Save match', saved: 'Saved', localTime: 'Your local time', seeAll: 'See all',
  },
  bn: {
    home: 'হোম', live: 'লাইভ', upcoming: 'আসন্ন', highlights: 'হাইলাইটস', favourites: 'ফেভারিট',
    search: 'দল, লিগ বা ম্যাচ খুঁজুন', watch: 'এখন দেখুন', details: 'ম্যাচের বিস্তারিত', all: 'সব',
    recent: 'সাম্প্রতিক', football: 'ফুটবল', cricket: 'ক্রিকেট', noMatches: 'এই ফিল্টারে কোনো ম্যাচ পাওয়া যায়নি।',
    officialOnly: 'শুধু অফিসিয়াল সোর্স', unavailable: 'এই মুহূর্তে কোনো অফিসিয়াল ফ্রি স্ট্রিম পাওয়া যায়নি।',
    notify: 'ম্যাচ সেভ করুন', saved: 'সেভ করা', localTime: 'আপনার স্থানীয় সময়', seeAll: 'সব দেখুন',
  },
} as const

interface AppContextValue {
  language: Language
  setLanguage: (value: Language) => void
  settings: SiteSettings
  session: Session | null
  profile: Profile | null
  authLoading: boolean
  signOut: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('App context is unavailable')
  return value
}

function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('lstv-language') === 'bn' ? 'bn' : 'en'))
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const settings = settingsQuery.data ?? demoSettings

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setAuthLoading(false)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    void supabase.from('profiles').select('id,display_name,role,language').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      setProfile(data as Profile | null)
    })
  }, [session])

  useEffect(() => {
    document.title = settings.site_name
    document.documentElement.style.setProperty('--cyan', settings.primary_color)
    if (!localStorage.getItem('lstv-language')) {
      setLanguageState(settings.default_language)
      document.documentElement.lang = settings.default_language
    }
    if (settings.favicon_url && isSafeExternalUrl(settings.favicon_url)) {
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (favicon) favicon.href = settings.favicon_url
    }
  }, [settings])

  const setLanguage = (value: Language) => {
    setLanguageState(value)
    localStorage.setItem('lstv-language', value)
    document.documentElement.lang = value
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AppContext.Provider value={{ language, setLanguage, settings, session, profile, authLoading, signOut }}>
      {children}
    </AppContext.Provider>
  )
}

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="live" element={<MatchesPage mode="live" />} />
          <Route path="upcoming" element={<MatchesPage mode="upcoming" />} />
          <Route path="highlights" element={<HighlightsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="favourites" element={<FavouritesPage />} />
          <Route path="match/:slug" element={<MatchPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="page/:slug" element={<StaticPageView />} />
        </Route>
        <Route path="admin/:section?" element={<AdminPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppProvider>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { settings } = useApp()
  return (
    <Link className={`brand ${compact ? 'brand--compact' : ''}`} to="/" aria-label={`${settings.site_name} home`}>
      {settings.logo_url ? <img className="brand__image" src={settings.logo_url} alt="" /> : (
        <span className="brand__mark"><span className="brand__play"><Play size={15} fill="currentColor" /></span><span className="brand__pulse" /></span>
      )}
      <span className="brand__copy"><strong>{settings.site_name}</strong>{!compact && <small>OFFICIAL SPORTS HUB</small>}</span>
    </Link>
  )
}

function PublicLayout() {
  const { language, setLanguage, session, signOut } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const announcements = useQuery({ queryKey: ['announcements'], queryFn: getAnnouncements })
  const notice = announcements.data?.[0]
  const nav = [
    ['/', copy[language].home, House],
    ['/live', copy[language].live, Radio],
    ['/upcoming', copy[language].upcoming, CalendarClock],
    ['/highlights', copy[language].highlights, Film],
  ] as const

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            {nav.map(([to, label]) => <NavLink key={to} end={to === '/'} to={to}>{label}{to === '/live' && <i />}</NavLink>)}
          </nav>
          <div className="header-actions">
            <Link className="icon-button" to="/search" aria-label="Search"><Search size={19} /></Link>
            <Link className="icon-button" to="/favourites" aria-label="Favourites"><Heart size={19} /></Link>
            <button className="language-toggle" onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')} aria-label="Change language">
              <Languages size={17} /><span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
            </button>
            {session ? <button className="icon-button desktop-auth" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={18} /></button> : <Link className="login-button desktop-auth" to="/login"><LogIn size={17} /> Sign in</Link>}
            <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          </div>
        </div>
      </header>
      {notice && <div className="ticker"><div className="container ticker__inner"><span className="live-chip"><Zap size={13} fill="currentColor" /> UPDATE</span><div className="ticker__mask"><p>{language === 'bn' && notice.message_bn ? notice.message_bn : notice.message_en}<span aria-hidden="true">•</span>{language === 'bn' && notice.message_bn ? notice.message_bn : notice.message_en}</p></div></div></div>}
      <main><Outlet /></main>
      <Footer />
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {nav.map(([to, label, Icon]) => <NavLink key={to} end={to === '/'} to={to}><Icon size={20} /><span>{label}</span>{to === '/live' && <i />}</NavLink>)}
        <button onClick={() => setMenuOpen(true)}><Menu size={20} /><span>{language === 'bn' ? 'আরও' : 'More'}</span></button>
      </nav>
      {menuOpen && (
        <div className="drawer-backdrop" onMouseDown={() => setMenuOpen(false)}>
          <aside className="mobile-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-head"><Brand compact /><button className="icon-button" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
            <div className="drawer-links">
              <Link to="/search" onClick={() => setMenuOpen(false)}><Search size={19} />{copy[language].search}<ChevronRight size={18} /></Link>
              <Link to="/favourites" onClick={() => setMenuOpen(false)}><Heart size={19} />{copy[language].favourites}<ChevronRight size={18} /></Link>
              {session ? <button onClick={() => { void signOut(); setMenuOpen(false) }}><LogOut size={19} />Sign out</button> : <Link to="/login" onClick={() => setMenuOpen(false)}><LogIn size={19} />Sign in<ChevronRight size={18} /></Link>}
              <Link to="/page/about" onClick={() => setMenuOpen(false)}><ShieldCheck size={19} />About Live Sports TV<ChevronRight size={18} /></Link>
            </div>
            <div className="drawer-note"><ShieldCheck size={18} /><p><strong>{copy[language].officialOnly}</strong><span>No piracy, restreaming or unverified IPTV links.</span></p></div>
          </aside>
        </div>
      )}
    </div>
  )
}

function Footer() {
  const { settings, language } = useApp()
  const pages = [['about', 'About'], ['contact', 'Contact'], ['privacy', 'Privacy'], ['terms', 'Terms'], ['copyright', 'Copyright'], ['dmca', 'DMCA']]
  return (
    <footer className="footer">
      <AdSlot placement="footer" />
      <div className="container footer__grid">
        <div><Brand compact /><p>{settings.footer_text}</p><span className="footer__safe"><ShieldCheck size={15} /> {copy[language].officialOnly}</span><div className="footer__social">{Object.entries(settings.social_links).filter(([, url]) => isSafeExternalUrl(url)).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer">{name}</a>)}</div></div>
        <div><strong>Explore</strong><Link to="/live">Live matches</Link><Link to="/upcoming">Upcoming</Link><Link to="/highlights">Highlights</Link></div>
        <div><strong>Information</strong>{pages.map(([slug, label]) => <Link key={slug} to={`/page/${slug}`}>{label}</Link>)}</div>
        <div><strong>Coverage</strong><span>7 football leagues</span><span>12 cricket nations</span><span>Local time conversion</span></div>
      </div>
      <div className="container footer__bottom"><span>© {new Date().getFullYear()} {settings.site_name}</span><span>We do not host or restream copyrighted broadcasts.</span></div>
    </footer>
  )
}

type AdPlacement = 'home_banner' | 'match_card' | 'pre_player' | 'player_sidebar' | 'footer'
interface PublicAd { id: string; name: string; placement: AdPlacement; image_url: string | null; destination_url: string | null }

function AdSlot({ placement }: { placement: AdPlacement }) {
  const { settings } = useApp()
  const query = useQuery({
    queryKey: ['public-ads'],
    enabled: settings.ads_enabled && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.from('advertisements').select('id,name,placement,image_url,destination_url').eq('active', true).lte('starts_at', new Date().toISOString()).or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      if (error) throw error
      return data as PublicAd[]
    },
  })
  const ad = query.data?.find((item) => item.placement === placement)
  if (!settings.ads_enabled || !ad || !ad.image_url || !isSafeExternalUrl(ad.image_url)) return null
  const content = <><span>Advertisement</span><img src={ad.image_url} alt={ad.name} loading="lazy" /></>
  return <aside className={`ad-slot ad-slot--${placement}`} aria-label="Advertisement">{ad.destination_url && isSafeExternalUrl(ad.destination_url) ? <a href={ad.destination_url} target="_blank" rel="sponsored noopener noreferrer">{content}</a> : <div>{content}</div>}</aside>
}

function useMatches() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['matches'], queryFn: getMatches })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const channel = supabase.channel('public-matches').on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
      void queryClient.invalidateQueries({ queryKey: ['matches'] })
    }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [queryClient])
  return query
}

function HomePage() {
  const { language, settings } = useApp()
  const matchesQuery = useMatches()
  const highlightsQuery = useQuery({ queryKey: ['highlights'], queryFn: getHighlights })
  const [sport, setSport] = useState<'all' | SportSlug>('all')
  const [tab, setTab] = useState<'all' | 'live' | 'upcoming' | 'recent'>('all')
  const matches = matchesQuery.data ?? []
  const featured = matches.find((match) => match.featured && match.status === 'live') ?? matches.find((match) => match.featured) ?? matches[0]
  const visible = matches.filter((match) => {
    if (sport !== 'all' && match.competition.sport?.slug !== sport) return false
    if (tab === 'live') return ['live', 'halftime'].includes(match.status)
    if (tab === 'upcoming') return match.status === 'scheduled'
    if (tab === 'recent') return match.status === 'finished'
    return true
  }).slice(0, 9)

  return (
    <>
      <section className="hero-section">
        <div className="container">
          {featured ? <FeaturedMatch match={featured} /> : <EmptyHero />}
          <div className="league-strip" aria-label="Featured competitions">
            {['Premier League', 'La Liga', 'Bundesliga', 'Ligue 1', 'Serie A', 'Saudi Pro', 'MLS'].map((league, index) => <span key={league}><i>{index + 1}</i>{league}</span>)}
          </div>
        </div>
      </section>

      <AdSlot placement="home_banner" />

      <section className="content-section container">
        <div className="section-heading">
          <div><span className="eyebrow"><Activity size={14} /> MATCH CENTRE</span><h2>{language === 'bn' ? 'সব খেলা, এক জায়গায়' : 'Every game, one place'}</h2><p>{settings.tagline}</p></div>
          <Link className="text-link" to="/upcoming">{copy[language].seeAll}<ArrowRight size={16} /></Link>
        </div>
        <div className="filter-bar">
          <div className="sport-switch">
            {([['all', language === 'bn' ? 'সব খেলা' : 'All sports', Trophy], ['football', copy[language].football, CirclePlay], ['cricket', copy[language].cricket, Activity]] as const).map(([value, label, Icon]) => (
              <button key={value} className={sport === value ? 'active' : ''} onClick={() => setSport(value)}><Icon size={17} />{label}</button>
            ))}
          </div>
          <div className="status-tabs">
            {(['all', 'live', 'upcoming', 'recent'] as const).map((value) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{copy[language][value]}{value === 'live' && <i />}</button>)}
          </div>
        </div>
        {matchesQuery.isLoading ? <MatchSkeletons /> : matchesQuery.isError ? <ErrorState onRetry={() => void matchesQuery.refetch()} /> : visible.length ? <div className="match-grid">{visible.map((match) => <MatchCard key={match.id} match={match} />)}</div> : <EmptyState message={copy[language].noMatches} />}
        <AdSlot placement="match_card" />
      </section>

      <CoverageSection />
      <section className="content-section container">
        <div className="section-heading section-heading--row"><div><span className="eyebrow"><Film size={14} /> OFFICIAL VIDEO</span><h2>{copy[language].highlights}</h2></div><Link className="text-link" to="/highlights">{copy[language].seeAll}<ArrowRight size={16} /></Link></div>
        <div className="highlight-grid">{(highlightsQuery.data ?? []).slice(0, 4).map((highlight, index) => <HighlightCard key={highlight.id} highlight={highlight} index={index} />)}</div>
      </section>
    </>
  )
}

function FeaturedMatch({ match }: { match: Match }) {
  const { language } = useApp()
  const live = ['live', 'halftime'].includes(match.status)
  return (
    <article className="featured-match">
      <div className="featured-match__glow featured-match__glow--one" /><div className="featured-match__glow featured-match__glow--two" />
      <div className="featured-match__meta"><span className={live ? 'live-badge' : 'upcoming-badge'}>{live ? <><i /> LIVE</> : <><Clock3 size={13} /> UPCOMING</>}</span><span><Trophy size={14} />{match.competition.name}</span>{match.is_demo && <span className="demo-badge">DEMO SCHEDULE</span>}</div>
      <div className="featured-match__content">
        <TeamHero team={match.home_team} />
        <div className="featured-match__score">
          {live ? <strong>{match.home_score ?? 0}<em>:</em>{match.away_score ?? 0}</strong> : <strong className="versus">VS</strong>}
          <span>{live ? match.clock || statusLabel(match.status, language) : formatLocalDate(match.starts_at, language)}</span>
          {!live && <small>{language === 'bn' ? 'শুরু হতে' : 'Starts in'} {timeUntil(match.starts_at, language)}</small>}
        </div>
        <TeamHero team={match.away_team} />
      </div>
      <div className="featured-match__footer">
        <div><span><ShieldCheck size={16} />{copy[language].officialOnly}</span><span><Globe2 size={16} />{copy[language].localTime}</span></div>
        <Link className="primary-button" to={`/match/${match.slug}`}>{live ? <Play size={17} fill="currentColor" /> : <Eye size={17} />}{live ? copy[language].watch : copy[language].details}<ChevronRight size={16} /></Link>
      </div>
    </article>
  )
}

function TeamHero({ team }: { team: Match['home_team'] }) {
  return <div className="team-hero"><TeamLogo name={team.name} url={team.logo_url} large /><h3>{team.name}</h3><span>{team.country}</span></div>
}

function EmptyHero() {
  return <div className="featured-match empty-hero"><Radio size={34} /><h2>Match centre is getting ready</h2><p>Schedules will appear after the first successful provider sync.</p></div>
}

function TeamLogo({ name, url, large = false }: { name: string; url: string | null; large?: boolean }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 3)
  return <span className={`team-logo ${large ? 'team-logo--large' : ''}`}>{url ? <img src={url} alt={`${name} logo`} loading="lazy" /> : <span>{initials}</span>}</span>
}

function useFavouriteIds() {
  const { session } = useApp()
  return useQuery({
    queryKey: ['favourite-ids', session?.user.id ?? 'local'],
    queryFn: async () => {
      if (!session) return getSavedIds()
      const { data, error } = await supabase.from('favourites').select('match_id').eq('user_id', session.user.id).not('match_id', 'is', null)
      if (error) throw error
      return data.flatMap((row) => row.match_id ? [row.match_id] : [])
    },
  })
}

function useFavourite(matchId: string) {
  const { session } = useApp()
  const queryClient = useQueryClient()
  const query = useFavouriteIds()
  const [busy, setBusy] = useState(false)
  const saved = (query.data ?? []).includes(matchId)
  const toggleSave = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (session) {
        if (saved) {
          const { error } = await supabase.from('favourites').delete().eq('user_id', session.user.id).eq('match_id', matchId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('favourites').insert({ user_id: session.user.id, match_id: matchId })
          if (error) throw error
        }
      } else {
        const ids = getSavedIds()
        const next = ids.includes(matchId) ? ids.filter((id) => id !== matchId) : [...ids, matchId]
        localStorage.setItem('lstv-favourites', JSON.stringify(next))
      }
      await queryClient.invalidateQueries({ queryKey: ['favourite-ids', session?.user.id ?? 'local'] })
    } finally {
      setBusy(false)
    }
  }
  return { saved, busy, toggleSave }
}

function MatchCard({ match }: { match: Match }) {
  const { language } = useApp()
  const live = ['live', 'halftime'].includes(match.status)
  const { saved, busy, toggleSave } = useFavourite(match.id)
  return (
    <article className={`match-card ${live ? 'match-card--live' : ''}`}>
      <div className="match-card__head"><span>{match.competition.name}</span><div>{match.is_demo && <small>DEMO</small>}<button onClick={() => void toggleSave()} disabled={busy} className={saved ? 'saved' : ''} aria-label="Save match"><Heart size={16} fill={saved ? 'currentColor' : 'none'} /></button></div></div>
      <div className="match-card__teams">
        <div><TeamLogo name={match.home_team.name} url={match.home_team.logo_url} /><strong>{match.home_team.name}</strong>{live && <b>{match.home_score ?? 0}</b>}</div>
        <span>VS</span>
        <div><TeamLogo name={match.away_team.name} url={match.away_team.logo_url} /><strong>{match.away_team.name}</strong>{live && <b>{match.away_score ?? 0}</b>}</div>
      </div>
      <div className="match-card__time">
        {live ? <span className="live-time"><i />{statusLabel(match.status, language)} {match.clock}</span> : <><strong>{formatLocalDate(match.starts_at, language)}</strong><span><Clock3 size={13} />{timeUntil(match.starts_at, language)}</span></>}
      </div>
      <Link className={live ? 'card-watch card-watch--live' : 'card-watch'} to={`/match/${match.slug}`}>
        {live ? <Play size={15} fill="currentColor" /> : <Eye size={15} />}{live ? copy[language].watch : copy[language].details}<ChevronRight size={15} />
      </Link>
    </article>
  )
}

function CoverageSection() {
  const { language } = useApp()
  const items = [
    { icon: Trophy, value: '7', label: language === 'bn' ? 'শীর্ষ ফুটবল লিগ' : 'Top football leagues' },
    { icon: Flag, value: '12', label: language === 'bn' ? 'ক্রিকেট দল' : 'Cricket nations' },
    { icon: ShieldCheck, value: '100%', label: language === 'bn' ? 'অফিসিয়াল সোর্স' : 'Approved sources' },
    { icon: Globe2, value: 'Local', label: language === 'bn' ? 'সময় অঞ্চল' : 'Timezone aware' },
  ]
  return (
    <section className="coverage-section">
      <div className="container coverage-grid">{items.map(({ icon: Icon, value, label }) => <div key={label}><span><Icon size={20} /></span><strong>{value}</strong><small>{label}</small></div>)}</div>
    </section>
  )
}

function HighlightCard({ highlight, index }: { highlight: Highlight; index: number }) {
  const safe = isSafeExternalUrl(highlight.video_url) && highlight.video_url !== '#'
  const Wrapper = safe ? 'a' : 'div'
  return (
    <Wrapper className="highlight-card" {...(safe ? { href: highlight.video_url, target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <div className={`highlight-card__visual highlight-card__visual--${index % 4}`} style={highlight.thumbnail_url ? { backgroundImage: `url(${highlight.thumbnail_url})` } : undefined}>
        <span><Play size={19} fill="currentColor" /></span><small>OFFICIAL</small>
      </div>
      <div><strong>{highlight.title}</strong><span>{highlight.provider_name} · {formatLocalDate(highlight.published_at)}</span></div>
    </Wrapper>
  )
}

function MatchesPage({ mode }: { mode: 'live' | 'upcoming' }) {
  const { language } = useApp()
  const matchesQuery = useMatches()
  const [sport, setSport] = useState<'all' | SportSlug>('all')
  const matches = (matchesQuery.data ?? []).filter((match) => {
    const statusMatches = mode === 'live' ? ['live', 'halftime'].includes(match.status) : match.status === 'scheduled'
    return statusMatches && (sport === 'all' || match.competition.sport?.slug === sport)
  })
  return (
    <PageShell eyebrow={mode === 'live' ? 'LIVE CENTRE' : 'FIXTURE CALENDAR'} title={mode === 'live' ? copy[language].live : copy[language].upcoming} description={mode === 'live' ? 'Matches currently in progress with verified source availability.' : 'Kickoff times automatically converted to your device timezone.'}>
      <div className="compact-filters"><ListFilter size={17} />{(['all', 'football', 'cricket'] as const).map((value) => <button key={value} className={sport === value ? 'active' : ''} onClick={() => setSport(value)}>{value === 'all' ? copy[language].all : copy[language][value]}</button>)}</div>
      {matchesQuery.isLoading ? <MatchSkeletons /> : matches.length ? <div className="match-grid">{matches.map((match) => <MatchCard key={match.id} match={match} />)}</div> : <EmptyState message={mode === 'live' ? 'No matches are live right now. Check the upcoming schedule.' : copy[language].noMatches} />}
    </PageShell>
  )
}

function PageShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <section className="inner-page"><div className="inner-page__hero"><div className="container"><span className="eyebrow"><Sparkles size={14} />{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div><div className="container inner-page__content">{children}</div></section>
}

function HighlightsPage() {
  const { language } = useApp()
  const query = useQuery({ queryKey: ['highlights'], queryFn: getHighlights })
  return <PageShell eyebrow="OFFICIAL VIDEO" title={copy[language].highlights} description="Highlights are listed only from approved league, club, federation and broadcaster channels.">{query.isLoading ? <MatchSkeletons /> : <div className="highlight-grid highlight-grid--page">{(query.data ?? []).map((item, index) => <HighlightCard key={item.id} highlight={item} index={index} />)}</div>}</PageShell>
}

function MatchPage() {
  const { slug = '' } = useParams()
  const { language } = useApp()
  const query = useQuery({ queryKey: ['match', slug], queryFn: () => getMatch(slug) })
  const match = query.data
  if (query.isLoading) return <div className="container standalone-loader"><LoaderCircle className="spin" /></div>
  if (!match) return <NotFound />
  const streams = (match.match_streams ?? []).filter((stream) => stream.status === 'active').sort((a, b) => a.priority - b.priority)
  return (
    <section className="match-page">
      <div className="match-page__hero"><div className="container"><Link className="back-link" to="/"><ArrowLeft size={17} />Back to matches</Link><div className="match-scoreboard"><TeamHero team={match.home_team} /><div><span>{match.competition.name}</span><strong>{['live', 'halftime', 'finished'].includes(match.status) ? `${match.home_score ?? 0} : ${match.away_score ?? 0}` : 'VS'}</strong><em className={match.status === 'live' ? 'is-live' : ''}>{statusLabel(match.status, language)} {match.clock}</em><small>{formatLocalDate(match.starts_at, language)}</small></div><TeamHero team={match.away_team} /></div></div></div>
      <div className="container match-page__grid">
        <div>
          <AdSlot placement="pre_player" />
          <div className="player-card"><div className="player-card__title"><div><Radio size={18} /><strong>{language === 'bn' ? 'অফিসিয়াল সম্প্রচার' : 'Official broadcast'}</strong></div><span><ShieldCheck size={15} />Verified sources</span></div><SafePlayer streams={streams} /></div>
          <div className="match-info-card"><h2>Match information</h2><div><span><Trophy size={18} /><small>Competition</small><strong>{match.competition.name}</strong></span><span><CalendarClock size={18} /><small>Kickoff</small><strong>{formatLocalDate(match.starts_at, language)}</strong></span><span><Globe2 size={18} /><small>Timezone</small><strong>{Intl.DateTimeFormat().resolvedOptions().timeZone}</strong></span><span><Flag size={18} /><small>Venue</small><strong>{match.venue || 'To be confirmed'}</strong></span></div></div>
        </div>
        <aside className="match-sidebar"><div className="availability-card"><span><ShieldCheck size={22} /></span><h3>Source transparency</h3><p>Every playable source must have an approved provider, territory permission, rights status and original source page.</p><ul><li><Check size={15} />No restreaming</li><li><Check size={15} />No DRM bypass</li><li><Check size={15} />No unverified IPTV</li></ul></div><SaveMatchButton matchId={match.id} /><AdSlot placement="player_sidebar" /></aside>
      </div>
    </section>
  )
}

function SafePlayer({ streams }: { streams: MatchStream[] }) {
  const { language } = useApp()
  const [selected, setSelected] = useState(streams[0] ?? null)
  const [started, setStarted] = useState(false)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [drmLicenseUrl, setDrmLicenseUrl] = useState<string | null>(null)
  const [drmKeySystem, setDrmKeySystem] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState('')
  const [authorizing, setAuthorizing] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const recordPlayback = useCallback((eventType: 'requested' | 'started' | 'error' | 'fallback' | 'external_open', errorCode?: string) => {
    if (!workerApiUrl || !selected) return
    void fetch(`${workerApiUrl}/playback/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream_id: selected.id, event_type: eventType, error_code: errorCode?.slice(0, 120) }),
      keepalive: true,
    }).catch(() => undefined)
  }, [selected])

  useEffect(() => {
    setPlaybackUrl(null)
    setDrmLicenseUrl(null)
    setDrmKeySystem(null)
    setPlaybackError('')
    if (!started || !selected || !['licensed_hls', 'licensed_dash'].includes(selected.source_type)) return
    if (!workerApiUrl) {
      setPlaybackError('Secure playback authorization is not configured.')
      return
    }
    const controller = new AbortController()
    setAuthorizing(true)
    void fetch(`${workerApiUrl}/playback/${selected.id}`, { method: 'POST', signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json()
        if (!response.ok) throw new Error(typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string' ? payload.error : `Authorization failed (${response.status})`)
        if (typeof payload !== 'object' || payload === null || !('playback_url' in payload) || typeof payload.playback_url !== 'string' || !isSafeExternalUrl(payload.playback_url)) throw new Error('Provider returned an invalid playback URL.')
        setPlaybackUrl(payload.playback_url)
        if ('drm_license_url' in payload && typeof payload.drm_license_url === 'string' && isSafeExternalUrl(payload.drm_license_url)) setDrmLicenseUrl(payload.drm_license_url)
        if ('drm_key_system' in payload && typeof payload.drm_key_system === 'string') setDrmKeySystem(payload.drm_key_system)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : 'Playback authorization failed.'
          setPlaybackError(message)
          recordPlayback('error', message)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setAuthorizing(false) })
    return () => controller.abort()
  }, [selected, started, recordPlayback])

  useEffect(() => {
    if (!started || !selected || selected.source_type !== 'licensed_hls' || !playbackUrl || !videoRef.current) return
    const video = videoRef.current
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl
      return
    }
    let cancelled = false
    let hls: { destroy: () => void } | null = null
    void import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (!Hls.isSupported()) throw new Error('HLS playback is not supported by this browser.')
      const instance = new Hls({ enableWorker: true })
      hls = instance
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setPlaybackError(data.details)
          recordPlayback('error', data.details)
        }
      })
      instance.loadSource(playbackUrl)
      instance.attachMedia(video)
    }).catch((error: unknown) => {
      if (!cancelled) setPlaybackError(error instanceof Error ? error.message : 'HLS playback failed.')
    })
    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [selected, started, playbackUrl, recordPlayback])

  useEffect(() => {
    if (!started || !selected || selected.source_type !== 'licensed_dash' || !playbackUrl || !videoRef.current) return
    const video = videoRef.current
    let cancelled = false
    let player: { destroy: () => Promise<unknown> } | null = null
    void import('shaka-player').then(async ({ default: shakaPlayer }) => {
      shakaPlayer.polyfill.installAll()
      if (!shakaPlayer.Player.isBrowserSupported()) throw new Error('DASH playback is not supported by this browser.')
      const instance = new shakaPlayer.Player()
      player = instance
      await instance.attach(video)
      if (drmLicenseUrl && drmKeySystem) instance.configure({ drm: { servers: { [drmKeySystem]: drmLicenseUrl } } })
      instance.addEventListener('error', () => recordPlayback('error', 'shaka_player_error'))
      await instance.load(playbackUrl)
      if (!cancelled) recordPlayback('started')
    }).catch((error: unknown) => {
      if (!cancelled) {
        const message = error instanceof Error ? error.message : 'DASH playback failed.'
        setPlaybackError(message)
        recordPlayback('error', message)
      }
    })
    return () => {
      cancelled = true
      if (player) void player.destroy()
    }
  }, [selected, started, playbackUrl, drmLicenseUrl, drmKeySystem, recordPlayback])

  if (!selected) return <div className="player-empty"><span><Tv size={34} /></span><h3>{copy[language].unavailable}</h3><p>We will keep checking approved providers before and during the match.</p></div>
  if (selected.source_type === 'external_official_link') return <div className="player-empty"><span><ExternalLink size={34} /></span><h3>Watch on the official provider</h3><p>This provider does not permit embedding in this territory.</p>{isSafeExternalUrl(selected.source_page_url) && <a className="primary-button" href={selected.source_page_url} target="_blank" rel="noopener noreferrer" onClick={() => recordPlayback('external_open')}>Open official page<ExternalLink size={16} /></a>}</div>
  if (!started) return <div className="player-poster"><span className="player-poster__ring"><button onClick={() => { recordPlayback('requested'); setStarted(true) }} aria-label="Start official player"><Play size={26} fill="currentColor" /></button></span><strong>Official source available</strong><small>{selected.provider?.provider_name} · {selected.territory.join(', ')}</small></div>

  const iframeAllowed = ['youtube_embed', 'official_embed'].includes(selected.source_type)
    && Boolean(selected.embed_url && isApprovedEmbedUrl(selected.embed_url, selected.provider?.provider_domain))
  const videoReady = ['licensed_hls', 'licensed_dash'].includes(selected.source_type) && Boolean(playbackUrl)

  return (
    <div>
      <div className="player-frame">
        {iframeAllowed && selected.embed_url
          ? <iframe src={selected.embed_url} title="Official live stream" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={() => recordPlayback('started')} />
          : videoReady
            ? <video ref={videoRef} controls playsInline onPlay={() => recordPlayback('started')} onError={() => recordPlayback('error', 'html_media_error')} />
            : authorizing
              ? <div className="player-error"><LoaderCircle className="spin" />Authorizing licensed playback…</div>
              : <div className="player-error"><XCircle />{playbackError || 'Unable to load this approved source.'}</div>}
      </div>
      {streams.length > 1 && <div className="source-switcher">{streams.map((stream, index) => <button key={stream.id} className={selected.id === stream.id ? 'active' : ''} onClick={() => { recordPlayback('fallback'); setSelected(stream); setStarted(false) }}>Source {index + 1}</button>)}</div>}
      <div className="source-attribution"><span><ShieldCheck size={15} />{selected.provider?.provider_name || 'Authorized provider'}</span>{isSafeExternalUrl(selected.source_page_url) && <a href={selected.source_page_url} target="_blank" rel="noopener noreferrer">Original source<ExternalLink size={13} /></a>}</div>
    </div>
  )
}

function SaveMatchButton({ matchId }: { matchId: string }) {
  const { language, session } = useApp()
  const { saved, busy, toggleSave } = useFavourite(matchId)
  return <button className={`save-large ${saved ? 'saved' : ''}`} disabled={busy} onClick={() => void toggleSave()}><Heart size={19} fill={saved ? 'currentColor' : 'none'} /><span><strong>{saved ? copy[language].saved : copy[language].notify}</strong><small>{session ? 'Synced to your free account' : 'Stored on this device'}</small></span></button>
}

function getSavedIds(): string[] {
  try { return JSON.parse(localStorage.getItem('lstv-favourites') || '[]') as string[] } catch { return [] }
}

function FavouritesPage() {
  const { language, session } = useApp()
  const matches = useMatches()
  const favourites = useFavouriteIds()
  const saved = favourites.data ?? []
  const items = (matches.data ?? []).filter((match) => saved.includes(match.id))
  return <PageShell eyebrow="YOUR MATCHES" title={copy[language].favourites} description={session ? 'Synced securely across your signed-in devices.' : 'Saved locally on this device; sign in for cross-device sync.'}>{items.length ? <div className="match-grid">{items.map((match) => <MatchCard key={match.id} match={match} />)}</div> : <EmptyState message="You have not saved any matches yet." />}</PageShell>
}

function SearchPage() {
  const { language } = useApp()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const matches = useMatches()
  const results = (matches.data ?? []).filter((match) => !query || [matchTitle(match), match.competition.name, match.home_team.name, match.away_team.name, match.competition.sport?.name].some((value) => value?.toLowerCase().includes(query.toLowerCase())))
  return <PageShell eyebrow="DISCOVER" title={language === 'bn' ? 'খেলা খুঁজুন' : 'Find a match'} description="Search by team, competition, sport or match."><label className="search-field"><Search size={21} /><input autoFocus value={query} onChange={(event) => setParams(event.target.value ? { q: event.target.value } : {})} placeholder={copy[language].search} /><kbd>{results.length}</kbd></label>{query && <div className="search-summary">Results for <strong>“{query}”</strong></div>}<div className="match-grid">{results.map((match) => <MatchCard key={match.id} match={match} />)}</div></PageShell>
}

function StaticPageView() {
  const { slug = '' } = useParams()
  const { language } = useApp()
  const query = useQuery({ queryKey: ['page', slug], queryFn: () => getPage(slug) })
  if (query.isLoading) return <div className="standalone-loader"><LoaderCircle className="spin" /></div>
  if (!query.data) return <NotFound />
  const page = query.data
  return <PageShell eyebrow="LIVE SPORTS TV" title={language === 'bn' && page.title_bn ? page.title_bn : page.title_en} description=""><article className="static-copy"><p>{language === 'bn' && page.body_bn ? page.body_bn : page.body_en}</p></article></PageShell>
}

function LoginPage() {
  const { session } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (session) return <Navigate to="/" replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isSupabaseConfigured) { setMessage('Supabase environment variables are not configured yet.'); return }
    setBusy(true); setMessage('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message); else void navigate('/')
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
      setMessage(error?.message ?? 'Check your email to confirm your account.')
    }
    setBusy(false)
  }
  return <section className="auth-page"><div className="auth-art"><Brand /><div><span className="eyebrow"><ShieldCheck size={14} /> FREE ACCOUNT</span><h1>Never miss the games that matter.</h1><p>Save teams, matches and reminders. Watching official streams remains free.</p></div><div className="auth-benefits"><span><Heart size={19} />Favourite matches</span><span><Bell size={19} />Match reminders</span><span><Languages size={19} />Language preference</span></div></div><form className="auth-card" onSubmit={(event) => void submit(event)}><span className="auth-card__icon"><LockKeyhole size={23} /></span><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p>{mode === 'login' ? 'Sign in to manage your favourites.' : 'Free forever. No payment information.'}</p>{mode === 'signup' && <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>{message && <div className="form-message">{message}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <LogIn size={18} />}{mode === 'login' ? 'Sign in' : 'Create account'}</button><button type="button" className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>{mode === 'login' ? 'New here? Create a free account' : 'Already have an account? Sign in'}</button></form></section>
}

function AdminPage() {
  const { section = 'dashboard' } = useParams()
  const { profile, authLoading, session, signOut, settings } = useApp()
  const navigate = useNavigate()
  const menu = [
    ['dashboard', 'Dashboard', LayoutDashboard], ['catalogue', 'Sports catalogue', Trophy], ['matches', 'Matches', CalendarClock],
    ['sources', 'Approved sources', ShieldCheck], ['streams', 'Live streams', Tv], ['discovery', 'Discovery queue', Radio], ['content', 'Banners & video', ImageIcon],
    ['pages', 'Static pages', FileText], ['ads', 'Advertisements', Settings], ['branding', 'Branding', Sparkles], ['logs', 'System logs', Database],
  ] as const
  if (authLoading) return <div className="admin-gate"><LoaderCircle className="spin" /></div>
  if (!session) return <Navigate to="/login" replace />
  if (profile?.role !== 'admin') return <div className="admin-gate"><span><LockKeyhole /></span><h1>Admin access required</h1><p>Your account is signed in but does not have the server-verified admin role.</p><Link className="secondary-button" to="/">Return to website</Link></div>
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar"><div className="admin-sidebar__brand"><Brand compact /><span>CONTROL ROOM</span></div><nav>{menu.map(([value, label, Icon]) => <button key={value} className={section === value ? 'active' : ''} onClick={() => navigate(`/admin/${value}`)}><Icon size={18} /><span>{label}</span>{value === 'discovery' && <i />}</button>)}</nav><div className="admin-sidebar__foot"><Link to="/"><Eye size={17} />View website</Link><button onClick={() => void signOut()}><LogOut size={17} />Sign out</button></div></aside>
      <main className="admin-main"><header className="admin-topbar"><div><small>{settings.site_name}</small><h1>{menu.find(([value]) => value === section)?.[1] ?? 'Admin'}</h1></div><div><span className="system-online"><i />System online</span><span className="admin-avatar">AD</span></div></header><div className="admin-content"><AdminSection section={section} /></div></main>
    </div>
  )
}

interface AdminCounts { matches: number; live: number; sources: number; pending: number; users: number }

async function getAdminCounts(): Promise<AdminCounts> {
  const [matches, live, sources, pending, users] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('matches').select('*', { count: 'exact', head: true }).in('status', ['live', 'halftime']),
    supabase.from('approved_sources').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('source_candidates').select('*', { count: 'exact', head: true }).eq('review_status', 'pending'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])
  return { matches: matches.count ?? 0, live: live.count ?? 0, sources: sources.count ?? 0, pending: pending.count ?? 0, users: users.count ?? 0 }
}

function AdminSection({ section }: { section: string }) {
  if (section === 'catalogue') return <AdminCatalogue />
  if (section === 'matches') return <AdminMatches />
  if (section === 'sources') return <AdminSources />
  if (section === 'streams') return <AdminStreams />
  if (section === 'discovery') return <AdminDiscovery />
  if (section === 'content') return <AdminContent />
  if (section === 'pages') return <AdminPages />
  if (section === 'ads') return <AdminAds />
  if (section === 'branding') return <AdminBranding />
  if (section === 'logs') return <AdminLogs />
  return <AdminDashboard />
}

function AdminDashboard() {
  const query = useQuery({ queryKey: ['admin-counts'], queryFn: getAdminCounts })
  const counts = query.data ?? { matches: 0, live: 0, sources: 0, pending: 0, users: 0 }
  const cards = [[Activity, counts.live, 'Live now', 'cyan'], [CalendarClock, counts.matches, 'Total matches', 'blue'], [ShieldCheck, counts.sources, 'Approved sources', 'green'], [Radio, counts.pending, 'Needs review', 'orange'], [Users, counts.users, 'Registered users', 'purple']] as const
  return <><div className="admin-welcome"><div><span>OPERATIONS OVERVIEW</span><h2>Everything important, at a glance.</h2><p>Fixture sync, source discovery and playback health update from the edge worker.</p></div><WorkerActions /></div><div className="metric-grid">{cards.map(([Icon, value, label, tone]) => <div className={`metric-card tone-${tone}`} key={label}><span><Icon size={21} /></span><div><strong>{query.isLoading ? '—' : value}</strong><small>{label}</small></div><BarChart3 size={29} /></div>)}</div><div className="admin-dashboard-grid"><div className="admin-panel"><PanelTitle icon={Activity} title="System status" subtitle="Core services" /><div className="status-list"><StatusRow label="Supabase database" value="Connected" ok /><StatusRow label="Source discovery" value="Cron ready" ok /><StatusRow label="Public website" value="Build monitored" ok /><StatusRow label="Playback secrets" value="Worker-only" ok /></div></div><div className="admin-panel"><PanelTitle icon={ShieldCheck} title="Safety rules" subtitle="Always enforced" /><div className="guardrail-list"><span><Check />Approved domains only</span><span><Check />Bangladesh territory check</span><span><Check />Rights expiry enforcement</span><span><Check />No arbitrary iframe injection</span></div></div></div></>
}

function WorkerActions() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (action: 'sync' | 'discover') => {
    if (!workerApiUrl) { setMessage('Configure VITE_WORKER_API_URL first.'); return }
    setBusy(true); setMessage('')
    const { data } = await supabase.auth.getSession()
    try {
      const response = await fetch(`${workerApiUrl}/admin/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } })
      const result = await response.json() as { message?: string; error?: string }
      setMessage(result.message ?? result.error ?? `HTTP ${response.status}`)
    } catch { setMessage('Worker request failed.') }
    setBusy(false)
  }
  return <div className="worker-actions"><button className="secondary-button" disabled={busy} onClick={() => void run('sync')}><RefreshCw size={16} className={busy ? 'spin' : ''} />Sync fixtures</button><button className="primary-button" disabled={busy} onClick={() => void run('discover')}><Radio size={16} />Discover sources</button>{message && <small>{message}</small>}</div>
}

interface AdminSport { id: string; name: string; slug: string; active: boolean }
interface AdminCompetition { id: string; name: string; slug: string; country: string | null; external_provider: string | null; external_id: string | null; active: boolean; sport: { name: string } }
interface AdminTeam { id: string; name: string; short_name: string; slug: string; country: string | null; active: boolean; sport: { name: string } }

function AdminCatalogue() {
  const [tab, setTab] = useState<'sports' | 'competitions' | 'teams'>('sports')
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()
  const sports = useQuery({ queryKey: ['admin-sports'], queryFn: async () => { const { data, error } = await supabase.from('sports').select('id,name,slug,active').order('position'); if (error) throw error; return data as AdminSport[] } })
  const competitions = useQuery({ queryKey: ['admin-competitions'], queryFn: async () => { const { data, error } = await supabase.from('competitions').select('id,name,slug,country,external_provider,external_id,active,sport:sports(name)').order('position'); if (error) throw error; return data as unknown as AdminCompetition[] } })
  const teams = useQuery({ queryKey: ['admin-teams'], queryFn: async () => { const { data, error } = await supabase.from('teams').select('id,name,short_name,slug,country,active,sport:sports(name)').order('name'); if (error) throw error; return data as unknown as AdminTeam[] } })
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-sports'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-competitions'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-teams'] })
  }
  const create = useMutation({ mutationFn: async (form: FormData) => {
    const base = { name: formString(form, 'name'), slug: formString(form, 'slug'), active: true }
    const values = tab === 'sports' ? base : tab === 'competitions' ? { ...base, sport_id: formString(form, 'sport_id'), country: formString(form, 'country') || null, external_provider: formString(form, 'external_id') ? 'thesportsdb' : null, external_id: formString(form, 'external_id') || null } : { ...base, sport_id: formString(form, 'sport_id'), short_name: formString(form, 'short_name').toUpperCase(), country: formString(form, 'country') || null }
    const { error } = await supabase.from(tab).insert(values)
    if (error) throw error
  }, onSuccess: () => { setShowForm(false); invalidate() } })
  const toggle = useMutation({ mutationFn: async ({ table, id, active }: { table: 'sports' | 'competitions' | 'teams'; id: string; active: boolean }) => { const { error } = await supabase.from(table).update({ active }).eq('id', id); if (error) throw error }, onSuccess: invalidate })
  const updateProvider = useMutation({ mutationFn: async ({ id, externalId }: { id: string; externalId: string }) => { const { error } = await supabase.from('competitions').update({ external_provider: externalId ? 'thesportsdb' : null, external_id: externalId || null }).eq('id', id); if (error) throw error }, onSuccess: invalidate })
  const rows = tab === 'sports'
    ? (sports.data ?? []).map((row) => ({ ...row, sportName: 'Primary sport category', country: null, shortName: null, syncLabel: null, externalId: null }))
    : tab === 'competitions'
      ? (competitions.data ?? []).map((row) => ({ ...row, sportName: row.sport.name, shortName: null, syncLabel: row.external_id ? `TheSportsDB ${row.external_id}` : null, externalId: row.external_id }))
      : (teams.data ?? []).map((row) => ({ ...row, sportName: row.sport.name, shortName: row.short_name, syncLabel: null, externalId: null }))
  return <><div className="admin-actions-row"><div><h2>Sports catalogue</h2><p>Manage categories, the seven football leagues and all supported teams.</p></div><button className="primary-button" onClick={() => setShowForm(!showForm)}><Trophy size={16} />Add {tab.slice(0, -1)}</button></div><div className="admin-tabbar">{(['sports', 'competitions', 'teams'] as const).map((value) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); setShowForm(false) }}>{value}</button>)}</div>{showForm && <form className="admin-form-grid catalogue-form" onSubmit={(event) => { event.preventDefault(); create.mutate(new FormData(event.currentTarget)) }}><label>Name<input name="name" required /></label><label>URL slug<input name="slug" required pattern="[a-z0-9-]+" placeholder="lowercase-slug" /></label>{tab !== 'sports' && <><label>Sport<select name="sport_id" required>{sports.data?.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label><label>Country<input name="country" /></label>{tab === 'competitions' && <label>TheSportsDB league ID<input name="external_id" inputMode="numeric" placeholder="Optional provider league ID" /></label>}</>}{tab === 'teams' && <label>Short name<input name="short_name" required minLength={2} maxLength={6} /></label>}<button className="primary-button" disabled={create.isPending}><Check size={16} />Save</button>{create.error && <p className="form-error">{create.error.message}</p>}</form>}<div className="admin-panel"><PanelTitle icon={Trophy} title={tab[0].toUpperCase() + tab.slice(1)} subtitle={`${rows.length} catalogue records`} /><div className="catalogue-list">{rows.map((row) => <div key={row.id}><span className="catalogue-icon">{tab === 'sports' ? <Trophy /> : tab === 'competitions' ? <Flag /> : <Users />}</span><div><strong>{row.name}</strong><small>{row.sportName} · /{row.slug}{row.syncLabel ? ` · ${row.syncLabel}` : ''}</small></div>{row.country && <span className="catalogue-country">{row.country}</span>}{tab === 'competitions' && <input className="catalogue-provider-input" aria-label="TheSportsDB league ID" defaultValue={row.externalId ?? ''} placeholder="Sync ID" onBlur={(event) => { if (event.target.value !== (row.externalId ?? '')) updateProvider.mutate({ id: row.id, externalId: event.target.value.trim() }) }} />}{row.shortName && <span className="territory-chip">{row.shortName}</span>}<button className={`table-toggle ${row.active ? 'active' : ''}`} onClick={() => toggle.mutate({ table: tab, id: row.id, active: !row.active })}>{row.active ? <Check size={15} /> : <X size={15} />}</button></div>)}</div></div></>
}

function AdminMatches() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin-matches'], queryFn: getMatches })
  const update = useMutation({ mutationFn: async ({ id, values }: { id: string; values: { status?: string; featured?: boolean } }) => { const { error } = await supabase.from('matches').update(values as TablesUpdate<'matches'>).eq('id', id); if (error) throw error }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-matches'] }); void queryClient.invalidateQueries({ queryKey: ['matches'] }) } })
  return <div className="admin-panel"><PanelTitle icon={CalendarClock} title="Match management" subtitle="Imported fixtures can be corrected manually" /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Match</th><th>Competition</th><th>Kickoff</th><th>Status</th><th>Featured</th></tr></thead><tbody>{(query.data ?? []).map((match) => <tr key={match.id}><td><div className="table-match"><TeamLogo name={match.home_team.name} url={match.home_team.logo_url} /><span><strong>{matchTitle(match)}</strong><small>{match.venue || 'Venue TBD'}</small></span></div></td><td>{match.competition.name}</td><td>{formatLocalDate(match.starts_at)}</td><td><select value={match.status} onChange={(event) => update.mutate({ id: match.id, values: { status: event.target.value } })}>{['scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled'].map((status) => <option key={status}>{status}</option>)}</select></td><td><button className={`table-toggle ${match.featured ? 'active' : ''}`} onClick={() => update.mutate({ id: match.id, values: { featured: !match.featured } })}><Star size={16} fill={match.featured ? 'currentColor' : 'none'} /></button></td></tr>)}</tbody></table></div></div>
}

interface ApprovedSourceRow {
  id: string
  provider_name: string
  provider_domain: string
  source_type: Enums<'stream_source_type'>
  official_channel_id: string | null
  territory: string[]
  permission_status: Enums<'permission_state'>
  permission_reference: string
  rights_expiry: string
  source_page_url: string
  embed_allowed: boolean
  active: boolean
}

function formString(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

function AdminSources() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approved_sources')
        .select('id,provider_name,provider_domain,source_type,official_channel_id,territory,permission_status,permission_reference,rights_expiry,source_page_url,embed_allowed,active')
        .order('provider_name')
      if (error) throw error
      return data as ApprovedSourceRow[]
    },
  })
  const [open, setOpen] = useState(false)
  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const expiry = new Date(formString(form, 'rights_expiry'))
      if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) throw new Error('Rights expiry must be a future date.')
      const permissionStatus = formString(form, 'permission_status') as Enums<'permission_state'>
      const source: TablesInsert<'approved_sources'> = {
        provider_name: formString(form, 'provider_name'),
        provider_domain: formString(form, 'provider_domain').toLowerCase(),
        source_type: formString(form, 'source_type') as Enums<'stream_source_type'>,
        official_channel_id: formString(form, 'official_channel_id') || null,
        territory: formString(form, 'territory').split(',').map((item) => item.trim().toUpperCase()).filter(Boolean),
        embed_allowed: form.get('embed_allowed') === 'on',
        permission_status: permissionStatus,
        permission_reference: formString(form, 'permission_reference'),
        rights_expiry: expiry.toISOString(),
        source_page_url: formString(form, 'source_page_url'),
        active: form.get('active') === 'on',
      }
      const { error } = await supabase.from('approved_sources').insert(source)
      if (error) throw error
    },
    onSuccess: () => {
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin-sources'] })
    },
  })
  const toggle = useMutation({
    mutationFn: async (source: ApprovedSourceRow) => {
      const { error } = await supabase.from('approved_sources').update({ active: !source.active }).eq('id', source.id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-sources'] })
      void queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  return (
    <>
      <div className="admin-actions-row">
        <div><h2>Provider allowlist</h2><p>Permission evidence, territory and expiry are mandatory for every source.</p></div>
        <button className="primary-button" onClick={() => setOpen(!open)}><ShieldCheck size={16} />Add approved source</button>
      </div>
      {open && (
        <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); create.mutate(new FormData(event.currentTarget)) }}>
          <label>Provider name<input name="provider_name" required placeholder="Official broadcaster" /></label>
          <label>Provider domain<input name="provider_domain" required pattern="[a-z0-9.-]+" placeholder="youtube.com" /></label>
          <label>Source type<select name="source_type"><option value="youtube_embed">YouTube embed</option><option value="official_embed">Official embed</option><option value="licensed_hls">Licensed HLS</option><option value="licensed_dash">Licensed DASH</option><option value="external_official_link">External official link</option></select></label>
          <label>Official channel ID<input name="official_channel_id" placeholder="UC…" /></label>
          <label>Territory<input name="territory" required defaultValue="BD" placeholder="BD,GLOBAL" /></label>
          <label>Permission status<select name="permission_status" defaultValue="approved"><option value="approved">Approved</option><option value="pending">Pending review</option><option value="rejected">Rejected</option></select></label>
          <label>Permission reference<input name="permission_reference" required placeholder="Contract, API agreement or written authorization" /></label>
          <label>Rights expiry<input name="rights_expiry" type="datetime-local" required /></label>
          <label>Original source page<input name="source_page_url" type="url" required placeholder="https://provider-domain.example/…" /></label>
          <label className="check-label"><input name="embed_allowed" type="checkbox" />Embedding contractually allowed</label>
          <label className="check-label"><input name="active" type="checkbox" defaultChecked />Enable after save</label>
          <button className="primary-button" disabled={create.isPending}>{create.isPending ? <LoaderCircle className="spin" /> : <Check />}Save source</button>
          {create.error && <p className="form-error">{create.error.message}</p>}
        </form>
      )}
      <div className="admin-panel">
        <PanelTitle icon={ShieldCheck} title="Approved sources" subtitle={`${query.data?.length ?? 0} providers`} />
        <div className="source-list">
          {(query.data ?? []).map((source) => (
            <div key={source.id}>
              <span className="source-icon"><Airplay /></span>
              <div><strong>{source.provider_name}</strong><small>{source.provider_domain} · {source.source_type} · expires {formatLocalDate(source.rights_expiry)}</small></div>
              <span className="territory-chip">{source.territory.join(', ')}</span>
              <span className={`permission-chip permission-chip--${source.permission_status}`}>{source.permission_status}</span>
              <button className={`table-toggle ${source.active ? 'active' : ''}`} onClick={() => toggle.mutate(source)} aria-label={source.active ? 'Disable source' : 'Enable source'}>{source.active ? <Check size={15} /> : <X size={15} />}</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

interface AdminStreamRow {
  id: string
  provider_asset_id: string
  source_type: Enums<'stream_source_type'>
  source_page_url: string
  priority: number
  status: Enums<'stream_state'>
  expires_at: string | null
  match: { id: string; home_team: { name: string }; away_team: { name: string } }
  source: { provider_name: string; active: boolean }
}

function AdminStreams() {
  const queryClient = useQueryClient()
  const matches = useQuery({ queryKey: ['admin-stream-matches'], queryFn: getMatches })
  const sources = useQuery({
    queryKey: ['admin-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approved_sources')
        .select('id,provider_name,provider_domain,source_type,official_channel_id,territory,permission_status,permission_reference,rights_expiry,source_page_url,embed_allowed,active')
        .order('provider_name')
      if (error) throw error
      return data as ApprovedSourceRow[]
    },
  })
  const streams = useQuery({
    queryKey: ['admin-streams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_streams')
        .select('id,provider_asset_id,source_type,source_page_url,priority,status,expires_at,match:matches(id,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)),source:approved_sources(provider_name,active)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as AdminStreamRow[]
    },
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-streams'] })
    void queryClient.invalidateQueries({ queryKey: ['matches'] })
    void queryClient.invalidateQueries({ queryKey: ['match'] })
  }
  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const match = matches.data?.find((item) => item.id === formString(form, 'match_id'))
      const source = sources.data?.find((item) => item.id === formString(form, 'approved_source_id'))
      if (!match || !source) throw new Error('Select a valid match and approved source.')
      if (!source.active || source.permission_status !== 'approved' || new Date(source.rights_expiry).getTime() <= Date.now()) throw new Error('The selected source is not currently authorized.')
      const embedUrl = formString(form, 'embed_url') || null
      if (source.source_type !== 'external_official_link' && !embedUrl) throw new Error('An approved embed or manifest URL is required for this source type.')
      const requestedExpiry = formString(form, 'expires_at')
      const matchFallback = new Date(new Date(match.ends_at ?? match.starts_at).getTime() + 2 * 60 * 60 * 1000)
      const expiresAt = requestedExpiry ? new Date(requestedExpiry) : new Date(Math.min(new Date(source.rights_expiry).getTime(), matchFallback.getTime()))
      const values: TablesInsert<'match_streams'> = {
        match_id: match.id,
        approved_source_id: source.id,
        provider_asset_id: formString(form, 'provider_asset_id'),
        source_type: source.source_type,
        embed_url: source.source_type === 'external_official_link' ? null : embedUrl,
        source_page_url: formString(form, 'source_page_url'),
        territory: source.territory,
        starts_at: match.starts_at,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        priority: Number(formString(form, 'priority') || 100),
      }
      const { error } = await supabase.from('match_streams').insert(values)
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'match_streams'> }) => {
      const { error } = await supabase.from('match_streams').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const eligibleSources = (sources.data ?? []).filter((source) => source.active && source.permission_status === 'approved' && new Date(source.rights_expiry).getTime() > Date.now())

  return (
    <>
      <div className="admin-actions-row"><div><h2>Authorized live streams</h2><p>Attach a verified source manually, set priority, or disable it instantly.</p></div></div>
      <form className="admin-form-grid stream-form" onSubmit={(event) => { event.preventDefault(); create.mutate(new FormData(event.currentTarget)) }}>
        <label>Match<select name="match_id" required><option value="">Choose match…</option>{matches.data?.map((match) => <option key={match.id} value={match.id}>{matchTitle(match)}</option>)}</select></label>
        <label>Approved source<select name="approved_source_id" required><option value="">Choose provider…</option>{eligibleSources.map((source) => <option key={source.id} value={source.id}>{source.provider_name} · {source.source_type}</option>)}</select></label>
        <label>Provider asset ID<input name="provider_asset_id" required placeholder="Video or contracted asset ID" /></label>
        <label>Embed/manifest URL<input name="embed_url" type="url" placeholder="Leave empty only for external links" /></label>
        <label>Original watch page<input name="source_page_url" type="url" required placeholder="Must match the approved domain" /></label>
        <label>Stream expiry<input name="expires_at" type="datetime-local" /></label>
        <label>Priority<input name="priority" type="number" min="1" max="1000" defaultValue="100" /></label>
        <button className="primary-button" disabled={create.isPending}><Radio size={16} />Attach authorized stream</button>
        {create.error && <p className="form-error">{create.error.message}</p>}
      </form>
      <div className="admin-panel">
        <PanelTitle icon={Tv} title="Stream inventory" subtitle={`${streams.data?.length ?? 0} sources attached`} />
        <div className="stream-list">
          {(streams.data ?? []).map((stream) => (
            <div key={stream.id}>
              <span className="source-icon"><Tv /></span>
              <div><strong>{stream.match.home_team.name} vs {stream.match.away_team.name}</strong><small>{stream.source.provider_name} · {stream.source_type} · {stream.provider_asset_id}</small></div>
              <label>Priority<input type="number" min="1" max="1000" defaultValue={stream.priority} onBlur={(event) => { const priority = Number(event.target.value); if (priority !== stream.priority) update.mutate({ id: stream.id, values: { priority } }) }} /></label>
              <span className={stream.status === 'active' && stream.source.active ? 'online-dot' : 'offline-dot'}>{stream.status}</span>
              <button className={`table-toggle ${stream.status === 'active' ? 'active' : ''}`} onClick={() => update.mutate({ id: stream.id, values: { status: stream.status === 'active' ? 'disabled' : 'active' } })} aria-label={stream.status === 'active' ? 'Disable stream' : 'Enable stream'}>{stream.status === 'active' ? <Check size={15} /> : <X size={15} />}</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

interface CandidateRow { id: string; match_id: string; embed_url: string | null; source_page_url: string; confidence_score: number; validation_status: string; review_status: string; discovered_at: string; match: { slug: string; home_team: { name: string }; away_team: { name: string } }; source: { provider_name: string } }

function AdminDiscovery() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin-candidates'], queryFn: async () => { const { data, error } = await supabase.from('source_candidates').select('id,match_id,embed_url,source_page_url,confidence_score,validation_status,review_status,discovered_at,match:matches(slug,home_team:teams!matches_home_team_id_fkey(name),away_team:teams!matches_away_team_id_fkey(name)),source:approved_sources(provider_name)').eq('review_status', 'pending').order('confidence_score', { ascending: false }); if (error) throw error; return data as unknown as CandidateRow[] } })
  const review = useMutation({ mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => { const { error } = await supabase.from('source_candidates').update({ review_status: status, reviewed_at: new Date().toISOString() }).eq('id', id); if (error) throw error }, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-candidates'] }) })
  return <div className="admin-panel"><PanelTitle icon={Radio} title="Source discovery queue" subtitle="Uncertain matches require a human decision" /><div className="candidate-list">{(query.data ?? []).length ? query.data?.map((candidate) => <div className="candidate-card" key={candidate.id}><div className="confidence-ring" style={{ '--score': `${candidate.confidence_score * 3.6}deg` } as React.CSSProperties}><span>{candidate.confidence_score}</span></div><div className="candidate-main"><span>{candidate.source.provider_name}</span><h3>{candidate.match.home_team.name} vs {candidate.match.away_team.name}</h3><a href={candidate.source_page_url} target="_blank" rel="noopener noreferrer">Inspect original source<ExternalLink size={13} /></a></div><div className="candidate-tags"><span>{candidate.validation_status}</span><small>{formatLocalDate(candidate.discovered_at)}</small></div><div className="candidate-actions"><button className="reject-button" onClick={() => review.mutate({ id: candidate.id, status: 'rejected' })}><X size={16} />Reject</button><button className="approve-button" onClick={() => review.mutate({ id: candidate.id, status: 'approved' })}><Check size={16} />Approve</button></div></div>) : <EmptyState message="The discovery queue is clear." />}</div></div>
}

interface AdminBanner { id: string; title_en: string; placement: string; image_url: string | null; active: boolean }
interface AdminHighlight { id: string; title: string; provider_name: string; video_url: string; active: boolean }

function AdminContent() {
  const queryClient = useQueryClient()
  const announcements = useQuery({ queryKey: ['admin-announcements'], queryFn: async () => { const { data, error } = await supabase.from('announcements').select('id,message_en,message_bn,active').order('created_at', { ascending: false }); if (error) throw error; return data as Array<{ id: string; message_en: string; message_bn: string | null; active: boolean }> } })
  const banners = useQuery({ queryKey: ['admin-banners'], queryFn: async () => { const { data, error } = await supabase.from('banners').select('id,title_en,placement,image_url,active').order('created_at', { ascending: false }); if (error) throw error; return data as AdminBanner[] } })
  const highlights = useQuery({ queryKey: ['admin-highlights'], queryFn: async () => { const { data, error } = await supabase.from('highlights').select('id,title,provider_name,video_url,active').order('published_at', { ascending: false }); if (error) throw error; return data as AdminHighlight[] } })
  const highlightSources = useQuery({ queryKey: ['admin-highlight-sources'], queryFn: async () => { const { data, error } = await supabase.from('approved_sources').select('id,provider_name').eq('active', true).eq('permission_status', 'approved').gt('rights_expiry', new Date().toISOString()).order('provider_name'); if (error) throw error; return data } })
  const refresh = () => {
    for (const key of ['admin-announcements', 'admin-banners', 'admin-highlights', 'announcements', 'highlights']) void queryClient.invalidateQueries({ queryKey: [key] })
  }
  const create = useMutation({ mutationFn: async ({ kind, form }: { kind: 'announcement' | 'banner' | 'highlight'; form: FormData }) => {
    const request = kind === 'announcement'
      ? supabase.from('announcements').insert({ message_en: formString(form, 'message_en'), message_bn: formString(form, 'message_bn') || null, active: true, starts_at: new Date().toISOString() })
      : kind === 'banner'
        ? supabase.from('banners').insert({ title_en: formString(form, 'title_en'), title_bn: formString(form, 'title_bn') || null, placement: formString(form, 'placement'), image_url: formString(form, 'image_url') || null, link_url: formString(form, 'link_url') || null, active: true })
        : supabase.from('highlights').insert({ title: formString(form, 'title'), approved_source_id: formString(form, 'approved_source_id'), provider_name: 'Validated approved provider', video_url: formString(form, 'video_url'), thumbnail_url: formString(form, 'thumbnail_url') || null, published_at: new Date().toISOString(), active: true })
    const { error } = await request
    if (error) throw error
  }, onSuccess: refresh })
  const toggle = useMutation({ mutationFn: async ({ table, id, active }: { table: 'banners' | 'highlights'; id: string; active: boolean }) => { const { error } = await supabase.from(table).update({ active }).eq('id', id); if (error) throw error }, onSuccess: refresh })
  return <><div className="admin-dashboard-grid content-grid"><form className="admin-panel content-form" onSubmit={(event) => { event.preventDefault(); create.mutate({ kind: 'announcement', form: new FormData(event.currentTarget) }); event.currentTarget.reset() }}><PanelTitle icon={MessageSquareText} title="New ticker notice" subtitle="English and Bengali" /><label>English message<textarea name="message_en" required rows={3} /></label><label>বাংলা বার্তা<textarea name="message_bn" rows={3} /></label><button className="primary-button"><MessageSquareText size={16} />Publish notice</button></form><form className="admin-panel content-form" onSubmit={(event) => { event.preventDefault(); create.mutate({ kind: 'banner', form: new FormData(event.currentTarget) }); event.currentTarget.reset() }}><PanelTitle icon={ImageIcon} title="New banner" subtitle="Homepage-managed campaign" /><label>English title<input name="title_en" required /></label><label>বাংলা শিরোনাম<input name="title_bn" /></label><label>Placement<select name="placement"><option value="home_hero">Home hero</option><option value="home_secondary">Home secondary</option><option value="highlights">Highlights</option></select></label><label>Image URL<input name="image_url" type="url" /></label><label>Destination URL<input name="link_url" type="url" /></label><button className="primary-button"><ImageIcon size={16} />Publish banner</button></form></div><div className="admin-dashboard-grid content-lists"><div className="admin-panel"><PanelTitle icon={FileText} title="Current notices" subtitle={`${announcements.data?.length ?? 0} notices`} /><div className="notice-list">{announcements.data?.map((notice) => <div key={notice.id}><span className={notice.active ? 'online-dot' : 'offline-dot'}>{notice.active ? 'Live' : 'Off'}</span><p>{notice.message_en}<small>{notice.message_bn}</small></p></div>)}</div></div><div className="admin-panel"><PanelTitle icon={ImageIcon} title="Banners" subtitle={`${banners.data?.length ?? 0} campaigns`} /><div className="media-list">{banners.data?.map((banner) => <div key={banner.id}><span><ImageIcon /></span><div><strong>{banner.title_en}</strong><small>{banner.placement}</small></div><button className={`table-toggle ${banner.active ? 'active' : ''}`} onClick={() => toggle.mutate({ table: 'banners', id: banner.id, active: !banner.active })}>{banner.active ? <Check /> : <X />}</button></div>)}</div></div></div><div className="admin-panel highlight-manager"><div className="highlight-manager__form"><PanelTitle icon={Video} title="Add official highlight" subtitle="Approved provider URLs only" /><form onSubmit={(event) => { event.preventDefault(); create.mutate({ kind: 'highlight', form: new FormData(event.currentTarget) }); event.currentTarget.reset() }}><input name="title" required placeholder="Highlight title" /><select name="approved_source_id" required defaultValue=""><option value="" disabled>Choose approved provider…</option>{highlightSources.data?.map((source) => <option key={source.id} value={source.id}>{source.provider_name}</option>)}</select><input name="video_url" type="url" required placeholder="https://official-source.example/video" /><input name="thumbnail_url" type="url" placeholder="Thumbnail URL (optional)" /><button className="primary-button"><Video size={16} />Add highlight</button></form></div><div className="media-list">{highlights.data?.map((highlight) => <div key={highlight.id}><span><Video /></span><div><strong>{highlight.title}</strong><small>{highlight.provider_name}</small></div><button className={`table-toggle ${highlight.active ? 'active' : ''}`} onClick={() => toggle.mutate({ table: 'highlights', id: highlight.id, active: !highlight.active })}>{highlight.active ? <Check /> : <X />}</button></div>)}</div></div></>
}

interface AdminPageRow { id: string; slug: string; title_en: string; title_bn: string | null; body_en: string; body_bn: string | null; published: boolean }

function AdminPages() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const query = useQuery({ queryKey: ['admin-pages'], queryFn: async () => { const { data, error } = await supabase.from('pages').select('id,slug,title_en,title_bn,body_en,body_bn,published').order('slug'); if (error) throw error; return data as AdminPageRow[] } })
  const selected = query.data?.find((page) => page.id === selectedId) ?? query.data?.[0]
  const update = useMutation({ mutationFn: async ({ id, form }: { id: string; form: FormData }) => { const { error } = await supabase.from('pages').update({ title_en: formString(form, 'title_en'), title_bn: formString(form, 'title_bn') || null, body_en: formString(form, 'body_en'), body_bn: formString(form, 'body_bn') || null, published: form.get('published') === 'on' }).eq('id', id); if (error) throw error }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin-pages'] }); void queryClient.invalidateQueries({ queryKey: ['page'] }) } })
  return <div className="page-editor"><aside className="admin-panel"><PanelTitle icon={FileText} title="Static pages" subtitle="Legal and information pages" /><div className="page-picker">{query.data?.map((page) => <button key={page.id} className={selected?.id === page.id ? 'active' : ''} onClick={() => setSelectedId(page.id)}><FileText size={15} /><span><strong>{page.title_en}</strong><small>/{page.slug}</small></span><i className={page.published ? 'online-dot' : 'offline-dot'} /></button>)}</div></aside>{selected && <form key={selected.id} className="admin-panel page-form" onSubmit={(event) => { event.preventDefault(); update.mutate({ id: selected.id, form: new FormData(event.currentTarget) }) }}><PanelTitle icon={FileText} title={`Edit /${selected.slug}`} subtitle="Changes are published through Supabase" /><div><label>English title<input name="title_en" defaultValue={selected.title_en} required /></label><label>বাংলা শিরোনাম<input name="title_bn" defaultValue={selected.title_bn ?? ''} /></label><label>English body<textarea name="body_en" rows={8} defaultValue={selected.body_en} required /></label><label>বাংলা লেখা<textarea name="body_bn" rows={8} defaultValue={selected.body_bn ?? ''} /></label><label className="check-label"><input type="checkbox" name="published" defaultChecked={selected.published} />Published</label><button className="primary-button" disabled={update.isPending}><Check size={16} />Save page</button></div></form>}</div>
}

interface AdminAd { id: string; name: string; placement: string; destination_url: string | null; active: boolean }
function AdminAds() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin-ads'], queryFn: async () => { const { data, error } = await supabase.from('advertisements').select('id,name,placement,destination_url,active').order('created_at', { ascending: false }); if (error) throw error; return data as AdminAd[] } })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin-ads'] })
  const create = useMutation({ mutationFn: async (form: FormData) => { const { error } = await supabase.from('advertisements').insert({ name: formString(form, 'name'), placement: formString(form, 'placement'), image_url: formString(form, 'image_url') || null, destination_url: formString(form, 'destination_url') || null, active: false }); if (error) throw error }, onSuccess: refresh })
  const toggle = useMutation({ mutationFn: async (ad: AdminAd) => { const { error } = await supabase.from('advertisements').update({ active: !ad.active }).eq('id', ad.id); if (error) throw error }, onSuccess: refresh })
  return <><div className="admin-welcome ad-notice"><div><span>OPTIONAL REVENUE</span><h2>Advertising is disabled by default.</h2><p>No fake buttons, forced redirects or overlays may cover player controls.</p></div><ShieldCheck size={40} /></div><div className="admin-dashboard-grid ads-grid"><form className="admin-panel content-form" onSubmit={(event) => { event.preventDefault(); create.mutate(new FormData(event.currentTarget)); event.currentTarget.reset() }}><PanelTitle icon={Settings} title="Create advertisement" subtitle="Saved inactive for review" /><label>Campaign name<input name="name" required /></label><label>Placement<select name="placement"><option value="home_banner">Home banner</option><option value="match_card">Match card</option><option value="pre_player">Pre-player banner</option><option value="player_sidebar">Player sidebar</option><option value="footer">Footer</option></select></label><label>Image URL<input name="image_url" type="url" /></label><label>Destination URL<input name="destination_url" type="url" /></label><button className="primary-button"><Check size={16} />Save inactive ad</button></form><div className="admin-panel"><PanelTitle icon={Settings} title="Ad placements" subtitle={`${query.data?.length ?? 0} campaigns`} /><div className="media-list">{query.data?.map((ad) => <div key={ad.id}><span><Settings /></span><div><strong>{ad.name}</strong><small>{ad.placement} · {ad.destination_url || 'No destination'}</small></div><button className={`table-toggle ${ad.active ? 'active' : ''}`} onClick={() => toggle.mutate(ad)}>{ad.active ? <Check /> : <X />}</button></div>)}</div></div></div></>
}

function AdminBranding() {
  const { settings } = useApp()
  const queryClient = useQueryClient()
  const update = useMutation({
    mutationFn: async (form: FormData) => {
      const socialLinks = {
        facebook: formString(form, 'facebook_url'),
        youtube: formString(form, 'youtube_url'),
        x: formString(form, 'x_url'),
      }
      const values: TablesUpdate<'site_settings'> = {
        site_name: formString(form, 'site_name'),
        tagline: formString(form, 'tagline'),
        logo_url: formString(form, 'logo_url') || null,
        favicon_url: formString(form, 'favicon_url') || null,
        primary_color: formString(form, 'primary_color'),
        discovery_threshold: Number(formString(form, 'discovery_threshold')),
        discovery_interval_minutes: Number(formString(form, 'discovery_interval_minutes')),
        default_language: formString(form, 'default_language'),
        social_links: Object.fromEntries(Object.entries(socialLinks).filter(([, value]) => value)),
        ads_enabled: form.get('ads_enabled') === 'on',
        footer_text: formString(form, 'footer_text'),
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('site_settings').update(values).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })
  return (
    <form className="admin-panel branding-form" onSubmit={(event) => { event.preventDefault(); update.mutate(new FormData(event.currentTarget)) }}>
      <PanelTitle icon={Sparkles} title="Branding and automation" subtitle="Changes apply without editing code" />
      <div className="admin-form-grid">
        <label>Site name<input name="site_name" defaultValue={settings.site_name} required /></label>
        <label>Primary colour<input name="primary_color" type="color" defaultValue={settings.primary_color} /></label>
        <label className="span-two">Tagline<input name="tagline" defaultValue={settings.tagline} /></label>
        <label>Logo URL<input name="logo_url" type="url" defaultValue={settings.logo_url ?? ''} /></label>
        <label>Favicon URL<input name="favicon_url" type="url" defaultValue={settings.favicon_url ?? ''} /></label>
        <label>Default language<select name="default_language" defaultValue={settings.default_language}><option value="en">English</option><option value="bn">বাংলা</option></select></label>
        <label>Auto-approval confidence<input name="discovery_threshold" type="number" min="50" max="100" defaultValue={settings.discovery_threshold} /></label>
        <label>Discovery interval (minutes)<input name="discovery_interval_minutes" type="number" min="5" max="1440" defaultValue={settings.discovery_interval_minutes} /></label>
        <label className="check-label"><input name="ads_enabled" type="checkbox" defaultChecked={settings.ads_enabled} />Enable active advertisements</label>
        <label>Facebook URL<input name="facebook_url" type="url" defaultValue={settings.social_links.facebook ?? ''} /></label>
        <label>YouTube URL<input name="youtube_url" type="url" defaultValue={settings.social_links.youtube ?? ''} /></label>
        <label>X / Twitter URL<input name="x_url" type="url" defaultValue={settings.social_links.x ?? ''} /></label>
        <label className="span-two">Footer notice<textarea name="footer_text" rows={3} defaultValue={settings.footer_text} /></label>
      </div>
      <button className="primary-button" disabled={update.isPending}>{update.isPending ? <LoaderCircle className="spin" /> : <Check />}Save settings</button>
      {update.error && <p className="form-error">{update.error.message}</p>}
    </form>
  )
}

interface LogRow { id: string; job_type: string; status: string; started_at: string; finished_at: string | null; records_processed: number; error_message: string | null }
interface PlaybackLogRow { id: string; event_type: string; error_code: string | null; territory: string | null; created_at: string; match_stream_id: string | null }
interface AuditLogRow { id: string; action: string; entity_type: string; entity_id: string | null; created_at: string; admin_id: string | null }

function AdminLogs() {
  const [tab, setTab] = useState<'sync' | 'playback' | 'audit'>('sync')
  const sync = useQuery({ queryKey: ['admin-logs', 'sync'], queryFn: async () => { const { data, error } = await supabase.from('sync_logs').select('id,job_type,status,started_at,finished_at,records_processed,error_message').order('started_at', { ascending: false }).limit(100); if (error) throw error; return data as LogRow[] } })
  const playback = useQuery({ queryKey: ['admin-logs', 'playback'], queryFn: async () => { const { data, error } = await supabase.from('playback_logs').select('id,event_type,error_code,territory,created_at,match_stream_id').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data as PlaybackLogRow[] } })
  const audit = useQuery({ queryKey: ['admin-logs', 'audit'], queryFn: async () => { const { data, error } = await supabase.from('admin_audit_logs').select('id,action,entity_type,entity_id,created_at,admin_id').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data as AuditLogRow[] } })
  return (
    <>
      <div className="admin-tabbar">{(['sync', 'playback', 'audit'] as const).map((value) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value}</button>)}</div>
      <div className="admin-panel">
        <PanelTitle icon={Database} title={tab === 'sync' ? 'Synchronization logs' : tab === 'playback' ? 'Playback events' : 'Administrator audit trail'} subtitle="Latest 100 records" />
        <div className="admin-table-wrap">
          {tab === 'sync' && <table className="admin-table"><thead><tr><th>Job</th><th>Status</th><th>Started</th><th>Records</th><th>Message</th></tr></thead><tbody>{sync.data?.map((log) => <tr key={log.id}><td>{log.job_type}</td><td><span className={`permission-chip permission-chip--${log.status === 'success' ? 'approved' : log.status}`}>{log.status}</span></td><td>{formatLocalDate(log.started_at)}</td><td>{log.records_processed}</td><td>{log.error_message || 'Completed normally'}</td></tr>)}</tbody></table>}
          {tab === 'playback' && <table className="admin-table"><thead><tr><th>Event</th><th>Stream</th><th>Territory</th><th>Time</th><th>Error</th></tr></thead><tbody>{playback.data?.map((log) => <tr key={log.id}><td>{log.event_type}</td><td>{log.match_stream_id || 'Unavailable'}</td><td>{log.territory || '—'}</td><td>{formatLocalDate(log.created_at)}</td><td>{log.error_code || 'None'}</td></tr>)}</tbody></table>}
          {tab === 'audit' && <table className="admin-table"><thead><tr><th>Action</th><th>Entity</th><th>Entity ID</th><th>Admin</th><th>Time</th></tr></thead><tbody>{audit.data?.map((log) => <tr key={log.id}><td>{log.action}</td><td>{log.entity_type}</td><td>{log.entity_id || '—'}</td><td>{log.admin_id || 'System'}</td><td>{formatLocalDate(log.created_at)}</td></tr>)}</tbody></table>}
        </div>
      </div>
    </>
  )
}

function PanelTitle({ icon: Icon, title, subtitle }: { icon: typeof Activity; title: string; subtitle: string }) {
  return <div className="panel-title"><span><Icon size={19} /></span><div><h3>{title}</h3><small>{subtitle}</small></div></div>
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) { return <div><span><i className={ok ? 'ok' : ''} />{label}</span><strong>{value}</strong></div> }

function MatchSkeletons() { return <div className="match-grid">{[1, 2, 3].map((item) => <div className="match-skeleton" key={item}><span /><span /><span /><span /></div>)}</div> }

function EmptyState({ message }: { message: string }) { return <div className="empty-state"><span><MoonStar size={26} /></span><h3>{message}</h3><p>Try another category or check back after the next schedule sync.</p></div> }

function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="empty-state"><span><XCircle size={26} /></span><h3>Could not load match data.</h3><p>The cached interface remains available while the connection recovers.</p><button className="secondary-button" onClick={onRetry}><RefreshCw size={16} />Try again</button></div> }

function NotFound() { return <div className="not-found"><span>404</span><h1>That page is offside.</h1><p>The route may have moved or the match is no longer listed.</p><Link className="primary-button" to="/"><House size={17} />Return home</Link></div> }

export default App
