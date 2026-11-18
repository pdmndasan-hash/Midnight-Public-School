import * as THREE from 'three';
import { HidingSpotInfo } from '../types/game';
import { SchoolTextureSet } from './textures';

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface FluorescentFixture {
  tubeMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  baseIntensity: number;
  flickerPhase: number;
}

export interface CardboardBoxRig {
  spotId: string;
  flapLeft: THREE.Mesh;
  flapRight: THREE.Mesh;
  flapFront: THREE.Mesh;
}

export interface LockerRig {
  spotId: string;
  doorPivot: THREE.Group;
}

export const ROOM101_SEATS = [
  { x: 4.8, z: 8.2 },
  { x: 4.8, z: 10.4 },
  { x: 7.4, z: 8.2 },
  { x: 7.4, z: 10.4 },
];

export const ROOM102_SEATS = [
  { x: 4.8, z: 16.6 },
  { x: 4.8, z: 18.8 },
  { x: 7.4, z: 16.6 },
  { x: 7.4, z: 18.8 },
];

export interface CheckpointWorldObjects {
  introGroup: THREE.Group;
  schoolGroup: THREE.Group;
  tvCanvas: HTMLCanvasElement;
  tvCtx: CanvasRenderingContext2D;
  tvTexture: THREE.CanvasTexture;
  tvLight: THREE.PointLight;
  colliders: AABB[];
  hidingSpots: HidingSpotInfo[];
  taserDeskGroup: THREE.Group;
  taserArcLight: THREE.PointLight;
  scannerBeam: THREE.Mesh;
  scannerLight: THREE.PointLight;
  cctvScreenMats: {
    cam101: THREE.MeshBasicMaterial;
    cam102: THREE.MeshBasicMaterial;
    camCorridor: THREE.MeshBasicMaterial;
  };
  updateEnvironment: (
    time: number,
    dt: number,
    gateOpen: boolean,
    scanning: boolean,
    room101Locked: boolean,
    room102Locked: boolean,
    activeBoxId: string | null,
    taserFlashTimer: number,
    hasTaserInHand: boolean,
    lightFlickerActive?: boolean,
    hallucinationBbRoom?: 'room101' | 'room102' | null,
    hallucinationBbIdx?: number,
  ) => void;
  getLightLevelAt: (x: number, z: number) => number;
  dispose: () => void;
}

export function buildCheckpointSchoolWorld(
  textures: SchoolTextureSet,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): CheckpointWorldObjects {
  const introGroup = new THREE.Group();
  const schoolGroup = new THREE.Group();
  const colliders: AABB[] = [];
  const hidingSpots: HidingSpotInfo[] = [];
  const boxRigs: CardboardBoxRig[] = [];
  const lockerRigs: LockerRig[] = [];
  const fixtures: FluorescentFixture[] = [];
  const blackboardMats: Partial<Record<'room101' | 'room102', THREE.MeshStandardMaterial>> = {};
  const blackboardStates: Record<'room101' | 'room102', number> = { room101: -1, room102: -1 };

  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.wallMap,
    bumpMap: textures.wallBump,
    bumpScale: 0.025,
    roughness: 0.88,
    metalness: 0.02,
  });

  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.floorMap,
    bumpMap: textures.floorBump,
    bumpScale: 0.015,
    roughness: 0.54,
    metalness: 0.06,
  });

  const ceilingMat = new THREE.MeshStandardMaterial({
    map: textures.ceilingMap,
    roughness: 0.94,
    metalness: 0.0,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.woodMap,
    roughness: 0.72,
    metalness: 0.04,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x262b30,
    roughness: 0.36,
    metalness: 0.78,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xa1864d,
    roughness: 0.28,
    metalness: 0.88,
  });

  const lockerMat = new THREE.MeshStandardMaterial({
    map: textures.lockerMap,
    roughness: 0.45,
    metalness: 0.62,
  });

  const cardboardMat = new THREE.MeshStandardMaterial({
    map: textures.cardboardMap,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbdd4e4,
    roughness: 0.1,
    metalness: 0.08,
    transparent: true,
    opacity: 0.22,
  });

  // =========================================================================
  // 1. INTRO DARK ROOM & CRT TV
  // =========================================================================
  const tvCanvas = document.createElement('canvas');
  tvCanvas.width = 512;
  tvCanvas.height = 384;
  const tvCtx = tvCanvas.getContext('2d')!;
  const tvTexture = new THREE.CanvasTexture(tvCanvas);
  tvTexture.colorSpace = THREE.SRGBColorSpace;
  tvTexture.anisotropy = maxAnisotropy;

  const introFloor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), woodMat);
  introFloor.rotation.x = -Math.PI / 2;
  introGroup.add(introFloor);

  const introWallB = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 0.2), wallMat);
  introWallB.position.set(0, 1.75, -2.5);
  const introWallL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 7), wallMat);
  introWallL.position.set(-2.8, 1.75, 0);
  const introWallR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 7), wallMat);
  introWallR.position.set(2.8, 1.75, 0);
  introGroup.add(introWallB, introWallL, introWallR);

  const tvStand = new THREE.Group();
  tvStand.position.set(0, 0, -1.65);
  const standTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.72), woodMat);
  standTop.position.y = 0.74;
  tvStand.add(standTop);
  [
    [-0.65, -0.28],
    [0.65, -0.28],
    [-0.65, 0.28],
    [0.65, 0.28],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.08), woodMat);
    leg.position.set(lx, 0.37, lz);
    tvStand.add(leg);
  });
  introGroup.add(tvStand);

  const crtGroup = new THREE.Group();
  crtGroup.position.set(0, 0.775, -1.65);
  const tvCaseMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.58, metalness: 0.14 });
  const tvBody = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.7, 0.52), tvCaseMat);
  tvBody.position.y = 0.35;
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.52), new THREE.MeshBasicMaterial({ map: tvTexture }));
  tvScreen.position.set(-0.04, 0.36, 0.265);
  const dialPanel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.03), darkSteelMat);
  dialPanel.position.set(0.38, 0.36, 0.255);
  crtGroup.add(tvBody, tvScreen, dialPanel);
  const tvLight = new THREE.PointLight(0x8bb6e8, 2.2, 6.5, 1.8);
  tvLight.position.set(0, 1.2, -1.05);
  introGroup.add(crtGroup, tvLight);

  // =========================================================================
  // 2. MIDNIGHT PUBLIC SCHOOL ARCHITECTURE (Checking Room + Corridor + Room 101 + Room 102)
  // =========================================================================
  const addWall = (x: number, y: number, z: number, w: number, h: number, d: number, collide = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = !isSoftwareGl;
    schoolGroup.add(m);
    if (collide) {
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
    return m;
  };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 38), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(4.0, 0, 8.0);
  floor.receiveShadow = true;
  schoolGroup.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(24, 38), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(4.0, 3.35, 8.0);
  schoolGroup.add(ceiling);

  // Outer Perimeter
  addWall(-2.5, 1.68, 8.0, 0.2, 3.36, 33.0); // West wall Z = -8.5 .. +24.5
  addWall(0, 1.68, -8.5, 5.2, 3.36, 0.2);   // North arrival outer wall
  addWall(0, 1.68, 24.5, 5.2, 3.36, 0.2);   // South corridor end wall

  // East Arrival & Checking Wall (X = +2.5, Z = -8.5 .. +6.5)
  addWall(2.5, 1.68, -1.0, 0.2, 3.36, 15.0);
  // East Corridor Wall between Room 101 (Z=8..11) and Room 102 (Z=16.5..19.5)
  addWall(2.5, 1.68, 7.25, 0.2, 3.36, 1.5);   // Z = 6.5..8.0
  addWall(2.5, 2.9, 9.5, 0.22, 0.9, 3.0, false); // Room 101 Door Header
  addWall(2.5, 1.68, 13.75, 0.2, 3.36, 5.5);  // Z = 11.0..16.5
  addWall(2.5, 2.9, 18.0, 0.22, 0.9, 3.0, false); // Room 102 Door Header
  addWall(2.5, 1.68, 22.0, 0.2, 3.36, 5.0);   // Z = 19.5..24.5

  // Room 101 (X: 2.5..10.6, Z: 6.0..13.6)
  addWall(6.55, 1.68, 6.0, 8.2, 3.36, 0.2);
  addWall(6.55, 1.68, 13.6, 8.2, 3.36, 0.2);
  addWall(10.6, 1.68, 9.8, 0.2, 3.36, 7.8);

  // Room 102 (X: 2.5..10.6, Z: 14.4..22.0)
  addWall(6.55, 1.68, 14.4, 8.2, 3.36, 0.2);
  addWall(6.55, 1.68, 22.0, 8.2, 3.36, 0.2);
  addWall(10.6, 1.68, 18.2, 0.2, 3.36, 7.8);

  // Lockdown Steel Shutters on Room 101 & Room 102 Doors
  const shutter101 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 3.0), darkSteelMat);
  shutter101.position.set(2.5, 3.6, 9.5);
  const shutter102 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 3.0), darkSteelMat);
  shutter102.position.set(2.5, 3.6, 18.0);
  schoolGroup.add(shutter101, shutter102);

  // =========================================================================
  // 3. CHECKING ROOM COUNTER, GLASS, GATE, CCTV MONITORS & TASER
  // =========================================================================
  const counterBase = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.04, 0.65), woodMat);
  counterBase.position.set(-0.7, 0.52, -2.35);
  schoolGroup.add(counterBase);
  colliders.push({ minX: -2.4, maxX: 1.0, minZ: -2.7, maxZ: -2.0 });

  const glassPane = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.25, 0.04), glassMat);
  glassPane.position.set(-0.7, 1.68, -2.35);
  schoolGroup.add(glassPane);

  const headerBar = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.95, 0.22), wallMat);
  headerBar.position.set(0, 2.88, -2.35);
  schoolGroup.add(headerBar);

  // Security Gate Door
  const gateDoorPivot = new THREE.Group();
  gateDoorPivot.position.set(1.02, 0, -2.35);
  const gateMesh = new THREE.Mesh(new THREE.BoxGeometry(1.36, 2.32, 0.07), darkSteelMat);
  gateMesh.position.set(0.68, 1.16, 0);
  const gateBar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.12), brassMat);
  gateBar.position.set(0.68, 1.05, 0.04);
  gateDoorPivot.add(gateMesh, gateBar);
  schoolGroup.add(gateDoorPivot);

  // Back wall separating Checking Room from Corridor (Z = +2.25, open doorway X = -0.8..0.9)
  addWall(-1.65, 1.68, 2.25, 1.7, 3.36, 0.2);
  addWall(1.7, 1.68, 2.25, 1.6, 3.36, 0.2);
  addWall(0.05, 2.9, 2.25, 1.7, 0.9, 0.22, false);

  // Security Desk with Record Terminal, 2 CCTV Monitors & Taser Dock
  const guardDesk = new THREE.Group();
  guardDesk.position.set(-0.65, 0, -1.55);
  const gdTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.8), woodMat);
  gdTop.position.y = 0.84;
  guardDesk.add(gdTop);

  // Live CCTV Screen Materials (bound to WebGLRenderTarget textures in GameEngine)
  const cctvScreenMats = {
    cam101: new THREE.MeshBasicMaterial({ color: 0xd9f5e6 }),
    cam102: new THREE.MeshBasicMaterial({ color: 0xd9f5e6 }),
    camCorridor: new THREE.MeshBasicMaterial({ color: 0xd9f5e6 }),
  };

  // Physical CCTV Dual Monitors on Guard Desk (CAM 101 & CAM 102)
  [
    { x: -0.98, mat: cctvScreenMats.cam101 },
    { x: -0.5, mat: cctvScreenMats.cam102 },
  ].forEach(({ x, mat }) => {
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.22), darkSteelMat);
    mon.position.set(x, 1.02, 0.02);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), mat);
    scr.position.set(x, 1.02, 0.135);
    guardDesk.add(mon, scr);
  });

  // Wall of Live CCTV Monitors mounted on East Wall of Checking Room (visible when looking right)
  const cctvWallRack = new THREE.Group();
  cctvWallRack.position.set(2.26, 1.65, -0.45);
  cctvWallRack.rotation.y = -Math.PI / 2;
  const rackBacking = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.92, 0.08), darkSteelMat);
  cctvWallRack.add(rackBacking);

  [
    { x: -0.82, mat: cctvScreenMats.cam101 },
    { x: 0.0, mat: cctvScreenMats.cam102 },
    { x: 0.82, mat: cctvScreenMats.camCorridor },
  ].forEach(({ x, mat }) => {
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.56, 0.16), darkSteelMat);
    bezel.position.set(x, 0.02, 0.08);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.48), mat);
    scr.position.set(x, 0.02, 0.165);
    const recLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    );
    recLed.position.set(x + 0.28, -0.24, 0.165);
    cctvWallRack.add(bezel, scr, recLed);
  });
  schoolGroup.add(cctvWallRack);

  // Record Terminal (center-right)
  const recMon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.22), darkSteelMat);
  recMon.position.set(0.28, 1.02, 0.02);
  const recScr = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.24),
    new THREE.MeshBasicMaterial({ color: 0x182b3e }),
  );
  recScr.position.set(0.28, 1.02, 0.135);
  guardDesk.add(recMon, recScr);

  // Taser on Yellow Charging Dock
  const taserDeskGroup = new THREE.Group();
  taserDeskGroup.position.set(0.95, 0.87, 0.04);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.4), darkSteelMat);
  const tBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.09, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35 }),
  );
  tBody.position.set(0, 0.07, 0);
  const tGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.07), darkSteelMat);
  tGrip.position.set(0, 0.035, 0.08);
  tGrip.rotation.x = 0.22;
  taserDeskGroup.add(pad, tBody, tGrip);
  guardDesk.add(taserDeskGroup);

  schoolGroup.add(guardDesk);
  colliders.push({ minX: -2.1, maxX: 0.8, minZ: -1.95, maxZ: -1.1 });

  const taserArcLight = new THREE.PointLight(0x5ec8ff, 0, 14, 1.5);
  taserArcLight.visible = false;
  schoolGroup.add(taserArcLight);

  // Body Scanner Archway outside window (Z = -3.45)
  const archGroup = new THREE.Group();
  archGroup.position.set(-0.55, 0, -3.55);
  const pL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.3, 0.55), darkSteelMat);
  pL.position.set(-0.68, 1.15, 0);
  const pR = pL.clone();
  pR.position.set(0.68, 1.15, 0);
  const pTop = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.2, 0.55), darkSteelMat);
  pTop.position.set(0, 2.35, 0);
  const scannerBeam = new THREE.Mesh(
    new THREE.PlaneGeometry(1.22, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  );
  scannerBeam.position.set(0, 1.8, 0);
  scannerBeam.visible = false;
  archGroup.add(pL, pR, pTop, scannerBeam);
  schoolGroup.add(archGroup);

  const scannerLight = new THREE.PointLight(0x22d3ee, 0, 5.5);
  scannerLight.position.set(-0.55, 1.5, -3.45);
  scannerLight.visible = false;
  schoolGroup.add(scannerLight);

  // =========================================================================
  // 4. CORRIDOR LOCKERS (3 usable hiding lockers out of 10), CLASSROOM DESKS, & BOXES
  // =========================================================================
  const innerLockerMat = new THREE.MeshStandardMaterial({
    color: 0x101316,
    roughness: 0.72,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });
  const usableLockerIndices = new Set([1, 4, 8]);

  for (let i = 0; i < 10; i++) {
    const lz = 4.0 + i * 1.15;
    const locker = new THREE.Group();
    locker.position.set(-2.12, 0, lz);

    if (usableLockerIndices.has(i)) {
      const spotId = `locker_${i}`;
      // Hollow interior cabinet so camera sits inside looking East (+X) through door slits
      const backP = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 2.1), innerLockerMat);
      backP.rotation.y = Math.PI / 2;
      backP.position.set(-0.26, 1.05, 0);
      const sideL = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 2.1), innerLockerMat);
      sideL.position.set(0, 1.05, -0.52);
      const sideR = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 2.1), innerLockerMat);
      sideR.rotation.y = Math.PI;
      sideR.position.set(0, 1.05, 0.52);
      const topP = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 1.04), innerLockerMat);
      topP.rotation.x = Math.PI / 2;
      topP.position.set(0, 2.08, 0);

      // Hinged door with 3 narrow horizontal slits around eye height (y = 1.44..1.60)
      const doorPivot = new THREE.Group();
      doorPivot.position.set(0.25, 0, -0.5);

      const dLower = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.43, 1.0), lockerMat);
      dLower.position.set(0, 0.715, 0.5);
      const dSlat1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 1.0), lockerMat);
      dSlat1.position.set(0, 1.48, 0.5);
      const dSlat2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 1.0), lockerMat);
      dSlat2.position.set(0, 1.54, 0.5);
      const dUpper = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.49, 1.0), lockerMat);
      dUpper.position.set(0, 1.835, 0.5);

      // Brass handle indicator on usable locker
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.04), brassMat);
      handle.position.set(0.025, 1.05, 0.9);
      doorPivot.add(dLower, dSlat1, dSlat2, dUpper, handle);

      locker.add(backP, sideL, sideR, topP, doorPivot);
      schoolGroup.add(locker);
      lockerRigs.push({ spotId, doorPivot });
      hidingSpots.push({
        id: spotId,
        type: 'locker',
        label: `Corridor Locker #${i + 1}`,
        room: 'corridor',
        position: { x: -2.02, y: 1.505, z: lz },
        lookYaw: -Math.PI / 2,
      });
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 2.1, 1.06), darkSteelMat);
      body.position.y = 1.05;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.02, 1.0), lockerMat);
      door.position.set(0.25, 1.05, 0);
      locker.add(body, door);
      schoolGroup.add(locker);
    }
  }
  colliders.push({ minX: -2.45, maxX: -1.8, minZ: 3.4, maxZ: 15.0 });

  const buildClassroomFurniture = (
    seats: { x: number; z: number }[],
    room: 'room101' | 'room102',
    bbZ: number,
    hideDeskIdx: number,
    spotId: string,
  ) => {
    // Blackboard & Teacher Podium on East Wall (X = 10.45)
    const bbMat = new THREE.MeshStandardMaterial({ map: textures.blackboardNormal, roughness: 0.78 });
    blackboardMats[room] = bbMat;
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.45), bbMat);
    bb.rotation.y = -Math.PI / 2;
    bb.position.set(10.48, 1.72, bbZ);
    schoolGroup.add(bb);

    const tDesk = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.82, 1.5), woodMat);
    tDesk.position.set(9.1, 0.41, bbZ);
    schoolGroup.add(tDesk);
    colliders.push({ minX: 8.65, maxX: 9.55, minZ: bbZ - 0.8, maxZ: bbZ + 0.8 });

    const paperMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d3, roughness: 0.88 });
    const pencilMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.5 });

    // Student Desks + Chairs + Notebooks
    seats.forEach((s, idx) => {
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 1.0), woodMat);
      top.position.y = 0.78;
      g.add(top);

      // Open notebook & pencil on desk so taking notes is clearly readable on CCTV
      const notebook = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.014, 0.36), paperMat);
      notebook.position.set(-0.04, 0.812, 0.02);
      const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.17, 6), pencilMat);
      pencil.rotation.z = Math.PI / 2;
      pencil.rotation.y = 0.35;
      pencil.position.set(0.02, 0.822, 0.24);
      g.add(notebook, pencil);

      [
        [-0.32, -0.42],
        [0.32, -0.42],
        [-0.32, 0.42],
        [0.32, 0.42],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.78, 8), darkSteelMat);
        leg.position.set(lx, 0.39, lz);
        g.add(leg);
      });
      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.44), woodMat);
      chairSeat.position.set(-0.46, 0.44, 0);
      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.42), woodMat);
      chairBack.position.set(-0.66, 0.66, 0);
      g.add(chairSeat, chairBack);
      schoolGroup.add(g);

      colliders.push({ minX: s.x - 0.46, maxX: s.x + 0.46, minZ: s.z - 0.54, maxZ: s.z + 0.54 });
      if (idx === hideDeskIdx) {
        hidingSpots.push({
          id: spotId,
          type: 'desk',
          label: `Under Desk (${room === 'room101' ? 'Room 101' : 'Room 102'})`,
          room,
          position: { x: s.x, y: 0.46, z: s.z },
          lookYaw: Math.PI / 2,
        });
      }
    });
  };

  buildClassroomFurniture(ROOM101_SEATS, 'room101', 9.3, 1, 'desk_101');
  buildClassroomFurniture(ROOM102_SEATS, 'room102', 17.7, 0, 'desk_102');

  // Cardboard Hiding Boxes (Checking Room + Corridor)
  const createBox = (
    spotId: string,
    label: string,
    x: number,
    z: number,
    lookYaw: number,
    room: 'checking' | 'corridor' = 'corridor',
  ) => {
    const box = new THREE.Group();
    box.position.set(x, 0, z);
    box.rotation.y = lookYaw;
    const wB = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.24), cardboardMat);
    wB.position.set(0, 0.62, 0.53);
    const wL = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.24), cardboardMat);
    wL.rotation.y = Math.PI / 2;
    wL.position.set(-0.53, 0.62, 0);
    const wR = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.24), cardboardMat);
    wR.rotation.y = -Math.PI / 2;
    wR.position.set(0.53, 0.62, 0);

    // Front wall split to form an actual horizontal peephole slit at eye height (y = 0.65..0.81)
    const wFLower = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.65), cardboardMat);
    wFLower.position.set(0, 0.325, -0.53);
    const wFUpper = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.43), cardboardMat);
    wFUpper.position.set(0, 1.025, -0.53);

    const flapLeft = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 1.04), cardboardMat);
    flapLeft.geometry.translate(0.26, 0, 0);
    flapLeft.position.set(-0.53, 1.24, 0);
    const flapRight = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 1.04), cardboardMat);
    flapRight.geometry.translate(-0.26, 0, 0);
    flapRight.position.set(0.53, 1.24, 0);
    const flapFront = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.02, 0.52), cardboardMat);
    flapFront.geometry.translate(0, 0, 0.26);
    flapFront.position.set(0, 1.24, -0.53);

    box.add(wB, wL, wR, wFLower, wFUpper, flapLeft, flapRight, flapFront);
    schoolGroup.add(box);
    boxRigs.push({ spotId, flapLeft, flapRight, flapFront });
    hidingSpots.push({
      id: spotId,
      type: 'box',
      label,
      room,
      position: { x, y: 0.72, z },
      lookYaw,
    });
  };

  createBox('box_checking', 'Cardboard Box (Checking Room)', -1.82, 1.35, -Math.PI * 0.28, 'checking');
  createBox('box_corridor_north', 'Cardboard Box (North Corridor)', 1.72, 4.6, Math.PI * 0.85, 'corridor');
  createBox('box_corridor_south', 'Cardboard Box (South Corridor)', -1.72, 22.0, Math.PI * 0.12, 'corridor');

  // =========================================================================
  // 5. FLICKERING FLUORESCENT LIGHTS & DUST
  // =========================================================================
  const addFixture = (x: number, z: number, intensity: number, range: number) => {
    const fg = new THREE.Group();
    fg.position.set(x, 3.31, z);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 1.3), darkSteelMat);
    fg.add(housing);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xdbe8e2,
      emissive: 0xd7ede4,
      emissiveIntensity: 1.75,
      roughness: 0.2,
    });
    [-0.1, 0.1].forEach((tx) => {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 1.2, 8), tubeMat);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(tx, -0.04, 0);
      fg.add(tube);
    });
    const light = new THREE.PointLight(0xd4ebe4, intensity, range, 1.7);
    light.position.set(0, -0.22, 0);
    fg.add(light);
    schoolGroup.add(fg);
    fixtures.push({ tubeMat, light, baseIntensity: intensity, flickerPhase: Math.random() * 50 });
  };

  addFixture(-0.3, -4.0, 5.4, 12);
  addFixture(0, 0, 4.8, 10);
  addFixture(0, 8.5, 4.4, 14);
  addFixture(0, 18.0, 4.2, 14);
  addFixture(6.8, 9.5, 6.8, 15);
  addFixture(6.8, 18.0, 6.8, 15);

  // Physical Security Camera Props in Room 101, Room 102, and Corridor
  [
    { pos: [3.0, 2.94, 6.38], look: [7.4, 1.18, 9.45] },
    { pos: [3.0, 2.94, 14.78], look: [7.4, 1.18, 17.85] },
    { pos: [-2.05, 2.96, 2.65], look: [0.2, 1.0, 13.0] },
  ].forEach((c) => {
    const camProp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.24), darkSteelMat);
    camProp.position.set(c.pos[0], c.pos[1], c.pos[2]);
    camProp.lookAt(c.look[0], c.look[1], c.look[2]);
    schoolGroup.add(camProp);
  });

  const dustCount = 240;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -2.2 + Math.random() * 12.2;
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 2.8;
    dustPos[i * 3 + 2] = -7.5 + Math.random() * 31;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustPoints = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      map: textures.dustSprite,
      size: 0.055,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  schoolGroup.add(dustPoints);

  let gateAngle = 0;

  const updateEnvironment = (
    time: number,
    dt: number,
    gateOpen: boolean,
    scanning: boolean,
    room101Locked: boolean,
    room102Locked: boolean,
    activeBoxId: string | null,
    taserFlashTimer: number,
    hasTaserInHand: boolean,
    lightFlickerActive = false,
    hallucinationBbRoom: 'room101' | 'room102' | null = null,
    hallucinationBbIdx = 0,
  ) => {
    (['room101', 'room102'] as const).forEach((roomKey) => {
      const mat = blackboardMats[roomKey];
      if (!mat) return;
      const targetIdx =
        hallucinationBbRoom === roomKey && textures.blackboardHallucinations.length > 0
          ? Math.abs(hallucinationBbIdx) % textures.blackboardHallucinations.length
          : -1;
      if (blackboardStates[roomKey] !== targetIdx) {
        blackboardStates[roomKey] = targetIdx;
        mat.map =
          targetIdx >= 0
            ? textures.blackboardHallucinations[targetIdx]
            : textures.blackboardNormal;
        mat.needsUpdate = true;
      }
    });

    fixtures.forEach((f, idx) => {
      let mult = 1.0;
      if (lightFlickerActive) {
        const surge = Math.sin(time * 34.0 + f.flickerPhase * 2.1) * Math.cos(time * 53.0 + idx * 1.7);
        mult = surge > 0.15 ? 0.12 : surge < -0.25 ? 0.36 : 0.86;
      } else {
        const wave = Math.sin(time * 8.1 + f.flickerPhase) * Math.sin(time * 21.7 + idx);
        mult = idx === 2 && wave > 0.72 ? 0.2 : wave > 0.92 ? 0.55 : 1.0;
      }
      f.light.intensity = f.baseIntensity * mult;
      f.tubeMat.emissiveIntensity = 1.75 * mult;
    });

    gateAngle = THREE.MathUtils.damp(gateAngle, gateOpen ? -1.45 : 0, 7, dt);
    gateDoorPivot.rotation.y = gateAngle;

    shutter101.position.y = THREE.MathUtils.damp(shutter101.position.y, room101Locked ? 1.2 : 3.6, 8, dt);
    shutter102.position.y = THREE.MathUtils.damp(shutter102.position.y, room102Locked ? 1.2 : 3.6, 8, dt);

    taserDeskGroup.visible = !hasTaserInHand;

    scannerBeam.visible = scanning;
    scannerLight.visible = scanning;
    if (scanning) {
      scannerBeam.position.y = 1.05 + Math.sin(time * 5.0) * 0.95;
      scannerLight.intensity = 4.5;
    } else {
      scannerLight.intensity = 0;
    }

    boxRigs.forEach((rig) => {
      const hidingHere = activeBoxId === rig.spotId;
      rig.flapLeft.rotation.z = THREE.MathUtils.damp(rig.flapLeft.rotation.z, hidingHere ? 0.04 : 0.95, 10, dt);
      rig.flapRight.rotation.z = THREE.MathUtils.damp(rig.flapRight.rotation.z, hidingHere ? -0.04 : -0.95, 10, dt);
      rig.flapFront.rotation.x = THREE.MathUtils.damp(rig.flapFront.rotation.x, hidingHere ? -0.05 : -0.82, 10, dt);
    });

    lockerRigs.forEach((rig) => {
      const hidingHere = activeBoxId === rig.spotId;
      // Slightly ajar when unoccupied/entering, closed shut when player is inside
      const targetAngle = hidingHere ? 0.0 : -0.04;
      rig.doorPivot.rotation.y = THREE.MathUtils.damp(rig.doorPivot.rotation.y, targetAngle, 10, dt);
    });

    const attr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < dustCount; i++) {
      let y = attr.getY(i) + Math.sin(time * 0.5 + i) * dt * 0.04;
      if (y > 3.1) y = 0.3;
      if (y < 0.25) y = 3.0;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;

    const hasArc = taserFlashTimer > 0;
    taserArcLight.visible = hasArc;
    taserArcLight.intensity = hasArc ? (Math.random() > 0.3 ? 14 : 4) : 0;
  };

  const dispose = () => {
    [introGroup, schoolGroup].forEach((grp) => {
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    });
    tvTexture.dispose();
  };

  const getLightLevelAt = (x: number, z: number): number => {
    let total = 0;
    for (const f of fixtures) {
      const parentPos = f.light.parent?.position;
      if (!parentPos) continue;
      const d = Math.hypot(x - parentPos.x, z - parentPos.z);
      const range = f.light.distance || 12;
      if (d < range) {
        const falloff = Math.pow(1 - d / range, 1.45);
        total += (f.light.intensity / 5.5) * falloff;
      }
    }
    return Math.min(1, Math.max(0, total));
  };

  return {
    introGroup,
    schoolGroup,
    tvCanvas,
    tvCtx,
    tvTexture,
    tvLight,
    colliders,
    hidingSpots,
    taserDeskGroup,
    taserArcLight,
    scannerBeam,
    scannerLight,
    cctvScreenMats,
    updateEnvironment,
    getLightLevelAt,
    dispose,
  };
}
