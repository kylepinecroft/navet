import type { HomeDashboardLayoutState } from '../hooks/use-home-dashboard-layout';
import { CARD_LAYOUT_COLUMNS, type CardLayoutMap, normalizeCardOrigin } from './card-placement';
import type { SectionLayoutItem } from './layout-engine';

interface LegacyLayoutState {
  mode?: 'flow' | 'sectioned';
  showHero?: boolean;
  cardIds?: string[];
  sections?: Array<{
    id?: string;
    title?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    span?: number;
  }>;
  cardSectionAssignments?: Record<string, string>;
  cardLayouts?: Record<string, unknown>;
  cardGridColumns?: number;
}

function isValidSection(section: unknown): section is SectionLayoutItem {
  if (!section || typeof section !== 'object') {
    return false;
  }

  const obj = section as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.w === 'number' &&
    typeof obj.h === 'number'
  );
}

function normalizeSection(section: unknown): SectionLayoutItem | null {
  if (!isValidSection(section)) {
    return null;
  }

  const obj = section as SectionLayoutItem;
  return {
    id: obj.id,
    title: obj.title,
    x: Math.max(0, Math.floor(obj.x)),
    y: Math.max(0, Math.floor(obj.y)),
    w: Math.max(1, Math.floor(obj.w)),
    h: Math.max(1, Math.floor(obj.h)),
  };
}

export function normalizeLayout(raw: unknown): Omit<HomeDashboardLayoutState, 'sections'> & {
  sections: SectionLayoutItem[];
} {
  const defaultLayout: Omit<HomeDashboardLayoutState, 'sections'> & {
    sections: SectionLayoutItem[];
  } = {
    mode: 'flow',
    showHero: true,
    cardIds: [],
    sections: [],
    cardSectionAssignments: {},
    cardLayouts: {},
    cardGridColumns: CARD_LAYOUT_COLUMNS,
  };

  if (!raw || typeof raw !== 'object') {
    return defaultLayout;
  }

  const obj = raw as LegacyLayoutState;
  const mode = obj.mode === 'sectioned' ? 'sectioned' : 'flow';
  const showHero = obj.showHero ?? true;
  const cardIds = Array.isArray(obj.cardIds)
    ? obj.cardIds.filter((id): id is string => typeof id === 'string')
    : [];
  const cardSectionAssignments =
    obj.cardSectionAssignments && typeof obj.cardSectionAssignments === 'object'
      ? Object.fromEntries(
          Object.entries(obj.cardSectionAssignments).filter(
            ([key, value]) => typeof key === 'string' && typeof value === 'string'
          )
        )
      : {};

  const sections: SectionLayoutItem[] = [];
  if (Array.isArray(obj.sections)) {
    for (const section of obj.sections) {
      const normalized = normalizeSection(section);
      if (normalized) {
        sections.push(normalized);
      }
    }
  }

  const cardLayouts: CardLayoutMap = {};
  if (obj.cardLayouts && typeof obj.cardLayouts === 'object') {
    for (const [cardId, rawOrigin] of Object.entries(obj.cardLayouts)) {
      if (typeof cardId !== 'string') {
        continue;
      }
      const origin = normalizeCardOrigin(rawOrigin);
      if (origin) {
        cardLayouts[cardId] = origin;
      }
    }
  }

  const cardGridColumns =
    typeof obj.cardGridColumns === 'number' && Number.isFinite(obj.cardGridColumns)
      ? Math.max(1, Math.floor(obj.cardGridColumns))
      : CARD_LAYOUT_COLUMNS;

  return {
    mode,
    showHero,
    cardIds,
    sections,
    cardSectionAssignments,
    cardLayouts,
    cardGridColumns,
  };
}
