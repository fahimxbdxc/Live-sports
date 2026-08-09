import type { Announcement, Highlight, Match, SiteSettings, StaticPage } from '../types'

const future = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

const team = (id: string, name: string, shortName: string, country: string) => ({
  id,
  name,
  short_name: shortName,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  logo_url: null,
  country,
})

export const demoMatches: Match[] = [
  {
    id: 'demo-1', slug: 'barcelona-v-real-madrid-demo', title: null, starts_at: future(-0.4), ends_at: future(1.6),
    status: 'live', home_score: 1, away_score: 1, clock: '62\'', venue: 'Demo Stadium', featured: true, is_demo: true,
    home_team: team('barcelona', 'Barcelona', 'BAR', 'Spain'), away_team: team('real-madrid', 'Real Madrid', 'RMA', 'Spain'),
    competition: { id: 'laliga', name: 'La Liga', slug: 'la-liga', country: 'Spain', logo_url: null, sport: { id: 'football', name: 'Football', slug: 'football' } },
    match_streams: [],
  },
  {
    id: 'demo-2', slug: 'liverpool-v-arsenal-demo', title: null, starts_at: future(5), ends_at: future(7),
    status: 'scheduled', home_score: null, away_score: null, clock: null, venue: 'Demo Arena', featured: true, is_demo: true,
    home_team: team('liverpool', 'Liverpool', 'LIV', 'England'), away_team: team('arsenal', 'Arsenal', 'ARS', 'England'),
    competition: { id: 'epl', name: 'Premier League', slug: 'premier-league', country: 'England', logo_url: null, sport: { id: 'football', name: 'Football', slug: 'football' } },
    match_streams: [],
  },
  {
    id: 'demo-3', slug: 'bangladesh-v-pakistan-demo', title: null, starts_at: future(27), ends_at: future(34),
    status: 'scheduled', home_score: null, away_score: null, clock: null, venue: 'Demo Cricket Ground', featured: false, is_demo: true,
    home_team: team('bangladesh', 'Bangladesh', 'BAN', 'Bangladesh'), away_team: team('pakistan', 'Pakistan', 'PAK', 'Pakistan'),
    competition: { id: 'cricket', name: 'International Cricket', slug: 'international-cricket', country: null, logo_url: null, sport: { id: 'cricket', name: 'Cricket', slug: 'cricket' } },
    match_streams: [],
  },
  {
    id: 'demo-4', slug: 'inter-miami-v-la-galaxy-demo', title: null, starts_at: future(52), ends_at: future(54),
    status: 'scheduled', home_score: null, away_score: null, clock: null, venue: 'Demo Field', featured: false, is_demo: true,
    home_team: team('inter-miami', 'Inter Miami', 'MIA', 'USA'), away_team: team('la-galaxy', 'LA Galaxy', 'LAG', 'USA'),
    competition: { id: 'mls', name: 'Major League Soccer', slug: 'mls', country: 'USA', logo_url: null, sport: { id: 'football', name: 'Football', slug: 'football' } },
    match_streams: [],
  },
]

export const demoHighlights: Highlight[] = [
  { id: 'highlight-1', title: 'Official highlights appear here after provider approval', thumbnail_url: null, video_url: '#', published_at: future(-10), provider_name: 'Live Sports TV' },
  { id: 'highlight-2', title: 'Match recaps from verified official channels', thumbnail_url: null, video_url: '#', published_at: future(-28), provider_name: 'Approved channels only' },
]

export const demoSettings: SiteSettings = {
  site_name: 'Live Sports TV',
  tagline: 'Every match. One place. Official sources only.',
  default_language: 'en',
  logo_url: null,
  favicon_url: null,
  primary_color: '#25d9ff',
  discovery_threshold: 82,
  discovery_interval_minutes: 10,
  ads_enabled: false,
  social_links: {},
  footer_text: 'Schedules and streams are provided from approved official sources only.',
}

export const demoAnnouncements: Announcement[] = [{
  id: 'demo-announcement',
  message_en: 'Free access • No subscription • Official and authorized viewing sources only',
  message_bn: 'সম্পূর্ণ ফ্রি • কোনো সাবস্ক্রিপশন নেই • শুধুমাত্র অনুমোদিত অফিসিয়াল সোর্স',
}]

export const demoPages: StaticPage[] = [
  { slug: 'about', title_en: 'About Us', title_bn: 'আমাদের সম্পর্কে', body_en: 'Live Sports TV helps fans discover schedules, official broadcasts and authorized highlights in one fast, mobile-first experience.', body_bn: 'Live Sports TV একটি দ্রুত ও মোবাইল-বান্ধব প্ল্যাটফর্ম, যেখানে খেলার সময়সূচি, অফিসিয়াল সম্প্রচার ও অনুমোদিত হাইলাইট পাওয়া যায়।' },
  { slug: 'contact', title_en: 'Contact Us', title_bn: 'যোগাযোগ', body_en: 'Use the contact information configured by the site administrator.', body_bn: 'সাইট অ্যাডমিনের নির্ধারিত যোগাযোগের মাধ্যমে আমাদের সঙ্গে যোগাযোগ করুন।' },
  { slug: 'privacy', title_en: 'Privacy Policy', title_bn: 'গোপনীয়তা নীতি', body_en: 'We store only the information needed for authentication, favourites and reminders. We do not sell personal data.', body_bn: 'লগইন, ফেভারিট ও রিমাইন্ডারের জন্য প্রয়োজনীয় তথ্যই সংরক্ষণ করা হয়।' },
  { slug: 'terms', title_en: 'Terms and Conditions', title_bn: 'শর্তাবলি', body_en: 'Use this service lawfully. Availability depends on official providers, territories and rights windows.', body_bn: 'আইনসম্মতভাবে সেবা ব্যবহার করুন। সম্প্রচারের প্রাপ্যতা অফিসিয়াল প্রদানকারী, অঞ্চল ও স্বত্বের সময়সীমার ওপর নির্ভরশীল।' },
  { slug: 'copyright', title_en: 'Copyright Policy', title_bn: 'কপিরাইট নীতি', body_en: 'Live Sports TV does not restream or rehost protected broadcasts. Sources remain with their respective rights holders.', body_bn: 'Live Sports TV কোনো সুরক্ষিত সম্প্রচার পুনঃসম্প্রচার বা হোস্ট করে না।' },
  { slug: 'dmca', title_en: 'DMCA / Content Removal', title_bn: 'কনটেন্ট অপসারণ নীতি', body_en: 'Rights holders may submit a complete removal request identifying the content, ownership and source URL.', body_bn: 'স্বত্বাধিকারীরা কনটেন্ট, মালিকানা ও সোর্স URL উল্লেখ করে অপসারণের অনুরোধ জানাতে পারেন।' },
]
