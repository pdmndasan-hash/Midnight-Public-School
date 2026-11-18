export type GamePhase =
  | 'menu'
  | 'intro'
  | 'arrival'
  | 'classtime'
  | 'hunt'
  | 'cutaway'
  | 'escape_intro'
  | 'escape_play'
  | 'escape_outro'
  | 'kidnapper_cutscene'
  | 'anomaly_mode'
  | 'jumpscare'
  | 'gameover'
  | 'victory';

export type PersonRole = 'student' | 'teacher';

export type RoomId = 'checking' | 'corridor' | 'room101' | 'room102';

export type CctvCamId = 'cam101' | 'cam102' | 'camCorridor';

export type HidingType = 'box' | 'desk' | 'locker';

export type AnomalyCategory =
  | 'none'
  | 'id_name_mismatch'
  | 'id_photo_mismatch'
  | 'id_number_mismatch'
  | 'id_dob_mismatch'
  | 'id_class_subject_mismatch'
  | 'id_school_mismatch'
  | 'scan_extra_bones'
  | 'scan_extra_fingers'
  | 'scan_no_heartbeat'
  | 'scan_unnatural_internal'
  | 'behavior_no_blink'
  | 'behavior_repeating';

export interface CaseLogEntry {
  id: string;
  day: number;
  role: PersonRole;
  officialName: string;
  recordId: string;
  anomalyCategory: AnomalyCategory;
  mismatchType: string;
  mismatchDetails: string;
  presentedSummary: string;
  outcome: 'rejected' | 'tased' | 'banished' | 'locked_down' | 'slipped_past';
}

export type ClassRevealBehavior =
  | 'normal'
  | 'not_blinking'
  | 'not_writing_stare'
  | 'copying_neighbor'
  | 'repeating_loop';

export interface HumanAppearance {
  role: PersonRole;
  skinHex: string;
  hairHex: string;
  hairStyle: 'short_part' | 'long_straight' | 'bun' | 'wavy_bob';
  eyeHex: string;
  uniformHex: string;
  tieHex: string;
  glasses: boolean;
  scarf: boolean;
  freckles: boolean;
  tiredDarkCircles: boolean;
  sweating: boolean;
  mustache?: boolean;
  guardCap?: boolean;
  hasTaserProp?: boolean;
}

export interface SchoolRecordEntry {
  recordId: string; // Roll number (STU-...) or Staff number (STF-...)
  role: PersonRole;
  fullName: string;
  classOrSubject: string; // e.g. "Class 11-B" or "Physics"
  dob: string;
  schoolName: string;
  appearance: HumanAppearance;
}

export interface PresentedIdCard {
  idNumber: string;
  role: PersonRole;
  fullName: string;
  classOrSubject: string;
  dob: string;
  schoolName: string;
  photoAppearance: HumanAppearance;
}

export interface BodyScanData {
  heartbeatBpm: number; // 0 = no heartbeat (anomaly)
  breathingStatus: 'Steady (15/min)' | 'Rapid / Nervous (24/min)' | 'Shallow / Sick (19/min)' | 'None Detected' | 'Erratic (42/min)';
  extraBones: boolean;
  extraFingers: boolean;
  unnaturalInternal: boolean;
}

export interface ArrivalPerson {
  uid: string;
  day: number;
  arrivalOrder: number;
  role: PersonRole;
  isFake: boolean;
  anomalyCategory: AnomalyCategory;
  assignedRoom: 'room101' | 'room102';
  assignedSeatIndex: number;
  officialRecord: SchoolRecordEntry;
  presentedId: PresentedIdCard;
  liveAppearance: HumanAppearance;
  bodyScan: BodyScanData;
  noBlinking: boolean;
  unnaturallyStill: boolean;
  nervousOrSickNote: string | null;
  questionAnswers: [string, string, string];
  classRevealBehavior: ClassRevealBehavior;
  idChangeSummary: string;
}

export interface ActiveClassroomActor {
  uid: string;
  name: string;
  role: PersonRole;
  isFake: boolean;
  room: 'room101' | 'room102' | 'corridor';
  seatIndex: number;
  pos: { x: number; z: number };
  yaw: number;
  state:
    | 'walking_to_seat'
    | 'seated'
    | 'teaching'
    | 'reveal'
    | 'hunting'
    | 'stunned'
    | 'fled'
    | 'victimized';
  taserHits: number;
  revealBehavior: ClassRevealBehavior;
  appearance: HumanAppearance;
}

export interface HidingSpotInfo {
  id: string;
  type: HidingType;
  label: string;
  room: RoomId;
  position: { x: number; y: number; z: number };
  lookYaw: number;
}

export type EscapeStage =
  | 'intro_students'
  | 'intro_anomalies'
  | 'intro_bus'
  | 'lockers'
  | 'lights'
  | 'fire'
  | 'sprint'
  | 'outro_board'
  | 'outro_lookback'
  | 'outro_students'
  | 'outro_title'
  | 'outro_msg1'
  | 'outro_msg2';

export type KidnapperStage =
  | 'roadblock'
  | 'figures'
  | 'van_reveal'
  | 'stinger'
  | 'reveal_end'
  | 'credits_roll';

export type RedeemCodeId = '6754' | 'STPGY' | 'PUPPET777' | 'IMMORTAL999' | 'OWNER2026';

export type NpcBehaviorOverride = 'default' | 'follow' | 'patrol' | 'flee' | 'stand';

export type CharacterTransformTarget =
  | 'original'
  | 'student'
  | 'teacher'
  | 'guard'
  | 'anomaly';

export type BodyguardStance = 'follow' | 'hold';

export type TeleportDestinationId =
  | 'menu'
  | 'entrance'
  | 'checkpoint'
  | 'cctv_desk'
  | 'room101'
  | 'room102'
  | 'shift1'
  | 'shift2'
  | 'shift3'
  | 'shift4'
  | 'shift5'
  | 'shift5_intro'
  | 'shift5_chase'
  | 'shift5_ending'
  | 'ending_screen'
  | 'shift6';

export interface OwnerNpcSummary {
  id: string;
  source: 'classroom' | 'anomaly' | 'arrival' | 'bodyguard' | 'guard';
  name: string;
  roleLabel: string;
  zone: string;
  isFake: boolean;
  frozen: boolean;
  behavior: NpcBehaviorOverride;
  speedMultiplier: number;
  possessed: boolean;
}

export interface CampaignSaveData {
  highestDayReached: number;
  completedCampaign: boolean;
  totalFakesStopped: number;
  shift6Completed: boolean;
  redeemedCodes: RedeemCodeId[];
}

export interface HudSnapshot {
  phase: GamePhase;
  day: number;
  maxDays: number;
  arrivalIndex: number;
  arrivalsToday: number;
  casualties: number;
  maxCasualties: number;
  strikes: number;
  maxStrikes: number;
  taserCharges: number;
  maxTaserCharges: number;
  taserTakenFromRoom: boolean;
  hasTaserInHand: boolean;
  isChargingTaser: boolean;
  taserChargeProgress: number;
  inCheckingRoom: boolean;
  currentRoom: RoomId;
  currentArrival: ArrivalPerson | null;
  records: SchoolRecordEntry[];
  caseLogs: CaseLogEntry[];
  scanCompleted: boolean;
  scanProgress: number;
  askedQuestionIdx: number | null;
  activeOverlay: 'none' | 'id_records' | 'scanner' | 'cctv' | 'case_logs';
  activeCctvCam: CctvCamId;
  cctvAudioMode: 'quiet' | 'class_normal' | 'anomaly_reveal' | 'anomaly_hunt';
  cctvAudioLabel: string;
  cctvActors: ActiveClassroomActor[];
  room101Locked: boolean;
  room102Locked: boolean;
  classTimeLeft: number;
  huntActiveFakes: number;
  isCrouching: boolean;
  isHiding: boolean;
  hidingType: HidingType | null;
  hideTransition: number;
  hiddenDuration: number;
  isMovingWhileHiding: boolean;
  entityNearby: boolean;
  nearbyHidingSpot: { id: string; type: HidingType; label: string } | null;
  pointerLocked: boolean;
  feedbackBanner: { text: string; tone: 'neutral' | 'warning' | 'danger' | 'success' } | null;
  cutawayText: string;
  introCaption: string;
  introProgress: number;
  deathReason: string;
  fakesStopped: number;
  debugVisible: boolean;
  sanity: number;
  sanityState:
    | 'stable'
    | 'recovering'
    | 'darkness'
    | 'anomaly'
    | 'flicker'
    | 'whisper'
    | 'paranormal';
  lightFlickerActive: boolean;
  cctvGlitchPulse: boolean;
  hallucinationFlash: { side: 'left' | 'right'; strength: number } | null;
  corridorFaceFlash: {
    xOffset: number;
    yOffset: number;
    scale: number;
    opacity: number;
    skew: number;
  } | null;
  escapeObjective: string;
  escapeStamina: number;
  escapeDistanceRemaining: number;
  escapePursuerDistance: number;
  escapeStage: EscapeStage;
  escapeOutroCaption: string;
  escapeOutroFade: number;
  kidnapperStage: KidnapperStage;
  kidnapperCaption: string;
  kidnapperSubCaption: string;
  kidnapperFade: number;
  kidnapperCreditsProgress: number;
  canRetryEscape: boolean;
  coronerReport: EscapeCoronerReport | null;
  anomalyCaughtCount: number;
  anomalyGuardsCaught: number;
  anomalyStudentsCaught: number;
  anomalyTotalStudents: number;
  anomalyGuardBossHp: number;
  anomalyGuardBossMaxHp: number;
  anomalyGuardBossAlive: boolean;
  anomalyHp: number;
  anomalyVictory: boolean;
  anomalyShocked: boolean;
  anomalyAbilityCooldown: number;
  anomalyAbilityMaxCooldown: number;
  anomalySurgeActive: boolean;
  anomalyTransforming: boolean;
  anomalyNearbyTarget: { name: string; role: 'guard' | 'student'; panicked: boolean; bossHp?: number } | null;
  schoolEatTarget: { id: string; name: string; role: 'guard' | 'student' | 'teacher' | 'anomaly' } | null;
  // Redeem Codes & Secret Powers
  redeemedCodes: RedeemCodeId[];
  mindControlUnlocked: boolean;
  possessTarget: { id: string; name: string; roleLabel: string } | null;
  possessedNpc: { id: string; name: string; roleLabel: string; timeLeft: number; maxDuration: number; canEat?: boolean } | null;
  possessCooldown: number;
  possessMaxCooldown: number;
  possessRange: number;
  possessDurationConfig: number;
  immortalUnlocked: boolean;
  immortalActive: boolean;
  immortalShieldFlash: number;
  // Ultimate Owner Mode (OWNER2026)
  ownerModeUnlocked: boolean;
  ownerPanelOpen: boolean;
  ownerInvisible: boolean;
  ownerFreecam: boolean;
  ownerNpcsPaused: boolean;
  ownerInfiniteRevives: boolean;
  ownerPlayerSpeed: number;
  ownerPlayerForm: CharacterTransformTarget;
  ownerBodyguardCount: number;
  ownerBodyguardStance: BodyguardStance;
  ownerNpcs: OwnerNpcSummary[];
  // Shift 6
  isShift6: boolean;
  shift6Stage: 'lockdown' | 'banish' | 'escape_gate' | 'completed';
  shift6Objective: string;
  shift6AnomaliesRemaining: number;
  shift6CompletedModal: boolean;
  campaignSave: CampaignSaveData;
}

export interface EscapeCoronerReport {
  caseNumber: string;
  victimName: string;
  victimRole: string;
  timeSurvivedSeconds: number;
  distanceCoveredMeters: number;
  totalEscapeDistanceMeters: number;
  busRemainingMeters: number;
  sectorReached: string;
  captorName: string;
  captorRole: PersonRole;
  captorRecordId: string;
  captorDepartment: string;
  captorAnomalyProfile: string;
  causeOfDeath: string;
}


