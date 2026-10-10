import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Navigation, Pause, Play, RotateCcw, ShoppingBag, Zap, MapPin, Check, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { flavourColor, tpl, type AdSpec, type TemplateId } from './meta';
import { Socials } from './Socials';
import './ads.css';

export interface AdProps { spec: AdSpec; image?: string | null; instagram?: string; youtube?: string; cta?: string; headline?: string; location?: string }
type Scene = (p: AdProps & { t: number }) => ReactNode;

const reduced = () => document.documentElement.dataset.motion === 'reduce' || (document.documentElement.dataset.motion !== 'allow' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
/** Where a paused (reduced-motion) player rests: a frame that shows the most of each ad. */
const POSTER: Record<TemplateId, number> = { food: 1200, ride: 6200, music: 8600, brand: 6200 };

/* ============================== player ============================== */
export function AdPlayer({ label = 'Animated ad preview', ...p }: AdProps & { label?: string }) {
  const meta = tpl(p.spec.template);
  const L = meta.length;
  const [t, setT] = useState(() => (reduced() ? POSTER[p.spec.template] : 0));
  const [playing, setPlaying] = useState(() => !reduced());
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => setVisible(es[0].isIntersecting)); io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || !visible) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => { const dt = Math.max(0, Math.min(100, now - last)); last = now; setT((x) => (x + dt) % L); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [playing, visible, L]);
  useEffect(() => { setT(reduced() ? POSTER[p.spec.template] : 0); }, [p.spec.template]);
  const S = SCENES[p.spec.template];
  return (
    <figure className="adplayer" ref={ref} aria-label={`${label}: ${meta.label} for ${p.spec.brand}`}>
      <div className={`adstage ad-${p.spec.template} ${playing ? '' : 'paused'}`} aria-hidden="true">
        <S {...p} t={t} />
        <span className="adtag">Sponsored · demo</span>
      </div>
      <figcaption className="adbar">
        <button type="button" className="iconbtn sm" aria-label={playing ? 'Pause ad' : 'Play ad'} onClick={() => setPlaying((v) => !v)}>{playing ? <Pause /> : <Play />}</button>
        <button type="button" className="iconbtn sm" aria-label="Replay ad from the start" onClick={() => { setT(0); setPlaying(true); }}><RotateCcw /></button>
        <span className="adprog" aria-hidden="true"><span style={{ width: `${(t / L) * 100}%` }} /></span>
        <Socials instagram={p.instagram} youtube={p.youtube} compact />
      </figcaption>
    </figure>
  );
}

/** Splits a timeline into named scenes and returns the current one plus local progress 0–1. */
function at<T extends string>(t: number, parts: [T, number][]) {
  let s = 0;
  for (const [name, d] of parts) { if (t < s + d) return { name, p: (t - s) / d, key: name }; s += d; }
  const [name] = parts[parts.length - 1]; return { name, p: 1, key: name };
}

/* ============================== FOOD: flavour slider ============================== */
const NICK: [RegExp, string][] = [[/straw/i, 'Pink Bliss'], [/choc|cocoa/i, 'Cocoa Crush'], [/blackberry|black ?berry|grape|acai/i, 'Dark Berry'], [/blue/i, 'Berry Pure'], [/mango|peach|orange/i, 'Golden Sun'], [/matcha|kiwi|mint/i, 'Green Glow'], [/mocha|coffee/i, 'Morning Mocha'], [/caramel/i, 'Salted Gold']];
const nick = (n: string) => NICK.find(([re]) => re.test(n))?.[1] ?? `${n} Special`;
function rng(seed: string) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
const mix = (hex: string, to: string, k: number) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k));
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
};

function Bowl({ name, color }: { name: string; color: string }) {
  const r = rng(name);
  const choc = /choc|cocoa|mocha|coffee|caramel/i.test(name);
  const fruit = Array.from({ length: 16 }, () => ({ a: r() * Math.PI * 2, d: 18 + r() * 50, s: 7 + r() * 9 }));
  const banana = Array.from({ length: 6 }, (_, i) => ({ x: 120 + i * 9 - r() * 4, y: 58 + i * 14 + r() * 4 }));
  const flakes = Array.from({ length: 22 }, () => ({ x: 40 + r() * 120, y: 40 + r() * 120, a: r() * 180 }));
  return (
    <svg viewBox="0 0 200 200" className="fs-bowl">
      <defs><radialGradient id={`bw${name}`} cx=".45" cy=".4" r=".7"><stop offset="0" stopColor={mix(color, '#ffffff', 0.35)} /><stop offset="1" stopColor={mix(color, '#000000', 0.25)} /></radialGradient></defs>
      <circle cx="100" cy="100" r="96" fill="#141414" /><circle cx="100" cy="100" r="96" fill="none" stroke="#2a2a2a" strokeWidth="3" />
      <circle cx="100" cy="100" r="84" fill={`url(#bw${name})`} />
      {fruit.map((f, i) => choc
        ? <rect key={i} x={100 + Math.cos(f.a) * f.d - f.s / 2} y={100 + Math.sin(f.a) * f.d - f.s / 2} width={f.s} height={f.s * 0.8} rx="2" fill={i % 3 ? '#3B1D10' : '#D9B48A'} transform={`rotate(${f.a * 40} ${100 + Math.cos(f.a) * f.d} ${100 + Math.sin(f.a) * f.d})`} />
        : <g key={i}><circle cx={100 + Math.cos(f.a) * f.d} cy={100 + Math.sin(f.a) * f.d} r={f.s} fill={mix(color, i % 2 ? '#000000' : '#ffffff', i % 2 ? 0.15 : 0.12)} /><circle cx={100 + Math.cos(f.a) * f.d - f.s * 0.3} cy={100 + Math.sin(f.a) * f.d - f.s * 0.3} r={f.s * 0.25} fill="#fff" opacity=".35" /></g>)}
      {banana.map((b, i) => <g key={i}><circle cx={b.x} cy={b.y} r="11" fill="#F3E2A9" /><circle cx={b.x} cy={b.y} r="5" fill="none" stroke="#D9C27A" strokeWidth="1.5" /></g>)}
      {flakes.map((f, i) => <rect key={i} x={f.x} y={f.y} width="5" height="2" rx="1" fill="#F7F3EA" transform={`rotate(${f.a} ${f.x} ${f.y})`} opacity=".9" />)}
    </svg>
  );
}
function Garnish({ name, color, flip }: { name: string; color: string; flip?: boolean }) {
  if (/choc|cocoa|mocha|coffee|caramel/i.test(name)) return <svg viewBox="0 0 60 60" className={`fs-garn ${flip ? 'r' : 'l'}`}><rect x="10" y="12" width="38" height="30" rx="4" fill="#3B1D10" transform="rotate(-18 30 30)" /><rect x="14" y="16" width="14" height="10" rx="2" fill="#4E2715" transform="rotate(-18 30 30)" /><rect x="31" y="22" width="14" height="10" rx="2" fill="#4E2715" transform="rotate(-18 30 30)" /></svg>;
  if (/straw/i.test(name)) return <svg viewBox="0 0 60 60" className={`fs-garn ${flip ? 'r' : 'l'}`}><path d="M30 54C14 44 10 28 16 20c6-7 22-7 28 0 6 8 2 24-14 34z" fill={mix(color, '#ff2a4a', 0.4)} /><path d="M22 14l8 6 8-6-3 8h-10z" fill="#2E7D32" />{[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={22 + (i % 3) * 8} cy={28 + Math.floor(i / 3) * 10} r="1.4" fill="#FFE08A" />)}</svg>;
  return <svg viewBox="0 0 60 60" className={`fs-garn ${flip ? 'r' : 'l'}`}>{[[30, 22], [22, 30], [38, 30], [26, 39], [34, 39], [30, 31]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill={mix(color, '#000000', 0.2 + (i % 2) * 0.15)} stroke={mix(color, '#ffffff', 0.25)} strokeWidth=".8" />)}<path d="M30 15c2-6 8-8 12-7-3 4-7 6-12 7z" fill="#2E7D32" /></svg>;
}
const Food: Scene = ({ spec, t }) => {
  const items = (spec.items.length ? spec.items : ['Strawberry']).slice(0, 4);
  const per = tpl('food').length / items.length;
  const i = Math.max(0, Math.floor(t / per)) % items.length;
  const name = items[i]; const color = flavourColor(name, i);
  return (
    <div className="food" style={{ '--fc': color } as CSSProperties}>
      <div className="fs-nav"><b>{spec.brand}</b><span className="fs-pills"><i className="on">Home</i><i>Menu</i><i>Shop</i><i>Contact</i></span><ShoppingBag /></div>
      <div className="fs-word" key={'w' + i}>{name.toUpperCase()}</div>
      <div className="fs-bowlwrap" key={'b' + i}><Bowl name={name} color={color} /></div>
      <div key={'g' + i}><Garnish name={name} color={color} /><Garnish name={name} color={color} flip /></div>
      <svg viewBox="0 0 40 40" className="fs-leaf" key={'lf' + i}><path d="M6 34C6 16 18 6 36 6c0 18-12 28-30 28z" fill="#2F8F3A" /><path d="M8 32 32 9" stroke="#1E5E26" strokeWidth="1.5" /></svg>
      <div className="fs-info" key={'i' + i}><b>{nick(name)}</b><small>{spec.tagline}. Blended fresh with real fruit, no added sugar.</small></div>
      <div className="fs-arrows"><span><ChevronLeft /></span><span><ChevronRight /></span></div>
      <div className="fs-dots">{items.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
    </div>
  );
};

/* ============================== RIDE: app story ============================== */
const Car = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 120 50" className={`car ${className}`}><path d="M8 34c0-6 4-9 10-10l14-10c4-3 8-4 14-4h26c6 0 10 2 14 6l10 8c10 1 16 4 16 10v6H8z" fill="#F4F4F4" stroke="#BDBDBD" strokeWidth="1.5" /><path d="M36 15h18v10H24zM58 15h16c4 0 7 2 9 4l5 6H58z" fill="#222" opacity=".85" /><circle cx="30" cy="40" r="8" fill="#222" /><circle cx="30" cy="40" r="3.5" fill="#999" /><circle cx="94" cy="40" r="8" fill="#222" /><circle cx="94" cy="40" r="3.5" fill="#999" /><rect x="108" y="30" width="6" height="3" rx="1" fill="#F5C542" /></svg>
);
const Ride: Scene = ({ spec, t, location, instagram, youtube }) => {
  const s = at(t, [['fast', 1200], ['active', 1100], ['logo', 1200], ['search', 1100], ['loc', 1200], ['your', 1400], ['req', 1000], ['ok', 900], ['near', 1000], ['end', 900]]);
  const brand = spec.brand; const pickup = spec.items[0] || location || 'City Centre';
  const card = (kids: ReactNode, cls = '') => <div className={`rd-card ${cls}`} key={s.key}>{kids}</div>;
  let body: ReactNode = null;
  switch (s.name) {
    case 'fast': body = <div className="rd-center" key={s.key}><span className="rd-streak" /><b className="rd-big">Fast <Zap className="rd-ic" /></b></div>; break;
    case 'active': body = <div className="rd-center" key={s.key}><span className="rd-coil" /><b className="rd-big">Active <span className="rd-dot" /></b></div>; break;
    case 'logo': body = s.p < 0.45
      ? <div className="rd-center" key="type"><b className="rd-type">{brand.slice(0, Math.max(1, Math.ceil((s.p / 0.45) * brand.length)))}<i className="caret" /></b></div>
      : <div className="rd-center" key="sq"><b className="rd-logo">{brand}</b></div>; break;
    case 'search': body = <div className="rd-center" key={s.key}><span className="rd-pill">{s.p < 0.5 ? <span className="dots"><i /><i /><i /></span> : <><Search size={14} />Ride</>}</span></div>; break;
    case 'loc': body = <div className="rd-center col" key={s.key}><b className="rd-label">Location <Navigation className="rd-ic sm" /></b>{card(<><MapPin className="pin" /><span className="grow"><b>{pickup}</b><small>Pickup point · {brand}</small></span><span className="ring" /></>, 'loc')}</div>; break;
    case 'your': body = <div className="rd-center" key={s.key}>{card(<>
      <div className="rd-head"><small>{brand}</small><span><b>Your Ride</b><small>Go anywhere with {brand}</small></span></div>
      <div className="rd-body"><div className="rd-fields"><span><i className="sq" />{pickup}</span><span><i className="ci" />Home</span></div><Car className="sm" /></div>
      <span className={`rd-btn ${s.p > 0.62 ? 'busy' : ''}`}>{s.p > 0.62 ? <i className="spin" /> : 'Ride'}</span>
    </>, 'your tilt')}</div>; break;
    case 'req': body = <div className="rd-center" key={s.key}>{card(<><b className="rd-t">Requesting Driver</b><small>Finding driver nearby</small><span className="rd-bar"><span style={{ width: `${20 + s.p * 65}%` }} /></span></>, 'status')}</div>; break;
    case 'ok': body = <div className="rd-center" key={s.key}>{card(<><b className="rd-t">Request Approved <Check className="rd-ic sm" /></b><span className="rd-bar ok"><span style={{ width: '100%' }} /></span></>, 'status')}</div>; break;
    case 'near': body = <div className="rd-center" key={s.key}>{card(<div className="row nowrap"><Car className="drive" /><span><b className="rd-t">Driver Approaching</b><small>Meet at pickup point</small></span></div>, 'status')}</div>; break;
    case 'end': body = <div className="rd-end" key={s.key}><b>{brand}</b><small>{spec.tagline}</small>{(instagram || youtube) && <small className="h">{[instagram && `IG @${instagram}`, youtube && `YT @${youtube}`].filter(Boolean).join(' · ')}</small>}</div>; break;
  }
  return <div className="ride">{body}</div>;
};

/* ============================== MUSIC: app story ============================== */
const Mark = ({ size = 1 }: { size?: number }) => <span className="mu-mark" style={{ '--k': size } as CSSProperties}><i /><i /><i /><i /></span>;
const ART = ['conic-gradient(from 40deg at 40% 60%, #3b1c5a, #e86f9b, #1b1032, #f2c4d8, #3b1c5a)', 'radial-gradient(circle at 50% 35%, #f3d6c6 0 18%, #b06b5a 19% 30%, #2b1a1a 31%)', 'linear-gradient(160deg, #e9e3ef, #a493b8 40%, #3a2c4d)', 'radial-gradient(circle at 30% 30%, #6d1f2a, #1a0b10 60%)', 'linear-gradient(135deg, #4f6f6a, #0f1e1c)', 'conic-gradient(from 200deg, #0e3b2c, #6fd4a0, #0e3b2c, #13251d)'];
const Music: Scene = ({ spec, t }) => {
  const s = at(t, [['dot', 1300], ['word', 1300], ['lock', 1400], ['home', 1200], ['burst', 1100], ['list', 1600], ['grid', 1500], ['listen', 1600]]);
  const songs = spec.items.length ? spec.items : ['Sleeping Music'];
  const words = spec.tagline.trim().split(/\s+/); const last = words.pop() ?? '';
  let body: ReactNode = null;
  switch (s.name) {
    case 'dot': body = <div className="mu-center" key={s.key}><span className="mu-pop"><Mark size={1.2} /></span></div>; break;
    case 'word': body = <div className="mu-center" key={s.key}><span className="mu-wm"><Mark /><b>{spec.brand}</b></span></div>; break;
    case 'lock': body = <div className="mu-center" key={s.key}><div className="mu-phone tilt"><div className="scr lock"><small>Friday, 10 October</small><b>2:38</b><span className="w"><i /><i /></span></div></div></div>; break;
    case 'home': body = <div className="mu-center" key={s.key}><div className="mu-phone"><div className="scr home"><b className="clk">9:41</b><div className="apps">{Array.from({ length: 12 }, (_, i) => i === 5 ? <span key={i} className="app me"><Mark size={0.45} /></span> : <span key={i} className="app" style={{ background: ['#2B5BFF', '#111', '#F2F2F2', '#FF8A3D', '#8B5CF6', '', '#0EA5E9', '#22C55E', '#EF4444', '#FACC15', '#EC4899', '#64748B'][i] }} />)}</div></div></div></div>; break;
    case 'burst': body = <div className="mu-center" key={s.key}><div className="mu-phone zoom"><div className="scr burst" /></div></div>; break;
    case 'list': body = <div className="mu-ui" key={s.key}>
      <div className="mu-chips"><i>All</i><i className="on">Music</i><i>Following</i><i>Podcast</i></div><small className="mu-lbl">Latest</small>
      <div className="mu-rows">{songs.slice(0, 4).map((x, i) => <span key={i} className="mu-row" style={{ animationDelay: `${i * 120}ms` }}><i style={{ background: ART[i % ART.length] }} /><b>{x}</b></span>)}</div></div>; break;
    case 'grid': body = <div className="mu-ui" key={s.key}><div className="mu-chips"><i>All</i><i className="on">Music</i><i>Following</i></div><small className="mu-lbl">Latest releases</small>
      <div className="mu-grid">{ART.map((a, i) => <span key={i} style={{ background: a, animationDelay: `${i * 90}ms` }}><small>{songs[i % songs.length]}</small></span>)}</div></div>; break;
    case 'listen': body = <div className="mu-center" key={s.key}>{s.p < 0.4 ? <b className="mu-spaced">{(words[0] ?? 'Listen').split('').join(' ')}</b> : <b className="mu-line">{words.join(' ')} <em>{last}</em></b>}</div>; break;
  }
  return <div className="music"><span className="mu-glow" />{body}</div>;
};

/* ============================== BRAND: your business ============================== */
const Brand: Scene = ({ spec, t, image, cta, headline, instagram, youtube }) => {
  const s = at(t, [['name', 1500], ['tag', 1500], ['photo', 2200], ['points', 2100], ['end', 1700]]);
  const pts = (spec.items.length ? spec.items : ['Made with care']).slice(0, 3);
  let body: ReactNode = null;
  switch (s.name) {
    case 'name': body = <div className="br-center" key={s.key}><b className="br-name">{spec.brand.split('').map((ch, i) => <span key={i} style={{ animationDelay: `${i * 45}ms` }}>{ch === ' ' ? ' ' : ch}</span>)}</b></div>; break;
    case 'tag': body = <div className="br-center" key={s.key}><b className="br-tag">{spec.tagline.split(' ').map((w, i) => <span key={i} style={{ animationDelay: `${i * 140}ms` }}>{w}&nbsp;</span>)}</b></div>; break;
    case 'photo': body = <div className="br-photo" key={s.key}>{image ? <img src={image} alt="" /> : <span className="noimg">Add a photo of your business</span>}<span className="cap"><small>{spec.brand}</small><b>{headline || spec.tagline}</b></span></div>; break;
    case 'points': body = <div className="br-center" key={s.key}><ul className="br-pts">{pts.map((x, i) => <li key={i} style={{ animationDelay: `${i * 380}ms` }}><Check />{x}</li>)}</ul></div>; break;
    case 'end': body = <div className="br-center col" key={s.key}><b className="br-name sm">{spec.brand}</b><span className="br-cta">{cta || 'Learn more'}</span>{(instagram || youtube) && <small className="br-h">{[instagram && `Instagram @${instagram}`, youtube && `YouTube @${youtube}`].filter(Boolean).join('  ·  ')}</small>}</div>; break;
  }
  return <div className="brand-ad" style={{ '--ac': spec.accent } as CSSProperties}><span className="br-blob a" /><span className="br-blob b" />{body}</div>;
};

const SCENES: Record<TemplateId, Scene> = { food: Food, ride: Ride, music: Music, brand: Brand };
