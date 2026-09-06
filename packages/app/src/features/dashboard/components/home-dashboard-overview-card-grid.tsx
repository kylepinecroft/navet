import { useDroppable } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import {
  type CardSize,
  getCardSpanClass,
  getResponsiveCardSize,
} from '@navet/app/components/shared/card-size-selector';
import type { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { useI18n } from '@navet/app/hooks';
import { useBreakpointCols } from '@navet/app/hooks/use-breakpoint-cols';
import type { DeviceWithType } from '@navet/app/types/device.types';
import { Plus } from 'lucide-react';
import { type CSSProperties, memo, type ReactNode, useCallback, useMemo } from 'react';
import type { DropMeta } from '../hooks/use-home-dashboard-editor';
import { useHomeGridRuntime } from '../hooks/use-home-grid-runtime';
import type { CustomCard } from '../stores/custom-cards-store';
import {
  areCardLayoutsEqual,
  areSnapDropPreviewsEqual,
  CARD_LAYOUT_COLUMNS,
  cardSpanForSize,
  fillMissingCardLayouts,
  getSnapCardStyle,
  packCardsFromOrder,
  sortCardIdsByPlacement,
} from '../utils/card-placement';
import { DashboardCardItem } from './dashboard-card-item';
import {
  areCardIdsStable,
  type CardGridProps,
  isCustomCard,
} from './home-dashboard-overview.shared';
import { HomeCardSlot } from './home-dashboard-overview-card-slot';

export function FlowCanvas({
  cardIds,
  gridCols,
  activeDragCard,
  allCards,
  cardSizes,
  updateCardSize,
  isEditMode,
  onUpdateCard,
  onRemoveFromLayout,
  showHero,
  surface,
  onOpenAddCardDialog,
}: {
  cardIds: string[];
  gridCols: number;
  activeDragCard?: string | null;
  allCards: Map<string, DeviceWithType | CustomCard>;
  cardSizes: Record<string, CardSize>;
  updateCardSize: (id: string, size: CardSize) => void;
  isEditMode: boolean;
  onUpdateCard?: (cardId: string, data: Record<string, unknown>) => void;
  onRemoveFromLayout: (cardId: string) => void;
  showHero: boolean;
  surface: ReturnType<typeof getThemeSurfaceTokens>;
  onOpenAddCardDialog?: (targetSectionId?: string) => void;
}) {
  const { t } = useI18n();
  const sortableItems = useMemo(() => cardIds.map((cardId) => `home-card-${cardId}`), [cardIds]);

  return (
    <SortableContext items={sortableItems} strategy={rectSortingStrategy}>
      <HomeContainerDropZone cardIds={cardIds}>
        {cardIds.length > 0 ? (
          <CardGrid
            cardIds={cardIds}
            gridCols={gridCols}
            activeDragCard={activeDragCard}
            allCards={allCards}
            cardSizes={cardSizes}
            updateCardSize={updateCardSize}
            isEditMode={isEditMode}
            onUpdateCard={onUpdateCard}
            onRemoveFromLayout={onRemoveFromLayout}
            showHero={showHero}
            onOpenAddCardDialog={onOpenAddCardDialog}
          />
        ) : (
          <EmptyCanvas
            label={t('dashboard.overview.emptyCanvas.title')}
            description={t('dashboard.overview.emptyCanvas.description')}
            surface={surface}
            onClick={onOpenAddCardDialog}
          />
        )}
      </HomeContainerDropZone>
    </SortableContext>
  );
}

export function EmptyCanvas({
  label,
  description: _description,
  surface,
  compact = false,
  onClick,
}: {
  label: string;
  description: string;
  surface: ReturnType<typeof getThemeSurfaceTokens>;
  compact?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[20px] border-2 border-dashed text-center ${
        compact ? 'min-h-45 px-5 py-6' : 'min-h-55 px-5 py-8'
      } ${surface.panelMuted}`}
      style={{
        borderColor: 'rgba(255,255,255,0.12)',
        background:
          'radial-gradient(circle at top left, rgba(159,176,255,0.12), transparent 32%), radial-gradient(circle at bottom right, rgba(159,176,255,0.06), transparent 28%)',
      }}
    >
      <div className="space-y-2">
        <div className={`text-sm font-semibold ${surface.textPrimary}`}>{label}</div>
      </div>
    </div>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}

export const CardGrid = memo(function CardGrid({
  cardIds,
  sectionId,
  gridCols,
  activeDragCard,
  allCards,
  cardSizes,
  updateCardSize,
  isEditMode,
  onUpdateCard,
  onRemoveFromLayout,
  showHero,
  onOpenAddCardDialog,
  sortable = true,
  snapPlacement = false,
  cardLayouts,
  cardGridColumns,
  accentColor,
  snapDropPreview,
}: CardGridProps) {
  const { t } = useI18n();
  const breakpointCols = useBreakpointCols();
  const isPhone = breakpointCols <= 2;
  const snapColumns = cardGridColumns ?? CARD_LAYOUT_COLUMNS;
  const snapDesktop = snapPlacement && !isPhone;
  const hasTrailingAddCardSlot = isEditMode && Boolean(onOpenAddCardDialog);
  const {
    gridGapPx,
    gridStyle,
    innerContainerStyle,
    innerRef,
    isAutoScaled,
    optimizeOffscreenPaint,
    outerContainerStyle,
    outerRef,
    renderedGridCols,
    rowHeightPx,
    visibleCardIds,
  } = useHomeGridRuntime({
    allCards,
    cardIds,
    cardSizes,
    gridCols,
    forcedGridCols: snapDesktop ? snapColumns : undefined,
    isEditMode,
    sortable,
  });
  const placementLayouts = useMemo(() => {
    if (!snapPlacement) {
      return undefined;
    }

    const resolvedSizes = Object.fromEntries(
      cardIds.map((cardId) => {
        const entry = allCards.get(cardId);
        const size = cardSizes[cardId] ?? entry?.size ?? 'small';
        return [cardId, getResponsiveCardSize(size, breakpointCols)];
      })
    );

    if (isPhone) {
      return packCardsFromOrder(
        sortCardIdsByPlacement(cardIds, cardLayouts ?? {}),
        resolvedSizes,
        renderedGridCols
      );
    }

    const groupId = sectionId ?? '__section__';
    return fillMissingCardLayouts({
      cardIds,
      assignments: Object.fromEntries(cardIds.map((cardId) => [cardId, groupId])),
      existing: cardLayouts ?? {},
      cardSizes: resolvedSizes,
      columns: snapColumns,
      sectionIds: [groupId],
    });
  }, [
    allCards,
    breakpointCols,
    cardIds,
    cardLayouts,
    cardSizes,
    isPhone,
    renderedGridCols,
    sectionId,
    snapColumns,
    snapPlacement,
  ]);
  const addCardSlotCols = Math.min(renderedGridCols, 2);
  const hasInlineAddCardSlot = hasTrailingAddCardSlot;
  const handleAddCard = useCallback(() => {
    onOpenAddCardDialog?.();
  }, [onOpenAddCardDialog]);
  const addCardSlotStyle = useMemo(() => {
    const maxRow = placementLayouts
      ? cardIds.reduce((bottom, cardId) => {
          const origin = placementLayouts[cardId];
          const entry = allCards.get(cardId);
          const size = getResponsiveCardSize(
            cardSizes[cardId] ?? entry?.size ?? 'small',
            breakpointCols
          );
          return origin
            ? Math.max(bottom, origin.y + cardSpanForSize(size, renderedGridCols).h)
            : bottom;
        }, 0)
      : 0;

    return {
      gridColumn: `span ${addCardSlotCols} / span ${addCardSlotCols}`,
      ...(placementLayouts ? { gridRow: String(maxRow + 1) } : {}),
      borderColor: 'rgba(255,255,255,0.16)',
      background:
        'radial-gradient(circle at top left, rgba(159,176,255,0.1), transparent 34%), radial-gradient(circle at bottom right, rgba(159,176,255,0.06), transparent 28%)',
    } as CSSProperties;
  }, [
    addCardSlotCols,
    allCards,
    breakpointCols,
    cardIds,
    cardSizes,
    placementLayouts,
    renderedGridCols,
  ]);
  const allowSnapDrag = snapDesktop && isEditMode && sortable;
  const dropPreviewOrigin =
    snapDesktop &&
    snapDropPreview &&
    sectionId &&
    snapDropPreview.sectionId === sectionId &&
    activeDragCard
      ? snapDropPreview
      : null;
  const dropPreviewStyle = (() => {
    if (!dropPreviewOrigin || !activeDragCard || !accentColor) {
      return undefined;
    }

    const entry = allCards.get(activeDragCard);
    const size = getResponsiveCardSize(
      cardSizes[activeDragCard] ?? entry?.size ?? 'small',
      breakpointCols
    );
    return {
      ...getSnapCardStyle(dropPreviewOrigin, cardSpanForSize(size, renderedGridCols)),
      backgroundColor: `${accentColor}18`,
      boxShadow: `0 0 0 1px ${accentColor}55`,
      zIndex: 2,
    } as CSSProperties;
  })();

  return (
    <div ref={outerRef} className="relative w-full" style={outerContainerStyle}>
      <div
        ref={innerRef}
        className={`w-full${isAutoScaled ? ' absolute left-0 top-0 origin-top-left' : ''}`}
        style={innerContainerStyle}
      >
        <div
          className={`grid w-full gap-3 lg:gap-4 ${
            placementLayouts
              ? 'grid-flow-row'
              : hasInlineAddCardSlot
                ? 'grid-flow-row'
                : 'grid-flow-row-dense'
          }`}
          style={gridStyle}
          data-home-card-grid={sectionId ?? 'flow'}
          data-home-card-cols={renderedGridCols}
          data-home-card-gap={gridGapPx}
          data-home-card-row={rowHeightPx}
        >
          {visibleCardIds.map((cardId) => {
            const entry = allCards.get(cardId);
            if (!entry) {
              return null;
            }

            const size = cardSizes[cardId] ?? entry.size;
            const origin = placementLayouts?.[cardId];
            const resolvedGridSize = getResponsiveCardSize(size, breakpointCols);
            const snapStyle =
              origin && placementLayouts
                ? getSnapCardStyle(origin, cardSpanForSize(resolvedGridSize, renderedGridCols))
                : undefined;
            const spanClass = origin ? '' : getCardSpanClass(resolvedGridSize);

            return (
              <HomeCardSlot
                key={cardId}
                sortable={sortable && !snapPlacement}
                snapDraggable={allowSnapDrag}
                cardId={cardId}
                sectionId={sectionId}
                isPreviewHidden={activeDragCard === cardId}
                className={spanClass}
                style={snapStyle}
                optimizeOffscreenPaint={optimizeOffscreenPaint}
                content={
                  !isCustomCard(entry) ? (
                    <DashboardCardItem
                      id={cardId}
                      device={entry}
                      size={size}
                      isEditMode={isEditMode}
                      handleSizeChange={updateCardSize}
                      onRemoveFromLayout={onRemoveFromLayout}
                      allowExtraLargeSizes={showHero}
                    />
                  ) : (
                    <DashboardCardItem
                      id={cardId}
                      card={entry}
                      size={size}
                      isEditMode={isEditMode}
                      handleSizeChange={updateCardSize}
                      onUpdateCard={onUpdateCard}
                      onRemoveFromLayout={onRemoveFromLayout}
                      allowExtraLargeSizes={showHero}
                    />
                  )
                }
              />
            );
          })}
          {dropPreviewStyle ? (
            <div
              aria-hidden="true"
              data-home-snap-drop-preview="true"
              className="pointer-events-none rounded-[20px]"
              style={dropPreviewStyle}
            />
          ) : null}
          {hasInlineAddCardSlot ? (
            <button
              type="button"
              onClick={handleAddCard}
              className="flex min-h-21.75 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] border-2 border-dashed px-4 text-center"
              style={addCardSlotStyle}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Plus className="h-4 w-4 text-white/80" />
              </span>
              <span className="text-sm font-semibold text-white/90">
                {t('dashboard.addCard.title')}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}, areCardGridPropsEqual);

export function HomeContainerDropZone({
  children,
  sectionId,
  cardIds,
}: {
  children: ReactNode;
  sectionId?: string;
  cardIds: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: sectionId ? `home-container-${sectionId}` : 'home-container-flow',
    data: { type: 'container', sectionId } satisfies DropMeta,
  });

  return (
    <div
      ref={setNodeRef}
      className={isOver && cardIds.length === 0 ? 'rounded-3xl ring-1 ring-white/20' : undefined}
    >
      {children}
    </div>
  );
}

function areCardGridPropsEqual(previous: CardGridProps, next: CardGridProps) {
  return (
    previous.sectionId === next.sectionId &&
    previous.gridCols === next.gridCols &&
    previous.activeDragCard === next.activeDragCard &&
    previous.updateCardSize === next.updateCardSize &&
    previous.isEditMode === next.isEditMode &&
    previous.onUpdateCard === next.onUpdateCard &&
    previous.onRemoveFromLayout === next.onRemoveFromLayout &&
    previous.showHero === next.showHero &&
    previous.onOpenAddCardDialog === next.onOpenAddCardDialog &&
    previous.sortable === next.sortable &&
    previous.snapPlacement === next.snapPlacement &&
    previous.cardGridColumns === next.cardGridColumns &&
    previous.accentColor === next.accentColor &&
    areSnapDropPreviewsEqual(previous.snapDropPreview, next.snapDropPreview) &&
    areCardLayoutsEqual(previous.cardLayouts, next.cardLayouts) &&
    areCardIdsStable(
      previous.cardIds,
      next.cardIds,
      previous.allCards,
      next.allCards,
      previous.cardSizes,
      next.cardSizes
    )
  );
}
