/**
 * Ad style registry. To add a new animated ad style later:
 *  1. add an entry here (id, label, keywords used to auto-pick it, defaults),
 *  2. add a matching scene component in AdPlayer.tsx (SCENES map).
 * Brands shown in templates are always the user's own — no real company names or logos are used.
 */
export type TemplateId = 'food' | 'ride' | 'music' | 'brand';

export interface AdSpec { template: TemplateId; brand: string; tagline: string; items: string[]; accent: string }

export interface TemplateMeta {
  id: TemplateId; label: string; blurb: string; itemsLabel: string; keywords: RegExp; example: string;
  needsImage: boolean; length: number; // ms per loop
  defaults: (ctx: { topic: string; venue: string; brand: string; goal: string }) => Omit<AdSpec, 'template' | 'brand'>;
}

const has = (s: string, re: RegExp) => re.test(s.toLowerCase());

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'food', label: 'Food slider', blurb: 'Big flavour names behind a spinning bowl, colours change with every dish.', itemsLabel: 'Dishes or flavours (comma separated)',
    keywords: /smoothie|food|cafe|café|restaurant|bowl|juice|bakery|cake|pizza|burger|coffee|tea|dessert|ice ?cream|kitchen|snack|meal|dosa|biryani/i,
    example: 'Promote Freshify smoothie bowls in Mumbai', needsImage: false, length: 9600,
    defaults: ({ goal }) => ({
      tagline: 'Fresh bowls, made to order',
      items: has(goal, /coffee|cafe|café/) ? ['Mocha', 'Caramel', 'Hazelnut', 'Vanilla'] : has(goal, /pizza/) ? ['Margherita', 'Pepperoni', 'Farmhouse', 'Paneer'] : ['Strawberry', 'Chocolate', 'Blackberry', 'Blueberry'],
      accent: '#C81E3A',
    }),
  },
  {
    id: 'ride', label: 'Ride app story', blurb: 'Clean white motion: search, pick a ride, driver found, driver approaching.', itemsLabel: 'Pickup place shown in the ad',
    keywords: /ride|cab|taxi|driver|rider|bike taxi|auto|delivery app|courier|commute|transport app|carpool/i,
    example: 'Get riders for my cab app Rydo in Pune', needsImage: false, length: 11000,
    defaults: ({ venue }) => ({ tagline: 'Go anywhere, fast', items: [venue ? `${venue} Station` : 'City Centre'], accent: '#111111' }),
  },
  {
    id: 'music', label: 'Music app story', blurb: 'Dark screen with a green glow, tilted phone, playlists and album art.', itemsLabel: 'Songs or playlists (comma separated)',
    keywords: /music|song|album|playlist|podcast|artist|band|singer|concert|dj|beats|audio|streaming/i,
    example: 'Promote my music app Tunely to young listeners', needsImage: false, length: 11000,
    defaults: () => ({ tagline: 'Listen to your favourite artists', items: ['Sleeping Music', 'Alone at Prom', 'Random Access', 'Fallen Star'], accent: '#1ED760' }),
  },
  {
    id: 'brand', label: 'Your brand', blurb: 'Your name, your photo, three reasons to choose you, and your links.', itemsLabel: 'Three reasons to choose you (comma separated)',
    keywords: /$^/, example: '', needsImage: true, length: 9000,
    defaults: () => ({ tagline: 'Made with care, just for you', items: ['Trusted by locals', 'Easy to book', 'Great value'], accent: '#8B5CF6' }),
  },
];
export const tpl = (id: TemplateId) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1];
export const detectTemplate = (text: string): TemplateId => TEMPLATES.find((t) => t.keywords.test(text))?.id ?? 'brand';

/** Picks a likely brand name: the first capitalised word that isn't the first word or the place. */
export function guessBrand(goal: string, venue: string, topic: string) {
  const words = goal.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  const skip = new Set(['I', ...venue.split(/\s+/)]);
  const w = words.slice(1).find((x) => /^[A-Z][\p{L}\p{N}'-]{2,}$/u.test(x) && !skip.has(x));
  return w ?? topic.split(' ').slice(0, 2).join(' ');
}

/* ---------------- social handles ---------------- */
export const cleanHandle = (s: string) => s.trim()
  .replace(/^https?:\/\/(www\.)?(instagram\.com|youtube\.com|youtu\.be)\//i, '')
  .replace(/^(c\/|channel\/|user\/)/i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
export const validHandle = (s: string) => !s || /^[A-Za-z0-9._-]{1,40}$/.test(s);
export const igUrl = (h: string) => `https://www.instagram.com/${h}/`;
export const ytUrl = (h: string) => (/^UC[\w-]{20,}$/.test(h) ? `https://www.youtube.com/channel/${h}` : `https://www.youtube.com/@${h}`);

/** Reads "insta @foo, yt @bar" style answers. Bare handles go to Instagram. */
export function parseSocials(text: string) {
  const out: { instagram?: string; youtube?: string } = {};
  for (const part of text.split(/,|\band\b|\n|;/i).map((p) => p.trim()).filter(Boolean)) {
    const isYt = /youtu|\byt\b|youtube/i.test(part);
    const h = cleanHandle(part.replace(/^(insta(gram)?|ig|yt|youtube)\s*[:\-]?\s*/i, '').replace(/^(my\s+)?(handle|id|channel)\s*(is)?\s*/i, ''));
    if (!h || !validHandle(h)) continue;
    if (isYt) out.youtube = h; else out.instagram = h;
  }
  return out;
}

/** Colour for a flavour or dish name; falls back to a rotating palette. */
const FLAVOUR: [RegExp, string][] = [
  [/straw|cherry|rasp|watermelon|tomato|margherita|pepperoni/i, '#B3122E'], [/choc|cocoa|mocha|coffee|caramel|hazel|brownie/i, '#5A2E1A'],
  [/blackberry|black ?berry|grape|plum|jamun|acai|açaí/i, '#5B1E4F'], [/blue/i, '#2B3A8C'], [/mango|orange|peach|turmeric|farmhouse/i, '#C2561A'],
  [/matcha|kiwi|mint|green|avocado|pista|paneer/i, '#2F6B2F'], [/vanilla|banana|coconut|lemon/i, '#8A6A1E'],
];
const PALETTE = ['#B3122E', '#5A2E1A', '#5B1E4F', '#2B3A8C', '#C2561A', '#2F6B2F'];
export const flavourColor = (name: string, i: number) => FLAVOUR.find(([re]) => re.test(name))?.[1] ?? PALETTE[i % PALETTE.length];
