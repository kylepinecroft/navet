import { type CardSize, getCardSizeGridSpan } from '@navet/app/components/shared/card-size';

export interface CardOrigin {
  x: number;
  y: number;
}

export interface CardSpan {
  w: number;
  h: number;
}

export interface CardRect extends CardOrigin, CardSpan {}

export interface PlacedCard extends CardRect {
  id: string;
}

export type CardLayoutMap = Record<string, CardOrigin>;

export interface SnapDropPreview extends CardOrigin {
  sectionId: string;
}

/** Canonical inner-grid width in micro-tracks. `tiny` is 1×1; `extra-large` is 6×4. */
export const CARD_LAYOUT_COLUMNS = 12;
const PUSH_DOWN_ITERATION_LIMIT = 2000;

export function isValidCardOrigin(value: unknown): value is CardOrigin {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const origin = value as Record<string, unknown>;
  return (
    typeof origin.x === 'number' &&
    Number.isFinite(origin.x) &&
    typeof origin.y === 'number' &&
    Number.isFinite(origin.y)
  );
}

export function normalizeCardOrigin(value: unknown): CardOrigin | null {
  if (!isValidCardOrigin(value)) {
    return null;
  }

  return {
    x: Math.max(0, Math.floor(value.x)),
    y: Math.max(0, Math.floor(value.y)),
  };
}

export function cardSpanForSize(
  size: CardSize | undefined,
  columns = CARD_LAYOUT_COLUMNS
): CardSpan {
  const span = getCardSizeGridSpan(size);
  return {
    w: Math.min(columns, Math.max(1, span.w)),
    h: Math.max(1, span.h),
  };
}

export function rectsOverlap(left: CardRect, right: CardRect) {
  return (
    left.x < right.x + right.w &&
    right.x < left.x + left.w &&
    left.y < right.y + right.h &&
    right.y < left.y + left.h
  );
}

export function clampCardOrigin(origin: CardOrigin, span: CardSpan, columns: number): CardOrigin {
  const width = Math.min(columns, Math.max(1, span.w));
  return {
    x: Math.max(0, Math.min(columns - width, Math.floor(origin.x))),
    y: Math.max(0, Math.floor(origin.y)),
  };
}

export function findFirstFit(
  occupants: readonly CardRect[],
  span: CardSpan,
  columns: number
): CardOrigin {
  const fitted = {
    w: Math.min(columns, Math.max(1, span.w)),
    h: Math.max(1, span.h),
  };
  const maxY = occupants.reduce((bottom, occupant) => Math.max(bottom, occupant.y + occupant.h), 0);

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= columns - fitted.w; x += 1) {
      const candidate = { x, y, ...fitted };
      if (!occupants.some((occupant) => rectsOverlap(candidate, occupant))) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: maxY };
}

export function packCardsFromOrder(
  cardIds: readonly string[],
  cardSizes: Record<string, CardSize | undefined>,
  columns = CARD_LAYOUT_COLUMNS
): CardLayoutMap {
  const occupants: CardRect[] = [];
  const layouts: CardLayoutMap = {};

  for (const cardId of cardIds) {
    const span = cardSpanForSize(cardSizes[cardId], columns);
    const origin = findFirstFit(occupants, span, columns);
    layouts[cardId] = origin;
    occupants.push({ ...origin, ...span });
  }

  return layouts;
}

export function sortCardIdsByPlacement(
  cardIds: readonly string[],
  layouts: CardLayoutMap
): string[] {
  return [...cardIds].sort((left, right) => {
    const leftOrigin = layouts[left];
    const rightOrigin = layouts[right];
    const leftY = leftOrigin?.y ?? Number.POSITIVE_INFINITY;
    const rightY = rightOrigin?.y ?? Number.POSITIVE_INFINITY;
    const leftX = leftOrigin?.x ?? Number.POSITIVE_INFINITY;
    const rightX = rightOrigin?.x ?? Number.POSITIVE_INFINITY;
    return leftY - rightY || leftX - rightX;
  });
}

export function rewriteCardIdsForSection(
  cardIds: readonly string[],
  sectionId: string,
  assignments: Record<string, string>,
  layouts: CardLayoutMap
): string[] {
  const sectionCardIds = cardIds.filter((cardId) => assignments[cardId] === sectionId);
  const sorted = sortCardIdsByPlacement(sectionCardIds, layouts);
  let index = 0;

  return cardIds.map((cardId) =>
    assignments[cardId] === sectionId ? (sorted[index++] ?? cardId) : cardId
  );
}

function toPlacedCards(
  cardIds: readonly string[],
  layouts: CardLayoutMap,
  cardSizes: Record<string, CardSize | undefined>,
  columns: number
): PlacedCard[] {
  return cardIds.flatMap((cardId) => {
    const origin = layouts[cardId];
    if (!origin) {
      return [];
    }

    return [{ id: cardId, ...origin, ...cardSpanForSize(cardSizes[cardId], columns) }];
  });
}

export function resolveOverlaps(cards: PlacedCard[], stayId: string): PlacedCard[] {
  const next = cards.map((card) => ({ ...card }));
  let changed = true;
  let iterations = 0;

  while (changed && iterations < PUSH_DOWN_ITERATION_LIMIT) {
    changed = false;
    iterations += 1;

    for (let leftIndex = 0; leftIndex < next.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < next.length; rightIndex += 1) {
        const left = next[leftIndex];
        const right = next[rightIndex];
        if (!left || !right || !rectsOverlap(left, right)) {
          continue;
        }

        const stay =
          left.id === stayId
            ? left
            : right.id === stayId
              ? right
              : left.y < right.y || (left.y === right.y && left.x <= right.x)
                ? left
                : right;
        const moving = stay.id === left.id ? right : left;
        const nextY = stay.y + stay.h;
        if (moving.y < nextY) {
          moving.y = nextY;
          changed = true;
        }
      }
    }
  }

  return next;
}

export function placeCardAt(
  cardIds: readonly string[],
  layouts: CardLayoutMap,
  cardId: string,
  origin: CardOrigin,
  cardSizes: Record<string, CardSize | undefined>,
  columns = CARD_LAYOUT_COLUMNS
): CardLayoutMap {
  const span = cardSpanForSize(cardSizes[cardId], columns);
  const clamped = clampCardOrigin(origin, span, columns);
  const ids = cardIds.includes(cardId) ? cardIds : [...cardIds, cardId];
  const nextLayouts = { ...layouts, [cardId]: clamped };
  const resolved = resolveOverlaps(toPlacedCards(ids, nextLayouts, cardSizes, columns), cardId);

  return Object.fromEntries(resolved.map((card) => [card.id, { x: card.x, y: card.y }]));
}

export function cssPointToCell(
  localX: number,
  localY: number,
  gridWidth: number,
  columns: number,
  gapPx: number,
  rowHeightPx: number
): CardOrigin {
  const trackWidth = columns <= 0 ? 0 : (gridWidth - gapPx * Math.max(0, columns - 1)) / columns;
  const pitchX = trackWidth + gapPx;
  const pitchY = rowHeightPx + gapPx;

  return {
    x: pitchX <= 0 ? 0 : Math.max(0, Math.round(localX / pitchX)),
    y: pitchY <= 0 ? 0 : Math.max(0, Math.round(localY / pitchY)),
  };
}

export function getSnapCardStyle(
  origin: CardOrigin,
  span: CardSpan
): { gridColumn: string; gridRow: string } {
  return {
    gridColumn: `${origin.x + 1} / span ${span.w}`,
    gridRow: `${origin.y + 1} / span ${span.h}`,
  };
}

export function areSnapDropPreviewsEqual(
  left?: SnapDropPreview | null,
  right?: SnapDropPreview | null
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.sectionId === right.sectionId && left.x === right.x && left.y === right.y;
}

export function areCardLayoutsEqual(left?: CardLayoutMap, right?: CardLayoutMap) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);
  if (leftIds.length !== rightIds.length) {
    return false;
  }

  return leftIds.every(
    (cardId) => left[cardId]?.x === right[cardId]?.x && left[cardId]?.y === right[cardId]?.y
  );
}

export function fillMissingCardLayouts({
  cardIds,
  assignments,
  existing,
  cardSizes,
  columns = CARD_LAYOUT_COLUMNS,
  sectionIds,
}: {
  cardIds: readonly string[];
  assignments: Record<string, string>;
  existing: CardLayoutMap;
  cardSizes: Record<string, CardSize | undefined>;
  columns?: number;
  sectionIds: readonly string[];
}): CardLayoutMap {
  const nextLayouts: CardLayoutMap = {};
  const sectionIdSet = new Set(sectionIds);
  const grouped = new Map<string, string[]>();

  for (const cardId of cardIds) {
    const sectionId = assignments[cardId];
    if (!sectionId || !sectionIdSet.has(sectionId)) {
      continue;
    }

    const group = grouped.get(sectionId);
    if (group) {
      group.push(cardId);
    } else {
      grouped.set(sectionId, [cardId]);
    }
  }

  for (const groupCardIds of grouped.values()) {
    const placedIds = groupCardIds.filter((cardId) => normalizeCardOrigin(existing[cardId]));
    const missingIds = groupCardIds.filter((cardId) => !normalizeCardOrigin(existing[cardId]));

    if (placedIds.length === 0) {
      Object.assign(nextLayouts, packCardsFromOrder(groupCardIds, cardSizes, columns));
      continue;
    }

    for (const cardId of placedIds) {
      const origin = normalizeCardOrigin(existing[cardId]);
      if (origin) {
        nextLayouts[cardId] = origin;
      }
    }

    const occupants: CardRect[] = placedIds.flatMap((cardId) => {
      const origin = nextLayouts[cardId];
      return origin ? [{ ...origin, ...cardSpanForSize(cardSizes[cardId], columns) }] : [];
    });

    for (const cardId of missingIds) {
      const span = cardSpanForSize(cardSizes[cardId], columns);
      const origin = findFirstFit(occupants, span, columns);
      nextLayouts[cardId] = origin;
      occupants.push({ ...origin, ...span });
    }
  }

  return nextLayouts;
}
