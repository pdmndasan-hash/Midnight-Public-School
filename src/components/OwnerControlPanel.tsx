import React, { useEffect, useMemo, useState } from 'react';
import {
  Crown,
  EyeOff,
  FastForward,
  Film,
  Heart,
  Home,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { TELEPORT_LOCATIONS } from '../game/ownerAndPowers';
import {
  BodyguardStance,
  CharacterTransformTarget,
  HudSnapshot,
  NpcBehaviorOverride,
  TeleportDestinationId,
} from '../types/game';

interface OwnerControlPanelProps {
  hud: HudSnapshot;
  onClose: () => void;
  onToggleImmortal: (active: boolean) => void;
  onToggleInfiniteRevives: () => void;
  onRestoreHealth: () => void;
  onRestoreSanity: () => void;
  onToggleInvisibility: () => void;
  onToggleFreecam: () => void;
  onToggleNpcsPaused: () => void;
  onCompleteObjective: () => void;
  onRestartShift: () => void;
  onReturnToMenu: () => void;
  onResetOwnerTemp: () => void;
  onSetPossessConfig: (range: number, duration: number) => void;
  onPossessNpc: (id: string) => void;
  onReleasePossession: () => void;
  onCyclePossessed: (dir: 1 | -1) => void;
  onTeleportNpc: (id: string, zone: 'checking' | 'corridor' | 'room101' | 'room102') => void;
  onToggleNpcFreeze: (id: string) => void;
  onSetNpcBehavior: (id: string, behavior: NpcBehaviorOverride) => void;
  onSetNpcSpeed: (id: string, mult: number) => void;
  onTransformNpc: (id: string, target: CharacterTransformTarget) => void;
  onTransformPlayer: (target: CharacterTransformTarget) => void;
  onSpawnNpc: (role: 'student' | 'teacher' | 'guard' | 'anomaly') => void;
  onDespawnNpc: (id: string) => void;
  onSetPlayerSpeed: (mult: number) => void;
  onSummonBodyguards: (count: number) => void;
  onSetBodyguardStance: (stance: BodyguardStance) => void;
  onRecallBodyguards: () => void;
  onDismissBodyguards: () => void;
  onUnstuckBodyguards: () => void;
  onTeleportTo: (dest: TeleportDestinationId) => void;
  onStartShift6: () => void;
  onTriggerAnomalyMode: () => void;
  onTriggerWhoThem: () => void;
  onTriggerShift6Ending: () => void;
}

type OwnerTab = 'player' | 'npcs' | 'transform' | 'speed' | 'bodyguards' | 'teleport' | 'modes';

const SPEED_PRESETS = [
  { label: 'Slow', value: 0.55 },
  { label: 'Normal', value: 1.0 },
  { label: 'Fast', value: 1.65 },
  { label: 'Super Fast', value: 2.6 },
];

export const OwnerControlPanel: React.FC<OwnerControlPanelProps> = ({
  hud,
  onClose,
  onToggleImmortal,
  onToggleInfiniteRevives,
  onRestoreHealth,
  onRestoreSanity,
  onToggleInvisibility,
  onToggleFreecam,
  onToggleNpcsPaused,
  onCompleteObjective,
  onRestartShift,
  onReturnToMenu,
  onResetOwnerTemp,
  onSetPossessConfig,
  onPossessNpc,
  onReleasePossession,
  onCyclePossessed,
  onTeleportNpc,
  onToggleNpcFreeze,
  onSetNpcBehavior,
  onSetNpcSpeed,
  onTransformNpc,
  onTransformPlayer,
  onSpawnNpc,
  onDespawnNpc,
  onSetPlayerSpeed,
  onSummonBodyguards,
  onSetBodyguardStance,
  onRecallBodyguards,
  onDismissBodyguards,
  onUnstuckBodyguards,
  onTeleportTo,
  onStartShift6,
  onTriggerAnomalyMode,
  onTriggerWhoThem,
  onTriggerShift6Ending,
}) => {
  const [tab, setTab] = useState<OwnerTab>('player');
  const [npcSearch, setNpcSearch] = useState('');
  const [selectedNpcId, setSelectedNpcId] = useState<string>('');
  const [bodyguardCount, setBodyguardCount] = useState<number>(Math.max(2, hud.ownerBodyguardCount || 2));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filteredNpcs = useMemo(() => {
    const q = npcSearch.trim().toLowerCase();
    if (!q) return hud.ownerNpcs;
    return hud.ownerNpcs.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.roleLabel.toLowerCase().includes(q) ||
        n.zone.toLowerCase().includes(q),
    );
  }, [hud.ownerNpcs, npcSearch]);

  const selectedNpc =
    hud.ownerNpcs.find((n) => n.id === selectedNpcId) ?? filteredNpcs[0] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ultimate Owner Control Panel"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-2 sm:p-5 backdrop-blur-[2px]"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-amber-500/75 bg-zinc-950 shadow-[0_0_58px_rgba(217,119,6,0.3)]">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/65 bg-black px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-amber-500/70 bg-amber-950/70 text-amber-300">
              <Crown className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-wider text-amber-300 sm:text-2xl">
                OWNER MODE CONTROL PANEL
              </h2>
              <p className="font-mono-tabular text-[11px] text-zinc-400">
                OWNER2026 · PHASE: {hud.phase.toUpperCase()} · SAVED SHIFT PROGRESS PROTECTED
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Owner Control Panel"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded border border-red-800/80 bg-red-950/60 px-3.5 py-2 text-xs font-semibold text-red-100 transition-colors hover:bg-red-900/80"
          >
            <X className="h-4 w-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Live Status Strip */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-black/75 px-4 py-2 font-mono-tabular text-[11px] sm:px-6">
          <span
            className={`rounded border px-2 py-0.5 font-semibold ${
              hud.immortalActive
                ? 'border-cyan-500/70 bg-cyan-950/70 text-cyan-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            IMMORTAL: {hud.immortalActive ? 'ON' : 'OFF'}
          </span>
          <span
            className={`rounded border px-2 py-0.5 font-semibold ${
              hud.ownerInfiniteRevives
                ? 'border-emerald-500/70 bg-emerald-950/70 text-emerald-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            INFINITE REVIVES: {hud.ownerInfiniteRevives ? 'ACTIVE' : 'OFF'}
          </span>
          <span
            className={`rounded border px-2 py-0.5 font-semibold ${
              hud.ownerInvisible
                ? 'border-amber-500/70 bg-amber-950/70 text-amber-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            INVISIBILITY: {hud.ownerInvisible ? 'ON' : 'OFF'}
          </span>
          <span
            className={`rounded border px-2 py-0.5 font-semibold ${
              hud.ownerFreecam
                ? 'border-purple-500/70 bg-purple-950/70 text-purple-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            FREECAM: {hud.ownerFreecam ? 'ON' : 'OFF'}
          </span>
          <span
            className={`rounded border px-2 py-0.5 font-semibold ${
              hud.ownerNpcsPaused
                ? 'border-red-500/70 bg-red-950/70 text-red-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500'
            }`}
          >
            NPCS: {hud.ownerNpcsPaused ? 'PAUSED' : 'ACTIVE'}
          </span>
          <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-amber-200">
            SPEED: {hud.ownerPlayerSpeed.toFixed(2)}x
          </span>
          <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-300">
            BODYGUARDS: {hud.ownerBodyguardCount}
          </span>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-4 py-2.5 sm:px-6">
          {[
            { id: 'player', label: '7A Player' },
            { id: 'npcs', label: `7B Control NPC (${hud.ownerNpcs.length})` },
            { id: 'transform', label: '7C Transform' },
            { id: 'speed', label: '7D Speed' },
            { id: 'bodyguards', label: '7E Bodyguards' },
            { id: 'teleport', label: '7F Teleport' },
            { id: 'modes', label: '7G-7I Shift 6 & Endings' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as OwnerTab)}
              className={`min-h-[38px] rounded border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors whitespace-nowrap shrink-0 ${
                tab === item.id
                  ? 'border-amber-500 bg-amber-950/75 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'player' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  type="button"
                  onClick={() => onToggleImmortal(!hud.immortalActive)}
                  className={`flex min-h-[48px] items-center justify-between rounded border px-4 py-2.5 text-left text-xs font-semibold transition-colors ${
                    hud.immortalActive
                      ? 'border-cyan-500 bg-cyan-950/75 text-cyan-100'
                      : 'border-zinc-800 bg-black text-zinc-200 hover:border-cyan-800'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Shield className="h-4 w-4 text-cyan-300" />
                    <span>Immortality (Player Only)</span>
                  </span>
                  <span className="font-mono-tabular">{hud.immortalActive ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleInfiniteRevives}
                  className={`flex min-h-[48px] items-center justify-between rounded border px-4 py-2.5 text-left text-xs font-semibold transition-colors ${
                    hud.ownerInfiniteRevives
                      ? 'border-emerald-500 bg-emerald-950/75 text-emerald-100'
                      : 'border-zinc-800 bg-black text-zinc-200 hover:border-emerald-800'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    <span>Infinite Revives (7H)</span>
                  </span>
                  <span className="font-mono-tabular">{hud.ownerInfiniteRevives ? 'ACTIVE' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={onRestoreHealth}
                  className="flex min-h-[48px] items-center gap-2 rounded border border-red-800/80 bg-red-950/50 px-4 py-2.5 text-xs font-semibold text-red-100 transition-colors hover:bg-red-900/70"
                >
                  <Heart className="h-4 w-4 text-red-400" />
                  <span>Restore Health, Stamina &amp; Strikes</span>
                </button>

                <button
                  type="button"
                  onClick={onRestoreSanity}
                  className="flex min-h-[48px] items-center gap-2 rounded border border-sky-800/80 bg-sky-950/45 px-4 py-2.5 text-xs font-semibold text-sky-100 transition-colors hover:bg-sky-900/60"
                >
                  <Sparkles className="h-4 w-4 text-sky-300" />
                  <span>Restore Sanity (100%)</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleInvisibility}
                  className={`flex min-h-[48px] items-center justify-between rounded border px-4 py-2.5 text-xs font-semibold transition-colors ${
                    hud.ownerInvisible
                      ? 'border-amber-500 bg-amber-950/75 text-amber-100'
                      : 'border-zinc-800 bg-black text-zinc-200 hover:border-amber-800'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <EyeOff className="h-4 w-4 text-amber-300" />
                    <span>Invisibility Mode</span>
                  </span>
                  <span className="font-mono-tabular">{hud.ownerInvisible ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleFreecam}
                  className={`flex min-h-[48px] items-center justify-between rounded border px-4 py-2.5 text-xs font-semibold transition-colors ${
                    hud.ownerFreecam
                      ? 'border-purple-500 bg-purple-950/75 text-purple-100'
                      : 'border-zinc-800 bg-black text-zinc-200 hover:border-purple-800'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Video className="h-4 w-4 text-purple-300" />
                    <span>Free-Camera Fly Mode</span>
                  </span>
                  <span className="font-mono-tabular">{hud.ownerFreecam ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleNpcsPaused}
                  className={`flex min-h-[48px] items-center justify-between rounded border px-4 py-2.5 text-xs font-semibold transition-colors ${
                    hud.ownerNpcsPaused
                      ? 'border-red-500 bg-red-950/75 text-red-100'
                      : 'border-zinc-800 bg-black text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {hud.ownerNpcsPaused ? (
                      <Play className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Pause className="h-4 w-4 text-red-300" />
                    )}
                    <span>{hud.ownerNpcsPaused ? 'Resume All NPCs' : 'Pause All NPCs'}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onCompleteObjective}
                  className="flex min-h-[48px] items-center gap-2 rounded border border-emerald-700/80 bg-emerald-950/55 px-4 py-2.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-900/70"
                >
                  <FastForward className="h-4 w-4 text-emerald-300" />
                  <span>Instantly Complete Current Objective</span>
                </button>

                <button
                  type="button"
                  onClick={onRestartShift}
                  className="flex min-h-[48px] items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
                >
                  <RotateCcw className="h-4 w-4 text-amber-300" />
                  <span>Restart Current Shift</span>
                </button>

                <button
                  type="button"
                  onClick={onReturnToMenu}
                  className="flex min-h-[48px] items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
                >
                  <Home className="h-4 w-4" />
                  <span>Return to Main Menu</span>
                </button>

                <button
                  type="button"
                  onClick={onResetOwnerTemp}
                  className="flex min-h-[48px] items-center gap-2 rounded border border-amber-700/75 bg-amber-950/45 px-4 py-2.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-900/65 sm:col-span-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset Temporary Owner Overrides (Preserves Campaign Save)</span>
                </button>
              </div>

              {/* Mind Control Configurable Range & Duration */}
              <div className="rounded border border-zinc-800 bg-black/80 p-4">
                <div className="font-mono-tabular text-xs font-semibold tracking-wider text-purple-300">
                  MIND CONTROL CONFIGURATION (PUPPET777)
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs text-zinc-300">
                    <div className="flex justify-between font-mono-tabular">
                      <span>Possession Range</span>
                      <span className="text-purple-300">{hud.possessRange}m</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={25}
                      step={1}
                      value={hud.possessRange}
                      onChange={(e) => onSetPossessConfig(Number(e.target.value), hud.possessDurationConfig)}
                      className="mt-2 w-full accent-purple-500"
                    />
                  </label>
                  <label className="block text-xs text-zinc-300">
                    <div className="flex justify-between font-mono-tabular">
                      <span>Possession Duration</span>
                      <span className="text-purple-300">{hud.possessDurationConfig}s</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={90}
                      step={2}
                      value={hud.possessDurationConfig}
                      onChange={(e) => onSetPossessConfig(hud.possessRange, Number(e.target.value))}
                      className="mt-2 w-full accent-purple-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === 'npcs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={npcSearch}
                    onChange={(e) => setNpcSearch(e.target.value)}
                    placeholder="Search students, teachers, guard, anomalies, zones..."
                    className="w-full rounded border border-zinc-800 bg-black py-2.5 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['student', 'teacher', 'guard', 'anomaly'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => onSpawnNpc(role)}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded border border-amber-700/70 bg-amber-950/50 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/70"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>+ {role}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Searchable NPC list */}
                <div className="max-h-80 space-y-1.5 overflow-y-auto rounded border border-zinc-800 bg-black/80 p-2.5">
                  {filteredNpcs.length === 0 ? (
                    <p className="p-4 text-center text-xs text-zinc-500">
                      No active NPCs in this scene. Start a Shift or Anomaly Mode (or spawn above).
                    </p>
                  ) : (
                    filteredNpcs.map((npc) => (
                      <button
                        key={npc.id}
                        type="button"
                        onClick={() => setSelectedNpcId(npc.id)}
                        className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs transition-colors ${
                          selectedNpc?.id === npc.id
                            ? 'border-amber-500 bg-amber-950/55 text-amber-100'
                            : 'border-zinc-800/90 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{npc.name}</div>
                          <div className="font-mono-tabular text-[10px] text-zinc-400">
                            {npc.roleLabel} · {npc.zone}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 font-mono-tabular text-[10px]">
                          {npc.frozen && (
                            <span className="rounded bg-sky-950 px-1.5 py-0.5 text-sky-300">FROZEN</span>
                          )}
                          {npc.possessed && (
                            <span className="rounded bg-purple-950 px-1.5 py-0.5 text-purple-300">POSSESSED</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Selected NPC Controls */}
                <div className="rounded border border-zinc-800 bg-black/80 p-4">
                  {selectedNpc ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-2.5">
                        <div>
                          <div className="text-sm font-bold text-amber-300">{selectedNpc.name}</div>
                          <div className="font-mono-tabular text-[11px] text-zinc-400">
                            {selectedNpc.roleLabel} · {selectedNpc.zone} · Behavior: {selectedNpc.behavior.toUpperCase()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDespawnNpc(selectedNpc.id)}
                          className="rounded border border-red-800 bg-red-950/70 px-2.5 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900"
                        >
                          Despawn
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {hud.possessedNpc?.id === selectedNpc.id ? (
                          <button
                            type="button"
                            onClick={onReleasePossession}
                            className="min-h-[38px] rounded border border-purple-500 bg-purple-900/75 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Release Control
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onPossessNpc(selectedNpc.id)}
                            className="min-h-[38px] rounded border border-purple-600 bg-purple-950/75 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-900/80"
                          >
                            Possess &amp; Control
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onCyclePossessed(-1)}
                          className="min-h-[38px] rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          Prev NPC
                        </button>
                        <button
                          type="button"
                          onClick={() => onCyclePossessed(1)}
                          className="min-h-[38px] rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          Next NPC
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleNpcFreeze(selectedNpc.id)}
                          className={`min-h-[38px] rounded border px-3 py-1.5 text-xs font-semibold ${
                            selectedNpc.frozen
                              ? 'border-sky-500 bg-sky-950 text-sky-200'
                              : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                          }`}
                        >
                          {selectedNpc.frozen ? 'Unfreeze NPC' : 'Freeze NPC'}
                        </button>
                      </div>

                      <div>
                        <div className="mb-1.5 font-mono-tabular text-[10px] tracking-wider text-zinc-400">
                          AI BEHAVIOR OVERRIDE
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              { id: 'follow', label: 'Follow Player' },
                              { id: 'patrol', label: 'Patrol' },
                              { id: 'flee', label: 'Flee' },
                              { id: 'stand', label: 'Stand Still' },
                              { id: 'default', label: 'Restore Original AI' },
                            ] as const
                          ).map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => onSetNpcBehavior(selectedNpc.id, b.id)}
                              className={`rounded border px-2.5 py-1.5 text-[11px] font-medium ${
                                selectedNpc.behavior === b.id
                                  ? 'border-amber-500 bg-amber-950 text-amber-200'
                                  : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 font-mono-tabular text-[10px] tracking-wider text-zinc-400">
                          TELEPORT NPC TO VALID LOCATION
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              { id: 'checking', label: 'Checkpoint' },
                              { id: 'corridor', label: 'Corridor' },
                              { id: 'room101', label: 'Room 101' },
                              { id: 'room102', label: 'Room 102' },
                            ] as const
                          ).map((z) => (
                            <button
                              key={z.id}
                              type="button"
                              onClick={() => onTeleportNpc(selectedNpc.id, z.id)}
                              className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:border-amber-600"
                            >
                              {z.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Select an NPC from the list to manage them.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'transform' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded border border-zinc-800 bg-black/85 p-4">
                <h3 className="font-display text-lg font-bold tracking-wider text-amber-300">
                  TRANSFORM PLAYER CHARACTER
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Current Form: <span className="font-semibold text-zinc-100">{hud.ownerPlayerForm.toUpperCase()}</span>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'student', label: 'Normal Student' },
                      { id: 'teacher', label: 'Teacher' },
                      { id: 'guard', label: 'Security Guard' },
                      { id: 'anomaly', label: 'Anomaly' },
                      { id: 'original', label: 'Restore Original Character' },
                    ] as const
                  ).map((form) => (
                    <button
                      key={form.id}
                      type="button"
                      onClick={() => onTransformPlayer(form.id)}
                      className={`min-h-[42px] rounded border px-3 py-2 text-xs font-semibold ${
                        hud.ownerPlayerForm === form.id
                          ? 'border-amber-500 bg-amber-950/75 text-amber-200'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-amber-700'
                      } ${form.id === 'original' ? 'col-span-2' : ''}`}
                    >
                      {form.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded border border-zinc-800 bg-black/85 p-4">
                <h3 className="font-display text-lg font-bold tracking-wider text-red-400">
                  TRANSFORM SELECTED NPC
                </h3>
                <div className="mt-2">
                  <select
                    value={selectedNpc?.id ?? ''}
                    onChange={(e) => setSelectedNpcId(e.target.value)}
                    className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                  >
                    {hud.ownerNpcs.length === 0 ? (
                      <option value="">No active NPCs</option>
                    ) : (
                      hud.ownerNpcs.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({n.roleLabel})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {selectedNpc && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onTransformNpc(selectedNpc.id, 'student')}
                      className="min-h-[40px] rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-emerald-500"
                    >
                      Anomaly → Student
                    </button>
                    <button
                      type="button"
                      onClick={() => onTransformNpc(selectedNpc.id, 'anomaly')}
                      className="min-h-[40px] rounded border border-red-800/80 bg-red-950/60 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-900"
                    >
                      Student → Anomaly
                    </button>
                    <button
                      type="button"
                      onClick={() => onTransformNpc(selectedNpc.id, 'guard')}
                      className="min-h-[40px] rounded border border-amber-800/80 bg-amber-950/55 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/70"
                    >
                      → Security Guard
                    </button>
                    <button
                      type="button"
                      onClick={() => onTransformNpc(selectedNpc.id, 'original')}
                      className="min-h-[40px] rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                    >
                      Restore Original
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'speed' && (
            <div className="space-y-4">
              <div className="rounded border border-zinc-800 bg-black/85 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-wider text-amber-300">
                      PLAYER SPEED CONTROL
                    </h3>
                    <p className="font-mono-tabular text-xs text-zinc-400">
                      Current Multiplier: {hud.ownerPlayerSpeed.toFixed(2)}x
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSetPlayerSpeed(1.0)}
                    className="rounded border border-amber-700 bg-amber-950/60 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-900/75"
                  >
                    RESET TO NORMAL SPEED
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {SPEED_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => onSetPlayerSpeed(p.value)}
                      className={`min-h-[38px] rounded border px-3.5 py-1.5 text-xs font-semibold ${
                        Math.abs(hud.ownerPlayerSpeed - p.value) < 0.08
                          ? 'border-amber-500 bg-amber-950 text-amber-200'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      {p.label} ({p.value}x)
                    </button>
                  ))}
                </div>

                <label className="mt-4 block text-xs text-zinc-300">
                  <span>Custom Speed Slider (0.35x – 3.50x)</span>
                  <input
                    type="range"
                    min={0.35}
                    max={3.5}
                    step={0.05}
                    value={hud.ownerPlayerSpeed}
                    onChange={(e) => onSetPlayerSpeed(Number(e.target.value))}
                    className="mt-2 w-full accent-amber-500"
                  />
                </label>
              </div>

              <div className="rounded border border-zinc-800 bg-black/85 p-4">
                <h3 className="font-display text-lg font-bold tracking-wider text-zinc-100">
                  SELECTED NPC SPEED CONTROL
                </h3>
                {selectedNpc ? (
                  <div className="mt-2 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        value={selectedNpc.id}
                        onChange={(e) => setSelectedNpcId(e.target.value)}
                        className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100"
                      >
                        {hud.ownerNpcs.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name} ({n.speedMultiplier.toFixed(2)}x)
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onSetNpcSpeed(selectedNpc.id, 1.0)}
                        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                      >
                        Reset NPC Speed
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SPEED_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => onSetNpcSpeed(selectedNpc.id, p.value)}
                          className="rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:border-amber-600"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min={0.35}
                      max={3.2}
                      step={0.05}
                      value={selectedNpc.speedMultiplier}
                      onChange={(e) => onSetNpcSpeed(selectedNpc.id, Number(e.target.value))}
                      className="w-full accent-red-500"
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">No active NPCs available to adjust speed.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'bodyguards' && (
            <div className="space-y-4 rounded border border-zinc-800 bg-black/85 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold tracking-wider text-amber-300">
                    SUMMON BODYGUARDS (FRIENDLY PROTECTION)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Active Bodyguards: <span className="font-semibold text-zinc-100">{hud.ownerBodyguardCount}</span> · Stance:{' '}
                    <span className="font-semibold text-amber-200">{hud.ownerBodyguardStance.toUpperCase()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-mono-tabular text-xs text-zinc-300">
                    Count:
                    <select
                      value={bodyguardCount}
                      onChange={(e) => setBodyguardCount(Number(e.target.value))}
                      className="ml-2 rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} Guard{n > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => onSummonBodyguards(bodyguardCount)}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded border border-amber-500 bg-amber-900/75 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800"
                  >
                    <Users className="h-4 w-4" />
                    <span>SUMMON BODYGUARDS</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => onSetBodyguardStance('follow')}
                  className={`min-h-[42px] rounded border px-3 py-2 text-xs font-semibold ${
                    hud.ownerBodyguardStance === 'follow'
                      ? 'border-emerald-500 bg-emerald-950/75 text-emerald-100'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                  }`}
                >
                  Follow Player
                </button>
                <button
                  type="button"
                  onClick={() => onSetBodyguardStance('hold')}
                  className={`min-h-[42px] rounded border px-3 py-2 text-xs font-semibold ${
                    hud.ownerBodyguardStance === 'hold'
                      ? 'border-amber-500 bg-amber-950/75 text-amber-100'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-300'
                  }`}
                >
                  Hold Position
                </button>
                <button
                  type="button"
                  onClick={onRecallBodyguards}
                  className="min-h-[42px] rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
                >
                  Recall All Bodyguards
                </button>
                <button
                  type="button"
                  onClick={onUnstuckBodyguards}
                  className="min-h-[42px] rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
                >
                  Restore Stuck Bodyguards
                </button>
              </div>

              <button
                type="button"
                onClick={onDismissBodyguards}
                className="min-h-[40px] rounded border border-red-800/80 bg-red-950/60 px-4 py-2 text-xs font-semibold text-red-100 hover:bg-red-900"
              >
                Dismiss All Bodyguards
              </button>
            </div>
          )}

          {tab === 'teleport' && (
            <div className="space-y-4">
              {(['room', 'shift', 'cutscene'] as const).map((cat) => (
                <div key={cat} className="rounded border border-zinc-800 bg-black/85 p-4">
                  <div className="mb-2.5 font-mono-tabular text-xs font-semibold tracking-wider text-amber-300">
                    {cat === 'room'
                      ? 'SCHOOL LOCATIONS'
                      : cat === 'shift'
                        ? 'CAMPAIGN SHIFTS & SHIFT 6'
                        : 'CUTSCENES, ENDINGS & MENUS'}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {TELEPORT_LOCATIONS.filter((l) => l.category === cat).map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => onTeleportTo(loc.id)}
                        className="min-h-[42px] rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-500 hover:bg-amber-950/35 hover:text-amber-200"
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'modes' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded border border-red-900/70 bg-black/85 p-4">
                <h3 className="font-display text-lg font-bold tracking-wider text-red-400">
                  7G. SHIFT 6 — MIDNIGHT BREACH
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                  Play the Owner-exclusive 6th shift using the full school environment: contain corrupted anomalies via CCTV lockdown or banish all 4 with the Electric Gun and return to the Checking Room gate.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onStartShift6}
                    className="min-h-[42px] rounded border border-red-600 bg-red-800 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Launch Shift 6 Start
                  </button>
                  <button
                    type="button"
                    onClick={onTriggerAnomalyMode}
                    className="min-h-[42px] rounded border border-red-800/80 bg-red-950/65 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/80"
                  >
                    Launch Anomaly Mode (STPGY)
                  </button>
                </div>
              </div>

              <div className="rounded border border-amber-900/70 bg-black/85 p-4">
                <h3 className="font-display text-lg font-bold tracking-wider text-amber-300">
                  7I. CUTSCENE &amp; ENDING LAUNCHERS
                </h3>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => onTeleportTo('shift5_intro')}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500"
                  >
                    <Film className="h-3.5 w-3.5 text-amber-300" />
                    <span>Shift 5 Opening Cutscene</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTeleportTo('shift5_chase')}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500"
                  >
                    <Film className="h-3.5 w-3.5 text-red-400" />
                    <span>Shift 5 Chase Start</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTeleportTo('ending_screen')}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-emerald-500"
                  >
                    <Film className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Campaign Ending Screen</span>
                  </button>
                  <button
                    type="button"
                    onClick={onTriggerWhoThem}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-red-500"
                  >
                    <Film className="h-3.5 w-3.5 text-red-300" />
                    <span>Secret Epilogue (&quot;Who Them?&quot;) &amp; Credits</span>
                  </button>
                  <button
                    type="button"
                    onClick={onTriggerShift6Ending}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500"
                  >
                    <Crown className="h-3.5 w-3.5 text-amber-300" />
                    <span>Shift 6 Ending Screen</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
