import { describe, expect, it } from 'vitest';
import {
  areSnapDropPreviewsEqual,
  CARD_LAYOUT_COLUMNS,
  cardSpanForSize,
  clampCardOrigin,
  cssPointToCell,
  fillMissingCardLayouts,
  findFirstFit,
  packCardsFromOrder,
  placeCardAt,
  rectsOverlap,
  sortCardIdsByPlacement,
} from '../card-placement';

describe('card placement', () => {
  it('packs cards from order without overlap, filling first-fit holes', () => {
    const layouts = packCardsFromOrder(['a', 'b', 'c'], { a: 'small', b: 'small', c: 'medium' }, 6);

    expect(layouts).toEqual({
      a: { x: 0, y: 0 },
      b: { x: 2, y: 0 },
      c: { x: 0, y: 2 },
    });
    expect(cardSpanForSize('small', 6)).toEqual({ w: 2, h: 2 });
    expect(cardSpanForSize('medium', 6)).toEqual({ w: 4, h: 2 });
  });

  it('leaves a hole when first-fit cannot fill a leftover cell', () => {
    const layouts = packCardsFromOrder(
      ['wide', 'small'],
      { wide: 'extra-large', small: 'small' },
      8
    );

    expect(layouts.wide).toEqual({ x: 0, y: 0 });
    expect(layouts.small).toEqual({ x: 6, y: 0 });
    expect(
      findFirstFit(
        [
          { x: 0, y: 0, w: 6, h: 4 },
          { x: 6, y: 0, w: 2, h: 2 },
        ],
        { w: 4, h: 2 },
        8
      )
    ).toEqual({ x: 0, y: 4 });
  });

  it('pushes overlapping neighbors down and leaves unrelated cards in place', () => {
    const next = placeCardAt(
      ['anchor', 'moved', 'side'],
      {
        anchor: { x: 0, y: 0 },
        moved: { x: 0, y: 4 },
        side: { x: 6, y: 0 },
      },
      'moved',
      { x: 0, y: 2 },
      { anchor: 'large', moved: 'small', side: 'small' },
      CARD_LAYOUT_COLUMNS
    );

    expect(next.moved).toEqual({ x: 0, y: 2 });
    expect(next.anchor).toEqual({ x: 0, y: 4 });
    expect(next.side).toEqual({ x: 6, y: 0 });
    expect(rectsOverlap({ x: 0, y: 2, w: 2, h: 2 }, { x: 0, y: 4, w: 4, h: 4 })).toBe(false);
  });

  it('fills missing coordinates without moving already placed cards', () => {
    const layouts = fillMissingCardLayouts({
      cardIds: ['placed', 'missing'],
      assignments: { placed: 'section-a', missing: 'section-a' },
      existing: { placed: { x: 4, y: 2 } },
      cardSizes: { placed: 'small', missing: 'small' },
      columns: 8,
      sectionIds: ['section-a'],
    });

    expect(layouts.placed).toEqual({ x: 4, y: 2 });
    expect(layouts.missing).toEqual({ x: 0, y: 0 });
  });

  it('packs a whole section when no cards have coordinates yet', () => {
    const layouts = fillMissingCardLayouts({
      cardIds: ['one', 'two'],
      assignments: { one: 'section-a', two: 'section-a' },
      existing: {},
      cardSizes: { one: 'small', two: 'small' },
      columns: 6,
      sectionIds: ['section-a'],
    });

    expect(layouts).toEqual({
      one: { x: 0, y: 0 },
      two: { x: 2, y: 0 },
    });
  });

  it('reads cards top-to-bottom, then left-to-right', () => {
    expect(
      sortCardIdsByPlacement(['c', 'a', 'b'], {
        a: { x: 2, y: 0 },
        b: { x: 0, y: 2 },
        c: { x: 0, y: 0 },
      })
    ).toEqual(['c', 'a', 'b']);
  });

  it('snaps a local CSS point onto the nearest cell origin', () => {
    expect(cssPointToCell(0, 0, 188, 2, 12, 88)).toEqual({ x: 0, y: 0 });
    expect(cssPointToCell(100, 100, 188, 2, 12, 88)).toEqual({ x: 1, y: 1 });
  });

  it('clamps a snap origin so the card stays inside the authored columns', () => {
    expect(clampCardOrigin({ x: 11, y: 3 }, { w: 4, h: 2 }, CARD_LAYOUT_COLUMNS)).toEqual({
      x: 8,
      y: 3,
    });
    expect(clampCardOrigin({ x: -2, y: -1 }, { w: 2, h: 2 }, CARD_LAYOUT_COLUMNS)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('treats snap drop previews as equal only when the landing cell is unchanged', () => {
    const preview = { sectionId: 'section-a', x: 2, y: 1 };

    expect(areSnapDropPreviewsEqual(preview, { ...preview })).toBe(true);
    expect(areSnapDropPreviewsEqual(preview, { ...preview, x: 3 })).toBe(false);
    expect(areSnapDropPreviewsEqual(preview, null)).toBe(false);
  });
});
