/** Example data for the Ad studio previews (made-up brands). */
import { SAMPLE_IMAGE, readGoal } from '../lib/campaign';
import { TEMPLATES, guessBrand, tpl, type AdSpec, type TemplateId } from './meta';
export { TEMPLATES, tpl };
export { cleanHandle, validHandle } from './meta';
export type { TemplateId };

export function readGoalForDemo(id: TemplateId): { spec: AdSpec; image: string | null; ig?: string; yt?: string; cta: string } {
  const t = tpl(id);
  if (id === 'brand') return { spec: { template: 'brand', brand: 'Your Business', ...t.defaults({ topic: '', venue: '', brand: '', goal: '' }) }, image: SAMPLE_IMAGE, ig: 'yourbusiness', cta: 'Book now' };
  const g = readGoal(t.example);
  const brand = guessBrand(t.example, g.venue, g.topic);
  const handle = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  return { spec: { template: id, brand, ...t.defaults({ topic: g.topic, venue: g.venue, brand, goal: t.example }) }, image: null, ig: handle, yt: handle, cta: id === 'ride' ? 'Book now' : 'Learn more' };
}
