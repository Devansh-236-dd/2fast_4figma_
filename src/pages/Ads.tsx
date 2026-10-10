import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowRight, BarChart3, Clapperboard, CheckCircle2, Circle, ImagePlus, Lightbulb, Megaphone, Pause, Pencil, Play, Send as SendIcon, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { navigate, usePath } from '../router';
import { store, useStore } from '../store';
import { AdPlayer, type AdProps } from '../ads/AdPlayer';
import { Socials } from '../ads/Socials';
import { TEMPLATES, cleanHandle, readGoalForDemo, tpl, validHandle, type TemplateId } from '../ads/demo';
import { Alert, Btn, Dialog, Empty, Field, Logo, PageHeader, Ribbon, Switch, announce, toast } from '../components/ui';
import {
  adOf, addDays, answer, daily, defaultAd, days, fmtDate, inr, missing, newCampaign, patchCampaign, perf, saveCampaign, shrinkImage, today, viewState, writeCopy,
  MIN_BUDGET, SAMPLE_IMAGE, useCampaign, useCampaigns, type Campaign, type Cta, type Objective, type Section, type View,
} from '../lib/campaign';

const EXAMPLES = ["I want to promote a children's retreat in Bali", 'Promote Freshify smoothie bowls in Mumbai', 'Get riders for my cab app Rydo in Pune', 'Promote my music app Tunely to young listeners'];
const OBJECTIVES: Exclude<Objective, ''>[] = ['Bookings', 'Website visits', 'Messages', 'Sign-ups'];
const CTAS: Cta[] = ['Book now', 'Learn more', 'Send message', 'Sign up'];
const SOON = ['Google Ads', 'YouTube', 'LinkedIn', 'WhatsApp', 'Email'];
const SECTIONS: { id: Section; label: string; asks: string[] }[] = [
  { id: 'goal', label: 'Goal', asks: ['objective'] },
  { id: 'audience', label: 'Audience & location', asks: ['audience', 'location'] },
  { id: 'budget', label: 'Budget & dates', asks: ['budget', 'dates'] },
  { id: 'ad', label: 'Ad text & image', asks: ['offer', 'creative'] },
  { id: 'platform', label: 'Platform', asks: [] },
];
const reduced = () => document.documentElement.dataset.motion === 'reduce' || (document.documentElement.dataset.motion !== 'allow' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/* ---------------- shared bits ---------------- */
export function StateBadge({ c }: { c: Campaign }) {
  const v = viewState(c);
  const map: Record<View, [string, string, ReactNode]> = {
    live: ['ok', 'Live', <span key="d" className="livedot" aria-hidden="true" />],
    paused: ['warn', 'Paused · ready to approve', <Pause key="i" aria-hidden="true" />],
    blocked: ['err', 'Needs your input', <AlertCircle key="i" aria-hidden="true" />],
    drafting: ['info', 'Paused · AI is asking questions', <Sparkles key="i" aria-hidden="true" />],
    ended: ['info', 'Ended', <CheckCircle2 key="i" aria-hidden="true" />],
  };
  const [k, l, i] = map[v];
  return <span className={`badge ${k}`}>{i}{l}</span>;
}

/** The budget limit, always on screen while working on a campaign. */
function BudgetBar({ c }: { c: Campaign }) {
  const p = perf(c);
  const live = c.status === 'live';
  return (
    <div className={`budgetbar ${live ? 'live' : ''}`} role="status" aria-label="Budget limit">
      <span className="grow"><small>Budget limit</small><b className="num">{c.budget ? inr(c.budget) : 'Not set'}</b>{c.budget && days(c) > 0 ? <small className="num"> · ≈{inr(daily(c))}/day · {days(c)} days</small> : null}</span>
      <span className="right">{live ? <><small>Spent so far</small><b className="num">{inr(p.spent)}</b></> : <><small>Status</small><b>Paused · ₹0 spent</b></>}</span>
    </div>
  );
}

export const adProps = (c: Campaign): AdProps => ({ spec: adOf(c), image: c.image, instagram: c.igHandle, youtube: c.ytHandle, cta: c.cta, headline: c.headline, location: c.location });

function AdPreview({ c, onAddImage }: { c: Campaign; onAddImage?: () => void }) {
  const page = c.name.split('·')[0].trim() || 'Your page';
  return (
    <figure className="adprev" aria-label="Ad preview">
      <figcaption className="row between nowrap"><span className="eyebrow">Preview · Facebook &amp; Instagram feed</span><span className="badge demo">Sample render</span></figcaption>
      <div className="post">
        <div className="row nowrap ph"><span className="pav" aria-hidden="true">{page[0]?.toUpperCase()}</span><span className="grow"><b>{page}</b><small>Sponsored</small></span></div>
        <p className="ptext">{c.primaryText || <span className="dim">Your ad text will appear here.</span>}</p>
        <div className="pmedia"><AdPlayer {...adProps(c)} /></div>
        {!c.image && tpl(adOf(c).template).needsImage && <button type="button" className="pimg none slim" onClick={onAddImage} disabled={!onAddImage}><ImagePlus aria-hidden="true" /><b>No image yet</b><small>Needed before launch</small></button>}
        <div className="row between nowrap pfoot"><span className="grow min0"><small>{c.venue || 'yourwebsite.com'}</small><b>{c.headline || 'Your headline'}</b></span><span className="pcta">{c.cta}</span></div>
      </div>
    </figure>
  );
}

function Progress({ c }: { c: Campaign }) {
  const miss = missing(c);
  const state = (s: (typeof SECTIONS)[number]) => {
    if (!c.planReady && s.asks.some((a) => !c.asked.includes(a as never)) && !(s.id === 'goal' && c.objective)) return 'pending';
    return miss.some((m) => m.section === s.id) ? 'needs' : 'done';
  };
  const done = SECTIONS.filter((s) => state(s) === 'done').length;
  return (
    <div className="stack sm">
      <div className="row between nowrap"><b>Progress</b><span className="small muted num">{done} of {SECTIONS.length + 1} steps done</span></div>
      <div className="pbar" aria-hidden="true"><span style={{ width: `${(done / (SECTIONS.length + 1)) * 100}%` }} /></div>
      <ul className="prog">
        {SECTIONS.map((s) => {
          const st = state(s);
          return <li key={s.id} className={st}>{st === 'done' ? <CheckCircle2 aria-hidden="true" /> : st === 'needs' ? <AlertCircle aria-hidden="true" /> : <Circle aria-hidden="true" />}<span className="grow">{s.label}</span><small>{st === 'done' ? 'Done' : st === 'needs' ? 'Needs you' : 'AI will ask'}</small></li>;
        })}
        <li className={c.status === 'live' ? 'done' : 'pending'}>{c.status === 'live' ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}<span className="grow">Your approval</span><small>{c.status === 'live' ? 'Approved' : 'Last step'}</small></li>
      </ul>
    </div>
  );
}

function useImagePicker(id: string) {
  const ref = useRef<HTMLInputElement>(null);
  const input = <input ref={ref} type="file" accept="image/*" className="vh" tabIndex={-1} aria-hidden="true" onChange={async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { const img = await shrinkImage(f); edited(patchCampaign(id, { image: img, imageName: f.name })); toast('Image added'); }
    catch (err) { toast((err as Error).message, 'err'); }
  }} />;
  return { input, open: () => ref.current?.click() };
}
const edited = (wasLive?: boolean) => { if (wasLive) toast('Paused while you edit. Approve again to relaunch.', 'info'); };

/* ---------------- goal composer ---------------- */
function GoalComposer({ autoFocus }: { autoFocus?: boolean }) {
  const [goal, setGoal] = useState(() => { try { return sessionStorage.getItem('la-goal') ?? ''; } catch { return ''; } });
  const [err, setErr] = useState('');
  useEffect(() => { try { sessionStorage.setItem('la-goal', goal); } catch { /* ignore */ } }, [goal]);
  const start = (g = goal) => {
    if (g.trim().length < 8) { setErr('Tell me a little more — what you want to promote, and where.'); return; }
    const c = newCampaign(g); saveCampaign(c); setGoal(''); try { sessionStorage.removeItem('la-goal'); } catch { /* ignore */ }
    navigate(`/campaign/${c.id}/edit`);
  };
  return (
    <form className="stack sm" onSubmit={(e) => { e.preventDefault(); start(); }}>
      <Field label="Describe your goal in your own words" error={err || null} hint="Example: “I want to promote a children's retreat in Bali.”">
        {(id, d) => <textarea id={id} aria-describedby={d} className="textarea" value={goal} autoFocus={autoFocus} placeholder="What do you want to promote?" onChange={(e) => { setGoal(e.target.value); setErr(''); }} />}
      </Field>
      <div className="chips" role="group" aria-label="Example goals">{EXAMPLES.map((x) => <button key={x} type="button" className="chip" onClick={() => { setGoal(x); setErr(''); }}>{x}</button>)}</div>
      <Btn type="submit" size="lg" icon={<Sparkles />}>Start with the AI helper</Btn>
    </form>
  );
}

/* ---------------- campaigns home (list + empty state) ---------------- */
export function CampaignsHome() {
  const list = useCampaigns();
  const [f, setF] = useState<'all' | 'attention' | 'live' | 'paused'>('all');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const attention = list.filter((c) => ['blocked', 'drafting'].includes(viewState(c)));
  const live = list.filter((c) => c.status === 'live');
  const limits = list.filter((c) => c.status !== 'ended').reduce((a, c) => a + c.budget, 0);
  const shown = list.filter((c) => f === 'all' || (f === 'attention' ? attention.includes(c) : f === 'live' ? c.status === 'live' : viewState(c) === 'paused'));
  return (
    <>
      <div className="phead"><div className="titles"><div className="eyebrow">{greet}, Ramesh</div><h1 className="h1">Your campaigns</h1></div></div>
      <section className="wallet stg stack" aria-labelledby="new-h">
        <Ribbon opts={{ x0: 0.1, y0: 1.35, x1: 1.2, y1: -0.35, bw: 1.0, base: 0.55, n: 72, a: 0.5, amp: 0.1 }} />
        <span className="veil deco" aria-hidden="true" />
        <div className="row between"><h2 id="new-h" className="h2">What do you want to promote?</h2><span className="badge demo">AI helper</span></div>
        <p className="small" style={{ margin: 0, color: '#DCE2FF' }}>Type a goal. The AI asks a few questions, builds a plan you can edit, and nothing goes live or costs money until you approve.</p>
        <GoalComposer />
      </section>

      <div className="statrow">
        <div className="card stat"><small>Live</small><b className="num">{live.length}</b></div>
        <div className={`card stat ${attention.length ? 'warnc' : ''}`}><small>Need your input</small><b className="num">{attention.length}</b></div>
        <div className="card stat"><small>Budget limits</small><b className="num">{inr(limits)}</b></div>
      </div>

      <section className="card stack" aria-labelledby="mk-h">
        <div className="row between"><h2 id="mk-h" className="h2 row nowrap"><Clapperboard aria-hidden="true" />Animated ads</h2><Btn size="sm" variant="ghost" onClick={() => navigate('/studio')}>Open Ad studio</Btn></div>
        <p className="small muted" style={{ margin: 0 }}>Every campaign comes with an animated ad. The helper picks a style from your goal — or choose one yourself.</p>
        <div className="chips">{TEMPLATES.map((t) => <button key={t.id} type="button" className="chip" onClick={() => navigate('/studio')}>{t.label}</button>)}</div>
      </section>

      {list.length === 0 ? (
        <section className="card">
          <Empty icon={<Megaphone />} title="No campaigns yet" action={<Btn variant="ghost" onClick={loadExamples}>Load example campaigns</Btn>}>
            Start by describing your goal above. You’ll see four steps: answer a few questions → edit the plan → review the budget → approve and launch.
          </Empty>
        </section>
      ) : (
        <section className="stack" aria-labelledby="list-h">
          <div className="row between"><h2 id="list-h" className="h2">All campaigns</h2></div>
          <div className="chips" role="group" aria-label="Filter campaigns">
            {([['all', `All (${list.length})`], ['attention', `Need input (${attention.length})`], ['live', `Live (${live.length})`], ['paused', 'Ready to approve']] as const).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>)}
          </div>
          {shown.length === 0 ? <div className="card"><Empty icon={<CheckCircle2 />} title="Nothing here">No campaigns match this filter.</Empty></div> : shown.map((c) => <CampaignCard key={c.id} c={c} />)}
        </section>
      )}
    </>
  );
}

function CampaignCard({ c }: { c: Campaign }) {
  const v = viewState(c); const m = missing(c); const p = perf(c);
  const to = v === 'live' || v === 'ended' ? `/campaign/${c.id}` : v === 'paused' ? `/campaign/${c.id}/review` : `/campaign/${c.id}/edit`;
  return (
    <button type="button" className={`card click stack sm ccard ${v}`} onClick={() => navigate(to)}>
      <div className="row between nowrap"><b className="grow min0 ell">{c.name}</b><StateBadge c={c} /></div>
      <div className="small muted">Meta · {c.objective || 'Goal not set'} · {c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : 'Dates not set'}</div>
      {v === 'live' && <div className="mini"><div className="track"><span style={{ width: `${Math.min(100, (p.spent / Math.max(1, c.budget)) * 100)}%` }} /></div><small className="num">{inr(p.spent)} of {inr(c.budget)} limit · {p.results} results</small></div>}
      {v === 'blocked' && <div className="small" style={{ color: 'var(--err)' }}>Missing: {m.map((x) => x.label.toLowerCase()).join(', ')}</div>}
      {v === 'drafting' && <div className="small muted">The AI is waiting for your answer.</div>}
      <div className="row between nowrap"><span className="small num">Limit {c.budget ? inr(c.budget) : '—'}</span><span className="link row nowrap">{v === 'live' ? 'See results' : v === 'paused' ? 'Review & approve' : v === 'ended' ? 'See summary' : 'Continue'}<ArrowRight size={16} aria-hidden="true" /></span></div>
    </button>
  );
}

export function NewCampaign() {
  return (
    <>
      <PageHeader title="New campaign" sub="Start with your goal. The AI helper does the setup with you." backTo="/" />
      <section className="card"><GoalComposer autoFocus /></section>
      <ol className="flow" aria-label="How it works">
        {['Describe your goal', 'Answer a few questions', 'Edit the plan', 'Review the budget', 'Approve & launch'].map((s, i) => <li key={s}><span className="num">{i + 1}</span>{s}</li>)}
      </ol>
    </>
  );
}

/* ---------------- workspace: chat + plan side by side ---------------- */
export function Workspace({ id }: { id: string }) {
  const c = useCampaign(id);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const pick = useImagePicker(id);
  const focusField = usePath().split('?f=')[1];
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' }); }, [c?.chat.length, typing]);
  useEffect(() => { if (focusField) setTimeout(() => { const el = document.getElementById('f-' + focusField); el?.scrollIntoView({ block: 'center' }); (el?.querySelector('input,textarea,button') as HTMLElement | null)?.focus(); }, 80); }, [focusField]);
  if (!c) return <><PageHeader title="Campaign" backTo="/" /><Empty icon={<Megaphone />} title="Campaign not found" action={<Btn onClick={() => navigate('/create')}>Start a new one</Btn>} /></>;
  const last = c.chat[c.chat.length - 1];
  const send = (t: string) => {
    if (typing || !t.trim()) return;
    if (/^upload an image$/i.test(t.trim())) { pick.open(); return; }
    const next = answer(c, t);
    saveCampaign({ ...next, chat: next.chat.slice(0, c.chat.length + 1) });
    setText(''); setTyping(true);
    setTimeout(() => {
      const fresh = store.get().campaigns?.find((x) => x.id === id);
      if (fresh) saveCampaign({ ...fresh, chat: next.chat });
      setTyping(false);
      const ai = next.chat[next.chat.length - 1]; if (ai?.from === 'ai') announce('AI helper: ' + ai.text);
    }, reduced() ? 0 : 650);
  };
  const miss = missing(c);
  return (
    <>
      {pick.input}
      <PageHeader title={c.name || 'New campaign'} eyebrow="Campaign builder" backTo="/" actions={<StateBadge c={c} />} />
      <div className="ws">
        <section className="card chatpane" aria-labelledby="ai-h">
          <div className="row nowrap aihead"><Logo size={30} /><span className="grow"><b id="ai-h">Ads helper</b><small>Asks only what it needs · explains why</small></span><span className="badge demo">Demo AI</span></div>
          <div className="msgs" ref={logRef} role="log" aria-live="off" aria-label="Conversation">
            {c.chat.map((m, i) => (
              <div key={i} className={`msg ${m.from}`}>
                <span>{m.text}</span>
                {m.why && <small className="why"><Lightbulb aria-hidden="true" />Why I ask: {m.why}</small>}
                {m.added && <small className="added"><CheckCircle2 aria-hidden="true" />Added to plan: {m.added.join(', ')}</small>}
              </div>
            ))}
            {typing && <div className="msg ai typing" aria-label="AI helper is typing"><i /><i /><i /></div>}
          </div>
          {!typing && last?.from === 'ai' && last.chips && c.pending && (
            <div className="chips" role="group" aria-label="Suggested answers">{last.chips.map((x) => <button key={x} type="button" className="chip" onClick={() => send(x)}>{x}</button>)}</div>
          )}
          <form className="row nowrap composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <label htmlFor="ai-in" className="vh">Reply to the AI helper</label>
            <input id="ai-in" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={c.pending ? 'Type your answer…' : 'Ask for a change, e.g. “set budget to 30000”'} autoComplete="off" />
            <Btn type="submit" icon={<SendIcon />} disabled={typing || !text.trim()} aria-label="Send">Send</Btn>
          </form>
        </section>

        <section className="planpane stack" aria-labelledby="plan-h">
          <div className="card stack">
            <div className="row between nowrap"><h2 id="plan-h" className="h2">Campaign plan</h2><span className="small muted">Updates as you answer</span></div>
            <Progress c={c} />
          </div>
          <AdPreview c={c} onAddImage={pick.open} />
          <PlanForm c={c} pickImage={pick.open} />
          <div className="card stack sm">
            {c.planReady && miss.length > 0 && <p className="small" style={{ margin: 0, color: 'var(--err)' }}>{miss.length} thing{miss.length > 1 ? 's' : ''} to fix before launch — marked in red above. You can still review now.</p>}
            {!c.planReady && <p className="small muted" style={{ margin: 0 }}>Answer the AI’s questions or fill in the plan yourself — either works.</p>}
            <Btn size="lg" block icon={<ArrowRight />} onClick={() => navigate(`/campaign/${c.id}/review`)}>Review &amp; approve</Btn>
            <p className="xs dim" style={{ margin: 0 }}>The campaign stays paused. Nothing is spent until you approve on the next screen.</p>
          </div>
        </section>
      </div>
      <BudgetBar c={c} />
    </>
  );
}

function PlanForm({ c, pickImage }: { c: Campaign; pickImage: () => void }) {
  const [adv, setAdv] = useState(() => { try { return localStorage.getItem('la-adv') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('la-adv', adv ? '1' : '0'); } catch { /* ignore */ } }, [adv]);
  const miss = missing(c);
  const err = (f: string) => (c.planReady ? miss.find((m) => m.field === f)?.msg ?? null : null);
  const set = (p: Partial<Campaign>) => edited(patchCampaign(c.id, p));
  const showAdv = adv || !!err('placements');
  return (
    <div className="stack planform">
      <Switch checked={adv} onChange={setAdv} label="Show advanced settings" sub="Age range and where the ads appear. Most people can skip this." />

      <fieldset className="card stack" id="f-objective">
        <legend className="h3">1 · Goal</legend>
        <div id="f-name"><Field label="Campaign name" error={err('name')}>{(id, d) => <input id={id} aria-describedby={d} className="input" value={c.name} onChange={(e) => set({ name: e.target.value })} />}</Field></div>
        <div className="field"><span className="lbl">What should people do?</span>
          <div className="chips" role="group" aria-label="Campaign goal">{OBJECTIVES.map((o) => <button key={o} type="button" className="chip" aria-pressed={c.objective === o} onClick={() => set({ objective: o })}>{o}</button>)}</div>
          {err('objective') && <span className="ferr" role="alert"><AlertCircle aria-hidden="true" />{err('objective')}</span>}
        </div>
      </fieldset>

      <fieldset className="card stack" id="f-audience">
        <legend className="h3">2 · Audience &amp; location</legend>
        <Field label="Who is it for?" error={err('audience')} hint="Describe them like you would to a friend.">{(id, d) => <textarea id={id} aria-describedby={d} className="textarea" value={c.audience} onChange={(e) => set({ audience: e.target.value })} />}</Field>
        <div id="f-location"><Field label="Where do they live?" error={err('location')}>{(id, d) => <input id={id} aria-describedby={d} className="input" value={c.location} placeholder="e.g. Mumbai, Delhi & Bengaluru" onChange={(e) => set({ location: e.target.value })} />}</Field></div>
        {showAdv && <div className="formgrid two-col">
          <Field label="Youngest age">{(id) => <input id={id} type="number" inputMode="numeric" min={18} max={65} className="input" value={c.ageMin} onChange={(e) => set({ ageMin: Math.max(18, Math.min(65, Number(e.target.value) || 18)) })} />}</Field>
          <Field label="Oldest age">{(id) => <input id={id} type="number" inputMode="numeric" min={18} max={65} className="input" value={c.ageMax} onChange={(e) => set({ ageMax: Math.max(18, Math.min(65, Number(e.target.value) || 65)) })} />}</Field>
        </div>}
      </fieldset>

      <fieldset className="card stack" id="f-budget">
        <legend className="h3">3 · Budget &amp; dates</legend>
        <Field label="Budget limit (total, in ₹)" error={err('budget')} hint={`Living Ads never spends more than this. Minimum ${inr(MIN_BUDGET)}.`}>
          {(id, d) => <input id={id} aria-describedby={d} className="input num" type="text" inputMode="numeric" value={c.budget ? c.budget.toLocaleString('en-IN') : ''} placeholder="e.g. 25,000" onChange={(e) => set({ budget: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} />}
        </Field>
        {c.budget > 0 && days(c) > 0 && <p className="small muted" style={{ margin: 0 }}>About <b className="num">{inr(daily(c))}</b> a day for {days(c)} days.</p>}
        <div id="f-dates" className="formgrid two-col">
          <Field label="Start date" error={err('dates')}>{(id, d) => <input id={id} aria-describedby={d} type="date" className="input" min={today()} value={c.startDate} onChange={(e) => set({ startDate: e.target.value })} />}</Field>
          <Field label="End date">{(id) => <input id={id} type="date" className="input" min={c.startDate || today()} value={c.endDate} onChange={(e) => set({ endDate: e.target.value })} />}</Field>
        </div>
      </fieldset>

      <fieldset className="card stack" id="f-headline">
        <legend className="h3">4 · Ad text &amp; image</legend>
        <div className="row between nowrap"><span className="small muted">Written by the AI from your answers. Edit freely.</span><Btn size="sm" variant="ghost" icon={<Wand2 />} onClick={() => { set(writeCopy(c)); toast('Ad text rewritten'); }}>Rewrite</Btn></div>
        <Field label="Headline" error={err('headline')} hint={`${c.headline.length}/60 characters`}>{(id, d) => <input id={id} aria-describedby={d} className="input" maxLength={60} value={c.headline} onChange={(e) => set({ headline: e.target.value })} />}</Field>
        <div id="f-primaryText"><Field label="Ad text" error={err('primaryText')}>{(id, d) => <textarea id={id} aria-describedby={d} className="textarea" value={c.primaryText} onChange={(e) => set({ primaryText: e.target.value })} />}</Field></div>
        <Field label="Price or offer (optional)">{(id) => <input id={id} className="input" value={c.offer} placeholder="e.g. Early-bird 15% off" onChange={(e) => set({ offer: e.target.value })} />}</Field>
        <Field label="Button">{(id) => <select id={id} className="select input" value={c.cta} onChange={(e) => set({ cta: e.target.value as Cta })}>{CTAS.map((x) => <option key={x}>{x}</option>)}</select>}</Field>
        <div className="field" id="f-image"><span className="lbl">Ad image</span>
          <div className="row nowrap">
            {c.image ? <img src={c.image} alt="" className="thumb" /> : <span className="thumb none" aria-hidden="true"><ImagePlus /></span>}
            <div className="row grow">
              <Btn size="sm" icon={<ImagePlus />} onClick={pickImage}>{c.image ? 'Replace image' : 'Add image'}</Btn>
              {!c.image && <Btn size="sm" variant="ghost" onClick={() => set({ image: SAMPLE_IMAGE, imageName: 'Sample image' })}>Use sample</Btn>}
              {c.image && <Btn size="sm" variant="quiet" icon={<Trash2 />} onClick={() => set({ image: null, imageName: '' })}>Remove</Btn>}
            </div>
          </div>
          {err('image') && <span className="ferr" role="alert"><AlertCircle aria-hidden="true" />{err('image')}</span>}
        </div>
      </fieldset>

      <AdStyleFields c={c} set={set} />

      <fieldset className="card stack" id="f-links">
        <legend className="h3">Your links</legend>
        <p className="small muted" style={{ margin: 0 }}>Add your handles and we put clickable Instagram and YouTube icons on your ad. You can also copy the link or the icon to use anywhere.</p>
        <div className="formgrid two-col">
          <Field label="Instagram handle" error={validHandle(c.igHandle ?? '') ? null : 'Use letters, numbers, dots or underscores only.'}>{(id, d) => <input id={id} aria-describedby={d} className="input" value={c.igHandle ? '@' + c.igHandle : ''} placeholder="@yourbusiness" onChange={(e) => set({ igHandle: cleanHandle(e.target.value) })} />}</Field>
          <Field label="YouTube handle" error={validHandle(c.ytHandle ?? '') ? null : 'Use letters, numbers, dots or underscores only.'}>{(id, d) => <input id={id} aria-describedby={d} className="input" value={c.ytHandle ? '@' + c.ytHandle : ''} placeholder="@yourchannel" onChange={(e) => set({ ytHandle: cleanHandle(e.target.value) })} />}</Field>
        </div>
        <Socials instagram={c.igHandle} youtube={c.ytHandle} />
      </fieldset>

      <fieldset className="card stack" id="f-placements">
        <legend className="h3">5 · Platform</legend>
        <PlatformList />
        {showAdv && <div className="stack sm">
          <Switch checked={c.facebook} onChange={(v) => set({ facebook: v })} label="Show on Facebook" />
          <Switch checked={c.instagram} onChange={(v) => set({ instagram: v })} label="Show on Instagram" />
        </div>}
        {err('placements') && <span className="ferr" role="alert"><AlertCircle aria-hidden="true" />{err('placements')}</span>}
      </fieldset>
    </div>
  );
}

function PlatformList() {
  return (
    <ul className="plats" aria-label="Advertising platforms">
      <li className="on"><CheckCircle2 aria-hidden="true" /><span className="grow"><b>Meta</b><small>Facebook &amp; Instagram</small></span><span className="badge ok">Selected</span></li>
      {SOON.map((p) => <li key={p} aria-disabled="true"><Circle aria-hidden="true" /><span className="grow"><b>{p}</b></span><span className="badge">Coming soon</span></li>)}
    </ul>
  );
}

/* ---------------- review & approve ---------------- */
export function Review({ id }: { id: string }) {
  const c = useCampaign(id);
  const [ok, setOk] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!c) return <><PageHeader title="Review" backTo="/" /><Empty icon={<Megaphone />} title="Campaign not found" /></>;
  const miss = missing(c);
  const blocked = miss.length > 0;
  const fix = (f: string) => navigate(`/campaign/${c.id}/edit?f=${f}`);
  const where = [c.facebook && 'Facebook', c.instagram && 'Instagram'].filter(Boolean).join(' and ') || 'no placements';
  const Sec = ({ s, title, children }: { s: Section; title: string; children: ReactNode }) => {
    const m = miss.filter((x) => x.section === s);
    return (
      <section className={`card stack sm rsec ${m.length ? 'bad' : ''}`}>
        <div className="row between nowrap"><h2 className="h3 row nowrap">{m.length ? <AlertCircle className="ic err" aria-hidden="true" /> : <CheckCircle2 className="ic ok" aria-hidden="true" />}{title}</h2><Btn size="sm" variant="ghost" icon={<Pencil />} onClick={() => fix(m[0]?.field ?? (s === 'ad' ? 'headline' : s === 'goal' ? 'objective' : s === 'platform' ? 'placements' : s))}>Edit</Btn></div>
        {children}
        {m.map((x) => <div key={x.label} className="ferr" role="alert"><AlertCircle aria-hidden="true" /><span className="grow">{x.msg}</span><button type="button" className="link" onClick={() => fix(String(x.field))}>Fix</button></div>)}
      </section>
    );
  };
  const launch = () => {
    const now = Date.now();
    saveCampaign({ ...c, status: 'live', approvedAt: now, launchedAt: now, startDate: c.startDate < today() ? today() : c.startDate });
    store.update((s) => ({ ...s, notifications: [{ id: 'n_' + now, ts: now, title: 'Campaign live (simulated)', body: `${c.name} is running on ${where}. Budget limit ${inr(c.budget)}.`, read: false, kind: 'booking' }, ...s.notifications] }));
    setConfirm(false); toast('Campaign launched in the demo — no real money is spent'); announce('Campaign is live in the simulation.');
    navigate(`/campaign/${c.id}`, { replace: true });
  };
  return (
    <>
      <PageHeader title="Review & approve" eyebrow={c.name} backTo={`/campaign/${c.id}/edit`} actions={<StateBadge c={c} />} />
      {blocked
        ? <Alert kind="err" title={`Not ready to launch — ${miss.length} thing${miss.length > 1 ? 's' : ''} missing`}>Each problem is shown next to its step below. Everything you entered is saved.</Alert>
        : c.status === 'live' ? <Alert kind="ok" title="This campaign is live">It was approved on {new Date(c.approvedAt ?? Date.now()).toLocaleString('en-IN')}.</Alert>
          : <Alert kind="ok" title="Everything needed is ready">Check the summary, then approve to launch. Until then the campaign stays paused.</Alert>}
      <div className="ws review">
        <div className="stack">
          <Sec s="goal" title="Goal"><dl className="kv"><dt>Name</dt><dd>{c.name || '—'}</dd><dt>People should</dt><dd>{c.objective || '—'}</dd><dt>Button</dt><dd>{c.cta}</dd></dl></Sec>
          <Sec s="audience" title="Audience & location"><dl className="kv"><dt>Who</dt><dd>{c.audience || '—'}</dd><dt>Where</dt><dd>{c.location || '—'}</dd><dt>Ages</dt><dd className="num">{c.ageMin}–{c.ageMax}</dd></dl></Sec>
          <Sec s="budget" title="Budget & dates"><dl className="kv"><dt>Budget limit</dt><dd className="num">{c.budget ? inr(c.budget) : '—'}</dd><dt>Per day</dt><dd className="num">{days(c) > 0 && c.budget ? `≈ ${inr(daily(c))}` : '—'}</dd><dt>Runs</dt><dd>{c.startDate ? `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` : '—'}</dd></dl></Sec>
          <Sec s="ad" title="Ad text & image"><dl className="kv"><dt>Headline</dt><dd>{c.headline || '—'}</dd><dt>Image</dt><dd>{c.image ? c.imageName || 'Added' : 'Missing'}</dd></dl></Sec>
          <Sec s="platform" title="Platform"><PlatformList /></Sec>
        </div>
        <div className="stack">
          <AdPreview c={c} />
          {c.status !== 'live' && (
            <section className="card stack approve" aria-labelledby="ap-h">
              <h2 id="ap-h" className="h2">Your approval</h2>
              <ul className="prog">
                <li className="done"><CheckCircle2 aria-hidden="true" /><span className="grow">Starts paused — nothing spent yet</span></li>
                <li className={blocked ? 'needs' : 'done'}>{blocked ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}<span className="grow">{blocked ? `${miss.length} item${miss.length > 1 ? 's' : ''} missing` : 'All required details filled in'}</span></li>
                <li className="done"><CheckCircle2 aria-hidden="true" /><span className="grow">Hard budget limit of <b className="num">{c.budget ? inr(c.budget) : '—'}</b></span></li>
              </ul>
              <label className={`approvebox ${blocked ? 'off' : ''}`}>
                <input type="checkbox" checked={ok && !blocked} disabled={blocked} onChange={(e) => setOk(e.target.checked)} />
                <span>I approve spending <b>up to {c.budget ? inr(c.budget) : '—'}</b>{c.startDate ? ` between ${fmtDate(c.startDate)} and ${fmtDate(c.endDate)}` : ''} on {where}. I can pause at any time.</span>
              </label>
              <Btn size="lg" block icon={<Play />} disabled={blocked || !ok} onClick={() => setConfirm(true)}>Approve &amp; launch</Btn>
              {blocked && <p className="small" style={{ margin: 0, color: 'var(--err)' }}>Fix the missing items above to unlock approval.</p>}
              <p className="xs dim" style={{ margin: 0 }}>Demo: no ad account is connected and no real money is spent. Launch only works for Meta (Facebook &amp; Instagram).</p>
            </section>
          )}
        </div>
      </div>
      <BudgetBar c={c} />
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Launch this campaign?">
        <p style={{ margin: 0 }}>“{c.name}” will start running on {where}. It will never spend more than <b className="num">{inr(c.budget)}</b> in total (about {inr(daily(c))} a day).</p>
        <Btn size="lg" block data-autofocus icon={<Play />} onClick={launch}>Yes, launch now</Btn>
        <Btn variant="quiet" block onClick={() => setConfirm(false)}>Not yet — keep it paused</Btn>
      </Dialog>
    </>
  );
}

/* ---------------- campaign detail: live state + performance ---------------- */
export function CampaignDetail({ id }: { id: string }) {
  const c = useCampaign(id);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  if (!c) return <><PageHeader title="Campaign" backTo="/" /><Empty icon={<Megaphone />} title="Campaign not found" /></>;
  const v = viewState(c); const p = perf(c); const miss = missing(c);
  const pause = () => { saveCampaign({ ...c, status: 'paused', approvedAt: null, launchedAt: null, pausedSpend: p.spent }); toast('Paused. Nothing more will be spent.', 'info'); };
  const igBetter = c.facebook && c.instagram && p.ig.spent > 0 && p.ig.clicks / Math.max(1, p.ig.spent) > (p.fb.clicks / Math.max(1, p.fb.spent)) * 1.3;
  return (
    <>
      <PageHeader title={c.name} eyebrow="Campaign" backTo="/" actions={<StateBadge c={c} />} />
      <section className="wallet stack" aria-label="Status">
        <Ribbon opts={{ n: 50, a: v === 'live' ? 0.5 : 0.25 }} />
        <span className="veil deco" aria-hidden="true" />
        {v === 'live' && <><b className="h2 row nowrap"><span className="livedot" aria-hidden="true" />Live on {[c.facebook && 'Facebook', c.instagram && 'Instagram'].filter(Boolean).join(' & ')}</b><span className="small" style={{ color: '#DCE2FF' }}>Day {p.ran} of {p.total} · demo clock: 1 minute = 1 day</span></>}
        {v === 'paused' && <><b className="h2">Paused — nothing is being spent</b><span className="small" style={{ color: '#DCE2FF' }}>Ready to launch once you approve.</span></>}
        {v === 'blocked' && <><b className="h2">Needs your input</b><span className="small" style={{ color: '#DCE2FF' }}>Missing: {miss.map((m) => m.label.toLowerCase()).join(', ')}.</span></>}
        {v === 'drafting' && <><b className="h2">Still being set up</b><span className="small" style={{ color: '#DCE2FF' }}>The AI helper is waiting for your answers.</span></>}
        <div className="row">
          {v === 'live' ? <button type="button" className="glassbtn" onClick={pause}><Pause aria-hidden="true" />Pause</button>
            : <button type="button" className="glassbtn" onClick={() => navigate(`/campaign/${c.id}/review`)}><Play aria-hidden="true" />Review &amp; approve</button>}
          <button type="button" className="glassbtn" onClick={() => navigate(`/campaign/${c.id}/edit`)}><Pencil aria-hidden="true" />Edit plan</button>
        </div>
      </section>

      {(c.launchedAt || c.pausedSpend > 0) ? (
        <section className="card stack" aria-labelledby="perf-h">
          <div className="row between"><h2 id="perf-h" className="h2">How it’s doing</h2><span className="badge demo">Simulated numbers</span></div>
          <div className="mini big"><div className="track"><span style={{ width: `${Math.min(100, (p.spent / Math.max(1, c.budget)) * 100)}%` }} /></div><small className="num"><b>{inr(p.spent)}</b> spent of your <b>{inr(c.budget)}</b> limit</small></div>
          <div className="statrow four">
            <div className="stat"><small>People reached</small><b className="num">{p.reach.toLocaleString('en-IN')}</b></div>
            <div className="stat"><small>Clicks</small><b className="num">{p.clicks.toLocaleString('en-IN')}</b></div>
            <div className="stat"><small>{c.objective || 'Results'}</small><b className="num">{p.results}</b></div>
            <div className="stat"><small>Cost per result</small><b className="num">{p.perResult ? inr(p.perResult) : '—'}</b></div>
          </div>
          <div className="bars" aria-label="Clicks by platform">
            {c.instagram && <div className="bar"><span>Instagram</span><span className="track"><span className="fill" style={{ width: `${(p.ig.clicks / Math.max(1, p.clicks)) * 100}%` }} /></span><span className="num small">{p.ig.clicks} clicks</span></div>}
            {c.facebook && <div className="bar"><span>Facebook</span><span className="track"><span className="fill" style={{ width: `${(p.fb.clicks / Math.max(1, p.clicks)) * 100}%` }} /></span><span className="num small">{p.fb.clicks} clicks</span></div>}
          </div>
          {igBetter && <Alert kind="info" title="AI suggestion: show this on Instagram only" actions={<Btn size="sm" variant="ghost" onClick={() => { patchCampaign(c.id, { facebook: false }); toast('Changed. The campaign is paused until you approve again.', 'info'); navigate(`/campaign/${c.id}/review`); }}>Apply and review</Btn>}>Instagram is getting about twice as many clicks for each rupee. Moving the budget there could lower your cost per result. Your budget limit stays the same.</Alert>}
        </section>
      ) : null}

      <section className="card stack" aria-labelledby="yad-h">
        <div className="row between"><h2 id="yad-h" className="h2">Your ad</h2><span className="badge info">{tpl(adOf(c).template).label}</span></div>
        <AdPlayer {...adProps(c)} />
        <Socials instagram={c.igHandle} youtube={c.ytHandle} />
      </section>

      <section className="card stack" aria-labelledby="why-h">
        <h2 id="why-h" className="h2 row nowrap"><Sparkles aria-hidden="true" />Why the AI set it up this way</h2>
        <ul className="whylist">
          <li>It optimises for <b>{(c.objective || 'your goal').toLowerCase()}</b> because you said: “{c.goal}”.</li>
          <li>It targets <b>{c.audience || 'your audience'}</b> in <b>{c.location || 'your chosen places'}</b>{c.venue ? ` rather than ${c.venue}, since people travel to you` : ''}.</li>
          <li>It spreads your budget evenly (about {inr(daily(c))} a day) and stops at {inr(c.budget)} — it can’t go over.</li>
          <li>It can’t change your budget, dates or ad without your approval. Any edit pauses a live campaign first.</li>
        </ul>
      </section>
    </>
  );
}

/* ---------------- performance overview (bonus) ---------------- */
export function PerformanceOverview() {
  const list = useCampaigns();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  const ran = list.filter((c) => c.launchedAt || c.pausedSpend > 0);
  const tot = ran.reduce((a, c) => { const p = perf(c); return { spent: a.spent + p.spent, limit: a.limit + c.budget, results: a.results + p.results }; }, { spent: 0, limit: 0, results: 0 });
  return (
    <>
      <PageHeader title="Performance" sub="Simple numbers for campaigns that have run. All figures are simulated." backTo="/" />
      {ran.length === 0 ? <section className="card"><Empty icon={<BarChart3 />} title="No results yet" action={<Btn onClick={() => navigate('/')}>Go to campaigns</Btn>}>Results appear here after you approve and launch a campaign.</Empty></section> : <>
        <div className="statrow">
          <div className="card stat"><small>Spent</small><b className="num">{inr(tot.spent)}</b></div>
          <div className="card stat"><small>Of limits</small><b className="num">{inr(tot.limit)}</b></div>
          <div className="card stat"><small>Results</small><b className="num">{tot.results}</b></div>
        </div>
        {ran.map((c) => <CampaignCard key={c.id} c={c} />)}
      </>}
    </>
  );
}

/* ---------------- how it works: user flow, rationale, demo data ---------------- */
export function About() {
  const n = useStore((s) => (s.campaigns ?? []).length);
  return (
    <>
      <PageHeader title="How Living Ads works" sub="User flow, design decisions and a quick demo path for judges." backTo="/" />
      <section className="card stack" aria-labelledby="flow-h">
        <h2 id="flow-h" className="h2">User flow</h2>
        <ol className="flow">
          {['Type a goal in plain words', 'AI asks only the missing questions', 'AI builds a plan: audience, ad, budget', 'Edit any part — preview updates live', 'Review: what’s ready, what’s missing', 'Tick to approve the exact spend', 'Launch (simulated) — then pause any time'].map((s, i) => <li key={s}><span className="num">{i + 1}</span>{s}</li>)}
        </ol>
      </section>
      <section className="card stack" aria-labelledby="demo-h">
        <h2 id="demo-h" className="h2">Try every state in two minutes</h2>
        <p className="small muted" style={{ margin: 0 }}>Load three example campaigns — one live, one blocked by a missing image, one ready to approve — or clear everything to see the empty state.</p>
        <div className="row"><Btn icon={<Sparkles />} onClick={() => { loadExamples(); navigate('/'); }}>Load example campaigns</Btn><Btn variant="ghost" disabled={!n} onClick={() => { store.update((s) => ({ ...s, campaigns: [] })); toast('All campaigns cleared', 'info'); navigate('/'); }}>Clear all ({n})</Btn></div>
      </section>
      <section className="card stack" aria-labelledby="why2-h">
        <h2 id="why2-h" className="h2">Design rationale</h2>
        <ul className="whylist">
          <li><b>Animated ads, made for you.</b> The helper picks an ad style from your goal — food slider, ride app story, music app story or your own brand — and fills it with your name, products and links. Every style can be changed in one tap.</li>
          <li><b>One journey, side by side.</b> The AI conversation and the plan sit next to each other, so every answer visibly lands somewhere. On phones they stack.</li>
          <li><b>An expert, not a chat box.</b> The helper reads the goal first, skips questions it can answer, says why it asks, and shows what it added to the plan.</li>
          <li><b>The user stays in control.</b> New campaigns start paused, the budget limit is pinned on screen, approval is a separate tick box naming the exact amount and dates, and editing a live campaign pauses it.</li>
          <li><b>Problems sit next to their step.</b> Missing items are shown on the field and on the review card they belong to, with a “Fix” link. Nothing typed is ever lost.</li>
          <li><b>Simple first, advanced on request.</b> Age range and placements are behind one switch. Words are plain — no ad-platform jargon or internal codes.</li>
          <li><b>Honest scope.</b> Only Meta can launch; other channels say “Coming soon”. Numbers and AI are simulated and labelled as such.</li>
        </ul>
      </section>
      <section className="card stack" aria-labelledby="ai-h2">
        <h2 id="ai-h2" className="h2">Built with AI</h2>
        <p className="small muted" style={{ margin: 0 }}>Designed and coded with Claude, evolving an earlier prototype in place. Example prompts used:</p>
        <ul className="whylist">
          <li>“Transform my existing project into Living Ads without rebuilding it — reuse components, minimal diff.”</li>
          <li>“The AI should ask only what it needs, explain why, and never launch without explicit approval.”</li>
          <li>“Show empty, blocked and live states, with problems next to the step they belong to.”</li>
        </ul>
      </section>
    </>
  );
}

export function loadExamples() {
  const make = (goal: string, answers: string[]) => answers.reduce((c, a) => answer(c, a), newCampaign(goal));
  const live = make("I want to promote a children's retreat in Bali", ['Parents of children aged 6–14', 'Mumbai, Delhi & Bengaluru', 'Start tomorrow · 30 days', '₹50,000', 'Early-bird 15% off', 'Use a sample image for now', 'insta @balikidsretreat, yt @balikidsretreat']);
  const now = Date.now();
  const d = (n: number) => addDays(n);
  Object.assign(live, { status: 'live', startDate: d(-5), endDate: d(24), approvedAt: now - 6 * 60000, launchedAt: now - 6 * 60000 });
  const blocked = make('Fill my weekend pottery workshop in Pune', ['Young professionals 22–35', 'Pune & Mumbai', 'Start tomorrow · 14 days', '₹10,000', 'No offer', 'Add it later', 'Skip for now']);
  const ready = make('Get sign-ups for my coding bootcamp webinar', ['Students 18–24', 'All of India', 'Start next week · 21 days', '₹25,000', 'Free call to learn more', 'Use a sample image for now', 'Skip for now']);
  store.update((s) => ({ ...s, campaigns: [live, blocked, ready, ...(s.campaigns ?? [])] }));
  toast('Example campaigns loaded');
}

/* ---------------- animated ad editor ---------------- */
function AdStyleFields({ c, set }: { c: Campaign; set: (p: Partial<Campaign>) => void }) {
  const ad = adOf(c);
  const meta = tpl(ad.template);
  const [itemsText, setItemsText] = useState(ad.items.join(', '));
  useEffect(() => { setItemsText(adOf(c).items.join(', ')); }, [ad.template]);
  const setAd = (p: Partial<typeof ad>) => set({ ad: { ...ad, ...p } });
  const pick = (id: TemplateId) => { if (id !== ad.template) set({ ad: { ...defaultAd(c, id), brand: ad.brand } }); };
  return (
    <fieldset className="card stack" id="f-adstyle">
      <legend className="h3">Animated ad</legend>
      <div className="chips tplchips" role="group" aria-label="Ad style">{TEMPLATES.map((t) => <button key={t.id} type="button" className="chip" aria-pressed={ad.template === t.id} onClick={() => pick(t.id)}>{t.label}</button>)}</div>
      <p className="small muted" style={{ margin: 0 }}>{meta.blurb}</p>
      <div className="formgrid two-col">
        <Field label="Brand name on the ad">{(id) => <input id={id} className="input" value={ad.brand} onChange={(e) => setAd({ brand: e.target.value })} />}</Field>
        <Field label="Tagline">{(id) => <input id={id} className="input" maxLength={60} value={ad.tagline} onChange={(e) => setAd({ tagline: e.target.value })} />}</Field>
      </div>
      <Field label={meta.itemsLabel}>{(id) => <input id={id} className="input" value={itemsText} onChange={(e) => { setItemsText(e.target.value); setAd({ items: e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6) }); }} />}</Field>
      {ad.template === 'brand' && <Field label="Brand colour">{(id) => <input id={id} type="color" className="input colorin" value={ad.accent} onChange={(e) => setAd({ accent: e.target.value })} />}</Field>}
    </fieldset>
  );
}

/* ---------------- ad studio: the four styles, live ---------------- */
export function Studio() {
  const start = (goal: string) => { const c = newCampaign(goal); saveCampaign(c); navigate(`/campaign/${c.id}/edit`); };
  return (
    <>
      <PageHeader title="Ad studio" sub="Four animated ad styles. Pick one and the AI helper builds your campaign around it — with your name, products and links." backTo="/" />
      <div className="studio">
        {TEMPLATES.map((t) => {
          const demo = readGoalForDemo(t.id);
          return (
            <section key={t.id} className="card stack" aria-labelledby={`st-${t.id}`}>
              <div className="row between nowrap"><h2 id={`st-${t.id}`} className="h2">{t.label}</h2>{t.id === 'brand' ? <span className="badge info">Any business</span> : <span className="badge demo">Example brand</span>}</div>
              <AdPlayer spec={demo.spec} image={demo.image} instagram={demo.ig} youtube={demo.yt} cta={demo.cta} />
              <p className="small muted" style={{ margin: 0 }}>{t.blurb}</p>
              {t.id === 'brand'
                ? <Btn icon={<Sparkles />} onClick={() => navigate('/create')}>Make one for my business</Btn>
                : <Btn icon={<Sparkles />} onClick={() => start(t.example)}>Make an ad like this</Btn>}
            </section>
          );
        })}
      </div>
      <p className="xs dim" style={{ margin: 0 }}>Brands in these examples are made up. Your ad uses your own name, products, photos and links.</p>
    </>
  );
}
