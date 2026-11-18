import * as THREE from 'three';

export interface KidnapperActor {
  root: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  baseX: number;
  baseZ: number;
  baseYaw: number;
}

export interface KidnapperCutsceneWorld {
  group: THREE.Group;
  busGroup: THREE.Group;
  vanGroup: THREE.Group;
  vanDoor: THREE.Mesh;
  hazardLights: THREE.PointLight[];
  hazardBulbs: THREE.MeshStandardMaterial[];
  kidnappers: KidnapperActor[];
  reset: () => void;
  update: (time: number, stageTime: number) => void;
  dispose: () => void;
}

export function buildKidnapperCutsceneWorld(isSoftwareGl: boolean): KidnapperCutsceneWorld {
  const group = new THREE.Group();
  group.visible = false;

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

  // Materials
  const asphaltMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.76, metalness: 0.08 }));
  const shoulderMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x090d0a, roughness: 0.96 }));
  const roadLineMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd4a328, roughness: 0.65 }));
  const treeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x070d09, roughness: 0.95 }));
  const poleMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.5, metalness: 0.6 }));

  // Midnight Highway (Z: -25 .. +35)
  const road = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.4, 0.2, 68)), asphaltMat);
  road.position.set(0, -0.1, 4);
  group.add(road);

  const groundL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(36, 0.2, 70)), shoulderMat);
  groundL.position.set(-22, -0.14, 4);
  const groundR = groundL.clone();
  groundR.position.x = 22;
  group.add(groundL, groundR);

  const dashGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.02, 2.2));
  for (let z = -22; z <= 30; z += 5.5) {
    const dash = new THREE.Mesh(dashGeo, roadLineMat);
    dash.position.set(0, 0.012, z);
    group.add(dash);
  }

  // Roadside guardrail posts & pine forest silhouettes
  const postGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.9, 0.14));
  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.34, 3.6, 7));
  const crownGeo = trackGeo(new THREE.ConeGeometry(2.3, 5.6, 7));
  for (let z = -20; z <= 30; z += 6) {
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(postGeo, poleMat);
      p.position.set(side * 4.4, 0.45, z);
      group.add(p);

      if (z % 12 === 0) {
        const tx = side * (7.5 + Math.abs((z * 3) % 4));
        const trunk = new THREE.Mesh(trunkGeo, treeMat);
        trunk.position.set(tx, 1.8, z);
        const crown = new THREE.Mesh(crownGeo, treeMat);
        crown.position.set(tx, 4.9, z);
        group.add(trunk, crown);
      }
    }
  }

  // Cool moonlight fill
  const moon = new THREE.DirectionalLight(0x4b638a, 0.52);
  moon.position.set(-10, 18, -14);
  group.add(moon);

  // -------------------------------------------------------------------------
  // 1. STOPPED YELLOW SCHOOL BUS (Z = -6.5, headlights facing +Z)
  // -------------------------------------------------------------------------
  const busGroup = new THREE.Group();
  busGroup.position.set(0, 0, -6.5);

  const busYellowMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.42, metalness: 0.15 }));
  const busTrimMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.6, metalness: 0.35 }));
  const busFloorMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.9 }));
  const busSeatMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x263240, roughness: 0.72 }));
  const busWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.32,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    }),
  );
  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffbeb,
      emissiveIntensity: 2.6,
    }),
  );

  const bFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.62, 0.16, 8.6)), busFloorMat);
  bFloor.position.set(0, 0.72, 0);
  const bLowerL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.78, 8.6)), busYellowMat);
  bLowerL.position.set(-1.26, 1.14, 0);
  const bLowerR = bLowerL.clone();
  bLowerR.position.x = 1.26;
  const bFrontLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.64, 0.78, 0.16)), busYellowMat);
  bFrontLower.position.set(0, 1.14, 4.22);
  const bRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.62, 0.3, 8.4)), busYellowMat);
  bRoof.position.set(0, 2.74, -0.05);
  const bHood = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.9, 1.5)), busYellowMat);
  bHood.position.set(0, 0.92, 4.82);
  const bBumper = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.74, 0.32, 0.24)), busTrimMat);
  bBumper.position.set(0, 0.48, 5.55);
  busGroup.add(bFloor, bLowerL, bLowerR, bFrontLower, bRoof, bHood, bBumper);

  const sideWinGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.96, 7.8));
  const winL = new THREE.Mesh(sideWinGeo, busWindowMat);
  winL.position.set(-1.26, 2.05, -0.1);
  const winR = winL.clone();
  winR.position.x = 1.26;
  const winFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.98, 0.05)), busWindowMat);
  winFront.position.set(0, 2.05, 4.15);
  busGroup.add(winL, winR, winFront);

  // Seats inside stopped bus
  const seatRowZ = [-2.2, -1.05, 0.1, 1.25, 2.35];
  const cushionGeo = trackGeo(new THREE.BoxGeometry(0.84, 0.12, 0.52));
  const backGeo = trackGeo(new THREE.BoxGeometry(0.84, 0.64, 0.12));
  for (const rz of seatRowZ) {
    for (const side of [-1, 1]) {
      const c = new THREE.Mesh(cushionGeo, busSeatMat);
      c.position.set(side * 0.78, 1.18, rz);
      const b = new THREE.Mesh(backGeo, busSeatMat);
      b.position.set(side * 0.78, 1.52, rz - 0.22);
      busGroup.add(c, b);
    }
  }

  // Wheels + headlights cutting across the roadblock
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.34, 14));
  for (const [wx, wz] of [
    [-1.25, -2.5],
    [1.25, -2.5],
    [-1.25, 2.8],
    [1.25, 2.8],
  ]) {
    const w = new THREE.Mesh(wheelGeo, busTrimMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.46, wz);
    busGroup.add(w);
  }

  const hlL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12)), headlightMat);
  hlL.rotation.x = Math.PI / 2;
  hlL.position.set(-0.88, 0.88, 5.58);
  const hlR = hlL.clone();
  hlR.position.x = 0.88;
  busGroup.add(hlL, hlR);

  const busCabinLight = new THREE.PointLight(0xffe39e, 5.4, 14, 1.2);
  busCabinLight.position.set(0, 2.4, 0.6);
  busGroup.add(busCabinLight);

  const busSpotL = new THREE.SpotLight(0xfff5d6, 22, 34, Math.PI * 0.24, 0.5, 1.0);
  busSpotL.position.set(-0.88, 0.92, 5.65);
  busSpotL.target.position.set(-0.7, 0.5, 20);
  busSpotL.castShadow = !isSoftwareGl;
  const busSpotR = new THREE.SpotLight(0xfff5d6, 22, 34, Math.PI * 0.24, 0.5, 1.0);
  busSpotR.position.set(0.88, 0.92, 5.65);
  busSpotR.target.position.set(1.0, 0.5, 20);
  busGroup.add(busSpotL, busSpotL.target, busSpotR, busSpotR.target);

  group.add(busGroup);

  // -------------------------------------------------------------------------
  // 2. UNMARKED BLACK KIDNAPPER VAN BLOCKING ROAD AHEAD (Z = +9.2)
  // -------------------------------------------------------------------------
  const vanGroup = new THREE.Group();
  vanGroup.position.set(0.45, 0, 9.2);
  vanGroup.rotation.y = -0.58; // Angled across the highway lanes

  const vanBlackMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.34, metalness: 0.55 }));
  const vanInnerMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x16181f, roughness: 0.85 }));
  const hazardAmberMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.2 }),
  );
  const hazardRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 2.2 }),
  );
  const steelBarMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x525866, roughness: 0.35, metalness: 0.85 }));

  // Hollow cargo van frame so open side doorway reveals interior
  const vFloor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.15, 0.14, 5.3)), vanBlackMat);
  vFloor.position.set(0, 0.48, 0);
  const vRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.15, 0.14, 5.3)), vanBlackMat);
  vRoof.position.set(0, 2.22, 0);
  const vBackWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.15, 1.72, 0.14)), vanBlackMat);
  vBackWall.position.set(0, 1.35, -2.58);
  const vFrontCab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.15, 1.65, 1.55)), vanBlackMat);
  vFrontCab.position.set(0, 1.32, 1.9);
  const vHood = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.02, 0.92, 0.95)), vanBlackMat);
  vHood.position.set(0, 0.94, 2.98);
  const vRightWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 1.72, 4.1)), vanBlackMat);
  vRightWall.position.set(1.01, 1.35, -0.5);
  // Left wall has wide sliding doorway opening between Z = -1.6 and +0.6
  const vLeftRearWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 1.72, 1.15)), vanBlackMat);
  vLeftRearWall.position.set(-1.01, 1.35, -2.02);
  const vLeftFrontWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 1.72, 0.8)), vanBlackMat);
  vLeftFrontWall.position.set(-1.01, 1.35, 0.82);

  // Tinted windshield
  const vWindshield = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(1.88, 0.72, 0.06)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.1, metalness: 0.8 })),
  );
  vWindshield.position.set(0, 1.72, 2.66);
  vWindshield.rotation.x = -0.35;

  vanGroup.add(vFloor, vRoof, vBackWall, vFrontCab, vHood, vRightWall, vLeftRearWall, vLeftFrontWall, vWindshield);

  // Sliding side door (slides along van length cleanly)
  const vanDoor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 1.62, 2.0)), vanBlackMat);
  vanDoor.position.set(-1.1, 1.34, -2.1); // Starts slid wide open
  vanGroup.add(vanDoor);

  // Interior cage bars + stolen school backpacks + ID clipboard crate inside van!
  const cageBarGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8));
  for (let bx = -0.75; bx <= 0.75; bx += 0.3) {
    const bar = new THREE.Mesh(cageBarGeo, steelBarMat);
    bar.position.set(bx, 1.35, 0.95);
    vanGroup.add(bar);
  }
  const crate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.5, 0.75)), vanInnerMat);
  crate.position.set(0.3, 0.8, -0.55);
  vanGroup.add(crate);

  // Stacked school backpacks inside the van
  const packColors = [0x1d4ed8, 0xb91c1c, 0x15803d, 0x7c2d12, 0x334155];
  packColors.forEach((col, i) => {
    const packMat = trackMat(new THREE.MeshStandardMaterial({ color: col, roughness: 0.75 }));
    const pack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.4, 0.2)), packMat);
    pack.position.set(0.32 + (i % 2) * 0.28 - 0.15, 0.75 + Math.floor(i / 2) * 0.32, -1.6 + (i % 3) * 0.36);
    pack.rotation.set(0.15 * i, 0.3 * i, 0.12);
    vanGroup.add(pack);
  });

  // Scattered white Midnight Public School student ID papers on crate
  const paperMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 }));
  for (let p = 0; p < 4; p++) {
    const card = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.015, 0.2)), paperMat);
    card.position.set(0.1 + p * 0.14, 1.06 + p * 0.004, -0.58 + (p % 2) * 0.12);
    card.rotation.y = 0.28 * p;
    vanGroup.add(card);
  }

  // Van wheels
  for (const [wx, wz] of [
    [-1.04, -1.65],
    [1.04, -1.65],
    [-1.04, 2.05],
    [1.04, 2.05],
  ]) {
    const w = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.4, 0.4, 0.26, 14)), busTrimMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.4, wz);
    vanGroup.add(w);
  }

  // Interior red/amber cargo glow + exterior blinking hazard lights
  const vanCargoLight = new THREE.PointLight(0xff4e3b, 3.6, 8, 1.3);
  vanCargoLight.position.set(-0.2, 1.95, -0.65);
  vanGroup.add(vanCargoLight);

  const hazardAmberMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.14, 0.18)), hazardAmberMat);
  hazardAmberMesh.position.set(-0.98, 1.0, 3.4);
  const hazardRedMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.22, 0.1)), hazardRedMat);
  hazardRedMesh.position.set(-0.88, 1.0, -2.65);
  vanGroup.add(hazardAmberMesh, hazardRedMesh);

  const hazardLightL = new THREE.PointLight(0xf59e0b, 3.0, 12, 1.4);
  hazardLightL.position.set(-1.25, 1.1, 3.4);
  const hazardLightR = new THREE.PointLight(0xdc2626, 3.2, 12, 1.4);
  hazardLightR.position.set(-1.1, 1.1, -2.8);
  vanGroup.add(hazardLightL, hazardLightR);

  group.add(vanGroup);

  // -------------------------------------------------------------------------
  // 3. THREE MASKED & HOODED SCHOOL KID KIDNAPPERS
  // -------------------------------------------------------------------------
  const coatMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.86 }));
  const hoodieMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.88 }));
  const gloveMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.55 }));
  const maskMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd6d3cb, roughness: 0.48 }));
  const eyeSlitMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x030304 }));
  const bootMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.45 }));

  const kidnappers: KidnapperActor[] = [];
  const makeKidnapper = (
    x: number,
    z: number,
    yaw: number,
    scale: number,
    prop: 'none' | 'lantern' | 'clipboard',
  ) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
    root.scale.setScalar(scale);

    // Boots & dark trousers
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.062, 0.88, 10)), coatMat);
      leg.position.set(side * 0.12, 0.44, 0);
      const boot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.1, 0.24)), bootMat);
      boot.position.set(side * 0.12, 0.05, 0.04);
      root.add(leg, boot);
    }

    // Long trench coat torso
    const coat = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.28, 0.96, 12)), coatMat);
    coat.position.set(0, 1.12, 0);
    coat.scale.set(1.12, 1, 0.78);
    root.add(coat);

    // High dark collar + hood + pale blank mask head
    const head = new THREE.Group();
    head.position.set(0, 1.62, 0);

    const hood = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.165, 14, 12)), hoodieMat);
    hood.position.set(0, 0.14, -0.02);
    hood.scale.set(0.95, 1.1, 1.05);
    head.add(hood);

    const mask = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.128, 14, 12)), maskMat);
    mask.position.set(0, 0.13, 0.055);
    mask.scale.set(0.84, 1.08, 0.65);
    head.add(mask);

    // Hollow mask eye slits & grim crease
    for (const side of [-1, 1]) {
      const slit = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.036, 0.018, 0.02)), eyeSlitMat);
      slit.position.set(side * 0.038, 0.155, 0.132);
      slit.rotation.z = side * -0.14;
      head.add(slit);
    }
    const maskLine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.008, 0.015)), eyeSlitMat);
    maskLine.position.set(0, 0.065, 0.126);
    head.add(maskLine);

    root.add(head);

    // Arms + gloved hands
    const makeArm = (side: -1 | 1) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.26, 1.52, 0);
      const sleeve = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.044, 0.56, 9)), hoodieMat);
      sleeve.position.y = -0.28;
      const glove = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.065, 0.1, 0.055)), gloveMat);
      glove.position.set(0, -0.58, 0.02);
      arm.add(sleeve, glove);
      return arm;
    };
    const leftArm = makeArm(-1);
    const rightArm = makeArm(1);

    if (prop === 'lantern') {
      const lamp = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 8)),
        hazardAmberMat,
      );
      lamp.position.set(0, -0.68, 0.08);
      const lampGlow = new THREE.PointLight(0xffaa44, 2.2, 7, 1.5);
      lampGlow.position.set(0, -0.68, 0.12);
      rightArm.add(lamp, lampGlow);
    } else if (prop === 'clipboard') {
      const board = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.24, 0.32, 0.025)),
        trackMat(new THREE.MeshStandardMaterial({ color: 0x3f2e21, roughness: 0.7 })),
      );
      board.position.set(0, -0.58, 0.14);
      board.rotation.x = -0.8;
      leftArm.add(board);
    }

    root.add(leftArm, rightArm);
    group.add(root);

    kidnappers.push({
      root,
      head,
      leftArm,
      rightArm,
      baseX: x,
      baseZ: z,
      baseYaw: yaw,
    });
  };

  // Lead Kidnapper center-road facing the stopped bus; 2 accomplices by the black van
  makeKidnapper(0.15, 3.8, Math.PI, 1.07, 'none');
  makeKidnapper(-1.65, 5.6, Math.PI - 0.25, 1.0, 'lantern');
  makeKidnapper(1.75, 6.2, Math.PI + 0.32, 1.02, 'clipboard');

  const reset = () => {
    vanDoor.position.set(-1.1, 1.34, -2.1);
    kidnappers.forEach((k) => {
      k.root.position.set(k.baseX, 0, k.baseZ);
      k.root.rotation.y = k.baseYaw;
      k.head.rotation.set(0, 0, 0);
      k.leftArm.rotation.set(0, 0, 0);
      k.rightArm.rotation.set(0, 0, 0);
    });
  };
  reset();

  const update = (time: number, stageTime: number) => {
    const blink = Math.sin(time * 7.5) > 0;
    hazardAmberMat.emissiveIntensity = blink ? 2.6 : 0.2;
    hazardRedMat.emissiveIntensity = blink ? 0.25 : 2.5;
    hazardLightL.intensity = blink ? 3.2 : 0.15;
    hazardLightR.intensity = blink ? 0.2 : 3.4;

    // Subtle sinister breathing & head tilts
    kidnappers.forEach((k, idx) => {
      const sway = Math.sin(time * 1.4 + idx * 1.9);
      k.leftArm.rotation.z = 0.06 + sway * 0.03;
      k.rightArm.rotation.z = -0.06 - sway * 0.03;
      k.head.rotation.z = Math.sin(time * 0.9 + idx) * 0.05;
    });

    // Beat 2-4 choreography
    if (kidnappers[0]) {
      const lead = kidnappers[0];
      if (stageTime > 5.0 && stageTime < 13.5) {
        // Lead kidnapper slowly steps closer toward the bus
        const walkP = Math.min(1, (stageTime - 5.0) / 5.5);
        lead.root.position.z = THREE.MathUtils.lerp(lead.baseZ, lead.baseZ - 1.5, walkP);
        lead.head.rotation.z = -0.14;
      } else if (stageTime >= 13.5) {
        // Stinger: raises gloved finger toward mask & closes in
        const stingerP = Math.min(1, (stageTime - 13.5) / 2.8);
        lead.root.position.z = THREE.MathUtils.lerp(lead.baseZ - 1.5, lead.baseZ - 2.35, stingerP);
        lead.rightArm.rotation.x = THREE.MathUtils.lerp(0, -1.65, Math.min(1, stingerP * 1.8));
        lead.rightArm.rotation.z = 0.32;
        lead.head.rotation.z = -0.18;
      }
    }

    // Accomplice 1 holds lantern out toward bus door during van_reveal
    if (kidnappers[1] && stageTime > 4.2) {
      const raiseP = Math.min(1, (stageTime - 4.2) / 1.8);
      kidnappers[1].rightArm.rotation.x = THREE.MathUtils.lerp(0, -0.78, raiseP);
    }

    // Accomplice 2 gestures toward open van interior
    if (kidnappers[2] && stageTime > 8.6) {
      const gestP = Math.min(1, (stageTime - 8.6) / 1.4);
      kidnappers[2].rightArm.rotation.x = -0.55 * gestP;
      kidnappers[2].rightArm.rotation.z = -0.45 * gestP;
    }

    // Slam sliding van door shut at t = 16.05s
    if (stageTime >= 16.0) {
      const closeP = Math.min(1, (stageTime - 16.0) / 0.35);
      vanDoor.position.z = THREE.MathUtils.lerp(-2.1, -0.35, closeP);
    }
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  };

  return {
    group,
    busGroup,
    vanGroup,
    vanDoor,
    hazardLights: [hazardLightL, hazardLightR],
    hazardBulbs: [hazardAmberMat, hazardRedMat],
    kidnappers,
    reset,
    update,
    dispose,
  };
}
