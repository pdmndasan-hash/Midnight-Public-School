import React, { useEffect, useState } from 'react';
import { Crown, Home, Play, RotateCcw, Shield, Sparkles } from 'lucide-react';
import { HudSnapshot } from '../types/game';
import { CoronersReportScreen } from './CoronersReportScreen';
import { RedeemAttemptResult, RedeemCodeModal } from './RedeemCodeModal';

interface EndScreensProps {
  hud: HudSnapshot;
  onStartIntro: () => void;
  onRestart: () => void;
  onRetryEscape: () => void;
  onReturnToMenu: () => void;
  onMenuClick: () => void;
  onRedeemCode: (raw: string) => RedeemAttemptResult;
  onTriggerShift5Ending: () => void;
  onTriggerAnomalyMode: () => void;
  onOpenOwnerPanel: () => void;
  onToggleImmortal: (active: boolean) => void;
  onStartShift6: () => void;
}

export const EndScreens: React.FC<EndScreensProps> = ({
  hud,
  onStartIntro,
  onRestart,
  onRetryEscape,
  onReturnToMenu,
  onMenuClick,
  onRedeemCode,
  onTriggerShift5Ending,
  onTriggerAnomalyMode,
  onOpenOwnerPanel,
  onToggleImmortal,
  onStartShift6,
}) => {
  const [redeemOpen, setRedeemOpen] = useState(false);

  useEffect(() => {
    if (hud.phase !== 'menu' && redeemOpen) {
      setRedeemOpen(false);
    }
  }, [hud.phase, redeemOpen]);

  if (hud.phase === 'menu') {
    const hasSavedProgress =
      hud.campaignSave.highestDayReached > 1 ||
      hud.campaignSave.completedCampaign ||
      (hud.ownerModeUnlocked && hud.campaignSave.shift6Completed) ||
      hud.redeemedCodes.length > 0;

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4 sm:p-6">
        <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded border border-zinc-800 bg-zinc-950/95 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-widest text-red-400">NIGHT CHECKPOINT DUTY</p>
            {hasSavedProgress && (
              <span className="font-mono-tabular text-[11px] font-medium text-zinc-400">
                {hud.campaignSave.completedCampaign
                  ? `Campaign Complete · Peak Shift ${hud.campaignSave.highestDayReached}/5`
                  : `Saved Progress · Shift ${hud.campaignSave.highestDayReached}/5`}
              </span>
            )}
          </div>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-zinc-100 md:text-5xl">
            Midnight Public School
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300">
            Stationed in the checking room with a wall of live CCTV monitors, each day runs in two
            phases: verify arriving students and teachers against school records at the window, then
            monitor live classroom camera feeds and room audio during class surveillance.
          </p>

          <div className="mt-6 space-y-2 border-t border-zinc-800 pt-5 text-xs text-zinc-400">
            <div>· Phase 1 (Checkpoint): Compare ID details, run body scan, ask questions; Allow, Reject, or Shoot.</div>
            <div>· Phase 2 (Surveillance): Watch admitted students &amp; teachers walk to class and observe live CCTV feeds.</div>
            <div>· Rejecting/shooting a real person or locking down real people issues 1 strike (3 = Game Over).</div>
            <div>· Move with WASD and turn/look left, right, up, down with Arrow Keys or Mouse. Press C to crouch, T to equip the Electric Gun (aim &amp; press R for a one-shot zap), or E to hide.</div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartIntro}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded bg-red-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-400 whitespace-nowrap shrink-0"
            >
              <Play className="h-4 w-4" />
              <span>Begin 5-Day Shift</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onMenuClick();
                setRedeemOpen((prev) => !prev);
              }}
              className="font-display inline-flex min-h-[44px] items-center justify-center gap-2 rounded border border-red-800/80 bg-[#120b0d] px-5 py-3 text-sm font-semibold tracking-wider text-red-100 shadow-[0_0_18px_rgba(185,28,28,0.28)] transition-all duration-200 hover:border-red-500 hover:bg-red-950/80 hover:shadow-[0_0_26px_rgba(220,38,38,0.45)] focus-visible:outline-2 focus-visible:outline-red-400 whitespace-nowrap shrink-0"
            >
              <span>🎁 REDEEM CODE</span>
            </button>

            {hud.ownerModeUnlocked && (
              <button
                type="button"
                onClick={() => {
                  onMenuClick();
                  onOpenOwnerPanel();
                }}
                className="font-display inline-flex min-h-[44px] items-center justify-center gap-2 rounded border border-amber-500/85 bg-gradient-to-b from-amber-950/85 to-red-950/85 px-5 py-3 text-sm font-bold tracking-wider text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:border-amber-300 hover:text-white whitespace-nowrap shrink-0"
              >
                <Crown className="h-4 w-4 text-amber-300" />
                <span>OWNER PANEL</span>
              </button>
            )}
          </div>

          {(hud.immortalUnlocked || hud.ownerModeUnlocked) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800/90 pt-4">
              {hud.immortalUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    onMenuClick();
                    onToggleImmortal(!hud.immortalActive);
                  }}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors ${
                    hud.immortalActive
                      ? 'border-cyan-500 bg-cyan-950/80 text-cyan-200'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>IMMORTAL: {hud.immortalActive ? 'ON' : 'OFF'}</span>
                </button>
              )}
              {hud.ownerModeUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    onMenuClick();
                    onStartShift6();
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded border border-amber-700/80 bg-amber-950/55 px-3 py-1.5 font-mono-tabular text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-900/75"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Launch Shift 6: Midnight Breach</span>
                </button>
              )}
            </div>
          )}
        </div>

        {redeemOpen && (
          <RedeemCodeModal
            onClose={() => setRedeemOpen(false)}
            onMenuClick={onMenuClick}
            onRedeemCode={onRedeemCode}
            onUnlockShift5Ending={onTriggerShift5Ending}
            onUnlockAnomalyMode={onTriggerAnomalyMode}
            onUnlockOwnerMode={onOpenOwnerPanel}
          />
        )}
      </div>
    );
  }

  if (hud.phase === 'jumpscare') {
    return (
      <div
        aria-hidden="true"
        className="animate-jumpscare-shake pointer-events-none fixed inset-0 z-40 border-8 border-red-700/60"
      />
    );
  }

  if (hud.phase === 'gameover') {
    if (hud.coronerReport) {
      return (
        <CoronersReportScreen
          report={hud.coronerReport}
          day={hud.day}
          maxDays={hud.maxDays}
          onRetryEscape={onRetryEscape}
          onRestart={onRestart}
        />
      );
    }

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/94 p-6">
        <div className="w-full max-w-md rounded border border-red-900/70 bg-zinc-950 p-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-red-500">SHIFT TERMINATED</p>
          <h2 className="font-display mt-2 text-5xl font-bold tracking-tight text-zinc-100">
            Game Over
          </h2>
          <p className="mt-3 text-sm text-zinc-300">
            {hud.deathReason || 'You failed to protect Midnight Public School.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-zinc-800 pt-5 text-xs text-zinc-400 font-mono-tabular">
            <span>
              Day {hud.day} / {hud.maxDays}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Casualties: {hud.casualties} / {hud.maxCasualties}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Strikes: {hud.strikes} / {hud.maxStrikes}
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {hud.canRetryEscape && (
              <button
                type="button"
                onClick={onRetryEscape}
                className="inline-flex items-center justify-center gap-2 rounded bg-amber-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry Escape Chase</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center justify-center gap-2 rounded bg-red-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-400 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Restart Campaign</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.phase === 'victory') {
    if (hud.ownerModeUnlocked && (hud.isShift6 || hud.shift6CompletedModal)) {
      return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/92 p-6">
          <div className="w-full max-w-md rounded border border-amber-600/80 bg-zinc-950 p-8 text-center shadow-[0_0_50px_rgba(217,119,6,0.3)]">
            <p className="font-mono-tabular text-xs font-semibold tracking-widest text-amber-400">
              SHIFT 6 COMPLETE · BREACH SEALED
            </p>
            <h2 className="font-display mt-2 text-4xl font-bold tracking-tight text-zinc-100">
              Midnight Breach Contained
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              You survived the secret 6th shift, banished every breached anomaly inside Midnight
              Public School, and sealed the checking room perimeter.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-zinc-800 pt-5 text-xs text-zinc-400 font-mono-tabular">
              <span>Shift: 6 / 6</span>
              <span aria-hidden="true">·</span>
              <span>Fakes Stopped: {hud.fakesStopped}</span>
              <span aria-hidden="true">·</span>
              <span>
                Casualties: {hud.casualties} / {hud.maxCasualties}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Strikes: {hud.strikes} / {hud.maxStrikes}
              </span>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onStartShift6}
                className="inline-flex items-center justify-center gap-2 rounded bg-amber-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Replay Shift 6</span>
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0"
              >
                <span>Play Campaign</span>
              </button>
              <button
                type="button"
                onClick={onReturnToMenu}
                className="inline-flex items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0"
              >
                <Home className="h-4 w-4" />
                <span>Main Menu</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 p-6">
        <div className="w-full max-w-md rounded border border-emerald-900/70 bg-zinc-950 p-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-emerald-400">
            DAY 5 COMPLETE · DAWN SECURED
          </p>
          <h2 className="font-display mt-2 text-4xl font-bold tracking-tight text-zinc-100">
            School Protected
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            You survived all 5 days at Midnight Public School, safeguarding students and staff from
            the infiltrators.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-zinc-800 pt-5 text-xs text-zinc-400 font-mono-tabular">
            <span>Days: 5 / 5</span>
            <span aria-hidden="true">·</span>
            <span>
              Casualties: {hud.casualties} / {hud.maxCasualties}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Strikes: {hud.strikes} / {hud.maxStrikes}
            </span>
            <span aria-hidden="true">·</span>
            <span>Fakes Stopped: {hud.fakesStopped}</span>
          </div>

          <button
            type="button"
            onClick={onRestart}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-400 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
