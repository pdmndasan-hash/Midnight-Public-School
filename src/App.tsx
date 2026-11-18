/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { EndScreens } from './components/EndScreens';
import { HudOverlay } from './components/HudOverlay';
import { IntroOverlay } from './components/IntroOverlay';
import { OwnerControlPanel } from './components/OwnerControlPanel';
import { GameEngine } from './game/GameEngine';
import { HudSnapshot } from './types/game';

const INITIAL_HUD: HudSnapshot = {
  phase: 'menu',
  day: 1,
  maxDays: 5,
  arrivalIndex: 1,
  arrivalsToday: 4,
  casualties: 0,
  maxCasualties: 3,
  strikes: 0,
  maxStrikes: 3,
  taserCharges: 4,
  maxTaserCharges: 4,
  taserTakenFromRoom: false,
  hasTaserInHand: false,
  isChargingTaser: false,
  taserChargeProgress: 0,
  inCheckingRoom: true,
  currentRoom: 'checking',
  currentArrival: null,
  records: [],
  caseLogs: [],
  scanCompleted: false,
  scanProgress: 0,
  askedQuestionIdx: null,
  activeOverlay: 'none',
  activeCctvCam: 'cam101',
  cctvAudioMode: 'quiet',
  cctvAudioLabel: '',
  cctvActors: [],
  room101Locked: false,
  room102Locked: false,
  classTimeLeft: 0,
  huntActiveFakes: 0,
  isCrouching: false,
  isHiding: false,
  hidingType: null,
  hideTransition: 0,
  hiddenDuration: 0,
  isMovingWhileHiding: false,
  entityNearby: false,
  nearbyHidingSpot: null,
  pointerLocked: false,
  feedbackBanner: null,
  cutawayText: '',
  introCaption: '',
  introProgress: 0,
  deathReason: '',
  fakesStopped: 0,
  debugVisible: false,
  sanity: 100,
  sanityState: 'stable',
  lightFlickerActive: false,
  cctvGlitchPulse: false,
  hallucinationFlash: null,
  corridorFaceFlash: null,
  escapeObjective: '',
  escapeStamina: 100,
  escapeDistanceRemaining: 0,
  escapePursuerDistance: 0,
  escapeStage: 'intro_students',
  escapeOutroCaption: '',
  escapeOutroFade: 0,
  kidnapperStage: 'roadblock',
  kidnapperCaption: '',
  kidnapperSubCaption: '',
  kidnapperFade: 0,
  kidnapperCreditsProgress: 0,
  canRetryEscape: false,
  coronerReport: null,
  anomalyCaughtCount: 0,
  anomalyGuardsCaught: 0,
  anomalyStudentsCaught: 0,
  anomalyTotalStudents: 20,
  anomalyGuardBossHp: 100,
  anomalyGuardBossMaxHp: 100,
  anomalyGuardBossAlive: true,
  anomalyHp: 100,
  anomalyVictory: false,
  anomalyShocked: false,
  anomalyAbilityCooldown: 0,
  anomalyAbilityMaxCooldown: 8,
  anomalySurgeActive: false,
  anomalyTransforming: false,
  anomalyNearbyTarget: null,
  schoolEatTarget: null,
  redeemedCodes: [],
  mindControlUnlocked: false,
  possessTarget: null,
  possessedNpc: null,
  possessCooldown: 0,
  possessMaxCooldown: 6,
  possessRange: 12,
  possessDurationConfig: 25,
  immortalUnlocked: false,
  immortalActive: false,
  immortalShieldFlash: 0,
  ownerModeUnlocked: false,
  ownerPanelOpen: false,
  ownerInvisible: false,
  ownerFreecam: false,
  ownerNpcsPaused: false,
  ownerInfiniteRevives: false,
  ownerPlayerSpeed: 1.0,
  ownerPlayerForm: 'original',
  ownerBodyguardCount: 0,
  ownerBodyguardStance: 'follow',
  ownerNpcs: [],
  isShift6: false,
  shift6Stage: 'lockdown',
  shift6Objective: '',
  shift6AnomaliesRemaining: 0,
  shift6CompletedModal: false,
  campaignSave: {
    highestDayReached: 1,
    completedCampaign: false,
    totalFakesStopped: 0,
    shift6Completed: false,
    redeemedCodes: [],
  },
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GameEngine(container, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  };

  const handleSpeakIntroLine = useCallback((line: string) => {
    engineRef.current?.speakIntroLine(line);
  }, []);

  const handleStopIntroSpeech = useCallback(() => {
    engineRef.current?.stopIntroSpeech();
  }, []);

  const showActiveHud =
    hud.phase === 'arrival' ||
    hud.phase === 'classtime' ||
    hud.phase === 'hunt' ||
    hud.phase === 'cutaway' ||
    hud.phase === 'escape_intro' ||
    hud.phase === 'escape_play' ||
    hud.phase === 'escape_outro' ||
    hud.phase === 'kidnapper_cutscene' ||
    hud.phase === 'anomaly_mode';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#07080a]">
      {/* Isolated WebGL Viewport */}
      <div
        ref={mountRef}
        className="h-full w-full"
      />

      {/* Intro Cutscene Overlay */}
      {hud.phase === 'intro' && (
        <IntroOverlay
          caption={hud.introCaption}
          progress={hud.introProgress}
          muted={muted}
          onSpeakLine={handleSpeakIntroLine}
          onStopSpeech={handleStopIntroSpeech}
          onSkip={() => engineRef.current?.skipIntro()}
        />
      )}

      {/* Active Checkpoint, Class Time, CCTV, Hunt & Shift 5 Escape HUD */}
      {showActiveHud && (
        <HudOverlay
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onSetOverlay={(overlay) => engineRef.current?.setOverlay(overlay)}
          onSetCctvCam={(cam) => engineRef.current?.setCctvCam(cam)}
          onStartScan={() => engineRef.current?.startBodyScan()}
          onAskQuestion={(idx) => engineRef.current?.askQuestion(idx)}
          onAllow={() => engineRef.current?.decideAllow()}
          onReject={() => engineRef.current?.decideReject()}
          onToggleTaserEquip={() => engineRef.current?.toggleTaserEquip()}
          onFireTaser={() => engineRef.current?.fireTaserShot()}
          onToggleLockdown={(room) => engineRef.current?.toggleLockdown(room)}
          onToggleHide={() => engineRef.current?.toggleHide()}
          onToggleCrouch={() => engineRef.current?.toggleCrouch()}
          onLockPointer={() => engineRef.current?.requestPointerLock()}
          onReturnToMenu={() => engineRef.current?.returnToMainMenu()}
          onRestartCampaign={() => engineRef.current?.startNewCampaign()}
          onTriggerWhoThem={() => engineRef.current?.startKidnapperCutscene()}
          onSkipCredits={() => engineRef.current?.skipCreditsRoll()}
          onReplayCredits={() => engineRef.current?.replayCreditsRoll()}
          onAnomalyHunt={() => engineRef.current?.triggerAnomalyCatchAttempt()}
          onAnomalySurge={() => engineRef.current?.triggerAnomalySurge()}
          onRetryAnomaly={() => engineRef.current?.triggerAnomalyMode()}
          onDismissAnomalyVictory={() => engineRef.current?.dismissAnomalyVictory()}
          onPossessTarget={() => engineRef.current?.possessTargetedNpc()}
          onReleasePossession={() => engineRef.current?.releasePossession()}
          onPossessedAction={() => engineRef.current?.firePossessedNpcAction()}
          onCyclePossessed={(dir) => engineRef.current?.cyclePossessedNpc(dir)}
          onToggleImmortal={(active) => engineRef.current?.setImmortalActive(active)}
          onOpenOwnerPanel={() => engineRef.current?.toggleOwnerPanel(true)}
        />
      )}

      {/* Menu, Jumpscare, Game Over & Victory Overlays */}
      <EndScreens
        hud={hud}
        onStartIntro={() => engineRef.current?.startIntro()}
        onRestart={() => engineRef.current?.startNewCampaign()}
        onRetryEscape={() => engineRef.current?.retryEscapeChase()}
        onReturnToMenu={() => engineRef.current?.returnToMainMenu()}
        onMenuClick={() => engineRef.current?.playMenuClick()}
        onRedeemCode={(raw) =>
          engineRef.current
            ? engineRef.current.redeemSecretCode(raw)
            : { ok: false, lines: ['Game engine not ready.'] }
        }
        onTriggerShift5Ending={() => engineRef.current?.triggerShift5Ending()}
        onTriggerAnomalyMode={() => engineRef.current?.triggerAnomalyMode()}
        onOpenOwnerPanel={() => engineRef.current?.toggleOwnerPanel(true)}
        onToggleImmortal={(active) => engineRef.current?.setImmortalActive(active)}
        onStartShift6={() => engineRef.current?.startShift6()}
      />

      {/* Ultimate Owner Mode Control Panel (OWNER2026) */}
      {hud.ownerModeUnlocked && hud.ownerPanelOpen && (
        <OwnerControlPanel
          hud={hud}
          onClose={() => engineRef.current?.toggleOwnerPanel(false)}
          onToggleImmortal={(active) => engineRef.current?.setImmortalActive(active)}
          onToggleInfiniteRevives={() => engineRef.current?.toggleInfiniteRevives()}
          onRestoreHealth={() => engineRef.current?.ownerRestoreHealth()}
          onRestoreSanity={() => engineRef.current?.ownerRestoreSanity()}
          onToggleInvisibility={() => engineRef.current?.toggleOwnerInvisibility()}
          onToggleFreecam={() => engineRef.current?.toggleOwnerFreecam()}
          onToggleNpcsPaused={() => engineRef.current?.toggleOwnerNpcsPaused()}
          onCompleteObjective={() => engineRef.current?.ownerCompleteObjective()}
          onRestartShift={() => engineRef.current?.ownerRestartCurrentShift()}
          onReturnToMenu={() => engineRef.current?.returnToMainMenu()}
          onResetOwnerTemp={() => engineRef.current?.resetOwnerTemporaryState()}
          onSetPossessConfig={(range, duration) =>
            engineRef.current?.setPossessConfig(range, duration)
          }
          onPossessNpc={(id) => engineRef.current?.possessNpcById(id)}
          onReleasePossession={() => engineRef.current?.releasePossession()}
          onCyclePossessed={(dir) => engineRef.current?.cyclePossessedNpc(dir)}
          onTeleportNpc={(id, zone) => engineRef.current?.teleportNpcToZone(id, zone)}
          onToggleNpcFreeze={(id) => engineRef.current?.toggleNpcFreeze(id)}
          onSetNpcBehavior={(id, behavior) => engineRef.current?.setNpcBehavior(id, behavior)}
          onSetNpcSpeed={(id, mult) => engineRef.current?.setOwnerNpcSpeed(id, mult)}
          onTransformNpc={(id, target) => engineRef.current?.transformNpc(id, target)}
          onTransformPlayer={(target) => engineRef.current?.transformPlayer(target)}
          onSpawnNpc={(role) => engineRef.current?.spawnOwnerNpc(role)}
          onDespawnNpc={(id) => engineRef.current?.despawnOwnerNpc(id)}
          onSetPlayerSpeed={(mult) => engineRef.current?.setOwnerPlayerSpeed(mult)}
          onSummonBodyguards={(count) => engineRef.current?.summonBodyguards(count)}
          onSetBodyguardStance={(stance) => engineRef.current?.setBodyguardStance(stance)}
          onRecallBodyguards={() => engineRef.current?.recallBodyguards()}
          onDismissBodyguards={() => engineRef.current?.dismissBodyguards()}
          onUnstuckBodyguards={() => engineRef.current?.unstuckBodyguards()}
          onTeleportTo={(dest) => engineRef.current?.teleportToDestination(dest)}
          onStartShift6={() => engineRef.current?.startShift6()}
          onTriggerAnomalyMode={() => engineRef.current?.triggerAnomalyMode()}
          onTriggerWhoThem={() => engineRef.current?.startKidnapperCutscene()}
          onTriggerShift6Ending={() => engineRef.current?.triggerShift6Ending()}
        />
      )}
    </div>
  );
}
