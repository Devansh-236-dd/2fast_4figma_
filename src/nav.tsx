import { BarChart3, Megaphone, Banknote, Bell, Bike, Building2, Bus, CalendarHeart, Car, Clapperboard, Hotel, Landmark, Lightbulb, Plane, QrCode, Receipt, Send, Settings, ShieldCheck, ShoppingBag, Smartphone, Sparkles, Train, UtensilsCrossed, Wallet, Accessibility, BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';

export interface NavItem { label: string; path: string; icon: ReactNode; match?: string[] }
export const SIDEBAR: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ label: 'Campaigns', path: '/', icon: <Megaphone />, match: ['/campaign'] }] },
  { group: 'Create & track', items: [
    { label: 'New campaign', path: '/create', icon: <Sparkles /> },
    { label: 'Ad studio', path: '/studio', icon: <Clapperboard /> },
    { label: 'Performance', path: '/performance', icon: <BarChart3 /> },
    { label: 'Notifications', path: '/notifications', icon: <Bell /> },
  ] },
  { group: 'You', items: [
    { label: 'How it works', path: '/about', icon: <BookOpen /> },
    { label: 'Accessibility', path: '/a11y', icon: <Accessibility /> },
    { label: 'Profile & settings', path: '/profile', icon: <Settings /> },
  ] },
];
export const BOTTOM: NavItem[] = [
  { label: 'Campaigns', path: '/', icon: <Megaphone />, match: ['/campaign'] },
  { label: 'Create', path: '/create', icon: <Sparkles /> },
  { label: 'Ad studio', path: '/studio', icon: <Clapperboard /> },
  { label: 'Results', path: '/performance', icon: <BarChart3 /> },
  { label: 'Guide', path: '/about', icon: <BookOpen />, match: ['/guide'] },
];
export const QUICK = [
  { label: 'Scan & Pay', path: '/scan', icon: <QrCode /> },
  { label: 'Send money', path: '/send', icon: <Send /> },
  { label: 'Receive', path: '/receive', icon: <Wallet /> },
  { label: 'Bank transfer', path: '/bank', icon: <Landmark /> },
  { label: 'Recharge', path: '/bills?t=mob', icon: <Smartphone /> },
  { label: 'Pay bills', path: '/bills', icon: <Receipt /> },
];
export const SERVICES = [
  { label: 'Travel', sub: 'All trips', path: '/travel', icon: <Sparkles />, color: '#0A5C4E' },
  { label: 'Flights', sub: 'Domestic', path: '/travel/flights', icon: <Plane />, color: '#1D4ED8' },
  { label: 'Trains', sub: 'PNR tickets', path: '/travel/trains', icon: <Train />, color: '#B45309' },
  { label: 'Buses', sub: 'Pick seats', path: '/travel/buses', icon: <Bus />, color: '#BE123C' },
  { label: 'Hotels', sub: 'Stays', path: '/travel/hotels', icon: <Hotel />, color: '#6D28D9' },
  { label: 'Movies', sub: 'Book seats', path: '/fun?k=movie', icon: <Clapperboard />, color: '#BE185D' },
  { label: 'Events', sub: 'Live shows', path: '/fun?k=event', icon: <CalendarHeart />, color: '#C2410C' },
  { label: 'Food', sub: 'Order in', path: '/food', icon: <UtensilsCrossed />, color: '#D93B2B' },
  { label: 'Shopping', sub: 'Essentials', path: '/shop', icon: <ShoppingBag />, color: '#0E7490' },
  { label: 'Local transport', sub: 'Metro · rides', path: '/transport', icon: <Car />, color: '#0369A1' },
  { label: 'Mobile recharge', sub: 'Prepaid', path: '/bills?t=mob', icon: <Smartphone />, color: '#4D7C0F' },
  { label: 'Electricity', sub: 'Utilities', path: '/bills?t=elec', icon: <Lightbulb />, color: '#A16207' },
  { label: 'Insurance', sub: 'Premiums', path: '/bills?t=ins', icon: <ShieldCheck />, color: '#0F766E' },
  { label: 'Parking', sub: 'Pay by hour', path: '/transport?t=parking', icon: <Building2 />, color: '#4338CA' },
  { label: 'Bike & auto', sub: 'Fare estimate', path: '/transport?t=ride', icon: <Bike />, color: '#7E22CE' },
  { label: 'Bank transfer', sub: 'To account', path: '/bank', icon: <Banknote />, color: '#475569' },
];
export const icons = { Bell };
