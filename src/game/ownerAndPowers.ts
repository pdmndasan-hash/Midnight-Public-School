import * as THREE from 'three';
import {
  BodyguardStance,
  CharacterTransformTarget,
  HumanAppearance,
  NpcBehaviorOverride,
  TeleportDestinationId,
} from '../types/game';
import { SCHOOL_NAV_NODES } from './anomalyMode';
import { AABB } from './checkpointWorld';
import { createRealisticHuman, HumanActorRig } from './humanBuilder';
import { HumanSkinTextures } from './humanTextures';

export interface FriendlyBodyguard {
  id: string;
  name: string;
  rig: HumanActorRig;
  x: number;
  z: number;
  yaw: number;
  holdX: number;
  holdZ: number;
  phaseOffset: number;
  frozen: boolean;
  behavior: NpcBehaviorOverride;
  speedMultiplier: number;
  attackCooldown: number;
  stuckTimer: number;
  lastCheckX: number;
  lastCheckZ: number;
}

export interface TeleportLocationInfo {
  id: TeleportDestinationId;
  label: string;
  category: 'room' | 'shift' | 'cutscene';
}

export const TELEPORT_LOCATIONS: TeleportLocationInfo[] = [
  { id: 'checkpoint', label: 'Security Checkpoint', category: 'room' },
  { id: 'cctv_desk', label: 'CCTV Room', category: 'room' },
  { id: 'entrance', label: 'School Entrance', category: 'room' },
  { id: 'room101', label: 'Classroom 101', category: 'room' },
  { id: 'room102', label: 'Classroom 102', category: 'room' },
  { id: 'shift1', label: 'Shift 1 Start', category: 'shift' },
  { id: 'shift2', label: 'Shift 2 Start', category: 'shift' },
  { id: 'shift3', label: 'Shift 3 Start', category: 'shift' },
  { id: 'shift4', label: 'Shift 4 Start', category: 'shift' },
  { id: 'shift5', label: 'Shift 5 Start', category: 'shift' },
  { id: 'shift6', label: 'Shift 6 Start Point', category: 'shift' },
  { id: 'shift5_intro', label: 'Shift 5 Opening Cutscene', category: 'cutscene' },
  { id: 'shift5_chase', label: 'Shift 5 Chase Start', category: 'cutscene' },
  { id: 'shift5_ending', label: 'Shift 5 Final Ending', category: 'cutscene' },
  { id: 'ending_screen', label: 'Ending Screen', category: 'cutscene' },
  { id: 'menu', label: 'Main Menu', category: 'cutscene' },
];

export const VALID_SCHOOL_TELEPORT_SPOTS: Record<
  'entrance' | 'checkpoint' | 'cctv_desk' | 'corridor' | 'room101' | 'room102',
  { x: number; z: number; yaw: number }
> = {
  entrance: { x: -0.45, z: -2.0, yaw: 0 },
  checkpoint: { x: -0.35, z: -0.55, yaw: 0.08 },
  cctv_desk: { x: 1.05, z: -0.1, yaw: -Math.PI / 2 },
  corridor: { x: 0.1, z: 9.6, yaw: Math.PI },
  room101: { x: 5.7, z: 9.6, yaw: -Math.PI / 2 },
  room102: { x: 5.7, z: 18.0, yaw: -Math.PI / 2 },
};

export function createPossessTargetOutline(): THREE.Group {
  const grp = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc084fc,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.54, 28), ringMat);
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.035;

  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const bodyAura = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 1.72, 18, 1, true), haloMat);
  bodyAura.position.y = 0.88;

  grp.add(outerRing, bodyAura);
  grp.visible = false;
  return grp;
}

export function buildTransformedAppearance(
  target: Exclude<CharacterTransformTarget, 'original'>,
  base?: HumanAppearance,
): { appearance: HumanAppearance; extraFingers: boolean } {
  if (target === 'guard') {
    return {
      appearance: {
        role: 'teacher',
        skinHex: base?.skinHex ?? '#d2a384',
        hairHex: '#1f1b18',
        hairStyle: 'short_part',
        eyeHex: '#2f3d4c',
        uniformHex: '#182230',
        tieHex: '#8b1e1e',
        glasses: false,
        scarf: false,
        freckles: false,
        tiredDarkCircles: true,
        sweating: false,
        mustache: true,
        guardCap: true,
        hasTaserProp: true,
      },
      extraFingers: false,
    };
  }
  if (target === 'anomaly') {
    return {
      appearance: {
        role: base?.role ?? 'student',
        skinHex: '#b4aca4',
        hairHex: '#0f0e11',
        hairStyle: base?.hairStyle ?? 'short_part',
        eyeHex: '#b91c1c',
        uniformHex: '#191418',
        tieHex: '#450a0a',
        glasses: false,
        scarf: base?.scarf ?? false,
        freckles: false,
        tiredDarkCircles: true,
        sweating: true,
        mustache: false,
        guardCap: false,
        hasTaserProp: false,
      },
      extraFingers: true,
    };
  }
  if (target === 'teacher') {
    return {
      appearance: {
        role: 'teacher',
        skinHex: base?.skinHex ?? '#d7ab8e',
        hairHex: base?.hairHex ?? '#3b2b23',
        hairStyle: base?.hairStyle === 'bun' ? 'bun' : 'short_part',
        eyeHex: base?.eyeHex ?? '#354b5e',
        uniformHex: '#28313f',
        tieHex: '#7c2d12',
        glasses: true,
        scarf: false,
        freckles: false,
        tiredDarkCircles: false,
        sweating: false,
        mustache: false,
        guardCap: false,
        hasTaserProp: false,
      },
      extraFingers: false,
    };
  }
  // Normal student
  return {
    appearance: {
      role: 'student',
      skinHex: base?.skinHex && base.skinHex !== '#b4aca4' ? base.skinHex : '#dfbaa0',
      hairHex: base?.hairHex && base.hairHex !== '#0f0e11' ? base.hairHex : '#2a201b',
      hairStyle: base?.hairStyle ?? 'short_part',
      eyeHex: base?.eyeHex && base.eyeHex !== '#b91c1c' ? base.eyeHex : '#3a4f3f',
      uniformHex: '#1f2b44',
      tieHex: '#8b2635',
      glasses: base?.glasses ?? false,
      scarf: base?.scarf ?? false,
      freckles: base?.freckles ?? false,
      tiredDarkCircles: false,
      sweating: false,
      mustache: false,
      guardCap: false,
      hasTaserProp: false,
    },
    extraFingers: false,
  };
}

export function movePointWithSchoolCollisions(
  x: number,
  z: number,
  dx: number,
  dz: number,
  colliders: AABB[],
  radius = 0.28,
): { x: number; z: number } {
  const blocked = (nx: number, nz: number): boolean => {
    if (nx < -2.2 || nx > 10.2 || nz < -2.0 || nz > 24.1) return true;
    if (nz < -1.9 && nx > 0.85) return true;
    for (const box of colliders) {
      if (
        nx + radius > box.minX &&
        nx - radius < box.maxX &&
        nz + radius > box.minZ &&
        nz - radius < box.maxZ
      ) {
        return true;
      }
    }
    return false;
  };
  let nextX = x;
  let nextZ = z;
  if (!blocked(nextX + dx, nextZ)) nextX += dx;
  if (!blocked(nextX, nextZ + dz)) nextZ += dz;
  return { x: nextX, z: nextZ };
}

export function findClosestSafeNavNode(x: number, z: number): number {
  let best = 1;
  let bestDist = Infinity;
  for (let i = 0; i < SCHOOL_NAV_NODES.length; i++) {
    const n = SCHOOL_NAV_NODES[i];
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function spawnBodyguardUnit(
  index: number,
  playerX: number,
  playerZ: number,
  skinTextures: HumanSkinTextures,
  scene: THREE.Scene,
  colliders: AABB[],
): FriendlyBodyguard {
  const rig = createRealisticHuman(skinTextures);
  const { appearance } = buildTransformedAppearance('guard');
  rig.configure(
    {
      ...appearance,
      tieHex: '#d97706',
    },
    false,
  );
  rig.root.scale.set(1.04, 1.04, 1.04);

  const angle = index * 1.45 + 1.2;
  const dist = 1.35 + (index % 2) * 0.45;
  const placed = movePointWithSchoolCollisions(
    playerX,
    playerZ,
    Math.cos(angle) * dist,
    Math.sin(angle) * dist,
    colliders,
  );

  rig.root.position.set(placed.x, 0, placed.z);
  rig.root.visible = true;
  scene.add(rig.root);

  return {
    id: `bodyguard_${Date.now()}_${index}`,
    name: `Owner Bodyguard #${index + 1}`,
    rig,
    x: placed.x,
    z: placed.z,
    yaw: 0,
    holdX: placed.x,
    holdZ: placed.z,
    phaseOffset: index * 0.9,
    frozen: false,
    behavior: 'follow',
    speedMultiplier: 1.0,
    attackCooldown: 0,
    stuckTimer: 0,
    lastCheckX: placed.x,
    lastCheckZ: placed.z,
  };
}

// Doorways in the school are around x ~ 2.4 at z = 9.6 and z = 18.0, and checking door at x ~ 1.65, z ~ 2.2
const DOORWAY_CENTERS = [
  { x: 2.4, z: 9.6 },
  { x: 2.4, z: 18.0 },
  { x: 0.15, z: 2.25 },
];

export function updateBodyguards(
  guards: FriendlyBodyguard[],
  stance: BodyguardStance,
  playerX: number,
  playerZ: number,
  playerYaw: number,
  dt: number,
  totalTime: number,
  colliders: AABB[],
  paused: boolean,
): void {
  if (paused) return;

  for (let i = 0; i < guards.length; i++) {
    const g = guards[i];
    if (g.attackCooldown > 0) g.attackCooldown = Math.max(0, g.attackCooldown - dt);
    if (g.frozen || g.behavior === 'stand') {
      g.rig.update(totalTime, dt, 'waiting', { phaseOffset: g.phaseOffset });
      continue;
    }

    let targetX = g.holdX;
    let targetZ = g.holdZ;

    if (stance === 'follow' || g.behavior === 'follow') {
      // Spread in a rear/side protective arc behind the player so they stay out of doorways and line of sight
      const slotOffset = (i - (guards.length - 1) / 2) * 0.95;
      const backDist = 1.65 + (i % 2) * 0.55;
      const rightX = Math.cos(playerYaw);
      const rightZ = -Math.sin(playerYaw);
      const fwdX = -Math.sin(playerYaw);
      const fwdZ = -Math.cos(playerYaw);

      targetX = playerX - fwdX * backDist + rightX * slotOffset;
      targetZ = playerZ - fwdZ * backDist + rightZ * slotOffset;

      // Keep clear of doorways when idling
      for (const dw of DOORWAY_CENTERS) {
        if (Math.hypot(targetX - dw.x, targetZ - dw.z) < 0.85) {
          targetX += targetX >= dw.x ? 0.9 : -0.9;
        }
      }
    }

    const dx = targetX - g.x;
    const dz = targetZ - g.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.42) {
      const speed = (dist > 3.5 ? 4.3 : 2.95) * g.speedMultiplier;
      const step = Math.min(dist, speed * dt);
      const moved = movePointWithSchoolCollisions(
        g.x,
        g.z,
        (dx / dist) * step,
        (dz / dist) * step,
        colliders,
      );
      g.x = moved.x;
      g.z = moved.z;
      g.rig.root.position.set(g.x, 0, g.z);
      const tYaw = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(tYaw - g.yaw), Math.cos(tYaw - g.yaw));
      g.yaw += diff * Math.min(1, dt * 8);
      g.rig.root.rotation.y = g.yaw;
      g.rig.update(totalTime, dt, dist > 3.5 ? 'hunting' : 'walking', {
        phaseOffset: g.phaseOffset,
      });

      g.stuckTimer += dt;
      if (g.stuckTimer >= 1.1) {
        const disp = Math.hypot(g.x - g.lastCheckX, g.z - g.lastCheckZ);
        g.lastCheckX = g.x;
        g.lastCheckZ = g.z;
        g.stuckTimer = 0;
        if (disp < 0.12 && dist > 3.6) {
          const safeNode = SCHOOL_NAV_NODES[findClosestSafeNavNode(playerX, playerZ)];
          g.x = safeNode.x;
          g.z = safeNode.z;
          g.rig.root.position.set(g.x, 0, g.z);
        }
      }
    } else {
      const lookYaw = Math.atan2(playerX - g.x, playerZ - g.z) + Math.PI;
      const diff = Math.atan2(Math.sin(lookYaw - g.yaw), Math.cos(lookYaw - g.yaw));
      g.yaw += diff * Math.min(1, dt * 4);
      g.rig.root.rotation.y = g.yaw;
      g.rig.update(totalTime, dt, 'waiting', { phaseOffset: g.phaseOffset });
    }
  }
}
