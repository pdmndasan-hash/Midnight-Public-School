import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ActiveClassroomActor,
  AnomalyCategory,
  ArrivalPerson,
  BodyguardStance,
  CampaignSaveData,
  CaseLogEntry,
  CctvCamId,
  CharacterTransformTarget,
  EscapeCoronerReport,
  EscapeStage,
  GamePhase,
  HidingSpotInfo,
  HudSnapshot,
  KidnapperStage,
  NpcBehaviorOverride,
  OwnerNpcSummary,
  RedeemCodeId,
  RoomId,
  SchoolRecordEntry,
  TeleportDestinationId,
} from '../types/game';
import { HorrorAudioEngine } from './audio';
import {
  AnomalyNpc,
  findNearestNavNode,
  findNextHopBfs,
  GUARD_PATROL_ROUTE,
  SCHOOL_NAV_NODES,
  spawnAnomalyModeNpc,
  traceBossLineOfSight,
  updateAnomalyModeNpcs,
} from './anomalyMode';
import {
  buildCheckpointSchoolWorld,
  CheckpointWorldObjects,
  ROOM101_SEATS,
  ROOM102_SEATS,
} from './checkpointWorld';
import { generateFiveDayCampaign } from './databaseGenerator';
import { buildShift5EscapeWorld, EscapeWorldObjects } from './escapeWorld';
import { buildKidnapperCutsceneWorld, KidnapperCutsceneWorld } from './kidnapperCutscene';
import {
  createRealisticHuman,
  HumanActorRig,
  StudentClassAction,
  TeacherClassAction,
} from './humanBuilder';
import { createHumanRealismTextures, HumanSkinTextures } from './humanTextures';
import {
  buildTransformedAppearance,
  createPossessTargetOutline,
  findClosestSafeNavNode,
  FriendlyBodyguard,
  movePointWithSchoolCollisions,
  spawnBodyguardUnit,
  updateBodyguards,
  VALID_SCHOOL_TELEPORT_SPOTS,
} from './ownerAndPowers';
import { loadCampaignSave, normalizeRedeemCode, REDEEM_CODE_REGISTRY, saveCampaignProgress } from './redeemCodes';
import { createSchoolTextures, renderTvBroadcastCanvas, SchoolTextureSet } from './textures';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

const MAX_DAYS = 5;
const MAX_STRIKES = 3;
const MAX_CASUALTIES = 3;
const EYE_HEIGHT = 1.65;
const CROUCH_EYE_HEIGHT = 0.96;
const PLAYER_RADIUS = 0.34;
const WALK_SPEED = 3.5;
const CROUCH_SPEED = 1.75;
const SPRINT_SPEED = 5.2;

const HUNT_WAYPOINTS = [
  new THREE.Vector3(6.2, 0, 9.6),   // Room 101
  new THREE.Vector3(0.2, 0, 9.6),   // Corridor @ 101
  new THREE.Vector3(0.2, 0, 18.0),  // Corridor @ 102
  new THREE.Vector3(6.2, 0, 18.0),  // Room 102
  new THREE.Vector3(0.2, 0, 4.2),   // Corridor North
];

interface LiveActorSlot {
  data: ActiveClassroomActor;
  rig: HumanActorRig;
  seatWaypoints: THREE.Vector3[];
  targetSeatYaw: number;
  seatedTime: number;
  phaseOffset: number;
  studentAction: StudentClassAction;
  studentActionTimer: number;
  teacherAction: TeacherClassAction;
  teacherActionTimer: number;
  teacherPatrolIdx: number;
  stunTimer: number;
  searchTimer: number;
  passCooldown: number;
  closeToHiddenTimer: number;
  willLinger: boolean;
  discoveryCheckAccum: number;
  attackTimer: number;
  waypointIdx: number;
  noiseTarget: THREE.Vector3 | null;
  frozen?: boolean;
  possessed?: boolean;
  behaviorOverride?: NpcBehaviorOverride;
  speedMultiplier?: number;
  transformedAs?: CharacterTransformTarget;
  originalAppearance?: ActiveClassroomActor['appearance'];
  originalIsFake?: boolean;
  prePossessState?: ActiveClassroomActor['state'];
  targetSeatPos?: THREE.Vector3;
}

interface SchoolGuardNpcState {
  id: string;
  rig: HumanActorRig;
  x: number;
  z: number;
  yaw: number;
  currentNode: number;
  targetNode: number;
  patrolIdx: number;
  state: 'checkpoint' | 'patrol' | 'chase' | 'taser_aim' | 'stunned';
  pauseTimer: number;
  taserCooldown: number;
  taserAimTimer: number;
  stunTimer: number;
  stuckTimer: number;
  lastCheckX: number;
  lastCheckZ: number;
  aimTargetUid: string | null;
  frozen: boolean;
  behaviorOverride: NpcBehaviorOverride;
  speedMultiplier: number;
  formKey: string;
}

interface DepartingActor {
  rig: HumanActorRig;
  x: number;
  z: number;
  timer: number;
}

export class GameEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private audio = new HorrorAudioEngine();
  private textures: SchoolTextureSet;
  private skinTextures: HumanSkinTextures;
  private world: CheckpointWorldObjects;
  private escapeWorld: EscapeWorldObjects;
  private arrivalRig: HumanActorRig;
  private guardNpc: SchoolGuardNpcState;
  private actorSlots: LiveActorSlot[] = [];
  private departingActors: DepartingActor[] = [];
  private escapeStudents: { rig: HumanActorRig; startZ: number; laneX: number; delay: number; boarded: boolean }[] = [];
  private escapePursuers: {
    rig: HumanActorRig;
    laneX: number;
    z: number;
    speed: number;
    lagOffset: number;
    record?: SchoolRecordEntry;
  }[] = [];
  private escapeBusPassengers: {
    rig: HumanActorRig;
    action: StudentClassAction;
    phase: number;
    isDriver?: boolean;
  }[] = [];
  private kidnapperWorld: KidnapperCutsceneWorld;
  private kidnapperBusPassengers: {
    rig: HumanActorRig;
    action: StudentClassAction;
    phase: number;
    isDriver?: boolean;
  }[] = [];

  private flashlight: THREE.SpotLight;
  private jumpscareLight: THREE.SpotLight;
  private cctvCameras: Record<CctvCamId, THREE.PerspectiveCamera>;
  private cctvTargets: Record<CctvCamId, THREE.WebGLRenderTarget>;
  private cctvFrameCounter = 0;

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private totalTime = 0;

  // Campaign State
  private phase: GamePhase = 'menu';
  private day = 1;
  private records: SchoolRecordEntry[] = [];
  private campaignDays: ArrivalPerson[][] = [];
  private arrivalIdx = 0; // 0..2 within current day
  private todayAdmitted: ArrivalPerson[] = [];
  private caseLogs: CaseLogEntry[] = [];
  private loggedCaseUids = new Set<string>();

  private casualties = 0;
  private strikes = 0;
  private fakesStopped = 0;
  private deathReason = '';

  // Taser & Checkpoint UI State
  private taserCharges = 4;
  private maxTaserCharges = 4;
  private taserTakenFromRoom = false;
  private hasTaserInHand = false;
  private isChargingTaser = false;
  private taserChargeProgress = 0;
  private taserFlashTimer = 0;
  private taserBeamMesh: THREE.Mesh;
  private taserBeamMat: THREE.MeshBasicMaterial;
  private handTaserGroup: THREE.Group;
  private handTaserTipMat: THREE.MeshStandardMaterial;
  private scanCompleted = false;
  private scanning = false;
  private scanProgress = 0;
  private askedQuestionIdx: number | null = null;
  private activeOverlay: HudSnapshot['activeOverlay'] = 'none';
  private activeCctvCam: CctvCamId = 'cam101';
  private gateOpenTimer = 0;

  // Lockdown & Class Time
  private room101Locked = false;
  private room102Locked = false;
  private classTimer = 0;
  private classObservationTimer = 0;
  private cutawayTimer = 0;
  private cutawayText = '';

  // Intro
  private introTimer = 0;
  private introGlitched = false;
  private introChimePlayed = false;

  // Player
  private playerPos = new THREE.Vector3(-0.35, EYE_HEIGHT, -0.55);
  private currentEyeHeight = EYE_HEIGHT;
  private isCrouching = false;
  private yaw = 0.08;
  private pitch = -0.04;
  private walkBobPhase = 0;
  private stepDistAccum = 0;
  private keys: Record<string, boolean> = {};
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Shift 5 Final Escape State
  private escapeStage: EscapeStage = 'intro_students';
  private escapeCutsceneTimer = 0;
  private escapeStamina = 100;
  private escapePlayerY = 0;
  private escapeJumpVel = 0;
  private escapeGrounded = true;
  private escapeStaggerTimer = 0;
  private escapeCameraShake = 0;
  private escapePursuerZ = -3.0;
  private escapeBusOffsetZ = 0;
  private escapeOutroCaption = '';
  private escapeOutroFade = 0;
  private escapeOutroBusPlayed = false;
  private escapeFootstepCuePlayed = false;
  private escapeIntroAudioAccum = 0.18;
  private escapeIntroAudioIdx = 0;
  private escapeSurvivalTime = 0;
  private canRetryEscape = false;
  private escapeHitCooldown = 0;
  private coronerReport: EscapeCoronerReport | null = null;

  // "Who Them?" School Kid Kidnappers Cutscene & Credit Roll State
  private kidnapperStage: KidnapperStage = 'roadblock';
  private kidnapperTimer = 0;
  private kidnapperCaption = '';
  private kidnapperSubCaption = '';
  private kidnapperFade = 0;
  private kidnapperCreditsProgress = 0;
  private kidnapperCreditsChordPlayed = false;
  private kidnapperCuesPlayed = { chord1: false, chord2: false, slam: false };

  // Secret Anomaly Mode (Code: STPGY)
  private anomalyHandsGroup: THREE.Group;
  private anomalyNpcs: AnomalyNpc[] = [];
  private anomalyCaughtCount = 0;
  private anomalyGuardsCaught = 0;
  private anomalyStudentsCaught = 0;
  private readonly anomalyTotalStudents = 20;
  private anomalyGuardBossHp = 100;
  private readonly anomalyGuardBossMaxHp = 100;
  private anomalyGuardBossAlive = true;
  private anomalyHp = 100;
  private anomalyVictory = false;
  private anomalyShockTimer = 0;
  private anomalyAbilityCooldown = 0;
  private readonly anomalyAbilityMaxCooldown = 8.0;
  private anomalySurgeTimer = 0;
  private anomalyTransformTimer = 0;
  private anomalyLungeTimer = 0;
  private anomalySavedDay = 1;
  private anomalySavedSanity = 100;
  private anomalySavedStrikes = 0;
  private anomalySavedCasualties = 0;

  // Persistent Campaign Save (isolated from Owner Mode temporary overrides)
  private campaignSave: CampaignSaveData = loadCampaignSave();
  private redeemedCodes: RedeemCodeId[] = [];

  // Code PUPPET777: NPC Mind Control
  private mindControlUnlocked = false;
  private possessTargetOutline: THREE.Group;
  private possessTargetInfo: { id: string; name: string; roleLabel: string } | null = null;
  private possessedNpcId: string | null = null;
  private possessedNpcSource: 'anomaly' | 'classroom' | null = null;
  private possessedNpcName = '';
  private possessedNpcRoleLabel = '';
  private possessTimeLeft = 0;
  private possessDurationConfig = 25;
  private possessCooldown = 0;
  private readonly possessMaxCooldown = 6.0;
  private possessRange = 12.0;
  private prePossessPos = new THREE.Vector3();
  private prePossessYaw = 0;
  private prePossessPitch = 0;
  private prePossessEyeHeight = 1.82;
  private hasPrePossessAnchor = false;

  // Code IMMORTAL999: Immortality
  private immortalUnlocked = false;
  private immortalActive = false;
  private immortalShieldFlash = 0;

  // Code OWNER2026: Ultimate Owner Mode
  private ownerModeUnlocked = false;
  private ownerPanelOpen = false;
  private ownerInvisible = false;
  private ownerFreecam = false;
  private freecamPos = new THREE.Vector3();
  private ownerNpcsPaused = false;
  private ownerInfiniteRevives = false;
  private ownerPlayerSpeed = 1.0;
  private ownerPlayerForm: CharacterTransformTarget = 'original';
  private ownerBodyguards: FriendlyBodyguard[] = [];
  private ownerBodyguardStance: BodyguardStance = 'follow';
  private ownerSpawnedSeq = 0;

  // Shift 6 (Secret Owner Breach Protocol)
  private isShift6 = false;
  private shift6Stage: 'lockdown' | 'banish' | 'escape_gate' | 'completed' = 'lockdown';
  private shift6CompletedModal = false;

  // Hiding & Jumpscare
  private activeHidingSpot: HidingSpotInfo | null = null;
  private hideExitPos = new THREE.Vector3(-0.35, EYE_HEIGHT, -0.55);
  private hideStartEyeHeight = EYE_HEIGHT;
  private hideTransition = 0;
  private hiddenDuration = 0;
  private hidingMoveNoise = 0;
  private hidingWarningShown = false;
  private jumpscareActor: LiveActorSlot | null = null;
  private jumpscareRig: HumanActorRig | null = null;
  private jumpscareTimer = 0;
  private feedbackBanner: HudSnapshot['feedbackBanner'] = null;
  private feedbackTimer = 0;
  private hudEmitAccum = 0;
  private debugVisible = false;

  // Sanity & Hallucinations
  private sanity = 100;
  private sanityState: HudSnapshot['sanityState'] = 'stable';
  private whisperDrainTimer = 0;
  private whisperCooldownTimer = 0;
  private paranormalDrainTimer = 0;
  private paranormalCooldownTimer = 0;
  private flickerEventTimer = 0;
  private flickerCooldownTimer = 10.0;
  private deskRecoveredAmount = 0;
  private hallucinationFlash: HudSnapshot['hallucinationFlash'] = null;
  private hallucinationFlashTimer = 0;
  private nextHallucinationDelay = 5.5;
  private shadowHallucinationGroup: THREE.Group;
  private shadowHallucinationMat: THREE.MeshBasicMaterial;
  private shadow3dTimer = 0;
  private faceHallucinationGroup: THREE.Group;
  private faceHallucinationMat: THREE.MeshBasicMaterial;
  private corridorFaceTimer = 0;
  private nextCorridorFaceDelay = 5.0;
  private corridorFaceFlash: HudSnapshot['corridorFaceFlash'] = null;
  private corridorFaceFlashTimer = 0;
  private bbHallucinationRoom: 'room101' | 'room102' | null = null;
  private bbHallucinationIdx = 0;
  private bbHallucinationTimer = 0;
  private nextBbHallucinationDelay = 6.0;
  private cctvGlitchPulseTimer = 0;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.35));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050709);
    this.scene.fog = new THREE.FogExp2(0x06080a, 0.048);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.25;
    pmremGenerator.dispose();

    const hemi = new THREE.HemisphereLight(0x2a3748, 0x161412, 0.48);
    this.scene.add(hemi);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, w / h, 0.08, 220);
    this.scene.add(this.camera);

    // First-person 3D Hand + Electric Taser Gun held in lower right when equipped
    this.handTaserGroup = new THREE.Group();
    this.handTaserGroup.position.set(0.21, -0.17, -0.4);
    this.handTaserGroup.rotation.set(0.08, -0.12, 0.04);
    const htSleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.044, 0.24, 10),
      new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.85 }),
    );
    htSleeve.rotation.x = Math.PI / 2 - 0.12;
    htSleeve.position.set(0.01, -0.1, 0.16);
    const htHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.062, 0.085),
      new THREE.MeshStandardMaterial({ color: 0xb98c70, roughness: 0.65 }),
    );
    htHand.position.set(0, -0.055, 0.05);
    const htBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.088, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.32, metalness: 0.18 }),
    );
    const htBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.75 }),
    );
    htBarrel.rotation.x = Math.PI / 2;
    htBarrel.position.set(0, 0.015, -0.14);
    const htGrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.056, 0.11, 0.068),
      new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.65 }),
    );
    htGrip.position.set(0, -0.075, 0.055);
    htGrip.rotation.x = 0.22;
    this.handTaserTipMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });
    const htProngL = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.02, 0.048), this.handTaserTipMat);
    htProngL.position.set(-0.019, 0.015, -0.205);
    const htProngR = htProngL.clone();
    htProngR.position.set(0.019, 0.015, -0.205);
    this.handTaserGroup.add(htSleeve, htHand, htBody, htBarrel, htGrip, htProngL, htProngR);
    this.handTaserGroup.visible = false;
    this.camera.add(this.handTaserGroup);

    // First-person Shadow Anomaly Claws (visible only in Secret Anomaly Mode)
    this.anomalyHandsGroup = new THREE.Group();
    const clawSkinMat = new THREE.MeshStandardMaterial({
      color: 0x16090b,
      roughness: 0.55,
      metalness: 0.15,
      emissive: 0x3a0709,
      emissiveIntensity: 0.45,
    });
    const clawTipMat = new THREE.MeshStandardMaterial({
      color: 0x090405,
      roughness: 0.3,
      metalness: 0.45,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.35,
    });
    [-1, 1].forEach((side) => {
      const armGrp = new THREE.Group();
      armGrp.position.set(side * 0.27, -0.22, -0.36);
      armGrp.rotation.set(0.18, -side * 0.2, side * 0.14);
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, 0.28, 8), clawSkinMat);
      forearm.rotation.x = Math.PI / 2;
      forearm.position.set(0, -0.04, 0.12);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.044, 0.095), clawSkinMat);
      palm.position.set(0, -0.01, -0.03);
      armGrp.add(forearm, palm);
      for (let f = -1; f <= 1; f++) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.125, 6), clawTipMat);
        finger.rotation.x = -Math.PI / 2 - 0.18;
        finger.position.set(f * 0.024, -0.005, -0.12);
        armGrp.add(finger);
      }
      this.anomalyHandsGroup.add(armGrp);
    });
    this.anomalyHandsGroup.visible = false;
    this.camera.add(this.anomalyHandsGroup);

    // Visible 3D electric beam when firing the one-shot electric gun
    this.taserBeamMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.taserBeamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.012, 1, 8),
      this.taserBeamMat,
    );
    this.taserBeamMesh.visible = false;
    this.scene.add(this.taserBeamMesh);

    this.flashlight = new THREE.SpotLight(0xfff1dc, 4.4, 24, Math.PI * 0.25, 0.65, 1.4);
    this.flashlight.castShadow = !this.isSoftwareGl;
    this.flashlight.shadow.mapSize.set(512, 512);
    this.flashlight.shadow.bias = -0.0005;
    this.scene.add(this.flashlight, this.flashlight.target);

    this.jumpscareLight = new THREE.SpotLight(0xff2a22, 0, 8, Math.PI * 0.44, 0.4, 1.2);
    this.jumpscareLight.visible = false;
    this.scene.add(this.jumpscareLight, this.jumpscareLight.target);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createSchoolTextures(maxAniso);
    this.skinTextures = createHumanRealismTextures(maxAniso);
    this.world = buildCheckpointSchoolWorld(this.textures, maxAniso, this.isSoftwareGl);
    this.escapeWorld = buildShift5EscapeWorld(this.textures, this.isSoftwareGl);
    this.kidnapperWorld = buildKidnapperCutsceneWorld(this.isSoftwareGl);
    this.arrivalRig = createRealisticHuman(this.skinTextures);
    this.arrivalRig.root.position.set(-0.55, 0, -3.55);

    // Persistent Security Guard NPC body (remains visible & AI-driven during possession in school phases)
    const guardRig = createRealisticHuman(this.skinTextures);
    const guardInitApp = buildTransformedAppearance('guard');
    guardRig.configure(guardInitApp.appearance, false);
    guardRig.root.scale.set(1.06, 1.06, 1.06);
    guardRig.root.position.set(-0.35, 0, -0.55);
    guardRig.root.rotation.y = 0.08 + Math.PI;
    guardRig.root.visible = false;
    guardRig.root.traverse((obj) => {
      obj.layers.set(1);
    });
    this.guardNpc = {
      id: 'school_security_guard',
      rig: guardRig,
      x: -0.35,
      z: -0.55,
      yaw: 0.08 + Math.PI,
      currentNode: 0,
      targetNode: 1,
      patrolIdx: 0,
      state: 'checkpoint',
      pauseTimer: 0,
      taserCooldown: 0,
      taserAimTimer: 0,
      stunTimer: 0,
      stuckTimer: 0,
      lastCheckX: -0.35,
      lastCheckZ: -0.55,
      aimTargetUid: null,
      frozen: false,
      behaviorOverride: 'default',
      speedMultiplier: 1.0,
      formKey: 'guard:true',
    };

    this.scene.add(
      this.world.introGroup,
      this.world.schoolGroup,
      this.escapeWorld.escapeGroup,
      this.kidnapperWorld.group,
      this.arrivalRig.root,
      this.guardNpc.rig.root,
    );
    this.world.introGroup.visible = true;
    this.world.schoolGroup.visible = false;
    this.escapeWorld.escapeGroup.visible = false;
    this.kidnapperWorld.group.visible = false;
    this.arrivalRig.root.visible = false;

    // Fleeting peripheral shadow hallucination silhouette
    this.shadowHallucinationMat = new THREE.MeshBasicMaterial({
      color: 0x050608,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.shadowHallucinationGroup = new THREE.Group();
    const sTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 1.48, 10),
      this.shadowHallucinationMat,
    );
    sTorso.position.y = 0.74;
    const sHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 10, 10),
      this.shadowHallucinationMat,
    );
    sHead.position.y = 1.62;
    this.shadowHallucinationGroup.add(sTorso, sHead);
    this.shadowHallucinationGroup.visible = false;
    this.scene.add(this.shadowHallucinationGroup);

    // Brief distorted pale face hallucination in school corridors at critically low sanity
    this.faceHallucinationMat = new THREE.MeshBasicMaterial({
      map: this.textures.distortedFaceMap,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.faceHallucinationGroup = new THREE.Group();
    const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.04), this.faceHallucinationMat);
    this.faceHallucinationGroup.add(facePlane);
    this.faceHallucinationGroup.visible = false;
    this.scene.add(this.faceHallucinationGroup);

    // Mind Control 3D target selection outline ring + aura
    this.possessTargetOutline = createPossessTargetOutline();
    this.scene.add(this.possessTargetOutline);

    // Restore previously redeemed non-owner codes from campaign save; OWNER2026 is strictly session-only
    this.redeemedCodes = this.campaignSave.redeemedCodes.filter((c) => c !== 'OWNER2026');
    if (this.redeemedCodes.includes('PUPPET777')) this.mindControlUnlocked = true;
    if (this.redeemedCodes.includes('IMMORTAL999')) {
      this.immortalUnlocked = true;
      this.immortalActive = true;
    }
    this.ownerModeUnlocked = false;

    const aspect = w / h;
    const cam101 = new THREE.PerspectiveCamera(64, aspect, 0.1, 40);
    cam101.position.set(3.1, 2.84, 6.45);
    cam101.lookAt(7.4, 1.18, 9.45);
    cam101.layers.enable(1);

    const cam102 = new THREE.PerspectiveCamera(64, aspect, 0.1, 40);
    cam102.position.set(3.1, 2.84, 14.85);
    cam102.lookAt(7.4, 1.18, 17.85);
    cam102.layers.enable(1);

    const camCorridor = new THREE.PerspectiveCamera(64, aspect, 0.1, 45);
    camCorridor.position.set(-1.95, 2.84, 2.65);
    camCorridor.lookAt(0.2, 0.95, 13.5);
    camCorridor.layers.enable(1);

    this.cctvCameras = { cam101, cam102, camCorridor };

    const rtW = this.isSoftwareGl ? 128 : 192;
    const rtH = this.isSoftwareGl ? 96 : 144;
    const makeRt = () =>
      new THREE.WebGLRenderTarget(rtW, rtH, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        colorSpace: THREE.NoColorSpace,
      });
    this.cctvTargets = {
      cam101: makeRt(),
      cam102: makeRt(),
      camCorridor: makeRt(),
    };
    this.world.cctvScreenMats.cam101.map = this.cctvTargets.cam101.texture;
    this.world.cctvScreenMats.cam102.map = this.cctvTargets.cam102.texture;
    this.world.cctvScreenMats.camCorridor.map = this.cctvTargets.camCorridor.texture;

    this.camera.position.set(0, 1.25, 0.15);
    this.camera.lookAt(0, 1.12, -1.65);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud();
    this.tick();
  }

  // =========================================================================
  // PUBLIC CONTROLS
  // =========================================================================
  public speakIntroLine(line: string): void {
    this.audio.speakNewsLine(line);
  }

  public stopIntroSpeech(): void {
    this.audio.stopNewsBroadcast();
  }

  public startIntro(): void {
    this.audio.unlock();
    this.audio.primeNewsVoice();
    this.audio.stopNewsBroadcast();
    this.phase = 'intro';
    this.introTimer = 0;
    this.introGlitched = false;
    this.introChimePlayed = false;
    this.canRetryEscape = false;
    this.coronerReport = null;
    this.world.introGroup.visible = true;
    this.world.schoolGroup.visible = false;
    this.escapeWorld.escapeGroup.visible = false;
    this.kidnapperWorld.group.visible = false;
    this.arrivalRig.root.visible = false;
    this.clearActorSlots();
    this.clearEscapeActors();
    this.clearKidnapperActors();
    this.clearAnomalyMode();
    this.flashlight.color.setHex(0xfff1dc);
    this.flashlight.intensity = 0;
    this.audio.setAmbientHumLevel(0);
    this.audio.startTvStatic(0.12);
    this.emitHud();
  }

  public skipIntro(): void {
    this.audio.unlock();
    this.audio.stopNewsBroadcast();
    this.audio.stopTvStatic();
    this.startNewCampaign();
  }

  public startNewCampaign(): void {
    this.audio.unlock();
    this.audio.stopNewsBroadcast();
    this.audio.stopTvStatic();

    const campaign = generateFiveDayCampaign();
    this.records = campaign.records;
    this.campaignDays = campaign.days;
    this.caseLogs = [];
    this.loggedCaseUids.clear();
    this.canRetryEscape = false;
    this.coronerReport = null;
    this.isShift6 = false;
    this.shift6CompletedModal = false;
    this.releasePossession(true);
    this.ownerFreecam = false;

    this.day = 1;
    this.casualties = 0;
    this.strikes = 0;
    this.fakesStopped = 0;
    this.taserCharges = this.maxTaserCharges;
    this.deathReason = '';
    this.sanity = 100;
    this.sanityState = 'stable';
    this.whisperDrainTimer = 0;
    this.whisperCooldownTimer = 0;
    this.paranormalDrainTimer = 0;
    this.paranormalCooldownTimer = 0;
    this.flickerEventTimer = 0;
    this.flickerCooldownTimer = 10.0;
    this.deskRecoveredAmount = 0;
    this.hallucinationFlash = null;
    this.hallucinationFlashTimer = 0;
    this.nextHallucinationDelay = 5.5;
    this.shadow3dTimer = 0;
    this.shadowHallucinationGroup.visible = false;
    this.corridorFaceTimer = 0;
    this.nextCorridorFaceDelay = 5.0;
    this.corridorFaceFlash = null;
    this.corridorFaceFlashTimer = 0;
    this.faceHallucinationGroup.visible = false;
    this.bbHallucinationRoom = null;
    this.bbHallucinationTimer = 0;
    this.nextBbHallucinationDelay = 6.0;
    this.cctvGlitchPulseTimer = 0;

    this.scene.fog = new THREE.FogExp2(0x06080a, 0.048);
    this.world.introGroup.visible = false;
    this.world.schoolGroup.visible = true;
    this.escapeWorld.escapeGroup.visible = false;
    this.kidnapperWorld.group.visible = false;
    this.clearEscapeActors();
    this.clearKidnapperActors();
    this.clearAnomalyMode();
    this.flashlight.color.setHex(0xfff1dc);
    this.flashlight.intensity = 4.4;
    this.audio.setAmbientHumLevel(0.03);

    this.startDay(1);
  }

  public setOverlay(overlay: HudSnapshot['activeOverlay']): void {
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt') return;
    this.audio.unlock();
    this.cancelTaserCharge();
    const next = this.activeOverlay === overlay ? 'none' : overlay;
    this.activeOverlay = next;
    if (next === 'cctv' && this.sanity < 45) {
      this.nextBbHallucinationDelay = Math.min(this.nextBbHallucinationDelay, 2.2);
    }
    if (next !== 'none' && this.pointerLocked) {
      document.exitPointerLock?.();
    }
    if (next === 'cctv') this.audio.playCctvSwitch();
    else this.audio.playCardInspect();
    this.emitHud();
  }

  public setCctvCam(cam: CctvCamId): void {
    this.audio.unlock();
    this.activeCctvCam = cam;
    this.audio.playCctvSwitch();
    this.emitHud();
  }

  public startBodyScan(): void {
    if (this.phase !== 'arrival') return;
    this.audio.unlock();
    this.activeOverlay = 'scanner';
    if (this.pointerLocked) document.exitPointerLock?.();
    if (!this.scanning && !this.scanCompleted) {
      this.scanning = true;
      this.scanProgress = 0;
      this.audio.playScanHum();
    }
    this.emitHud();
  }

  public askQuestion(idx: 0 | 1 | 2): void {
    if (this.phase !== 'arrival') return;
    this.audio.unlock();
    this.askedQuestionIdx = idx;
    this.audio.playCardInspect();
    this.emitHud();
  }

  private formatMismatchType(category: AnomalyCategory): string {
    switch (category) {
      case 'id_name_mismatch':
        return 'ID Name Mismatch';
      case 'id_photo_mismatch':
        return 'ID Photo Mismatch';
      case 'id_number_mismatch':
        return 'ID Number Mismatch';
      case 'id_dob_mismatch':
        return 'Date of Birth Mismatch';
      case 'id_class_subject_mismatch':
        return 'Class / Subject Mismatch';
      case 'id_school_mismatch':
        return 'School Name Mismatch';
      case 'scan_extra_bones':
        return 'Extra Skeletal Bones';
      case 'scan_extra_fingers':
        return 'Six-Fingered Anatomy';
      case 'scan_no_heartbeat':
        return 'No Heartbeat / Respiration';
      case 'scan_unnatural_internal':
        return 'Unnatural Internal Organs';
      case 'behavior_no_blink':
        return 'No Blinking Reflex';
      case 'behavior_repeating':
        return 'Repeating Speech / Motor Loop';
      default:
        return 'Unknown Anomaly';
    }
  }

  private recordAnomalyCaseLog(
    person: ArrivalPerson,
    outcome: CaseLogEntry['outcome'],
  ): void {
    if (!person.isFake || this.loggedCaseUids.has(person.uid)) return;
    this.loggedCaseUids.add(person.uid);
    const id = person.presentedId;
    this.caseLogs.push({
      id: person.uid,
      day: person.day,
      role: person.role,
      officialName: person.officialRecord.fullName,
      recordId: person.officialRecord.recordId,
      anomalyCategory: person.anomalyCategory,
      mismatchType: this.formatMismatchType(person.anomalyCategory),
      mismatchDetails: person.idChangeSummary,
      presentedSummary: `${id.fullName} · ${id.idNumber} · ${id.classOrSubject} · DOB ${id.dob} · ${id.schoolName}`,
      outcome,
    });
  }

  private recordCaseLogByUid(uid: string, outcome: CaseLogEntry['outcome']): void {
    const dayArr = this.campaignDays[this.day - 1] ?? [];
    const person = dayArr.find((p) => p.uid === uid);
    if (person) {
      this.recordAnomalyCaseLog(person, outcome);
    }
  }

  public decideAllow(): void {
    if (this.phase !== 'arrival') return;
    const arrival = this.getCurrentArrival();
    if (!arrival) return;
    this.audio.unlock();
    this.activeOverlay = 'none';
    this.audio.playGateBuzz(false);
    this.gateOpenTimer = 2.8;
    this.todayAdmitted.push(arrival);
    if (arrival.isFake) {
      this.recordAnomalyCaseLog(arrival, 'slipped_past');
    }
    this.spawnAdmittedWalker(arrival);
    this.advanceArrivalOrStartClass(
      `${arrival.presentedId.fullName} admitted — walking to ${
        arrival.assignedRoom === 'room101' ? 'Room 101' : 'Room 102'
      }.`,
    );
  }

  public decideReject(): void {
    if (this.phase !== 'arrival') return;
    const arrival = this.getCurrentArrival();
    if (!arrival) return;
    this.audio.unlock();
    this.activeOverlay = 'none';
    this.spawnDepartingWalker(arrival);

    if (arrival.isFake) {
      this.fakesStopped++;
      this.recordAnomalyCaseLog(arrival, 'rejected');
      this.restoreSanity(10);
      this.audio.playRoundResult(true);
      this.advanceArrivalOrStartClass('FAKE IDENTIFIED & REJECTED — SENT AWAY.');
    } else {
      this.addStrike(`STRIKE ${this.strikes + 1}/${MAX_STRIKES}: Rejected real ${arrival.role}!`);
      if ((this.phase as GamePhase) !== 'gameover') {
        this.advanceArrivalOrStartClass('Innocent person turned away.');
      }
    }
  }

  public toggleTaserEquip(): void {
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt') return;
    this.audio.unlock();

    if (this.hasTaserInHand) {
      this.cancelTaserCharge();
      this.hasTaserInHand = false;
      this.audio.playCardInspect();
      this.setBanner('Electric gun put away.', 'neutral', 2.0);
      this.emitHud();
      return;
    }

    if (!this.taserTakenFromRoom && !this.isInCheckingRoom()) {
      this.setBanner('The electric taser gun is in the checking room — return there and press T to equip it.', 'warning', 3.0);
      this.emitHud();
      return;
    }

    this.taserTakenFromRoom = true;
    this.hasTaserInHand = true;
    this.audio.playCardInspect();
    this.setBanner('Electric Gun equipped — aim at an anomaly and press [R] for a one-shot zap!', 'warning', 2.8);
    this.emitHud();
  }

  public startTaserCharge(): void {
    // Instant one-shot electric gun when clicking/pressing R while aimed!
    this.fireTaserShot();
  }

  public cancelTaserCharge(): void {
    if (!this.isChargingTaser && this.taserChargeProgress === 0) return;
    this.isChargingTaser = false;
    this.taserChargeProgress = 0;
    this.audio.stopTaserCharge();
    this.emitHud();
  }

  private showWorldTaserBeam(fromPoint: THREE.Vector3, targetPoint: THREE.Vector3): void {
    const dist = Math.max(0.4, fromPoint.distanceTo(targetPoint));
    this.taserBeamMesh.position.copy(fromPoint).lerp(targetPoint, 0.5);
    this.taserBeamMesh.scale.set(1, dist, 1);
    this.taserBeamMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      _v2.copy(targetPoint).sub(fromPoint).normalize(),
    );
    this.taserBeamMesh.visible = true;
  }

  private showElectricShotBeam(targetPoint: THREE.Vector3): void {
    _v1.set(0.18, -0.14, -0.48).applyMatrix4(this.camera.matrixWorld);
    this.showWorldTaserBeam(_v1, targetPoint);
  }

  public fireTaserShot(): void {
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt') return;
    if (!this.hasTaserInHand || this.activeHidingSpot || this.activeOverlay !== 'none') return;
    this.audio.unlock();

    if (this.taserCharges <= 0) {
      this.setBanner('ELECTRIC GUN DEPLETED — NO SHOTS LEFT!', 'danger', 2.4);
      this.emitHud();
      return;
    }

    this.isChargingTaser = false;
    this.taserChargeProgress = 0;
    this.taserCharges--;
    this.taserFlashTimer = 0.28;
    this.world.taserArcLight.position.copy(this.playerPos);
    this.audio.playTaser();

    // Small gun kick recoil
    this.handTaserGroup.position.set(0.21, -0.155, -0.35);

    // Case 1: One-shot firing right at the Checking Room Arrival Window
    if (this.phase === 'arrival') {
      const arrival = this.getCurrentArrival();
      if (!arrival) return;
      _v1.set(this.arrivalRig.root.position.x, 1.35, this.arrivalRig.root.position.z);
      this.showElectricShotBeam(_v1);
      this.activeOverlay = 'none';
      if (arrival.isFake) {
        this.fakesStopped++;
        this.recordAnomalyCaseLog(arrival, 'tased');
        this.restoreSanity(10);
        this.audio.playRoundResult(true);
        this.advanceArrivalOrStartClass('ANOMALY SHOT AT CHECKPOINT — ONE ELECTRIC SHOT DROVE IT AWAY!');
      } else {
        this.addStrike(`STRIKE ${this.strikes + 1}/${MAX_STRIKES}: Shot an innocent ${arrival.role}!`);
        if ((this.phase as GamePhase) !== 'gameover') {
          this.advanceArrivalOrStartClass('Real person injured & turned away.');
        }
      }
      return;
    }

    // Case 2: Aimed one-shot electric gun raycast during Class Time / Hunt
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();

    let bestSlot: LiveActorSlot | null = null;
    let bestScore = Infinity;

    for (const slot of this.actorSlots) {
      if (slot.data.state === 'fled' || slot.data.state === 'victimized') continue;
      const dx = slot.data.pos.x - this.playerPos.x;
      const dy = 1.22 - this.playerPos.y;
      const dz = slot.data.pos.z - this.playerPos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 13.5) continue;

      const dot = dist < 0.35 ? 1 : (dx * _v1.x + dy * _v1.y + dz * _v1.z) / dist;
      // Require genuine aim toward the person/anomaly (crosshair alignment)
      if (dot < 0.72 && dist > 1.35) continue;

      const fakePriority = slot.data.isFake ? 0 : 0.65;
      const score = (1 - dot) * 18 + dist * 0.15 + fakePriority;
      if (score < bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }

    if (bestSlot) {
      _v2.set(bestSlot.data.pos.x, 1.25, bestSlot.data.pos.z);
      this.showElectricShotBeam(_v2);

      if (!bestSlot.data.isFake) {
        this.addStrike(`STRIKE ${this.strikes + 1}/${MAX_STRIKES}: Shot innocent ${bestSlot.data.name}!`);
      } else {
        bestSlot.data.taserHits++;
        bestSlot.data.state = 'fled';
        this.fakesStopped++;
        this.recordCaseLogByUid(bestSlot.data.uid, 'banished');
        this.restoreSanity(12);
        this.audio.playRoundResult(true);
        this.setBanner('DIRECT ELECTRIC HIT — ANOMALY BANISHED IN ONE SHOT!', 'success', 3.4);
        this.checkHuntCleared();
      }
    } else {
      _v2.copy(this.camera.position).addScaledVector(_v1, 8.5);
      this.showElectricShotBeam(_v2);
      if (this.phase === 'hunt') {
        this.setBanner('SHOT MISSED — AIM AT THE ANOMALY BEFORE PRESSING R!', 'danger', 2.8);
      } else {
        this.setBanner('Electric shot missed.', 'neutral', 2.0);
      }
    }

    // Loud electric gunfire sound attracts remaining anomalies
    for (const slot of this.actorSlots) {
      if (slot.data.isFake && slot.data.state !== 'fled' && slot.data.state !== 'stunned') {
        slot.noiseTarget = new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z);
      }
    }
    this.emitHud();
  }

  public toggleLockdown(room: 'room101' | 'room102'): void {
    if (this.phase !== 'classtime' && this.phase !== 'hunt') return;
    this.audio.unlock();
    this.audio.playGateBuzz(false);

    if (room === 'room101') {
      this.room101Locked = !this.room101Locked;
      if (this.room101Locked) this.evaluateLockdown('room101');
    } else {
      this.room102Locked = !this.room102Locked;
      if (this.room102Locked) this.evaluateLockdown('room102');
    }
    this.emitHud();
  }

  private evaluateLockdown(room: 'room101' | 'room102'): void {
    const inside = this.actorSlots.filter(
      (s) => s.data.room === room && s.data.state !== 'fled' && s.data.state !== 'victimized',
    );
    const hasReal = inside.some((s) => !s.data.isFake);
    const hasFake = inside.some((s) => s.data.isFake);

    if (hasReal) {
      this.addStrike(`STRIKE ${this.strikes + 1}/${MAX_STRIKES}: Locked down real people in ${room === 'room101' ? 'Room 101' : 'Room 102'}!`);
    } else if (hasFake) {
      inside.forEach((s) => {
        if (s.data.isFake) {
          s.data.state = 'fled';
          this.fakesStopped++;
          this.recordCaseLogByUid(s.data.uid, 'locked_down');
        }
      });
      this.restoreSanity(12);
      this.audio.playRoundResult(true);
      this.setBanner(`${room === 'room101' ? 'Room 101' : 'Room 102'} LOCKED DOWN — ANOMALY CONTAINED!`, 'success', 3.5);
      this.checkHuntCleared();
    }
  }

  public toggleCrouch(): void {
    if (
      this.phase !== 'arrival' &&
      this.phase !== 'classtime' &&
      this.phase !== 'hunt' &&
      this.phase !== 'anomaly_mode'
    ) {
      return;
    }
    if (this.phase === 'anomaly_mode' && this.anomalyHp <= 0) return;
    // Cannot crouch while hidden inside a box, locker, or under a desk
    if (this.activeHidingSpot !== null) return;
    this.isCrouching = !this.isCrouching;
    this.emitHud();
  }

  public toggleHide(): void {
    if (
      this.phase !== 'arrival' &&
      this.phase !== 'classtime' &&
      this.phase !== 'hunt' &&
      this.phase !== 'anomaly_mode'
    ) {
      return;
    }
    if (this.phase === 'anomaly_mode' && this.anomalyHp <= 0) return;
    this.audio.unlock();
    this.cancelTaserCharge();
    if (this.activeHidingSpot) {
      this.audio.playHideToggle(false);
      this.currentEyeHeight = this.activeHidingSpot.position.y;
      this.isCrouching = false;
      this.playerPos.set(
        this.hideExitPos.x,
        this.phase === 'anomaly_mode' ? 1.82 : this.currentEyeHeight,
        this.hideExitPos.z,
      );
      this.activeHidingSpot = null;
      this.hideTransition = 0;
      this.hiddenDuration = 0;
      this.hidingMoveNoise = 0;
      this.hidingWarningShown = false;
      this.deskRecoveredAmount = 0;
      this.emitHud();
      return;
    }
    const spot = this.findNearbyHidingSpot();
    if (spot) {
      this.audio.playHideToggle(true);
      this.activeOverlay = 'none';
      this.isCrouching = false;
      this.hideStartEyeHeight = this.currentEyeHeight;
      this.hideExitPos.copy(this.playerPos);
      this.activeHidingSpot = spot;
      this.hideTransition = 0.01;
      this.hiddenDuration = 0;
      this.hidingMoveNoise = 0;
      this.hidingWarningShown = false;
      this.deskRecoveredAmount = 0;
      this.emitHud();
    }
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public requestPointerLock(): void {
    if (
      (this.phase === 'arrival' ||
        this.phase === 'classtime' ||
        this.phase === 'hunt' ||
        this.phase === 'anomaly_mode') &&
      !this.pointerLocked
    ) {
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  // =========================================================================
  // DAY, ARRIVAL & CLASSROOM FLOW
  // =========================================================================
  private startDay(dayNum: number): void {
    this.day = dayNum;
    this.arrivalIdx = 0;
    this.todayAdmitted = [];
    this.room101Locked = false;
    this.room102Locked = false;
    this.taserTakenFromRoom = false;
    this.hasTaserInHand = false;
    this.cancelTaserCharge();
    this.isCrouching = false;
    this.currentEyeHeight = EYE_HEIGHT;
    this.activeHidingSpot = null;
    this.hideTransition = 0;
    this.hiddenDuration = 0;
    this.hidingWarningShown = false;
    this.clearActorSlots();

    // Recharge +1 taser charge each morning up to max
    if (dayNum > 1) {
      this.taserCharges = Math.min(this.maxTaserCharges, this.taserCharges + 1);
    }

    this.setupArrival(0);
    this.setBanner(`DAY ${dayNum} / ${MAX_DAYS} BEGINS — CHECKPOINT OPEN`, 'neutral', 4.0);
    this.emitHud();
  }

  private setupArrival(idx: number): void {
    this.phase = 'arrival';
    this.arrivalIdx = idx;
    this.scanCompleted = false;
    this.scanning = false;
    this.scanProgress = 0;
    this.askedQuestionIdx = null;
    this.activeOverlay = 'none';
    this.cancelTaserCharge();
    this.hasTaserInHand = false;
    this.isCrouching = false;
    this.currentEyeHeight = EYE_HEIGHT;
    this.activeHidingSpot = null;
    this.hideTransition = 0;
    this.hiddenDuration = 0;
    this.hidingWarningShown = false;

    this.playerPos.set(-0.35, EYE_HEIGHT, -0.55);
    this.yaw = 0.08;
    this.pitch = -0.04;
    this.resetGuardNpcTransform(-0.35, -0.55, 0.08 + Math.PI);

    const person = this.getCurrentArrival();
    if (person) {
      this.arrivalRig.configure(person.liveAppearance, person.bodyScan.extraFingers);
      this.arrivalRig.root.position.set(-0.55, 0, -3.55);
      this.arrivalRig.root.rotation.y = 0;
      this.arrivalRig.root.visible = true;
    }
  }

  private getCurrentArrival(): ArrivalPerson | null {
    return this.campaignDays[this.day - 1]?.[this.arrivalIdx] ?? null;
  }

  private advanceArrivalOrStartClass(msg: string): void {
    const dayArrivals = this.campaignDays[this.day - 1] ?? [];
    if (this.arrivalIdx + 1 < dayArrivals.length) {
      this.setupArrival(this.arrivalIdx + 1);
      this.setBanner(msg, 'neutral', 3.0);
      this.emitHud();
    } else {
      this.beginClassTime();
    }
  }

  private beginClassTime(): void {
    this.phase = 'classtime';
    this.arrivalRig.root.visible = false;
    this.activeOverlay = 'cctv';
    if (this.pointerLocked) document.exitPointerLock?.();
    this.classTimer = 0;
    this.classObservationTimer = 0;

    // Watch corridor feed first if anyone allowed is still walking to their classroom
    const anyoneInCorridor = this.actorSlots.some(
      (s) => s.data.state === 'walking_to_seat' && s.data.pos.x <= 2.4,
    );
    if (anyoneInCorridor) {
      this.activeCctvCam = 'camCorridor';
    } else if (this.actorSlots.some((s) => s.data.room === 'room101')) {
      this.activeCctvCam = 'cam101';
    } else if (this.actorSlots.some((s) => s.data.room === 'room102')) {
      this.activeCctvCam = 'cam102';
    }

    this.audio.playDistantSchoolBell();
    this.audio.playCctvSwitch();

    this.setBanner(
      'PHASE 2: CLASS SURVEILLANCE — WATCH LIVE FEEDS AS EVERYONE TAKES THEIR SEATS.',
      'neutral',
      4.5,
    );
    this.emitHud();
  }

  private spawnAdmittedWalker(p: ArrivalPerson): void {
    const rig = createRealisticHuman(this.skinTextures);
    rig.configure(p.liveAppearance, p.bodyScan.extraFingers);

    const room = p.assignedRoom;
    const doorZ = room === 'room101' ? 9.5 : 18.0;
    const bbZ = room === 'room101' ? 9.3 : 17.7;
    const seats = room === 'room101' ? ROOM101_SEATS : ROOM102_SEATS;
    const isTeacher = p.role === 'teacher';
    const seatIdx = p.assignedSeatIndex % seats.length;

    const waypoints: THREE.Vector3[] = [
      new THREE.Vector3(1.65, 0, -2.9),
      new THREE.Vector3(1.65, 0, -1.2),
      new THREE.Vector3(0.18, 0, 2.25),
      new THREE.Vector3(0.25, 0, doorZ),
      new THREE.Vector3(3.45, 0, doorZ),
    ];

    let targetSeatYaw = Math.PI / 2;
    if (isTeacher) {
      waypoints.push(new THREE.Vector3(8.35, 0, bbZ));
      targetSeatYaw = -Math.PI / 2;
    } else {
      const seat = seats[seatIdx];
      const aisleX = seat.x > 6.0 ? 6.05 : 3.55;
      if (aisleX > 4.0) {
        waypoints.push(new THREE.Vector3(aisleX, 0, bbZ));
      }
      waypoints.push(new THREE.Vector3(aisleX, 0, seat.z));
      waypoints.push(new THREE.Vector3(seat.x - 0.46, 0, seat.z));
      targetSeatYaw = Math.PI / 2;
    }

    const startX = -0.35;
    const startZ = -3.4;
    rig.root.position.set(startX, 0, startZ);
    rig.root.rotation.y = Math.atan2(waypoints[0].x - startX, waypoints[0].z - startZ);
    this.scene.add(rig.root);

    let targetSeatPos: THREE.Vector3 | undefined;
    if (!isTeacher) {
      const seat = seats[seatIdx];
      targetSeatPos = new THREE.Vector3(seat.x - 0.46, 0, seat.z);
    }

    this.actorSlots.push({
      data: {
        uid: p.uid,
        name: p.officialRecord.fullName,
        role: p.role,
        isFake: p.isFake,
        room,
        seatIndex: isTeacher ? -1 : seatIdx,
        pos: { x: startX, z: startZ },
        yaw: rig.root.rotation.y,
        state: 'walking_to_seat',
        taserHits: 0,
        revealBehavior: p.classRevealBehavior,
        appearance: p.liveAppearance,
      },
      rig,
      seatWaypoints: waypoints,
      targetSeatYaw,
      targetSeatPos,
      seatedTime: 0,
      phaseOffset: Math.random() * 14,
      studentAction: 'taking_notes',
      studentActionTimer: 4 + Math.random() * 3,
      teacherAction: 'lecturing',
      teacherActionTimer: 4.5 + Math.random() * 2,
      teacherPatrolIdx: 0,
      stunTimer: 0,
      searchTimer: 0,
      passCooldown: 0,
      closeToHiddenTimer: 0,
      willLinger: false,
      discoveryCheckAccum: 0,
      attackTimer: 13.0,
      waypointIdx: room === 'room101' ? 0 : 3,
      noiseTarget: null,
    });
  }

  private spawnDepartingWalker(p: ArrivalPerson): void {
    const rig = createRealisticHuman(this.skinTextures);
    rig.configure(p.liveAppearance, p.bodyScan.extraFingers);
    rig.root.position.set(-0.55, 0, -3.55);
    rig.root.rotation.y = Math.PI;
    this.scene.add(rig.root);
    this.departingActors.push({
      rig,
      x: -0.55,
      z: -3.55,
      timer: 2.6,
    });
  }

  private clearActorSlots(): void {
    for (const s of this.actorSlots) {
      this.scene.remove(s.rig.root);
      s.rig.dispose();
    }
    this.actorSlots = [];
    for (const d of this.departingActors) {
      this.scene.remove(d.rig.root);
      d.rig.dispose();
    }
    this.departingActors = [];
  }

  private persistCampaignSave(): void {
    if (!this.isShift6) {
      this.campaignSave.highestDayReached = Math.max(this.campaignSave.highestDayReached, Math.min(5, this.day));
    }
    this.campaignSave.totalFakesStopped = Math.max(this.campaignSave.totalFakesStopped, this.fakesStopped);
    this.campaignSave.redeemedCodes = Array.from(
      new Set(this.redeemedCodes.filter((c) => c !== 'OWNER2026')),
    );
    saveCampaignProgress(this.campaignSave);
  }

  private handleDeathProtection(
    source: 'strikes' | 'casualties' | 'hunt_jumpscare' | 'escape_caught' | 'anomaly_taser',
    attackerSlot?: LiveActorSlot,
  ): boolean {
    if (this.immortalActive) {
      this.immortalShieldFlash = 0.78;
      this.audio.playImmortalShield();
      if (source === 'strikes') {
        this.strikes = MAX_STRIKES - 1;
        this.setBanner('IMMORTAL SHIELD: STRIKE LIMIT BYPASSED!', 'warning', 2.8);
      } else if (source === 'casualties') {
        this.casualties = MAX_CASUALTIES - 1;
        this.phase = 'hunt';
        this.setBanner('IMMORTAL SHIELD: PREVENTED SHIFT TERMINATION!', 'warning', 2.8);
      } else if (source === 'hunt_jumpscare') {
        if (attackerSlot) {
          attackerSlot.stunTimer = 2.6;
          attackerSlot.data.state = 'stunned';
        }
        this.setBanner('IMMORTAL SHIELD ABSORBED LETHAL ATTACK!', 'warning', 2.6);
      } else if (source === 'escape_caught') {
        this.escapePursuerZ = Math.max(0, this.playerPos.z - 6.0);
        this.escapeStaggerTimer = 0;
        this.setBanner('IMMORTAL SHIELD REPELLED THE PURSUERS — KEEP RUNNING!', 'warning', 2.6);
      } else if (source === 'anomaly_taser') {
        this.anomalyHp = Math.max(25, this.anomalyHp);
        this.anomalyShockTimer = 0.25;
        this.setBanner('IMMORTAL SHIELD ABSORBED GUARD TASER BLAST!', 'warning', 2.4);
      }
      this.emitHud();
      return true;
    }

    if (this.ownerInfiniteRevives) {
      this.immortalShieldFlash = 0.65;
      this.audio.playRevivePulse();
      if (source === 'strikes') {
        this.strikes = 0;
        this.setBanner('INFINITE REVIVE ACTIVE — STRIKES CLEARED AT CHECKPOINT!', 'success', 3.0);
      } else if (source === 'casualties') {
        this.casualties = 0;
        this.phase = 'hunt';
        this.setBanner('INFINITE REVIVE ACTIVE — SCHOOL SECURED!', 'success', 3.0);
      } else if (source === 'hunt_jumpscare') {
        if (attackerSlot) {
          attackerSlot.stunTimer = 3.2;
          attackerSlot.data.state = 'stunned';
        }
        this.activeHidingSpot = null;
        this.isCrouching = false;
        this.playerPos.set(-0.35, EYE_HEIGHT, -0.55);
        this.currentEyeHeight = EYE_HEIGHT;
        this.sanity = Math.max(55, this.sanity);
        this.setBanner('INFINITE REVIVE ACTIVATED — RESTORED IN CHECKING ROOM!', 'success', 3.2);
      } else if (source === 'escape_caught') {
        this.escapePursuerZ = Math.max(0, this.playerPos.z - 8.5);
        this.escapeStamina = 100;
        this.escapeStaggerTimer = 0;
        this.setBanner('INFINITE REVIVE ACTIVATED — BACK ON THE ESCAPE ROAD!', 'success', 3.0);
      } else if (source === 'anomaly_taser') {
        this.anomalyHp = 100;
        this.anomalyShockTimer = 0;
        this.activeHidingSpot = null;
        this.playerPos.set(0.1, 1.82, 22.6);
        this.currentEyeHeight = 1.82;
        this.setBanner('INFINITE REVIVE ACTIVATED — ANOMALY RESTORED (100% HP)!', 'success', 3.0);
      }
      this.emitHud();
      return true;
    }

    return false;
  }

  private addStrike(reason: string): void {
    this.strikes++;
    this.audio.playRoundResult(false);
    this.setBanner(reason, 'danger', 4.0);
    if (this.strikes >= MAX_STRIKES) {
      if (this.handleDeathProtection('strikes')) return;
      this.deathReason = '3 Strikes: Too many innocent students or staff were punished.';
      this.phase = 'gameover';
      document.exitPointerLock?.();
      this.audio.setAmbientHumLevel(0);
    }
    this.emitHud();
  }

  private checkHuntCleared(): void {
    const remaining = this.actorSlots.filter((s) => s.data.isFake && s.data.state !== 'fled');
    if (remaining.length === 0) {
      if (this.isShift6) {
        this.shift6Stage = 'escape_gate';
        this.setBanner('ALL SHIFT 6 ANOMALIES BANISHED — RETURN TO CHECKING ROOM GATE TO SEAL BREACH!', 'success', 4.8);
        this.emitHud();
        return;
      }
      this.finishDay();
    }
  }

  private finishDay(): void {
    this.audio.playDistantSchoolBell();
    this.releasePossession(true);
    this.isCrouching = false;
    this.currentEyeHeight = EYE_HEIGHT;
    this.activeHidingSpot = null;
    this.activeOverlay = 'none';
    this.sanity = Math.min(100, this.sanity + 25);
    this.sanityState = 'stable';
    this.whisperDrainTimer = 0;
    this.whisperCooldownTimer = 0;
    this.paranormalDrainTimer = 0;
    this.paranormalCooldownTimer = 0;
    this.flickerEventTimer = 0;
    this.flickerCooldownTimer = 10.0;
    this.deskRecoveredAmount = 0;
    this.hallucinationFlash = null;
    this.hallucinationFlashTimer = 0;
    this.shadow3dTimer = 0;
    this.shadowHallucinationGroup.visible = false;
    this.corridorFaceTimer = 0;
    this.corridorFaceFlash = null;
    this.corridorFaceFlashTimer = 0;
    this.faceHallucinationGroup.visible = false;
    this.bbHallucinationRoom = null;
    this.bbHallucinationTimer = 0;
    this.cctvGlitchPulseTimer = 0;
    this.clearActorSlots();
    this.persistCampaignSave();

    if (this.isShift6) {
      this.triggerShift6Ending();
      return;
    }

    if (this.day >= MAX_DAYS) {
      this.campaignSave.completedCampaign = true;
      this.persistCampaignSave();
      this.startShift5Escape();
      return;
    }
    this.startDay(this.day + 1);
  }

  // =========================================================================
  // SHIFT 5: FINAL ESCAPE (SCENES 1 - 7)
  // =========================================================================
  private clearEscapeActors(): void {
    for (const s of this.escapeStudents) {
      this.scene.remove(s.rig.root);
      s.rig.dispose();
    }
    this.escapeStudents = [];
    for (const p of this.escapePursuers) {
      this.scene.remove(p.rig.root);
      p.rig.dispose();
    }
    this.escapePursuers = [];
    for (const bp of this.escapeBusPassengers) {
      bp.rig.root.parent?.remove(bp.rig.root);
      bp.rig.dispose();
    }
    this.escapeBusPassengers = [];
    if (this.jumpscareRig) {
      this.scene.remove(this.jumpscareRig.root);
      this.jumpscareRig.dispose();
      this.jumpscareRig = null;
    }
  }

  private clearKidnapperActors(): void {
    for (const kp of this.kidnapperBusPassengers) {
      kp.rig.root.parent?.remove(kp.rig.root);
      kp.rig.dispose();
    }
    this.kidnapperBusPassengers = [];
    this.kidnapperWorld.group.visible = false;
  }

  private populateKidnapperBusPassengers(): void {
    this.clearKidnapperActors();
    const studentRecs = this.records.filter((r) => r.role === 'student');
    const teacherRecs = this.records.filter((r) => r.role === 'teacher');
    const seatRowZ = [-2.2, -1.05, 0.1, 1.25, 2.35];
    const actions: StudentClassAction[] = ['listening', 'whispering', 'listening', 'yawning'];

    let idx = 0;
    for (const rz of seatRowZ) {
      for (const side of [-1, 1]) {
        const rec = studentRecs.length > 0 ? studentRecs[idx % studentRecs.length] : undefined;
        const rig = createRealisticHuman(this.skinTextures);
        if (rec) rig.configure(rec.appearance, false);
        rig.root.position.set(side * 0.78, 0.79, rz);
        rig.root.rotation.y = 0;
        this.kidnapperWorld.busGroup.add(rig.root);
        this.kidnapperBusPassengers.push({
          rig,
          action: actions[idx % actions.length],
          phase: idx * 0.7,
        });
        idx++;
      }
    }

    const driverRig = createRealisticHuman(this.skinTextures);
    if (teacherRecs[0]) {
      driverRig.configure(
        {
          ...teacherRecs[0].appearance,
          uniformHex: '#1f2937',
          tieHex: '#334155',
        },
        false,
      );
    }
    driverRig.root.position.set(0.72, 0.79, 3.25);
    driverRig.root.rotation.y = 0;
    this.kidnapperWorld.busGroup.add(driverRig.root);
    this.kidnapperBusPassengers.push({
      rig: driverRig,
      action: 'listening',
      phase: 0.3,
      isDriver: true,
    });
  }

  private populateBusPassengers(): void {
    for (const bp of this.escapeBusPassengers) {
      bp.rig.root.parent?.remove(bp.rig.root);
      bp.rig.dispose();
    }
    this.escapeBusPassengers = [];

    const studentRecs = this.records.filter((r) => r.role === 'student');
    const teacherRecs = this.records.filter((r) => r.role === 'teacher');
    const seatRowZ = [-2.2, -1.05, 0.1, 1.25, 2.35];
    const actions: StudentClassAction[] = ['listening', 'whispering', 'listening', 'taking_notes'];

    let idx = 0;
    for (const rz of seatRowZ) {
      for (const side of [-1, 1]) {
        const rec = studentRecs.length > 0 ? studentRecs[idx % studentRecs.length] : undefined;
        const rig = createRealisticHuman(this.skinTextures);
        if (rec) rig.configure(rec.appearance, false);
        rig.root.position.set(side * 0.78, 0.79, rz);
        rig.root.rotation.y = 0;
        this.escapeWorld.busGroup.add(rig.root);
        this.escapeBusPassengers.push({
          rig,
          action: actions[idx % actions.length],
          phase: idx * 0.85,
        });
        idx++;
      }
    }

    // Add bus driver at the front wheel
    const driverRig = createRealisticHuman(this.skinTextures);
    if (teacherRecs[0]) {
      driverRig.configure(
        {
          ...teacherRecs[0].appearance,
          uniformHex: '#1f2937',
          tieHex: '#334155',
        },
        false,
      );
    }
    driverRig.root.position.set(0.72, 0.79, 3.25);
    driverRig.root.rotation.y = 0;
    this.escapeWorld.busGroup.add(driverRig.root);
    this.escapeBusPassengers.push({
      rig: driverRig,
      action: 'listening',
      phase: 0.4,
      isDriver: true,
    });
  }

  public startShift5Escape(): void {
    this.audio.unlock();
    this.clearActorSlots();
    this.clearEscapeActors();
    this.clearKidnapperActors();
    this.escapeWorld.reset();

    this.world.introGroup.visible = false;
    this.world.schoolGroup.visible = false;
    this.arrivalRig.root.visible = false;
    this.escapeWorld.escapeGroup.visible = true;
    this.scene.fog = new THREE.FogExp2(0x04060a, 0.017);
    this.flashlight.intensity = 5.0;
    this.jumpscareLight.intensity = 0;
    this.camera.rotation.z = 0;
    this.camera.fov = 65;
    this.camera.updateProjectionMatrix();

    this.phase = 'escape_intro';
    this.escapeStage = 'intro_students';
    this.escapeCutsceneTimer = 0;
    this.escapeStamina = 100;
    this.escapePlayerY = 0;
    this.escapeJumpVel = 0;
    this.escapeGrounded = true;
    this.escapeStaggerTimer = 0;
    this.escapeCameraShake = 0;
    this.escapeHitCooldown = 0;
    this.escapeBusOffsetZ = 0;
    this.escapeOutroCaption = '';
    this.escapeOutroFade = 0;
    this.escapeOutroBusPlayed = false;
    this.escapeFootstepCuePlayed = false;
    this.escapeIntroAudioAccum = 0.18;
    this.escapeIntroAudioIdx = 0;
    this.escapeSurvivalTime = 0;
    this.canRetryEscape = true;
    this.coronerReport = null;
    this.activeOverlay = 'none';
    this.hasTaserInHand = false;
    this.taserBeamMesh.visible = false;
    this.feedbackBanner = null;
    if (this.pointerLocked) document.exitPointerLock?.();

    this.playerPos.set(0, EYE_HEIGHT, 10.5);
    this.currentEyeHeight = EYE_HEIGHT;
    this.yaw = Math.PI; // facing +Z down the road toward bus (Z=138)
    this.pitch = -0.02;

    // 3 real students boarding the distant school bus
    const studentCoords = [
      { laneX: -0.7, startZ: 121, delay: 0 },
      { laneX: 0.4, startZ: 124, delay: 0.35 },
      { laneX: -0.2, startZ: 127, delay: 0.7 },
    ];
    studentCoords.forEach((sc, i) => {
      const rec = this.records.filter((r) => r.role === 'student')[i];
      const rig = createRealisticHuman(this.skinTextures);
      if (rec) rig.configure(rec.appearance, false);
      rig.root.position.set(sc.laneX, 0, sc.startZ);
      rig.root.rotation.y = 0;
      this.scene.add(rig.root);
      this.escapeStudents.push({ rig, startZ: sc.startZ, laneX: sc.laneX, delay: sc.delay, boarded: false });
    });

    // 4 anomalies emerging from behind the school entrance
    const pursuerConfigs = [
      { laneX: -1.45, lagOffset: -0.5, speed: 5.55 },
      { laneX: 1.35, lagOffset: -1.4, speed: 5.45 },
      { laneX: -0.25, lagOffset: -2.2, speed: 5.65 },
      { laneX: 0.55, lagOffset: -3.2, speed: 5.35 },
    ];
    const teacherRecs = this.records.filter((r) => r.role === 'teacher');
    const studentRecs = this.records.filter((r) => r.role === 'student');
    pursuerConfigs.forEach((pc, i) => {
      const rec = i % 2 === 0 ? teacherRecs[i % teacherRecs.length] : studentRecs[(i + 2) % studentRecs.length];
      const rig = createRealisticHuman(this.skinTextures);
      if (rec) rig.configure(rec.appearance, true);
      const startZ = -1.5 + pc.lagOffset;
      rig.root.position.set(pc.laneX, 0, startZ);
      rig.root.rotation.y = 0;
      rig.root.visible = false;
      this.scene.add(rig.root);
      this.escapePursuers.push({ rig, laneX: pc.laneX, z: startZ, speed: pc.speed, lagOffset: pc.lagOffset, record: rec });
    });

    this.populateBusPassengers();
    this.audio.playBusHornAndDoor();
    this.emitHud();
  }

  public retryEscapeChase(): void {
    this.audio.unlock();
    this.clearEscapeActors();
    this.escapeWorld.reset();
    this.world.introGroup.visible = false;
    this.world.schoolGroup.visible = false;
    this.escapeWorld.escapeGroup.visible = true;
    this.scene.fog = new THREE.FogExp2(0x04060a, 0.017);
    this.flashlight.intensity = 5.0;
    this.jumpscareLight.intensity = 0;
    this.camera.rotation.z = 0;

    // Recreate chasing anomalies right behind school doorway for immediate playable retry
    const pursuerConfigs = [
      { laneX: -1.35, lagOffset: 0.0, speed: 5.55 },
      { laneX: 1.25, lagOffset: -0.9, speed: 5.45 },
      { laneX: -0.15, lagOffset: -1.6, speed: 5.62 },
      { laneX: 0.6, lagOffset: -2.5, speed: 5.35 },
    ];
    const teacherRecs = this.records.filter((r) => r.role === 'teacher');
    const studentRecs = this.records.filter((r) => r.role === 'student');
    pursuerConfigs.forEach((pc, i) => {
      const rec = i % 2 === 0 ? teacherRecs[i % teacherRecs.length] : studentRecs[(i + 2) % studentRecs.length];
      const rig = createRealisticHuman(this.skinTextures);
      if (rec) rig.configure(rec.appearance, true);
      const z = 5.5 + pc.lagOffset;
      rig.root.position.set(pc.laneX, 0, z);
      rig.root.rotation.y = 0;
      this.scene.add(rig.root);
      this.escapePursuers.push({ rig, laneX: pc.laneX, z, speed: pc.speed, lagOffset: pc.lagOffset, record: rec });
    });

    this.populateBusPassengers();
    this.beginEscapePlay();
  }

  private beginEscapePlay(): void {
    this.phase = 'escape_play';
    this.escapeStage = 'lockers';
    this.escapeStamina = 100;
    this.escapePlayerY = 0;
    this.escapeJumpVel = 0;
    this.escapeGrounded = true;
    this.escapeStaggerTimer = 0;
    this.escapeCameraShake = 0;
    this.escapeHitCooldown = 0;
    this.escapeBusOffsetZ = 0;
    this.escapePursuerZ = 4.5;
    this.escapeSurvivalTime = 0;
    this.coronerReport = null;
    this.playerPos.set(0, EYE_HEIGHT, 12.0);
    this.currentEyeHeight = EYE_HEIGHT;
    this.yaw = Math.PI; // looking down +Z road toward distant yellow bus
    this.pitch = -0.02;
    this.canRetryEscape = true;

    for (const p of this.escapePursuers) {
      p.rig.root.visible = true;
      p.z = this.escapePursuerZ + p.lagOffset;
      p.rig.root.position.set(p.laneX, 0, p.z);
    }

    this.setBanner('OBJECTIVE: REACH THE SCHOOL BUS! Hold Shift to Sprint · Space to Jump!', 'danger', 4.5);
    this.emitHud();
  }

  public returnToMainMenu(): void {
    this.audio.stopNewsBroadcast();
    this.audio.stopTvStatic();
    this.audio.setAmbientHumLevel(0);
    this.releasePossession(true);
    this.ownerFreecam = false;
    this.ownerPanelOpen = false;
    this.isShift6 = false;
    this.shift6CompletedModal = false;
    this.clearActorSlots();
    this.clearEscapeActors();
    this.clearKidnapperActors();
    this.clearAnomalyMode();
    this.dismissBodyguards();
    this.possessTargetOutline.visible = false;
    this.world.introGroup.visible = true;
    this.world.schoolGroup.visible = false;
    this.escapeWorld.escapeGroup.visible = false;
    this.kidnapperWorld.group.visible = false;
    this.arrivalRig.root.visible = false;
    this.flashlight.color.setHex(0xfff1dc);
    this.flashlight.intensity = 0;
    this.scene.fog = new THREE.FogExp2(0x06080a, 0.048);
    this.camera.fov = 65;
    this.camera.updateProjectionMatrix();
    this.camera.rotation.z = 0;
    this.canRetryEscape = false;
    this.coronerReport = null;
    this.phase = 'menu';
    this.emitHud();
  }

  public startKidnapperCutscene(): void {
    this.audio.unlock();
    this.audio.playUiClick();
    this.audio.stopNewsBroadcast();
    this.audio.stopTvStatic();
    this.audio.setAmbientHumLevel(0);
    this.releasePossession(true);
    this.ownerFreecam = false;
    this.isShift6 = false;
    this.shift6CompletedModal = false;

    this.clearActorSlots();
    this.clearEscapeActors();
    this.clearAnomalyMode();
    this.kidnapperWorld.reset();
    this.populateKidnapperBusPassengers();

    this.world.introGroup.visible = false;
    this.world.schoolGroup.visible = false;
    this.escapeWorld.escapeGroup.visible = false;
    this.arrivalRig.root.visible = false;
    this.kidnapperWorld.group.visible = true;

    this.scene.fog = new THREE.FogExp2(0x05070b, 0.025);
    this.flashlight.color.setHex(0xfff1dc);
    this.flashlight.intensity = 3.6;
    this.jumpscareLight.intensity = 0;
    this.camera.rotation.z = 0;
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 2.05, -2.0);
    this.camera.lookAt(0.2, 1.35, 8.8);

    if (this.pointerLocked) document.exitPointerLock?.();

    this.phase = 'kidnapper_cutscene';
    this.kidnapperStage = 'roadblock';
    this.kidnapperTimer = 0;
    this.kidnapperFade = 0;
    this.kidnapperCreditsProgress = 0;
    this.kidnapperCreditsChordPlayed = false;
    this.kidnapperCaption = '2 MILES PAST MIDNIGHT PUBLIC SCHOOL · 03:42 AM';
    this.kidnapperSubCaption = 'An unmarked black cargo van blocks the dark highway ahead.';
    this.kidnapperCuesPlayed = { chord1: false, chord2: false, slam: false };

    this.audio.playBrakeScreech();
    this.emitHud();
  }

  public skipCreditsRoll(): void {
    if (this.phase !== 'kidnapper_cutscene') return;
    this.kidnapperStage = 'credits_roll';
    this.kidnapperFade = 1;
    this.kidnapperCreditsProgress = 1;
    this.emitHud();
  }

  public replayCreditsRoll(): void {
    if (this.phase !== 'kidnapper_cutscene') return;
    this.kidnapperStage = 'credits_roll';
    this.kidnapperFade = 1;
    this.kidnapperTimer = 20.8;
    this.kidnapperCreditsProgress = 0;
    this.kidnapperCreditsChordPlayed = true;
    this.audio.playCreditsThemeChord();
    this.emitHud();
  }

  public playMenuClick(): void {
    this.audio.unlock();
    this.audio.playUiClick();
  }

  public playRedeemFeedback(success: boolean): void {
    this.audio.unlock();
    this.audio.playRoundResult(success);
  }

  public triggerAnomalyMode(): void {
    if (this.phase === 'anomaly_mode') return;

    this.audio.unlock();
    this.audio.stopNewsBroadcast();
    this.audio.stopTvStatic();
    this.clearActorSlots();
    this.clearEscapeActors();
    this.clearAnomalyMode();

    // Preserve any existing normal campaign progress counters while entering secret mode
    this.anomalySavedDay = this.day;
    this.anomalySavedSanity = this.sanity;
    this.anomalySavedStrikes = this.strikes;
    this.anomalySavedCasualties = this.casualties;

    const npcRoster =
      this.records.length > 0 ? this.records : generateFiveDayCampaign().records;

    this.world.introGroup.visible = false;
    this.world.schoolGroup.visible = true;
    this.escapeWorld.escapeGroup.visible = false;
    this.arrivalRig.root.visible = false;
    this.scene.fog = new THREE.FogExp2(0x0d0306, 0.044);
    this.flashlight.color.setHex(0xff5252);
    this.flashlight.intensity = 5.2;
    this.jumpscareLight.intensity = 0;
    this.hasTaserInHand = false;
    this.taserBeamMesh.visible = false;
    this.activeOverlay = 'none';
    this.isCrouching = false;
    this.activeHidingSpot = null;
    this.canRetryEscape = false;
    this.coronerReport = null;

    this.phase = 'anomaly_mode';
    this.anomalyCaughtCount = 0;
    this.anomalyGuardsCaught = 0;
    this.anomalyStudentsCaught = 0;
    this.anomalyGuardBossHp = this.anomalyGuardBossMaxHp;
    this.anomalyGuardBossAlive = true;
    this.anomalyHp = 100;
    this.anomalyVictory = false;
    this.anomalyShockTimer = 0;
    this.taserFlashTimer = 0;
    this.anomalyAbilityCooldown = 0;
    this.anomalySurgeTimer = 0;
    this.anomalyTransformTimer = 1.65;
    this.anomalyLungeTimer = 0;
    this.anomalyHandsGroup.visible = true;

    // Spawn player anomaly near south stairwell/corridor facing north toward patrolling NPCs
    this.playerPos.set(0.1, 1.82, 22.6);
    this.currentEyeHeight = 1.82;
    this.yaw = 0; // looking north (-Z) up main corridor
    this.pitch = -0.02;
    this.camera.fov = 74;
    this.camera.updateProjectionMatrix();

    // Spawn 1 Security Guard Boss (with mustache + taser gun) + 20 Students
    this.anomalyNpcs.push(
      spawnAnomalyModeNpc(
        'guard',
        0,
        npcRoster,
        this.skinTextures,
        this.scene,
        this.playerPos.x,
        this.playerPos.z,
        this.world.colliders,
      ),
    );
    for (let i = 0; i < this.anomalyTotalStudents; i++) {
      this.anomalyNpcs.push(
        spawnAnomalyModeNpc(
          'student',
          i,
          npcRoster,
          this.skinTextures,
          this.scene,
          this.playerPos.x,
          this.playerPos.z,
          this.world.colliders,
        ),
      );
    }

    this.audio.setAmbientHumLevel(0.055);
    this.audio.playAnomalyTransform();
    this.setBanner(
      'ANOMALY MODE — ELIMINATE ALL 20 STUDENTS & THE GUARD BOSS · [C] CROUCH · [E] HIDE',
      'danger',
      5.5,
    );
    this.emitHud();
  }

  private clearAnomalyMode(): void {
    this.releasePossession(true);
    this.possessTargetOutline.visible = false;
    this.possessTargetInfo = null;
    for (const npc of this.anomalyNpcs) {
      this.scene.remove(npc.rig.root);
      npc.rig.dispose();
    }
    this.anomalyNpcs = [];
    this.anomalySurgeTimer = 0;
    this.anomalyTransformTimer = 0;
    this.anomalyLungeTimer = 0;
    this.anomalyShockTimer = 0;
    this.anomalyAbilityCooldown = 0;
    this.anomalyVictory = false;
    this.anomalyHandsGroup.visible = false;
    if (this.phase === 'anomaly_mode') {
      this.day = this.anomalySavedDay;
      this.sanity = this.anomalySavedSanity;
      this.strikes = this.anomalySavedStrikes;
      this.casualties = this.anomalySavedCasualties;
    }
  }

  public dismissAnomalyVictory(): void {
    if (this.phase !== 'anomaly_mode') return;
    this.anomalyVictory = false;
    this.emitHud();
  }

  public triggerAnomalySurge(): void {
    if (this.phase !== 'anomaly_mode') return;
    if (this.anomalyHp <= 0 || this.anomalyAbilityCooldown > 0 || this.anomalyTransformTimer > 0.4) return;
    this.audio.unlock();
    this.anomalyAbilityCooldown = this.anomalyAbilityMaxCooldown;
    this.anomalySurgeTimer = 3.2;
    this.flickerEventTimer = 1.6;
    this.audio.playAnomalySurge();
    this.audio.playLightFlickerBurst();
    this.setBanner('SHADOW SURGE UNLEASHED — SPEED BOOST & PANIC WAVE!', 'danger', 2.4);
    this.emitHud();
  }

  public triggerAnomalyCatchAttempt(): void {
    if (this.phase !== 'anomaly_mode' || this.anomalyTransformTimer > 0.4 || this.anomalyHp <= 0) return;
    this.audio.unlock();
    this.anomalyLungeTimer = 0.28;

    let closest: AnomalyNpc | null = null;
    let bestDist = this.activeHidingSpot ? 2.75 : 2.55;
    for (const npc of this.anomalyNpcs) {
      if (npc.state === 'caught' || npc.id === this.possessedNpcId) continue;
      const d = Math.hypot(npc.x - this.playerPos.x, npc.z - this.playerPos.z);
      if (d < bestDist) {
        bestDist = d;
        closest = npc;
      }
    }

    if (closest) {
      const wasHiddenAmbush = this.activeHidingSpot !== null;
      if (this.activeHidingSpot) {
        this.audio.playHideToggle(false);
        this.playerPos.set(this.hideExitPos.x, 1.82, this.hideExitPos.z);
        this.currentEyeHeight = 1.82;
        this.activeHidingSpot = null;
        this.hideTransition = 0;
        this.hiddenDuration = 0;
      }

      if (closest.role === 'guard') {
        const damage = wasHiddenAmbush ? 35 : 25;
        closest.bossHp = Math.max(0, closest.bossHp - damage);
        this.anomalyGuardBossHp = closest.bossHp;
        this.audio.playAnomalyHuntCatch();
        if (closest.bossHp > 0) {
          closest.state = 'boss_stagger';
          closest.staggerTimer = 1.35;
          closest.taserCooldown = 1.9;
          closest.taserAimTimer = 0;
          const pct = Math.round((closest.bossHp / closest.bossMaxHp) * 100);
          this.setBanner(
            `${wasHiddenAmbush ? 'AMBUSH STRIKE! ' : ''}GUARD BOSS HIT — ${pct}% HP LEFT!`,
            'danger',
            2.6,
          );
        } else {
          closest.state = 'caught';
          closest.catchTimer = 0.48;
          this.anomalyCaughtCount++;
          this.anomalyGuardsCaught++;
          this.anomalyGuardBossAlive = false;
          this.setBanner('SECURITY GUARD BOSS DEFEATED!', 'success', 3.4);
        }
        this.emitHud();
        return;
      }

      closest.state = 'caught';
      closest.catchTimer = 0.48;
      this.anomalyCaughtCount++;
      this.anomalyStudentsCaught++;
      this.audio.playAnomalyHuntCatch();
      this.setBanner(
        `${wasHiddenAmbush ? 'AMBUSHED & ATE' : 'ATE'} STUDENT (${this.anomalyStudentsCaught}/${this.anomalyTotalStudents}): ${closest.name.toUpperCase()}`,
        'danger',
        2.4,
      );
      this.emitHud();
      return;
    }

    // If possessing the Guard Boss with nobody in melee eat range, fire Guard's Taser Pulse forward
    const possessedGuard = this.possessedNpcId
      ? this.anomalyNpcs.find((n) => n.id === this.possessedNpcId && n.role === 'guard')
      : null;
    if (possessedGuard) {
      _v1.set(possessedGuard.x, 1.38, possessedGuard.z);
      const fwdX = -Math.sin(this.yaw);
      const fwdZ = -Math.cos(this.yaw);
      _v2.set(possessedGuard.x + fwdX * 6.5, 1.32, possessedGuard.z + fwdZ * 6.5);
      this.showWorldTaserBeam(_v1, _v2);
      this.taserFlashTimer = 0.24;
      this.audio.playTaser();

      // Check if a student lies along the forward taser arc
      let shockedStudent: AnomalyNpc | null = null;
      let minForwardDist = 6.6;
      for (const npc of this.anomalyNpcs) {
        if (npc.state === 'caught' || npc.id === possessedGuard.id) continue;
        const rx = npc.x - possessedGuard.x;
        const rz = npc.z - possessedGuard.z;
        const along = rx * fwdX + rz * fwdZ;
        if (along > 0.2 && along < minForwardDist) {
          const perp = Math.abs(rx * fwdZ - rz * fwdX);
          if (perp <= 0.85) {
            minForwardDist = along;
            shockedStudent = npc;
          }
        }
      }
      if (shockedStudent) {
        shockedStudent.state = 'caught';
        shockedStudent.catchTimer = 0.48;
        this.anomalyCaughtCount++;
        this.anomalyStudentsCaught++;
        this.audio.playAnomalyHuntCatch();
        this.setBanner(
          `GUARD TASER SUBDUED STUDENT (${this.anomalyStudentsCaught}/${this.anomalyTotalStudents}): ${shockedStudent.name.toUpperCase()}`,
          'danger',
          2.4,
        );
      } else {
        this.setBanner('GUARD TASER PULSE FIRED!', 'warning', 1.6);
      }
      this.emitHud();
    } else {
      this.audio.playUiClick();
    }
  }

  private isControllingAnomalyInSchool(): boolean {
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt') {
      return false;
    }
    if (this.possessedNpcId && this.possessedNpcSource === 'classroom') {
      const slot = this.actorSlots.find((s) => s.data.uid === this.possessedNpcId);
      return Boolean(slot && (slot.data.isFake || slot.transformedAs === 'anomaly'));
    }
    return !this.possessedNpcId && this.ownerPlayerForm === 'anomaly';
  }

  private findSchoolEatTarget(): {
    id: string;
    name: string;
    role: 'guard' | 'student' | 'teacher' | 'anomaly';
  } | null {
    if (!this.isControllingAnomalyInSchool()) return null;
    let bestDist = 2.6;
    let best: {
      id: string;
      name: string;
      role: 'guard' | 'student' | 'teacher' | 'anomaly';
    } | null = null;

    for (const slot of this.actorSlots) {
      if (slot.data.state === 'fled' || slot.data.state === 'victimized' || slot.data.uid === this.possessedNpcId) {
        continue;
      }
      const d = Math.hypot(slot.data.pos.x - this.playerPos.x, slot.data.pos.z - this.playerPos.z);
      if (d < bestDist) {
        bestDist = d;
        best = {
          id: slot.data.uid,
          name: slot.data.name,
          role: slot.data.isFake ? 'anomaly' : slot.data.role === 'teacher' ? 'teacher' : 'student',
        };
      }
    }

    if (this.possessedNpcId) {
      const gd = Math.hypot(this.guardNpc.x - this.playerPos.x, this.guardNpc.z - this.playerPos.z);
      if (gd < bestDist) {
        best = {
          id: this.guardNpc.id,
          name: 'Night Security Guard',
          role: 'guard',
        };
      }
    }

    return best;
  }

  public eatNearbyNpcInSchool(): void {
    if (!this.isControllingAnomalyInSchool()) return;
    this.audio.unlock();
    const target = this.findSchoolEatTarget();
    if (!target) {
      this.audio.playUiClick();
      return;
    }

    if (target.id === this.guardNpc.id) {
      this.guardNpc.stunTimer = 6.0;
      this.flickerEventTimer = 0.28;
      this.audio.playAnomalyHuntCatch();
      this.audio.playGateBuzz(true);
      this.setBanner('ANOMALY ATTACKED & DEVOURED THE NIGHT SECURITY GUARD!', 'danger', 2.8);
      this.emitHud();
      return;
    }

    const slot = this.actorSlots.find((s) => s.data.uid === target.id);
    if (slot) {
      slot.data.state = 'victimized';
      slot.rig.root.visible = false;
      if (slot.data.isFake) {
        this.fakesStopped++;
      }
      this.flickerEventTimer = 0.25;
      this.audio.playAnomalyHuntCatch();
      this.setBanner(`ANOMALY ATE ${slot.data.name.toUpperCase()}!`, 'danger', 2.4);
      this.emitHud();
    }
  }

  public triggerShift5Ending(): void {
    if (
      this.phase === 'escape_intro' ||
      this.phase === 'escape_play' ||
      this.phase === 'escape_outro'
    ) {
      return;
    }

    this.audio.unlock();
    this.audio.stopNewsBroadcast();
    this.audio.stopTvStatic();
    this.audio.setAmbientHumLevel(0);
    this.clearAnomalyMode();
    this.flashlight.color.setHex(0xfff1dc);

    if (this.records.length === 0) {
      const campaign = generateFiveDayCampaign();
      this.records = campaign.records;
      this.campaignDays = campaign.days;
    }

    this.day = MAX_DAYS;
    this.casualties = 0;
    this.strikes = 0;
    this.fakesStopped = 0;
    this.deathReason = '';
    this.sanity = 100;
    this.sanityState = 'stable';
    this.coronerReport = null;
    this.isCrouching = false;
    this.activeHidingSpot = null;

    this.startShift5Escape();
  }

  private isInCheckingRoom(): boolean {
    return this.playerPos.x >= -2.4 && this.playerPos.x <= 2.4 && this.playerPos.z >= -2.3 && this.playerPos.z <= 2.3;
  }

  private getCurrentRoom(): RoomId {
    if (this.isInCheckingRoom()) return 'checking';
    if (this.playerPos.x > 2.4 && this.playerPos.z < 14.0) return 'room101';
    if (this.playerPos.x > 2.4 && this.playerPos.z >= 14.0) return 'room102';
    return 'corridor';
  }

  private findNearbyHidingSpot(): HidingSpotInfo | null {
    let best: HidingSpotInfo | null = null;
    let bestDist = 2.25;
    for (const s of this.world.hidingSpots) {
      const d = Math.hypot(this.playerPos.x - s.position.x, this.playerPos.z - s.position.z);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  private isNearCover(): boolean {
    const px = this.playerPos.x;
    const pz = this.playerPos.z;
    for (const spot of this.world.hidingSpots) {
      if (Math.hypot(px - spot.position.x, pz - spot.position.z) <= 1.4) {
        return true;
      }
    }
    for (const box of this.world.colliders) {
      // Furniture colliders (desks, lockers, checking counter) are >= 0.55m thick in both axes (walls are 0.2m)
      if (box.maxX - box.minX >= 0.55 && box.maxZ - box.minZ >= 0.55) {
        const dx = Math.max(box.minX - px, 0, px - box.maxX);
        const dz = Math.max(box.minZ - pz, 0, pz - box.maxZ);
        if (Math.hypot(dx, dz) <= 1.05) {
          return true;
        }
      }
    }
    return false;
  }

  private setBanner(
    text: string,
    tone: 'neutral' | 'warning' | 'danger' | 'success',
    duration: number,
  ): void {
    this.feedbackBanner = { text, tone };
    this.feedbackTimer = duration;
  }

  // =========================================================================
  // GAME LOOP
  // =========================================================================
  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.totalTime += dt;

    if (this.immortalShieldFlash > 0) {
      this.immortalShieldFlash = Math.max(0, this.immortalShieldFlash - dt);
    }
    if (this.possessCooldown > 0) {
      this.possessCooldown = Math.max(0, this.possessCooldown - dt);
    }
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) this.feedbackBanner = null;
    }
    if (this.taserFlashTimer > 0) {
      this.taserFlashTimer = Math.max(0, this.taserFlashTimer - dt);
      if (this.taserFlashTimer <= 0.08) {
        this.taserBeamMesh.visible = false;
      }
    }
    if (this.gateOpenTimer > 0) {
      this.gateOpenTimer = Math.max(0, this.gateOpenTimer - dt);
    }

    if (this.phase === 'menu' || this.phase === 'intro') {
      this.audio.fadeDownSanityLayers();
      this.updateIntro(dt);
    } else if (this.phase === 'arrival' || this.phase === 'classtime' || this.phase === 'hunt') {
      this.updateScan(dt);
      this.updateTaserCharge(dt);
      this.updatePossessionAndTarget(dt);
      this.updatePlayer(dt);
      if (!this.ownerNpcsPaused) {
        this.updateArrivalAndActors(dt);
      }
      this.updateOwnerBodyguardsTick(dt);
      this.checkShift6Progression(dt);
      this.world.updateEnvironment(
        this.totalTime,
        dt,
        this.gateOpenTimer > 0,
        this.scanning,
        this.room101Locked,
        this.room102Locked,
        this.activeHidingSpot ? this.activeHidingSpot.id : null,
        this.taserFlashTimer,
        this.taserTakenFromRoom || this.hasTaserInHand,
        this.flickerEventTimer > 0,
        this.bbHallucinationTimer > 0 ? this.bbHallucinationRoom : null,
        this.bbHallucinationIdx,
      );
      const cctvOpen = this.activeOverlay === 'cctv';
      const cctvAudio = this.getCctvAudioState();
      this.audio.updateCctvFeed(dt, cctvOpen, cctvAudio.mode);
      this.audio.update(dt, {
        playing: true,
        round: this.day + (this.phase === 'hunt' ? 2 : 0),
        entityNearby: this.isAnyFakeNearPlayer(10),
        entityAlerted: this.phase === 'hunt',
        isHiding: this.activeHidingSpot !== null,
        sanity: this.sanity,
        backwardsClock: false,
        clockFrozen: false,
      });
      this.updateSanity(dt);
    } else if (this.phase === 'cutaway') {
      this.audio.fadeDownSanityLayers();
      this.audio.updateCctvFeed(dt, false, 'quiet');
      this.cutawayTimer -= dt;
      if (this.cutawayTimer <= 0) {
        if (this.casualties >= MAX_CASUALTIES) {
          if (this.handleDeathProtection('casualties')) {
            this.emitHud();
            return;
          }
          this.deathReason = '3 Casualties: Too many students and staff were harmed inside the school.';
          this.phase = 'gameover';
          document.exitPointerLock?.();
          this.audio.setAmbientHumLevel(0);
        } else {
          this.phase = 'hunt';
        }
        this.emitHud();
      }
    } else if (this.phase === 'escape_intro') {
      this.audio.fadeDownSanityLayers();
      this.updateEscapeIntro(dt);
    } else if (this.phase === 'escape_play') {
      this.audio.fadeDownSanityLayers();
      this.updateEscapePlay(dt);
    } else if (this.phase === 'escape_outro') {
      this.audio.fadeDownSanityLayers();
      this.updateEscapeOutro(dt);
    } else if (this.phase === 'kidnapper_cutscene') {
      this.audio.fadeDownSanityLayers();
      this.updateKidnapperCutscene(dt);
    } else if (this.phase === 'anomaly_mode') {
      this.updatePossessionAndTarget(dt);
      this.updateAnomalyMode(dt);
      this.updateOwnerBodyguardsTick(dt);
    } else if (this.phase === 'jumpscare') {
      this.audio.fadeDownSanityLayers();
      this.audio.updateCctvFeed(dt, false, 'quiet');
      this.updateJumpscare(dt);
    }

    // Update checking-room physical CCTV monitor wall render targets only when in checking room
    const activeWorldPhase =
      this.phase === 'arrival' || this.phase === 'classtime' || this.phase === 'hunt';
    if (activeWorldPhase && this.activeOverlay !== 'cctv' && this.isInCheckingRoom()) {
      this.cctvFrameCounter++;
      const step = this.isSoftwareGl ? 8 : 6;
      if (this.cctvFrameCounter % step === 0) {
        const camOrder: CctvCamId[] = ['cam101', 'cam102', 'camCorridor'];
        const which = camOrder[Math.floor(this.cctvFrameCounter / step) % 3];
        const prevFlash = this.flashlight.intensity;
        const prevHand = this.handTaserGroup.visible;
        const prevShadows = this.renderer.shadowMap.enabled;
        this.flashlight.intensity = 0;
        this.flashlight.visible = false;
        this.handTaserGroup.visible = false;
        this.renderer.shadowMap.enabled = false;
        const cam = this.cctvCameras[which];
        const prevAspect = cam.aspect;
        cam.aspect = 4 / 3;
        cam.updateProjectionMatrix();
        this.renderer.setRenderTarget(this.cctvTargets[which]);
        this.renderer.render(this.scene, cam);
        this.renderer.setRenderTarget(null);
        cam.aspect = prevAspect;
        cam.updateProjectionMatrix();
        this.renderer.shadowMap.enabled = prevShadows;
        this.flashlight.intensity = prevFlash;
        this.flashlight.visible = prevFlash > 0.05;
        this.handTaserGroup.visible = prevHand;
      }
    }

    this.flashlight.visible = this.flashlight.intensity > 0.05;
    this.jumpscareLight.visible = this.phase === 'jumpscare';

    // Ensure Guard NPC model is visible in school phases and rendered on layer 1 when possessing or in freecam/CCTV
    if (!activeWorldPhase) {
      this.guardNpc.rig.root.visible = false;
      this.camera.layers.enable(1);
    } else {
      this.guardNpc.rig.root.visible = true;
      if (this.possessedNpcId || this.ownerFreecam || this.activeOverlay === 'cctv') {
        this.camera.layers.enable(1);
      } else {
        this.camera.layers.disable(1);
      }
    }

    // Main render: live selected CCTV camera when CCTV overlay is open, else first-person guard camera
    if (activeWorldPhase && this.activeOverlay === 'cctv') {
      const prevFlash = this.flashlight.intensity;
      const prevHand = this.handTaserGroup.visible;
      this.flashlight.intensity = 0;
      this.flashlight.visible = false;
      this.handTaserGroup.visible = false;
      const cam = this.cctvCameras[this.activeCctvCam];
      this.renderer.render(this.scene, cam);
      this.flashlight.intensity = prevFlash;
      this.flashlight.visible = prevFlash > 0.05;
      this.handTaserGroup.visible = prevHand;
    } else {
      this.handTaserGroup.visible =
        activeWorldPhase &&
        this.hasTaserInHand &&
        !this.activeHidingSpot &&
        this.activeOverlay !== 'cctv' &&
        !this.ownerFreecam &&
        !this.possessedNpcId;
      this.renderer.render(this.scene, this.camera);
    }

    const staticPhase =
      this.phase === 'menu' ||
      this.phase === 'gameover' ||
      this.phase === 'victory' ||
      (this.phase === 'escape_outro' && this.escapeStage === 'outro_msg2') ||
      (this.phase === 'kidnapper_cutscene' &&
        this.kidnapperStage === 'credits_roll' &&
        this.kidnapperCreditsProgress >= 1);

    if (!staticPhase) {
      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.1) {
        this.hudEmitAccum = 0;
        this.emitHud();
      }
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 4);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 24);
      }
    };
    this.frameId = window.setTimeout(poll, 4);
  }

  private updateIntro(dt: number): void {
    const t = this.phase === 'menu' ? 3.5 : this.introTimer;
    if (this.phase === 'intro') {
      this.introTimer += dt;
      if (!this.introChimePlayed && this.introTimer >= 2.2) {
        this.introChimePlayed = true;
        this.audio.playBroadcastChime();
        this.audio.setTvStaticLevel(0.04);
      }
      if (!this.introGlitched && this.introTimer >= 13.0) {
        this.introGlitched = true;
        this.audio.stopNewsBroadcast();
        this.audio.setTvStaticLevel(0.16);
        this.audio.pulseTvGlitch();
      }
      if (this.introTimer >= 16.4) {
        this.skipIntro();
        return;
      }
    }

    renderTvBroadcastCanvas(this.world.tvCtx, 512, 384, t);
    this.world.tvTexture.needsUpdate = true;

    if (t >= 15.3) {
      this.world.tvLight.intensity = 0.05;
    } else if (t >= 13.0) {
      this.world.tvLight.color.setHex(0xd64545);
      this.world.tvLight.intensity = 1.6 + Math.random() * 1.4;
    } else {
      this.world.tvLight.color.setHex(0x8bb6e8);
      this.world.tvLight.intensity = 1.9 + Math.sin(this.totalTime * 19) * 0.18;
    }

    this.camera.position.set(
      Math.sin(this.totalTime * 0.4) * 0.025,
      1.26 + Math.cos(this.totalTime * 0.6) * 0.012,
      0.18,
    );
    this.camera.lookAt(0, 1.13, -1.65);
  }

  private updateEscapeIntro(dt: number): void {
    this.escapeCutsceneTimer += dt;
    const t = this.escapeCutsceneTimer;
    this.escapeWorld.update(this.totalTime, dt, 10, 0);

    // Animate students boarding the distant yellow bus
    this.escapeStudents.forEach((s) => {
      if (s.boarded) {
        s.rig.root.visible = false;
        return;
      }
      if (t >= s.delay) {
        const curZ = s.rig.root.position.z + 2.7 * dt;
        s.rig.root.position.set(s.laneX * Math.max(0, 1 - (curZ - 125) / 10), 0, curZ);
        s.rig.update(this.totalTime, dt, 'walking', {});
        if (curZ >= this.escapeWorld.busDoorZ) {
          s.boarded = true;
          s.rig.root.visible = false;
        }
      }
    });

    if (t < 3.6) {
      this.escapeStage = 'intro_students';
      this.camera.position.set(0.3, 1.68, 11.2);
      this.camera.lookAt(0, 1.5, 136);
      if (t > 2.4 && !this.escapeFootstepCuePlayed) {
        this.escapeFootstepCuePlayed = true;
        this.audio.playFootstep(true);
        this.audio.playDistantScream();
      }
    } else if (t < 7.2) {
      this.escapeStage = 'intro_anomalies';
      const localT = t - 3.6;
      // Camera turns around toward school entrance as anomalies burst out
      const camYaw = THREE.MathUtils.lerp(Math.PI, 0, Math.min(1, localT / 0.85));
      _euler.set(-0.04, camYaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);
      this.camera.position.set(0, 1.68, 12.2);

      this.escapePursuers.forEach((p, idx) => {
        p.rig.root.visible = true;
        p.z = Math.min(8.4 + idx * 0.4, 2.0 + localT * 2.4 + p.lagOffset * 0.4);
        p.rig.root.position.set(p.laneX, 0, p.z);
        p.rig.root.rotation.y = 0;
        p.rig.update(this.totalTime, dt, 'hunting', { noBlinking: true });
      });

      this.escapeIntroAudioAccum -= dt;
      if (this.escapeIntroAudioAccum <= 0 && this.escapePursuers.length > 0) {
        this.escapeIntroAudioAccum = 0.28;
        const p = this.escapePursuers[this.escapeIntroAudioIdx % this.escapePursuers.length];
        this.escapeIntroAudioIdx++;
        const dx = p.rig.root.position.x - 0;
        const dz = p.z - 12.2;
        const dist = Math.max(1.0, Math.hypot(dx, dz));
        const rX = Math.cos(camYaw);
        const rZ = -Math.sin(camYaw);
        const pan = THREE.MathUtils.clamp(((dx * rX + dz * rZ) / dist) * 0.85, -0.82, 0.82);
        const prox = THREE.MathUtils.clamp(1 - dist / 18, 0.18, 1);
        this.audio.playSpatialPursuerFootstep(pan, prox);
        if (this.escapeIntroAudioIdx % 4 === 2) {
          this.audio.playSpatialWhisperCue(pan, prox);
        }
      }

      this.flashlight.position.copy(this.camera.position);
      _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.flashlight.target.position.copy(this.camera.position).addScaledVector(_v1, 8.0);
      this.flashlight.target.updateMatrixWorld();
      return;
    } else if (t < 9.1) {
      this.escapeStage = 'intro_bus';
      const localT = t - 7.2;
      const camYaw = THREE.MathUtils.lerp(0, Math.PI, Math.min(1, localT / 0.7));
      _euler.set(-0.02, camYaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);
      const startRunZ = 12.2 + Math.max(0, localT - 0.85) * 4.5;
      this.camera.position.set(0, 1.65 + Math.sin(localT * 12) * 0.04, startRunZ);
      this.flashlight.position.copy(this.camera.position);
      _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.flashlight.target.position.copy(this.camera.position).addScaledVector(_v1, 8.0);
      this.flashlight.target.updateMatrixWorld();
      return;
    } else {
      this.beginEscapePlay();
      return;
    }

    this.flashlight.position.copy(this.camera.position);
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.flashlight.target.position.copy(this.camera.position).addScaledVector(_v1, 8.0);
    this.flashlight.target.updateMatrixWorld();
  }

  private updateEscapePlay(dt: number): void {
    this.escapeSurvivalTime += dt;

    // Stage indicator by progress along road
    if (this.playerPos.z < 49) this.escapeStage = 'lockers';
    else if (this.playerPos.z < 81) this.escapeStage = 'lights';
    else if (this.playerPos.z < 113) this.escapeStage = 'fire';
    else this.escapeStage = 'sprint';

    // Look around left/right/up/down with arrow keys
    this.applyArrowKeyLook(dt, 0.7);

    // Movement & Sprint Stamina (WASD)
    const wantForward = Boolean(this.keys['KeyW']);
    const wantBack = Boolean(this.keys['KeyS']);
    const strafeInput =
      (this.keys['KeyD'] ? 1 : 0) -
      (this.keys['KeyA'] ? 1 : 0);
    const shiftHeld = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const canSprint = shiftHeld && wantForward && this.escapeStamina > 2 && this.escapeStaggerTimer <= 0;

    if (canSprint) {
      this.escapeStamina = Math.max(0, this.escapeStamina - 12.5 * dt);
    } else {
      this.escapeStamina = Math.min(100, this.escapeStamina + (wantForward ? 11.5 : 21) * dt);
    }

    if (this.escapeStaggerTimer > 0) this.escapeStaggerTimer = Math.max(0, this.escapeStaggerTimer - dt);
    if (this.escapeHitCooldown > 0) this.escapeHitCooldown = Math.max(0, this.escapeHitCooldown - dt);
    if (this.escapeCameraShake > 0) this.escapeCameraShake = Math.max(0, this.escapeCameraShake - dt * 2.2);

    const baseForwardSpeed =
      (wantForward
        ? canSprint
          ? 7.55
          : 5.55
        : wantBack
          ? -2.8
          : 0) * this.ownerPlayerSpeed;
    const speedMult = this.escapeStaggerTimer > 0 ? 0.36 : 1.0;

    // Gentle strafe speed aligned with world X since camera faces +Z (yaw ~ PI)
    const forwardVecX = -Math.sin(this.yaw);
    const forwardVecZ = -Math.cos(this.yaw);
    const rightVecX = Math.cos(this.yaw);
    const rightVecZ = -Math.sin(this.yaw);

    const moveZ = (forwardVecZ * baseForwardSpeed + rightVecZ * strafeInput * 4.9 * this.ownerPlayerSpeed) * speedMult;
    const moveX = (forwardVecX * baseForwardSpeed + rightVecX * strafeInput * 4.9 * this.ownerPlayerSpeed) * speedMult;

    // Jump physics
    if ((this.keys['Space'] || this.keys['KeySpace']) && this.escapeGrounded) {
      this.escapeGrounded = false;
      this.escapeJumpVel = 6.5;
    }
    if (!this.escapeGrounded) {
      this.escapePlayerY += this.escapeJumpVel * dt;
      this.escapeJumpVel -= 16.5 * dt;
      if (this.escapePlayerY <= 0) {
        this.escapePlayerY = 0;
        this.escapeJumpVel = 0;
        this.escapeGrounded = true;
      }
    }

    // Apply movement + road boundaries + obstacle check
    const nextX = THREE.MathUtils.clamp(this.playerPos.x + moveX * dt, -2.75, 2.75);
    const nextZ = THREE.MathUtils.clamp(this.playerPos.z + moveZ * dt, 8.2, 136.5);

    let hitObstacle = false;
    for (const obs of this.escapeWorld.obstacles) {
      const overlapsX = nextX + 0.34 > obs.minX && nextX - 0.34 < obs.maxX;
      const overlapsZ = nextZ + 0.34 > obs.minZ && nextZ - 0.34 < obs.maxZ;
      if (overlapsX && overlapsZ) {
        if (obs.canJump && this.escapePlayerY >= obs.height - 0.12) {
          continue; // Fair clean jump clearance!
        }
        hitObstacle = true;
        break;
      }
    }

    if (hitObstacle) {
      if (this.escapeHitCooldown <= 0) {
        this.escapeHitCooldown = 0.85;
        this.escapeStaggerTimer = 0.65;
        this.escapeCameraShake = Math.max(this.escapeCameraShake, 0.55);
        this.audio.playMetalCrash();
        this.setBanner('OBSTACLE HIT — KEEP MOVING! DODGE OR JUMP OVER [SPACE]!', 'danger', 1.8);
      }
      this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x + moveX * dt * 0.25, -2.75, 2.75);
    } else {
      this.playerPos.x = nextX;
      this.playerPos.z = nextZ;
    }

    // Footstep sound while running
    const stepSpeed = Math.hypot(moveX, moveZ);
    if (stepSpeed > 1.2 && this.escapeGrounded) {
      this.walkBobPhase += dt * (canSprint ? 15.5 : 11.5);
      this.stepDistAccum += stepSpeed * dt;
      if (this.stepDistAccum >= (canSprint ? 1.45 : 1.75)) {
        this.stepDistAccum = 0;
        this.audio.playFootstep(canSprint, false);
      }
    }

    // World events (lockers toppling, lights crashing + sparking, fire flickering)
    const worldEvents = this.escapeWorld.update(this.totalTime, dt, this.playerPos.z, 0);
    if (worldEvents.lockerCrashed) {
      this.audio.playMetalCrash();
      this.escapeCameraShake = Math.max(this.escapeCameraShake, 0.48);
    }
    if (worldEvents.lightSparked) {
      this.audio.playElectricalSpark();
      this.escapeCameraShake = Math.max(this.escapeCameraShake, 0.38);
    }

    // Advance chasing anomalies from behind (unless NPCs are paused in Owner Mode)
    const progress = THREE.MathUtils.clamp((this.playerPos.z - 12) / (135 - 12), 0, 1);
    if (!this.ownerNpcsPaused) {
      const chaseSpeed = 5.15 + progress * 0.42;
      this.escapePursuerZ += chaseSpeed * dt;
      // Rubberband minimally if extremely far back so tension stays urgent without unfair teleporting
      if (this.playerPos.z - this.escapePursuerZ > 22) {
        this.escapePursuerZ = this.playerPos.z - 22;
      }

      this.escapePursuers.forEach((p, idx) => {
        p.z = this.escapePursuerZ + p.lagOffset * 0.7;
        const swayX = Math.sin(this.totalTime * 2.4 + idx * 1.5) * 0.35;
        p.rig.root.position.set(THREE.MathUtils.clamp(p.laneX + swayX, -2.5, 2.5), 0, p.z);
        p.rig.root.rotation.y = Math.atan2(this.playerPos.x - p.rig.root.position.x, this.playerPos.z - p.z);
        p.rig.update(this.totalTime, dt, 'hunting', { noBlinking: true });
      });
    }

    const pursuerDist = this.playerPos.z - this.escapePursuerZ;
    const pursuerCues = this.escapePursuers.map((p) => {
      const dx = p.rig.root.position.x - this.playerPos.x;
      const dz = p.z - this.playerPos.z;
      const dist = Math.max(1.0, Math.hypot(dx, dz));
      const rightDot = (dx * rightVecX + dz * rightVecZ) / dist;
      const pan = THREE.MathUtils.clamp(rightDot * 0.85, -0.82, 0.82);
      const proximity = THREE.MathUtils.clamp(1 - dist / 22, 0.12, 1);
      return { pan, proximity };
    });

    this.audio.updateEscapeChase(dt, {
      active: true,
      sprinting: canSprint,
      fireNear: worldEvents.fireNear,
      pursuerDist,
      progress,
      pursuerCues,
    });

    // Camera with jump + sprint bob + shake
    const bob = stepSpeed > 1.2 && this.escapeGrounded ? Math.sin(this.walkBobPhase) * 0.055 : 0;
    const shakeX = this.escapeCameraShake > 0 ? (Math.random() - 0.5) * 0.14 * this.escapeCameraShake : 0;
    const shakeY = this.escapeCameraShake > 0 ? (Math.random() - 0.5) * 0.14 * this.escapeCameraShake : 0;
    this.camera.position.set(
      this.playerPos.x + shakeX,
      EYE_HEIGHT + this.escapePlayerY + bob + shakeY,
      this.playerPos.z,
    );

    const sprintFov = canSprint ? 72 : 66;
    const nextFov = THREE.MathUtils.damp(this.camera.fov, sprintFov, 7, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.04) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    // Keep player yaw clamped gently around +Z (Math.PI) while allowing look-around
    _euler.set(THREE.MathUtils.clamp(this.pitch, -0.7, 0.7), this.yaw, shakeX * 0.4, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    this.flashlight.position.copy(this.camera.position);
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.flashlight.target.position.copy(this.camera.position).addScaledVector(_v1, 8.0);
    this.flashlight.target.updateMatrixWorld();

    // Check Catch -> Jumpscare + Scream -> Retryable Game Over (unless invisible or protected)
    if (!this.ownerInvisible && !this.ownerNpcsPaused && pursuerDist <= 1.55) {
      this.triggerEscapeCaught();
      return;
    }

    // Check Bus Reached -> Scene 7 Outro!
    if (this.playerPos.z >= this.escapeWorld.busDoorZ - 0.7) {
      this.startEscapeOutro();
    }
  }

  private triggerEscapeCaught(): void {
    if (this.handleDeathProtection('escape_caught')) {
      return;
    }
    this.phase = 'jumpscare';
    this.jumpscareActor = null;

    let captor = this.escapePursuers[0] ?? null;
    let bestDist = Infinity;
    for (const p of this.escapePursuers) {
      const d = Math.hypot(p.rig.root.position.x - this.playerPos.x, p.z - this.playerPos.z);
      if (d < bestDist) {
        bestDist = d;
        captor = p;
      }
    }

    const fallbackTeacher = this.records.find((r) => r.role === 'teacher');
    const captorRec = captor?.record ?? fallbackTeacher;
    const rig = createRealisticHuman(this.skinTextures);
    if (captorRec) rig.configure(captorRec.appearance, true);
    this.scene.add(rig.root);
    this.jumpscareRig = rig;
    this.jumpscareTimer = 0;
    this.canRetryEscape = true;

    const sectorLabels: Partial<Record<EscapeStage, string>> = {
      lockers: 'Fallen Lockers Corridor',
      lights: 'Electrical Lights Hazard',
      fire: 'Engulfed Fire Corridor',
      sprint: 'Final Bus Approach',
    };
    const sectorReached = sectorLabels[this.escapeStage] ?? 'School Exit Route';
    const captorName = captorRec?.fullName ?? 'Unidentified Faculty Mimic';
    const captorRole = captorRec?.role ?? 'teacher';
    const captorRecordId = captorRec?.recordId ?? 'UNKNOWN-ID';
    const captorDepartment = captorRec?.classOrSubject ?? 'Night Staff';
    const priorCase = captorRec
      ? this.caseLogs.find((c) => c.recordId === captorRec.recordId)
      : undefined;
    const captorAnomalyProfile = priorCase
      ? `${priorCase.mismatchType} — ${priorCase.mismatchDetails}`
      : captorRole === 'teacher'
        ? 'Mimic Specimen (Faculty Appearance) — Unblinking Stare & Elevated Pursuit Speed'
        : 'Mimic Specimen (Student Appearance) — Non-Human Vocalization & Relentless Pursuit';

    const slowedByObstacle = this.escapeStaggerTimer > 0 || this.escapeHitCooldown > 0.2;
    const causeOfDeath = slowedByObstacle
      ? `Overtaken in the ${sectorReached} after colliding with debris; fatal capture inflicted by ${captorName}.`
      : `Pursued from the school entrance and intercepted in the ${sectorReached} by ${captorName}.`;

    const survivedSec = Number(this.escapeSurvivalTime.toFixed(1));
    const totalEscapeDistanceMeters = Math.max(1, Math.round(this.escapeWorld.busDoorZ - 12));
    const distanceCoveredMeters = THREE.MathUtils.clamp(
      Math.round(this.playerPos.z - 12),
      0,
      totalEscapeDistanceMeters,
    );
    const busRemainingMeters = Math.max(0, Math.round(this.escapeWorld.busDoorZ - this.playerPos.z));

    this.coronerReport = {
      caseNumber: `MPS-S5-${String(Math.max(1, Math.round(survivedSec * 10))).padStart(4, '0')}`,
      victimName: 'Night Security Guard',
      victimRole: 'Checkpoint Duty Officer',
      timeSurvivedSeconds: survivedSec,
      distanceCoveredMeters,
      totalEscapeDistanceMeters,
      busRemainingMeters,
      sectorReached,
      captorName,
      captorRole,
      captorRecordId,
      captorDepartment,
      captorAnomalyProfile,
      causeOfDeath,
    };

    this.deathReason = `${captorName} (${captorRecordId}) caught you before you could reach the waiting school bus.`;
    this.activeOverlay = 'none';
    document.exitPointerLock?.();
    this.audio.playJumpscare();
    this.emitHud();
  }

  private startEscapeOutro(): void {
    this.phase = 'escape_outro';
    this.escapeStage = 'outro_board';
    this.escapeCutsceneTimer = 0;
    this.escapeBusOffsetZ = 0;
    this.escapeOutroFade = 0;
    this.escapeOutroCaption = '';
    this.escapeOutroBusPlayed = false;
    this.canRetryEscape = false;
    this.coronerReport = null;
    if (this.escapeBusPassengers.length === 0) {
      this.populateBusPassengers();
    }
    this.camera.fov = 65;
    this.camera.updateProjectionMatrix();
    if (this.pointerLocked) document.exitPointerLock?.();
    this.audio.playBusHornAndDoor();
    this.emitHud();
  }

  private updateEscapeOutro(dt: number): void {
    this.escapeCutsceneTimer += dt;
    const t = this.escapeCutsceneTimer;

    // Close the bus door over first 0.75s
    this.escapeWorld.busDoorMesh.scale.x = Math.min(1, 0.12 + t * 1.4);

    // Animate all seated students & bus driver inside the moving bus
    for (const bp of this.escapeBusPassengers) {
      bp.rig.update(this.totalTime, dt, 'seated', {
        studentAction: bp.action,
        phaseOffset: bp.phase,
        isTeacher: bp.isDriver,
      });
    }

    if (t < 2.1) {
      // Climbing aboard the bus while looking down the aisle filled with seated students
      this.escapeStage = 'outro_board';
      const climbEase = Math.min(1, t / 1.5);
      this.camera.position.set(
        0,
        THREE.MathUtils.lerp(1.65, 2.15, climbEase),
        this.escapeWorld.busBaseZ - THREE.MathUtils.lerp(3.8, 3.0, climbEase),
      );
      this.camera.lookAt(0, 1.85, this.escapeWorld.busBaseZ + 2.2);
    } else if (t < 5.0) {
      // Looking back from rear bus window as bus drives off & anomalies stop in the dark
      this.escapeStage = 'outro_lookback';
      const driveT = t - 2.1;
      this.escapeBusOffsetZ = driveT * driveT * 2.5;
      this.camera.position.set(0, 2.1, this.escapeWorld.busBaseZ + this.escapeBusOffsetZ - 3.5);
      this.camera.lookAt(0, 1.35, 118);

      // Advance pursuers forward up to ~128m where they stop at the edge of light
      this.escapePursuers.forEach((p, idx) => {
        p.z = Math.min(129 - idx * 1.1, p.z + 5.8 * dt);
        p.rig.root.position.set(p.laneX * 0.9, 0, p.z);
        p.rig.root.rotation.y = 0;
        p.rig.update(this.totalTime, dt, 'hunting', { noBlinking: true });
      });

      if (!this.escapeOutroBusPlayed && t > 2.3) {
        this.escapeOutroBusPlayed = true;
        this.audio.playDistantScream();
      }
    } else if (t < 9.4) {
      // Culminating ending scene: inside the warmly lit bus full of relieved students riding away
      this.escapeStage = 'outro_students';
      const cruiseT = t - 5.0;
      this.escapeBusOffsetZ = 2.9 * 2.9 * 2.5 + cruiseT * 11.5;
      const panX = Math.sin(cruiseT * 0.65) * 0.22;
      const busRideBob = Math.sin(t * 9.5) * 0.012;
      this.camera.position.set(
        -0.12 + panX,
        2.24 + busRideBob,
        this.escapeWorld.busBaseZ + this.escapeBusOffsetZ + 3.55,
      );
      this.camera.lookAt(0, 1.72, this.escapeWorld.busBaseZ + this.escapeBusOffsetZ - 1.3);

      if (t > 7.7) {
        this.escapeOutroFade = Math.min(1, (t - 7.7) / 1.6);
      }
    } else if (t < 11.8) {
      this.escapeStage = 'outro_title';
      this.escapeOutroFade = 1;
      this.escapeOutroCaption = 'SHIFT 5 — COMPLETED';
    } else if (t < 14.3) {
      this.escapeStage = 'outro_msg1';
      this.escapeOutroFade = 1;
      this.escapeOutroCaption = '“YOU ESCAPED THE SCHOOL…”';
    } else {
      this.escapeStage = 'outro_msg2';
      this.escapeOutroFade = 1;
      this.escapeOutroCaption = '“…BUT DID YOU ESCAPE THEM?”';
    }

    this.escapeWorld.update(this.totalTime, dt, 136, this.escapeBusOffsetZ);
    this.flashlight.position.copy(this.camera.position);
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.flashlight.target.position.copy(this.camera.position).addScaledVector(_v1, 8.0);
    this.flashlight.target.updateMatrixWorld();
  }

  private updateKidnapperCutscene(dt: number): void {
    this.kidnapperTimer += dt;
    const t = this.kidnapperTimer;

    for (const kp of this.kidnapperBusPassengers) {
      kp.rig.update(this.totalTime, dt, 'seated', {
        studentAction: kp.action,
        phaseOffset: kp.phase,
        isTeacher: kp.isDriver,
      });
    }
    this.kidnapperWorld.update(this.totalTime, t);

    if (t < 4.2) {
      this.kidnapperStage = 'roadblock';
      const p = Math.min(1, t / 4.2);
      const ease = 1 - Math.pow(1 - p, 2);
      // Slight brake jolt in first 0.55s then slow push toward the roadblock
      const jolt = t < 0.6 ? Math.sin(t * 28) * 0.04 * (1 - t / 0.6) : 0;
      this.camera.position.set(
        THREE.MathUtils.lerp(0.0, -0.45, ease),
        2.05 + jolt,
        THREE.MathUtils.lerp(-2.0, 0.55, ease),
      );
      this.camera.lookAt(0.25, 1.32, 8.8);
      this.kidnapperCaption = '2 MILES PAST MIDNIGHT PUBLIC SCHOOL · 03:42 AM';
      this.kidnapperSubCaption = 'An unmarked black cargo van blocks the dark highway ahead.';
      this.kidnapperFade = t < 0.45 ? 1 - t / 0.45 : 0;
    } else if (t < 9.0) {
      this.kidnapperStage = 'figures';
      if (!this.kidnapperCuesPlayed.chord1) {
        this.kidnapperCuesPlayed.chord1 = true;
        this.audio.playKidnapperRevealChord(false);
      }
      const p = Math.min(1, (t - 4.2) / 4.8);
      this.camera.position.set(
        THREE.MathUtils.lerp(-0.45, 0.42, p),
        THREE.MathUtils.lerp(1.85, 1.68, p),
        THREE.MathUtils.lerp(0.55, 2.0, p),
      );
      this.camera.lookAt(0.1, 1.48, 4.9);
      this.kidnapperCaption = 'WHO WAS WAITING OUTSIDE THE SCHOOL GATES?';
      this.kidnapperSubCaption = 'Three masked figures step out into the bus headlights.';
      this.kidnapperFade = 0;
    } else if (t < 13.6) {
      this.kidnapperStage = 'van_reveal';
      if (!this.kidnapperCuesPlayed.chord2) {
        this.kidnapperCuesPlayed.chord2 = true;
        this.audio.playKidnapperRevealChord(true);
      }
      const p = Math.min(1, (t - 9.0) / 4.6);
      this.camera.position.set(
        THREE.MathUtils.lerp(-2.95, -2.05, p),
        1.56,
        THREE.MathUtils.lerp(6.4, 8.25, p),
      );
      this.camera.lookAt(0.2, 1.25, 8.85);
      this.kidnapperCaption = 'THE SCHOOL KID KIDNAPPERS';
      this.kidnapperSubCaption =
        'Stolen school backpacks, barred cargo space, and Midnight Public School ID files.';
      this.kidnapperFade = 0;
    } else if (t < 17.6) {
      this.kidnapperStage = 'stinger';
      const p = Math.min(1, (t - 13.6) / 4.0);
      this.camera.position.set(
        0.15,
        THREE.MathUtils.lerp(1.58, 1.66, p),
        THREE.MathUtils.lerp(-0.45, 0.35, p),
      );
      this.camera.lookAt(0.15, 1.66, 2.0);
      this.kidnapperCaption = '“THE ANOMALIES ONLY HERDED THE KIDS STRAIGHT TO US.”';
      this.kidnapperSubCaption = 'Every terror inside the school drove the bus directly into their trap.';
      if (!this.kidnapperCuesPlayed.slam && t >= 15.95) {
        this.kidnapperCuesPlayed.slam = true;
        this.audio.playVanDoorSlam();
      }
      this.kidnapperFade = t > 16.15 ? Math.min(1, (t - 16.15) / 1.3) : 0;
    } else if (t < 20.8) {
      this.kidnapperStage = 'reveal_end';
      this.kidnapperFade = 1;
      this.kidnapperCaption = 'THE SCHOOL KID KIDNAPPERS';
      this.kidnapperSubCaption = 'Midnight Abduction Ring · Case File Unsealed';
    } else {
      this.kidnapperStage = 'credits_roll';
      this.kidnapperFade = 1;
      this.kidnapperCaption = 'MIDNIGHT PUBLIC SCHOOL';
      this.kidnapperSubCaption = 'END CREDITS';
      if (!this.kidnapperCreditsChordPlayed) {
        this.kidnapperCreditsChordPlayed = true;
        this.audio.playCreditsThemeChord();
      }
      this.kidnapperCreditsProgress = Math.min(1, (t - 20.8) / 22.0);
    }

    this.flashlight.position.copy(this.camera.position);
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.flashlight.target.position.copy(this.camera.position).addScaledVector(_v1, 9.0);
    this.flashlight.target.updateMatrixWorld();
  }

  private updateAnomalyMode(dt: number): void {
    if (this.anomalyTransformTimer > 0) {
      this.anomalyTransformTimer = Math.max(0, this.anomalyTransformTimer - dt);
    }
    if (this.anomalyAbilityCooldown > 0) {
      this.anomalyAbilityCooldown = Math.max(0, this.anomalyAbilityCooldown - dt);
    }
    if (this.anomalySurgeTimer > 0) {
      this.anomalySurgeTimer = Math.max(0, this.anomalySurgeTimer - dt);
    }
    if (this.anomalyLungeTimer > 0) {
      this.anomalyLungeTimer = Math.max(0, this.anomalyLungeTimer - dt);
    }
    if (this.anomalyShockTimer > 0) {
      this.anomalyShockTimer = Math.max(0, this.anomalyShockTimer - dt);
    }
    if (this.flickerEventTimer > 0) {
      this.flickerEventTimer = Math.max(0, this.flickerEventTimer - dt);
    }

    if (this.anomalyHp <= 0) {
      this.world.updateEnvironment(
        this.totalTime,
        dt,
        false,
        false,
        false,
        false,
        null,
        this.taserFlashTimer,
        false,
        true,
        null,
        0,
      );
      return;
    }

    this.applyArrowKeyLook(dt, 1.15);

    const forwardInput =
      (this.keys['KeyW'] ? 1 : 0) -
      (this.keys['KeyS'] ? 1 : 0);
    const strafeInput =
      (this.keys['KeyD'] ? 1 : 0) -
      (this.keys['KeyA'] ? 1 : 0);
    const tryingToMove = forwardInput !== 0 || strafeInput !== 0;

    const transformFrac = this.anomalyTransformTimer / 1.65;
    const lungeZ = this.anomalyLungeTimer > 0 ? Math.sin((this.anomalyLungeTimer / 0.28) * Math.PI) * 0.22 : 0;
    const sprinting = !this.isCrouching && Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);

    if (this.ownerFreecam) {
      const flySpeed = 6.5 * this.ownerPlayerSpeed;
      const rise = (this.keys['Space'] ? 1 : 0) - (this.keys['KeyC'] ? 1 : 0);
      _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
      this.freecamPos.addScaledVector(_v1, forwardInput * flySpeed * dt);
      this.freecamPos.addScaledVector(_v2, strafeInput * flySpeed * dt);
      this.freecamPos.y = THREE.MathUtils.clamp(this.freecamPos.y + rise * flySpeed * dt, 0.5, 9.5);
      this.camera.position.copy(this.freecamPos);
      this.anomalyHandsGroup.visible = false;
    } else if (this.possessedNpcId && this.possessedNpcSource === 'anomaly') {
      const pNpc = this.anomalyNpcs.find((n) => n.id === this.possessedNpcId && n.state !== 'caught');
      if (!pNpc) {
        this.releasePossession();
      } else {
        const possSpeed = (this.isCrouching ? 2.4 : sprinting ? 5.6 : 3.8) * this.ownerPlayerSpeed;
        if (tryingToMove) {
          _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
          _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
          const mx = _v1.x * forwardInput + _v2.x * strafeInput;
          const mz = _v1.z * forwardInput + _v2.z * strafeInput;
          const len = Math.hypot(mx, mz) || 1;
          const sx = (mx / len) * possSpeed * dt;
          const sz = (mz / len) * possSpeed * dt;
          const moved = movePointWithSchoolCollisions(pNpc.x, pNpc.z, sx, sz, this.world.colliders, 0.3);
          const sep = this.resolvePointAgainstNpcs(
            moved.x,
            moved.z,
            this.anomalyNpcs
              .filter((other) => other.id !== pNpc.id && other.state !== 'caught')
              .map((other) => ({ x: other.x, z: other.z })),
          );
          pNpc.x = sep.x;
          pNpc.z = sep.z;
          this.walkBobPhase += dt * (this.isCrouching ? 6.5 : sprinting ? 13.5 : 9.8);
        }
        pNpc.yaw = this.yaw + Math.PI;
        pNpc.rig.root.position.set(pNpc.x, this.isCrouching ? -0.35 : 0, pNpc.z);
        pNpc.rig.root.rotation.y = pNpc.yaw;
        pNpc.rig.update(
          this.totalTime,
          dt,
          tryingToMove ? (sprinting ? 'hunting' : 'walking') : 'waiting',
          { phaseOffset: pNpc.phaseOffset, isTeacher: pNpc.role === 'guard' },
        );
        const targetEye = this.isCrouching ? 1.05 : 1.62;
        this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 10, dt);
        this.playerPos.set(pNpc.x, this.currentEyeHeight, pNpc.z);
        const bobY = tryingToMove ? Math.sin(this.walkBobPhase) * 0.032 : 0;
        this.camera.position.set(
          pNpc.x - Math.sin(this.yaw) * 0.22,
          this.currentEyeHeight + bobY,
          pNpc.z - Math.cos(this.yaw) * 0.22,
        );
        this.anomalyHandsGroup.visible = false;
      }
    } else if (this.activeHidingSpot) {
      this.hideTransition = Math.min(1, this.hideTransition + dt / 0.36);
      this.hiddenDuration += dt;
      this.hidingMoveNoise = Math.max(0, this.hidingMoveNoise - dt * 1.4);
      if (tryingToMove) this.hidingMoveNoise = Math.min(1.5, this.hidingMoveNoise + dt * 3.0);

      // Hiding in darkness slowly regenerates Anomaly Integrity HP
      if (this.anomalyHp < 100) {
        this.anomalyHp = Math.min(100, this.anomalyHp + dt * 6.5);
      }

      const ease = 1 - Math.pow(1 - this.hideTransition, 3);
      this.currentEyeHeight = THREE.MathUtils.lerp(
        this.hideStartEyeHeight,
        this.activeHidingSpot.position.y,
        ease,
      );
      this.playerPos.set(
        THREE.MathUtils.lerp(this.hideExitPos.x, this.activeHidingSpot.position.x, ease),
        this.currentEyeHeight,
        THREE.MathUtils.lerp(this.hideExitPos.z, this.activeHidingSpot.position.z, ease),
      );

      const targetYawDiff = Math.atan2(
        Math.sin(this.activeHidingSpot.lookYaw - this.yaw),
        Math.cos(this.activeHidingSpot.lookYaw - this.yaw),
      );
      if (this.hideTransition < 0.95) {
        this.yaw += targetYawDiff * Math.min(1, dt * 10);
        this.pitch = THREE.MathUtils.lerp(this.pitch, 0.02, Math.min(1, dt * 10));
      } else {
        const maxOff =
          this.activeHidingSpot.type === 'locker'
            ? 0.22
            : this.activeHidingSpot.type === 'box'
              ? 0.32
              : 0.85;
        const maxPitch = this.activeHidingSpot.type === 'locker' ? 0.22 : 0.32;
        const diff = Math.atan2(
          Math.sin(this.yaw - this.activeHidingSpot.lookYaw),
          Math.cos(this.yaw - this.activeHidingSpot.lookYaw),
        );
        this.yaw = this.activeHidingSpot.lookYaw + THREE.MathUtils.clamp(diff, -maxOff, maxOff);
        this.pitch = THREE.MathUtils.clamp(this.pitch, -maxPitch, maxPitch);
      }
      this.camera.position.copy(this.playerPos);
    } else {
      const surgeBoost = this.anomalySurgeTimer > 0 ? 1.35 : 1.0;
      const shockFactor = this.anomalyShockTimer > 0 ? 0.42 : 1.0;
      const speed =
        (this.isCrouching ? 2.65 : sprinting ? 6.5 : 4.55) *
        surgeBoost *
        shockFactor *
        this.ownerPlayerSpeed;

      if (tryingToMove && this.anomalyTransformTimer <= 0.35) {
        _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const mx = _v1.x * forwardInput + _v2.x * strafeInput;
        const mz = _v1.z * forwardInput + _v2.z * strafeInput;
        const len = Math.hypot(mx, mz) || 1;
        const sx = (mx / len) * speed * dt;
        const sz = (mz / len) * speed * dt;

        this.moveWithCollisions(sx, sz);
        this.walkBobPhase += dt * (this.isCrouching ? 6.8 : sprinting ? 14.5 : 10.5);
        this.stepDistAccum += Math.hypot(sx, sz);
        const stepThreshold = this.isCrouching ? 2.05 : 1.55;
        if (this.stepDistAccum >= stepThreshold) {
          this.stepDistAccum = 0;
          this.audio.playFootstep(sprinting, this.isCrouching);
        }
      }

      const bobAmp = this.isCrouching ? 0.018 : 0.048;
      const idleAmp = this.isCrouching ? 0.005 : 0.014;
      const bobY = tryingToMove ? Math.sin(this.walkBobPhase) * bobAmp : Math.sin(this.totalTime * 1.9) * idleAmp;
      const targetEye = (this.isCrouching ? CROUCH_EYE_HEIGHT : 1.82) - transformFrac * 0.25;
      this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 10, dt);
      this.playerPos.y = this.currentEyeHeight;
      this.camera.position.set(this.playerPos.x, this.currentEyeHeight + bobY, this.playerPos.z);
    }

    const targetFov =
      this.anomalyTransformTimer > 0
        ? 74 + transformFrac * 18
        : this.activeHidingSpot
          ? 64
          : this.anomalySurgeTimer > 0
            ? 82
            : this.isCrouching
              ? 68
              : sprinting
                ? 78
                : 74;
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 9, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.04) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    const shockShake = this.anomalyShockTimer > 0 ? Math.sin(this.totalTime * 48) * 0.045 : 0;
    const rollSway =
      (this.activeHidingSpot || this.possessedNpcId || this.ownerFreecam
        ? 0
        : Math.sin(this.totalTime * 2.1) * 0.018) +
      transformFrac * Math.sin(this.totalTime * 26) * 0.04 +
      shockShake;
    _euler.set(this.pitch, this.yaw, rollSway, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    // Animate first-person anomaly claw hands (hidden when possessing, freecam, or inside locker)
    this.anomalyHandsGroup.visible =
      !this.ownerFreecam &&
      !this.possessedNpcId &&
      (!this.activeHidingSpot || this.activeHidingSpot.type === 'desk');
    const clawBob = tryingToMove ? Math.sin(this.walkBobPhase) * 0.018 : Math.sin(this.totalTime * 2.4) * 0.006;
    const clawOffsetY = this.activeHidingSpot ? -0.08 : this.isCrouching ? -0.025 : 0;
    this.anomalyHandsGroup.position.set(0, clawBob + clawOffsetY, -lungeZ);
    this.anomalyHandsGroup.rotation.x = this.anomalyLungeTimer > 0 ? -0.35 : 0;

    this.flashlight.position.copy(this.camera.position);
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.flashlight.target.position.copy(this.camera.position).addScaledVector(_v1, 5.5);
    this.flashlight.target.updateMatrixWorld();

    // Update school environment (box flaps, locker doors, taser arc flash, corridor flicker)
    this.world.updateEnvironment(
      this.totalTime,
      dt,
      false,
      false,
      false,
      false,
      this.activeHidingSpot ? this.activeHidingSpot.id : null,
      this.taserFlashTimer,
      false,
      this.flickerEventTimer > 0,
      null,
      0,
    );

    // Update Guard Boss & 20 Student NPCs
    const npcEvents = updateAnomalyModeNpcs(
      this.anomalyNpcs,
      dt,
      this.totalTime,
      this.playerPos.x,
      this.playerPos.z,
      this.anomalySurgeTimer > 0,
      this.world.colliders,
      this.scene,
      {
        isCrouching: this.isCrouching,
        isHiding: this.activeHidingSpot !== null,
        isInvisible: this.ownerInvisible || this.possessedNpcId !== null,
        npcsPaused: this.ownerNpcsPaused,
      },
    );

    if (npcEvents.guardTriggeredAlarm) {
      this.audio.playGateBuzz(true);
      this.setBanner('GUARD BOSS SPOTTED YOU — STAY IN COVER OR HIDE [E]!', 'warning', 2.6);
    } else if (npcEvents.guardAimingStarted) {
      this.audio.playElectricalSpark();
      this.setBanner('GUARD BOSS AIMING TASER GUN — CROUCH [C] OR HIDE [E]!', 'danger', 1.8);
    } else if (npcEvents.studentCalledHelp) {
      this.audio.playWhisper(false);
    }

    if (npcEvents.guardFiredTaser) {
      const shot = npcEvents.guardFiredTaser;
      _v1.set(shot.fromX, 1.38, shot.fromZ);
      _v3.set(shot.toX, shot.hit ? this.playerPos.y - 0.12 : 1.18, shot.toZ);
      this.showWorldTaserBeam(_v1, _v3);
      this.taserFlashTimer = 0.28;
      this.world.taserArcLight.position.set(shot.fromX, 1.4, shot.fromZ);
      this.audio.playTaser();

      if (shot.hit) {
        if (this.immortalActive) {
          this.handleDeathProtection('anomaly_taser');
        } else {
          this.anomalyShockTimer = 0.9;
          this.anomalyHp = Math.max(0, this.anomalyHp - 34);
          if (this.anomalyHp <= 0) {
            if (!this.handleDeathProtection('anomaly_taser')) {
              document.exitPointerLock?.();
              this.setBanner('SUBDUED BY THE SECURITY GUARD BOSS TASER!', 'danger', 5.0);
            }
          } else {
            this.setBanner(
              `SHOCKED BY GUARD TASER! (${Math.round(this.anomalyHp)}% HP) — HIDE [E] TO RECOVER!`,
              'danger',
              2.6,
            );
          }
          this.emitHud();
        }
      } else {
        this.setBanner('GUARD TASER MISSED — COVER BLOCKED THE SHOT!', 'success', 2.0);
      }
    }

    // Check Victory once all 20 students & the Guard Boss have finished their elimination fade
    if (
      !this.anomalyVictory &&
      this.anomalyStudentsCaught >= this.anomalyTotalStudents &&
      !this.anomalyGuardBossAlive &&
      this.anomalyNpcs.length === 0
    ) {
      this.anomalyVictory = true;
      document.exitPointerLock?.();
      this.audio.playAnomalySurge();
      this.setBanner('SCHOOL CONQUERED — ALL 20 STUDENTS & THE GUARD BOSS DEFEATED!', 'success', 6.0);
      this.emitHud();
    }

    this.audio.update(dt, {
      playing: true,
      round: 5,
      entityNearby: this.anomalyNpcs.some(
        (n) => n.state !== 'caught' && Math.hypot(n.x - this.playerPos.x, n.z - this.playerPos.z) < 6.0,
      ),
      entityAlerted: this.anomalySurgeTimer > 0,
      isHiding: this.activeHidingSpot !== null,
      sanity: 24,
      backwardsClock: false,
      clockFrozen: false,
    });
  }

  private updateScan(dt: number): void {
    if (this.phase !== 'arrival' || !this.scanning) return;
    this.scanProgress = Math.min(1, this.scanProgress + dt / 1.5);
    if (this.scanProgress >= 1) {
      this.scanning = false;
      this.scanCompleted = true;
      this.audio.playScanDone();
      this.emitHud();
    }
  }

  private updateTaserCharge(_dt: number): void {
    this.handTaserTipMat.emissiveIntensity = this.taserFlashTimer > 0 ? 4.5 : 0.9;
    this.handTaserGroup.position.set(
      0.21,
      THREE.MathUtils.damp(this.handTaserGroup.position.y, -0.17, 14, 0.016),
      THREE.MathUtils.damp(this.handTaserGroup.position.z, -0.4, 14, 0.016),
    );
  }

  private applyArrowKeyLook(dt: number, maxPitch = 1.2): void {
    const yawTurn = (this.keys['ArrowLeft'] ? 1 : 0) - (this.keys['ArrowRight'] ? 1 : 0);
    const pitchTurn = (this.keys['ArrowUp'] ? 1 : 0) - (this.keys['ArrowDown'] ? 1 : 0);
    const yawSpeed = 2.35;
    const pitchSpeed = 1.7;
    if (yawTurn !== 0) {
      this.yaw += yawTurn * yawSpeed * dt;
    }
    if (pitchTurn !== 0) {
      this.pitch += pitchTurn * pitchSpeed * dt;
    }
    this.pitch = THREE.MathUtils.clamp(this.pitch, -maxPitch, maxPitch);
  }

  private resetGuardNpcTransform(x: number, z: number, rigYaw: number): void {
    this.guardNpc.x = x;
    this.guardNpc.z = z;
    this.guardNpc.yaw = rigYaw;
    this.guardNpc.currentNode = findNearestNavNode(x, z);
    this.guardNpc.patrolIdx = 0;
    this.guardNpc.targetNode = GUARD_PATROL_ROUTE[1];
    this.guardNpc.state = 'checkpoint';
    this.guardNpc.pauseTimer = 0;
    this.guardNpc.taserCooldown = 0;
    this.guardNpc.taserAimTimer = 0;
    this.guardNpc.stunTimer = 0;
    this.guardNpc.stuckTimer = 0;
    this.guardNpc.lastCheckX = x;
    this.guardNpc.lastCheckZ = z;
    this.guardNpc.aimTargetUid = null;
    this.guardNpc.rig.root.position.set(x, 0, z);
    this.guardNpc.rig.root.rotation.y = rigYaw;
    this.syncGuardNpcAppearance();
  }

  private syncGuardNpcAppearance(): void {
    const form: Exclude<CharacterTransformTarget, 'original'> =
      this.ownerPlayerForm === 'original' ? 'guard' : this.ownerPlayerForm;
    const hasTaser = this.hasTaserInHand || this.taserTakenFromRoom || form === 'guard';
    const nextKey = `${form}:${hasTaser}`;
    if (this.guardNpc.formKey === nextKey) return;
    this.guardNpc.formKey = nextKey;
    const next = buildTransformedAppearance(form);
    const appearance =
      form === 'guard'
        ? { ...next.appearance, hasTaserProp: hasTaser }
        : next.appearance;
    this.guardNpc.rig.configure(appearance, next.extraFingers);
    const scale = form === 'guard' ? 1.06 : 1.0;
    this.guardNpc.rig.root.scale.set(scale, scale, scale);
  }

  private resolvePointAgainstNpcs(
    x: number,
    z: number,
    obstacles: { x: number; z: number }[],
    minSep = 0.6,
  ): { x: number; z: number } {
    let rx = x;
    let rz = z;
    for (const obs of obstacles) {
      const dx = rx - obs.x;
      const dz = rz - obs.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minSep) {
        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        const push = minSep - dist;
        const nudged = movePointWithSchoolCollisions(rx, rz, nx * push, nz * push, this.world.colliders, 0.3);
        rx = nudged.x;
        rz = nudged.z;
      }
    }
    return { x: rx, z: rz };
  }

  private updateSchoolGuardNpcAi(dt: number): void {
    const g = this.guardNpc;
    this.syncGuardNpcAppearance();
    g.rig.root.visible = true;

    if (g.taserCooldown > 0) g.taserCooldown = Math.max(0, g.taserCooldown - dt);
    if (g.stunTimer > 0) {
      g.stunTimer = Math.max(0, g.stunTimer - dt);
      g.state = 'stunned';
      g.rig.root.position.set(g.x, 0, g.z);
      g.rig.update(this.totalTime, dt, 'stunned', { isTeacher: true, phaseOffset: 0.25 });
      if (g.stunTimer <= 0) g.state = 'patrol';
      return;
    }

    if (this.ownerNpcsPaused || g.frozen || g.behaviorOverride === 'stand') {
      g.rig.root.position.set(g.x, 0, g.z);
      g.rig.root.rotation.y = g.yaw;
      g.rig.update(this.totalTime, dt, 'waiting', { isTeacher: true, phaseOffset: 0.25 });
      return;
    }

    const speedMult = g.speedMultiplier || 1.0;

    // Hunt / Classtime anomaly detection & taser engagement by Security Guard NPC
    if (g.behaviorOverride === 'default' && (this.phase === 'hunt' || this.phase === 'classtime')) {
      let bestAnomaly: LiveActorSlot | null = null;
      let bestDist = this.phase === 'hunt' ? 12.5 : 8.5;
      for (const s of this.actorSlots) {
        if (!s.data.isFake || s.data.state === 'fled' || s.data.state === 'victimized') continue;
        if (this.phase === 'classtime' && s.data.state !== 'reveal') continue;
        if (this.phase === 'hunt' && s.stunTimer > 0) continue;
        const d = Math.hypot(s.data.pos.x - g.x, s.data.pos.z - g.z);
        if (d < bestDist) {
          const los = traceBossLineOfSight(g.x, g.z, s.data.pos.x, s.data.pos.z, this.world.colliders, false);
          if (los.clear || d < 3.4) {
            bestDist = d;
            bestAnomaly = s;
          }
        }
      }

      if (bestAnomaly && this.phase === 'hunt') {
        const dx = bestAnomaly.data.pos.x - g.x;
        const dz = bestAnomaly.data.pos.z - g.z;
        const los = traceBossLineOfSight(
          g.x,
          g.z,
          bestAnomaly.data.pos.x,
          bestAnomaly.data.pos.z,
          this.world.colliders,
          false,
        );
        if (bestDist <= 8.6 && los.clear && g.taserCooldown <= 0) {
          g.state = 'taser_aim';
          g.aimTargetUid = bestAnomaly.data.uid;
          g.taserAimTimer += dt;
          const aimYaw = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(aimYaw - g.yaw), Math.cos(aimYaw - g.yaw));
          g.yaw += diff * Math.min(1, dt * 10);
          g.rig.root.position.set(g.x, 0, g.z);
          g.rig.root.rotation.y = g.yaw;
          g.rig.update(this.totalTime, dt, 'taser_aim', { isTeacher: true, phaseOffset: 0.25 });

          if (g.taserAimTimer >= 0.65) {
            g.taserAimTimer = 0;
            g.taserCooldown = 3.2;
            _v1.set(g.x, 1.38, g.z);
            _v2.set(bestAnomaly.data.pos.x, 1.25, bestAnomaly.data.pos.z);
            this.showWorldTaserBeam(_v1, _v2);
            this.taserFlashTimer = 0.26;
            this.world.taserArcLight.position.set(g.x, 1.4, g.z);
            this.audio.playTaser();

            if (bestAnomaly.possessed) {
              if (this.immortalActive) {
                this.immortalShieldFlash = 0.65;
                this.audio.playImmortalShield();
                this.setBanner('SECURITY GUARD FIRED TASER — IMMORTAL SHIELD ABSORBED IT!', 'warning', 2.4);
              } else {
                this.setBanner('SECURITY GUARD DETECTED & ZAPPED YOUR POSSESSED ANOMALY!', 'danger', 2.6);
                this.releasePossession();
              }
            } else {
              bestAnomaly.stunTimer = 2.8;
              bestAnomaly.data.state = 'stunned';
              bestAnomaly.data.taserHits++;
              if (bestAnomaly.data.taserHits >= 2) {
                bestAnomaly.data.state = 'fled';
                this.fakesStopped++;
                this.recordCaseLogByUid(bestAnomaly.data.uid, 'banished');
                this.setBanner(
                  `SECURITY GUARD NPC BANISHED ${bestAnomaly.data.name.toUpperCase()}!`,
                  'success',
                  3.0,
                );
                this.checkHuntCleared();
              } else {
                this.setBanner(
                  `SECURITY GUARD NPC ZAPPED ${bestAnomaly.data.name.toUpperCase()}!`,
                  'success',
                  2.4,
                );
              }
            }
          }
          return;
        }
      }
      g.taserAimTimer = 0;
    }

    if (g.pauseTimer > 0 && g.behaviorOverride === 'default') {
      g.pauseTimer = Math.max(0, g.pauseTimer - dt);
      g.rig.root.position.set(g.x, 0, g.z);
      g.rig.root.rotation.y = g.yaw;
      g.rig.update(this.totalTime, dt, 'waiting', { isTeacher: true, phaseOffset: 0.25 });
      return;
    }

    g.currentNode = findNearestNavNode(g.x, g.z);

    if (g.behaviorOverride === 'follow') {
      const distP = Math.hypot(this.playerPos.x - g.x, this.playerPos.z - g.z);
      if (distP < 1.85) {
        g.rig.root.position.set(g.x, 0, g.z);
        g.rig.root.rotation.y = g.yaw;
        g.rig.update(this.totalTime, dt, 'waiting', { isTeacher: true, phaseOffset: 0.25 });
        return;
      }
      g.targetNode = findNearestNavNode(this.playerPos.x, this.playerPos.z);
    } else if (g.behaviorOverride === 'flee') {
      let farNode = g.currentNode;
      let farDist = -1;
      for (let i = 0; i < SCHOOL_NAV_NODES.length; i++) {
        const d = Math.hypot(SCHOOL_NAV_NODES[i].x - this.playerPos.x, SCHOOL_NAV_NODES[i].z - this.playerPos.z);
        if (d > farDist) {
          farDist = d;
          farNode = i;
        }
      }
      g.targetNode = farNode;
    } else if (this.phase === 'arrival') {
      // Guard patrols checkpoint window and CCTV desk in Checking Room
      const checkpointTargets = [
        { x: -0.35, z: -0.55 },
        { x: 0.72, z: -0.1 },
        { x: -0.2, z: 0.9 },
      ];
      if (g.currentNode !== 0 && Math.hypot(g.x - (-0.2), g.z - 0.7) > 2.2) {
        g.targetNode = 0;
      } else {
        const spot = checkpointTargets[g.patrolIdx % checkpointTargets.length];
        const dx = spot.x - g.x;
        const dz = spot.z - g.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.28) {
          g.patrolIdx = (g.patrolIdx + 1) % checkpointTargets.length;
          g.pauseTimer = 1.1;
          const lookYaw = Math.atan2(-0.55 - g.x, -3.55 - g.z);
          g.yaw = lookYaw;
          g.rig.root.rotation.y = g.yaw;
          g.rig.update(this.totalTime, dt, 'waiting', { isTeacher: true, phaseOffset: 0.25 });
        } else {
          const moved = movePointWithSchoolCollisions(
            g.x,
            g.z,
            (dx / d) * 1.85 * speedMult * dt,
            (dz / d) * 1.85 * speedMult * dt,
            this.world.colliders,
            0.3,
          );
          g.x = moved.x;
          g.z = moved.z;
          g.rig.root.position.set(g.x, 0, g.z);
          const tYaw = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(tYaw - g.yaw), Math.cos(tYaw - g.yaw));
          g.yaw += diff * Math.min(1, dt * 7);
          g.rig.root.rotation.y = g.yaw;
          g.rig.update(this.totalTime, dt, 'walking', { isTeacher: true, phaseOffset: 0.25 });
        }
        return;
      }
    } else {
      // Classtime / Hunt patrol across school corridors & classrooms
      const chasingFake =
        this.phase === 'hunt' &&
        this.actorSlots.find((s) => s.data.isFake && s.data.state !== 'fled' && s.stunTimer <= 0);
      if (chasingFake && Math.hypot(chasingFake.data.pos.x - g.x, chasingFake.data.pos.z - g.z) < 12.5) {
        g.state = 'chase';
        g.targetNode = findNearestNavNode(chasingFake.data.pos.x, chasingFake.data.pos.z);
      } else {
        g.state = 'patrol';
        const goal = SCHOOL_NAV_NODES[g.targetNode];
        if (Math.hypot(goal.x - g.x, goal.z - g.z) < 0.68) {
          g.patrolIdx = (g.patrolIdx + 1) % GUARD_PATROL_ROUTE.length;
          g.targetNode = GUARD_PATROL_ROUTE[g.patrolIdx];
          g.pauseTimer = 0.55;
        }
      }
    }

    const nextHopIdx = findNextHopBfs(g.currentNode, g.targetNode);
    const hop = SCHOOL_NAV_NODES[nextHopIdx];
    const dx = hop.x - g.x;
    const dz = hop.z - g.z;
    const hopDist = Math.hypot(dx, dz) || 1;
    const baseSpeed = g.state === 'chase' || g.behaviorOverride === 'flee' ? 3.15 : 2.35;
    const speed = baseSpeed * speedMult;
    const moved = movePointWithSchoolCollisions(
      g.x,
      g.z,
      (dx / hopDist) * speed * dt,
      (dz / hopDist) * speed * dt,
      this.world.colliders,
      0.3,
    );
    g.x = moved.x;
    g.z = moved.z;
    g.rig.root.position.set(g.x, 0, g.z);
    const tYaw = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(tYaw - g.yaw), Math.cos(tYaw - g.yaw));
    g.yaw += diff * Math.min(1, dt * 8);
    g.rig.root.rotation.y = g.yaw;

    g.stuckTimer += dt;
    if (g.stuckTimer >= 0.85) {
      const disp = Math.hypot(g.x - g.lastCheckX, g.z - g.lastCheckZ);
      g.lastCheckX = g.x;
      g.lastCheckZ = g.z;
      g.stuckTimer = 0;
      if (disp < 0.14) {
        g.patrolIdx = (g.patrolIdx + 1) % GUARD_PATROL_ROUTE.length;
        g.targetNode = GUARD_PATROL_ROUTE[g.patrolIdx];
      }
    }

    g.rig.update(this.totalTime, dt, g.state === 'chase' ? 'hunting' : 'walking', {
      isTeacher: true,
      phaseOffset: 0.25,
    });
  }

  private updatePlayer(dt: number): void {
    this.applyArrowKeyLook(dt, 1.2);

    // WASD moves forward, back, left, right; Arrow keys look left, right, up, down
    const forwardInput =
      (this.keys['KeyW'] ? 1 : 0) -
      (this.keys['KeyS'] ? 1 : 0);
    const strafeInput =
      (this.keys['KeyD'] ? 1 : 0) -
      (this.keys['KeyA'] ? 1 : 0);
    const tryingToMove = forwardInput !== 0 || strafeInput !== 0;

    if (this.ownerFreecam) {
      const flySpeed = 6.5 * this.ownerPlayerSpeed;
      const rise = (this.keys['Space'] ? 1 : 0) - (this.keys['KeyC'] ? 1 : 0);
      _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
      this.freecamPos.addScaledVector(_v1, forwardInput * flySpeed * dt);
      this.freecamPos.addScaledVector(_v2, strafeInput * flySpeed * dt);
      this.freecamPos.y = THREE.MathUtils.clamp(this.freecamPos.y + rise * flySpeed * dt, 0.5, 9.5);
      this.camera.position.copy(this.freecamPos);
      this.updateSchoolGuardNpcAi(dt);
    } else if (this.possessedNpcId && this.possessedNpcSource === 'classroom') {
      const slot = this.actorSlots.find(
        (s) => s.data.uid === this.possessedNpcId && s.data.state !== 'fled' && s.data.state !== 'victimized',
      );
      if (!slot) {
        this.releasePossession();
      } else {
        const sprinting = !this.isCrouching && Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
        const possSpeed = (this.isCrouching ? 1.85 : sprinting ? 4.85 : 3.25) * this.ownerPlayerSpeed;
        if (tryingToMove) {
          _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
          _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
          const mx = _v1.x * forwardInput + _v2.x * strafeInput;
          const mz = _v1.z * forwardInput + _v2.z * strafeInput;
          const len = Math.hypot(mx, mz) || 1;
          const sx = (mx / len) * possSpeed * dt;
          const sz = (mz / len) * possSpeed * dt;
          const moved = movePointWithSchoolCollisions(slot.data.pos.x, slot.data.pos.z, sx, sz, this.world.colliders, 0.3);
          const sep = this.resolvePointAgainstNpcs(moved.x, moved.z, [
            { x: this.guardNpc.x, z: this.guardNpc.z },
          ]);
          slot.data.pos.x = sep.x;
          slot.data.pos.z = sep.z;
          this.walkBobPhase += dt * (this.isCrouching ? 6.5 : sprinting ? 12.5 : 9.0);
        }
        slot.data.yaw = this.yaw + Math.PI;
        slot.rig.root.position.set(slot.data.pos.x, this.isCrouching ? -0.35 : 0, slot.data.pos.z);
        slot.rig.root.rotation.y = slot.data.yaw;
        slot.rig.update(
          this.totalTime,
          dt,
          tryingToMove ? (sprinting ? 'hunting' : 'walking') : 'waiting',
          { phaseOffset: slot.phaseOffset, isTeacher: slot.data.role === 'teacher' },
        );
        const targetEye = this.isCrouching ? 1.0 : 1.62;
        this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 10, dt);
        this.playerPos.set(slot.data.pos.x, this.currentEyeHeight, slot.data.pos.z);
        const bobY = tryingToMove ? Math.sin(this.walkBobPhase) * 0.03 : 0;
        this.camera.position.set(
          slot.data.pos.x - Math.sin(this.yaw) * 0.22,
          this.currentEyeHeight + bobY,
          slot.data.pos.z - Math.cos(this.yaw) * 0.22,
        );
        // Security Guard remains active, visible, and AI-controlled in the school while player possesses another NPC
        this.updateSchoolGuardNpcAi(dt);
      }
    } else if (this.activeHidingSpot) {
      this.hideTransition = Math.min(1, this.hideTransition + dt / 0.36);
      this.hiddenDuration += dt;
      this.hidingMoveNoise = Math.max(0, this.hidingMoveNoise - dt * 1.4);
      if (tryingToMove) this.hidingMoveNoise = Math.min(1.5, this.hidingMoveNoise + dt * 3.0);

      // Smoothly glide camera inside cardboard box/locker or lower down under desk
      const ease = 1 - Math.pow(1 - this.hideTransition, 3);
      this.currentEyeHeight = THREE.MathUtils.lerp(
        this.hideStartEyeHeight,
        this.activeHidingSpot.position.y,
        ease,
      );
      this.playerPos.set(
        THREE.MathUtils.lerp(this.hideExitPos.x, this.activeHidingSpot.position.x, ease),
        this.currentEyeHeight,
        THREE.MathUtils.lerp(this.hideExitPos.z, this.activeHidingSpot.position.z, ease),
      );

      // Smoothly turn toward the hiding spot's outward/peephole direction, then clamp look
      const targetYawDiff = Math.atan2(
        Math.sin(this.activeHidingSpot.lookYaw - this.yaw),
        Math.cos(this.activeHidingSpot.lookYaw - this.yaw),
      );
      if (this.hideTransition < 0.95) {
        this.yaw += targetYawDiff * Math.min(1, dt * 10);
        this.pitch = THREE.MathUtils.lerp(this.pitch, 0.02, Math.min(1, dt * 10));
      } else {
        const maxOff =
          this.activeHidingSpot.type === 'locker'
            ? 0.22
            : this.activeHidingSpot.type === 'box'
              ? 0.32
              : 0.85;
        const maxPitch = this.activeHidingSpot.type === 'locker' ? 0.22 : 0.32;
        const diff = Math.atan2(
          Math.sin(this.yaw - this.activeHidingSpot.lookYaw),
          Math.cos(this.yaw - this.activeHidingSpot.lookYaw),
        );
        this.yaw = this.activeHidingSpot.lookYaw + THREE.MathUtils.clamp(diff, -maxOff, maxOff);
        this.pitch = THREE.MathUtils.clamp(this.pitch, -maxPitch, maxPitch);
      }

      this.camera.position.copy(this.playerPos);
    } else {
      const targetEyeHeight = this.isCrouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
      this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEyeHeight, 10, dt);
      this.playerPos.y = this.currentEyeHeight;

      const sprinting = !this.isCrouching && Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
      const speed = (this.isCrouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED) * this.ownerPlayerSpeed;

      if (tryingToMove) {
        _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const mx = _v1.x * forwardInput + _v2.x * strafeInput;
        const mz = _v1.z * forwardInput + _v2.z * strafeInput;
        const len = Math.hypot(mx, mz) || 1;
        const sx = (mx / len) * speed * dt;
        const sz = (mz / len) * speed * dt;

        this.moveWithCollisions(sx, sz);
        this.walkBobPhase += dt * (this.isCrouching ? 6.5 : sprinting ? 13 : 9);
        this.stepDistAccum += Math.hypot(sx, sz);
        const stepThreshold = this.isCrouching ? 2.05 : sprinting ? 1.45 : 1.75;
        if (this.stepDistAccum >= stepThreshold) {
          this.stepDistAccum = 0;
          this.audio.playFootstep(sprinting, this.isCrouching);
        }
      }

      const bobAmp = this.isCrouching ? 0.018 : 0.04;
      const idleAmp = this.isCrouching ? 0.004 : 0.008;
      const bobY = tryingToMove ? Math.sin(this.walkBobPhase) * bobAmp : Math.sin(this.totalTime * 1.4) * idleAmp;
      this.camera.position.set(this.playerPos.x, this.currentEyeHeight + bobY, this.playerPos.z);

      // Sync Security Guard 3D model to player position while player directly controls the Guard
      this.syncGuardNpcAppearance();
      this.guardNpc.x = this.playerPos.x;
      this.guardNpc.z = this.playerPos.z;
      this.guardNpc.yaw = this.yaw + Math.PI;
      this.guardNpc.rig.root.position.set(this.guardNpc.x, this.isCrouching ? -0.35 : 0, this.guardNpc.z);
      this.guardNpc.rig.root.rotation.y = this.guardNpc.yaw;
      const guardAnim =
        this.taserFlashTimer > 0 || this.isChargingTaser
          ? 'taser_aim'
          : tryingToMove
            ? sprinting
              ? 'hunting'
              : 'walking'
            : 'waiting';
      this.guardNpc.rig.update(this.totalTime, dt, guardAnim, { isTeacher: true, phaseOffset: 0.25 });
    }

    const sanityStrain = this.sanity < 45 ? Math.min(1, (45 - this.sanity) / 45) : 0;
    const microRoll = sanityStrain > 0 ? Math.sin(this.totalTime * 1.15) * 0.008 * sanityStrain : 0;
    const targetFov = sanityStrain > 0 ? 65 + Math.sin(this.totalTime * 1.4) * 1.8 * sanityStrain : 65;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    _euler.set(this.pitch, this.yaw, microRoll, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    this.flashlight.position.copy(this.camera.position);
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.flashlight.target.position.copy(this.camera.position).addScaledVector(_v1, 5.0);
    this.flashlight.target.updateMatrixWorld();
  }

  private moveWithCollisions(dx: number, dz: number): void {
    const blocked = (nx: number, nz: number): boolean => {
      if (nx < -2.35 || nx > 10.45 || nz < -2.2 || nz > 24.3) return true;
      if (nz < -2.1 && nx > 0.9) return true;
      if (this.room101Locked && nx > 2.25 && nz > 7.8 && nz < 11.2) return true;
      if (this.room102Locked && nx > 2.25 && nz > 16.3 && nz < 19.7) return true;
      for (const box of this.world.colliders) {
        if (
          nx + PLAYER_RADIUS > box.minX &&
          nx - PLAYER_RADIUS < box.maxX &&
          nz + PLAYER_RADIUS > box.minZ &&
          nz - PLAYER_RADIUS < box.maxZ
        ) {
          return true;
        }
      }
      return false;
    };
    const steps = Math.max(1, Math.min(6, Math.ceil(Math.hypot(dx, dz) / 0.18)));
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      if (!blocked(this.playerPos.x + sx, this.playerPos.z)) this.playerPos.x += sx;
      if (!blocked(this.playerPos.x, this.playerPos.z + sz)) this.playerPos.z += sz;
    }
  }

  private updateDepartingActors(dt: number): void {
    for (let i = this.departingActors.length - 1; i >= 0; i--) {
      const d = this.departingActors[i];
      d.timer -= dt;
      d.z -= 1.85 * dt;
      d.rig.root.position.set(d.x, 0, d.z);
      d.rig.root.rotation.y = Math.PI;
      d.rig.update(this.totalTime, dt, 'walking', {});
      if (d.timer <= 0 || d.z <= -8.1) {
        this.scene.remove(d.rig.root);
        d.rig.dispose();
        this.departingActors.splice(i, 1);
      }
    }
  }

  private computeCameraStareOffsets(slot: LiveActorSlot): { yawOff: number; pitchOff: number } {
    const camPos =
      slot.data.room === 'room101'
        ? this.cctvCameras.cam101.position
        : this.cctvCameras.cam102.position;
    const dx = camPos.x - slot.data.pos.x;
    const dy = camPos.y - (slot.data.role === 'teacher' ? 1.5 : 1.15);
    const dz = camPos.z - slot.data.pos.z;
    const worldYaw = Math.atan2(dx, dz);
    const yawDiff = Math.atan2(
      Math.sin(worldYaw - slot.data.yaw),
      Math.cos(worldYaw - slot.data.yaw),
    );
    const horiz = Math.hypot(dx, dz) || 1;
    const pitchUp = -Math.atan2(dy, horiz);
    return {
      yawOff: THREE.MathUtils.clamp(yawDiff, -1.05, 1.05),
      pitchOff: THREE.MathUtils.clamp(pitchUp, -0.55, 0.15),
    };
  }

  private updateClassroomSlotBehavior(slot: LiveActorSlot, dt: number): void {
    const isTeacher = slot.data.role === 'teacher';
    const bbZ = slot.data.room === 'room101' ? 9.3 : 17.7;

    if (slot.data.state === 'walking_to_seat') {
      const wp = slot.seatWaypoints[0];
      if (!wp) {
        slot.data.state = isTeacher ? 'teaching' : 'seated';
        slot.data.yaw = slot.targetSeatYaw;
        slot.rig.root.rotation.y = slot.data.yaw;
        slot.rig.update(this.totalTime, dt, isTeacher ? 'teaching' : 'seated', {
          noBlinking: slot.data.isFake,
          phaseOffset: slot.phaseOffset,
        });
        return;
      }
      if (this.steerSlotToward(slot, wp, 1.85, dt)) {
        slot.seatWaypoints.shift();
        if (slot.seatWaypoints.length === 0) {
          slot.data.state = isTeacher ? 'teaching' : 'seated';
          slot.data.yaw = slot.targetSeatYaw;
          slot.rig.root.rotation.y = slot.data.yaw;
        }
      }
      slot.rig.update(this.totalTime, dt, 'walking', {
        noBlinking: slot.data.isFake,
        phaseOffset: slot.phaseOffset,
      });
      return;
    }

    slot.seatedTime += dt;

    // Fake anomalies blend in briefly after taking their seat, then exhibit subtle strange CCTV behavior
    if (slot.data.isFake && this.phase === 'classtime') {
      if (slot.seatedTime >= 2.2) {
        slot.data.state = 'reveal';
      }
      if (slot.data.state === 'reveal') {
        if (isTeacher) {
          slot.data.yaw = THREE.MathUtils.damp(slot.data.yaw, -Math.PI / 2, 5, dt);
          slot.rig.root.rotation.y = slot.data.yaw;
        }
        const stare = this.computeCameraStareOffsets(slot);
        slot.rig.update(this.totalTime, dt, 'reveal', {
          noBlinking: true,
          isTeacher,
          revealBehavior: slot.data.revealBehavior,
          stareYawOffset: stare.yawOff,
          starePitchOffset: stare.pitchOff,
        });
        return;
      }
    }

    // Real Student classroom cycle: take notes, listen, sometimes whisper or yawn
    if (!isTeacher) {
      slot.studentActionTimer -= dt;
      if (slot.studentActionTimer <= 0) {
        const roll = Math.random();
        if (roll < 0.45) {
          slot.studentAction = 'taking_notes';
          slot.studentActionTimer = 4.5 + Math.random() * 3.5;
        } else if (roll < 0.72) {
          slot.studentAction = 'listening';
          slot.studentActionTimer = 3.0 + Math.random() * 2.5;
        } else if (roll < 0.87) {
          slot.studentAction = 'whispering';
          slot.studentActionTimer = 2.2 + Math.random() * 1.0;
        } else {
          slot.studentAction = 'yawning';
          slot.studentActionTimer = 2.2;
        }
      }
      slot.data.yaw = THREE.MathUtils.damp(slot.data.yaw, Math.PI / 2, 6, dt);
      slot.rig.root.rotation.y = slot.data.yaw;
      slot.rig.update(this.totalTime, dt, 'seated', {
        noBlinking: slot.data.isFake,
        studentAction: slot.data.isFake ? 'taking_notes' : slot.studentAction,
        phaseOffset: slot.phaseOffset,
      });
      return;
    }

    // Real Teacher classroom cycle: teach, write on blackboard, walk around room
    slot.teacherActionTimer -= dt;
    if (slot.teacherActionTimer <= 0) {
      if (slot.teacherAction === 'lecturing') {
        slot.teacherAction = 'writing_board';
        slot.teacherActionTimer = 4.5 + Math.random() * 2.0;
      } else if (slot.teacherAction === 'writing_board') {
        slot.teacherAction = 'walking_around';
        slot.teacherActionTimer = 5.5 + Math.random() * 2.0;
        slot.teacherPatrolIdx = 0;
      } else {
        slot.teacherAction = 'lecturing';
        slot.teacherActionTimer = 4.5 + Math.random() * 2.0;
      }
    }

    if (slot.teacherAction === 'writing_board') {
      _v1.set(9.88, 0, bbZ + Math.sin(this.totalTime * 0.25) * 0.45);
      const arrived = this.steerSlotToward(slot, _v1, 1.35, dt);
      if (arrived) {
        slot.data.yaw = THREE.MathUtils.damp(slot.data.yaw, Math.PI / 2, 6, dt);
        slot.rig.root.rotation.y = slot.data.yaw;
      }
      slot.rig.update(this.totalTime, dt, 'teaching', {
        noBlinking: slot.data.isFake,
        teacherAction: arrived ? 'writing_board' : 'walking_around',
        phaseOffset: slot.phaseOffset,
      });
    } else if (slot.teacherAction === 'walking_around') {
      const patrolTargets = [
        { x: 8.35, z: bbZ - 1.1 },
        { x: 6.05, z: bbZ },
        { x: 8.35, z: bbZ + 1.1 },
        { x: 8.35, z: bbZ },
      ];
      const pt = patrolTargets[slot.teacherPatrolIdx % patrolTargets.length];
      if (this.steerSlotToward(slot, _v1.set(pt.x, 0, pt.z), 1.2, dt)) {
        slot.teacherPatrolIdx = (slot.teacherPatrolIdx + 1) % patrolTargets.length;
      }
      slot.rig.update(this.totalTime, dt, 'teaching', {
        noBlinking: slot.data.isFake,
        teacherAction: 'walking_around',
        phaseOffset: slot.phaseOffset,
      });
    } else {
      _v1.set(8.35, 0, bbZ);
      const arrived = this.steerSlotToward(slot, _v1, 1.3, dt);
      if (arrived) {
        slot.data.yaw = THREE.MathUtils.damp(slot.data.yaw, -Math.PI / 2, 6, dt);
        slot.rig.root.rotation.y = slot.data.yaw;
      }
      slot.rig.update(this.totalTime, dt, 'teaching', {
        noBlinking: slot.data.isFake,
        teacherAction: arrived ? 'lecturing' : 'walking_around',
        phaseOffset: slot.phaseOffset,
      });
    }
  }

  private updateArrivalAndActors(dt: number): void {
    this.updateDepartingActors(dt);

    if (this.phase === 'arrival') {
      const p = this.getCurrentArrival();
      if (p) {
        this.arrivalRig.update(this.totalTime, dt, 'waiting', {
          noBlinking: p.noBlinking,
          unnaturallyStill: p.unnaturallyStill,
          nervousBreathing: p.bodyScan.heartbeatBpm > 88,
        });
      }
      for (const slot of this.actorSlots) {
        if (slot.data.state === 'fled' || slot.data.state === 'victimized') continue;
        this.updateClassroomSlotBehavior(slot, dt);
      }
      return;
    }

    if (this.phase === 'classtime') {
      this.classTimer += dt;
      const fakes = this.actorSlots.filter(
        (s) => s.data.isFake && s.data.state !== 'fled' && s.data.state !== 'victimized',
      );
      const anyoneStillWalking = this.actorSlots.some((s) => s.data.state === 'walking_to_seat');

      if (!anyoneStillWalking || this.classTimer >= 10.0) {
        this.classObservationTimer += dt;
      }

      if (fakes.length > 0 && this.classObservationTimer >= 15.0) {
        this.phase = 'hunt';
        this.sanity = Math.max(0, this.sanity - 5);
        fakes.forEach((f) => {
          f.data.state = 'hunting';
          f.attackTimer = 12.5;
        });
        this.audio.playGateBuzz(true);
        this.setBanner(
          'ANOMALY HUNTING! PRESS T IN CHECKING ROOM TO EQUIP TASER — HOLD R (2s) TO SHOOT!',
          'danger',
          5.0,
        );
      } else if (fakes.length === 0 && (this.actorSlots.length === 0 ? this.classTimer >= 6.0 : this.classObservationTimer >= 12.0)) {
        this.finishDay();
        return;
      }
    }

    // Update all live 3D classroom/hunt actors
    for (const slot of this.actorSlots) {
      if (slot.data.state === 'fled' || slot.data.state === 'victimized') {
        slot.rig.update(this.totalTime, dt, 'hidden', {});
        continue;
      }

      if (slot.possessed) {
        continue;
      }
      if (slot.frozen) {
        slot.rig.update(this.totalTime, dt, 'waiting', {
          noBlinking: slot.data.isFake,
          phaseOffset: slot.phaseOffset,
        });
        continue;
      }

      const npcSpeedMult = slot.speedMultiplier ?? 1.0;

      // Owner Mode custom behavior override (works safely in classtime and hunt)
      if (slot.behaviorOverride && slot.behaviorOverride !== 'default') {
        if (slot.behaviorOverride === 'stand') {
          slot.rig.update(this.totalTime, dt, 'waiting', {
            noBlinking: slot.data.isFake,
            phaseOffset: slot.phaseOffset,
          });
          continue;
        }
        if (slot.behaviorOverride === 'follow') {
          const distP = Math.hypot(this.playerPos.x - slot.data.pos.x, this.playerPos.z - slot.data.pos.z);
          if (distP > 1.75) {
            this.steerSlotToward(slot, _v1.set(this.playerPos.x, 0, this.playerPos.z), 3.1 * npcSpeedMult, dt);
            slot.rig.update(this.totalTime, dt, 'walking', {
              noBlinking: slot.data.isFake,
              phaseOffset: slot.phaseOffset,
            });
          } else {
            slot.rig.update(this.totalTime, dt, 'waiting', {
              noBlinking: slot.data.isFake,
              phaseOffset: slot.phaseOffset,
            });
          }
          continue;
        }
        if (slot.behaviorOverride === 'flee') {
          const farWp = HUNT_WAYPOINTS.reduce((best, wp) =>
            Math.hypot(wp.x - this.playerPos.x, wp.z - this.playerPos.z) >
            Math.hypot(best.x - this.playerPos.x, best.z - this.playerPos.z)
              ? wp
              : best,
          );
          const arrived = this.steerSlotToward(slot, farWp, 3.6 * npcSpeedMult, dt);
          slot.rig.update(this.totalTime, dt, arrived ? 'waiting' : 'hunting', {
            noBlinking: slot.data.isFake,
            phaseOffset: slot.phaseOffset,
          });
          continue;
        }
        if (slot.behaviorOverride === 'patrol') {
          const wp = HUNT_WAYPOINTS[slot.waypointIdx];
          if (this.steerSlotToward(slot, wp, 2.2 * npcSpeedMult, dt)) {
            slot.waypointIdx = (slot.waypointIdx + 1) % HUNT_WAYPOINTS.length;
          }
          slot.rig.update(this.totalTime, dt, 'walking', {
            noBlinking: slot.data.isFake,
            phaseOffset: slot.phaseOffset,
          });
          continue;
        }
      }

      if (this.phase === 'classtime' || !slot.data.isFake) {
        if (slot.stunTimer > 0) {
          slot.stunTimer -= dt;
          slot.data.state = 'stunned';
          slot.rig.update(this.totalTime, dt, 'stunned', {});
          if (slot.stunTimer <= 0) {
            slot.data.state = slot.data.isFake ? 'reveal' : slot.data.role === 'teacher' ? 'teaching' : 'seated';
          }
          continue;
        }
        this.updateClassroomSlotBehavior(slot, dt * npcSpeedMult);
        continue;
      }

      // HUNT AI for Fake
      if (slot.stunTimer > 0) {
        slot.stunTimer -= dt;
        slot.data.state = 'stunned';
        slot.rig.update(this.totalTime, dt, 'stunned', {});
        if (slot.stunTimer <= 0) slot.data.state = 'hunting';
        continue;
      }

      const guardIsControlledByPlayer = !this.possessedNpcId;
      const targetX = guardIsControlledByPlayer ? this.playerPos.x : this.guardNpc.x;
      const targetZ = guardIsControlledByPlayer ? this.playerPos.z : this.guardNpc.z;
      const dx = targetX - slot.data.pos.x;
      const dz = targetZ - slot.data.pos.z;
      const distToGuard = Math.hypot(dx, dz);
      const playerHidden = guardIsControlledByPlayer
        ? this.activeHidingSpot !== null || this.ownerInvisible
        : false;
      const nearCover = guardIsControlledByPlayer && this.isCrouching && this.isNearCover();
      const playerMoving =
        guardIsControlledByPlayer &&
        Boolean(
          this.keys['KeyW'] ||
            this.keys['KeyS'] ||
            this.keys['KeyA'] ||
            this.keys['KeyD'],
        );
      const playerSprinting =
        guardIsControlledByPlayer &&
        !this.isCrouching &&
        playerMoving &&
        Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
      const detectRange =
        guardIsControlledByPlayer && this.ownerInvisible
          ? -1
          : guardIsControlledByPlayer && this.isCrouching
            ? nearCover
              ? 2.8
              : 4.8
            : playerSprinting
              ? 10.8
              : 9.5;
      const madeNoise =
        guardIsControlledByPlayer && !this.ownerInvisible && playerHidden && this.hidingMoveNoise > 0.35;

      // Victim harm timer ticks while anomaly is roaming free
      slot.attackTimer -= dt;
      if (slot.attackTimer <= 0) {
        const victim = this.actorSlots.find(
          (other) => !other.data.isFake && other.data.state !== 'victimized',
        );
        if (victim) {
          victim.data.state = 'victimized';
          this.casualties++;
          this.sanity = Math.max(0, this.sanity - 7);
          this.phase = 'cutaway';
          this.cutawayTimer = 1.9;
          this.cutawayText = `[CAMERA SIGNAL LOST — ${victim.data.name.toUpperCase()} ATTACKED IN ${
            victim.data.room === 'room101' ? 'ROOM 101' : 'ROOM 102'
          }]`;
          this.audio.playGateBuzz(true);
          this.audio.playDoorCreak();
          slot.attackTimer = 14.0;
          this.emitHud();
          return;
        }
      }

      if (slot.passCooldown > 0) {
        slot.passCooldown = Math.max(0, slot.passCooldown - dt);
      }
      if (guardIsControlledByPlayer && !this.ownerInvisible && playerHidden && distToGuard < 4.8) {
        slot.closeToHiddenTimer += dt;
      } else {
        slot.closeToHiddenTimer = Math.max(0, slot.closeToHiddenTimer - dt * 2.0);
      }

      if (!playerHidden && distToGuard < detectRange) {
        // Chase Security Guard (whether player-controlled or AI Guard NPC during possession)
        this.steerSlotToward(slot, _v1.set(targetX, 0, targetZ), 3.45 * npcSpeedMult, dt);
        slot.rig.update(this.totalTime, dt, 'hunting', { noBlinking: true });
        if (distToGuard < 1.15) {
          if (!guardIsControlledByPlayer) {
            if (this.immortalActive || this.ownerInfiniteRevives) {
              this.handleDeathProtection('hunt_jumpscare', slot);
            } else if (this.guardNpc.taserCooldown <= 0) {
              _v1.set(this.guardNpc.x, 1.38, this.guardNpc.z);
              _v2.set(slot.data.pos.x, 1.25, slot.data.pos.z);
              this.showWorldTaserBeam(_v1, _v2);
              this.taserFlashTimer = 0.25;
              this.audio.playTaser();
              this.guardNpc.taserCooldown = 3.5;
              slot.stunTimer = 2.6;
              slot.data.state = 'stunned';
              this.setBanner(
                `SECURITY GUARD NPC DEFENDED AGAINST ${slot.data.name.toUpperCase()}!`,
                'warning',
                2.4,
              );
            } else {
              this.guardNpc.stunTimer = 1.4;
              slot.stunTimer = 1.2;
              slot.data.state = 'stunned';
            }
          } else {
            this.triggerJumpscare(slot, `${slot.data.name} (Anomaly) caught you inside the school.`);
            return;
          }
        }
      } else if (guardIsControlledByPlayer && !this.ownerInvisible && playerHidden && distToGuard < 6.2 && madeNoise) {
        // Heard movement while hiding!
        this.steerSlotToward(slot, _v1.set(this.playerPos.x, 0, this.playerPos.z), 3.6 * npcSpeedMult, dt);
        slot.rig.update(this.totalTime, dt, 'hunting', { noBlinking: true });
        if (distToGuard < 1.2) {
          this.triggerJumpscare(slot, 'You moved while the anomaly was searching near your hiding spot.');
          return;
        }
      } else if (
        guardIsControlledByPlayer &&
        !this.ownerInvisible &&
        playerHidden &&
        distToGuard < 4.8 &&
        slot.closeToHiddenTimer > 10.0
      ) {
        // Anomaly stayed close to the player's hiding spot for > 10 seconds -> can discover player
        if (!this.hidingWarningShown) {
          this.hidingWarningShown = true;
          this.setBanner('IT HAS STAYED RIGHT OUTSIDE TOO LONG — IT MIGHT FIND YOU!', 'danger', 3.0);
        }
        slot.data.yaw = THREE.MathUtils.damp(slot.data.yaw, Math.atan2(dx, dz), 5, dt);
        slot.rig.root.rotation.y = slot.data.yaw;
        slot.rig.update(this.totalTime, dt, 'search', { noBlinking: true });

        slot.discoveryCheckAccum += dt;
        if (slot.discoveryCheckAccum >= 1.0) {
          slot.discoveryCheckAccum = 0;
          const discoverChance = Math.min(1, 0.45 + (slot.closeToHiddenTimer - 10.0) * 0.18);
          if (Math.random() < discoverChance) {
            this.triggerJumpscare(
              slot,
              'An anomaly stayed close to your hiding spot for over 10 seconds and found you.',
            );
            return;
          }
        }
      } else if (
        guardIsControlledByPlayer &&
        !this.ownerInvisible &&
        playerHidden &&
        distToGuard < 4.8 &&
        slot.passCooldown <= 0
      ) {
        // Search around hiding spot; if player stays still it usually walks past, or may linger
        if (slot.searchTimer <= 0) {
          slot.searchTimer = 3.2 + Math.random() * 1.4;
          slot.willLinger = Math.random() < 0.45;
          this.audio.playWhisper();
        }
        slot.searchTimer -= dt;
        if (slot.closeToHiddenTimer > 6.5 && !this.hidingWarningShown) {
          this.hidingWarningShown = true;
          this.setBanner('An anomaly is lingering outside your hiding spot...', 'warning', 2.8);
        }
        slot.data.yaw = THREE.MathUtils.damp(slot.data.yaw, Math.atan2(dx, dz), 4, dt);
        slot.rig.root.rotation.y = slot.data.yaw;
        slot.rig.update(this.totalTime, dt, 'search', { noBlinking: true });

        if (slot.searchTimer <= 0 && !slot.willLinger) {
          slot.passCooldown = 7.5;
          slot.closeToHiddenTimer = 0;
          slot.waypointIdx = (slot.waypointIdx + 1) % HUNT_WAYPOINTS.length;
          this.setBanner('You stayed still — the anomaly walked past.', 'success', 2.6);
        }
      } else if (slot.noiseTarget) {
        if (this.steerSlotToward(slot, slot.noiseTarget, 2.8 * npcSpeedMult, dt)) {
          slot.noiseTarget = null;
        }
        slot.rig.update(this.totalTime, dt, 'hunting', { noBlinking: true });
      } else {
        const wp = HUNT_WAYPOINTS[slot.waypointIdx];
        if (this.steerSlotToward(slot, wp, 2.3 * npcSpeedMult, dt)) {
          slot.waypointIdx = (slot.waypointIdx + 1) % HUNT_WAYPOINTS.length;
        }
        slot.rig.update(this.totalTime, dt, 'hunting', { noBlinking: true });
      }
    }
  }

  private steerSlotToward(slot: LiveActorSlot, target: THREE.Vector3, speed: number, dt: number): boolean {
    const dx = target.x - slot.data.pos.x;
    const dz = target.z - slot.data.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.35) return true;
    const nx = dx / dist;
    const nz = dz / dist;
    slot.data.pos.x += nx * speed * dt;
    slot.data.pos.z += nz * speed * dt;
    slot.rig.root.position.set(slot.data.pos.x, 0, slot.data.pos.z);
    const tYaw = Math.atan2(nx, nz);
    const diff = Math.atan2(Math.sin(tYaw - slot.data.yaw), Math.cos(tYaw - slot.data.yaw));
    slot.data.yaw += diff * Math.min(1, dt * 7);
    slot.rig.root.rotation.y = slot.data.yaw;
    return false;
  }

  private isAnyFakeNearPlayer(radius: number): boolean {
    if (this.phase !== 'hunt') return false;
    return this.actorSlots.some(
      (s) =>
        s.data.isFake &&
        s.data.state !== 'fled' &&
        Math.hypot(this.playerPos.x - s.data.pos.x, this.playerPos.z - s.data.pos.z) < radius,
    );
  }

  private restoreSanity(amount: number): void {
    this.sanity = Math.min(100, this.sanity + amount);
  }

  private updateSanity(dt: number): void {
    // Tick trigger durations and cooldowns
    if (this.whisperCooldownTimer > 0) {
      this.whisperCooldownTimer = Math.max(0, this.whisperCooldownTimer - dt);
    }
    if (this.paranormalCooldownTimer > 0) {
      this.paranormalCooldownTimer = Math.max(0, this.paranormalCooldownTimer - dt);
    }
    if (this.flickerCooldownTimer > 0 && this.flickerEventTimer <= 0) {
      this.flickerCooldownTimer = Math.max(0, this.flickerCooldownTimer - dt);
    }

    if (this.audio.consumeWhisperSignal() && this.whisperCooldownTimer <= 0) {
      this.whisperDrainTimer = 2.8;
      this.whisperCooldownTimer = 14.0;
    }
    if (this.audio.consumeParanormalSignal() && this.paranormalCooldownTimer <= 0) {
      this.paranormalDrainTimer = 2.5;
      this.paranormalCooldownTimer = 15.0;
    }

    if (this.whisperDrainTimer > 0) {
      this.whisperDrainTimer = Math.max(0, this.whisperDrainTimer - dt);
    }
    if (this.paranormalDrainTimer > 0) {
      this.paranormalDrainTimer = Math.max(0, this.paranormalDrainTimer - dt);
    }

    // Periodic ambient flickering lights surge (guarded by cooldown)
    if (this.flickerEventTimer > 0) {
      this.flickerEventTimer = Math.max(0, this.flickerEventTimer - dt);
      if (this.flickerEventTimer <= 0) {
        this.flickerCooldownTimer = Math.max(11, 20 - this.day * 1.5);
      }
    } else if (
      this.flickerCooldownTimer <= 0 &&
      this.activeOverlay === 'none' &&
      (!this.activeHidingSpot || this.activeHidingSpot.type === 'desk')
    ) {
      this.flickerEventTimer = 3.2;
      this.audio.playLightFlickerBurst();
    }

    const hidingUnderDesk = this.activeHidingSpot?.type === 'desk';
    const hidingInCrampedSpot =
      this.activeHidingSpot !== null && this.activeHidingSpot.type !== 'desk';
    const nearFakeDanger = this.phase === 'hunt' && this.isAnyFakeNearPlayer(10.5);
    const inImmediateDanger = nearFakeDanger || (this.activeHidingSpot !== null && this.hidingMoveNoise > 0.35);

    // 1. Darkness check (dim areas or cramped hiding spots; safe desks use ambient room light check)
    const lightLevel = hidingInCrampedSpot
      ? 0.08
      : this.world.getLightLevelAt(this.playerPos.x, this.playerPos.z);
    const inDarkness = !hidingUnderDesk && lightLevel < 0.42;

    // 2. Witnessing anomalies (seeing active anomalies in 3D or abnormal CCTV behavior)
    let witnessingAnomaly = false;
    if (this.activeOverlay === 'cctv') {
      const cctvAudio = this.getCctvAudioState();
      if (cctvAudio.mode === 'anomaly_reveal' || cctvAudio.mode === 'anomaly_hunt') {
        witnessingAnomaly = true;
      }
    } else {
      _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      _v1.y = 0;
      if (_v1.lengthSq() < 0.001) _v1.set(0, 0, -1);
      _v1.normalize();

      for (const slot of this.actorSlots) {
        if (!slot.data.isFake) continue;
        if (
          slot.data.state !== 'hunting' &&
          slot.data.state !== 'reveal' &&
          slot.data.state !== 'stunned'
        ) {
          continue;
        }
        const dx = slot.data.pos.x - this.playerPos.x;
        const dz = slot.data.pos.z - this.playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 13) continue;
        const dot = dist < 0.2 ? 1 : (dx * _v1.x + dz * _v1.z) / dist;
        if (this.activeHidingSpot) {
          if (dist < 6.5 && dot > 0.35) {
            witnessingAnomaly = true;
            break;
          }
        } else if (dist < 4.5 || dot > 0.28) {
          witnessingAnomaly = true;
          break;
        }
      }
    }

    const hearingWhisper = this.whisperDrainTimer > 0;
    const hearingParanormal = this.paranormalDrainTimer > 0;
    const lightFlickering = this.flickerEventTimer > 0;

    let drain = 0;
    let nextState: HudSnapshot['sanityState'] = 'stable';

    if (witnessingAnomaly) {
      drain += 3.2;
      nextState = 'anomaly';
    }
    if (lightFlickering) {
      drain += 3.2;
      if (nextState === 'stable') nextState = 'flicker';
    }
    if (hearingWhisper) {
      drain += 3.0;
      if (nextState === 'stable') nextState = 'whisper';
    }
    if (hearingParanormal) {
      drain += 2.6;
      if (nextState === 'stable') nextState = 'paranormal';
    }
    if (inDarkness) {
      drain += hidingInCrampedSpot ? 1.85 : 1.35;
      if (nextState === 'stable') nextState = 'darkness';
    }

    if (drain > 0) {
      this.sanity = Math.max(0, this.sanity - drain * dt);
    } else if (
      hidingUnderDesk &&
      !inImmediateDanger &&
      this.hiddenDuration >= 3.5 &&
      this.deskRecoveredAmount < 20 &&
      this.sanity < 100
    ) {
      const gain = Math.min(1.6 * dt, 20 - this.deskRecoveredAmount, 100 - this.sanity);
      if (gain > 0) {
        this.sanity = Math.min(100, this.sanity + gain);
        this.deskRecoveredAmount += gain;
        nextState = 'recovering';
      }
    } else if (lightLevel >= 0.62 && !inImmediateDanger && this.sanity < 100) {
      this.sanity = Math.min(100, this.sanity + 0.55 * dt);
    }

    this.sanityState = nextState;

    // 3. Mild hallucinations when sanity is low (< 55%)
    if (this.hallucinationFlashTimer > 0) {
      this.hallucinationFlashTimer = Math.max(0, this.hallucinationFlashTimer - dt);
      if (this.hallucinationFlashTimer <= 0) {
        this.hallucinationFlash = null;
      }
    }

    if (this.shadow3dTimer > 0) {
      this.shadow3dTimer -= dt;
      const sx = this.shadowHallucinationGroup.position.x - this.playerPos.x;
      const sz = this.shadowHallucinationGroup.position.z - this.playerPos.z;
      const sDist = Math.hypot(sx, sz) || 1;
      _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const lookDot = (sx * _v1.x + sz * _v1.z) / sDist;
      if (lookDot > 0.85 || this.shadow3dTimer <= 0) {
        this.shadow3dTimer = 0;
        this.shadowHallucinationGroup.visible = false;
      } else {
        this.shadowHallucinationMat.opacity = Math.min(0.62, this.shadow3dTimer * 1.6);
      }
    }

    if (this.sanity < 55) {
      this.nextHallucinationDelay -= dt;
      if (this.nextHallucinationDelay <= 0) {
        const lowFactor = Math.min(1, (55 - this.sanity) / 45);
        this.nextHallucinationDelay = THREE.MathUtils.lerp(9.5, 3.8, lowFactor) + Math.random() * 2.4;
        const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
        this.hallucinationFlashTimer = 0.42;
        this.hallucinationFlash = {
          side,
          strength: 0.35 + lowFactor * 0.55,
        };

        if (!this.activeHidingSpot && this.activeOverlay === 'none') {
          const angleOff = (side === 'left' ? 1 : -1) * (0.58 + Math.random() * 0.14);
          const spawnYaw = this.yaw + angleOff;
          const dist = 4.2 + Math.random() * 1.6;
          const hx = THREE.MathUtils.clamp(this.playerPos.x - Math.sin(spawnYaw) * dist, -2.1, 10.1);
          const hz = THREE.MathUtils.clamp(this.playerPos.z - Math.cos(spawnYaw) * dist, -2.0, 24.0);
          this.shadowHallucinationGroup.position.set(hx, 0, hz);
          this.shadowHallucinationGroup.rotation.y = Math.atan2(
            this.playerPos.x - hx,
            this.playerPos.z - hz,
          );
          this.shadowHallucinationMat.opacity = 0.5;
          this.shadowHallucinationGroup.visible = true;
          this.shadow3dTimer = 0.46;
        }

        if (this.sanity < 40 && Math.random() < 0.45) {
          const intensity = Math.pow(Math.max(0, Math.min(1, (40 - this.sanity) / 40)), 1.15);
          this.audio.playLayeredWhisperCluster(intensity);
        }
      }
    } else {
      this.nextHallucinationDelay = Math.min(this.nextHallucinationDelay, 4.5);
    }

    // 4. Transient blackboard text hallucinations in CCTV feeds (sanity < 45%)
    if (this.cctvGlitchPulseTimer > 0) {
      this.cctvGlitchPulseTimer = Math.max(0, this.cctvGlitchPulseTimer - dt);
    }
    if (this.bbHallucinationTimer > 0) {
      this.bbHallucinationTimer -= dt;
      if (this.bbHallucinationTimer <= 0) {
        this.bbHallucinationTimer = 0;
        this.bbHallucinationRoom = null;
        if (this.activeOverlay === 'cctv') {
          this.cctvGlitchPulseTimer = 0.2;
        }
      }
    } else if (this.sanity < 45) {
      this.nextBbHallucinationDelay -= dt * (this.activeOverlay === 'cctv' ? 1.45 : 0.7);
      if (this.nextBbHallucinationDelay <= 0) {
        const lowFactor = Math.min(1, (45 - this.sanity) / 45);
        this.nextBbHallucinationDelay = THREE.MathUtils.lerp(11.0, 4.8, lowFactor) + Math.random() * 3.0;
        this.bbHallucinationRoom =
          this.activeOverlay === 'cctv' && this.activeCctvCam === 'cam101'
            ? 'room101'
            : this.activeOverlay === 'cctv' && this.activeCctvCam === 'cam102'
              ? 'room102'
              : Math.random() < 0.5
                ? 'room101'
                : 'room102';
        this.bbHallucinationIdx = (this.bbHallucinationIdx + 1 + Math.floor(Math.random() * 2)) % 3;
        this.bbHallucinationTimer = 2.0 + Math.random() * 0.9;
        if (this.activeOverlay === 'cctv') {
          this.cctvGlitchPulseTimer = 0.24;
          this.audio.playCctvSwitch();
        }
      }
    } else {
      this.nextBbHallucinationDelay = Math.min(this.nextBbHallucinationDelay, 4.5);
    }

    // 5. Brief, distorted flashes of faces in the school corridors (critically low sanity < 38%)
    if (this.corridorFaceFlashTimer > 0) {
      this.corridorFaceFlashTimer = Math.max(0, this.corridorFaceFlashTimer - dt);
      if (this.corridorFaceFlashTimer <= 0) {
        this.corridorFaceFlash = null;
      }
    }

    if (this.corridorFaceTimer > 0) {
      this.corridorFaceTimer -= dt;
      if (this.corridorFaceTimer <= 0) {
        this.corridorFaceTimer = 0;
        this.faceHallucinationGroup.visible = false;
      } else {
        const flickerOpacity = Math.random() > 0.22 ? 0.85 : 0.24;
        this.faceHallucinationMat.opacity = flickerOpacity;
        this.faceHallucinationGroup.scale.set(
          0.9 + Math.random() * 0.42,
          0.92 + Math.random() * 0.44,
          1,
        );
        const targetCamPos =
          this.activeOverlay === 'cctv' && this.activeCctvCam === 'camCorridor'
            ? this.cctvCameras.camCorridor.position
            : this.camera.position;
        this.faceHallucinationGroup.lookAt(targetCamPos);
      }
    } else if (this.sanity < 38) {
      this.nextCorridorFaceDelay -= dt;
      if (this.nextCorridorFaceDelay <= 0) {
        const critFactor = Math.min(1, (38 - this.sanity) / 38);
        this.nextCorridorFaceDelay = THREE.MathUtils.lerp(9.5, 4.0, critFactor) + Math.random() * 2.5;

        const roomNow = this.getCurrentRoom();
        const watchingCorridor = this.activeOverlay === 'cctv' && this.activeCctvCam === 'camCorridor';
        const whisperIntensity = Math.pow(Math.max(0, Math.min(1, (40 - this.sanity) / 40)), 1.15);
        if (watchingCorridor) {
          const zSpawn = 7.0 + Math.random() * 11.0;
          const xSpawn = -1.1 + Math.random() * 2.2;
          this.faceHallucinationGroup.position.set(xSpawn, 1.55, zSpawn);
          this.faceHallucinationGroup.visible = true;
          this.corridorFaceTimer = 0.36;
          this.cctvGlitchPulseTimer = 0.26;
          this.audio.playLayeredWhisperCluster(whisperIntensity);
        } else if (!this.activeHidingSpot && this.activeOverlay === 'none') {
          let fx = 0.1 + (Math.random() - 0.5) * 2.2;
          let fz = 7.5 + Math.random() * 11.0;
          if (roomNow === 'corridor') {
            _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
            const dist = 4.6 + Math.random() * 2.8;
            fx = THREE.MathUtils.clamp(this.playerPos.x + _v1.x * dist + (Math.random() - 0.5) * 0.8, -1.75, 1.75);
            fz = THREE.MathUtils.clamp(this.playerPos.z + _v1.z * dist, 3.2, 23.0);
          } else {
            // Visible down the corridor doorway from checking room / classroom doors
            fz = 4.4 + Math.random() * 5.0;
          }
          this.faceHallucinationGroup.position.set(fx, 1.48 + Math.random() * 0.28, fz);
          this.faceHallucinationGroup.visible = true;
          this.corridorFaceTimer = 0.34;
          this.audio.playLayeredWhisperCluster(whisperIntensity);
        }

        if (this.sanity < 32 && (roomNow === 'corridor' || watchingCorridor)) {
          this.corridorFaceFlashTimer = 0.24;
          this.corridorFaceFlash = {
            xOffset: Math.round((Math.random() - 0.5) * 220),
            yOffset: Math.round((Math.random() - 0.5) * 90),
            scale: 0.92 + Math.random() * 0.45,
            opacity: 0.32 + critFactor * 0.38,
            skew: Math.round((Math.random() - 0.5) * 18),
          };
        }
      }
    } else {
      this.nextCorridorFaceDelay = Math.min(this.nextCorridorFaceDelay, 4.5);
    }
  }

  private triggerJumpscare(slot: LiveActorSlot, reason: string): void {
    if (this.handleDeathProtection('hunt_jumpscare', slot)) {
      return;
    }
    this.phase = 'jumpscare';
    this.jumpscareActor = slot;
    this.jumpscareTimer = 0;
    this.canRetryEscape = false;
    this.coronerReport = null;
    this.deathReason = reason;
    this.isCrouching = false;
    this.activeHidingSpot = null;
    this.activeOverlay = 'none';
    document.exitPointerLock?.();
    this.audio.playJumpscare();
    this.emitHud();
  }

  private updateJumpscare(dt: number): void {
    this.jumpscareTimer += dt;
    const rigTarget = this.jumpscareActor?.rig ?? this.jumpscareRig;
    if (rigTarget) {
      _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      _v1.y = 0;
      _v1.normalize();
      rigTarget.root.position.set(
        this.camera.position.x + _v1.x * 0.58,
        this.camera.position.y - 1.52,
        this.camera.position.z + _v1.z * 0.58,
      );
      rigTarget.root.rotation.y = Math.atan2(-_v1.x, -_v1.z);
      rigTarget.update(this.totalTime, dt, 'jumpscare', { noBlinking: true });

      this.jumpscareLight.position.copy(this.camera.position);
      this.jumpscareLight.target.position
        .copy(rigTarget.root.position)
        .add(_v2.set(0, 1.48, 0));
      this.jumpscareLight.target.updateMatrixWorld();
      this.jumpscareLight.intensity = Math.random() > 0.35 ? 18 : 3;
    }

    this.camera.rotation.z = Math.sin(this.jumpscareTimer * 65) * 0.09;

    if (this.jumpscareTimer >= 1.15) {
      this.jumpscareLight.intensity = 0;
      this.camera.rotation.z = 0;
      this.phase = 'gameover';
      this.audio.setAmbientHumLevel(0);
      this.emitHud();
    }
  }

  // =========================================================================
  // HUD SNAPSHOT & INPUT
  // =========================================================================
  private getCctvAudioState(): {
    mode: 'quiet' | 'class_normal' | 'anomaly_reveal' | 'anomaly_hunt';
    label: string;
  } {
    if (this.activeCctvCam === 'camCorridor') {
      const huntingInCorridor = this.actorSlots.some(
        (s) => s.data.pos.x <= 2.4 && s.data.state === 'hunting',
      );
      if (huntingInCorridor) {
        return { mode: 'anomaly_hunt', label: 'MIC (CORRIDOR): Heavy footsteps & raspy breathing' };
      }
      const walkingInCorridor = this.actorSlots.some(
        (s) => s.data.pos.x <= 2.4 && s.data.state === 'walking_to_seat',
      );
      if (walkingInCorridor) {
        return { mode: 'quiet', label: 'MIC (CORRIDOR): Footsteps heading toward classrooms' };
      }
      return { mode: 'quiet', label: 'MIC (CORRIDOR): Empty hallway air & fluorescent hum' };
    }

    const room = this.activeCctvCam === 'cam101' ? 'room101' : 'room102';
    const inRoom = this.actorSlots.filter(
      (s) =>
        s.data.state !== 'fled' &&
        s.data.state !== 'victimized' &&
        (room === 'room101' ? s.data.pos.x > 2.4 && s.data.pos.z < 14.0 : s.data.pos.x > 2.4 && s.data.pos.z >= 14.0),
    );

    const hunting = inRoom.find((s) => s.data.state === 'hunting');
    if (hunting) {
      return {
        mode: 'anomaly_hunt',
        label: `MIC (${room === 'room101' ? 'RM 101' : 'RM 102'}): Scuffling desks & rapid footsteps`,
      };
    }
    const revealed = inRoom.find((s) => s.data.state === 'reveal');
    if (revealed) {
      return {
        mode: 'anomaly_reveal',
        label: `MIC (${room === 'room101' ? 'RM 101' : 'RM 102'}): Pencils scratching & faint repeated monotone murmur`,
      };
    }
    if (inRoom.length > 0) {
      return {
        mode: 'class_normal',
        label: `MIC (${room === 'room101' ? 'RM 101' : 'RM 102'}): Pencils writing notes, quiet yawn & lecture`,
      };
    }
    return {
      mode: 'quiet',
      label: `MIC (${room === 'room101' ? 'RM 101' : 'RM 102'}): Empty classroom ambient hum`,
    };
  }

  private emitHud(): void {
    const nearbySpot = !this.activeHidingSpot ? this.findNearbyHidingSpot() : null;
    const arrivalsToday = this.campaignDays[this.day - 1]?.length ?? 4;
    const huntActiveFakes = this.actorSlots.filter(
      (s) => s.data.isFake && s.data.state !== 'fled',
    ).length;
    const cctvAudio = this.getCctvAudioState();
    const classTargetDuration = this.actorSlots.some((s) => s.data.isFake && s.data.state !== 'fled')
      ? 15.0
      : this.actorSlots.length === 0
        ? 6.0
        : 12.0;

    this.onHudUpdate({
      phase: this.phase,
      day: this.day,
      maxDays: MAX_DAYS,
      arrivalIndex: this.arrivalIdx + 1,
      arrivalsToday,
      casualties: this.casualties,
      maxCasualties: MAX_CASUALTIES,
      strikes: this.strikes,
      maxStrikes: MAX_STRIKES,
      taserCharges: this.taserCharges,
      maxTaserCharges: this.maxTaserCharges,
      taserTakenFromRoom: this.taserTakenFromRoom,
      hasTaserInHand: this.hasTaserInHand,
      isChargingTaser: this.isChargingTaser,
      taserChargeProgress: this.taserChargeProgress,
      inCheckingRoom: this.isInCheckingRoom(),
      currentRoom: this.getCurrentRoom(),
      currentArrival: this.getCurrentArrival(),
      records: this.activeOverlay === 'id_records' ? this.records : [],
      caseLogs: this.caseLogs,
      scanCompleted: this.scanCompleted,
      scanProgress: this.scanProgress,
      askedQuestionIdx: this.askedQuestionIdx,
      activeOverlay: this.activeOverlay,
      activeCctvCam: this.activeCctvCam,
      cctvAudioMode: cctvAudio.mode,
      cctvAudioLabel: cctvAudio.label,
      cctvActors: this.activeOverlay === 'cctv' ? this.actorSlots.map((s) => ({ ...s.data })) : [],
      room101Locked: this.room101Locked,
      room102Locked: this.room102Locked,
      classTimeLeft:
        this.phase === 'classtime'
          ? Math.max(0, Math.ceil(classTargetDuration - this.classObservationTimer))
          : 0,
      huntActiveFakes,
      isCrouching: this.isCrouching && this.activeHidingSpot === null,
      isHiding: this.activeHidingSpot !== null,
      hidingType: this.activeHidingSpot?.type ?? null,
      hideTransition: this.hideTransition,
      hiddenDuration: this.hiddenDuration,
      isMovingWhileHiding: this.hidingMoveNoise > 0.35,
      entityNearby: this.isAnyFakeNearPlayer(10),
      nearbyHidingSpot: nearbySpot
        ? { id: nearbySpot.id, type: nearbySpot.type, label: nearbySpot.label }
        : null,
      pointerLocked: this.pointerLocked,
      feedbackBanner: this.feedbackBanner,
      cutawayText: this.cutawayText,
      introCaption: this.getIntroCaption(),
      introProgress: Math.min(1, this.introTimer / 16.4),
      deathReason: this.deathReason,
      fakesStopped: this.fakesStopped,
      debugVisible: this.debugVisible,
      sanity: Math.round(this.sanity),
      sanityState: this.sanityState,
      lightFlickerActive: this.flickerEventTimer > 0,
      cctvGlitchPulse: this.cctvGlitchPulseTimer > 0,
      hallucinationFlash: this.hallucinationFlash,
      corridorFaceFlash: this.corridorFaceFlash,
      escapeObjective:
        this.phase === 'escape_play' ? 'OBJECTIVE: REACH THE SCHOOL BUS!' : '',
      escapeStamina: Math.round(this.escapeStamina),
      escapeDistanceRemaining: Math.max(0, Math.round(this.escapeWorld.busDoorZ - this.playerPos.z)),
      escapePursuerDistance: Math.max(0, Math.round(this.playerPos.z - this.escapePursuerZ)),
      escapeStage: this.escapeStage,
      escapeOutroCaption: this.escapeOutroCaption,
      escapeOutroFade: this.escapeOutroFade,
      kidnapperStage: this.kidnapperStage,
      kidnapperCaption: this.kidnapperCaption,
      kidnapperSubCaption: this.kidnapperSubCaption,
      kidnapperFade: this.kidnapperFade,
      kidnapperCreditsProgress: this.kidnapperCreditsProgress,
      canRetryEscape: this.canRetryEscape,
      coronerReport: this.coronerReport,
      anomalyCaughtCount: this.anomalyCaughtCount,
      anomalyGuardsCaught: this.anomalyGuardsCaught,
      anomalyStudentsCaught: this.anomalyStudentsCaught,
      anomalyTotalStudents: this.anomalyTotalStudents,
      anomalyGuardBossHp: this.anomalyGuardBossHp,
      anomalyGuardBossMaxHp: this.anomalyGuardBossMaxHp,
      anomalyGuardBossAlive: this.anomalyGuardBossAlive,
      anomalyHp: Math.round(this.anomalyHp),
      anomalyVictory: this.anomalyVictory,
      anomalyShocked: this.anomalyShockTimer > 0,
      anomalyAbilityCooldown: Number(this.anomalyAbilityCooldown.toFixed(1)),
      anomalyAbilityMaxCooldown: this.anomalyAbilityMaxCooldown,
      anomalySurgeActive: this.anomalySurgeTimer > 0,
      anomalyTransforming: this.anomalyTransformTimer > 0,
      anomalyNearbyTarget: (() => {
        if (this.phase !== 'anomaly_mode') return null;
        let best: AnomalyNpc | null = null;
        let bestDist = this.activeHidingSpot ? 2.75 : 2.55;
        for (const npc of this.anomalyNpcs) {
          if (npc.state === 'caught' || npc.id === this.possessedNpcId) continue;
          const d = Math.hypot(npc.x - this.playerPos.x, npc.z - this.playerPos.z);
          if (d < bestDist) {
            bestDist = d;
            best = npc;
          }
        }
        return best
          ? {
              name: best.name,
              role: best.role,
              panicked: best.state === 'panic_flee' || best.state === 'hide_cower',
              bossHp: best.role === 'guard' ? best.bossHp : undefined,
            }
          : null;
      })(),
      schoolEatTarget: this.findSchoolEatTarget(),
      redeemedCodes: [...this.redeemedCodes],
      mindControlUnlocked: this.mindControlUnlocked,
      possessTarget: this.possessTargetInfo,
      possessedNpc: this.possessedNpcId
        ? {
            id: this.possessedNpcId,
            name: this.possessedNpcName,
            roleLabel: this.possessedNpcRoleLabel,
            timeLeft: Number(this.possessTimeLeft.toFixed(1)),
            maxDuration: this.possessDurationConfig,
            canEat: this.phase === 'anomaly_mode' || this.isControllingAnomalyInSchool(),
          }
        : null,
      possessCooldown: Number(this.possessCooldown.toFixed(1)),
      possessMaxCooldown: this.possessMaxCooldown,
      possessRange: this.possessRange,
      possessDurationConfig: this.possessDurationConfig,
      immortalUnlocked: this.immortalUnlocked,
      immortalActive: this.immortalActive,
      immortalShieldFlash: Number(this.immortalShieldFlash.toFixed(2)),
      ownerModeUnlocked: this.ownerModeUnlocked,
      ownerPanelOpen: this.ownerPanelOpen,
      ownerInvisible: this.ownerInvisible,
      ownerFreecam: this.ownerFreecam,
      ownerNpcsPaused: this.ownerNpcsPaused,
      ownerInfiniteRevives: this.ownerInfiniteRevives,
      ownerPlayerSpeed: this.ownerPlayerSpeed,
      ownerPlayerForm: this.ownerPlayerForm,
      ownerBodyguardCount: this.ownerBodyguards.length,
      ownerBodyguardStance: this.ownerBodyguardStance,
      ownerNpcs: this.ownerPanelOpen ? this.buildOwnerNpcList() : [],
      isShift6: this.isShift6,
      shift6Stage: this.shift6Stage,
      shift6Objective: this.getShift6ObjectiveText(),
      shift6AnomaliesRemaining: this.isShift6
        ? this.actorSlots.filter((s) => s.data.isFake && s.data.state !== 'fled').length
        : 0,
      shift6CompletedModal: this.shift6CompletedModal,
      campaignSave: { ...this.campaignSave },
    });
  }

  private getIntroCaption(): string {
    const t = this.introTimer;
    if (t < 2.2) return '[SIGNAL ACQUIRING — WBNL LATE NIGHT BROADCAST]';
    if (t < 7.4)
      return '"Urgent safety alert: Anomalies imitating human students and teachers are infiltrating schools at night."';
    if (t < 12.9)
      return '"Verify every ID card against official records, run body scans, watch classroom CCTV, and stop any fake before they harm anyone."';
    if (t < 15.3) return '[SIGNAL INTERRUPTED — SHADOWY FIGURE AT SCHOOL ENTRANCE]';
    return '';
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'F1') {
      e.preventDefault();
      if (!e.repeat) {
        this.debugVisible = !this.debugVisible;
        this.emitHud();
      }
      return;
    }

    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }

    if (e.code === 'Space' && this.phase === 'escape_play') {
      e.preventDefault();
    }

    this.keys[e.code] = true;
    if (this.phase === 'intro' && (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter')) {
      this.skipIntro();
      return;
    }

    if (e.code === 'KeyP' && !e.repeat) {
      if (this.possessedNpcId) this.releasePossession();
      else if (this.possessTargetInfo) this.possessTargetedNpc();
      return;
    }

    if (this.phase === 'anomaly_mode') {
      if (this.possessedNpcId) {
        if ((e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'KeyX') && !e.repeat) {
          this.releasePossession();
        } else if ((e.code === 'KeyF' || e.code === 'KeyR') && !e.repeat) {
          this.firePossessedNpcAction();
        } else if (e.code === 'KeyC' && !e.repeat) {
          this.toggleCrouch();
        }
        return;
      }
      if (e.code === 'KeyQ' && !e.repeat) this.triggerAnomalySurge();
      else if ((e.code === 'KeyF' || e.code === 'KeyR') && !e.repeat) {
        this.triggerAnomalyCatchAttempt();
      } else if (e.code === 'KeyE' && !e.repeat) {
        if ((this.mindControlUnlocked || this.ownerModeUnlocked) && this.possessTargetInfo) {
          this.possessTargetedNpc();
        } else {
          this.toggleHide();
        }
      } else if (e.code === 'KeyC' && !e.repeat) {
        this.toggleCrouch();
      }
      return;
    }
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt') return;

    if (e.code === 'KeyE' && !e.repeat) {
      if (this.possessedNpcId) {
        this.releasePossession();
      } else if ((this.mindControlUnlocked || this.ownerModeUnlocked) && this.possessTargetInfo) {
        this.possessTargetedNpc();
      } else {
        this.toggleHide();
      }
    } else if ((e.code === 'KeyQ' || e.code === 'KeyX') && !e.repeat && this.possessedNpcId) {
      this.releasePossession();
    } else if (e.code === 'KeyC' && !e.repeat) this.toggleCrouch();
    else if (e.code === 'KeyT' && !e.repeat) this.toggleTaserEquip();
    else if (e.code === 'KeyF' && !e.repeat) {
      if (this.possessedNpcId) this.firePossessedNpcAction();
      else if (this.isControllingAnomalyInSchool()) this.eatNearbyNpcInSchool();
    } else if (e.code === 'KeyR' && !e.repeat) {
      if (this.possessedNpcId) this.firePossessedNpcAction();
      else this.fireTaserShot();
    } else if (e.code === 'Digit1') this.setOverlay('id_records');
    else if (e.code === 'Digit2') this.startBodyScan();
    else if (e.code === 'Digit3') this.setOverlay('cctv');
    else if (e.code === 'Digit4') this.setOverlay('case_logs');
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onWindowBlur = () => {
    this.keys = {};
    this.cancelTaserCharge();
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (
      this.phase !== 'arrival' &&
      this.phase !== 'classtime' &&
      this.phase !== 'hunt' &&
      this.phase !== 'escape_play' &&
      this.phase !== 'anomaly_mode'
    ) {
      return;
    }
    if (this.pointerLocked) {
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      if (this.activeHidingSpot && (Math.abs(e.movementX) > 12 || Math.abs(e.movementY) > 12)) {
        this.hidingMoveNoise = Math.min(1.5, this.hidingMoveNoise + 0.15);
      }
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.yaw -= dx * 0.0045;
      this.pitch -= dy * 0.0045;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (
      this.phase !== 'arrival' &&
      this.phase !== 'classtime' &&
      this.phase !== 'hunt' &&
      this.phase !== 'escape_play' &&
      this.phase !== 'anomaly_mode'
    ) {
      return;
    }
    this.audio.unlock();
    if (this.phase === 'anomaly_mode' && this.pointerLocked && e.button === 0) {
      if (this.possessedNpcId) {
        this.firePossessedNpcAction();
      } else {
        this.triggerAnomalyCatchAttempt();
      }
      return;
    }
    if (
      (this.phase === 'arrival' || this.phase === 'classtime' || this.phase === 'hunt') &&
      this.pointerLocked &&
      e.button === 0
    ) {
      if (this.possessedNpcId) {
        this.firePossessedNpcAction();
        return;
      }
      if (this.isControllingAnomalyInSchool() && !this.hasTaserInHand) {
        this.eatNearbyNpcInSchool();
        return;
      }
    }
    if (e.target === this.renderer.domElement) {
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onMouseUp = () => {
    this.isDraggingLook = false;
  };

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    Object.values(this.cctvCameras).forEach((cam) => {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    });
    this.renderer.setSize(w, h);
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onWindowBlur);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
  }

  // =========================================================================
  // REDEEM CODES, MIND CONTROL, IMMORTALITY, OWNER MODE & SHIFT 6
  // =========================================================================
  public redeemSecretCode(raw: string): {
    ok: boolean;
    alreadyUnlocked?: boolean;
    code?: RedeemCodeId;
    title?: string;
    lines: string[];
    accent?: 'red' | 'amber' | 'violet' | 'cyan' | 'gold';
  } {
    this.audio.unlock();
    const id = normalizeRedeemCode(raw);
    if (!id) {
      this.audio.playRoundResult(false);
      return {
        ok: false,
        lines: ['Invalid secret code. Please check the code and try again.'],
      };
    }

    const meta = REDEEM_CODE_REGISTRY[id];

    if (id === 'PUPPET777' && this.mindControlUnlocked) {
      this.audio.playUiClick();
      return {
        ok: false,
        alreadyUnlocked: true,
        code: id,
        title: meta.title,
        lines: ['MIND CONTROL IS ALREADY UNLOCKED FOR THIS SESSION!'],
        accent: meta.accent,
      };
    }
    if (id === 'IMMORTAL999' && this.immortalUnlocked) {
      this.audio.playUiClick();
      return {
        ok: false,
        alreadyUnlocked: true,
        code: id,
        title: meta.title,
        lines: ['IMMORTALITY IS ALREADY UNLOCKED! USE THE HUD TO TOGGLE IT ON OR OFF.'],
        accent: meta.accent,
      };
    }
    if (id === 'OWNER2026' && this.ownerModeUnlocked) {
      this.audio.playUiClick();
      this.emitHud();
      return {
        ok: false,
        alreadyUnlocked: true,
        code: id,
        title: meta.title,
        lines: ['OWNER MODE ALREADY UNLOCKED — OPENING OWNER CONTROL PANEL 👑'],
        accent: meta.accent,
      };
    }

    if (!this.redeemedCodes.includes(id)) {
      this.redeemedCodes.push(id);
    }
    this.persistCampaignSave();
    this.audio.playRoundResult(true);

    if (id === '6754') {
      this.emitHud();
      return { ok: true, code: id, title: meta.title, lines: meta.lines, accent: meta.accent };
    }
    if (id === 'STPGY') {
      this.emitHud();
      return { ok: true, code: id, title: meta.title, lines: meta.lines, accent: meta.accent };
    }
    if (id === 'PUPPET777') {
      this.mindControlUnlocked = true;
      this.audio.playMindControl(true);
      this.setBanner('MIND CONTROL UNLOCKED — AIM AT ANY NPC IN ANOMALY MODE & PRESS [E]!', 'success', 4.5);
      this.emitHud();
      return { ok: true, code: id, title: meta.title, lines: meta.lines, accent: meta.accent };
    }
    if (id === 'IMMORTAL999') {
      this.immortalUnlocked = true;
      this.immortalActive = true;
      this.immortalShieldFlash = 0.7;
      this.audio.playImmortalShield();
      this.setBanner('IMMORTALITY UNLOCKED — PLAYER PROTECTION ACTIVE!', 'success', 4.2);
      this.emitHud();
      return { ok: true, code: id, title: meta.title, lines: meta.lines, accent: meta.accent };
    }
    // OWNER2026
    this.ownerModeUnlocked = true;
    this.audio.playRevivePulse();
    this.setBanner('OWNER MODE ACTIVATED 👑 — ALL CREATOR POWERS UNLOCKED!', 'warning', 4.5);
    this.emitHud();
    return { ok: true, code: id, title: meta.title, lines: meta.lines, accent: meta.accent };
  }

  private findPossessableNpcInSight(): {
    id: string;
    source: 'anomaly' | 'classroom' | 'guard';
    name: string;
    roleLabel: string;
    x: number;
    z: number;
  } | null {
    if ((!this.mindControlUnlocked && !this.ownerModeUnlocked) || this.possessedNpcId) {
      return null;
    }
    if (
      this.phase !== 'anomaly_mode' &&
      this.phase !== 'arrival' &&
      this.phase !== 'classtime' &&
      this.phase !== 'hunt'
    ) {
      return null;
    }

    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const targetY = THREE.MathUtils.clamp(this.camera.position.y, 1.0, 1.62);
    let bestScore = Infinity;
    let best: {
      id: string;
      source: 'anomaly' | 'classroom' | 'guard';
      name: string;
      roleLabel: string;
      x: number;
      z: number;
    } | null = null;

    if (this.phase === 'anomaly_mode') {
      for (const npc of this.anomalyNpcs) {
        if (npc.state === 'caught') continue;
        const dx = npc.x - this.camera.position.x;
        const dy = targetY - this.camera.position.y;
        const dz = npc.z - this.camera.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > this.possessRange) continue;
        const dot = dist < 0.45 ? 1 : (dx * _v1.x + dy * _v1.y + dz * _v1.z) / dist;
        if (dot < 0.78) continue;
        const score = (1 - dot) * 20 + dist * 0.25;
        if (score < bestScore) {
          bestScore = score;
          best = {
            id: npc.id,
            source: 'anomaly',
            name: npc.name,
            roleLabel: npc.role === 'guard' ? 'Security Guard Boss' : 'Student',
            x: npc.x,
            z: npc.z,
          };
        }
      }
    } else {
      for (const slot of this.actorSlots) {
        if (slot.data.state === 'fled' || slot.data.state === 'victimized') continue;
        const dx = slot.data.pos.x - this.camera.position.x;
        const dy = targetY - this.camera.position.y;
        const dz = slot.data.pos.z - this.camera.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > this.possessRange) continue;
        const dot = dist < 0.45 ? 1 : (dx * _v1.x + dy * _v1.y + dz * _v1.z) / dist;
        if (dot < 0.78) continue;
        const score = (1 - dot) * 20 + dist * 0.25;
        if (score < bestScore) {
          bestScore = score;
          best = {
            id: slot.data.uid,
            source: 'classroom',
            name: slot.data.name,
            roleLabel: slot.data.isFake ? 'Anomaly Mimic' : slot.data.role === 'teacher' ? 'Teacher' : 'Student',
            x: slot.data.pos.x,
            z: slot.data.pos.z,
          };
        }
      }
      // In Free-Cam during school shifts, allow aiming at & possessing the Night Security Guard NPC directly
      if (this.ownerFreecam) {
        const dx = this.guardNpc.x - this.camera.position.x;
        const dy = targetY - this.camera.position.y;
        const dz = this.guardNpc.z - this.camera.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist <= this.possessRange) {
          const dot = dist < 0.45 ? 1 : (dx * _v1.x + dy * _v1.y + dz * _v1.z) / dist;
          const score = (1 - dot) * 20 + dist * 0.25;
          if (dot >= 0.78 && score < bestScore) {
            bestScore = score;
            best = {
              id: this.guardNpc.id,
              source: 'guard',
              name: 'Night Security Guard',
              roleLabel: 'Security Guard',
              x: this.guardNpc.x,
              z: this.guardNpc.z,
            };
          }
        }
      }
    }
    return best;
  }

  private updatePossessionAndTarget(dt: number): void {
    if (this.possessedNpcId) {
      this.possessTargetOutline.visible = false;
      this.possessTargetInfo = null;
      this.possessTimeLeft = Math.max(0, this.possessTimeLeft - dt);
      if (this.possessTimeLeft <= 0) {
        this.releasePossession();
      }
      return;
    }

    const candidate = this.findPossessableNpcInSight();
    if (candidate) {
      this.possessTargetInfo = {
        id: candidate.id,
        name: candidate.name,
        roleLabel: candidate.roleLabel,
      };
      this.possessTargetOutline.visible = true;
      this.possessTargetOutline.position.set(candidate.x, 0, candidate.z);
      this.possessTargetOutline.rotation.y += dt * 2.2;
    } else {
      this.possessTargetInfo = null;
      this.possessTargetOutline.visible = false;
    }
  }

  public possessTargetedNpc(): void {
    if (this.possessTargetInfo) {
      this.possessNpcById(this.possessTargetInfo.id);
    }
  }

  public possessNpcById(id: string): void {
    if (!this.mindControlUnlocked && !this.ownerModeUnlocked) return;
    if (id === this.guardNpc.id) {
      if (this.possessedNpcId) {
        this.releasePossession();
        return;
      }
      if (this.ownerFreecam) {
        this.ownerFreecam = false;
        this.playerPos.set(this.guardNpc.x, EYE_HEIGHT, this.guardNpc.z);
        this.yaw = this.guardNpc.yaw - Math.PI;
        this.pitch = -0.02;
        this.currentEyeHeight = EYE_HEIGHT;
        this.camera.position.set(this.playerPos.x, EYE_HEIGHT, this.playerPos.z);
        this.audio.playMindControl(true);
        this.setBanner('POSSESSING NIGHT SECURITY GUARD!', 'warning', 2.6);
        this.emitHud();
      } else {
        this.setBanner('CONTROLLING NIGHT SECURITY GUARD!', 'neutral', 1.8);
      }
      return;
    }
    if (this.possessCooldown > 0 && !this.ownerModeUnlocked) {
      this.setBanner(`MIND CONTROL COOLDOWN: ${this.possessCooldown.toFixed(1)}s`, 'warning', 1.8);
      return;
    }

    const wasPossessing = Boolean(this.possessedNpcId);
    if (wasPossessing) {
      this.releasePossession(true, true);
    }

    this.audio.unlock();
    if (!wasPossessing || !this.hasPrePossessAnchor) {
      this.prePossessPos.copy(this.playerPos);
      this.prePossessYaw = this.yaw;
      this.prePossessPitch = this.pitch;
      this.prePossessEyeHeight = this.currentEyeHeight;
      this.hasPrePossessAnchor = true;
      if (this.phase === 'arrival' || this.phase === 'classtime' || this.phase === 'hunt') {
        this.guardNpc.x = this.playerPos.x;
        this.guardNpc.z = this.playerPos.z;
        this.guardNpc.yaw = this.yaw + Math.PI;
        this.guardNpc.currentNode = findNearestNavNode(this.guardNpc.x, this.guardNpc.z);
        this.guardNpc.targetNode = GUARD_PATROL_ROUTE[this.guardNpc.patrolIdx % GUARD_PATROL_ROUTE.length];
        this.guardNpc.rig.root.position.set(this.guardNpc.x, 0, this.guardNpc.z);
        this.guardNpc.rig.root.rotation.y = this.guardNpc.yaw;
        this.guardNpc.rig.root.visible = true;
      }
    }

    this.activeHidingSpot = null;
    this.activeOverlay = 'none';
    this.ownerFreecam = false;
    this.isCrouching = false;

    if (this.phase === 'anomaly_mode') {
      const npc = this.anomalyNpcs.find((n) => n.id === id && n.state !== 'caught');
      if (!npc) {
        this.setBanner('Selected NPC is no longer available.', 'warning', 2.0);
        return;
      }
      npc.possessed = true;
      this.possessedNpcId = npc.id;
      this.possessedNpcSource = 'anomaly';
      this.possessedNpcName = npc.name;
      this.possessedNpcRoleLabel = npc.role === 'guard' ? 'Security Guard Boss' : 'Student';
      this.possessTimeLeft = this.possessDurationConfig;
      this.yaw = npc.yaw - Math.PI;
      this.pitch = -0.02;
      this.playerPos.set(npc.x, 1.62, npc.z);
      this.currentEyeHeight = 1.62;
      this.audio.playMindControl(true);
      this.setBanner(
        `POSSESSING ${npc.name.toUpperCase()} — [E] RELEASE · [F/CLICK] INTERACT`,
        'warning',
        3.6,
      );
      this.emitHud();
      return;
    }

    const slot = this.actorSlots.find(
      (s) => s.data.uid === id && s.data.state !== 'fled' && s.data.state !== 'victimized',
    );
    if (!slot) {
      this.setBanner('NPC cannot be possessed in the current phase.', 'warning', 2.0);
      return;
    }
    slot.prePossessState = slot.data.state;
    slot.possessed = true;
    this.possessedNpcId = slot.data.uid;
    this.possessedNpcSource = 'classroom';
    this.possessedNpcName = slot.data.name;
    this.possessedNpcRoleLabel = slot.data.isFake
      ? 'Anomaly Mimic'
      : slot.data.role === 'teacher'
        ? 'Teacher'
        : 'Student';
    this.possessTimeLeft = this.possessDurationConfig;
    this.yaw = slot.data.yaw - Math.PI;
    this.pitch = -0.02;
    this.playerPos.set(slot.data.pos.x, 1.62, slot.data.pos.z);
    this.currentEyeHeight = 1.62;
    this.audio.playMindControl(true);
    this.setBanner(`POSSESSING ${slot.data.name.toUpperCase()} — PRESS [E] OR RELEASE BUTTON TO EXIT`, 'warning', 3.5);
    this.emitHud();
  }

  public cyclePossessedNpc(dir: 1 | -1): void {
    const list =
      this.phase === 'anomaly_mode'
        ? this.anomalyNpcs.filter((n) => n.state !== 'caught').map((n) => n.id)
        : this.actorSlots
            .filter((s) => s.data.state !== 'fled' && s.data.state !== 'victimized')
            .map((s) => s.data.uid);
    if (list.length === 0) return;
    const curIdx = this.possessedNpcId ? list.indexOf(this.possessedNpcId) : -1;
    const nextIdx = (curIdx + dir + list.length) % list.length;
    this.possessNpcById(list[nextIdx]);
  }

  public releasePossession(silent = false, keepAnchor = false): void {
    if (!this.possessedNpcId) {
      if (!keepAnchor) this.hasPrePossessAnchor = false;
      return;
    }

    if (this.possessedNpcSource === 'anomaly') {
      const npc = this.anomalyNpcs.find((n) => n.id === this.possessedNpcId);
      if (npc) {
        npc.possessed = false;
        npc.rig.root.position.set(npc.x, 0, npc.z);
        npc.rig.root.visible = true;
        npc.currentNode = findClosestSafeNavNode(npc.x, npc.z);
        npc.targetNode =
          npc.role === 'guard'
            ? GUARD_PATROL_ROUTE[npc.patrolIdx % GUARD_PATROL_ROUTE.length]
            : npc.currentNode;
        npc.taserAimTimer = 0;
        npc.pauseTimer = 0;
        if (npc.state === 'boss_aim' || npc.state === 'boss_stagger' || npc.state === 'hide_cower') {
          npc.state = npc.role === 'guard' ? 'patrol' : 'walk';
        }
      }
    } else if (this.possessedNpcSource === 'classroom') {
      const slot = this.actorSlots.find((s) => s.data.uid === this.possessedNpcId);
      if (slot) {
        slot.possessed = false;
        slot.rig.root.position.set(slot.data.pos.x, 0, slot.data.pos.z);
        slot.rig.root.visible = true;
        if (slot.prePossessState && slot.data.state !== 'fled' && slot.data.state !== 'victimized') {
          slot.data.state = slot.prePossessState;
        }
        if (
          slot.data.state === 'seated' &&
          slot.targetSeatPos &&
          Math.hypot(slot.targetSeatPos.x - slot.data.pos.x, slot.targetSeatPos.z - slot.data.pos.z) > 0.55
        ) {
          slot.seatWaypoints = [slot.targetSeatPos.clone()];
          slot.data.state = 'walking_to_seat';
        }
        slot.prePossessState = undefined;
      }
    }

    this.possessedNpcId = null;
    this.possessedNpcSource = null;
    this.possessedNpcName = '';
    this.possessedNpcRoleLabel = '';
    this.possessTimeLeft = 0;
    this.isCrouching = false;

    if (!keepAnchor) {
      this.hasPrePossessAnchor = false;
    }

    if (!silent) {
      this.possessCooldown = this.ownerModeUnlocked ? 1.5 : this.possessMaxCooldown;
      if (this.phase === 'arrival' || this.phase === 'classtime' || this.phase === 'hunt') {
        this.playerPos.set(this.guardNpc.x, EYE_HEIGHT, this.guardNpc.z);
        this.yaw = this.guardNpc.yaw - Math.PI;
        this.pitch = -0.02;
        this.currentEyeHeight = EYE_HEIGHT;
        this.guardNpc.state = 'checkpoint';
      } else {
        this.playerPos.copy(this.prePossessPos);
        this.yaw = this.prePossessYaw;
        this.pitch = this.prePossessPitch;
        this.currentEyeHeight = this.phase === 'anomaly_mode' ? 1.82 : this.prePossessEyeHeight;
      }
      this.camera.position.set(this.playerPos.x, this.currentEyeHeight, this.playerPos.z);
      this.audio.playMindControl(false);
      this.setBanner('RELEASED MIND CONTROL — NPC AI RESTORED.', 'neutral', 2.4);
      this.emitHud();
    }
  }

  public firePossessedNpcAction(): void {
    if (!this.possessedNpcId) {
      if (this.phase === 'anomaly_mode') {
        this.triggerAnomalyCatchAttempt();
      } else if (this.isControllingAnomalyInSchool()) {
        this.eatNearbyNpcInSchool();
      }
      return;
    }
    this.audio.unlock();

    if (this.possessedNpcSource === 'anomaly') {
      this.triggerAnomalyCatchAttempt();
      return;
    }

    const slot = this.actorSlots.find((s) => s.data.uid === this.possessedNpcId);
    if (slot && (slot.data.isFake || slot.transformedAs === 'anomaly')) {
      this.eatNearbyNpcInSchool();
      return;
    }

    if (slot && slot.transformedAs === 'guard') {
      _v1.set(slot.data.pos.x, 1.38, slot.data.pos.z);
      const fwdX = -Math.sin(this.yaw);
      const fwdZ = -Math.cos(this.yaw);
      _v2.set(slot.data.pos.x + fwdX * 6.5, 1.32, slot.data.pos.z + fwdZ * 6.5);
      this.showWorldTaserBeam(_v1, _v2);
      this.taserFlashTimer = 0.24;
      this.audio.playTaser();
      this.setBanner(`${slot.data.name.toUpperCase()} FIRED GUARD TASER PULSE!`, 'warning', 1.8);
      this.emitHud();
      return;
    }

    this.audio.playCardInspect();
    this.setBanner(`${this.possessedNpcName.toUpperCase()} INTERACTED WITH ROOM`, 'neutral', 1.6);
    this.emitHud();
  }

  public setPossessConfig(range: number, duration: number): void {
    this.possessRange = THREE.MathUtils.clamp(range, 5, 25);
    this.possessDurationConfig = THREE.MathUtils.clamp(duration, 8, 90);
    this.emitHud();
  }

  // =========================================================================
  // IMMORTALITY, INFINITE REVIVES & OWNER MODE (7A - 7I)
  // =========================================================================
  public setImmortalActive(active: boolean): void {
    if (!this.immortalUnlocked && !this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.immortalActive = active;
    if (active) {
      this.immortalShieldFlash = 0.45;
      this.audio.playImmortalShield();
      this.setBanner('IMMORTALITY ENABLED!', 'success', 2.4);
    } else {
      this.audio.playUiClick();
      this.setBanner('Immortality disabled.', 'neutral', 2.0);
    }
    this.emitHud();
  }

  public toggleInfiniteRevives(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.ownerInfiniteRevives = !this.ownerInfiniteRevives;
    this.audio.playRevivePulse();
    this.setBanner(
      this.ownerInfiniteRevives ? 'INFINITE REVIVES ACTIVE!' : 'Infinite revives disabled.',
      this.ownerInfiniteRevives ? 'success' : 'neutral',
      2.4,
    );
    this.emitHud();
  }

  public toggleOwnerPanel(open?: boolean): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.audio.playUiClick();
    this.ownerPanelOpen = open !== undefined ? open : !this.ownerPanelOpen;
    if (this.ownerPanelOpen && this.pointerLocked) {
      document.exitPointerLock?.();
    }
    this.emitHud();
  }

  public ownerRestoreHealth(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.anomalyHp = 100;
    this.anomalyShockTimer = 0;
    this.strikes = 0;
    this.casualties = 0;
    this.escapeStamina = 100;
    this.escapeStaggerTimer = 0;
    this.taserCharges = this.maxTaserCharges;
    this.immortalShieldFlash = 0.45;
    this.audio.playRevivePulse();
    this.setBanner('OWNER POWER: HEALTH, CHARGES & CONDITION RESTORED TO 100%!', 'success', 2.6);
    this.emitHud();
  }

  public ownerRestoreSanity(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.sanity = 100;
    this.sanityState = 'stable';
    this.flickerEventTimer = 0;
    this.hallucinationFlash = null;
    this.corridorFaceFlash = null;
    this.audio.playRoundResult(true);
    this.setBanner('OWNER POWER: SANITY RESTORED TO 100%!', 'success', 2.4);
    this.emitHud();
  }

  public toggleOwnerInvisibility(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.ownerInvisible = !this.ownerInvisible;
    this.audio.playUiClick();
    this.setBanner(
      this.ownerInvisible ? 'OWNER STEALTH: INVISIBILITY ACTIVE (NPCS CANNOT SEE YOU)' : 'Invisibility off.',
      'warning',
      2.6,
    );
    this.emitHud();
  }

  public toggleOwnerFreecam(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt' && this.phase !== 'anomaly_mode') {
      this.setBanner('Enter the School or Anomaly Mode first to use Free-Camera.', 'warning', 2.4);
      return;
    }
    this.ownerFreecam = !this.ownerFreecam;
    if (this.ownerFreecam) {
      this.freecamPos.copy(this.camera.position);
      this.setBanner('OWNER FREE-CAM ON — WASD FLY · [SPACE] UP · [C] DOWN', 'warning', 3.4);
    } else {
      this.camera.position.set(this.playerPos.x, this.currentEyeHeight, this.playerPos.z);
      this.setBanner('Free-Camera disabled.', 'neutral', 2.0);
    }
    this.audio.playUiClick();
    this.emitHud();
  }

  public toggleOwnerNpcsPaused(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.ownerNpcsPaused = !this.ownerNpcsPaused;
    this.audio.playUiClick();
    this.setBanner(this.ownerNpcsPaused ? 'ALL NPCS PAUSED BY OWNER.' : 'NPCs resumed.', 'neutral', 2.2);
    this.emitHud();
  }

  public ownerCompleteObjective(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();

    if (this.phase === 'anomaly_mode') {
      for (const npc of this.anomalyNpcs) {
        if (npc.state !== 'caught') {
          npc.state = 'caught';
          npc.catchTimer = 0.2;
          if (npc.role === 'guard') {
            npc.bossHp = 0;
            this.anomalyGuardBossHp = 0;
            this.anomalyGuardBossAlive = false;
            this.anomalyGuardsCaught = 1;
          }
          this.anomalyCaughtCount++;
        }
      }
      this.anomalyStudentsCaught = this.anomalyTotalStudents;
      this.anomalyVictory = true;
      this.audio.playAnomalySurge();
      this.setBanner('OWNER POWER: ANOMALY OBJECTIVE COMPLETED!', 'success', 3.4);
      this.emitHud();
      return;
    }

    if (this.phase === 'arrival') {
      this.beginClassTime();
      this.setBanner('OWNER POWER: CHECKPOINT COMPLETE — CLASS SURVEILLANCE STARTED!', 'success', 3.0);
      return;
    }

    if (this.phase === 'classtime' || this.phase === 'hunt') {
      for (const s of this.actorSlots) {
        if (s.data.isFake) s.data.state = 'fled';
      }
      if (this.isShift6) {
        this.shift6Stage = 'completed';
        this.triggerShift6Ending();
      } else {
        this.finishDay();
      }
      return;
    }

    if (this.phase === 'escape_play') {
      this.startEscapeOutro();
    }
  }

  public ownerRestartCurrentShift(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.ownerPanelOpen = false;
    if (this.phase === 'anomaly_mode') {
      this.clearAnomalyMode();
      this.triggerAnomalyMode();
      return;
    }
    if (this.phase === 'escape_intro' || this.phase === 'escape_play' || this.phase === 'escape_outro') {
      this.startShift5Escape();
      return;
    }
    if (this.isShift6) {
      this.startShift6();
      return;
    }
    if (this.records.length === 0) {
      this.startNewCampaign();
      return;
    }
    this.startDay(this.day);
  }

  public resetOwnerTemporaryState(): void {
    this.audio.unlock();
    if (this.possessedNpcId) {
      this.releasePossession();
    } else {
      this.hasPrePossessAnchor = false;
    }
    this.guardNpc.frozen = false;
    this.guardNpc.behaviorOverride = 'default';
    this.guardNpc.speedMultiplier = 1.0;
    this.ownerInvisible = false;
    this.ownerFreecam = false;
    this.ownerNpcsPaused = false;
    this.ownerPlayerSpeed = 1.0;
    this.transformPlayer('original');
    this.dismissBodyguards();
    for (const slot of this.actorSlots) {
      slot.frozen = false;
      slot.behaviorOverride = 'default';
      slot.speedMultiplier = 1.0;
      if (slot.originalAppearance) {
        slot.data.appearance = slot.originalAppearance;
        slot.data.isFake = slot.originalIsFake ?? slot.data.isFake;
        slot.rig.configure(slot.originalAppearance, slot.data.isFake);
        slot.transformedAs = 'original';
      }
    }
    for (const npc of this.anomalyNpcs) {
      npc.frozen = false;
      npc.behaviorOverride = 'default';
      npc.speedMultiplier = 1.0;
    }
    this.audio.playUiClick();
    this.setBanner('TEMPORARY OWNER OVERRIDES RESET — CAMPAIGN PROGRESS PRESERVED.', 'success', 3.2);
    this.emitHud();
  }

  private buildOwnerNpcList(): OwnerNpcSummary[] {
    const out: OwnerNpcSummary[] = [];
    const zoneLabel = (x: number, z: number) =>
      x <= 2.4 && z <= 2.4
        ? 'Checking Room'
        : x > 2.4 && z < 14
          ? 'Room 101'
          : x > 2.4
            ? 'Room 102'
            : 'Corridor';

    if (this.phase === 'arrival' || this.phase === 'classtime' || this.phase === 'hunt') {
      out.push({
        id: this.guardNpc.id,
        source: 'guard',
        name: 'Night Security Guard',
        roleLabel: this.possessedNpcId ? 'Security Guard (AI Active)' : 'Security Guard (You)',
        zone: zoneLabel(this.guardNpc.x, this.guardNpc.z),
        isFake: false,
        frozen: this.guardNpc.frozen,
        behavior: this.guardNpc.behaviorOverride,
        speedMultiplier: this.guardNpc.speedMultiplier,
        possessed: !this.possessedNpcId,
      });
    }
    for (const s of this.actorSlots) {
      if (s.data.state === 'fled' || s.data.state === 'victimized') continue;
      out.push({
        id: s.data.uid,
        source: 'classroom',
        name: s.data.name,
        roleLabel: s.data.isFake ? 'Anomaly Mimic' : s.data.role === 'teacher' ? 'Teacher' : 'Student',
        zone: zoneLabel(s.data.pos.x, s.data.pos.z),
        isFake: s.data.isFake,
        frozen: Boolean(s.frozen),
        behavior: s.behaviorOverride ?? 'default',
        speedMultiplier: s.speedMultiplier ?? 1.0,
        possessed: Boolean(s.possessed),
      });
    }
    for (const n of this.anomalyNpcs) {
      if (n.state === 'caught') continue;
      out.push({
        id: n.id,
        source: 'anomaly',
        name: n.name,
        roleLabel: n.role === 'guard' ? 'Guard Boss' : 'Student',
        zone: zoneLabel(n.x, n.z),
        isFake: n.transformedAs === 'anomaly',
        frozen: Boolean(n.frozen),
        behavior: n.behaviorOverride ?? 'default',
        speedMultiplier: n.speedMultiplier ?? 1.0,
        possessed: Boolean(n.possessed),
      });
    }
    for (const b of this.ownerBodyguards) {
      out.push({
        id: b.id,
        source: 'bodyguard',
        name: b.name,
        roleLabel: 'Friendly Bodyguard',
        zone: zoneLabel(b.x, b.z),
        isFake: false,
        frozen: b.frozen,
        behavior: b.behavior,
        speedMultiplier: b.speedMultiplier,
        possessed: false,
      });
    }
    return out;
  }

  public setOwnerPlayerSpeed(mult: number): void {
    this.ownerPlayerSpeed = THREE.MathUtils.clamp(mult, 0.35, 3.5);
    this.emitHud();
  }

  public setOwnerNpcSpeed(id: string, mult: number): void {
    const clamped = THREE.MathUtils.clamp(mult, 0.35, 3.2);
    if (id === this.guardNpc.id) this.guardNpc.speedMultiplier = clamped;
    const slot = this.actorSlots.find((s) => s.data.uid === id);
    if (slot) slot.speedMultiplier = clamped;
    const npc = this.anomalyNpcs.find((n) => n.id === id);
    if (npc) npc.speedMultiplier = clamped;
    const bg = this.ownerBodyguards.find((b) => b.id === id);
    if (bg) bg.speedMultiplier = clamped;
    this.emitHud();
  }

  public toggleNpcFreeze(id: string): void {
    if (id === this.guardNpc.id) this.guardNpc.frozen = !this.guardNpc.frozen;
    const slot = this.actorSlots.find((s) => s.data.uid === id);
    if (slot) slot.frozen = !slot.frozen;
    const npc = this.anomalyNpcs.find((n) => n.id === id);
    if (npc) npc.frozen = !npc.frozen;
    const bg = this.ownerBodyguards.find((b) => b.id === id);
    if (bg) bg.frozen = !bg.frozen;
    this.audio.playUiClick();
    this.emitHud();
  }

  public setNpcBehavior(id: string, behavior: NpcBehaviorOverride): void {
    if (id === this.guardNpc.id) this.guardNpc.behaviorOverride = behavior;
    const slot = this.actorSlots.find((s) => s.data.uid === id);
    if (slot) slot.behaviorOverride = behavior;
    const npc = this.anomalyNpcs.find((n) => n.id === id);
    if (npc) {
      npc.behaviorOverride = behavior;
      if (behavior === 'default') {
        npc.state = npc.role === 'guard' ? 'patrol' : 'walk';
      }
    }
    const bg = this.ownerBodyguards.find((b) => b.id === id);
    if (bg) bg.behavior = behavior;
    this.audio.playUiClick();
    this.emitHud();
  }

  public teleportNpcToZone(
    id: string,
    zone: 'checking' | 'corridor' | 'room101' | 'room102',
  ): void {
    const spotMap = {
      checking: VALID_SCHOOL_TELEPORT_SPOTS.checkpoint,
      corridor: VALID_SCHOOL_TELEPORT_SPOTS.corridor,
      room101: VALID_SCHOOL_TELEPORT_SPOTS.room101,
      room102: VALID_SCHOOL_TELEPORT_SPOTS.room102,
    };
    const dst = spotMap[zone];
    if (!dst) return;
    const offset = (Math.random() - 0.5) * 0.8;
    const tx = dst.x + offset;
    const tz = dst.z + offset;

    if (id === this.guardNpc.id) {
      this.guardNpc.x = tx;
      this.guardNpc.z = tz;
      this.guardNpc.currentNode = findClosestSafeNavNode(tx, tz);
      this.guardNpc.targetNode = this.guardNpc.currentNode;
      this.guardNpc.rig.root.position.set(tx, 0, tz);
      if (!this.possessedNpcId) {
        this.playerPos.set(tx, this.currentEyeHeight, tz);
      }
    }
    const slot = this.actorSlots.find((s) => s.data.uid === id);
    if (slot) {
      slot.data.pos.x = tx;
      slot.data.pos.z = tz;
      slot.rig.root.position.set(tx, 0, tz);
    }
    const npc = this.anomalyNpcs.find((n) => n.id === id);
    if (npc) {
      npc.x = tx;
      npc.z = tz;
      npc.currentNode = findClosestSafeNavNode(tx, tz);
      npc.targetNode = npc.currentNode;
      npc.rig.root.position.set(tx, 0, tz);
    }
    const bg = this.ownerBodyguards.find((b) => b.id === id);
    if (bg) {
      bg.x = tx;
      bg.z = tz;
      bg.holdX = tx;
      bg.holdZ = tz;
      bg.rig.root.position.set(tx, 0, tz);
    }
    this.audio.playUiClick();
    this.emitHud();
  }

  public transformNpc(id: string, target: CharacterTransformTarget): void {
    const slot = this.actorSlots.find((s) => s.data.uid === id);
    if (slot) {
      if (!slot.originalAppearance) {
        slot.originalAppearance = slot.data.appearance;
        slot.originalIsFake = slot.data.isFake;
      }
      if (target === 'original') {
        slot.data.appearance = slot.originalAppearance;
        slot.data.isFake = slot.originalIsFake ?? slot.data.isFake;
        slot.rig.configure(slot.originalAppearance, slot.data.isFake);
      } else {
        const next = buildTransformedAppearance(target, slot.originalAppearance);
        slot.data.appearance = next.appearance;
        slot.data.isFake = target === 'anomaly';
        slot.rig.configure(next.appearance, next.extraFingers);
      }
      slot.transformedAs = target;
      this.audio.playAnomalyTransform();
      this.emitHud();
      return;
    }

    const npc = this.anomalyNpcs.find((n) => n.id === id);
    if (npc) {
      if (target !== 'original') {
        const next = buildTransformedAppearance(target);
        npc.rig.configure(next.appearance, next.extraFingers);
      } else {
        const next = buildTransformedAppearance(npc.role === 'guard' ? 'guard' : 'student');
        npc.rig.configure(next.appearance, next.extraFingers);
      }
      npc.transformedAs = target;
      this.audio.playAnomalyTransform();
      this.emitHud();
    }
  }

  public transformPlayer(target: CharacterTransformTarget): void {
    this.audio.unlock();
    this.ownerPlayerForm = target;
    if (target === 'anomaly') {
      this.flashlight.color.setHex(0xff5252);
      this.anomalyHandsGroup.visible = true;
      this.camera.fov = 74;
      this.camera.updateProjectionMatrix();
      this.setBanner('TRANSFORMED INTO ANOMALY FORM!', 'danger', 2.8);
    } else if (target === 'guard') {
      this.flashlight.color.setHex(0xfff1dc);
      this.anomalyHandsGroup.visible = false;
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
      this.setBanner('TRANSFORMED INTO SECURITY GUARD FORM!', 'warning', 2.6);
    } else if (target === 'student' || target === 'teacher') {
      this.flashlight.color.setHex(0xdbeafe);
      this.anomalyHandsGroup.visible = false;
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
      this.setBanner(`TRANSFORMED INTO ${target.toUpperCase()} FORM!`, 'neutral', 2.4);
    } else {
      this.flashlight.color.setHex(this.phase === 'anomaly_mode' ? 0xff5252 : 0xfff1dc);
      this.anomalyHandsGroup.visible = this.phase === 'anomaly_mode';
      this.camera.fov = this.phase === 'anomaly_mode' ? 74 : 65;
      this.camera.updateProjectionMatrix();
      this.setBanner('Restored original character form.', 'neutral', 2.2);
    }
    this.audio.playAnomalyTransform();
    this.emitHud();
  }

  public spawnOwnerNpc(role: 'student' | 'teacher' | 'guard' | 'anomaly'): void {
    if (!this.ownerModeUnlocked) return;
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt' && this.phase !== 'anomaly_mode') {
      this.setBanner('Load into School Shift or Anomaly Mode to spawn NPCs.', 'warning', 2.4);
      return;
    }
    this.audio.unlock();
    this.ownerSpawnedSeq++;
    const roster = this.records.length > 0 ? this.records : generateFiveDayCampaign().records;

    if (this.phase === 'anomaly_mode') {
      if (this.anomalyNpcs.length >= 34) {
        this.setBanner('Max performance NPC cap reached (34).', 'warning', 2.2);
        return;
      }
      const npc = spawnAnomalyModeNpc(
        role === 'guard' ? 'guard' : 'student',
        this.ownerSpawnedSeq + 20,
        roster,
        this.skinTextures,
        this.scene,
        this.playerPos.x,
        this.playerPos.z,
        this.world.colliders,
      );
      if (role === 'anomaly' || role === 'teacher') {
        const next = buildTransformedAppearance(role);
        npc.rig.configure(next.appearance, next.extraFingers);
        npc.transformedAs = role;
        npc.name = `Owner Spawned ${role.toUpperCase()} #${this.ownerSpawnedSeq}`;
      }
      this.anomalyNpcs.push(npc);
      this.audio.playBodyguardSummon();
      this.emitHud();
      return;
    }

    if (this.actorSlots.length >= 26) {
      this.setBanner('Max performance NPC cap reached (26).', 'warning', 2.2);
      return;
    }
    const uid = `owner_npc_${Date.now()}_${this.ownerSpawnedSeq}`;
    const next = buildTransformedAppearance(role);
    const rig = createRealisticHuman(this.skinTextures);
    rig.configure(next.appearance, next.extraFingers);
    const sx = THREE.MathUtils.clamp(this.playerPos.x + (Math.random() - 0.5) * 1.8, -1.8, 8.8);
    const sz = THREE.MathUtils.clamp(this.playerPos.z + (Math.random() - 0.5) * 1.8, 0.2, 22.0);
    rig.root.position.set(sx, 0, sz);
    this.scene.add(rig.root);

    this.actorSlots.push({
      data: {
        uid,
        name: `Owner ${role.charAt(0).toUpperCase() + role.slice(1)} #${this.ownerSpawnedSeq}`,
        role: role === 'teacher' || role === 'guard' ? 'teacher' : 'student',
        isFake: role === 'anomaly',
        room: 'corridor',
        seatIndex: 0,
        pos: { x: sx, z: sz },
        yaw: 0,
        state: role === 'anomaly' && this.phase === 'hunt' ? 'hunting' : 'seated',
        taserHits: 0,
        revealBehavior: role === 'anomaly' ? 'not_blinking' : 'normal',
        appearance: next.appearance,
      },
      rig,
      seatWaypoints: [],
      targetSeatYaw: 0,
      seatedTime: 0,
      phaseOffset: this.ownerSpawnedSeq * 0.6,
      studentAction: 'listening',
      studentActionTimer: 4,
      teacherAction: 'lecturing',
      teacherActionTimer: 4,
      teacherPatrolIdx: 0,
      stunTimer: 0,
      searchTimer: 0,
      passCooldown: 0,
      closeToHiddenTimer: 0,
      willLinger: false,
      discoveryCheckAccum: 0,
      attackTimer: 16,
      waypointIdx: 0,
      noiseTarget: null,
      behaviorOverride: 'patrol',
      originalAppearance: next.appearance,
      originalIsFake: role === 'anomaly',
    });
    this.audio.playBodyguardSummon();
    this.emitHud();
  }

  public despawnOwnerNpc(id: string): void {
    const slotIdx = this.actorSlots.findIndex((s) => s.data.uid === id);
    if (slotIdx !== -1) {
      if (this.possessedNpcId === id) this.releasePossession();
      const slot = this.actorSlots[slotIdx];
      this.scene.remove(slot.rig.root);
      slot.rig.dispose();
      this.actorSlots.splice(slotIdx, 1);
      this.emitHud();
      return;
    }
    const npcIdx = this.anomalyNpcs.findIndex((n) => n.id === id);
    if (npcIdx !== -1) {
      if (this.possessedNpcId === id) this.releasePossession();
      const npc = this.anomalyNpcs[npcIdx];
      this.scene.remove(npc.rig.root);
      npc.rig.dispose();
      this.anomalyNpcs.splice(npcIdx, 1);
      this.emitHud();
    }
  }

  // 7E. BODYGUARD SYSTEM
  public summonBodyguards(count: number): void {
    if (!this.ownerModeUnlocked) return;
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt' && this.phase !== 'anomaly_mode') {
      this.setBanner('Enter the school before summoning bodyguards.', 'warning', 2.4);
      return;
    }
    this.audio.unlock();
    this.dismissBodyguards();
    const clamped = THREE.MathUtils.clamp(Math.round(count), 1, 5);
    for (let i = 0; i < clamped; i++) {
      const bg = spawnBodyguardUnit(
        i,
        this.playerPos.x,
        this.playerPos.z,
        this.skinTextures,
        this.scene,
        this.world.colliders,
      );
      bg.behavior = this.ownerBodyguardStance === 'follow' ? 'follow' : 'stand';
      this.ownerBodyguards.push(bg);
    }
    this.audio.playBodyguardSummon();
    this.setBanner(`SUMMONED ${clamped} FRIENDLY BODYGUARD${clamped > 1 ? 'S' : ''}!`, 'success', 2.8);
    this.emitHud();
  }

  public setBodyguardStance(stance: BodyguardStance): void {
    this.ownerBodyguardStance = stance;
    for (const g of this.ownerBodyguards) {
      g.behavior = stance === 'follow' ? 'follow' : 'stand';
      if (stance === 'hold') {
        g.holdX = g.x;
        g.holdZ = g.z;
      }
    }
    this.audio.playUiClick();
    this.emitHud();
  }

  public recallBodyguards(): void {
    this.ownerBodyguardStance = 'follow';
    for (let i = 0; i < this.ownerBodyguards.length; i++) {
      const g = this.ownerBodyguards[i];
      const moved = movePointWithSchoolCollisions(
        this.playerPos.x,
        this.playerPos.z,
        Math.cos(i * 1.4) * 1.3,
        Math.sin(i * 1.4) * 1.3,
        this.world.colliders,
      );
      g.x = moved.x;
      g.z = moved.z;
      g.behavior = 'follow';
      g.rig.root.position.set(g.x, 0, g.z);
    }
    this.audio.playBodyguardSummon();
    this.setBanner('RECALLED ALL BODYGUARDS TO YOUR POSITION!', 'success', 2.2);
    this.emitHud();
  }

  public dismissBodyguards(): void {
    for (const g of this.ownerBodyguards) {
      this.scene.remove(g.rig.root);
      g.rig.dispose();
    }
    this.ownerBodyguards = [];
    this.emitHud();
  }

  public unstuckBodyguards(): void {
    this.recallBodyguards();
    this.setBanner('Bodyguards restored to safe nav positions.', 'neutral', 2.0);
  }

  private updateOwnerBodyguardsTick(dt: number): void {
    if (this.ownerBodyguards.length === 0) return;
    updateBodyguards(
      this.ownerBodyguards,
      this.ownerBodyguardStance,
      this.playerPos.x,
      this.playerPos.z,
      this.yaw,
      dt,
      this.totalTime,
      this.world.colliders,
      this.ownerNpcsPaused,
    );

    // Friendly defensive stagger if hostile threat approaches player directly
    if (!this.ownerNpcsPaused && (this.phase === 'hunt' || this.phase === 'anomaly_mode')) {
      for (const g of this.ownerBodyguards) {
        if (g.attackCooldown > 0) continue;
        if (this.phase === 'hunt') {
          const fake = this.actorSlots.find(
            (s) =>
              s.data.isFake &&
              s.data.state === 'hunting' &&
              s.stunTimer <= 0 &&
              Math.hypot(s.data.pos.x - g.x, s.data.pos.z - g.z) < 1.6,
          );
          if (fake) {
            fake.stunTimer = 2.6;
            fake.data.state = 'stunned';
            g.attackCooldown = 4.5;
            this.audio.playTaser();
            this.setBanner(`${g.name} STUNNED ${fake.data.name.toUpperCase()}!`, 'success', 2.0);
          }
        }
      }
    }
  }

  // 7F. TELEPORTATION SYSTEM
  public teleportToDestination(dest: TeleportDestinationId): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.ownerPanelOpen = false;
    this.ownerFreecam = false;
    this.releasePossession(true);
    this.activeHidingSpot = null;
    this.activeOverlay = 'none';

    if (dest === 'menu') {
      this.returnToMainMenu();
      return;
    }
    if (dest === 'shift5_intro' || dest === 'shift5_ending') {
      this.triggerShift5Ending();
      return;
    }
    if (dest === 'shift5_chase') {
      this.triggerShift5Ending();
      this.retryEscapeChase();
      return;
    }
    if (dest === 'ending_screen') {
      this.triggerCampaignVictory();
      return;
    }
    if (dest === 'shift6') {
      this.startShift6();
      return;
    }
    if (dest === 'shift1' || dest === 'shift2' || dest === 'shift3' || dest === 'shift4' || dest === 'shift5') {
      const targetDay = Number(dest.replace('shift', ''));
      this.isShift6 = false;
      this.shift6CompletedModal = false;
      this.clearEscapeActors();
      this.clearKidnapperActors();
      this.clearAnomalyMode();
      this.world.introGroup.visible = false;
      this.world.schoolGroup.visible = true;
      this.escapeWorld.escapeGroup.visible = false;
      this.kidnapperWorld.group.visible = false;
      this.flashlight.color.setHex(0xfff1dc);
      this.flashlight.intensity = 4.4;
      if (this.records.length === 0) {
        const campaign = generateFiveDayCampaign();
        this.records = campaign.records;
        this.campaignDays = campaign.days;
      }
      this.startDay(targetDay);
      return;
    }

    // In-school room teleport (entrance, checkpoint, cctv_desk, room101, room102)
    if (this.phase !== 'arrival' && this.phase !== 'classtime' && this.phase !== 'hunt' && this.phase !== 'anomaly_mode') {
      if (this.records.length === 0) {
        const campaign = generateFiveDayCampaign();
        this.records = campaign.records;
        this.campaignDays = campaign.days;
      }
      this.world.introGroup.visible = false;
      this.world.schoolGroup.visible = true;
      this.escapeWorld.escapeGroup.visible = false;
      this.kidnapperWorld.group.visible = false;
      this.flashlight.color.setHex(0xfff1dc);
      this.flashlight.intensity = 4.4;
      this.startDay(this.day);
    }

    const coord =
      dest === 'entrance'
        ? VALID_SCHOOL_TELEPORT_SPOTS.entrance
        : dest === 'cctv_desk'
          ? VALID_SCHOOL_TELEPORT_SPOTS.cctv_desk
          : dest === 'room101'
            ? VALID_SCHOOL_TELEPORT_SPOTS.room101
            : dest === 'room102'
              ? VALID_SCHOOL_TELEPORT_SPOTS.room102
              : VALID_SCHOOL_TELEPORT_SPOTS.checkpoint;

    const eye = this.phase === 'anomaly_mode' ? 1.82 : EYE_HEIGHT;
    this.playerPos.set(coord.x, eye, coord.z);
    this.currentEyeHeight = eye;
    this.yaw = coord.yaw;
    this.pitch = -0.02;
    this.camera.position.copy(this.playerPos);
    this.audio.playRevivePulse();
    this.setBanner(`TELEPORTED TO ${dest.replace('_', ' ').toUpperCase()}!`, 'success', 2.4);
    this.emitHud();
  }

  // 7G & 7I. SHIFT 6 + CAMPAIGN VICTORY END SCREEN
  public startShift6(): void {
    if (!this.ownerModeUnlocked) return;
    this.audio.unlock();
    this.audio.stopNewsBroadcast();
    this.audio.stopTvStatic();
    this.releasePossession(true);
    this.hasPrePossessAnchor = false;
    this.ownerFreecam = false;
    this.ownerPanelOpen = false;
    this.clearActorSlots();
    this.clearEscapeActors();
    this.clearKidnapperActors();
    this.clearAnomalyMode();

    const campaign = generateFiveDayCampaign();
    this.records = campaign.records;
    this.campaignDays = campaign.days;
    this.caseLogs = [];
    this.loggedCaseUids.clear();

    this.isShift6 = true;
    this.shift6Stage = 'lockdown';
    this.shift6CompletedModal = false;
    this.day = 6;
    this.casualties = 0;
    this.strikes = 0;
    this.sanity = 100;
    this.sanityState = 'stable';
    this.taserCharges = this.maxTaserCharges + 2;
    this.maxTaserCharges = 6;
    this.taserTakenFromRoom = true;
    this.hasTaserInHand = true;
    this.room101Locked = false;
    this.room102Locked = false;
    this.activeOverlay = 'none';
    this.canRetryEscape = false;
    this.coronerReport = null;

    this.world.introGroup.visible = false;
    this.world.schoolGroup.visible = true;
    this.escapeWorld.escapeGroup.visible = false;
    this.kidnapperWorld.group.visible = false;
    this.arrivalRig.root.visible = false;
    this.scene.fog = new THREE.FogExp2(0x0b0509, 0.048);
    this.flashlight.color.setHex(0xfff1dc);
    this.flashlight.intensity = 4.8;
    this.audio.setAmbientHumLevel(0.05);

    this.playerPos.set(-0.35, EYE_HEIGHT, -0.55);
    this.currentEyeHeight = EYE_HEIGHT;
    this.yaw = Math.PI;
    this.pitch = -0.02;
    this.resetGuardNpcTransform(-0.35, -0.55, 0);

    // Spawn 4 corrupted anomalies patrolling Rooms 101, 102 & Corridor
    const spawnSpots = [
      { x: 6.2, z: 9.6, room: 'room101' as const, name: 'Corrupted Mimic Alpha' },
      { x: 6.2, z: 18.0, room: 'room102' as const, name: 'Corrupted Mimic Beta' },
      { x: 0.2, z: 13.5, room: 'corridor' as const, name: 'Warden Anomaly' },
      { x: 4.5, z: 19.2, room: 'room102' as const, name: 'Shadowed Mimic Gamma' },
    ];
    spawnSpots.forEach((sp, idx) => {
      const next = buildTransformedAppearance('anomaly');
      const rig = createRealisticHuman(this.skinTextures);
      rig.configure(next.appearance, true);
      rig.root.position.set(sp.x, 0, sp.z);
      this.scene.add(rig.root);
      this.actorSlots.push({
        data: {
          uid: `shift6_anom_${idx}`,
          name: sp.name,
          role: idx % 2 === 0 ? 'teacher' : 'student',
          isFake: true,
          room: sp.room,
          seatIndex: 0,
          pos: { x: sp.x, z: sp.z },
          yaw: 0,
          state: 'hunting',
          taserHits: 0,
          revealBehavior: 'not_blinking',
          appearance: next.appearance,
        },
        rig,
        seatWaypoints: [],
        targetSeatYaw: 0,
        seatedTime: 0,
        phaseOffset: idx * 0.9,
        studentAction: 'listening',
        studentActionTimer: 4,
        teacherAction: 'lecturing',
        teacherActionTimer: 4,
        teacherPatrolIdx: 0,
        stunTimer: 0,
        searchTimer: 0,
        passCooldown: 0,
        closeToHiddenTimer: 0,
        willLinger: false,
        discoveryCheckAccum: 0,
        attackTimer: 22.0,
        waypointIdx: idx % HUNT_WAYPOINTS.length,
        noiseTarget: null,
      });
    });

    this.phase = 'hunt';
    this.setBanner(
      'SHIFT 6: MIDNIGHT BREACH — LOCK CLASSROOMS VIA CCTV [3] OR BANISH ALL 4 ANOMALIES WITH TASER [R]!',
      'danger',
      5.5,
    );
    this.emitHud();
  }

  private getShift6ObjectiveText(): string {
    if (!this.isShift6) return '';
    const remaining = this.actorSlots.filter((s) => s.data.isFake && s.data.state !== 'fled').length;
    if (this.shift6Stage === 'lockdown' && !this.room101Locked && !this.room102Locked && remaining > 0) {
      return `LOCK CLASSROOMS (CCTV [3]) & BANISH ANOMALIES (${remaining} LEFT)`;
    }
    if (remaining > 0) {
      return `BANISH REMAINING BREACH ANOMALIES WITH TASER [R] (${remaining} LEFT)`;
    }
    if (this.shift6Stage === 'escape_gate') {
      return 'RETURN TO CHECKING ROOM GATE TO SEAL SHIFT 6!';
    }
    return 'SHIFT 6 COMPLETE!';
  }

  private checkShift6Progression(_dt: number): void {
    if (!this.isShift6 || this.phase !== 'hunt') return;
    const remaining = this.actorSlots.filter((s) => s.data.isFake && s.data.state !== 'fled').length;
    if (remaining > 0 && (this.room101Locked || this.room102Locked)) {
      this.shift6Stage = 'banish';
    } else if (remaining === 0 && this.shift6Stage !== 'escape_gate' && this.shift6Stage !== 'completed') {
      this.shift6Stage = 'escape_gate';
      this.setBanner('ALL SHIFT 6 ANOMALIES BANISHED — RETURN TO CHECKING ROOM!', 'success', 4.5);
      this.emitHud();
    } else if (this.shift6Stage === 'escape_gate' && this.isInCheckingRoom()) {
      this.finishDay();
    }
  }

  public triggerShift6Ending(): void {
    if (!this.ownerModeUnlocked) return;
    this.isShift6 = true;
    this.shift6Stage = 'completed';
    this.shift6CompletedModal = true;
    this.campaignSave.shift6Completed = true;
    this.persistCampaignSave();
    this.phase = 'victory';
    this.audio.setAmbientHumLevel(0);
    this.audio.playDistantSchoolBell();
    this.audio.playCreditsThemeChord();
    document.exitPointerLock?.();
    this.setBanner('SHIFT 6 BREACH SEALED — CONGRATULATIONS!', 'success', 5.0);
    this.emitHud();
  }

  public dismissShift6Modal(): void {
    this.shift6CompletedModal = false;
    this.emitHud();
  }

  public triggerCampaignVictory(): void {
    this.isShift6 = false;
    this.shift6CompletedModal = false;
    this.phase = 'victory';
    this.audio.setAmbientHumLevel(0);
    this.audio.playDistantSchoolBell();
    document.exitPointerLock?.();
    this.emitHud();
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onWindowBlur);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);

    this.handTaserGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });

    this.anomalyHandsGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });

    this.possessTargetOutline.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });

    this.taserBeamMesh.geometry.dispose();
    this.taserBeamMat.dispose();

    this.shadowHallucinationGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });

    this.faceHallucinationGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });

    Object.values(this.cctvTargets).forEach((rt) => rt.dispose());
    this.dismissBodyguards();
    this.clearActorSlots();
    this.clearEscapeActors();
    this.clearKidnapperActors();
    this.clearAnomalyMode();
    this.guardNpc.rig.dispose();
    this.arrivalRig.dispose();
    this.audio.dispose();
    this.world.dispose();
    this.escapeWorld.dispose();
    this.kidnapperWorld.dispose();
    this.skinTextures.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
