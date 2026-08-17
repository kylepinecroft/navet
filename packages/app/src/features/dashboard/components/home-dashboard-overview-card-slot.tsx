import { useDraggable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { getDndTransformStyle } from '@navet/app/components/shared/dnd-transform-style';
import type { CSSProperties, ReactNode } from 'react';
import type { DragMeta, DropMeta } from '../hooks/use-home-dashboard-editor';

function SortableHomeCard({
  cardId,
  sectionId,
  isPreviewHidden,
  className,
  style,
  optimizeOffscreenPaint,
  children,
}: {
  cardId: string;
  sectionId?: string;
  isPreviewHidden: boolean;
  className: string;
  style?: CSSProperties;
  optimizeOffscreenPaint: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `home-card-${cardId}`,
    data: { source: 'home', cardId, sectionId, type: 'card' } as DragMeta & DropMeta,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={isDragging ? style : { ...style, ...getDndTransformStyle(transform, transition) }}
      className={`${className} relative h-full cursor-grab active:cursor-grabbing ${
        isPreviewHidden ? 'opacity-0' : isDragging ? 'opacity-40' : ''
      }`}
      data-card-id={cardId}
      data-card-drag-surface="true"
    >
      <div
        className={
          optimizeOffscreenPaint
            ? 'h-full min-h-40 [content-visibility:auto] [contain-intrinsic-block-size:10rem]'
            : 'h-full min-h-0'
        }
      >
        {children}
      </div>
    </div>
  );
}

function SnapDraggableHomeCard({
  cardId,
  sectionId,
  isPreviewHidden,
  className,
  style,
  optimizeOffscreenPaint,
  children,
}: {
  cardId: string;
  sectionId?: string;
  isPreviewHidden: boolean;
  className: string;
  style?: CSSProperties;
  optimizeOffscreenPaint: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `home-card-${cardId}`,
    data: { source: 'home', cardId, sectionId, type: 'card' } as DragMeta & DropMeta,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={isDragging ? style : { ...style, ...getDndTransformStyle(transform) }}
      className={`${className} relative h-full cursor-grab active:cursor-grabbing ${
        isPreviewHidden ? 'opacity-0' : isDragging ? 'opacity-40' : ''
      }`}
      data-card-id={cardId}
      data-card-drag-surface="true"
    >
      <div
        className={
          optimizeOffscreenPaint
            ? 'h-full min-h-40 [content-visibility:auto] [contain-intrinsic-block-size:10rem]'
            : 'h-full min-h-0'
        }
      >
        {children}
      </div>
    </div>
  );
}

export function HomeCardSlot({
  sortable,
  snapDraggable = false,
  cardId,
  sectionId,
  isPreviewHidden,
  className,
  style,
  content,
  optimizeOffscreenPaint = false,
}: {
  sortable: boolean;
  snapDraggable?: boolean;
  cardId: string;
  sectionId?: string;
  isPreviewHidden: boolean;
  className: string;
  style?: CSSProperties;
  content: ReactNode;
  optimizeOffscreenPaint?: boolean;
}) {
  if (snapDraggable) {
    return (
      <SnapDraggableHomeCard
        cardId={cardId}
        sectionId={sectionId}
        isPreviewHidden={isPreviewHidden}
        className={className}
        style={style}
        optimizeOffscreenPaint={optimizeOffscreenPaint}
      >
        {content}
      </SnapDraggableHomeCard>
    );
  }

  if (sortable) {
    return (
      <SortableHomeCard
        cardId={cardId}
        sectionId={sectionId}
        isPreviewHidden={isPreviewHidden}
        className={className}
        style={style}
        optimizeOffscreenPaint={optimizeOffscreenPaint}
      >
        {content}
      </SortableHomeCard>
    );
  }

  if (style || optimizeOffscreenPaint || className) {
    return (
      <div
        className={`${className} h-full ${
          optimizeOffscreenPaint
            ? 'min-h-40 [content-visibility:auto] [contain-intrinsic-block-size:10rem]'
            : 'min-h-0'
        }`}
        style={style}
      >
        {content}
      </div>
    );
  }

  return content;
}
