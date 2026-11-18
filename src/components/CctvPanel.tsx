import React from 'react';
import { Lock, Unlock, Video, Volume2, X, Zap } from 'lucide-react';
import { ActiveClassroomActor, CctvCamId } from '../types/game';

interface CctvPanelProps {
  activeCam: CctvCamId;
  cctvActors: ActiveClassroomActor[];
  audioMode: 'quiet' | 'class_normal' | 'anomaly_reveal' | 'anomaly_hunt';
  audioLabel: string;
  room101Locked: boolean;
  room102Locked: boolean;
  inCheckingRoom: boolean;
  hasTaserInHand: boolean;
  glitchPulse: boolean;
  onSelectCam: (cam: CctvCamId) => void;
  onToggleLockdown: (room: 'room101' | 'room102') => void;
  onEquipTaser: () => void;
  onClose: () => void;
}

const CAM_LABELS: Record<CctvCamId, string> = {
  cam101: 'CAM 01 · CLASSROOM 101',
  cam102: 'CAM 02 · CLASSROOM 102',
  camCorridor: 'CAM 03 · MAIN CORRIDOR',
};

export const CctvPanel: React.FC<CctvPanelProps> = ({
  activeCam,
  cctvActors,
  audioMode,
  audioLabel,
  room101Locked,
  room102Locked,
  inCheckingRoom,
  hasTaserInHand,
  glitchPulse,
  onSelectCam,
  onToggleLockdown,
  onEquipTaser,
  onClose,
}) => {
  const isAnomalousAudio = audioMode === 'anomaly_hunt';
  const currentRoomLocked =
    (activeCam === 'cam101' && room101Locked) || (activeCam === 'cam102' && room102Locked);

  const countRoomStudents = (room: 'room101' | 'room102') =>
    cctvActors.filter(
      (a) =>
        a.room === room &&
        a.role === 'student' &&
        a.state !== 'walking_to_seat' &&
        a.state !== 'fled' &&
        a.state !== 'victimized',
    ).length;
  const countRoomTeachers = (room: 'room101' | 'room102') =>
    cctvActors.filter(
      (a) =>
        a.room === room &&
        a.role === 'teacher' &&
        a.state !== 'walking_to_seat' &&
        a.state !== 'fled' &&
        a.state !== 'victimized',
    ).length;
  const walkingCount = cctvActors.filter((a) => a.state === 'walking_to_seat').length;

  const r101Students = countRoomStudents('room101');
  const r101Teachers = countRoomTeachers('room101');
  const r102Students = countRoomStudents('room102');
  const r102Teachers = countRoomTeachers('room102');

  return (
    <div className="pointer-events-none fixed inset-0 z-25 flex flex-col justify-between">
      {/* Security Monitor CRT Scanlines & Vignette over Live 3D Camera Feed */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)',
          boxShadow: 'inset 0 0 90px rgba(0, 12, 8, 0.72)',
        }}
      />

      {glitchPulse && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              'linear-gradient(to bottom, transparent 18%, rgba(210, 240, 225, 0.16) 22%, transparent 25%, transparent 64%, rgba(220, 60, 60, 0.14) 68%, transparent 72%)',
          }}
        />
      )}

      {/* Top Security Feed Header & Camera Switcher */}
      <div className="pointer-events-auto relative mx-auto mt-20 flex w-[min(92vw,780px)] flex-wrap items-center justify-between gap-2 rounded border border-emerald-900/80 bg-zinc-950/92 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono-tabular text-xs font-semibold tracking-wider text-emerald-300">
            <Video className="h-3.5 w-3.5" />
            <span>{CAM_LABELS[activeCam]}</span>
          </div>
          <span className="font-mono-tabular text-[11px] text-zinc-400">
            {activeCam === 'cam101'
              ? `${r101Students}/4 Seated${r101Teachers > 0 ? ` · ${r101Teachers} Teacher` : ''}`
              : activeCam === 'cam102'
                ? `${r102Students}/4 Seated${r102Teachers > 0 ? ` · ${r102Teachers} Teacher` : ''}`
                : walkingCount > 0
                  ? `${walkingCount} Walking to Class`
                  : 'Hallway Clear'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {(
            [
              ['cam101', `CAM 01 · Rm 101 (${r101Students + r101Teachers})`],
              ['cam102', `CAM 02 · Rm 102 (${r102Students + r102Teachers})`],
              ['camCorridor', `CAM 03 · Corridor${walkingCount > 0 ? ` (${walkingCount})` : ''}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectCam(id)}
              className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeCam === id
                  ? 'border-emerald-500 bg-emerald-950/85 text-emerald-100'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}

          <button
            type="button"
            onClick={onClose}
            aria-label="Exit CCTV Monitor"
            className="ml-1 rounded border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Center Frame Reticle & Lockdown Notice */}
      <div className="relative flex flex-1 items-center justify-center">
        {currentRoomLocked && (
          <div className="rounded border border-red-700 bg-red-950/90 px-4 py-2 font-display text-sm font-semibold tracking-wider text-red-100">
            STEEL LOCKDOWN SHUTTER SEALED
          </div>
        )}
      </div>

      {/* Bottom Live Audio Bar & Classroom Lockdown Controls */}
      <div className="pointer-events-auto relative mx-auto mb-24 flex w-[min(92vw,760px)] flex-wrap items-center justify-between gap-3 rounded border border-emerald-900/80 bg-zinc-950/92 px-4 py-2.5">
        <div
          className={`flex items-center gap-2 font-mono-tabular text-xs ${
            isAnomalousAudio ? 'font-semibold text-red-400' : 'text-emerald-200'
          }`}
        >
          <Volume2 className="h-3.5 w-3.5 shrink-0" />
          <span>{audioLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleLockdown('room101')}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              room101Locked
                ? 'border-red-600 bg-red-950 text-red-100'
                : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {room101Locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            <span>{room101Locked ? 'Unlock 101' : 'Lockdown 101'}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleLockdown('room102')}
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              room102Locked
                ? 'border-red-600 bg-red-950 text-red-100'
                : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {room102Locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            <span>{room102Locked ? 'Unlock 102' : 'Lockdown 102'}</span>
          </button>

          {inCheckingRoom && !hasTaserInHand && (
            <button
              type="button"
              onClick={() => {
                onEquipTaser();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded border border-amber-500 bg-amber-950/85 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-900 whitespace-nowrap shrink-0"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Equip Taser &amp; Respond [T]</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
