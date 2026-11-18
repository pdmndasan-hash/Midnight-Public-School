import * as THREE from 'three';
import { ClassRevealBehavior, HumanAppearance } from '../types/game';
import { HumanSkinTextures } from './humanTextures';

export type HumanAnimState =
  | 'hidden'
  | 'waiting'
  | 'walking'
  | 'seated'
  | 'teaching'
  | 'reveal'
  | 'hunting'
  | 'search'
  | 'stunned'
  | 'taser_aim'
  | 'jumpscare';

export type StudentClassAction = 'taking_notes' | 'listening' | 'whispering' | 'yawning';
export type TeacherClassAction = 'lecturing' | 'writing_board' | 'walking_around';

export interface HumanActorRig {
  root: THREE.Group;
  stunLight: THREE.PointLight;
  configure: (app: HumanAppearance, extraFinger: boolean) => void;
  update: (
    time: number,
    dt: number,
    state: HumanAnimState,
    options: {
      noBlinking?: boolean;
      unnaturallyStill?: boolean;
      nervousBreathing?: boolean;
      revealBehavior?: ClassRevealBehavior;
      studentAction?: StudentClassAction;
      teacherAction?: TeacherClassAction;
      isTeacher?: boolean;
      phaseOffset?: number;
      stareYawOffset?: number;
      starePitchOffset?: number;
    },
  ) => void;
  dispose: () => void;
}

export function createRealisticHuman(skinTex: HumanSkinTextures): HumanActorRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc99e82,
    bumpMap: skinTex.skinBump,
    bumpScale: 0.004,
    roughness: 0.58,
    metalness: 0.02,
  });

  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x1f2b3a,
    bumpMap: skinTex.fabricBump,
    bumpScale: 0.012,
    roughness: 0.84,
    metalness: 0.03,
  });

  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xdad7cf,
    bumpMap: skinTex.fabricBump,
    bumpScale: 0.008,
    roughness: 0.82,
  });

  const tieMat = new THREE.MeshStandardMaterial({ color: 0x2f455c, roughness: 0.65 });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x191d24,
    bumpMap: skinTex.fabricBump,
    bumpScale: 0.01,
    roughness: 0.86,
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1b1817, roughness: 0.78, metalness: 0.06 });
  const mustacheMat = new THREE.MeshStandardMaterial({ color: 0x171413, roughness: 0.72, metalness: 0.04 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.42, metalness: 0.12 });
  const eyelidMat = new THREE.MeshStandardMaterial({ color: 0xb48b70, roughness: 0.62 });
  const glassFrameMat = new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.28, metalness: 0.82 });
  const scarfMat = new THREE.MeshStandardMaterial({ color: 0x612424, roughness: 0.9 });

  const eyeMat = new THREE.MeshStandardMaterial({
    map: skinTex.irisMap,
    roughness: 0.08,
    metalness: 0.05,
  });

  const makeLeg = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.88, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.064, 0.44, 8), pantsMat);
    thigh.position.y = -0.22;
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.048, 0.42, 8), pantsMat);
    shin.position.y = -0.63;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.22), shoeMat);
    shoe.position.set(0, -0.84, 0.04);
    leg.add(thigh, shin, shoe);
    return leg;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  root.add(leftLeg, rightLeg);

  const torso = new THREE.Group();
  torso.position.set(0, 0.88, 0);

  const chestGroup = new THREE.Group();
  const jacketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.165, 0.54, 14), jacketMat);
  jacketBody.position.y = 0.27;
  jacketBody.scale.set(1.16, 1, 0.72);
  jacketBody.castShadow = true;
  chestGroup.add(jacketBody);

  // Shirt front & tie
  const shirtPanel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.26, 0.04), shirtMat);
  shirtPanel.position.set(0, 0.42, 0.125);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.22, 0.045), tieMat);
  tie.position.set(0, 0.39, 0.132);
  chestGroup.add(shirtPanel, tie);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.036, 8, 16), scarfMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.set(0, 0.53, 0.01);
  chestGroup.add(scarf);

  // Backpack for students
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.36, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x24272d, roughness: 0.78 }),
  );
  backpack.position.set(0, 0.3, -0.18);
  chestGroup.add(backpack);

  torso.add(chestGroup);

  // Articulated Arms + 5-Finger Hands (+ optional 6th finger & Guard Taser prop!)
  let extraFingerMesh: THREE.Mesh | null = null;
  let guardTaserGroup: THREE.Group | null = null;
  const makeArm = (side: -1 | 1, isRightArm = false) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.24, 0.5, 0);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.3, 8), jacketMat);
    upper.position.y = -0.15;

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.034, 0.28, 8), jacketMat);
    forearm.position.set(0, -0.42, 0.03);
    forearm.rotation.x = -0.16;

    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.58, 0.06);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.065, 0.025), skinMat);
    handGroup.add(palm);

    // Thumb + 4 Fingers
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.042, 6), skinMat);
    thumb.position.set(side * -0.028, -0.015, 0.01);
    thumb.rotation.z = side * 0.45;
    handGroup.add(thumb);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.055, 6), skinMat);
      finger.position.set(-0.018 + f * 0.012, -0.058, 0);
      handGroup.add(finger);
    }

    if (isRightArm) {
      extraFingerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.052, 6), skinMat);
      extraFingerMesh.position.set(0.03, -0.052, 0);
      extraFingerMesh.visible = false;
      handGroup.add(extraFingerMesh);

      // Guard Boss Electric Taser Gun held in right hand (barrel extends down -Y so raising arm points +Z)
      guardTaserGroup = new THREE.Group();
      guardTaserGroup.position.set(0, -0.025, 0.025);
      const taserBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.165, 0.058),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.55 }),
      );
      taserBody.position.set(0, -0.065, 0.028);
      const taserStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.046, 0.11, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.42, metalness: 0.2 }),
      );
      taserStripe.position.set(0, -0.065, 0.048);
      const taserGrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.034, 0.048, 0.075),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72 }),
      );
      taserGrip.position.set(0, -0.005, -0.005);
      const taserTip = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.024, 0.028),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x06b6d4,
          emissiveIntensity: 2.0,
          roughness: 0.2,
        }),
      );
      taserTip.position.set(0, -0.155, 0.032);
      guardTaserGroup.add(taserBody, taserStripe, taserGrip, taserTip);
      guardTaserGroup.visible = false;
      handGroup.add(guardTaserGroup);
    }

    arm.add(upper, forearm, handGroup);
    return arm;
  };

  const leftArm = makeArm(-1, false);
  const rightArm = makeArm(1, true);
  torso.add(leftArm, rightArm);

  // Head with realistic cranium, nose bridge, moist clearcoat eyes, blinking lids, hair variations
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.56, 0.01);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.068, 0.13, 12), skinMat);
  neck.position.y = 0.04;
  headGroup.add(neck);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.118, 14, 12), skinMat);
  cranium.position.set(0, 0.175, 0);
  cranium.scale.set(0.86, 1.08, 0.94);
  cranium.castShadow = true;
  headGroup.add(cranium);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 6), skinMat);
  nose.rotation.x = Math.PI * 0.42;
  nose.position.set(0, 0.16, 0.112);
  headGroup.add(nose);

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.011, 0.016),
    new THREE.MeshStandardMaterial({ color: 0x5c3631, roughness: 0.6 }),
  );
  mouth.position.set(0, 0.11, 0.102);
  headGroup.add(mouth);

  // Classic Security Guard Mustache (composite 3-part sculpted mustache)
  const mustacheGroup = new THREE.Group();
  mustacheGroup.position.set(0, 0.129, 0.108);
  const mustacheCenter = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.013, 0.018), mustacheMat);
  mustacheCenter.position.set(0, 0.002, 0.002);
  const mustacheWingL = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.009, 0.032, 6), mustacheMat);
  mustacheWingL.position.set(-0.019, -0.001, -0.002);
  mustacheWingL.rotation.set(0, -0.22, Math.PI * 0.58);
  const mustacheWingR = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.009, 0.032, 6), mustacheMat);
  mustacheWingR.position.set(0.019, -0.001, -0.002);
  mustacheWingR.rotation.set(0, 0.22, -Math.PI * 0.58);
  mustacheGroup.add(mustacheCenter, mustacheWingL, mustacheWingR);
  mustacheGroup.visible = false;
  headGroup.add(mustacheGroup);

  // Eyes rotated so iris faces +Z
  const makeEye = (ex: number) => {
    const g = new THREE.Group();
    g.position.set(ex, 0.185, 0.098);
    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 12), eyeMat);
    eyeball.rotation.y = -Math.PI / 2;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.024, 0.024), eyelidMat);
    lid.position.set(0, 0.016, 0.004);
    g.add(eyeball, lid);
    return { g, lid };
  };
  const eyeL = makeEye(-0.037);
  const eyeR = makeEye(0.037);
  headGroup.add(eyeL.g, eyeR.g);

  // Hair styles
  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.123, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat,
  );
  hairCrown.position.set(0, 0.19, -0.005);
  hairCrown.rotation.x = -0.15;
  headGroup.add(hairCrown);

  const hairLong = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.1), hairMat);
  hairLong.position.set(0, 0.07, -0.075);
  headGroup.add(hairLong);

  const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), hairMat);
  hairBun.position.set(0, 0.25, -0.12);
  headGroup.add(hairBun);

  // Glasses
  const glassesGroup = new THREE.Group();
  glassesGroup.position.set(0, 0.185, 0.114);
  const rimL = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0035, 6, 14), glassFrameMat);
  rimL.position.x = -0.037;
  const rimR = rimL.clone();
  rimR.position.x = 0.037;
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.004), glassFrameMat);
  glassesGroup.add(rimL, rimR, bridge);
  headGroup.add(glassesGroup);

  // Security Guard Cap
  const guardCapGroup = new THREE.Group();
  guardCapGroup.position.set(0, 0.268, 0);
  const capCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.112, 0.106, 0.068, 12),
    new THREE.MeshStandardMaterial({ color: 0x131d2b, roughness: 0.72 }),
  );
  const capBrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.155, 0.012, 0.088),
    new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.25, metalness: 0.2 }),
  );
  capBrim.position.set(0, -0.026, 0.088);
  capBrim.rotation.x = 0.14;
  const capBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.026, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xd9a838, roughness: 0.26, metalness: 0.85 }),
  );
  capBadge.position.set(0, 0.004, 0.108);
  guardCapGroup.add(capCrown, capBrim, capBadge);
  guardCapGroup.visible = false;
  headGroup.add(guardCapGroup);

  torso.add(headGroup);
  root.add(torso);

  const stunLight = new THREE.PointLight(0x60c8ff, 0, 5.5);
  stunLight.position.set(0, 1.35, 0.28);
  stunLight.visible = false;
  root.add(stunLight);

  let blinkTimer = 1.6;
  let blinking = false;

  const configure = (app: HumanAppearance, extraFinger: boolean) => {
    skinMat.color.set(app.skinHex);
    eyelidMat.color.set(app.skinHex).multiplyScalar(0.88);
    hairMat.color.set(app.hairHex);
    mustacheMat.color.set(app.hairHex).multiplyScalar(0.85);
    mustacheGroup.visible = Boolean(app.mustache);
    guardCapGroup.visible = Boolean(app.guardCap);
    if (guardTaserGroup) guardTaserGroup.visible = Boolean(app.hasTaserProp);
    jacketMat.color.set(app.uniformHex);
    tieMat.color.set(app.tieHex);
    glassesGroup.visible = app.glasses;
    scarf.visible = app.scarf;
    backpack.visible = app.role === 'student';
    hairLong.visible = app.hairStyle === 'long_straight' || app.hairStyle === 'wavy_bob';
    hairLong.scale.y = app.hairStyle === 'wavy_bob' ? 0.65 : 1.0;
    hairBun.visible = app.hairStyle === 'bun';
    if (extraFingerMesh) extraFingerMesh.visible = extraFinger;
    blinkTimer = 1.4 + Math.random() * 1.5;
    blinking = false;
  };

  const update: HumanActorRig['update'] = (time, dt, state, options) => {
    if (state === 'hidden') {
      root.visible = false;
      stunLight.visible = false;
      stunLight.intensity = 0;
      return;
    }
    root.visible = true;
    const isStunned = state === 'stunned';
    stunLight.visible = isStunned;
    stunLight.intensity = isStunned ? (Math.random() > 0.35 ? 4.4 : 0.6) : 0;

    // Natural blinking vs unblinking fake
    let blinkAmt = 0;
    if (!options.noBlinking && (state === 'waiting' || state === 'walking' || state === 'seated' || state === 'teaching')) {
      blinkTimer -= dt;
      if (blinkTimer <= 0) {
        if (!blinking) {
          blinking = true;
          blinkTimer = 0.13;
        } else {
          blinking = false;
          blinkTimer = 2.0 + Math.random() * 2.4;
        }
      }
      blinkAmt = blinking ? 1 : 0;
    }
    eyeL.lid.position.y = THREE.MathUtils.lerp(0.016, 0.0, blinkAmt);
    eyeR.lid.position.y = THREE.MathUtils.lerp(0.016, 0.0, blinkAmt);

    const t = time + (options.phaseOffset ?? 0);

    // Subtle chest breathing
    const breathSpeed = options.nervousBreathing ? 4.2 : 1.6;
    const breathAmp = options.unnaturallyStill ? 0 : options.nervousBreathing ? 0.025 : 0.012;
    chestGroup.scale.set(1, 1, 1 + Math.sin(t * breathSpeed) * breathAmp);

    // Default reset
    torso.position.y = 0.88;
    leftLeg.position.y = 0.88;
    rightLeg.position.y = 0.88;
    mouth.scale.set(1, 1, 1);

    if (state === 'jumpscare') {
      torso.rotation.set(0.14, 0, 0);
      headGroup.rotation.set(-0.08, 0, Math.sin(time * 54) * 0.14);
      mouth.scale.set(1.8, 3.8, 1.6);
      leftArm.rotation.set(-1.35, 0, -0.35);
      rightArm.rotation.set(-1.35, 0, 0.35);
      leftLeg.rotation.set(0, 0, 0);
      rightLeg.rotation.set(0, 0, 0);
      return;
    }

    if (state === 'stunned') {
      torso.rotation.set(0.16, Math.sin(time * 40) * 0.15, Math.cos(time * 36) * 0.1);
      headGroup.rotation.set(-0.2, Math.sin(time * 52) * 0.4, Math.cos(time * 42) * 0.2);
      leftArm.rotation.set(-0.55 + Math.sin(time * 34) * 0.35, 0, -0.45);
      rightArm.rotation.set(-0.55 - Math.sin(time * 34) * 0.35, 0, 0.45);
      leftLeg.rotation.x = 0.1;
      rightLeg.rotation.x = -0.1;
      return;
    }

    if (state === 'taser_aim') {
      torso.rotation.set(0.04, -0.08, 0);
      headGroup.rotation.set(-0.02, 0.06, 0);
      leftArm.rotation.set(-0.45, 0.2, -0.1);
      rightArm.rotation.set(-1.48, 0.06, 0.04);
      leftLeg.rotation.x = 0.12;
      rightLeg.rotation.x = -0.12;
      return;
    }

    if (state === 'walking') {
      const s = Math.sin(t * 5.8);
      torso.position.y = 0.88 + Math.abs(s) * 0.02;
      torso.rotation.set(0.05, 0, Math.cos(t * 5.8) * 0.02);
      headGroup.rotation.set(0.02, Math.sin(t * 1.1) * 0.06, 0);
      leftLeg.rotation.x = s * 0.5;
      rightLeg.rotation.x = -s * 0.5;
      leftArm.rotation.set(-s * 0.34, 0, -0.05);
      rightArm.rotation.set(s * 0.34, 0, 0.05);
      return;
    }

    if (state === 'seated') {
      torso.position.y = 0.46;
      leftLeg.position.y = 0.46;
      rightLeg.position.y = 0.46;
      leftLeg.rotation.x = -Math.PI / 2.1;
      rightLeg.rotation.x = -Math.PI / 2.1;
      const action = options.studentAction ?? 'taking_notes';

      if (action === 'taking_notes') {
        const glanceUp = Math.sin(t * 0.55) > 0.72;
        torso.rotation.set(glanceUp ? 0.06 : 0.16, 0, 0);
        headGroup.rotation.set(glanceUp ? 0.02 : 0.28, Math.sin(t * 0.9) * 0.06, 0);
        leftArm.rotation.set(-0.78, 0, 0.12);
        rightArm.rotation.set(-0.86 + Math.sin(t * 7.2) * 0.05, Math.sin(t * 6.4) * 0.15, -0.1);
      } else if (action === 'listening') {
        torso.rotation.set(0.04, 0, 0);
        headGroup.rotation.set(0.03 + Math.sin(t * 1.2) * 0.04, Math.sin(t * 0.7) * 0.1, 0);
        leftArm.rotation.set(-0.62, 0, 0.08);
        rightArm.rotation.set(-0.62, 0, -0.08);
      } else if (action === 'whispering') {
        torso.rotation.set(0.09, 0.18, 0.08);
        headGroup.rotation.set(0.06, 0.42 + Math.sin(t * 4.5) * 0.04, 0.06);
        mouth.scale.set(1.05, 1.3 + Math.abs(Math.sin(t * 9.0)) * 0.7, 1.0);
        leftArm.rotation.set(-0.65, 0, 0.1);
        rightArm.rotation.set(-0.98, -0.25, -0.18);
      } else {
        // yawning
        const yawnCurve = Math.max(0, Math.sin((t % 2.4) * (Math.PI / 2.4)));
        torso.rotation.set(-0.05 * yawnCurve, 0, 0);
        headGroup.rotation.set(-0.22 * yawnCurve, 0.05, 0);
        mouth.scale.set(1.2, 1.0 + yawnCurve * 1.7, 1.1);
        leftArm.rotation.set(-0.55, 0, 0.08);
        rightArm.rotation.set(-0.7 - yawnCurve * 0.55, 0.15 * yawnCurve, -0.1);
      }
    } else if (state === 'reveal') {
      const behavior = options.revealBehavior ?? 'not_writing_stare';
      if (options.isTeacher) {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        torso.rotation.set(0, 0, 0);
        if (behavior === 'not_writing_stare') {
          headGroup.rotation.set(
            options.starePitchOffset ?? -0.25,
            options.stareYawOffset ?? 0,
            0.08,
          );
        } else if (behavior === 'repeating_loop') {
          const cycle = (time * 1.25) % 1;
          torso.rotation.set(0.03 * Math.sin(cycle * Math.PI * 2), 0, 0);
          headGroup.rotation.set(0.06 * Math.sin(cycle * Math.PI * 2), 0, 0);
          mouth.scale.set(1.15, 1.0 + Math.abs(Math.sin(cycle * Math.PI * 3)) * 1.35, 1.0);
        } else {
          headGroup.rotation.set(-0.06, 0, 0.04);
        }
        leftArm.rotation.set(0.02, 0, -0.02);
        rightArm.rotation.set(0.02, 0, 0.02);
        return;
      }

      torso.position.y = 0.46;
      leftLeg.position.y = 0.46;
      rightLeg.position.y = 0.46;
      leftLeg.rotation.x = -Math.PI / 2.1;
      rightLeg.rotation.x = -Math.PI / 2.1;

      if (behavior === 'copying_neighbor') {
        // Robotic synchronized copying of a seated neighbor's exact pose
        const sync = Math.sin(time * 2.2);
        torso.rotation.set(0.12, sync * 0.12, 0);
        headGroup.rotation.set(0.14 + Math.cos(time * 1.6) * 0.08, sync * 0.28, 0);
        leftArm.rotation.set(-0.74 + sync * 0.08, 0, 0.1);
        rightArm.rotation.set(-0.82 - sync * 0.08, Math.sin(time * 4.5) * 0.12, -0.1);
      } else if (behavior === 'repeating_loop') {
        // Rigid mechanical repeating sentence loop
        const cycle = (time * 1.35) % 1;
        torso.rotation.set(0.04, 0, 0);
        headGroup.rotation.set(0.08 + Math.sin(cycle * Math.PI * 2) * 0.07, 0.04, 0);
        mouth.scale.set(1.15, 1.0 + Math.abs(Math.sin(cycle * Math.PI * 4)) * 1.45, 1.0);
        leftArm.rotation.set(-0.55, 0, 0.04);
        rightArm.rotation.set(-0.55, 0, -0.04);
      } else if (behavior === 'not_writing_stare') {
        // Motionless hands (not writing), head unblinkingly fixed toward CCTV camera
        torso.rotation.set(0.02, 0, 0);
        headGroup.rotation.set(
          options.starePitchOffset ?? -0.28,
          options.stareYawOffset ?? 0,
          0.09,
        );
        leftArm.rotation.set(-0.52, 0, 0.04);
        rightArm.rotation.set(-0.52, 0, -0.04);
      } else {
        // not_blinking: rigidly upright & unnaturally frozen while classmates move
        torso.rotation.set(0, 0, 0);
        headGroup.rotation.set(0, 0, 0);
        leftArm.rotation.set(-0.52, 0, 0.02);
        rightArm.rotation.set(-0.52, 0, -0.02);
      }
    } else if (state === 'teaching') {
      const tAction = options.teacherAction ?? 'lecturing';
      if (tAction === 'walking_around') {
        const s = Math.sin(t * 4.8);
        torso.position.y = 0.88 + Math.abs(s) * 0.015;
        torso.rotation.set(0.04, 0, 0);
        headGroup.rotation.set(0.06, Math.sin(t * 1.4) * 0.18, 0);
        leftLeg.rotation.x = s * 0.42;
        rightLeg.rotation.x = -s * 0.42;
        leftArm.rotation.set(-s * 0.24, 0, -0.05);
        rightArm.rotation.set(s * 0.24, 0, 0.05);
      } else if (tAction === 'writing_board') {
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        torso.rotation.set(0.05, Math.sin(t * 1.5) * 0.06, 0);
        headGroup.rotation.set(-0.08, Math.sin(t * 2.1) * 0.12, 0);
        leftArm.rotation.set(-0.12, 0, -0.06);
        // Right arm raised writing on blackboard
        rightArm.rotation.set(-1.55 + Math.sin(t * 5.2) * 0.16, Math.cos(t * 3.1) * 0.24, 0.12);
      } else {
        // lecturing
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        torso.rotation.set(0.02, Math.sin(t * 0.65) * 0.14, 0);
        headGroup.rotation.set(0.04, Math.sin(t * 0.95) * 0.24, 0);
        mouth.scale.set(1.05, 1.0 + Math.abs(Math.sin(t * 6.5)) * 0.45, 1.0);
        leftArm.rotation.set(-0.32 + Math.sin(t * 1.9) * 0.12, 0, -0.1);
        rightArm.rotation.set(-0.62 + Math.sin(t * 2.4) * 0.22, 0, 0.14);
      }
    } else if (state === 'waiting') {
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      if (options.unnaturallyStill) {
        torso.rotation.set(0, 0, 0);
        headGroup.rotation.set(0, 0, 0);
      } else {
        torso.rotation.set(0.02, Math.sin(time * 1.1) * 0.025, 0);
        headGroup.rotation.set(0.05 + Math.sin(time * 0.8) * 0.03, Math.sin(time * 0.5) * 0.06, 0);
      }
      leftArm.rotation.set(0.04, 0, -0.05);
      rightArm.rotation.set(-0.04, 0, 0.05);
    } else if (state === 'search') {
      const s = Math.sin(time * 2.9);
      torso.rotation.set(0.22, Math.sin(time * 1.6) * 0.2, 0);
      headGroup.rotation.set(0.15, Math.sin(time * 2.3) * 0.5, 0.15);
      leftLeg.rotation.x = s * 0.25;
      rightLeg.rotation.x = -s * 0.25;
      leftArm.rotation.set(-0.34 - s * 0.18, 0, -0.1);
      rightArm.rotation.set(-0.34 + s * 0.18, 0, 0.1);
    } else if (state === 'hunting') {
      const s = Math.sin(time * 10.2);
      torso.rotation.set(0.3, 0, Math.sin(time * 10.2) * 0.05);
      headGroup.rotation.set(-0.1, Math.sin(time * 15) * 0.12, Math.cos(time * 14) * 0.1);
      leftLeg.rotation.x = s * 0.76;
      rightLeg.rotation.x = -s * 0.76;
      leftArm.rotation.set(-0.95 - s * 0.42, 0, -0.16);
      rightArm.rotation.set(-0.95 + s * 0.42, 0, 0.16);
    }
  };

  const dispose = () => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  };

  return { root, stunLight, configure, update, dispose };
}
