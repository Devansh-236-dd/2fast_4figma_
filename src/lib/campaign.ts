/**
 * Living Ads — campaign model and a small, deterministic demo assistant.
 * No AI service and no ad account is connected: questions, plan text and performance numbers are
 * produced by plain functions so the demo behaves the same way every time. Nothing is ever spent.
 */
import { rid } from './ids';
import { store, useStore } from '../store';
import { TEMPLATES, detectTemplate, guessBrand, parseSocials, tpl, type AdSpec, type TemplateId } from '../ads/meta';

export type Objective = '' | 'Bookings' | 'Website visits' | 'Messages' | 'Sign-ups';
export type Cta = 'Book now' | 'Learn more' | 'Send message' | 'Sign up';
export type QKey = 'objective' | 'audience' | 'location' | 'dates' | 'budget' | 'offer' | 'creative' | 'socials';
export interface ChatMsg { from: 'ai' | 'me'; text: string; why?: string; chips?: string[]; added?: string[]; ts: number }

export interface Campaign {
  id: string; createdAt: number; updatedAt: number;
  goal: string; topic: string; venue: string;
  name: string; objective: Objective;
  audience: string; ageMin: number; ageMax: number; location: string;
  startDate: string; endDate: string;
  budget: number; // total budget limit in rupees — a hard cap
  offer: string; headline: string; primaryText: string; cta: Cta;
  image: string | null; imageName: string;
  facebook: boolean; instagram: boolean;
  /** Animated ad style and its text. Optional so campaigns saved before this existed still load. */
  ad?: AdSpec; igHandle?: string; ytHandle?: string;
  status: 'paused' | 'live' | 'ended';
  planReady: boolean; asked: QKey[]; pending: QKey | null;
  approvedAt: number | null; launchedAt: number | null; pausedSpend: number;
  chat: ChatMsg[];
}

export const MIN_BUDGET = 1000;
export const MIN_DAILY = 100;
export const inr = (r: number) => '₹' + Math.round(r).toLocaleString('en-IN');
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const addDays = (n: number, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return iso(d); };
export const days = (c: Pick<Campaign, 'startDate' | 'endDate'>) => {
  if (!c.startDate || !c.endDate) return 0;
  return Math.round((Date.parse(c.endDate) - Date.parse(c.startDate)) / 864e5) + 1;
};
export const daily = (c: Campaign) => { const d = days(c); return d > 0 ? Math.floor(c.budget / d) : 0; };
export const fmtDate = (s: string) => s ? new Date(s + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const title = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/'S\b/g, "'s");

/* ---------------- reading the goal ---------------- */
export function readGoal(goal: string) {
  const g = goal.trim().replace(/\s+/g, ' ');
  const lower = g.toLowerCase();
  const venueM = g.match(/\b(?:in|at)\s+([A-Za-z][A-Za-z .'-]*?)(?=[,.!?]|\s+(?:for|this|next|on|from|to|with|during|by)\b|$)/i);
  const venue = venueM ? title(venueM[1].trim()) : '';
  const topicM = lower.match(/\b(?:promote|advertise|market|sell|launch|grow|fill|book(?:ings for)?)\s+(?:my|our|a|an|the)?\s*(.+?)(?=\s+(?:in|at|for|to|this|next)\b|[,.!?]|$)/);
  const forM = topicM ? null : lower.match(/\b(?:for|to)\s+(?:my|our|the|a|an)\s+(.+?)(?=\s+(?:in|at)\b|[,.!?]|$)/);
  const topic = topicM ? title(topicM[1].trim()) : forM ? title(forM[1].trim()) : title(lower.split(/\s+in\s+/)[0].replace(/^i (want|need) to\s*/, '').slice(0, 40));
  let objective: Objective = '';
  if (/retreat|event|workshop|class|course|trip|tour|stay|hotel|camp|concert|seat|ticket|table|appointment/.test(lower)) objective = 'Bookings';
  else if (/website|store|shop|sale|product|collection|launch/.test(lower)) objective = 'Website visits';
  else if (/whatsapp|message|enquir|inquir|call/.test(lower)) objective = 'Messages';
  else if (/sign ?up|newsletter|waitlist|lead|webinar|register/.test(lower)) objective = 'Sign-ups';
  if (!objective) { const tp = detectTemplate(g); if (tp === 'food') objective = 'Website visits'; else if (tp === 'ride' || tp === 'music') objective = 'Sign-ups'; }
  const kids = /child|kid|teen|school|parent/.test(lower);
  return { venue, topic: topic || 'Your Offer', objective, kids };
}

const CTA_FOR: Record<Exclude<Objective, ''>, Cta> = { Bookings: 'Book now', 'Website visits': 'Learn more', Messages: 'Send message', 'Sign-ups': 'Sign up' };

export function newCampaign(goal: string): Campaign {
  const r = readGoal(goal);
  const now = Date.now();
  const c: Campaign = {
    id: rid('c_', 8), createdAt: now, updatedAt: now,
    goal: goal.trim(), topic: r.topic, venue: r.venue,
    name: r.venue ? `${r.topic} · ${r.venue}` : r.topic, objective: r.objective,
    audience: '', ageMin: r.kids ? 28 : 21, ageMax: r.kids ? 50 : 45, location: '',
    startDate: '', endDate: '', budget: 0,
    offer: '', headline: '', primaryText: '', cta: r.objective ? CTA_FOR[r.objective] : 'Learn more',
    image: null, imageName: '', facebook: true, instagram: true,
    status: 'paused', planReady: false, asked: [], pending: null,
    approvedAt: null, launchedAt: null, pausedSpend: 0,
    chat: [{ from: 'me', text: goal.trim(), ts: now }],
  };
  c.ad = defaultAd(c);
  const heard: string[] = [];
  if (r.topic) heard.push(`what you're promoting: ${r.topic}`);
  if (r.venue) heard.push(`where it happens: ${r.venue}`);
  if (r.objective) heard.push(`what success looks like: ${r.objective.toLowerCase()}`);
  c.chat.push({ from: 'ai', ts: now, text: heard.length ? `Great goal. I've already picked up ${heard.join(', ')}. I'll ask only what I still need — usually five quick questions.` : `Great — let's build this together. I'll ask only what I need.` });
  heard.length && c.chat.push({ from: 'ai', ts: now, text: `I've started an animated ad in the “${tpl(c.ad.template).label}” style for ${c.ad.brand} — watch it build in the preview.`, added: ['Animated ad'] });
  return askNext(c);
}

export function defaultAd(c: Pick<Campaign, 'goal' | 'topic' | 'venue'>, template?: TemplateId): AdSpec {
  const id = template ?? detectTemplate(c.goal);
  const brand = guessBrand(c.goal, c.venue, c.topic);
  return { template: id, brand, ...tpl(id).defaults({ topic: c.topic, venue: c.venue, brand, goal: c.goal }) };
}
/** The ad spec for any campaign, including ones saved before animated ads existed. */
export const adOf = (c: Campaign): AdSpec => c.ad ?? defaultAd(c);

/* ---------------- questions ---------------- */
const ORDER: QKey[] = ['objective', 'audience', 'location', 'dates', 'budget', 'offer', 'creative', 'socials'];
function question(k: QKey, c: Campaign): Omit<ChatMsg, 'ts' | 'from'> {
  const kids = readGoal(c.goal).kids;
  switch (k) {
    case 'objective': return { text: 'What should people do after seeing your ad?', why: 'This decides what Meta optimises for — bookings and visits need different ads.', chips: ['Book a spot', 'Visit my website', 'Message me on WhatsApp', 'Sign up for updates'] };
    case 'audience': return { text: 'Who is this for? Describe the people most likely to say yes.', why: 'A clear audience is the biggest factor in what each result costs you.', chips: kids ? ['Parents of children aged 6–14', 'Families who travel abroad', 'Schools and teachers'] : ['Young professionals 22–35', 'Parents 28–45', 'Students 18–24'] };
    case 'location': return { text: c.venue ? `Your ${c.topic.toLowerCase()} is in ${c.venue}. Where do the people you want to reach live?` : 'Where do the people you want to reach live?', why: 'People travel to you, so we target where they live — not where the event is.', chips: ['Mumbai, Delhi & Bengaluru', 'All of India', 'Singapore & Dubai'] };
    case 'dates': return { text: 'When should the ads run?', why: 'Ads usually work best in the 2–6 weeks before a date or deadline.', chips: ['Start tomorrow · 14 days', 'Start tomorrow · 30 days', 'Start next week · 21 days'] };
    case 'budget': return { text: 'What is the most you want to spend in total?', why: 'This is a hard limit. Living Ads will never spend more than this, and nothing is spent until you approve.', chips: ['₹10,000', '₹25,000', '₹50,000'] };
    case 'offer': return { text: 'What does it cost, and is there an offer?', why: 'A clear price or offer in the ad usually gets more people to act.', chips: ['Early-bird 15% off', 'Free call to learn more', 'No offer'] };
    case 'creative': return adOf(c).template === 'brand'
      ? { text: 'Do you have a photo for the ad?', why: 'Facebook and Instagram ads need an image. A real photo of your place or people works best.', chips: ['Upload an image', 'Use a sample image for now', 'Add it later'] }
      : { text: `Your animated ${tpl(adOf(c).template).label.toLowerCase()} ad is ready to use. Want to add a photo as well?`, why: 'The animated ad already works on its own. A real photo is optional and can be used later.', chips: ['Use the animated ad only', 'Upload an image', 'Add it later'] };
    case 'socials': return { text: 'Last one: where can people find you? Type your Instagram and/or YouTube handle.', why: 'I’ll add clickable Instagram and YouTube icons to your ad, and you can copy them anywhere. Example: “insta @freshify, yt @freshifyfoods”.', chips: ['Skip for now'] };
  }
}

function askNext(c: Campaign): Campaign {
  const need = ORDER.find((k) => !c.asked.includes(k) && !(k === 'objective' && c.objective));
  if (!need) return finishPlan(c);
  const q = question(need, c);
  return { ...c, pending: need, chat: [...c.chat, { from: 'ai', ts: Date.now(), ...q }] };
}

export const OBJ_FROM: Record<string, Objective> = { 'book a spot': 'Bookings', 'visit my website': 'Website visits', 'message me on whatsapp': 'Messages', 'sign up for updates': 'Sign-ups' };

/** Apply one answer from chat. Returns the updated campaign; bad input re-asks without losing anything. */
export function answer(c0: Campaign, raw: string): Campaign {
  const text = raw.trim();
  if (!text) return c0;
  let c: Campaign = { ...c0, chat: [...c0.chat, { from: 'me', text, ts: Date.now() }] };
  const k = c.pending;
  if (!k) return followUp(c, text);
  const say = (t: string, added?: string[]) => { c = { ...c, chat: [...c.chat, { from: 'ai', text: t, added, ts: Date.now() }] }; };
  const lower = text.toLowerCase();
  if (k === 'objective') {
    const o = OBJ_FROM[lower] ?? (/book/.test(lower) ? 'Bookings' : /site|visit|shop/.test(lower) ? 'Website visits' : /whatsapp|message|chat/.test(lower) ? 'Messages' : /sign|lead|update/.test(lower) ? 'Sign-ups' : '');
    if (!o) { say('I didn’t quite get that. Pick one of the options below — you can change it later in the plan.'); return reask(c, k); }
    c = { ...c, objective: o, cta: CTA_FOR[o] }; say(`Got it — I’ll optimise for ${o.toLowerCase()}.`, ['Goal']);
  } else if (k === 'audience') {
    c = { ...c, audience: text }; say('Noted. I’ll also let Meta find similar people who are likely to respond.', ['Audience']);
  } else if (k === 'location') {
    c = { ...c, location: text }; say(`I’ll show ads to people in ${text}.`, ['Location']);
  } else if (k === 'dates') {
    const n = Number((lower.match(/(\d+)\s*(?:day|d\b)/) ?? [])[1]);
    const nextWeek = /next week/.test(lower);
    if (!n) { say('I couldn’t read those dates. Pick an option, or set exact dates in the plan.'); return reask(c, k); }
    const start = addDays(nextWeek ? 7 : 1);
    c = { ...c, startDate: start, endDate: addDays(n - 1, new Date(start + 'T00:00')) };
    say(`Running ${fmtDate(c.startDate)} to ${fmtDate(c.endDate)} (${n} days).`, ['Schedule']);
  } else if (k === 'budget') {
    const n = Number(text.replace(/[^\d.]/g, '')) * (/\bk\b|k$/.test(lower) ? 1000 : /lakh|lac/.test(lower) ? 100000 : 1);
    if (!n || !isFinite(n)) { say('Please type an amount in rupees, like 15000.'); return reask(c, k); }
    if (n < MIN_BUDGET) { say(`Meta needs a bit more to learn who responds. Please choose at least ${inr(MIN_BUDGET)}.`); return reask(c, k); }
    c = { ...c, budget: Math.round(n) };
    const d = daily(c);
    say(`Budget limit set to ${inr(n)}${d ? ` — about ${inr(d)} a day` : ''}. I’ll never go above it.`, ['Budget limit']);
  } else if (k === 'offer') {
    c = { ...c, offer: /^no offer$/i.test(text) ? '' : text }; say(c.offer ? 'Nice — I’ll put that up front in the ad.' : 'No problem, I’ll keep the ad simple.', ['Offer']);
  } else if (k === 'creative') {
    if (/animated/.test(lower)) say('Great — the animated ad will be your creative.', ['Animated ad']);
    else if (c.image && !/sample|later|skip/.test(lower)) say('Photo added — that will work well in the feed.', ['Ad image']);
    else if (/sample/.test(lower)) { c = { ...c, image: SAMPLE_IMAGE, imageName: 'Sample image' }; say('I’ve added a sample image so you can see the ad. Swap it for a real photo before launch if you can.', ['Ad image']); }
    else if (/later|skip|no\b/.test(lower)) say('No problem. I’ll mark the image as missing — you can’t launch without one, but everything else is saved.');
    else if (/upload/.test(lower)) { say('Use “Add image” in the plan to choose a photo.'); }
    else say('I’ll mark the image as missing for now.');
  } else if (k === 'socials') {
    const found = parseSocials(text);
    if (/^skip/i.test(lower) || (!found.instagram && !found.youtube && /no|none|later/.test(lower))) say('No problem — you can add your links in the plan any time.');
    else if (!found.instagram && !found.youtube) { say('I couldn’t read a handle there. Try “insta @yourname” or “yt @yourchannel”, or skip.'); return reask(c, k); }
    else { c = { ...c, igHandle: found.instagram ?? c.igHandle, ytHandle: found.youtube ?? c.ytHandle }; say(`Added ${[found.instagram && `Instagram @${found.instagram}`, found.youtube && `YouTube @${found.youtube}`].filter(Boolean).join(' and ')}. The icons on your ad open your profile.`, ['Social links']); }
  }
  c = { ...c, asked: [...c.asked, k], pending: null };
  return askNext(c);
}
function reask(c: Campaign, k: QKey): Campaign { const q = question(k, c); return { ...c, chat: [...c.chat, { from: 'ai', ts: Date.now(), ...q }] }; }

export function writeCopy(c: Campaign) {
  const where = c.venue ? ` in ${c.venue}` : '';
  const headline = (c.offer ? `${c.topic}${where} — ${c.offer}` : `${c.topic}${where}`).slice(0, 60);
  const who = c.audience ? c.audience.replace(/^\w/, (m) => m.toLowerCase()) : 'you';
  const act = { 'Book now': 'Book your spot today', 'Learn more': 'See the details', 'Send message': 'Message us to ask anything', 'Sign up': 'Sign up to hear first' }[c.cta];
  const primaryText = `Made for ${who}. Join our ${c.topic.toLowerCase()}${where}.${c.offer ? ` ${c.offer}.` : ''} Places are limited — ${act.toLowerCase()}.`;
  return { headline, primaryText };
}

function finishPlan(c: Campaign): Campaign {
  const copy = writeCopy(c);
  const n = { ...c, headline: c.headline || copy.headline, primaryText: c.primaryText || copy.primaryText, planReady: true, pending: null };
  const miss = missing(n);
  n.chat = [...n.chat, {
    from: 'ai', ts: Date.now(), added: ['Ad text', 'Headline', 'Button'],
    text: `Your plan is ready. I wrote the ad text and picked “${n.cta}” as the button. ${miss.length ? `${miss.length === 1 ? 'One thing still needs' : `${miss.length} things still need`} your input: ${miss.map((m) => m.label.toLowerCase()).join(', ')}.` : 'Everything needed to launch is filled in.'} Change anything in the plan, then press “Review & approve”. The campaign stays paused until you approve it.`,
  }];
  return n;
}

function followUp(c: Campaign, text: string): Campaign {
  const lower = text.toLowerCase();
  const say = (t: string, added?: string[]) => ({ ...c, chat: [...c.chat, { from: 'ai' as const, text: t, added, ts: Date.now() }] });
  const num = Number(text.replace(/[^\d]/g, ''));
  if (/budget|spend|limit/.test(lower) && num) {
    if (num < MIN_BUDGET) return say(`The budget limit needs to be at least ${inr(MIN_BUDGET)}. I left it at ${inr(c.budget)}.`);
    c = { ...c, budget: num };
    return say(`Done — budget limit is now ${inr(num)}${daily(c) ? ` (about ${inr(daily(c))} a day)` : ''}.`, ['Budget limit']);
  }
  if (/instagram only/.test(lower)) { c = { ...c, instagram: true, facebook: false }; return say('Done — ads will show on Instagram only.', ['Placements']); }
  if (/facebook only/.test(lower)) { c = { ...c, instagram: false, facebook: true }; return say('Done — ads will show on Facebook only.', ['Placements']); }
  if (/rewrite|new (text|copy)|shorter/.test(lower)) {
    const t = writeCopy(c); c = { ...c, headline: t.headline, primaryText: t.primaryText.split('. ').slice(0, 2).join('. ') + '.' };
    return say('Here’s a shorter version of the ad text.', ['Ad text']);
  }
  const style = TEMPLATES.find((x) => lower.includes(x.id) || lower.includes(x.label.toLowerCase()));
  if (style && /style|template|make it|switch|change/.test(lower)) { const a = adOf(c); c = { ...c, ad: { ...defaultAd(c, style.id), brand: a.brand } }; return say(`Switched your ad to the “${style.label}” style.`, ['Animated ad']); }
  const soc = parseSocials(text);
  if ((soc.instagram || soc.youtube) && /insta|ig\b|youtube|yt\b|@/.test(lower)) { c = { ...c, igHandle: soc.instagram ?? c.igHandle, ytHandle: soc.youtube ?? c.ytHandle }; return say('Links updated on your ad.', ['Social links']); }
  return say('I can change the budget (“set budget to 30000”), placements (“Instagram only”) or rewrite the ad text (“make it shorter”), the ad style (“switch to food style”) or your links (“insta @name”) from here. Everything else can be edited directly in the plan.');
}

/* ---------------- readiness ---------------- */
export type Section = 'goal' | 'audience' | 'budget' | 'ad' | 'platform';
export interface Missing { field: keyof Campaign | 'dates' | 'placements'; section: Section; label: string; msg: string }
export function missing(c: Campaign): Missing[] {
  const out: Missing[] = [];
  const add = (field: Missing['field'], section: Section, label: string, msg: string) => out.push({ field, section, label, msg });
  if (!c.name.trim()) add('name', 'goal', 'Campaign name', 'Give your campaign a name.');
  if (!c.objective) add('objective', 'goal', 'Goal', 'Choose what people should do after seeing the ad.');
  if (!c.audience.trim()) add('audience', 'audience', 'Audience', 'Describe who the ad is for.');
  if (!c.location.trim()) add('location', 'audience', 'Location', 'Add where your audience lives.');
  if (!c.startDate || !c.endDate) add('dates', 'budget', 'Dates', 'Choose a start and end date.');
  else if (c.endDate < c.startDate) add('dates', 'budget', 'Dates', 'The end date is before the start date.');
  else if (c.startDate < today() && c.status !== 'live') add('dates', 'budget', 'Dates', 'The start date has passed. Pick today or later.');
  if (!c.budget) add('budget', 'budget', 'Budget limit', 'Set the most you want to spend.');
  else if (c.budget < MIN_BUDGET) add('budget', 'budget', 'Budget limit', `The budget limit must be at least ${inr(MIN_BUDGET)}.`);
  else if (days(c) > 0 && daily(c) < MIN_DAILY) add('budget', 'budget', 'Budget limit', `That is only ${inr(daily(c))} a day. Meta needs at least ${inr(MIN_DAILY)} a day — raise the limit or shorten the dates.`);
  if (!c.headline.trim()) add('headline', 'ad', 'Headline', 'Add a short headline.');
  if (!c.primaryText.trim()) add('primaryText', 'ad', 'Ad text', 'Add the text people will read.');
  if (!c.image && tpl(adOf(c).template).needsImage) add('image', 'ad', 'Ad image', 'Add an image — Facebook and Instagram ads cannot run without one.');
  if (!c.facebook && !c.instagram) add('placements', 'platform', 'Placements', 'Choose Facebook, Instagram or both.');
  return out;
}
export type View = 'live' | 'blocked' | 'paused' | 'ended' | 'drafting';
export function viewState(c: Campaign): View {
  if (c.status === 'live') return 'live';
  if (c.status === 'ended') return 'ended';
  if (!c.planReady) return 'drafting';
  return missing(c).length ? 'blocked' : 'paused';
}

/* ---------------- simulated results (demo clock: 1 minute = 1 day) ---------------- */
export function perf(c: Campaign, now = Date.now()) {
  const total = Math.max(1, days(c));
  const ran = c.launchedAt ? Math.min(total, 1 + Math.floor((now - c.launchedAt) / 60000)) : 0;
  const spent = Math.min(c.budget, Math.round(c.pausedSpend + (c.status === 'live' ? daily(c) * ran * 0.93 : 0)));
  const imps = Math.round((spent / 145) * 1000);
  const reach = Math.round(imps / 2.1);
  const igShare = c.instagram && c.facebook ? 0.62 : c.instagram ? 1 : 0;
  const ig = { spent: Math.round(spent * igShare), clicks: Math.round(imps * igShare * 0.018) };
  const fb = { spent: spent - ig.spent, clicks: Math.round(imps * (1 - igShare) * 0.009) };
  const clicks = ig.clicks + fb.clicks;
  const results = Math.round(clicks * 0.07);
  return { ran, total, spent, imps, reach, clicks, results, ig, fb, perResult: results ? Math.round(spent / results) : 0 };
}

/* ---------------- store wiring ---------------- */
const NONE: Campaign[] = [];
export const useCampaigns = () => useStore((s) => s.campaigns ?? NONE);
export const useCampaign = (id: string) => useStore((s) => (s.campaigns ?? []).find((c) => c.id === id));
export function saveCampaign(c: Campaign) {
  store.update((s) => {
    const list = s.campaigns ?? [];
    const next = { ...c, updatedAt: Date.now() };
    return { ...s, campaigns: list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? next : x)) : [next, ...list] };
  });
}
export function patchCampaign(id: string, patch: Partial<Campaign>) {
  const c = (store.get().campaigns ?? []).find((x) => x.id === id);
  if (!c) return;
  // Any change to a live campaign pauses it until the user approves again — no spend without approval.
  const wasLive = c.status === 'live';
  const pause: Partial<Campaign> = wasLive ? { status: 'paused', approvedAt: null, pausedSpend: perf(c).spent, launchedAt: null } : {};
  saveCampaign({ ...c, ...patch, ...pause, ...(c.approvedAt && !wasLive ? { approvedAt: null } : {}) });
  return wasLive;
}

/** Generic sample photo: sea, sun and hills drawn as SVG (no real brand or stock image). */
export const SAMPLE_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9A3D"/><stop offset=".55" stop-color="#FF3D9A"/><stop offset="1" stop-color="#7B5CFF"/></linearGradient><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B5BFF"/><stop offset="1" stop-color="#0B1A4A"/></linearGradient></defs><rect width="400" height="300" fill="url(#s)"/><circle cx="270" cy="150" r="46" fill="#FFE3A1"/><path d="M0 170 Q80 110 160 160 T320 150 T400 140 V300 H0Z" fill="#1E5B3A"/><path d="M0 200 Q100 185 200 200 T400 196 V300 H0Z" fill="url(#w)"/><path d="M40 225 h70 M150 240 h90 M270 228 h80" stroke="#A9B8FF" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>`);

/** Shrinks an uploaded photo so it fits comfortably in browser storage. */
export function shrinkImage(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image we can read.'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}
