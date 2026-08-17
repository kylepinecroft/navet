import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import { useCallback, useMemo } from 'react';
import { useDashboardCollectionStore } from '../dashboards/dashboard-collection-store';
import {
  DEFAULT_HOME_DASHBOARD_LAYOUT,
  type HomeDashboardLayoutState,
  type HomeDashboardSection,
  type HomeLayoutMode,
} from '../stores/home-dashboard-layout-store';
import {
  CARD_LAYOUT_COLUMNS,
  type CardOrigin,
  cardSpanForSize,
  fillMissingCardLayouts,
  findFirstFit,
  placeCardAt,
  rewriteCardIdsForSection,
} from '../utils/card-placement';
import {
  getBottomRow,
  getSectionCardMinColumns,
  insertSectionBelow,
  insertSectionRow,
  layoutRow,
  moveSectionStack,
  moveSectionToPosition,
  removeSectionFromLayout,
  replaceRow,
  SECTION_LAYOUT_COLUMNS,
  type SectionLayoutItem,
  sortSectionLayout,
} from '../utils/layout-engine';

export type {
  HomeDashboardLayoutState,
  HomeDashboardSection,
  HomeDashboardSectionSpan,
  HomeLayoutMode,
} from '../stores/home-dashboard-layout-store';

const SECTION_TITLE_PREFIX = 'Section';
const CUSTOM_CARD_ID_PREFIX = 'custom-';

function createSectionId() {
  return `home-section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getNextSectionTitle(sectionCount: number) {
  return `${SECTION_TITLE_PREFIX} ${sectionCount + 1}`;
}

function toHomeSection(section: SectionLayoutItem): HomeDashboardSection {
  return {
    ...section,
    span: section.w,
  };
}

function toSectionLayoutItem(section: HomeDashboardSection): SectionLayoutItem {
  return {
    id: section.id,
    title: section.title,
    x: section.x,
    y: section.y,
    w: section.w,
    h: section.h,
  };
}

function withFilledCardLayouts(
  layout: HomeDashboardLayoutState,
  cardSizes: Record<string, CardSize | undefined>
): HomeDashboardLayoutState {
  const columns = layout.cardGridColumns || CARD_LAYOUT_COLUMNS;
  if (layout.mode !== 'sectioned') {
    return {
      ...layout,
      cardLayouts: layout.cardLayouts ?? {},
      cardGridColumns: columns,
    };
  }

  return {
    ...layout,
    cardGridColumns: columns,
    cardLayouts: fillMissingCardLayouts({
      cardIds: layout.cardIds,
      assignments: layout.cardSectionAssignments,
      existing: layout.cardLayouts ?? {},
      cardSizes,
      columns,
      sectionIds: layout.sections.map((section) => section.id),
    }),
  };
}

function placeCardInSection(
  layout: HomeDashboardLayoutState,
  cardId: string,
  origin: CardOrigin,
  cardSizes: Record<string, CardSize | undefined>,
  sectionId?: string
): HomeDashboardLayoutState {
  const filled = withFilledCardLayouts(layout, cardSizes);
  const assignments =
    filled.mode === 'sectioned' && sectionId
      ? { ...filled.cardSectionAssignments, [cardId]: sectionId }
      : filled.cardSectionAssignments;
  const targetSectionId = assignments[cardId];
  const sectionCardIds = filled.cardIds.filter(
    (id) => assignments[id] === targetSectionId || id === cardId
  );
  const nextLayouts = {
    ...filled.cardLayouts,
    ...placeCardAt(
      sectionCardIds,
      filled.cardLayouts,
      cardId,
      origin,
      cardSizes,
      filled.cardGridColumns
    ),
  };
  const nextCardIds = filled.cardIds.includes(cardId)
    ? filled.cardIds
    : [...filled.cardIds, cardId];

  return {
    ...filled,
    cardIds: targetSectionId
      ? rewriteCardIdsForSection(nextCardIds, targetSectionId, assignments, nextLayouts)
      : nextCardIds,
    cardSectionAssignments: assignments,
    cardLayouts: nextLayouts,
  };
}

export function useHomeDashboardLayout(
  validCardIds: string[],
  cardSizes: Record<string, CardSize>
) {
  const validCardIdsKey = JSON.stringify(validCardIds);
  const validIdSet = useMemo(
    () => new Set<string>(JSON.parse(validCardIdsKey) as string[]),
    [validCardIdsKey]
  );
  const layout = useDashboardCollectionStore(
    (state) =>
      state.collection.dashboardsById[state.activeDashboardId]?.homeLayout ??
      DEFAULT_HOME_DASHBOARD_LAYOUT
  );
  const canUndo = useDashboardCollectionStore((state) => state.layoutHistory.past.length > 0);
  const canRedo = useDashboardCollectionStore((state) => state.layoutHistory.future.length > 0);
  const updateLayout = useDashboardCollectionStore((state) => state.updateActiveHomeLayout);
  const replaceLayout = useDashboardCollectionStore((state) => state.replaceActiveHomeLayout);
  const undoLayout = useDashboardCollectionStore((state) => state.undoActiveHomeLayout);
  const redoLayout = useDashboardCollectionStore((state) => state.redoActiveHomeLayout);

  const persistLayout = useCallback(
    (
      updater:
        | HomeDashboardLayoutState
        | ((previous: HomeDashboardLayoutState) => HomeDashboardLayoutState)
    ) => updateLayout(updater),
    [updateLayout]
  );

  const setMode = useCallback(
    (mode: HomeLayoutMode) => {
      persistLayout((previous) => {
        if (mode !== 'sectioned') {
          return { ...previous, mode };
        }

        const sections =
          previous.sections.length > 0
            ? previous.sections
            : [
                toHomeSection({
                  id: createSectionId(),
                  title: getNextSectionTitle(0),
                  x: 0,
                  y: 0,
                  w: SECTION_LAYOUT_COLUMNS,
                  h: 1,
                }),
              ];
        const firstSectionId = sections[0]?.id;
        const nextAssignments = firstSectionId
          ? Object.fromEntries(
              previous.cardIds.map((cardId) => [
                cardId,
                previous.cardSectionAssignments[cardId] ?? firstSectionId,
              ])
            )
          : previous.cardSectionAssignments;

        return withFilledCardLayouts(
          {
            ...previous,
            mode,
            sections,
            cardSectionAssignments: nextAssignments,
          },
          cardSizes
        );
      });
    },
    [cardSizes, persistLayout]
  );

  const setShowHero = useCallback(
    (showHero: boolean) => {
      persistLayout((previous) => ({ ...previous, showHero }));
    },
    [persistLayout]
  );

  const addSection = useCallback(() => {
    const sectionId = createSectionId();

    persistLayout((previous) => ({
      ...previous,
      sections: [
        ...previous.sections,
        toHomeSection({
          id: sectionId,
          title: getNextSectionTitle(previous.sections.length),
          x: 0,
          y: getBottomRow(previous.sections.map(toSectionLayoutItem)),
          w: SECTION_LAYOUT_COLUMNS,
          h: 1,
        }),
      ],
    }));

    return sectionId;
  }, [persistLayout]);

  const addColumnSection = useCallback(
    (targetSectionId?: string) => {
      const sectionId = createSectionId();

      persistLayout((previous) => {
        const items = previous.sections.map(toSectionLayoutItem);
        const targetSection = targetSectionId
          ? previous.sections.find((section) => section.id === targetSectionId)
          : undefined;
        const nextItems = insertSectionRow(
          items,
          {
            id: sectionId,
            title: getNextSectionTitle(previous.sections.length),
          },
          targetSection?.y
        );

        return {
          ...previous,
          sections: nextItems.map(toHomeSection),
        };
      });

      return sectionId;
    },
    [persistLayout]
  );

  const addSectionBelow = useCallback(
    (targetSectionId: string) => {
      const sectionId = createSectionId();

      persistLayout((previous) => ({
        ...previous,
        sections: insertSectionBelow(
          previous.sections.map(toSectionLayoutItem),
          targetSectionId,
          sectionId,
          getNextSectionTitle(previous.sections.length)
        ).map(toHomeSection),
      }));

      return sectionId;
    },
    [persistLayout]
  );

  const renameSection = useCallback(
    (sectionId: string, title: string) => {
      persistLayout((previous) => ({
        ...previous,
        sections: previous.sections.map((section) =>
          section.id === sectionId ? { ...section, title } : section
        ),
      }));
    },
    [persistLayout]
  );

  const removeSection = useCallback(
    (sectionId: string) => {
      persistLayout((previous) => {
        const nextSections = removeSectionFromLayout(
          previous.sections.map(toSectionLayoutItem),
          sectionId
        ).map(toHomeSection);
        const fallbackSectionId = sortSectionLayout(nextSections)[0]?.id;
        const nextAssignments = Object.fromEntries(
          Object.entries(previous.cardSectionAssignments).flatMap(([cardId, assignedSectionId]) => {
            if (assignedSectionId !== sectionId) {
              return [[cardId, assignedSectionId]];
            }

            return fallbackSectionId ? [[cardId, fallbackSectionId]] : [];
          })
        );

        return {
          ...previous,
          sections: nextSections,
          cardSectionAssignments: nextAssignments,
        };
      });
    },
    [persistLayout]
  );

  const resizeSection = useCallback(
    (sectionId: string, newW: number, minWidthsBySection: Record<string, number> = {}) => {
      persistLayout((previous) => {
        const items = previous.sections.map(toSectionLayoutItem);
        const target = items.find((s) => s.id === sectionId);
        if (!target) return previous;

        const rowItems = sortSectionLayout(items.filter((s) => s.y === target.y));
        if (rowItems.length <= 1) return previous;

        const resolvedMinWidths = Object.fromEntries(
          rowItems.map((item) => {
            const sectionCardIds = previous.cardIds.filter(
              (cardId) => previous.cardSectionAssignments[cardId] === item.id
            );
            const fallbackMinWidth = Math.max(
              1,
              ...sectionCardIds.map((cardId) => getSectionCardMinColumns(cardSizes[cardId]))
            );

            return [
              item.id,
              Math.max(1, Math.round(minWidthsBySection[item.id] ?? fallbackMinWidth)),
            ];
          })
        );

        const minW = resolvedMinWidths[sectionId] ?? 1;
        const maxW =
          SECTION_LAYOUT_COLUMNS -
          rowItems
            .filter((item) => item.id !== sectionId)
            .reduce((total, item) => total + (resolvedMinWidths[item.id] ?? 1), 0);
        const clampedW = Math.max(minW, Math.min(maxW, Math.round(newW)));
        if (clampedW === target.w) return previous;

        const targetIdx = rowItems.findIndex((s) => s.id === sectionId);
        const neighborIdx = targetIdx < rowItems.length - 1 ? targetIdx + 1 : targetIdx - 1;
        const neighbor = rowItems[neighborIdx];
        if (!neighbor) return previous;

        const delta = clampedW - target.w;
        const newNeighborW = neighbor.w - delta;
        const neighborMinW = resolvedMinWidths[neighbor.id] ?? 1;
        if (newNeighborW < neighborMinW || newNeighborW > SECTION_LAYOUT_COLUMNS) return previous;

        const newRow = layoutRow(
          rowItems.map((s) => ({
            ...s,
            w: s.id === sectionId ? clampedW : s.id === neighbor.id ? newNeighborW : s.w,
          })),
          target.y
        );
        const resizedTarget = newRow.find((item) => item.id === sectionId);
        if (!resizedTarget) return previous;

        const stackedDescendantIds: string[] = [];
        let nextY = target.y + 1;

        while (true) {
          const nextRowItem = items.find(
            (item) => item.y === nextY && item.x === target.x && item.w === target.w
          );

          if (!nextRowItem) {
            break;
          }

          stackedDescendantIds.push(nextRowItem.id);
          nextY += 1;
        }

        const nextSections = replaceRow(items, target.y, newRow).map((item) =>
          stackedDescendantIds.includes(item.id)
            ? { ...item, x: resizedTarget.x, w: resizedTarget.w }
            : item
        );

        return {
          ...previous,
          sections: nextSections.map(toHomeSection),
        };
      });
    },
    [cardSizes, persistLayout]
  );

  const resetLayout = useCallback(() => {
    persistLayout(DEFAULT_HOME_DASHBOARD_LAYOUT);
  }, [persistLayout]);

  const applyLayout = useCallback(
    (nextLayout: HomeDashboardLayoutState) => {
      replaceLayout(nextLayout);
    },
    [replaceLayout]
  );

  const addCard = useCallback(
    (cardId: string, sectionId?: string) => {
      if (!validIdSet.has(cardId) && !cardId.startsWith(CUSTOM_CARD_ID_PREFIX)) {
        return;
      }

      persistLayout((previous) => {
        const cardIds = previous.cardIds.includes(cardId)
          ? previous.cardIds
          : [...previous.cardIds, cardId];
        const nextAssignments =
          sectionId && previous.mode === 'sectioned'
            ? { ...previous.cardSectionAssignments, [cardId]: sectionId }
            : previous.cardSectionAssignments;

        if (previous.mode !== 'sectioned' || !sectionId) {
          return {
            ...previous,
            cardIds,
            cardSectionAssignments: nextAssignments,
          };
        }

        const filled = withFilledCardLayouts(
          {
            ...previous,
            cardIds,
            cardSectionAssignments: nextAssignments,
          },
          cardSizes
        );
        const occupants = filled.cardIds
          .filter((id) => nextAssignments[id] === sectionId && id !== cardId)
          .flatMap((id) => {
            const origin = filled.cardLayouts[id];
            return origin
              ? [{ ...origin, ...cardSpanForSize(cardSizes[id], filled.cardGridColumns) }]
              : [];
          });
        const origin = findFirstFit(
          occupants,
          cardSpanForSize(cardSizes[cardId], filled.cardGridColumns),
          filled.cardGridColumns
        );

        return placeCardInSection(filled, cardId, origin, cardSizes, sectionId);
      });
    },
    [cardSizes, persistLayout, validIdSet]
  );

  const removeCard = useCallback(
    (cardId: string) => {
      persistLayout((previous) => {
        const nextAssignments = { ...previous.cardSectionAssignments };
        delete nextAssignments[cardId];
        const nextLayouts = { ...previous.cardLayouts };
        delete nextLayouts[cardId];

        return {
          ...previous,
          cardIds: previous.cardIds.filter((id) => id !== cardId),
          cardSectionAssignments: nextAssignments,
          cardLayouts: nextLayouts,
        };
      });
    },
    [persistLayout]
  );

  const moveCard = useCallback(
    (activeId: string, overId: string | null, sectionId?: string, origin?: CardOrigin) => {
      persistLayout((previous) => {
        if (!previous.cardIds.includes(activeId)) {
          return previous;
        }

        const nextAssignments =
          previous.mode === 'sectioned' && sectionId
            ? { ...previous.cardSectionAssignments, [activeId]: sectionId }
            : previous.cardSectionAssignments;
        const withoutActive = previous.cardIds.filter((id) => id !== activeId);

        if (previous.mode !== 'sectioned') {
          const nextCardIds = [...withoutActive];

          if (!overId || !withoutActive.includes(overId)) {
            nextCardIds.push(activeId);
          } else {
            nextCardIds.splice(withoutActive.indexOf(overId), 0, activeId);
          }

          return {
            ...previous,
            cardIds: nextCardIds,
            cardSectionAssignments: nextAssignments,
          };
        }

        const filled = withFilledCardLayouts(
          {
            ...previous,
            cardSectionAssignments: nextAssignments,
          },
          cardSizes
        );
        const dropOrigin =
          origin ??
          (overId && filled.cardLayouts[overId]
            ? filled.cardLayouts[overId]
            : findFirstFit(
                filled.cardIds
                  .filter(
                    (id) => nextAssignments[id] === nextAssignments[activeId] && id !== activeId
                  )
                  .flatMap((id) => {
                    const placed = filled.cardLayouts[id];
                    return placed
                      ? [{ ...placed, ...cardSpanForSize(cardSizes[id], filled.cardGridColumns) }]
                      : [];
                  }),
                cardSpanForSize(cardSizes[activeId], filled.cardGridColumns),
                filled.cardGridColumns
              ));

        return placeCardInSection(filled, activeId, dropOrigin, cardSizes, sectionId);
      });
    },
    [cardSizes, persistLayout]
  );

  const applyCardSize = useCallback(
    (cardId: string, size: CardSize) => {
      persistLayout((previous) => {
        if (previous.mode !== 'sectioned' || !previous.cardIds.includes(cardId)) {
          return previous;
        }

        const nextSizes = { ...cardSizes, [cardId]: size };
        const filled = withFilledCardLayouts(previous, nextSizes);
        const origin = filled.cardLayouts[cardId];
        if (!origin) {
          return filled;
        }

        const previousSpan = cardSpanForSize(cardSizes[cardId], filled.cardGridColumns);
        const nextSpan = cardSpanForSize(size, filled.cardGridColumns);
        if (nextSpan.w <= previousSpan.w && nextSpan.h <= previousSpan.h) {
          return filled;
        }

        return placeCardInSection(
          filled,
          cardId,
          origin,
          nextSizes,
          filled.cardSectionAssignments[cardId]
        );
      });
    },
    [cardSizes, persistLayout]
  );

  const moveSection = useCallback(
    (sourceId: string, targetId: string) => {
      persistLayout((previous) => ({
        ...previous,
        sections: moveSectionToPosition(
          previous.sections.map(toSectionLayoutItem),
          sourceId,
          targetId
        ).map(toHomeSection),
      }));
    },
    [persistLayout]
  );

  const moveColumn = useCallback(
    (sourceId: string, targetId: string) => {
      persistLayout((previous) => ({
        ...previous,
        sections: moveSectionStack(
          previous.sections.map(toSectionLayoutItem),
          sourceId,
          targetId
        ).map(toHomeSection),
      }));
    },
    [persistLayout]
  );

  return {
    layout,
    canRedo,
    canUndo,
    applyLayout,
    redoLayout,
    resetLayout,
    undoLayout,
    setMode,
    setShowHero,
    addSection,
    addColumnSection,
    addSectionBelow,
    moveSection,
    moveColumn,
    renameSection,
    removeSection,
    resizeSection,
    addCard,
    removeCard,
    moveCard,
    applyCardSize,
  };
}
