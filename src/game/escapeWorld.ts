import * as THREE from 'three';
import { SchoolTextureSet } from './textures';

export interface EscapeObstacle {
  id: string;
  kind: 'locker' | 'light' | 'fire';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  canJump: boolean;
  triggerZ: number;
  triggered: boolean;
  animProgress: number;
  group: THREE.Group;
  sparkLight?: THREE.PointLight;
  fireLight?: THREE.PointLight;
  flameMeshes?: THREE.Mesh[];
  smokeMeshes?: THREE.Mesh[];
  sparkParticles?: THREE.Mesh[];
}

export interface EscapeWorldObjects {
  escapeGroup: THREE.Group;
  busGroup: THREE.Group;
  busDoorMesh: THREE.Mesh;
  busHeadlightL: THREE.SpotLight;
  busHeadlightR: THREE.SpotLight;
  obstacles: EscapeObstacle[];
  busBaseZ: number;
  busDoorZ: number;
  reset: () => void;
  update: (
    time: number,
    dt: number,
    playerZ: number,
    busOffsetZ: number,
  ) => {
    lockerCrashed: boolean;
    lightSparked: boolean;
    fireNear: boolean;
  };
  dispose: () => void;
}

export function buildShift5EscapeWorld(
  textures: SchoolTextureSet,
  isSoftwareGl: boolean,
): EscapeWorldObjects {
  const escapeGroup = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Shared materials
  const asphaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x16181d,
      roughness: 0.78,
      metalness: 0.08,
    }),
  );
  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0d120f,
      roughness: 0.95,
    }),
  );
  const brickMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.wallMap,
      color: 0x5c3e36,
      roughness: 0.88,
    }),
  );
  const floorTileMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.floorMap,
      roughness: 0.82,
    }),
  );
  const lockerMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.lockerMap,
      color: 0x4b5c6e,
      roughness: 0.45,
      metalness: 0.5,
    }),
  );
  const hazardStripeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.55,
      roughness: 0.5,
    }),
  );
  const metalPoleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a2f36,
      roughness: 0.4,
      metalness: 0.7,
    }),
  );
  const bulbLitMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6f3ff,
      emissive: 0xcbe7ff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    }),
  );
  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c3038,
      roughness: 0.85,
    }),
  );
  const roadLineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      roughness: 0.7,
    }),
  );
  const treeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0a130e,
      roughness: 0.96,
    }),
  );

  // -------------------------------------------------------------------------
  // 1. SCHOOL EXIT VESTIBULE (Z: -4 .. +8) & EXTERIOR ROAD (Z: +8 .. +175)
  // -------------------------------------------------------------------------
  const vestibuleFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.8, 0.2, 12.2)), floorTileMat);
  vestibuleFloor.position.set(0, -0.1, 2.0);
  vestibuleFloor.receiveShadow = true;
  escapeGroup.add(vestibuleFloor);

  const vestibuleCeiling = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(6.8, 0.2, 12.2)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.9 })),
  );
  vestibuleCeiling.position.set(0, 3.6, 2.0);
  escapeGroup.add(vestibuleCeiling);

  // Left & Right Vestibule Walls
  const leftHallWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 3.8, 12.2)), brickMat);
  leftHallWall.position.set(-3.4, 1.8, 2.0);
  const rightHallWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 3.8, 12.2)), brickMat);
  rightHallWall.position.set(3.4, 1.8, 2.0);
  const backHallWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 3.8, 0.4)), brickMat);
  backHallWall.position.set(0, 1.8, -4.1);
  escapeGroup.add(leftHallWall, rightHallWall, backHallWall);

  // School Exterior Facade around Exit Doors (Z = 8)
  const facadeLeft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10, 5.2, 0.6)), brickMat);
  facadeLeft.position.set(-6.9, 2.6, 8.0);
  const facadeRight = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(10, 5.2, 0.6)), brickMat);
  facadeRight.position.set(6.9, 2.6, 8.0);
  const facadeHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 2.2, 0.6)), brickMat);
  facadeHeader.position.set(0, 4.1, 8.0);
  escapeGroup.add(facadeLeft, facadeRight, facadeHeader);

  // Pushed-open double exit doors
  const doorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x451a1a, roughness: 0.55, metalness: 0.3 }),
  );
  const exitDoorL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 2.7, 0.12)), doorMat);
  exitDoorL.position.set(-2.35, 1.35, 8.8);
  exitDoorL.rotation.y = Math.PI * 0.42;
  const exitDoorR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 2.7, 0.12)), doorMat);
  exitDoorR.position.set(2.35, 1.35, 8.8);
  exitDoorR.rotation.y = -Math.PI * 0.42;
  escapeGroup.add(exitDoorL, exitDoorR);

  // Glowing EXIT sign above school doorway
  const exitSignMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.9,
    }),
  );
  const exitSign = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 0.34, 0.14)), exitSignMat);
  exitSign.position.set(0, 3.18, 7.65);
  escapeGroup.add(exitSign);

  const exitSignLight = new THREE.PointLight(0xff4d42, 2.6, 12, 1.6);
  exitSignLight.position.set(0, 3.1, 8.2);
  escapeGroup.add(exitSignLight);

  // Asphalt Escape Road (Z: 8 .. 176)
  const roadMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.8, 0.2, 170)), asphaltMat);
  roadMesh.position.set(0, -0.1, 93);
  roadMesh.receiveShadow = true;
  escapeGroup.add(roadMesh);

  // Night Ground Terrain Flanking Road
  const terrainL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(44, 0.2, 176)), groundMat);
  terrainL.position.set(-25.4, -0.15, 90);
  const terrainR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(44, 0.2, 176)), groundMat);
  terrainR.position.set(25.4, -0.15, 90);
  escapeGroup.add(terrainL, terrainR);

  // Curbs & perimeter guard walls/fences (keeping lane crisp & readable)
  const curbL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.35, 168)), curbMat);
  curbL.position.set(-3.45, 0.17, 92);
  const curbR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.45, 0.35, 168)), curbMat);
  curbR.position.set(3.45, 0.17, 92);
  escapeGroup.add(curbL, curbR);

  // Side fence posts + rails & road center dashes
  const postGeo = trackGeo(new THREE.BoxGeometry(0.14, 1.6, 0.14));
  const dashGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.02, 2.4));
  for (let z = 12; z <= 160; z += 7.5) {
    const dash = new THREE.Mesh(dashGeo, roadLineMat);
    dash.position.set(0, 0.015, z);
    escapeGroup.add(dash);

    const postL = new THREE.Mesh(postGeo, metalPoleMat);
    postL.position.set(-3.55, 0.8, z);
    const postR = new THREE.Mesh(postGeo, metalPoleMat);
    postR.position.set(3.55, 0.8, z);
    escapeGroup.add(postL, postR);
  }

  // Flanking silhouette trees along the dark school yard
  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.32, 3.2, 7));
  const crownGeo = trackGeo(new THREE.ConeGeometry(2.2, 5.2, 7));
  for (let z = 16; z <= 156; z += 14) {
    for (const side of [-1, 1]) {
      const tx = side * (6.2 + ((z * 7) % 5));
      const trunk = new THREE.Mesh(trunkGeo, treeMat);
      trunk.position.set(tx, 1.6, z + side * 2.5);
      const crown = new THREE.Mesh(crownGeo, treeMat);
      crown.position.set(tx, 4.4, z + side * 2.5);
      escapeGroup.add(trunk, crown);
    }
  }

  // Night moonlight overhead fill
  const moonLight = new THREE.DirectionalLight(0x526b91, 0.65);
  moonLight.position.set(-14, 24, 52);
  escapeGroup.add(moonLight);

  // Subtle guiding sodium rim lights near exit + mid road
  const exitYardLight = new THREE.PointLight(0xffb86b, 2.4, 20, 1.5);
  exitYardLight.position.set(-3.2, 4.2, 13.5);
  escapeGroup.add(exitYardLight);

  // -------------------------------------------------------------------------
  // 2. DISTANT YELLOW SCHOOL BUS (Parked far away at Z = 138, door Z = 135.5)
  // -------------------------------------------------------------------------
  const busBaseZ = 138.0;
  const busDoorZ = 135.5;
  const busGroup = new THREE.Group();
  busGroup.position.set(0, 0, busBaseZ);

  const busYellowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.42,
      metalness: 0.15,
    }),
  );
  const busTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.6,
      metalness: 0.4,
    }),
  );
  const busWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.48,
      roughness: 0.18,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    }),
  );
  const busFloorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c1e24,
      roughness: 0.88,
      metalness: 0.1,
    }),
  );
  const busSeatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x263240,
      roughness: 0.72,
      metalness: 0.08,
    }),
  );
  const taillightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.9,
    }),
  );
  const amberStrobeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
    }),
  );
  const headlightGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffbeb,
      emissiveIntensity: 2.5,
    }),
  );

  // Hollow bus cabin: floor slab, lower side walls, front bulkhead, rear lower panel, roof & hood
  const busUndercarriage = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.48, 0.34, 8.6)), busTrimMat);
  busUndercarriage.position.set(0, 0.54, 0);
  const busFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.62, 0.14, 8.8)), busFloorMat);
  busFloor.position.set(0, 0.72, 0);
  const busLeftLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.78, 8.8)), busYellowMat);
  busLeftLower.position.set(-1.26, 1.14, 0);
  const busRightLower = busLeftLower.clone();
  busRightLower.position.x = 1.26;
  const busFrontLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.64, 0.78, 0.16)), busYellowMat);
  busFrontLower.position.set(0, 1.14, 4.32);
  const busRearLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.64, 0.74, 0.14)), busYellowMat);
  busRearLower.position.set(0, 1.12, -4.34);

  const busRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.62, 0.32, 8.5)), busYellowMat);
  busRoof.position.set(0, 2.74, -0.05);
  const busBumperBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.74, 0.34, 0.25)), busTrimMat);
  busBumperBack.position.set(0, 0.48, -4.45);
  const busBumperFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.74, 0.34, 0.25)), busTrimMat);
  busBumperFront.position.set(0, 0.48, 4.45);
  const busHood = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.9, 1.5)), busYellowMat);
  busHood.position.set(0, 0.92, 4.9);
  busGroup.add(
    busUndercarriage,
    busFloor,
    busLeftLower,
    busRightLower,
    busFrontLower,
    busRearLower,
    busRoof,
    busBumperBack,
    busBumperFront,
    busHood,
  );

  // Interior driver dashboard + steering wheel + center aisle runner
  const aisleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.95 }));
  const aisleStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.02, 7.6)), aisleMat);
  aisleStrip.position.set(0, 0.8, 0);
  const dashBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.42, 0.45)), busTrimMat);
  dashBox.position.set(0.68, 1.38, 3.92);
  const steeringCol = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8)), busTrimMat);
  steeringCol.rotation.x = 0.65;
  steeringCol.position.set(0.72, 1.56, 3.68);
  const steeringWheel = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.2, 0.028, 8, 18)), busTrimMat);
  steeringWheel.rotation.x = 0.65;
  steeringWheel.position.set(0.72, 1.72, 3.55);
  busGroup.add(aisleStrip, dashBox, steeringCol, steeringWheel);

  // School bus bench seats (5 rows on left & right + driver seat)
  const seatRowZ = [-2.2, -1.05, 0.1, 1.25, 2.35];
  const cushionGeo = trackGeo(new THREE.BoxGeometry(0.84, 0.12, 0.52));
  const seatBackGeo = trackGeo(new THREE.BoxGeometry(0.84, 0.64, 0.12));
  const seatFrameGeo = trackGeo(new THREE.BoxGeometry(0.76, 0.36, 0.42));
  for (const rz of seatRowZ) {
    for (const side of [-1, 1]) {
      const sx = side * 0.78;
      const frame = new THREE.Mesh(seatFrameGeo, busTrimMat);
      frame.position.set(sx, 0.98, rz);
      const cushion = new THREE.Mesh(cushionGeo, busSeatMat);
      cushion.position.set(sx, 1.18, rz);
      const back = new THREE.Mesh(seatBackGeo, busSeatMat);
      back.position.set(sx, 1.52, rz - 0.22);
      busGroup.add(frame, cushion, back);
    }
  }
  const driverCushion = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.12, 0.52)), busSeatMat);
  driverCushion.position.set(0.72, 1.18, 3.25);
  const driverBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.68, 0.12)), busSeatMat);
  driverBack.position.set(0.72, 1.54, 3.03);
  busGroup.add(driverCushion, driverBack);

  // Black rub rails + window mullions
  const rubRailL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.14, 8.4)), busTrimMat);
  rubRailL.position.set(-1.34, 1.28, -0.1);
  const rubRailR = rubRailL.clone();
  rubRailR.position.x = 1.34;
  busGroup.add(rubRailL, rubRailR);

  const pillarGeo = trackGeo(new THREE.BoxGeometry(0.09, 1.06, 0.12));
  for (let pz = -3.8; pz <= 3.8; pz += 1.52) {
    const pL = new THREE.Mesh(pillarGeo, busYellowMat);
    pL.position.set(-1.27, 2.05, pz);
    const pR = pL.clone();
    pR.position.x = 1.27;
    busGroup.add(pL, pR);
  }

  // Warm illuminated interior cabin windows (translucent so passengers inside are clearly visible)
  const sideWinGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.96, 7.8));
  const sideWinL = new THREE.Mesh(sideWinGeo, busWindowMat);
  sideWinL.position.set(-1.26, 2.05, -0.15);
  const sideWinR = new THREE.Mesh(sideWinGeo, busWindowMat);
  sideWinR.position.set(1.26, 2.05, -0.15);
  const rearWin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.85, 0.9, 0.05)), busWindowMat);
  rearWin.position.set(0, 2.05, -4.34);
  const frontWin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.98, 0.05)), busWindowMat);
  frontWin.position.set(0, 2.05, 4.22);
  busGroup.add(sideWinL, sideWinR, rearWin, frontWin);

  // Rear red taillights + amber roof strobes (clearly visible down the road!)
  const tailL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.24, 0.08)), taillightMat);
  tailL.position.set(-0.96, 1.05, -4.42);
  const tailR = tailL.clone();
  tailR.position.x = 0.96;
  const strobeL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.16, 0.12)), amberStrobeMat);
  strobeL.position.set(-0.95, 2.75, -4.32);
  const strobeR = strobeL.clone();
  strobeR.position.x = 0.95;
  busGroup.add(tailL, tailR, strobeL, strobeR);

  // Front headlights
  const hlMeshL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12)), headlightGlassMat);
  hlMeshL.rotation.x = Math.PI / 2;
  hlMeshL.position.set(-0.88, 0.88, 5.66);
  const hlMeshR = hlMeshL.clone();
  hlMeshR.position.x = 0.88;
  busGroup.add(hlMeshL, hlMeshR);

  // Wheels
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.34, 16));
  const wheelPositions = [
    [-1.25, 0.46, -2.5],
    [1.25, 0.46, -2.5],
    [-1.25, 0.46, 2.9],
    [1.25, 0.46, 2.9],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, busTrimMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, wy, wz);
    busGroup.add(w);
  }

  // Boarding Door on rear entry (starts open, closes when player boards)
  const busDoorMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.15, 1.95, 0.1)),
    busTrimMat,
  );
  busDoorMesh.position.set(-0.1, 1.4, -4.44);
  busDoorMesh.scale.x = 0.12;
  busGroup.add(busDoorMesh);

  // Interior dome strip fixtures + warm cabin lights illuminating all seated students
  const domeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
    }),
  );
  const dome1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.05, 0.2)), domeMat);
  dome1.position.set(0, 2.55, -0.8);
  const dome2 = dome1.clone();
  dome2.position.z = 2.0;
  busGroup.add(dome1, dome2);

  const busCabinLight = new THREE.PointLight(0xffe39e, 7.2, 16, 1.1);
  busCabinLight.position.set(0, 2.42, -0.8);
  const busCabinLightFront = new THREE.PointLight(0xffe39e, 7.2, 16, 1.1);
  busCabinLightFront.position.set(0, 2.42, 2.0);
  busGroup.add(busCabinLight, busCabinLightFront);

  const busRearBeacon = new THREE.PointLight(0xff6b35, 3.8, 28, 1.3);
  busRearBeacon.position.set(0, 2.2, -5.6);
  busGroup.add(busRearBeacon);

  const busHeadlightL = new THREE.SpotLight(0xfff5d6, 18, 65, Math.PI * 0.24, 0.55, 1.1);
  busHeadlightL.position.set(-0.88, 0.92, 5.7);
  busHeadlightL.target.position.set(-1.1, 0.1, 28.0);
  busHeadlightL.castShadow = !isSoftwareGl;
  busHeadlightL.shadow.mapSize.set(512, 512);
  busGroup.add(busHeadlightL, busHeadlightL.target);

  const busHeadlightR = new THREE.SpotLight(0xfff5d6, 18, 65, Math.PI * 0.24, 0.55, 1.1);
  busHeadlightR.position.set(0.88, 0.92, 5.7);
  busHeadlightR.target.position.set(1.1, 0.1, 28.0);
  busGroup.add(busHeadlightR, busHeadlightR.target);

  // Volumetric headlight beams cutting through the night darkness
  const beamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfef3c7,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const beamGeo = trackGeo(new THREE.ConeGeometry(3.2, 24, 14, 1, true));
  const beamL = new THREE.Mesh(beamGeo, beamMat);
  beamL.rotation.x = -Math.PI / 2;
  beamL.position.set(-0.88, 0.72, 17.7);
  const beamR = beamL.clone();
  beamR.position.x = 0.88;
  busGroup.add(beamL, beamR);

  // Visible headlight glow spilling behind/beside bus so player always sees it far ahead
  const busBackWashLight = new THREE.SpotLight(0xffeab8, 9, 42, Math.PI * 0.35, 0.65, 1.2);
  busBackWashLight.position.set(0, 2.6, -4.6);
  busBackWashLight.target.position.set(0, 0.1, -18.0);
  busGroup.add(busBackWashLight, busBackWashLight.target);

  escapeGroup.add(busGroup);

  // -------------------------------------------------------------------------
  // 3. OBSTACLES ALONG THE ESCAPE ROUTE (Z: 22 .. 110)
  // -------------------------------------------------------------------------
  const obstacles: EscapeObstacle[] = [];

  const addFallenLockerSet = (
    id: string,
    z: number,
    layout: 'block_left_low_right' | 'block_right_low_left' | 'center_jump',
  ) => {
    const grp = new THREE.Group();
    grp.position.set(0, 0, z);

    const makeLockerMesh = (w: number, h: number, d: number) => {
      const box = new THREE.Group();
      const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), lockerMat);
      body.position.y = h * 0.5;
      const stripe = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(w * 0.96, 0.08, d * 0.98)),
        hazardStripeMat,
      );
      stripe.position.y = h - 0.06;
      box.add(body, stripe);
      return box;
    };

    if (layout === 'block_left_low_right') {
      const tall = makeLockerMesh(2.5, 2.05, 0.85);
      tall.position.set(-1.55, 0, 0);
      tall.rotation.z = 0.18;
      grp.add(tall);

      const low = makeLockerMesh(2.6, 0.54, 0.9);
      low.position.set(1.45, 0, 0);
      grp.add(low);

      obstacles.push({
        id: `${id}_tall`,
        kind: 'locker',
        minX: -2.95,
        maxX: -0.25,
        minZ: z - 0.55,
        maxZ: z + 0.55,
        height: 2.05,
        canJump: false,
        triggerZ: z - 13.5,
        triggered: false,
        animProgress: 0,
        group: tall,
      });
      obstacles.push({
        id: `${id}_low`,
        kind: 'locker',
        minX: 0.15,
        maxX: 2.85,
        minZ: z - 0.55,
        maxZ: z + 0.55,
        height: 0.54,
        canJump: true,
        triggerZ: z - 13.5,
        triggered: false,
        animProgress: 0,
        group: low,
      });
    } else if (layout === 'block_right_low_left') {
      const tall = makeLockerMesh(2.5, 2.05, 0.85);
      tall.position.set(1.55, 0, 0);
      tall.rotation.z = -0.18;
      grp.add(tall);

      const low = makeLockerMesh(2.6, 0.54, 0.9);
      low.position.set(-1.45, 0, 0);
      grp.add(low);

      obstacles.push({
        id: `${id}_tall`,
        kind: 'locker',
        minX: 0.25,
        maxX: 2.95,
        minZ: z - 0.55,
        maxZ: z + 0.55,
        height: 2.05,
        canJump: false,
        triggerZ: z - 13.5,
        triggered: false,
        animProgress: 0,
        group: tall,
      });
      obstacles.push({
        id: `${id}_low`,
        kind: 'locker',
        minX: -2.85,
        maxX: -0.15,
        minZ: z - 0.55,
        maxZ: z + 0.55,
        height: 0.54,
        canJump: true,
        triggerZ: z - 13.5,
        triggered: false,
        animProgress: 0,
        group: low,
      });
    } else {
      // Full-width low locker barrier across the road (player jumps cleanly with Space!)
      const lowWide = makeLockerMesh(5.6, 0.52, 0.85);
      lowWide.position.set(0, 0, 0);
      grp.add(lowWide);

      obstacles.push({
        id: `${id}_wide`,
        kind: 'locker',
        minX: -2.85,
        maxX: 2.85,
        minZ: z - 0.5,
        maxZ: z + 0.5,
        height: 0.52,
        canJump: true,
        triggerZ: z - 13.5,
        triggered: false,
        animProgress: 0,
        group: lowWide,
      });
    }

    escapeGroup.add(grp);
  };

  // Scene 3: Fallen Lockers (Z = 22, 30, 38, 45)
  addFallenLockerSet('locker1', 22, 'block_left_low_right');
  addFallenLockerSet('locker2', 30, 'block_right_low_left');
  addFallenLockerSet('locker3', 38, 'center_jump');
  addFallenLockerSet('locker4', 45, 'block_left_low_right');

  // Scene 4: Flickering & Falling Light Fixtures (Z = 54, 62, 70, 78)
  const sparkMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.95,
    }),
  );
  const addFallingLight = (id: string, z: number, laneX: number) => {
    const grp = new THREE.Group();
    grp.position.set(laneX, 0, z);

    // Roadside pole + overhanging arm
    const sideSign = laneX < 0 ? -1 : 1;
    const pole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 8)), metalPoleMat);
    pole.position.set(sideSign * (3.2 - Math.abs(laneX)), 2.2, 0);
    grp.add(pole);

    // Falling fixture assembly
    const fixtureGrp = new THREE.Group();
    fixtureGrp.position.set(0, 3.8, 0);
    const housing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.1, 0.22, 0.58)), metalPoleMat);
    const tube = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 0.12, 0.42)), bulbLitMat);
    tube.position.y = -0.08;
    fixtureGrp.add(housing, tube);

    const sparkParticles: THREE.Mesh[] = [];
    const sparkGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.09, 0.09));
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(sparkGeo, sparkMat);
      sp.position.set((Math.random() - 0.5) * 1.4, 0.15, (Math.random() - 0.5) * 0.4);
      sp.visible = false;
      fixtureGrp.add(sp);
      sparkParticles.push(sp);
    }

    const sparkLight = new THREE.PointLight(0xbae6fd, 3.2, 16, 1.4);
    sparkLight.position.set(0, 0.4, 0);
    fixtureGrp.add(sparkLight);

    grp.add(fixtureGrp);
    escapeGroup.add(grp);

    obstacles.push({
      id,
      kind: 'light',
      minX: laneX - 1.15,
      maxX: laneX + 1.15,
      minZ: z - 0.5,
      maxZ: z + 0.5,
      height: 0.56,
      canJump: true,
      triggerZ: z - 15.5,
      triggered: false,
      animProgress: 0,
      group: fixtureGrp,
      sparkLight,
      sparkParticles,
    });
  };

  addFallingLight('light1', 54, -1.35);
  addFallingLight('light2', 62, 1.35);
  addFallingLight('light3', 70, 0.0);
  addFallingLight('light4', 78, -1.2);

  // Scene 5: Fire & Smoke Debris Barriers (Z = 86, 94, 102, 110)
  const flameOrangeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xff6a00,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const flameGoldMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const smokeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x18181b,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
  );
  const charWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c1411,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.8,
      roughness: 0.95,
    }),
  );

  const addFireWall = (id: string, z: number, openLane: 'left' | 'right' | 'center') => {
    const buildFireCluster = (clusterId: string, cx: number, width: number) => {
      const grp = new THREE.Group();
      grp.position.set(cx, 0, z);

      const debris = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(width, 0.42, 0.95)),
        charWoodMat,
      );
      debris.position.y = 0.21;
      grp.add(debris);

      const flameMeshes: THREE.Mesh[] = [];
      const smokeMeshes: THREE.Mesh[] = [];
      const count = Math.max(3, Math.round(width * 2));
      for (let i = 0; i < count; i++) {
        const fx = -width * 0.42 + (width * 0.84 * i) / Math.max(1, count - 1);
        const fOuter = new THREE.Mesh(
          trackGeo(new THREE.ConeGeometry(0.42, 1.75, 7)),
          flameOrangeMat,
        );
        fOuter.position.set(fx, 0.95, (i % 2 === 0 ? 1 : -1) * 0.14);
        const fInner = new THREE.Mesh(
          trackGeo(new THREE.ConeGeometry(0.24, 1.15, 7)),
          flameGoldMat,
        );
        fInner.position.set(fx, 0.72, (i % 2 === 0 ? 1 : -1) * 0.14);
        grp.add(fOuter, fInner);
        flameMeshes.push(fOuter, fInner);

        const smk = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.55, 8, 8)),
          smokeMat,
        );
        smk.position.set(fx, 2.1 + (i % 3) * 0.45, 0);
        grp.add(smk);
        smokeMeshes.push(smk);
      }

      const fireLight = new THREE.PointLight(0xff7722, 5.2, 20, 1.35);
      fireLight.position.set(0, 1.5, 0);
      grp.add(fireLight);
      escapeGroup.add(grp);

      obstacles.push({
        id: clusterId,
        kind: 'fire',
        minX: cx - width * 0.5,
        maxX: cx + width * 0.5,
        minZ: z - 0.65,
        maxZ: z + 0.65,
        height: 2.2,
        canJump: false,
        triggerZ: z - 16,
        triggered: true,
        animProgress: 1,
        group: grp,
        fireLight,
        flameMeshes,
        smokeMeshes,
      });
    };

    if (openLane === 'right') {
      // Clear open path X: +0.9 .. +3.1
      buildFireCluster(`${id}_L`, -1.1, 3.7);
    } else if (openLane === 'left') {
      // Clear open path X: -3.1 .. -0.9
      buildFireCluster(`${id}_R`, 1.1, 3.7);
    } else {
      // Center corridor clear X: -1.1 .. +1.1
      buildFireCluster(`${id}_L`, -2.15, 2.0);
      buildFireCluster(`${id}_R`, 2.15, 2.0);
    }
  };

  addFireWall('fire1', 86, 'right');
  addFireWall('fire2', 94, 'left');
  addFireWall('fire3', 102, 'center');
  addFireWall('fire4', 110, 'right');

  const reset = () => {
    busGroup.position.set(0, 0, busBaseZ);
    busDoorMesh.scale.x = 0.12;
    for (const obs of obstacles) {
      if (obs.kind === 'locker') {
        obs.triggered = false;
        obs.animProgress = 0;
        obs.group.position.y = 0;
        obs.group.rotation.x = -Math.PI * 0.42;
      } else if (obs.kind === 'light') {
        obs.triggered = false;
        obs.animProgress = 0;
        obs.group.position.y = 3.8;
        obs.group.rotation.z = 0;
        if (obs.sparkLight) obs.sparkLight.intensity = 3.2;
        obs.sparkParticles?.forEach((sp) => {
          sp.visible = false;
        });
      }
    }
  };
  reset();

  const update = (time: number, dt: number, playerZ: number, busOffsetZ: number) => {
    let lockerCrashed = false;
    let lightSparked = false;
    let fireNear = false;

    busGroup.position.z = busBaseZ + busOffsetZ;

    // Gentle strobe pulse on bus roof amber warning lights
    const strobeOn = Math.sin(time * 9.0) > 0;
    amberStrobeMat.emissiveIntensity = strobeOn ? 2.4 : 0.35;

    for (const obs of obstacles) {
      if (obs.kind === 'locker') {
        if (!obs.triggered && playerZ >= obs.triggerZ) {
          obs.triggered = true;
          lockerCrashed = true;
        }
        if (obs.triggered && obs.animProgress < 1) {
          obs.animProgress = Math.min(1, obs.animProgress + dt * 3.8);
          const ease = 1 - Math.pow(1 - obs.animProgress, 3);
          obs.group.rotation.x = -Math.PI * 0.42 * (1 - ease);
        }
      } else if (obs.kind === 'light') {
        const distZ = Math.abs(obs.minZ - playerZ);
        // Violent overhead flicker before drop
        const approaching = playerZ >= obs.triggerZ - 8 && !obs.triggered;
        if (obs.sparkLight) {
          obs.sparkLight.visible = distZ < 24 && (approaching || obs.triggered);
        }
        if (approaching && obs.sparkLight) {
          obs.sparkLight.intensity = Math.random() > 0.42 ? 4.8 : 0.25;
        }
        if (!obs.triggered && playerZ >= obs.triggerZ) {
          obs.triggered = true;
          lightSparked = true;
          obs.sparkParticles?.forEach((sp) => {
            sp.visible = true;
          });
        }
        if (obs.triggered && obs.animProgress < 1) {
          obs.animProgress = Math.min(1, obs.animProgress + dt * 3.6);
          const fall = obs.animProgress * obs.animProgress;
          obs.group.position.y = THREE.MathUtils.lerp(3.8, 0.28, fall);
          obs.group.rotation.z = fall * 0.14;
        }
        if (obs.triggered && obs.sparkLight && obs.sparkLight.visible) {
          obs.sparkLight.intensity = Math.random() > 0.35 ? 3.5 + Math.random() * 2.5 : 0.4;
          obs.sparkParticles?.forEach((sp, i) => {
            sp.position.y = 0.12 + Math.abs(Math.sin(time * 18 + i * 2.1)) * 0.55;
            sp.position.x = Math.sin(time * 11 + i) * 0.75;
          });
        }
      } else if (obs.kind === 'fire') {
        const distZ = Math.abs(obs.minZ - playerZ);
        if (distZ < 11.5) {
          fireNear = true;
        }
        if (obs.fireLight) {
          obs.fireLight.visible = distZ < 25;
          if (obs.fireLight.visible) {
            obs.fireLight.intensity = 4.4 + Math.sin(time * 19 + obs.minZ) * 1.4 + Math.random() * 1.1;
          }
        }
        if (distZ < 38) {
          obs.flameMeshes?.forEach((fm, idx) => {
            const s = 0.85 + Math.sin(time * 14 + idx * 1.7 + obs.minZ) * 0.22;
            fm.scale.set(0.95 + Math.cos(time * 9 + idx) * 0.1, s, 1);
          });
          obs.smokeMeshes?.forEach((sm, idx) => {
            const cycle = (time * 0.7 + idx * 0.37) % 1;
            sm.position.y = 1.6 + cycle * 2.4;
            sm.scale.setScalar(0.65 + cycle * 0.9);
          });
        }
      }
    }

    return { lockerCrashed, lightSparked, fireNear };
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  };

  return {
    escapeGroup,
    busGroup,
    busDoorMesh,
    busHeadlightL,
    busHeadlightR,
    obstacles,
    busBaseZ,
    busDoorZ,
    reset,
    update,
    dispose,
  };
}
