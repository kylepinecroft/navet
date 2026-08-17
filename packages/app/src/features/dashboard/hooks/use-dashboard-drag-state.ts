import {
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { CardSize } from '@navet/app/components/shared/card-size-selector';
import type { DeviceWithType } from '@navet/app/types/device.types';
import { useMemo, useRef, useState } from 'react';
import type { CustomCard } from '../stores/custom-cards-store';
import {
  areSnapDropPreviewsEqual,
  cardSpanForSize,
  clampCardOrigin,
  cssPointToCell,
  type SnapDropPreview,
} from '../utils/card-placement';
import type { DragMeta, DropMeta } from './use-home-dashboard-editor';

const INTERACTIVE_NO_DRAG_SELECTOR = [
  'button',
  'input',
  'textarea',
  'select',
  'a',
  '[role="slider"]',
  '[role="switch"]',
  '[data-card-interactive]',
  '[data-dashboard-edit-action]',
].join(', ');

const CARD_NO_DRAG_SELECTOR = '[data-card-nodrag="true"]';
const CARD_DRAG_SURFACE_SELECTOR = '[data-card-drag-surface="true"]';

export function canStartDashboardDrag(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest('[data-dashboard-drag-handle="true"]')) {
    return true;
  }

  if (target.closest(INTERACTIVE_NO_DRAG_SELECTOR)) {
    return false;
  }

  const noDragSurface = target.closest(CARD_NO_DRAG_SELECTOR);
  if (noDragSurface && !noDragSurface.closest(CARD_DRAG_SURFACE_SELECTOR)) {
    return false;
  }

  return true;
}

class DashboardMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: MouseEvent }) => {
        return nativeEvent.button === 0 && canStartDashboardDrag(nativeEvent.target);
      },
    },
  ];
}

class DashboardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent }: { nativeEvent: TouchEvent }) => {
        return canStartDashboardDrag(nativeEvent.target);
      },
    },
  ];
}

function resolveDropMeta(
  rawMeta: DropMeta | undefined,
  rawId: string | number | undefined
): DropMeta | undefined {
  if (rawMeta) {
    return rawMeta;
  }

  if (typeof rawId !== 'string') {
    return undefined;
  }

  if (rawId.startsWith('home-card-')) {
    return { type: 'card', cardId: rawId.slice('home-card-'.length) };
  }

  if (rawId.startsWith('home-column-drop-')) {
    return { type: 'column-target', sectionId: rawId.slice('home-column-drop-'.length) };
  }

  if (rawId.startsWith('home-column-drag-')) {
    return { type: 'column-target', sectionId: rawId.slice('home-column-drag-'.length) };
  }

  if (rawId.startsWith('home-section-target-')) {
    return { type: 'section-target', sectionId: rawId.slice('home-section-target-'.length) };
  }

  if (rawId.startsWith('home-section-insert-')) {
    return { type: 'section-insert', sectionId: rawId.slice('home-section-insert-'.length) };
  }

  if (rawId === 'home-container-flow') {
    return { type: 'container' };
  }

  if (rawId.startsWith('home-container-')) {
    return { type: 'container', sectionId: rawId.slice('home-container-'.length) };
  }

  return undefined;
}

function resolveSnapPlacement(
  event: DragEndEvent | DragMoveEvent,
  sectionId: string | undefined
): { origin: { x: number; y: number }; columns: number } | undefined {
  if (!sectionId) {
    return undefined;
  }

  const grid = document.querySelector(`[data-home-card-grid="${sectionId}"]`);
  if (!(grid instanceof HTMLElement)) {
    return undefined;
  }

  const translated = event.active.rect.current.translated ?? event.active.rect.current.initial;
  if (!translated) {
    return undefined;
  }

  const visualRect = grid.getBoundingClientRect();
  const scale = grid.offsetWidth === 0 ? 1 : visualRect.width / grid.offsetWidth;
  const columns = Number(grid.dataset.homeCardCols);
  const gapPx = Number(grid.dataset.homeCardGap);
  const rowHeightPx = Number(grid.dataset.homeCardRow);
  if (!Number.isFinite(columns) || columns <= 0) {
    return undefined;
  }

  return {
    origin: cssPointToCell(
      (translated.left - visualRect.left) / scale,
      (translated.top - visualRect.top) / scale,
      grid.offsetWidth,
      columns,
      Number.isFinite(gapPx) ? gapPx : 0,
      Number.isFinite(rowHeightPx) ? rowHeightPx : 0
    ),
    columns,
  };
}

interface UseDashboardDragStateParams {
  allCards: Map<string, DeviceWithType | CustomCard>;
  cardSizes: Record<string, CardSize>;
  moveHomeCard: (
    activeId: string,
    overId: string | null,
    sectionId?: string,
    origin?: { x: number; y: number }
  ) => void;
  moveHomeSection: (sourceId: string, targetId: string) => void;
  moveHomeColumn: (sourceId: string, targetId: string) => void;
  sectionToColumnId: Record<string, string>;
}

export function useDashboardDragState({
  allCards,
  cardSizes,
  moveHomeCard,
  moveHomeSection,
  moveHomeColumn,
  sectionToColumnId,
}: UseDashboardDragStateParams) {
  const [activeDragCard, setActiveDragCard] = useState<string | null>(null);
  const [activeDragSection, setActiveDragSection] = useState<string | null>(null);
  const [activeDragColumn, setActiveDragColumn] = useState<string | null>(null);
  const [activeSectionDropTarget, setActiveSectionDropTarget] = useState<string | null>(null);
  const [activeColumnDropTarget, setActiveColumnDropTarget] = useState<string | null>(null);
  const [snapDropPreview, setSnapDropPreview] = useState<SnapDropPreview | null>(null);
  const lastResolvedOverRef = useRef<DropMeta | null>(null);

  const clearDragIndicators = () => {
    setActiveDragCard(null);
    setActiveDragSection(null);
    setActiveDragColumn(null);
    setActiveSectionDropTarget(null);
    setActiveColumnDropTarget(null);
    setSnapDropPreview(null);
    lastResolvedOverRef.current = null;
  };

  const updateSnapDropPreview = (next: SnapDropPreview | null) => {
    setSnapDropPreview((previous) => (areSnapDropPreviewsEqual(previous, next) ? previous : next));
  };

  const sensors = useSensors(
    useSensor(DashboardMouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(DashboardTouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeDragSize = useMemo<CardSize | null>(() => {
    if (!activeDragCard) return null;
    const entry = allCards.get(activeDragCard);
    const resolvedSize = cardSizes[activeDragCard];
    if (resolvedSize) return resolvedSize;
    if (entry && 'size' in entry) return entry.size as CardSize;
    return 'small';
  }, [activeDragCard, allCards, cardSizes]);

  const handleDragOver = (event: DragOverEvent) => {
    const activeMeta = event.active.data.current as DragMeta | undefined;
    const overMeta = resolveDropMeta(
      event.over?.data.current as DropMeta | undefined,
      event.over?.id
    );

    if (!activeMeta) {
      return;
    }

    if (!overMeta) {
      if (activeMeta.source === 'column') {
        setActiveColumnDropTarget(null);
      }

      if (activeMeta.source === 'section') {
        setActiveSectionDropTarget(null);
      }
      return;
    }

    if (activeMeta.source === 'column') {
      const targetColumnId = overMeta.sectionId
        ? (sectionToColumnId[overMeta.sectionId] ?? overMeta.sectionId)
        : null;

      if (targetColumnId && targetColumnId !== activeMeta.sectionId) {
        lastResolvedOverRef.current = { type: 'column-target', sectionId: targetColumnId };
        setActiveColumnDropTarget(targetColumnId);
      } else {
        setActiveColumnDropTarget(null);
      }
      return;
    }

    if (activeMeta.source === 'section') {
      const targetSectionId = overMeta.sectionId ?? null;

      if (targetSectionId && targetSectionId !== activeMeta.sectionId) {
        lastResolvedOverRef.current = { type: 'section-target', sectionId: targetSectionId };
        setActiveSectionDropTarget(targetSectionId);
      } else {
        setActiveSectionDropTarget(null);
      }
      return;
    }

    if (
      overMeta.type === 'card' &&
      activeMeta.source === 'home' &&
      overMeta.cardId === activeMeta.cardId
    ) {
      return;
    }

    lastResolvedOverRef.current = overMeta;
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const activeMeta = event.active.data.current as DragMeta | undefined;
    if (activeMeta?.source !== 'home') {
      updateSnapDropPreview(null);
      return;
    }

    const overMeta = resolveDropMeta(
      event.over?.data.current as DropMeta | undefined,
      event.over?.id
    );
    const targetSectionId = overMeta?.sectionId ?? activeMeta.sectionId;
    const placement = resolveSnapPlacement(event, targetSectionId);
    if (!placement || !targetSectionId) {
      updateSnapDropPreview(null);
      return;
    }

    const entry = allCards.get(activeMeta.cardId);
    const size = cardSizes[activeMeta.cardId] ?? (entry && 'size' in entry ? entry.size : 'small');
    const clamped = clampCardOrigin(
      placement.origin,
      cardSpanForSize(size, placement.columns),
      placement.columns
    );

    updateSnapDropPreview({
      sectionId: targetSectionId,
      x: clamped.x,
      y: clamped.y,
    });
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    clearDragIndicators();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeMeta = event.active.data.current as DragMeta | undefined;
    const overMeta =
      resolveDropMeta(event.over?.data.current as DropMeta | undefined, event.over?.id) ??
      lastResolvedOverRef.current;

    clearDragIndicators();

    if (!activeMeta || !overMeta) return;

    if (activeMeta.source === 'column') {
      const targetColumnId = overMeta.sectionId
        ? (sectionToColumnId[overMeta.sectionId] ?? overMeta.sectionId)
        : null;

      if (!targetColumnId || activeMeta.sectionId === targetColumnId) {
        return;
      }

      moveHomeColumn(activeMeta.sectionId, targetColumnId);
      return;
    }

    if (activeMeta.source === 'section') {
      const targetSectionId = overMeta.sectionId ?? null;

      if (!targetSectionId || activeMeta.sectionId === targetSectionId) {
        return;
      }

      moveHomeSection(activeMeta.sectionId, targetSectionId);
      return;
    }

    const targetSectionId = overMeta.sectionId ?? activeMeta.sectionId;
    const overCardId = overMeta.type === 'card' ? overMeta.cardId : null;
    const origin = resolveSnapPlacement(event, targetSectionId)?.origin;

    if (activeMeta.cardId === overCardId && !origin) {
      return;
    }

    moveHomeCard(activeMeta.cardId, overCardId, targetSectionId, origin);
  };

  return {
    activeDragCard,
    setActiveDragCard,
    activeDragSection,
    setActiveDragSection,
    activeDragColumn,
    setActiveDragColumn,
    activeSectionDropTarget,
    activeColumnDropTarget,
    snapDropPreview,
    activeDragSize,
    sensors,
    handleDragOver,
    handleDragMove,
    handleDragCancel,
    handleDragEnd,
  };
}
