/* Data access for the Buffett section: the letter list, the one-line
   quotes for the Buffett line, the topic concordances, and the shared
   geometry for the year ruler used by both figures. */
import lettersJson from '../data/buffett/letters.json';

export interface Letter {
  id: string;
  year: number;
  date: string | null;
  kind: 'partnership' | 'annual' | 'abel' | 'thanksgiving' | 'unknown';
  entity: string;
  format: string | null;
  words: number;
  source: string | null;
}

export interface LineEntry {
  id: string;
  year: number;
  kind: string;
  quote: string;
  note: string;
  corrected?: boolean;
}

export interface TopicEntry {
  id: string;
  year: number;
  excerpt: string;
  note: string;
  corrected?: boolean;
}

export interface Topic {
  topic: string;
  title: string;
  lede: string;
  related: string[];
  entries: TopicEntry[];
}

export const letters: Letter[] = (lettersJson as Letter[]).slice().sort((a, b) =>
  (a.date ?? `${a.year}`).localeCompare(b.date ?? `${b.year}`),
);
export const lettersById: Record<string, Letter> = Object.fromEntries(letters.map((l) => [l.id, l]));

/* line.json is assembled from the curated era files; absent until curation
   lands, so the figure must render without quotes. */
const lineModules = import.meta.glob<{ default: LineEntry[] }>('../data/buffett/line.json', { eager: true });
export const line: LineEntry[] = Object.values(lineModules)[0]?.default ?? [];
export const lineById: Record<string, LineEntry> = Object.fromEntries(line.map((e) => [e.id, e]));

const topicModules = import.meta.glob<{ default: Topic }>('../data/buffett/topics/*.json', { eager: true });
export const topics: Topic[] = Object.values(topicModules).map((m) => m.default).sort((a, b) => a.title.localeCompare(b.title));
export const topicBySlug: Record<string, Topic> = Object.fromEntries(topics.map((t) => [t.topic, t]));

/* Year ruler shared by the figures: 1959 → 2025 across x 200 → 2200. */
export const YEAR_MIN = 1959;
export const YEAR_MAX = 2025;
export const RULER_X0 = 200;
export const RULER_X1 = 2200;
export const xForYear = (year: number): number =>
  RULER_X0 + ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * (RULER_X1 - RULER_X0);

export function kindLabel(l: Letter): string {
  switch (l.kind) {
    case 'partnership': return 'Buffett Partnership letter';
    case 'annual': return 'Berkshire Hathaway letter';
    case 'abel': return 'Greg Abel, first letter';
    case 'thanksgiving': return 'Thanksgiving note';
    default: return 'Letter';
  }
}

export function dateLabel(l: Letter): string {
  if (!l.date) return String(l.year);
  const d = new Date(l.date);
  if (Number.isNaN(d.getTime())) return String(l.year);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
