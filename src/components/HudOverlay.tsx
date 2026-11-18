import React, { useEffect, useState } from 'react';
import {
  Brain,
  Check,
  CreditCard,
  Crown,
  EyeOff,
  FileText,
  HelpCircle,
  Home,
  Monitor,
  RotateCcw,
  ScanLine,
  Shield,
  ShieldAlert,
  Skull,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { CctvCamId, HudSnapshot } from '../types/game';
import { CaseLogsModal } from './CaseLogsModal';
import { CctvPanel } from './CctvPanel';
import { IdAndRecordModal } from './IdAndRecordModal';
import { ScannerPanel } from './ScannerPanel';

interface HudOverlayProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onSetOverlay: (overlay: HudSnapshot['activeOverlay']) => void;
  onSetCctvCam: (cam: CctvCamId) => void;
  onStartScan: () => void;
  onAskQuestion: (idx: 0 | 1 | 2) => void;
  onAllow: () => void;
  onReject: () => void;
  onToggleTaserEquip: () => void;
  onFireTaser: () => void;
  onToggleLockdown: (room: 'room101' | 'room102') => void;
  onToggleHide: () => void;
  onToggleCrouch: () => void;
  onLockPointer: () => void;
  onReturnToMenu: () => void;
  onRestartCampaign: () => void;
  onTriggerWhoThem: () => void;
  onSkipCredits: () => void;
  onReplayCredits: () => void;
  onAnomalyHunt: () => void;
  onAnomalySurge: () => void;
  onRetryAnomaly: () => void;
  onDismissAnomalyVictory: () => void;
  onPossessTarget: () => void;
  onReleasePossession: () => void;
  onPossessedAction: () => void;
  onCyclePossessed: (dir: 1 | -1) => void;
  onToggleImmortal: (active: boolean) => void;
  onOpenOwnerPanel: () => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  muted,
  onToggleMute,
  onSetOverlay,
  onSetCctvCam,
  onStartScan,
  onAskQuestion,
  onAllow,
  onReject,
  onToggleTaserEquip,
  onFireTaser,
  onToggleLockdown,
  onToggleHide,
  onToggleCrouch,
  onLockPointer,
  onReturnToMenu,
  onRestartCampaign,
  onTriggerWhoThem,
  onSkipCredits,
  onReplayCredits,
  onAnomalyHunt,
  onAnomalySurge,
  onRetryAnomaly,
  onDismissAnomalyVictory,
  onPossessTarget,
  onReleasePossession,
  onPossessedAction,
  onCyclePossessed,
  onToggleImmortal,
  onOpenOwnerPanel,
}) => {
  const isHunt = hud.phase === 'hunt';
  const isClassTime = hud.phase === 'classtime';
  const isArrival = hud.phase === 'arrival';
  const isCutaway = hud.phase === 'cutaway';
  const isEscapeIntro = hud.phase === 'escape_intro';
  const isEscapePlay = hud.phase === 'escape_play';
  const isEscapeOutro = hud.phase === 'escape_outro';
  const isKidnapperCutscene = hud.phase === 'kidnapper_cutscene';
  const isAnomalyMode = hud.phase === 'anomaly_mode';

  const [tutorialDismissed, setTutorialDismissed] = useState(false);

  useEffect(() => {
    if (hud.day === 1 && hud.arrivalIndex === 1 && !hud.scanCompleted && hud.activeOverlay === 'none') {
      setTutorialDismissed(false);
    }
  }, [hud.day, hud.arrivalIndex, hud.scanCompleted, hud.activeOverlay]);

  const renderStatusBadgesAndCrown = () => (
    <>
      {hud.immortalUnlocked && (
        <button
          type="button"
          onClick={() => onToggleImmortal(!hud.immortalActive)}
          title="Toggle Player Immortality"
          className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono-tabular text-[11px] font-bold tracking-wider transition-colors whitespace-nowrap shrink-0 ${
            hud.immortalActive
              ? 'border-cyan-400/90 bg-cyan-950/90 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.3)] hover:bg-cyan-900/90'
              : 'border-zinc-700 bg-zinc-950/92 text-zinc-400 hover:border-cyan-700 hover:text-cyan-300'
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          <span>{hud.immortalActive ? 'IMMORTAL' : 'IMMORTAL (OFF)'}</span>
        </button>
      )}
      {hud.ownerInfiniteRevives && (
        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/80 bg-emerald-950/85 px-2.5 py-1.5 font-mono-tabular text-[11px] font-bold tracking-wider text-emerald-200 whitespace-nowrap shrink-0">
          <Sparkles className="h-3 w-3" />
          <span>INFINITE REVIVES ACTIVE</span>
        </span>
      )}
      {hud.ownerInvisible && (
        <span className="rounded border border-amber-500/80 bg-amber-950/85 px-2 py-1 font-mono-tabular text-[10px] font-bold tracking-wider text-amber-200 whitespace-nowrap shrink-0">
          INVISIBLE
        </span>
      )}
      {hud.ownerFreecam && (
        <span className="rounded border border-purple-500/80 bg-purple-950/85 px-2 py-1 font-mono-tabular text-[10px] font-bold tracking-wider text-purple-200 whitespace-nowrap shrink-0">
          FREECAM
        </span>
      )}
      {hud.ownerNpcsPaused && (
        <span className="rounded border border-red-500/80 bg-red-950/85 px-2 py-1 font-mono-tabular text-[10px] font-bold tracking-wider text-red-200 whitespace-nowrap shrink-0">
          NPCS PAUSED
        </span>
      )}
      {hud.ownerModeUnlocked && (
        <button
          type="button"
          onClick={onOpenOwnerPanel}
          aria-label="Open Owner Control Panel"
          className="inline-flex items-center gap-1.5 rounded border border-amber-500/90 bg-gradient-to-b from-amber-950/90 to-red-950/90 px-3 py-2 text-xs font-bold tracking-wider text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.35)] transition-all hover:border-amber-300 hover:text-white whitespace-nowrap shrink-0"
        >
          <Crown className="h-3.5 w-3.5 text-amber-300" />
          <span>OWNER</span>
        </button>
      )}
    </>
  );

  const renderImmortalShieldOverlay = () =>
    hud.immortalShieldFlash > 0 ? (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-25"
        style={{
          opacity: Math.min(0.7, hud.immortalShieldFlash),
          background:
            'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.04) 42%, rgba(56,189,248,0.42) 86%, rgba(250,204,21,0.36) 100%)',
        }}
      />
    ) : null;

  const renderPossessionOverlay = () => {
    if (!hud.mindControlUnlocked && !hud.ownerModeUnlocked) return null;
    if (hud.possessedNpc) {
      const pct = Math.max(
        0,
        Math.min(100, (hud.possessedNpc.timeLeft / Math.max(1, hud.possessedNpc.maxDuration)) * 100),
      );
      return (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-15"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 52%, rgba(126,34,206,0.38) 100%)',
            }}
          />
          <div className="pointer-events-auto mx-auto mb-1 flex w-[min(94vw,560px)] flex-wrap items-center justify-between gap-2 rounded border border-purple-500/80 bg-zinc-950/95 px-3.5 py-2 shadow-[0_0_24px_rgba(147,51,234,0.35)]">
            <div className="min-w-[170px] flex-1">
              <div className="flex items-center gap-2 font-mono-tabular text-xs font-bold tracking-wider text-purple-300">
                <span>POSSESSING: {hud.possessedNpc.name.toUpperCase()}</span>
                <span className="text-zinc-400">({hud.possessedNpc.roleLabel})</span>
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono-tabular text-[10px] text-zinc-400">
                <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-zinc-900">
                  <div
                    className="h-full bg-purple-500 transition-[width] duration-100"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-purple-200 tabular-nums">{hud.possessedNpc.timeLeft.toFixed(1)}s</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onPossessedAction}
                className={`min-h-[38px] rounded border px-2.5 py-1 text-xs font-semibold ${
                  hud.phase === 'anomaly_mode' || hud.possessedNpc.canEat
                    ? 'border-red-500/85 bg-red-950/85 text-red-100 hover:bg-red-900'
                    : 'border-purple-500/75 bg-purple-950/80 text-purple-100 hover:bg-purple-900'
                }`}
              >
                {hud.phase === 'anomaly_mode' || hud.possessedNpc.canEat ? 'Eat [F]' : 'Action [F]'}
              </button>
              <button
                type="button"
                onClick={() => onCyclePossessed(-1)}
                className="min-h-[38px] rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => onCyclePossessed(1)}
                className="min-h-[38px] rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Next
              </button>
              <button
                type="button"
                onClick={onReleasePossession}
                className="min-h-[38px] rounded border border-red-600/80 bg-red-950/85 px-3 py-1 text-xs font-semibold text-red-100 hover:bg-red-900"
              >
                Release [E]
              </button>
            </div>
          </div>
        </>
      );
    }
    return null;
  };

  // Shift 5 Final Escape Cinematics & Gameplay HUD
  if (isEscapeIntro || isEscapeOutro) {
    const introLine =
      hud.escapeStage === 'intro_students'
        ? 'Students board the waiting yellow bus down the dark road...'
        : hud.escapeStage === 'intro_anomalies'
          ? 'Heavy footsteps echo behind the doors — anomalies burst into the night!'
          : 'RUN FOR THE BUS!';

    return (
      <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between">
        {/* Cinematic Letterbox Bars */}
        <div className="h-14 w-full bg-black/95" />

        {isEscapeIntro && (
          <div className="mx-auto mb-10 rounded border border-zinc-800 bg-black/85 px-6 py-3 text-center text-sm font-medium tracking-wide text-zinc-100">
            {introLine}
          </div>
        )}

        {isEscapeOutro &&
          hud.escapeStage === 'outro_students' &&
          hud.escapeOutroFade < 0.7 && (
            <div className="mx-auto mb-10 rounded border border-zinc-800 bg-black/85 px-6 py-3 text-center text-sm font-medium tracking-wide text-zinc-100">
              Safe aboard the crowded bus, the students leave Midnight Public School behind...
            </div>
          )}

        {/* Outro Fade to Black & Epilogue */}
        {isEscapeOutro && (
          <div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black px-6 text-center transition-opacity duration-500"
            style={{ opacity: hud.escapeOutroFade }}
          >
            {hud.escapeStage === 'outro_title' && (
              <div className="font-display text-4xl font-bold tracking-widest text-zinc-100 md:text-5xl">
                {hud.escapeOutroCaption}
              </div>
            )}

            {(hud.escapeStage === 'outro_msg1' || hud.escapeStage === 'outro_msg2') && (
              <div className="max-w-xl space-y-6">
                <p className="font-display text-2xl tracking-wider text-zinc-200 md:text-3xl">
                  “YOU ESCAPED THE SCHOOL…”
                </p>
                {hud.escapeStage === 'outro_msg2' && (
                  <>
                    <p className="font-display text-3xl font-bold tracking-wider text-red-500 md:text-4xl">
                      “…BUT DID YOU ESCAPE THEM?”
                    </p>
                    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 pt-4">
                      <button
                        type="button"
                        onClick={onRestartCampaign}
                        className="inline-flex items-center gap-2 rounded bg-red-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Play Again</span>
                      </button>
                      <button
                        type="button"
                        onClick={onTriggerWhoThem}
                        className="font-display inline-flex items-center gap-2 rounded border border-red-700/80 bg-[#14090b] px-6 py-2.5 text-sm font-bold tracking-wider text-red-300 shadow-[0_0_20px_rgba(185,28,28,0.32)] transition-all hover:border-red-500 hover:bg-red-950/85 hover:text-white whitespace-nowrap shrink-0"
                      >
                        <span>Who Them?</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="h-14 w-full bg-black/95" />
      </div>
    );
  }

  if (isKidnapperCutscene) {
    const creditsP = Math.max(0, Math.min(1, hud.kidnapperCreditsProgress));
    const showFinaleHold = hud.kidnapperStage === 'credits_roll' && creditsP >= 0.84;
    const scrollPhase = Math.min(1, creditsP / 0.86);
    const translatePct = 72 - scrollPhase * 170;

    return (
      <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between">
        {/* Top Letterbox Bar + Mute Toggle */}
        <div className="flex h-14 w-full items-center justify-between bg-black/95 px-5">
          <span className="font-mono-tabular text-[11px] tracking-widest text-red-400/90">
            {hud.kidnapperStage === 'credits_roll'
              ? 'MIDNIGHT PUBLIC SCHOOL · END CREDITS'
              : 'SECRET EPILOGUE · CASE FILE #09'}
          </span>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="pointer-events-auto rounded border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Active Cutscene Subtitle Box */}
        {hud.kidnapperStage !== 'reveal_end' &&
          hud.kidnapperStage !== 'credits_roll' &&
          hud.kidnapperFade < 0.85 && (
            <div className="mx-auto mb-10 max-w-xl rounded border border-red-950/80 bg-black/88 px-6 py-3.5 text-center shadow-[0_0_30px_rgba(0,0,0,0.85)]">
              <div className="font-display text-lg font-bold tracking-wider text-red-400">
                {hud.kidnapperCaption}
              </div>
              <div className="mt-1 text-sm font-medium tracking-wide text-zinc-200">
                {hud.kidnapperSubCaption}
              </div>
            </div>
          )}

        {/* Fade to Black + Case File Beat + Automated Credit Roll */}
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-black px-6 text-center transition-opacity duration-300"
          style={{ opacity: hud.kidnapperFade }}
        >
          {hud.kidnapperStage === 'reveal_end' && (
            <div className="max-w-lg space-y-5">
              <p className="font-mono-tabular text-xs font-semibold tracking-widest text-red-500">
                CASE FILE UNSEALED
              </p>
              <h2 className="font-display text-4xl font-bold tracking-wider text-zinc-100 md:text-5xl">
                THE SCHOOL KID KIDNAPPERS
              </h2>
              <p className="text-sm leading-relaxed text-zinc-300">
                The unmarked roadblock waited beyond the school gates. Every anomaly inside Midnight
                Public School was only herding the loaded bus straight into the abductors’ hands.
              </p>
            </div>
          )}

          {hud.kidnapperStage === 'credits_roll' && (
            <>
              {/* Automated Upward-Scrolling Credit Roll */}
              {!showFinaleHold && (
                <div
                  className="pointer-events-none flex w-full max-w-xl flex-col items-center space-y-10 py-10"
                  style={{ transform: `translateY(${translatePct.toFixed(2)}%)` }}
                >
                  <div className="space-y-2 border-b border-red-900/50 pb-8">
                    <p className="font-mono-tabular text-xs font-semibold tracking-[0.28em] text-red-500">
                      CASE FILE #09 CONCLUDED
                    </p>
                    <h2 className="font-display text-4xl font-bold tracking-[0.14em] text-zinc-100 md:text-5xl">
                      MIDNIGHT PUBLIC SCHOOL
                    </h2>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-mono-tabular text-[11px] tracking-[0.22em] text-red-400">
                      GAME CONCEPT &amp; DIRECTION
                    </div>
                    <div className="text-lg font-semibold text-zinc-100">
                      Midnight Shift Interactive Studio
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-mono-tabular text-[11px] tracking-[0.22em] text-red-400">
                      GAMEPLAY SYSTEMS &amp; ENGINE ARCHITECTURE
                    </div>
                    <div className="text-base font-medium text-zinc-200">
                      WebGL / Three.js First-Person Horror Engine
                    </div>
                    <div className="text-xs text-zinc-400">
                      Checkpoint Verification · CCTV Surveillance · Taser &amp; Sanity Systems
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-mono-tabular text-[11px] tracking-[0.22em] text-red-400">
                      3D ENVIRONMENTS &amp; ATMOSPHERIC LIGHTING
                    </div>
                    <div className="text-base font-medium text-zinc-200">
                      Security Gate, Corridor, Classrooms 101 &amp; 102, Highway Roadblock
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-mono-tabular text-[11px] tracking-[0.22em] text-red-400">
                      CHARACTER ART &amp; PROCEDURAL ANIMATION
                    </div>
                    <div className="text-base font-medium text-zinc-200">
                      Security Guard Boss · Students &amp; Faculty · Night Anomalies
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-mono-tabular text-[11px] tracking-[0.22em] text-red-400">
                      PROCEDURAL HORROR AUDIO &amp; VOICE SYNTHESIS
                    </div>
                    <div className="text-base font-medium text-zinc-200">
                      Web Audio Engine &amp; Dynamic Broadcast Acoustics
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-mono-tabular text-[11px] tracking-[0.22em] text-red-400">
                      SPECIAL MODES &amp; SECRET ARCHIVES
                    </div>
                    <div className="text-base font-medium text-zinc-200">
                      Anomaly Hunt Mode · Mind Control · Shift 6 &amp; Owner Sandbox
                    </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    <p className="font-mono-tabular text-xs tracking-[0.25em] text-amber-300">
                      FINAL MESSAGE
                    </p>
                    <p className="font-display text-2xl font-bold tracking-wider text-zinc-100 md:text-3xl">
                      THANK YOU FOR PLAYING MIDNIGHT PUBLIC SCHOOL
                    </p>
                  </div>
                </div>
              )}

              {/* Final Thank-You Centerpiece & Actions */}
              {showFinaleHold && (
                <div className="max-w-lg space-y-5">
                  <p className="font-mono-tabular text-xs font-semibold tracking-[0.26em] text-red-500">
                    END OF TRANSMISSION
                  </p>
                  <h2 className="font-display text-3xl font-bold tracking-wider text-zinc-100 md:text-5xl">
                    THANK YOU FOR PLAYING MIDNIGHT PUBLIC SCHOOL
                  </h2>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Every shift, anomaly, and secret file inside Midnight Public School has been
                    uncovered.
                  </p>
                  <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={onRestartCampaign}
                      className="inline-flex items-center gap-2 rounded bg-red-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Play Again</span>
                    </button>
                    <button
                      type="button"
                      onClick={onReplayCredits}
                      className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0"
                    >
                      <span>Replay Credits</span>
                    </button>
                    <button
                      type="button"
                      onClick={onReturnToMenu}
                      className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0"
                    >
                      <Home className="h-4 w-4" />
                      <span>Main Menu</span>
                    </button>
                  </div>
                </div>
              )}

              {!showFinaleHold && (
                <button
                  type="button"
                  onClick={onSkipCredits}
                  className="pointer-events-auto fixed bottom-16 right-6 z-50 rounded border border-zinc-700 bg-zinc-950/90 px-4 py-2 text-xs font-semibold tracking-wider text-zinc-200 transition-colors hover:border-red-600 hover:text-white"
                >
                  Skip Credits &gt;&gt;
                </button>
              )}
            </>
          )}
        </div>

        <div className="h-14 w-full bg-black/95" />
      </div>
    );
  }

  if (isEscapePlay) {
    const threatClose = hud.escapePursuerDistance <= 7;
    return (
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
        {/* Pursuer Proximity Red Pulse */}
        {threatClose && (
          <div
            aria-hidden="true"
            className="animate-critical-vignette pointer-events-none fixed inset-0 z-10"
            style={{
              animationDuration: `${Math.max(0.45, hud.escapePursuerDistance * 0.12)}s`,
              background:
                'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 42%, rgba(165, 14, 14, 0.58) 100%)',
            }}
          />
        )}

        {renderImmortalShieldOverlay()}

        {/* Top Objective & Distance HUD */}
        <div className="relative z-30 flex items-start justify-between gap-3 px-5 pt-4">
          <div className="rounded border border-red-900/70 bg-zinc-950/92 px-4 py-2.5">
            <div className="font-display text-lg font-bold tracking-wider text-amber-300">
              {hud.escapeObjective}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-4 font-mono-tabular text-xs text-zinc-300">
              <span>BUS DISTANCE: {hud.escapeDistanceRemaining}m</span>
              <span className={threatClose ? 'font-bold text-red-400' : 'text-zinc-400'}>
                ANOMALIES BEHIND: {hud.escapePursuerDistance}m
              </span>
              <span className="uppercase text-zinc-400">ZONE: {hud.escapeStage}</span>
            </div>
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            {renderStatusBadgesAndCrown()}
            {!hud.pointerLocked && (
              <button
                type="button"
                onClick={onLockPointer}
                className="rounded border border-zinc-700 bg-zinc-950/92 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
              >
                Lock Mouse Look
              </button>
            )}
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="rounded border border-zinc-700 bg-zinc-950/92 p-2 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Center Reticle & Feedback */}
        <div className="relative z-30 flex flex-col items-center justify-center px-4">
          {hud.feedbackBanner && (
            <div className="mb-5 rounded border border-red-800 bg-red-950/95 px-4 py-2 text-center text-xs font-semibold tracking-wide text-red-100">
              {hud.feedbackBanner.text}
            </div>
          )}
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-200/80" aria-hidden="true" />
        </div>

        {/* Bottom Stamina Bar & Escape Controls */}
        <div className="relative z-30 flex flex-col items-center gap-2 px-4 pb-6">
          <div className="w-[min(92vw,340px)] rounded border border-zinc-800 bg-zinc-950/92 px-4 py-2.5">
            <div className="flex items-center justify-between font-mono-tabular text-xs">
              <span className="font-semibold tracking-wider text-zinc-200">SPRINT STAMINA</span>
              <span className={hud.escapeStamina < 25 ? 'text-red-400' : 'text-amber-300'}>
                {hud.escapeStamina}%
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-zinc-900">
              <div
                className={`h-full transition-[width] duration-75 ${
                  hud.escapeStamina < 25 ? 'bg-red-500' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, hud.escapeStamina))}%` }}
              />
            </div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/90 px-4 py-1.5 font-mono-tabular text-[11px] text-zinc-300">
            W Run · Hold Shift Sprint · A / D Dodge Lanes · Space Jump · Arrows / Mouse Look Around
          </div>
        </div>
      </div>
    );
  }

  if (isAnomalyMode) {
    const cooldownReady = hud.anomalyAbilityCooldown <= 0.05;
    return (
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
        {/* Transformation & Surge Vignettes */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            background: hud.anomalySurgeActive
              ? 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 34%, rgba(153, 18, 28, 0.62) 100%)'
              : 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 46%, rgba(88, 10, 18, 0.44) 100%)',
          }}
        />

        {/* Cardboard Box Peephole Vignette */}
        {hud.isHiding && hud.hidingType === 'box' && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-10"
            style={{
              opacity: Math.min(1, Math.max(0.15, hud.hideTransition)),
              background: `radial-gradient(ellipse ${Math.round(52 - hud.hideTransition * 16)}% ${Math.round(
                38 - hud.hideTransition * 24,
              )}% at 50% 50%, rgba(0,0,0,0) 60%, rgba(28,19,11,0.96) 86%, rgba(12,8,4,0.99) 100%)`,
            }}
          />
        )}

        {/* Desk Hiding Vignette */}
        {hud.isHiding && hud.hidingType === 'desk' && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-10"
            style={{
              opacity: Math.min(1, Math.max(0.15, hud.hideTransition)),
              background:
                'linear-gradient(to bottom, rgba(8,8,10,0.94) 0%, rgba(8,8,10,0.22) 28%, rgba(8,8,10,0) 55%, rgba(8,8,10,0.72) 100%)',
            }}
          />
        )}

        {/* Corridor Locker Narrow Slit Vignette */}
        {hud.isHiding && hud.hidingType === 'locker' && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-10"
            style={{
              opacity: Math.min(1, Math.max(0.2, hud.hideTransition)),
              background:
                'linear-gradient(to bottom, rgba(5,7,9,0.98) 0%, rgba(5,7,9,0.96) 40%, rgba(5,7,9,0.28) 43%, rgba(5,7,9,0.95) 45.5%, rgba(5,7,9,0.28) 48%, rgba(5,7,9,0.95) 50.5%, rgba(5,7,9,0.28) 53%, rgba(5,7,9,0.96) 56%, rgba(5,7,9,0.99) 100%), linear-gradient(to right, rgba(4,6,8,0.98) 0%, rgba(4,6,8,0.25) 24%, rgba(4,6,8,0.25) 76%, rgba(4,6,8,0.98) 100%)',
            }}
          />
        )}

        {hud.anomalyShocked && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-20"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(56,189,248,0.08) 32%, rgba(6,182,212,0.48) 100%)',
            }}
          />
        )}

        {renderImmortalShieldOverlay()}

        {hud.anomalyTransforming && (
          <div
            aria-hidden="true"
            className="animate-pulse pointer-events-none fixed inset-0 z-40 bg-red-950/75"
          />
        )}

        {/* Top Anomaly Mode HUD */}
        <div className="relative z-30 flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="rounded border border-red-900/75 bg-zinc-950/92 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-xl font-bold tracking-wider text-red-400">
                ANOMALY MODE
              </span>
              <span className="text-xs text-zinc-600" aria-hidden="true">
                ·
              </span>
              <span className="font-mono-tabular text-xs font-semibold text-zinc-100">
                Students: {hud.anomalyStudentsCaught} / {hud.anomalyTotalStudents}
              </span>
              <span className="text-xs text-zinc-600" aria-hidden="true">
                ·
              </span>
              <span className="inline-flex items-center gap-2 font-mono-tabular text-xs text-amber-200">
                <span>Guard Boss (Taser):</span>
                {hud.anomalyGuardBossAlive ? (
                  (() => {
                    const bossPct = Math.max(
                      0,
                      Math.min(
                        100,
                        Math.round(
                          (hud.anomalyGuardBossHp / Math.max(1, hud.anomalyGuardBossMaxHp)) * 100,
                        ),
                      ),
                    );
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-28 overflow-hidden rounded-sm border border-amber-700/70 bg-zinc-900">
                          <span
                            className={`block h-full transition-all ${
                              bossPct <= 35 ? 'bg-red-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${bossPct}%` }}
                          />
                        </span>
                        <span className="font-semibold text-amber-300">{bossPct}%</span>
                      </span>
                    );
                  })()
                ) : (
                  <span className="font-semibold text-emerald-400">DEFEATED</span>
                )}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular text-[11px] font-semibold tracking-wider text-red-300">
                  ANOMALY HP
                </span>
                <div className="h-2 w-28 overflow-hidden rounded-sm border border-zinc-700 bg-zinc-900">
                  <div
                    className={`h-full transition-all ${
                      hud.anomalyShocked
                        ? 'bg-cyan-400'
                        : hud.anomalyHp <= 35
                          ? 'bg-red-500'
                          : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, hud.anomalyHp))}%` }}
                  />
                </div>
                <span className="font-mono-tabular text-[11px] text-zinc-200">
                  {hud.anomalyHp}%
                </span>
              </div>
              <span className="font-mono-tabular text-[11px] text-zinc-400">
                Eliminate all {hud.anomalyTotalStudents} students &amp; the Guard Boss · Hide [E] heals
              </span>
            </div>
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            {renderStatusBadgesAndCrown()}
            {!hud.pointerLocked && (
              <button
                type="button"
                onClick={onLockPointer}
                className="rounded border border-red-800/80 bg-zinc-950/92 px-3 py-2 text-xs font-medium text-red-200 transition-colors hover:border-red-500 hover:bg-red-950/70 whitespace-nowrap shrink-0"
              >
                Click to Lock Look
              </button>
            )}
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="rounded border border-zinc-700 bg-zinc-950/92 p-2 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-950/92 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-red-700 hover:bg-red-950/75 whitespace-nowrap shrink-0"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Main Menu</span>
            </button>
          </div>
        </div>

        {/* Center Reticle, Alerts, Hiding Status & Catch Prompt */}
        <div className="relative z-30 flex flex-col items-center justify-center px-4">
          {hud.feedbackBanner && (
            <div
              className={`mb-5 rounded border px-4 py-2 text-center text-xs font-semibold tracking-wide ${
                hud.feedbackBanner.tone === 'danger'
                  ? 'border-red-700 bg-red-950/95 text-red-100'
                  : hud.feedbackBanner.tone === 'warning'
                    ? 'border-amber-700 bg-amber-950/95 text-amber-100'
                    : hud.feedbackBanner.tone === 'success'
                      ? 'border-emerald-700 bg-emerald-950/95 text-emerald-100'
                      : 'border-zinc-700 bg-zinc-950/92 text-zinc-100'
              }`}
            >
              {hud.feedbackBanner.text}
            </div>
          )}

          <div
            className={`rounded-full transition-transform ${
              hud.possessTarget && !hud.possessedNpc
                ? 'h-3.5 w-3.5 border-2 border-purple-400 bg-purple-400/50 shadow-[0_0_12px_rgba(192,132,252,0.95)]'
                : hud.anomalyNearbyTarget
                  ? 'h-2 w-2 scale-150 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)]'
                  : 'h-2 w-2 bg-red-400/70'
            }`}
            aria-hidden="true"
          />

          {(hud.mindControlUnlocked || hud.ownerModeUnlocked) &&
            !hud.possessedNpc &&
            hud.possessTarget && (
              <div className="pointer-events-auto mt-4 flex flex-wrap items-center justify-center gap-2 rounded border border-purple-500/85 bg-zinc-950/95 px-4 py-2 text-xs shadow-[0_0_18px_rgba(147,51,234,0.38)]">
                <span className="font-mono-tabular font-bold tracking-wider text-purple-200">
                  PRESS [E] TO POSSESS · {hud.possessTarget.name.toUpperCase()} ({hud.possessTarget.roleLabel})
                </span>
                <button
                  type="button"
                  onClick={onPossessTarget}
                  className="min-h-[36px] rounded border border-purple-400 bg-purple-800 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-700"
                >
                  Possess [E]
                </button>
              </div>
            )}

          {(hud.mindControlUnlocked || hud.ownerModeUnlocked) &&
            !hud.possessedNpc &&
            hud.possessCooldown > 0 && (
              <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/90 px-3 py-1 font-mono-tabular text-[11px] text-purple-300">
                Mind Control Ready in {hud.possessCooldown.toFixed(1)}s
              </div>
            )}

          {hud.anomalyNearbyTarget && (
            <div className="pointer-events-auto mt-5 flex flex-col items-center gap-1.5 rounded border border-red-700/85 bg-zinc-950/94 px-4 py-2 text-center font-mono-tabular text-xs">
              <div className="font-bold tracking-wider text-red-300">
                [CLICK / F] {hud.isHiding ? 'AMBUSH & EAT' : 'EAT'}{' '}
                {hud.anomalyNearbyTarget.name.toUpperCase()}
              </div>
              <div className="text-[11px] text-zinc-400">
                {hud.anomalyNearbyTarget.role === 'guard'
                  ? `Main Boss · ${Math.round(
                      ((hud.anomalyNearbyTarget.bossHp ?? hud.anomalyGuardBossHp) /
                        Math.max(1, hud.anomalyGuardBossMaxHp)) *
                        100,
                    )}% HP`
                  : 'Student'}
                {hud.anomalyNearbyTarget.panicked ? ' · ALERTED' : ' · UNAWARE'}
              </div>
              {hud.possessedNpc && (
                <button
                  type="button"
                  onClick={onPossessedAction}
                  className="mt-0.5 rounded border border-red-500 bg-red-800 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                >
                  Eat [F]
                </button>
              )}
            </div>
          )}

          {hud.isHiding && (
            <div className="mt-4 rounded border border-zinc-700 bg-zinc-950/94 px-4 py-2 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-wider text-red-300">
                <EyeOff className="h-3.5 w-3.5" />
                <span>
                  {hud.hidingType === 'box'
                    ? 'Hidden Inside Cardboard Box'
                    : hud.hidingType === 'locker'
                      ? 'Hidden Inside Corridor Locker'
                      : 'Hidden Under Desk'}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-400">
                Hidden from Guard &amp; Students · Recovering HP · Press [E] to emerge or [F] to ambush
              </div>
            </div>
          )}

          {!hud.isHiding && hud.nearbyHidingSpot && (
            <div className="mt-4 rounded border border-zinc-700 bg-zinc-950/92 px-3.5 py-1.5 text-xs text-zinc-200">
              <span className="font-semibold text-amber-300">Press E to hide</span>
              <span className="text-zinc-400"> · {hud.nearbyHidingSpot.label}</span>
            </div>
          )}
        </div>

        {/* Bottom Shadow Surge, Crouch, Hide & Controls */}
        <div className="relative z-30 flex flex-col items-center gap-2 px-4 pb-5">
          {renderPossessionOverlay()}
          {hud.isCrouching && !hud.isHiding && (
            <div className="rounded border border-emerald-500/60 bg-zinc-950/92 px-3 py-1 font-mono-tabular text-xs font-semibold tracking-wider text-emerald-300">
              CROUCHING (STEALTH)
            </div>
          )}

          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded border border-red-900/70 bg-zinc-950/94 px-3.5 py-2.5">
            <button
              type="button"
              onClick={onAnomalyHunt}
              className={`inline-flex items-center gap-2 rounded border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                hud.anomalyNearbyTarget
                  ? 'border-red-500 bg-red-800 text-white shadow-[0_0_16px_rgba(220,38,38,0.45)] hover:bg-red-700'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Skull className="h-3.5 w-3.5" />
              <span>{hud.isHiding ? 'Ambush [Click / F]' : 'Hunt / Strike [Click / F]'}</span>
            </button>

            {(() => {
              const radius = 12;
              const circumference = 2 * Math.PI * radius;
              const maxCd = Math.max(0.1, hud.anomalyAbilityMaxCooldown);
              const chargeProgress = hud.anomalySurgeActive
                ? 1
                : cooldownReady
                  ? 1
                  : Math.max(0, Math.min(1, 1 - hud.anomalyAbilityCooldown / maxCd));
              const dashOffset = circumference * (1 - chargeProgress);
              const ringColor = hud.anomalySurgeActive
                ? '#ff3b4d'
                : cooldownReady
                  ? '#ff1f2d'
                  : '#991b1b';

              return (
                <button
                  type="button"
                  onClick={onAnomalySurge}
                  disabled={!cooldownReady || hud.anomalySurgeActive}
                  className={`inline-flex items-center gap-2.5 rounded border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    hud.anomalySurgeActive
                      ? 'border-red-500 bg-red-950/95 text-red-100 shadow-[0_0_16px_rgba(255,31,45,0.45)]'
                      : cooldownReady
                        ? 'border-red-500 bg-red-950/80 text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.5)] hover:bg-red-900/85'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  <span
                    className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center"
                    aria-hidden="true"
                  >
                    <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                      <circle
                        cx="16"
                        cy="16"
                        r={radius}
                        fill={cooldownReady ? 'rgba(220, 38, 38, 0.24)' : 'rgba(24, 24, 27, 0.9)'}
                        stroke="rgba(63, 63, 70, 0.75)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="16"
                        cy="16"
                        r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        style={{
                          transition: 'stroke-dashoffset 100ms linear, stroke 150ms ease',
                          filter: cooldownReady
                            ? 'drop-shadow(0 0 5px rgba(255, 31, 45, 0.95))'
                            : 'none',
                        }}
                      />
                    </svg>
                    <Zap
                      className={`absolute h-3.5 w-3.5 transition-colors ${
                        cooldownReady || hud.anomalySurgeActive ? 'text-red-400' : 'text-zinc-500'
                      }`}
                    />
                  </span>

                  <span className="flex flex-col items-start leading-tight">
                    <span>
                      {hud.anomalySurgeActive
                        ? 'SHADOW SURGE ACTIVE'
                        : cooldownReady
                          ? 'Shadow Surge [Q] · READY'
                          : `Charging Surge [Q] · ${hud.anomalyAbilityCooldown.toFixed(1)}s`}
                    </span>
                    {!cooldownReady && !hud.anomalySurgeActive && (
                      <span className="text-[10px] font-normal text-zinc-500">
                        {Math.round(chargeProgress * 100)}% charged
                      </span>
                    )}
                  </span>
                </button>
              );
            })()}

            <button
              type="button"
              onClick={onToggleCrouch}
              disabled={hud.isHiding}
              className={`rounded border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                hud.isCrouching
                  ? 'border-emerald-500 bg-emerald-950/85 text-emerald-200'
                  : hud.isHiding
                    ? 'border-zinc-800 bg-zinc-950 text-zinc-600'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {hud.isCrouching ? 'Stand [C]' : 'Crouch [C]'}
            </button>

            {(hud.isHiding || hud.nearbyHidingSpot) && (
              <button
                type="button"
                onClick={onToggleHide}
                className={`rounded border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  hud.isHiding
                    ? 'border-amber-500 bg-amber-950/85 text-amber-200 hover:bg-amber-900/80'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {hud.isHiding ? 'Emerge [E]' : 'Hide [E]'}
              </button>
            )}
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-950/90 px-4 py-1.5 font-mono-tabular text-[11px] text-zinc-400">
            WASD Move · C Crouch · E Hide · Shift Sprint · Arrows / Mouse Look · Click / F Strike · Q Surge
          </div>
        </div>

        {/* Anomaly Victory Modal (All 20 Students + Guard Boss Eliminated) */}
        {hud.anomalyVictory && (
          <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4">
            <div className="w-full max-w-md rounded border border-red-700/85 bg-zinc-950 p-7 text-center shadow-[0_0_45px_rgba(185,28,28,0.4)]">
              <div className="font-mono-tabular text-xs font-semibold tracking-[0.22em] text-red-400">
                SECRET ANOMALY MODE · VICTORY
              </div>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-wider text-zinc-100">
                YOU WIN!
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                All {hud.anomalyTotalStudents} students and the armed Security Guard Boss have been eliminated. Midnight Public School belongs to the dark.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded border border-zinc-800 bg-black/70 p-3.5 font-mono-tabular text-xs">
                <div>
                  <div className="text-zinc-500">STUDENTS CAUGHT</div>
                  <div className="mt-1 text-lg font-bold text-red-300">
                    {hud.anomalyStudentsCaught} / {hud.anomalyTotalStudents}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">GUARD BOSS</div>
                  <div className="mt-1 text-lg font-bold text-emerald-400">DEFEATED</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onRetryAnomaly}
                  className="inline-flex items-center gap-2 rounded bg-red-800 px-4 py-2.5 text-xs font-semibold tracking-wider text-white transition-colors hover:bg-red-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Play Again</span>
                </button>
                <button
                  type="button"
                  onClick={onDismissAnomalyVictory}
                  className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  Keep Roaming
                </button>
                <button
                  type="button"
                  onClick={onReturnToMenu}
                  className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-200 transition-colors hover:border-red-700 hover:bg-red-950/75"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>Main Menu</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Anomaly Subdued Modal (Guard Boss Taser Defeat) */}
        {hud.anomalyHp <= 0 && (
          <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
            <div className="w-full max-w-md rounded border border-cyan-800/80 bg-zinc-950 p-7 text-center shadow-[0_0_40px_rgba(8,145,178,0.28)]">
              <div className="font-mono-tabular text-xs font-semibold tracking-[0.22em] text-cyan-400">
                HIGH-VOLTAGE CONTAINMENT
              </div>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-wider text-zinc-100">
                SUBDUED BY GUARD BOSS
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                The Security Guard Boss neutralized you with his electric taser gun. Use Crouch [C] and Hide [E] to dodge shots and ambush him!
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded border border-zinc-800 bg-black/70 p-3.5 font-mono-tabular text-xs">
                <div>
                  <div className="text-zinc-500">STUDENTS CAUGHT</div>
                  <div className="mt-1 text-lg font-bold text-zinc-100">
                    {hud.anomalyStudentsCaught} / {hud.anomalyTotalStudents}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">BOSS GUARD HP</div>
                  <div className="mt-1 text-lg font-bold text-amber-300">
                    {Math.round(
                      (hud.anomalyGuardBossHp / Math.max(1, hud.anomalyGuardBossMaxHp)) * 100,
                    )}
                    %
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onRetryAnomaly}
                  className="inline-flex items-center gap-2 rounded bg-red-800 px-4 py-2.5 text-xs font-semibold tracking-wider text-white transition-colors hover:bg-red-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retry Anomaly Mode</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToMenu}
                  className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-200 transition-colors hover:border-red-700 hover:bg-red-950/75"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>Main Menu</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isCutaway) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black p-6 text-center">
        <div className="max-w-lg rounded border border-red-900/70 bg-zinc-950 px-8 py-6">
          <div className="font-mono-tabular text-xs font-semibold tracking-widest text-red-400">
            CAMERA SIGNAL LOST · INCIDENT REPORTED
          </div>
          <p className="mt-3 text-base font-medium text-zinc-100">{hud.cutawayText}</p>
          <p className="mt-2 font-mono-tabular text-xs text-zinc-400">
            Casualties: {hud.casualties} / {hud.maxCasualties}
          </p>
        </div>
      </div>
    );
  }

  // Heartbeat pulse scaling below 50% sanity
  const lowSanityPulseFactor = hud.sanity < 50 ? Math.min(1, (50 - hud.sanity) / 50) : 0;
  const heartbeatDurationSec = Math.max(0.54, 1.75 - lowSanityPulseFactor * 1.2);

  // Critical red screen-edge vignette scaling below 25% sanity
  const criticalVignetteFactor = hud.sanity < 25 ? Math.min(1, (25 - hud.sanity) / 25) : 0;
  const criticalVignetteDurationSec = Math.max(0.55, 1.45 - criticalVignetteFactor * 0.9);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
      {renderImmortalShieldOverlay()}
      {/* Cardboard Box Peephole Vignette */}
      {hud.isHiding && hud.hidingType === 'box' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            opacity: Math.min(1, Math.max(0.15, hud.hideTransition)),
            background: `radial-gradient(ellipse ${Math.round(52 - hud.hideTransition * 16)}% ${Math.round(
              38 - hud.hideTransition * 24,
            )}% at 50% 50%, rgba(0,0,0,0) 60%, rgba(28,19,11,0.96) 86%, rgba(12,8,4,0.99) 100%)`,
          }}
        />
      )}

      {/* Desk Hiding Vignette */}
      {hud.isHiding && hud.hidingType === 'desk' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            opacity: Math.min(1, Math.max(0.15, hud.hideTransition)),
            background:
              'linear-gradient(to bottom, rgba(8,8,10,0.94) 0%, rgba(8,8,10,0.22) 28%, rgba(8,8,10,0) 55%, rgba(8,8,10,0.72) 100%)',
          }}
        />
      )}

      {/* Corridor Locker Narrow Slit Vignette */}
      {hud.isHiding && hud.hidingType === 'locker' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            opacity: Math.min(1, Math.max(0.2, hud.hideTransition)),
            background:
              'linear-gradient(to bottom, rgba(5,7,9,0.98) 0%, rgba(5,7,9,0.96) 40%, rgba(5,7,9,0.28) 43%, rgba(5,7,9,0.95) 45.5%, rgba(5,7,9,0.28) 48%, rgba(5,7,9,0.95) 50.5%, rgba(5,7,9,0.28) 53%, rgba(5,7,9,0.96) 56%, rgba(5,7,9,0.99) 100%), linear-gradient(to right, rgba(4,6,8,0.98) 0%, rgba(4,6,8,0.25) 24%, rgba(4,6,8,0.25) 76%, rgba(4,6,8,0.98) 100%)',
          }}
        />
      )}

      {/* Ambient Light Flicker Surge Visual Dimmer */}
      {hud.lightFlickerActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 animate-pulse bg-black/28"
        />
      )}

      {/* Hunt / Proximity Red Edge Vignette */}
      {(isHunt || hud.entityNearby) && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 50%, rgba(125, 14, 14, 0.45) 100%)',
          }}
        />
      )}

      {/* Critical Low-Sanity (<25%) Pulsing Dark Red Screen-Edge Vignette */}
      {hud.sanity < 25 && (
        <div
          aria-hidden="true"
          className="animate-critical-vignette pointer-events-none fixed inset-0 z-12"
          style={{
            animationDuration: `${criticalVignetteDurationSec.toFixed(2)}s`,
            background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 44%, rgba(110, 8, 12, ${(
              0.38 +
              criticalVignetteFactor * 0.42
            ).toFixed(2)}) 100%)`,
          }}
        />
      )}

      {/* Low-Sanity Mild Peripheral Color Distortion */}
      {hud.sanity < 55 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            opacity: Math.min(0.45, ((55 - hud.sanity) / 45) * 0.45),
            background:
              'linear-gradient(90deg, rgba(45, 212, 191, 0.14) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 86%, rgba(192, 38, 211, 0.14) 100%)',
          }}
        />
      )}

      {/* Low-Sanity Fleeting Peripheral Shadow Hallucination */}
      {hud.hallucinationFlash && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-y-0 z-10 w-44 ${
            hud.hallucinationFlash.side === 'left' ? 'left-0' : 'right-0'
          }`}
          style={{
            opacity: hud.hallucinationFlash.strength,
            background:
              hud.hallucinationFlash.side === 'left'
                ? 'radial-gradient(ellipse at 0% 55%, rgba(2, 3, 5, 0.94) 0%, rgba(4, 6, 10, 0.58) 45%, rgba(0,0,0,0) 85%)'
                : 'radial-gradient(ellipse at 100% 55%, rgba(2, 3, 5, 0.94) 0%, rgba(4, 6, 10, 0.58) 45%, rgba(0,0,0,0) 85%)',
          }}
        />
      )}

      {/* Critical-Sanity Brief Distorted Corridor Face Flash */}
      {hud.corridorFaceFlash && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-15 flex items-center justify-center overflow-hidden"
        >
          <div
            className="relative h-72 w-56 rounded-full"
            style={{
              opacity: hud.corridorFaceFlash.opacity,
              transform: `translate(${hud.corridorFaceFlash.xOffset}px, ${hud.corridorFaceFlash.yOffset}px) scale(${hud.corridorFaceFlash.scale}) skewX(${hud.corridorFaceFlash.skew}deg)`,
              background:
                'radial-gradient(ellipse at 50% 48%, rgba(215, 212, 205, 0.85) 0%, rgba(75, 72, 70, 0.55) 48%, rgba(0, 0, 0, 0) 76%)',
              filter: 'contrast(1.85) grayscale(0.8)',
            }}
          >
            <div className="absolute left-12 top-20 h-11 w-7 -rotate-6 rounded-full bg-black/95" />
            <div className="absolute right-12 top-19 h-12 w-7 rotate-6 rounded-full bg-black/95" />
            <div className="absolute left-[62px] top-[98px] h-1.5 w-1.5 bg-zinc-100" />
            <div className="absolute right-[62px] top-[96px] h-1.5 w-1.5 bg-zinc-100" />
            <div className="absolute bottom-14 left-1/2 h-16 w-11 -translate-x-1/2 rounded-full bg-black/95" />
          </div>
        </div>
      )}

      {/* Top Status Bar */}
      <div className="relative z-30 flex items-start justify-between gap-3 px-5 pt-4">
        <div className="rounded border border-zinc-800 bg-zinc-950/92 px-4 py-2.5">
          <div className="flex flex-wrap items-baseline gap-3">
            <span
              className={`font-display text-xl font-semibold tracking-wide tabular-nums ${
                hud.isShift6 ? 'text-amber-300' : 'text-zinc-100'
              }`}
            >
              {hud.isShift6 ? 'SHIFT 6 · BREACH' : `Day ${hud.day} / ${hud.maxDays}`}
            </span>

            <span className="text-xs text-zinc-600" aria-hidden="true">
              ·
            </span>
            <span
              className={`font-mono-tabular text-xs font-semibold ${
                hud.isShift6
                  ? 'text-red-400'
                  : isArrival
                    ? 'text-amber-300'
                    : 'text-emerald-300'
              }`}
            >
              {hud.isShift6
                ? `ANOMALIES ACTIVE: ${hud.shift6AnomaliesRemaining}`
                : isArrival
                  ? `PHASE 1: CHECKPOINT (${hud.arrivalIndex} / ${hud.arrivalsToday})`
                  : 'PHASE 2: CLASS SURVEILLANCE'}
            </span>

            <span className="text-xs text-zinc-600" aria-hidden="true">
              ·
            </span>
            <span
              className={`font-mono-tabular inline-flex items-center gap-1.5 text-xs font-semibold ${
                hud.casualties > 0 ? 'text-red-400' : 'text-zinc-300'
              }`}
            >
              <Skull className="h-3.5 w-3.5" />
              Casualties: {hud.casualties} / {hud.maxCasualties}
            </span>

            <span className="text-xs text-zinc-600" aria-hidden="true">
              ·
            </span>
            <span
              className={`font-mono-tabular inline-flex items-center gap-1.5 text-xs font-semibold ${
                hud.strikes > 0 ? 'text-amber-400' : 'text-zinc-300'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Strikes: {hud.strikes} / {hud.maxStrikes}
            </span>

            <span className="text-xs text-zinc-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-tabular inline-flex items-center gap-1.5 text-xs text-amber-300">
              <Zap className="h-3.5 w-3.5" />
              Electric Gun: {hud.taserCharges} / {hud.maxTaserCharges}
              {hud.hasTaserInHand ? ' · EQUIPPED' : ''}
            </span>

            <span className="text-xs text-zinc-600" aria-hidden="true">
              ·
            </span>
            <span
              className={`font-mono-tabular inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-semibold ${
                hud.sanity < 50 ? 'animate-sanity-heartbeat ' : ''
              }${
                hud.sanity < 35
                  ? 'text-red-400'
                  : hud.sanity < 65
                    ? 'text-amber-300'
                    : 'text-sky-300'
              }`}
              style={
                hud.sanity < 50
                  ? {
                      animationDuration: `${heartbeatDurationSec.toFixed(2)}s`,
                      boxShadow: `0 0 ${Math.round(6 + lowSanityPulseFactor * 14)}px rgba(239, 68, 68, ${(
                        0.18 +
                        lowSanityPulseFactor * 0.44
                      ).toFixed(2)})`,
                    }
                  : undefined
              }
            >
              <Brain className="h-3.5 w-3.5" />
              <span>Sanity: {hud.sanity}%</span>
              <span className="inline-block h-1.5 w-14 overflow-hidden rounded-sm bg-zinc-800">
                <span
                  className={`block h-full transition-[width] duration-150 ${
                    hud.sanity < 35
                      ? 'bg-red-500'
                      : hud.sanity < 65
                        ? 'bg-amber-400'
                        : 'bg-sky-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, hud.sanity))}%` }}
                />
              </span>
              {hud.sanityState !== 'stable' && (
                <span
                  className={`text-[10px] font-normal ${
                    hud.sanityState === 'recovering'
                      ? 'text-emerald-300'
                      : hud.sanityState === 'anomaly' || hud.sanityState === 'flicker'
                        ? 'text-red-300'
                        : 'text-amber-300'
                  }`}
                >
                  (
                  {hud.sanityState === 'recovering'
                    ? 'recovering'
                    : hud.sanityState === 'flicker'
                      ? 'light flicker'
                      : hud.sanityState === 'whisper'
                        ? 'whispers'
                        : hud.sanityState === 'paranormal'
                          ? 'paranormal sound'
                          : hud.sanityState}
                  )
                </span>
              )}
            </span>
          </div>

          {hud.isShift6 && hud.shift6Objective && (
            <div className="mt-1.5 font-mono-tabular text-xs font-semibold text-amber-300">
              OBJECTIVE: {hud.shift6Objective}
            </div>
          )}

          {isClassTime && !hud.isShift6 && (
            <div className="mt-1.5 font-mono-tabular text-xs text-emerald-300">
              MONITOR LIVE CLASSROOM FEEDS &amp; AUDIO ({hud.classTimeLeft}s)
            </div>
          )}

          {isHunt && !hud.isShift6 && (
            <div className="mt-1.5 font-mono-tabular text-xs font-semibold text-red-400">
              ANOMALY LOOSE ({hud.huntActiveFakes} ACTIVE) · AIM AT ANOMALY &amp; PRESS [R] FOR ONE-SHOT ELECTRIC BANISH
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {renderStatusBadgesAndCrown()}
            {hud.day === 1 && hud.inCheckingRoom && (isArrival || isClassTime) && tutorialDismissed && (
              <button
                type="button"
                onClick={() => setTutorialDismissed(false)}
                className="inline-flex items-center gap-1.5 rounded border border-amber-700/75 bg-zinc-950/92 px-2.5 py-2 text-xs font-medium text-amber-200 transition-colors hover:border-amber-500 hover:bg-amber-950/70 whitespace-nowrap shrink-0"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Shift 1 Guide</span>
              </button>
            )}
            {!hud.pointerLocked && (
              <button
                type="button"
                onClick={onLockPointer}
                className="rounded border border-zinc-700 bg-zinc-950/92 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900 whitespace-nowrap shrink-0"
              >
                Lock Mouse Aim
              </button>
            )}
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="rounded border border-zinc-700 bg-zinc-950/92 p-2 text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {hud.debugVisible && (
            <div className="pointer-events-none w-80 max-w-[calc(100vw-2.5rem)] rounded border border-zinc-700 bg-zinc-950/95 px-3 py-2 font-mono-tabular text-[11px] leading-snug text-zinc-200">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400">
                <span>DEBUG [F1]</span>
                <span>DAY {hud.day}</span>
              </div>
              {isArrival && hud.currentArrival ? (
                <div className="mt-1.5 space-y-1">
                  <div>
                    Status:{' '}
                    <span
                      className={`font-semibold ${
                        hud.currentArrival.isFake ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {hud.currentArrival.isFake ? 'FAKE (ANOMALY)' : 'REAL'}
                    </span>
                  </div>
                  <div className="text-zinc-300">
                    Record: {hud.currentArrival.officialRecord.fullName} (
                    {hud.currentArrival.officialRecord.recordId})
                  </div>
                  <div className="text-amber-300">
                    Changed: {hud.currentArrival.idChangeSummary}
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 text-zinc-300">
                  Phase: {hud.phase.toUpperCase()} · Active Fakes Inside: {hud.huntActiveFakes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals: ID & Official Records / Case Logs / Body Scanner / CCTV */}
      {isArrival && hud.currentArrival && hud.activeOverlay === 'id_records' && (
        <IdAndRecordModal
          arrival={hud.currentArrival}
          records={hud.records}
          caseLogCount={hud.caseLogs.length}
          onOpenCaseLogs={() => onSetOverlay('case_logs')}
          onClose={() => onSetOverlay('none')}
        />
      )}

      {hud.activeOverlay === 'case_logs' && (
        <CaseLogsModal
          logs={hud.caseLogs}
          onBackToRecords={
            isArrival && hud.currentArrival ? () => onSetOverlay('id_records') : undefined
          }
          onClose={() => onSetOverlay('none')}
        />
      )}

      {isArrival && hud.currentArrival && hud.activeOverlay === 'scanner' && (
        <ScannerPanel
          arrival={hud.currentArrival}
          scanCompleted={hud.scanCompleted}
          scanProgress={hud.scanProgress}
          askedQuestionIdx={hud.askedQuestionIdx}
          onStartScan={onStartScan}
          onAskQuestion={onAskQuestion}
          onClose={() => onSetOverlay('none')}
        />
      )}

      {hud.activeOverlay === 'cctv' && (
        <CctvPanel
          activeCam={hud.activeCctvCam}
          cctvActors={hud.cctvActors}
          audioMode={hud.cctvAudioMode}
          audioLabel={hud.cctvAudioLabel}
          room101Locked={hud.room101Locked}
          room102Locked={hud.room102Locked}
          inCheckingRoom={hud.inCheckingRoom}
          hasTaserInHand={hud.hasTaserInHand}
          glitchPulse={hud.cctvGlitchPulse}
          onSelectCam={onSetCctvCam}
          onToggleLockdown={onToggleLockdown}
          onEquipTaser={onToggleTaserEquip}
          onClose={() => onSetOverlay('none')}
        />
      )}

      {/* Center Reticle, Feedback & Hiding Prompt */}
      <div className="relative z-30 flex flex-col items-center justify-center px-4">
        {hud.feedbackBanner && (
          <div
            className={`mb-6 rounded border px-4 py-2 text-center text-xs font-medium tracking-wide ${
              hud.feedbackBanner.tone === 'danger'
                ? 'border-red-800 bg-red-950/95 text-red-100'
                : hud.feedbackBanner.tone === 'success'
                  ? 'border-emerald-800 bg-emerald-950/95 text-emerald-100'
                  : hud.feedbackBanner.tone === 'warning'
                    ? 'border-amber-800 bg-amber-950/95 text-amber-100'
                    : 'border-zinc-700 bg-zinc-950/92 text-zinc-100'
            }`}
          >
            {hud.feedbackBanner.text}
          </div>
        )}

        {!hud.isHiding && hud.activeOverlay !== 'cctv' && (
          <div
            className={`rounded-full ${
              hud.possessTarget && !hud.possessedNpc
                ? 'h-3 w-3 border-2 border-purple-400 bg-purple-400/60 shadow-[0_0_10px_rgba(192,132,252,0.9)]'
                : hud.hasTaserInHand
                  ? 'h-2.5 w-2.5 border border-cyan-300 bg-cyan-300/60 shadow-[0_0_8px_rgba(34,211,238,0.9)]'
                  : 'h-1.5 w-1.5 bg-zinc-200/75'
            }`}
            aria-hidden="true"
          />
        )}

        {(hud.mindControlUnlocked || hud.ownerModeUnlocked) &&
          !hud.possessedNpc &&
          hud.possessTarget &&
          hud.activeOverlay === 'none' && (
            <div className="pointer-events-auto mt-4 flex flex-wrap items-center justify-center gap-2 rounded border border-purple-500/85 bg-zinc-950/95 px-4 py-2 text-xs shadow-[0_0_18px_rgba(147,51,234,0.35)]">
              <span className="font-mono-tabular font-bold tracking-wider text-purple-200">
                PRESS [E] TO POSSESS · {hud.possessTarget.name.toUpperCase()} ({hud.possessTarget.roleLabel})
              </span>
              <button
                type="button"
                onClick={onPossessTarget}
                className="min-h-[36px] rounded border border-purple-400 bg-purple-800 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-700"
              >
                Possess [E]
              </button>
            </div>
          )}

        {hud.schoolEatTarget && hud.activeOverlay === 'none' && (
          <div className="pointer-events-auto mt-4 flex flex-wrap items-center justify-center gap-2 rounded border border-red-600/85 bg-zinc-950/95 px-4 py-2 text-xs shadow-[0_0_18px_rgba(220,38,38,0.38)]">
            <span className="font-mono-tabular font-bold tracking-wider text-red-200">
              [CLICK / F] EAT · {hud.schoolEatTarget.name.toUpperCase()} ({hud.schoolEatTarget.role.toUpperCase()})
            </span>
            <button
              type="button"
              onClick={onPossessedAction}
              className="min-h-[36px] rounded border border-red-400 bg-red-800 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
            >
              Eat [F]
            </button>
          </div>
        )}

        {hud.isHiding && (
          <div className="mt-6 rounded border border-zinc-700 bg-zinc-950/92 px-4 py-2 text-center">
            <div className="text-xs font-semibold text-zinc-100">
              {hud.hidingType === 'box'
                ? 'Hiding Inside Cardboard Box'
                : hud.hidingType === 'locker'
                  ? 'Hiding Inside Corridor Locker'
                  : 'Hiding Under Desk'}
            </div>
            <div
              className={`mt-0.5 text-xs ${
                hud.isMovingWhileHiding
                  ? 'font-semibold text-red-400'
                  : hud.entityNearby && hud.hiddenDuration > 8.5
                    ? 'font-semibold text-amber-300'
                    : 'text-zinc-400'
              }`}
            >
              {hud.isMovingWhileHiding
                ? 'STOP MOVING — STAY STILL!'
                : hud.entityNearby && hud.hiddenDuration > 8.5
                  ? 'Anomaly lingering close — staying hidden too long risks discovery!'
                  : hud.entityNearby
                    ? 'Anomaly searching nearby — stay completely still!'
                    : hud.hidingType === 'desk' && hud.sanityState === 'recovering'
                      ? 'Safe under desk — recovering sanity · Press E to come out'
                      : 'Stay still · Press E to come out'}
            </div>
          </div>
        )}

        {!hud.isHiding && hud.nearbyHidingSpot && (
          <div className="mt-5 rounded border border-zinc-700 bg-zinc-950/92 px-3.5 py-1.5 text-xs text-zinc-200">
            <span className="font-semibold text-amber-300">Press E to hide</span>
            <span className="text-zinc-400"> · {hud.nearbyHidingSpot.label}</span>
          </div>
        )}
      </div>

      {/* Bottom Action Dock, Shift 1 Tutorial Tooltip, Crouching & Electric Gun Indicator */}
      <div className="relative z-30 flex flex-col items-center gap-2 px-4 pb-5">
        {renderPossessionOverlay()}
        {hud.day === 1 &&
          hud.inCheckingRoom &&
          (isArrival || isClassTime) &&
          !hud.isHiding &&
          !tutorialDismissed &&
          (() => {
            let badge = 'SHIFT 1 · CHECK-IN ROOM GUIDE';
            let heading = 'Inspect Visitors & Use the Desk Computer';
            let primaryTip =
              'ID SCANNER [2]: Scan visitors standing in the arch to check their heartbeat (0 BPM = fake), skeleton for extra bones or extra fingers, and ask verification questions.';
            let secondaryTip =
              'DESK COMPUTER [1] & [3]: Open ID & Records [1] on the computer to compare the badge photo, Roll/Staff ID, DOB, and school name. Open CCTV [3] to watch Rooms 101 & 102 after admitting people.';

            if (isArrival && hud.activeOverlay === 'scanner') {
              badge = 'GUIDE · ID & BODY SCANNER [2]';
              if (!hud.scanCompleted && hud.scanProgress === 0) {
                heading = 'Run Bio-Scan Before Admitting';
                primaryTip =
                  'Click Start Body Scan to inspect internal vitals. Anomalies can have 0 BPM heartbeat, extra bones, extra fingers, or suspicious answers.';
                secondaryTip =
                  'After scanning, open ID & Records [1] on your desk computer to verify their presented ID card against school files.';
              } else if (!hud.scanCompleted) {
                heading = 'Scanning Subject in Arch…';
                primaryTip =
                  'Wait for the bio-scan to hit 100%, then check heartbeat, breathing, bone count, and finger count for abnormalities.';
                secondaryTip =
                  'Use the 3 interview questions to catch hesitation or contradictory answers.';
              } else {
                heading = 'Bio-Scan Complete — Check Desk Computer';
                primaryTip =
                  'Review the scan readings for red anomaly warnings. Next, press [1] (ID & Records) on your computer to verify their badge photo, DOB, and ID number.';
                secondaryTip =
                  'If everything checks out, click Allow; if anything is fake, click Reject or press [T] + [R] to stun them.';
              }
            } else if (isArrival && hud.activeOverlay === 'id_records') {
              badge = 'GUIDE · DESK COMPUTER (ID & RECORDS)';
              heading = 'Cross-Check Presented ID vs Official Records';
              primaryTip =
                'This computer holds the official school database. Match the visitor’s Name, Photo, Roll/Staff ID, Date of Birth, and School Name word-for-word.';
              secondaryTip =
                'Haven’t scanned them yet? Press [2] (Scan & Ask) to run a bio-scan for hidden internal anomalies before choosing Allow or Reject.';
            } else if (hud.activeOverlay === 'cctv') {
              badge = 'GUIDE · DESK COMPUTER (CCTV TERMINAL)';
              heading = 'Monitor Classrooms & Trigger Lockdowns';
              primaryTip =
                'Your computer connects to live cameras and mics in Room 101, Room 102, and the Corridor. Watch for fakes staring at cameras, not blinking, or repeating dialogue.';
              secondaryTip =
                'If an anomaly enters a classroom, lock down that room from this computer and press [T] to equip your Electric Gun.';
            } else if (isArrival && hud.scanCompleted) {
              badge = 'GUIDE · VERIFY & DECIDE';
              heading = 'Cross-Check Computer Records, Then Decide';
              primaryTip =
                'Bio-scan finished! Press [1] to open ID & Records on the desk computer and verify their badge photo, ID number, DOB, and school.';
              secondaryTip =
                'Click Allow to send real students/teachers to class, or Reject / Electric Gun [T]+[R] if they are an anomaly.';
            } else if (isClassTime) {
              badge = 'GUIDE · CLASS SURVEILLANCE';
              heading = 'Watch Classrooms on Your Desk Computer';
              primaryTip =
                'Press [3] to open the CCTV Computer and check Rooms 101 & 102 while class is in session.';
              secondaryTip =
                'Listen for monotone murmurs or camera staring. Keep your Electric Gun [T] ready if a fake reveals itself!';
            }

            return (
              <div className="pointer-events-auto mb-1 w-[min(94vw,640px)] rounded border border-amber-600/65 bg-zinc-950/95 px-4 py-3 shadow-[0_0_24px_rgba(0,0,0,0.75)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 font-mono-tabular text-[10px] font-semibold tracking-[0.18em] text-amber-400">
                    <Monitor className="h-3.5 w-3.5 text-amber-300" />
                    <span>{badge}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTutorialDismissed(true)}
                    aria-label="Dismiss Shift 1 tutorial tooltip"
                    className="rounded px-1.5 py-0.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    Dismiss ×
                  </button>
                </div>
                <div className="mt-1 text-xs font-semibold text-zinc-100">{heading}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">{primaryTip}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{secondaryTip}</p>
              </div>
            );
          })()}

        {hud.isCrouching && !hud.isHiding && (
          <div className="rounded border border-emerald-500/60 bg-zinc-950/92 px-3 py-1 font-mono-tabular text-xs font-semibold tracking-wider text-emerald-300">
            Crouching
          </div>
        )}

        {hud.hasTaserInHand && !hud.isHiding && (
          <div className="w-[min(92vw,340px)] rounded border border-cyan-500/70 bg-zinc-950/94 px-3.5 py-2 shadow-[0_0_18px_rgba(34,211,238,0.22)]">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono-tabular font-semibold tracking-wider text-cyan-300">
                <Zap className="h-3.5 w-3.5 text-cyan-300" />
                ELECTRIC GUN (1-SHOT)
              </span>
              <span className="font-mono-tabular text-[11px] font-semibold text-amber-300">
                {hud.taserCharges > 0 ? 'AIM & PRESS [R] TO SHOOT' : 'NO SHOTS LEFT'}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between font-mono-tabular text-[10px] text-zinc-400">
              <span>Shots Left: {hud.taserCharges} / {hud.maxTaserCharges}</span>
              <span>Press T to put away</span>
            </div>
          </div>
        )}

        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded border border-zinc-800 bg-zinc-950/94 px-3.5 py-2.5">
          {isArrival && (
            <>
              <button
                type="button"
                onClick={() => onSetOverlay('id_records')}
                className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  hud.activeOverlay === 'id_records'
                    ? 'border-amber-500 bg-amber-950/80 text-amber-100'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>ID &amp; Records [1]</span>
              </button>

              <button
                type="button"
                onClick={onStartScan}
                className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  hud.activeOverlay === 'scanner'
                    ? 'border-cyan-500 bg-cyan-950/80 text-cyan-100'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
                }`}
              >
                <ScanLine className="h-3.5 w-3.5" />
                <span>Scan &amp; Ask [2]{hud.scanCompleted ? ' ✓' : ''}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onSetOverlay('cctv')}
            className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              hud.activeOverlay === 'cctv'
                ? 'border-emerald-500 bg-emerald-950/80 text-emerald-100'
                : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            <span>CCTV &amp; Lockdown [3]</span>
          </button>

          <button
            type="button"
            onClick={() => onSetOverlay('case_logs')}
            className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              hud.activeOverlay === 'case_logs'
                ? 'border-amber-500 bg-amber-950/80 text-amber-100'
                : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Case Logs [4] ({hud.caseLogs.length})</span>
          </button>

          {isArrival && (
            <>
              <div className="h-5 w-px bg-zinc-800" aria-hidden="true" />

              <button
                type="button"
                onClick={onAllow}
                className="inline-flex items-center gap-1.5 rounded bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Allow</span>
              </button>

              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-1.5 rounded bg-red-800 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reject</span>
              </button>
            </>
          )}

          {(hud.inCheckingRoom || hud.taserTakenFromRoom) && (
            <button
              type="button"
              onClick={onToggleTaserEquip}
              className={`inline-flex items-center gap-2 rounded border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                hud.hasTaserInHand
                  ? 'border-cyan-500 bg-cyan-950/85 text-cyan-100 hover:bg-cyan-900/80'
                  : 'border-amber-500 bg-amber-950/80 text-amber-100 hover:bg-amber-900/80'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{hud.hasTaserInHand ? 'Put Away Gun [T]' : 'Equip Electric Gun [T]'}</span>
            </button>
          )}

          {hud.hasTaserInHand && !hud.isHiding && hud.activeOverlay === 'none' && (
            <button
              type="button"
              onClick={onFireTaser}
              disabled={hud.taserCharges <= 0}
              className="inline-flex items-center gap-2 rounded border border-cyan-500/80 bg-cyan-950/80 px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-900/85 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Shoot Electric [R] ({hud.taserCharges})</span>
            </button>
          )}

          {!hud.isHiding && (
            <button
              type="button"
              onClick={onToggleCrouch}
              className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                hud.isCrouching
                  ? 'border-emerald-500 bg-emerald-950/80 text-emerald-100 hover:bg-emerald-900/80'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              <span>{hud.isCrouching ? 'Stand [C]' : 'Crouch [C]'}</span>
            </button>
          )}

          {(hud.nearbyHidingSpot || hud.isHiding) && (
            <button
              type="button"
              onClick={onToggleHide}
              className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0"
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span>{hud.isHiding ? 'Exit Hiding [E]' : 'Hide [E]'}</span>
            </button>
          )}
        </div>

        <div className="text-center text-[11px] text-zinc-400">
          {isHunt
            ? 'WASD Move · Arrows / Mouse Look · C Crouch · T Equip Electric Gun · Aim & Press R (1-Shot) · E Hide · 3 CCTV · 4 Case Logs'
            : isClassTime
              ? 'WASD Move · Arrows / Mouse Look · Watch CCTV [3] · Case Logs [4] · T Electric Gun · R Shoot'
              : '1 ID & Records · 2 Scan & Ask · 3 CCTV · 4 Case Logs · T Electric Gun · R Shoot · WASD Move · Arrows / Mouse Look · C Crouch · E Hide'}
        </div>
      </div>
    </div>
  );
};
