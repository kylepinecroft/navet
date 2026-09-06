import {
  type CardSize,
  getCardSpanClass,
  getResponsiveCardSize,
} from '@navet/app/components/shared/card-size-selector';
import { cn } from '@navet/app/components/ui/utils';
import { useBreakpointCols } from '@navet/app/hooks/use-breakpoint-cols';
import type { DeviceWithType } from '@navet/app/types/device.types';
import { memo, useMemo } from 'react';
import { useHomeGridRuntime } from '../hooks/use-home-grid-runtime';
import type { CustomCard } from '../stores/custom-cards-store';
import {
  areCardLayoutsEqual,
  CARD_LAYOUT_COLUMNS,
  type CardLayoutMap,
  cardSpanForSize,
  fillMissingCardLayouts,
  getSnapCardStyle,
  packCardsFromOrder,
  sortCardIdsByPlacement,
} from '../utils/card-placement';
import { DashboardCardItem } from './dashboard-card-item';
import { areCardIdsStable, isCustomCard } from './home-dashboard-overview.shared';

interface PresentationCardGridProps {
  cardIds: string[];
  gridCols?: number;
  allCards: Map<string, DeviceWithType | CustomCard>;
  cardSizes: Record<string, CardSize>;
  updateCardSize: (id: string, size: CardSize) => void;
  onUpdateCard?: (cardId: string, data: Record<string, unknown>) => void;
  showHero: boolean;
  densePerformanceMode?: boolean;
  snapPlacement?: boolean;
  cardLayouts?: CardLayoutMap;
  cardGridColumns?: number;
}

export const PresentationCardGrid = memo(function PresentationCardGrid({
  cardIds,
  gridCols,
  allCards,
  cardSizes,
  updateCardSize,
  onUpdateCard,
  showHero,
  densePerformanceMode = false,
  snapPlacement = false,
  cardLayouts,
  cardGridColumns,
}: PresentationCardGridProps) {
  const breakpointCols = useBreakpointCols();
  const isPhone = breakpointCols <= 2;
  const snapColumns = cardGridColumns ?? CARD_LAYOUT_COLUMNS;
  const snapDesktop = snapPlacement && !isPhone;
  const {
    gridPlacements,
    gridStyle,
    innerContainerStyle,
    innerRef,
    isAutoScaled,
    optimizeOffscreenPaint,
    outerContainerStyle,
    outerRef,
    renderedGridCols,
    visibleCardIds,
  } = useHomeGridRuntime({
    allCards,
    cardIds,
    cardSizes,
    densePerformanceMode,
    gridCols,
    forcedGridCols: snapDesktop ? snapColumns : undefined,
    isEditMode: false,
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

    return fillMissingCardLayouts({
      cardIds,
      assignments: Object.fromEntries(cardIds.map((cardId) => [cardId, 'section'])),
      existing: cardLayouts ?? {},
      cardSizes: resolvedSizes,
      columns: snapColumns,
      sectionIds: ['section'],
    });
  }, [
    allCards,
    breakpointCols,
    cardIds,
    cardLayouts,
    cardSizes,
    isPhone,
    renderedGridCols,
    snapColumns,
    snapPlacement,
  ]);

  return (
    <div ref={outerRef} className="relative w-full" style={outerContainerStyle}>
      <div
        ref={innerRef}
        className={`w-full${isAutoScaled ? ' absolute left-0 top-0 origin-top-left' : ''}`}
        style={innerContainerStyle}
      >
        <div
          className={`grid w-full gap-3 lg:gap-4${placementLayouts ? '' : ' grid-flow-row-dense'}`}
          style={gridStyle}
        >
          {visibleCardIds.map((cardId) => {
            const entry = allCards.get(cardId);
            if (!entry) {
              return null;
            }

            const size = cardSizes[cardId] ?? entry.size;
            const resolvedGridSize = getResponsiveCardSize(size, breakpointCols);
            const origin = placementLayouts?.[cardId];
            const snapStyle =
              origin && placementLayouts
                ? getSnapCardStyle(origin, cardSpanForSize(resolvedGridSize, renderedGridCols))
                : undefined;
            const placement = origin ? undefined : gridPlacements.get(cardId);
            const spanClass = origin
              ? 'h-full min-h-0'
              : cn(getCardSpanClass(resolvedGridSize), '[&>*]:h-full');
            const cellStyle = origin
              ? snapStyle
              : {
                  gridColumnStart: placement?.column,
                  gridRowStart: placement?.row,
                };

            return (
              <div key={cardId} className={spanClass} style={cellStyle}>
                {!isCustomCard(entry) ? (
                  <DashboardCardItem
                    id={cardId}
                    device={entry}
                    size={size}
                    isEditMode={false}
                    handleSizeChange={updateCardSize}
                    allowExtraLargeSizes={showHero}
                    densePerformanceMode={densePerformanceMode}
                    optimizeOffscreenPaint={optimizeOffscreenPaint}
                  />
                ) : (
                  <DashboardCardItem
                    id={cardId}
                    card={entry}
                    size={size}
                    isEditMode={false}
                    handleSizeChange={updateCardSize}
                    onUpdateCard={onUpdateCard}
                    allowExtraLargeSizes={showHero}
                    densePerformanceMode={densePerformanceMode}
                    optimizeOffscreenPaint={optimizeOffscreenPaint}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}, arePresentationCardGridPropsEqual);

function arePresentationCardGridPropsEqual(
  previous: PresentationCardGridProps,
  next: PresentationCardGridProps
) {
  return (
    previous.gridCols === next.gridCols &&
    previous.updateCardSize === next.updateCardSize &&
    previous.onUpdateCard === next.onUpdateCard &&
    previous.showHero === next.showHero &&
    previous.densePerformanceMode === next.densePerformanceMode &&
    previous.snapPlacement === next.snapPlacement &&
    previous.cardGridColumns === next.cardGridColumns &&
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
