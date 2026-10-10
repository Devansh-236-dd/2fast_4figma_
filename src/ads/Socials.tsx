import { Check, Copy, Instagram, Youtube } from 'lucide-react';
import { useState } from 'react';
import { igUrl, ytUrl } from './meta';
import { toast } from '../components/ui';

/** Copies text; falls back to a hidden textarea where the Clipboard API is blocked (e.g. inside an iframe). */
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

const IG_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E1306C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>';
const YT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#FF0033" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>';

function Row({ kind, handle, compact }: { kind: 'instagram' | 'youtube'; handle: string; compact?: boolean }) {
  const [done, setDone] = useState<'' | 'link' | 'icon'>('');
  const url = kind === 'instagram' ? igUrl(handle) : ytUrl(handle);
  const Icon = kind === 'instagram' ? Instagram : Youtube;
  const name = kind === 'instagram' ? 'Instagram' : 'YouTube';
  const copy = async (what: 'link' | 'icon') => {
    const ok = await copyText(what === 'link' ? url : `<a href="${url}" target="_blank" rel="noopener">${kind === 'instagram' ? IG_SVG : YT_SVG}</a>`);
    if (ok) { setDone(what); setTimeout(() => setDone(''), 1500); toast(what === 'link' ? `${name} link copied` : `${name} icon copied — paste it into any web page`); }
    else toast('Copy is blocked here. Long-press the link to copy it.', 'err');
  };
  return (
    <div className={`soc ${kind}`}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="soclink" aria-label={`Open ${name}: @${handle} (opens in a new tab)`}>
        <span className="socicon" aria-hidden="true"><Icon /></span>{!compact && <span className="min0"><b>@{handle}</b><small>{name}</small></span>}
      </a>
      {!compact && <>
        <button type="button" className="iconbtn sm" aria-label={`Copy ${name} link`} onClick={() => copy('link')}>{done === 'link' ? <Check /> : <Copy />}</button>
        <button type="button" className="chip sm" onClick={() => copy('icon')}>{done === 'icon' ? 'Copied' : 'Copy icon'}</button>
      </>}
    </div>
  );
}

export function Socials({ instagram, youtube, compact }: { instagram?: string; youtube?: string; compact?: boolean }) {
  if (!instagram && !youtube) return null;
  return (
    <div className={`socials ${compact ? 'compact' : ''}`} role="group" aria-label="Social links">
      {instagram && <Row kind="instagram" handle={instagram} compact={compact} />}
      {youtube && <Row kind="youtube" handle={youtube} compact={compact} />}
    </div>
  );
}
