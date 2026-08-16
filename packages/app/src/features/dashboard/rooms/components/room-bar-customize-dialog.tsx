import { Button, Input } from '@navet/app/components/primitives';
import { InteractivePill } from '@navet/app/components/primitives/interactive-pill';
import { getThemeSurfaceTokens } from '@navet/app/components/shared/theme/theme-surface-tokens';
import { ALL_ROOMS_ID } from '@navet/app/constants/rooms';
import { useRoomWorkspaceStore } from '@navet/app/features/dashboard/rooms/room-workspace-store';
import {
  getRoomWorkspaceRoomsInDisplayOrderV2,
  type RoomWorkspaceDiscoveredRoom,
  type RoomWorkspaceRoomV2,
  renameRoomWorkspaceRoomV2,
  resetRoomWorkspaceRoomNameV2,
  setRoomWorkspaceVisibilityV2,
} from '@navet/app/features/dashboard/rooms/room-workspace-v2';
import { useI18n, useIntegrationStore, useTheme } from '@navet/app/hooks';
import { integrationSelectors } from '@navet/app/stores/selectors';
import { useEffect, useMemo, useState } from 'react';
import { RoomOperationDialogFrame } from './room-operation-dialog-frame';

interface RoomBarCustomizeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function getProviderRoomName(
  room: RoomWorkspaceRoomV2,
  roomsByCanonicalId: Record<string, { name: string }>
): string | undefined {
  for (const sourceRef of room.sourceRefs) {
    const providerName = roomsByCanonicalId[sourceRef.canonicalId]?.name?.trim();
    if (providerName) {
      return providerName;
    }
  }
  return undefined;
}

function RoomBarCustomizeRow({
  room,
  providerName,
}: {
  room: RoomWorkspaceRoomV2;
  providerName?: string;
}) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const surface = getThemeSurfaceTokens(theme);
  const replaceWorkspace = useRoomWorkspaceStore((state) => state.replaceWorkspace);
  const [draftName, setDraftName] = useState(room.displayName);
  const visible = room.metadata.visibility !== 'hidden';
  const canResetName = Boolean(providerName) && room.metadata.nameMode === 'custom';

  useEffect(() => {
    setDraftName(room.displayName);
  }, [room.displayName]);

  const commitName = () => {
    const nextName = draftName.trim();
    if (!nextName) {
      setDraftName(room.displayName);
      return;
    }
    if (nextName === room.displayName) {
      return;
    }
    const currentWorkspace = useRoomWorkspaceStore.getState().workspace;
    if (!currentWorkspace) {
      return;
    }
    replaceWorkspace(renameRoomWorkspaceRoomV2(currentWorkspace, room.id, nextName));
  };

  const setVisibility = (nextVisible: boolean) => {
    if (visible === nextVisible) {
      return;
    }
    const currentWorkspace = useRoomWorkspaceStore.getState().workspace;
    if (!currentWorkspace) {
      return;
    }
    replaceWorkspace(
      setRoomWorkspaceVisibilityV2(currentWorkspace, room.id, nextVisible ? 'visible' : 'hidden')
    );
  };

  const resetName = () => {
    if (!providerName) {
      return;
    }
    const currentWorkspace = useRoomWorkspaceStore.getState().workspace;
    if (!currentWorkspace) {
      return;
    }
    replaceWorkspace(resetRoomWorkspaceRoomNameV2(currentWorkspace, room.id, providerName));
  };

  return (
    <li className="flex flex-col gap-2">
      <Input
        value={draftName}
        onChange={(event) => setDraftName(event.currentTarget.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        aria-label={t('dashboard.roomNav.customizeRooms.nameLabel')}
        size="small"
      />
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2">
        {canResetName ? (
          <button
            type="button"
            className={`text-sm underline-offset-2 hover:underline ${surface.textSecondary}`}
            onClick={resetName}
          >
            {t('entityNameEditor.useOriginalName')}
          </button>
        ) : (
          <span />
        )}
        <fieldset className="w-fit shrink-0">
          <legend className="sr-only">
            {visible
              ? t('dashboard.roomNav.customizeRooms.hide', { room: room.displayName })
              : t('dashboard.roomNav.customizeRooms.show', { room: room.displayName })}
          </legend>
          <div className="flex flex-wrap gap-2">
            {[
              { value: true, label: t('dashboard.roomNav.customizeRooms.visible') },
              { value: false, label: t('dashboard.roomNav.customizeRooms.hidden') },
            ].map((option) => {
              const isActive = visible === option.value;
              return (
                <InteractivePill
                  key={option.label}
                  active={isActive}
                  size="small"
                  onClick={() => setVisibility(option.value)}
                  aria-pressed={isActive}
                >
                  {option.label}
                </InteractivePill>
              );
            })}
          </div>
        </fieldset>
      </div>
    </li>
  );
}

export function RoomBarCustomizeDialog({ isOpen, onOpenChange }: RoomBarCustomizeDialogProps) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const surface = getThemeSurfaceTokens(theme);
  const workspace = useRoomWorkspaceStore((state) => state.workspace);
  const initializeWorkspace = useRoomWorkspaceStore((state) => state.initialize);
  const roomsByCanonicalId = useIntegrationStore(integrationSelectors.normalizedRoomsByCanonicalId);
  const discoveredRooms = useMemo(
    (): RoomWorkspaceDiscoveredRoom[] =>
      Object.values(roomsByCanonicalId)
        .map((room) => ({
          displayName: room.name,
          sourceRef: {
            providerId: room.providerId,
            canonicalId: room.canonicalId,
            sourceType: 'provider_managed' as const,
          },
        }))
        .sort((left, right) =>
          left.sourceRef.canonicalId.localeCompare(right.sourceRef.canonicalId)
        ),
    [roomsByCanonicalId]
  );

  useEffect(() => {
    if (!isOpen || workspace || discoveredRooms.length === 0) {
      return;
    }
    initializeWorkspace(discoveredRooms, { legacyAllName: ALL_ROOMS_ID });
  }, [discoveredRooms, initializeWorkspace, isOpen, workspace]);

  const rooms = workspace ? getRoomWorkspaceRoomsInDisplayOrderV2(workspace) : [];

  return (
    <RoomOperationDialogFrame
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('dashboard.roomNav.customizeRooms.title')}
      description={t('dashboard.roomNav.customizeRooms.description')}
      maxWidth="md"
      onSubmit={() => onOpenChange(false)}
      footer={
        <Button type="submit" className="min-h-11">
          {t('common.done')}
        </Button>
      }
    >
      {rooms.length === 0 ? (
        <p className={`text-sm leading-relaxed ${surface.textSecondary}`}>
          {t('dashboard.roomNav.customizeRooms.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {rooms.map((room) => (
            <RoomBarCustomizeRow
              key={room.id}
              room={room}
              providerName={getProviderRoomName(room, roomsByCanonicalId)}
            />
          ))}
        </ul>
      )}
    </RoomOperationDialogFrame>
  );
}
