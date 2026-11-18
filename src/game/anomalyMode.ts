import * as THREE from 'three';
import { NpcBehaviorOverride, SchoolRecordEntry } from '../types/game';
import { AABB } from './checkpointWorld';
import { createRealisticHuman, HumanActorRig } from './humanBuilder';
import { HumanSkinTextures } from './humanTextures';

export interface SchoolNavNode {
  x: number;
  z: number;
  neighbors: number[];
  zone: 'checking' | 'corridor' | 'room101' | 'room102';
}

// Connected doorway-safe navigation graph matching checkpointWorld.ts layout
export const SCHOOL_NAV_NODES: SchoolNavNode[] = [
  /* 0: Checking Room */ { x: -0.2, z: 0.7, neighbors: [1], zone: 'checking' },
  /* 1: Corridor North */ { x: 0.1, z: 4.2, neighbors: [0, 2], zone: 'corridor' },
  /* 2: Corridor @ 101 */ { x: 0.1, z: 9.6, neighbors: [1, 3, 4], zone: 'corridor' },
  /* 3: Corridor @ 102 */ { x: 0.1, z: 18.0, neighbors: [2, 7, 10], zone: 'corridor' },
  /* 4: Room 101 Door */ { x: 3.3, z: 9.6, neighbors: [2, 5, 6], zone: 'room101' },
  /* 5: Room 101 Front */ { x: 6.2, z: 7.1, neighbors: [4, 6], zone: 'room101' },
  /* 6: Room 101 Back */ { x: 6.8, z: 12.2, neighbors: [4, 5], zone: 'room101' },
  /* 7: Room 102 Door */ { x: 3.3, z: 18.0, neighbors: [3, 8, 9], zone: 'room102' },
  /* 8: Room 102 Front */ { x: 6.2, z: 15.5, neighbors: [7, 9], zone: 'room102' },
  /* 9: Room 102 Back */ { x: 6.8, z: 20.6, neighbors: [7, 8], zone: 'room102' },
  /* 10: Corridor South */ { x: 0.1, z: 22.8, neighbors: [3], zone: 'corridor' },
];

export const GUARD_PATROL_ROUTE = [0, 1, 2, 4, 2, 3, 7, 3, 10, 3, 2, 1];
const STUDENT_START_NODES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export type AnomalyNpcState =
  | 'patrol'
  | 'walk'
  | 'panic_flee'
  | 'hide_cower'
  | 'boss_chase'
  | 'boss_aim'
  | 'boss_stagger'
  | 'caught';

export interface AnomalyNpc {
  id: string;
  name: string;
  role: 'guard' | 'student';
  rig: HumanActorRig;
  x: number;
  z: number;
  yaw: number;
  currentNode: number;
  targetNode: number;
  patrolIdx: number;
  state: AnomalyNpcState;
  panicTimer: number;
  pauseTimer: number;
  catchTimer: number;
  alarmCooldown: number;
  callHelpCooldown: number;
  stuckTimer: number;
  lastCheckX: number;
  lastCheckZ: number;
  phaseOffset: number;
  bossHp: number;
  bossMaxHp: number;
  taserCooldown: number;
  taserAimTimer: number;
  staggerTimer: number;
  frozen?: boolean;
  possessed?: boolean;
  behaviorOverride?: NpcBehaviorOverride;
  speedMultiplier?: number;
  transformedAs?: 'original' | 'student' | 'teacher' | 'guard' | 'anomaly';
}

export function findNearestNavNode(x: number, z: number): number {
  let best = 0;
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

export function findNextHopBfs(fromIdx: number, goalIdx: number): number {
  if (fromIdx === goalIdx) return goalIdx;
  const visited = new Set<number>([fromIdx]);
  const queue: { node: number; firstStep: number }[] = [];
  for (const nb of SCHOOL_NAV_NODES[fromIdx].neighbors) {
    if (nb === goalIdx) return nb;
    visited.add(nb);
    queue.push({ node: nb, firstStep: nb });
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of SCHOOL_NAV_NODES[cur.node].neighbors) {
      if (nb === goalIdx) return cur.firstStep;
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push({ node: nb, firstStep: cur.firstStep });
      }
    }
  }
  return SCHOOL_NAV_NODES[fromIdx].neighbors[0] ?? fromIdx;
}

function pickFarthestNodeFrom(playerX: number, playerZ: number, excludeNode?: number): number {
  let best = 0;
  let bestDist = -1;
  for (let i = 0; i < SCHOOL_NAV_NODES.length; i++) {
    if (i === excludeNode) continue;
    const n = SCHOOL_NAV_NODES[i];
    const d = Math.hypot(n.x - playerX, n.z - playerZ);
    if (d > bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

function moveNpcWithCollisions(
  x: number,
  z: number,
  dx: number,
  dz: number,
  colliders: AABB[],
): { x: number; z: number } {
  const radius = 0.28;
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

/**
 * Checks unobstructed line-of-sight between Guard Boss and Anomaly.
 * When crouching, desks/furniture colliders also block the taser line-of-sight!
 */
export function traceBossLineOfSight(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  colliders: AABB[],
  includeFurnitureCover: boolean,
): { clear: boolean; hitX: number; hitZ: number } {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  if (dist < 0.01) return { clear: true, hitX: x2, hitZ: z2 };
  const steps = Math.ceil(dist / 0.22);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = x1 + (x2 - x1) * t;
    const pz = z1 + (z2 - z1) * t;
    for (const box of colliders) {
      const isFurniture = box.maxX - box.minX >= 0.55 && box.maxZ - box.minZ >= 0.55;
      if (isFurniture && !includeFurnitureCover) continue;
      if (px >= box.minX && px <= box.maxX && pz >= box.minZ && pz <= box.maxZ) {
        return { clear: false, hitX: px, hitZ: pz };
      }
    }
  }
  return { clear: true, hitX: x2, hitZ: z2 };
}

export function spawnAnomalyModeNpc(
  role: 'guard' | 'student',
  index: number,
  records: SchoolRecordEntry[],
  skinTextures: HumanSkinTextures,
  scene: THREE.Scene,
  playerX: number,
  playerZ: number,
  colliders: AABB[] = [],
  isRespawn = false,
): AnomalyNpc {
  const studentRecs = records.filter((r) => r.role === 'student');
  const rec = studentRecs.length > 0 ? studentRecs[index % studentRecs.length] : undefined;

  const rig = createRealisticHuman(skinTextures);
  if (role === 'guard') {
    rig.configure(
      {
        role: 'teacher',
        skinHex: '#d2a384',
        hairHex: '#201c1a',
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
      false,
    );
    rig.root.scale.set(1.08, 1.08, 1.08);
  } else if (rec) {
    rig.configure(rec.appearance, false);
  }

  let startNodeIdx: number;
  if (isRespawn) {
    startNodeIdx = pickFarthestNodeFrom(playerX, playerZ);
  } else if (role === 'guard') {
    startNodeIdx = 2; // Start patrolling corridor near Room 101
  } else {
    startNodeIdx = STUDENT_START_NODES[index % STUDENT_START_NODES.length];
  }

  const startNode = SCHOOL_NAV_NODES[startNodeIdx];
  let x = startNode.x;
  let z = startNode.z;
  if (role === 'student') {
    const angle = (index * 2.39996) % (Math.PI * 2);
    const rad = 0.35 + (index % 3) * 0.25;
    const nudged = moveNpcWithCollisions(
      x,
      z,
      Math.cos(angle) * rad,
      Math.sin(angle) * rad,
      colliders,
    );
    x = nudged.x;
    z = nudged.z;
  }

  rig.root.position.set(x, 0, z);
  rig.root.visible = true;
  scene.add(rig.root);

  const initialTarget =
    role === 'guard'
      ? GUARD_PATROL_ROUTE[(index + 3) % GUARD_PATROL_ROUTE.length]
      : startNode.neighbors[index % startNode.neighbors.length] ?? 1;

  return {
    id: `${role}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    name:
      role === 'guard'
        ? 'Security Guard Boss'
        : rec?.fullName ?? `Student #${index + 1}`,
    role,
    rig,
    x,
    z,
    yaw: 0,
    currentNode: startNodeIdx,
    targetNode: initialTarget,
    patrolIdx: 2,
    state: role === 'guard' ? 'patrol' : 'walk',
    panicTimer: 0,
    pauseTimer: role === 'student' ? (index % 3) * 0.55 : 0,
    catchTimer: 0,
    alarmCooldown: 0,
    callHelpCooldown: 0,
    stuckTimer: 0,
    lastCheckX: x,
    lastCheckZ: z,
    phaseOffset: index * 1.15,
    bossHp: role === 'guard' ? 100 : 1,
    bossMaxHp: role === 'guard' ? 100 : 1,
    taserCooldown: 0,
    taserAimTimer: 0,
    staggerTimer: 0,
  };
}

export interface AnomalyTickEvents {
  guardTriggeredAlarm: boolean;
  guardAimingStarted: boolean;
  guardFiredTaser: {
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
    hit: boolean;
  } | null;
  studentCalledHelp: string | null;
  caughtNpc: { name: string; role: 'guard' | 'student' } | null;
}

export function updateAnomalyModeNpcs(
  npcs: AnomalyNpc[],
  dt: number,
  totalTime: number,
  playerX: number,
  playerZ: number,
  surgeActive: boolean,
  colliders: AABB[],
  scene: THREE.Scene,
  playerStealth: { isCrouching: boolean; isHiding: boolean; isInvisible?: boolean; npcsPaused?: boolean } = {
    isCrouching: false,
    isHiding: false,
  },
): AnomalyTickEvents {
  const events: AnomalyTickEvents = {
    guardTriggeredAlarm: false,
    guardAimingStarted: false,
    guardFiredTaser: null,
    studentCalledHelp: null,
    caughtNpc: null,
  };

  if (playerStealth.npcsPaused) {
    return events;
  }

  let alarmPulseOrigin: { x: number; z: number } | null = null;
  const playerDetectable = !playerStealth.isInvisible;

  // First pass: detection, Boss Guard taser pursuit, and student panic
  for (const npc of npcs) {
    if (npc.state === 'caught' || npc.frozen || npc.possessed) continue;
    if (npc.alarmCooldown > 0) npc.alarmCooldown = Math.max(0, npc.alarmCooldown - dt);
    if (npc.callHelpCooldown > 0) npc.callHelpCooldown = Math.max(0, npc.callHelpCooldown - dt);
    if (npc.taserCooldown > 0) npc.taserCooldown = Math.max(0, npc.taserCooldown - dt);
    if (npc.staggerTimer > 0) npc.staggerTimer = Math.max(0, npc.staggerTimer - dt);

    if (npc.behaviorOverride && npc.behaviorOverride !== 'default') {
      continue;
    }

    const dist = Math.hypot(playerX - npc.x, playerZ - npc.z);

    if (npc.role === 'guard') {
      if (npc.staggerTimer > 0) {
        npc.state = 'boss_stagger';
        npc.taserAimTimer = 0;
        continue;
      }

      const detectRange = !playerDetectable
        ? 0
        : playerStealth.isHiding && !surgeActive
          ? 0
          : playerStealth.isCrouching && !surgeActive
            ? 5.5
            : surgeActive
              ? 15.0
              : 12.0;

      const los = traceBossLineOfSight(
        npc.x,
        npc.z,
        playerX,
        playerZ,
        colliders,
        playerStealth.isCrouching,
      );

      if (detectRange > 0 && dist < detectRange && (los.clear || surgeActive || dist < 3.6)) {
        if (npc.alarmCooldown <= 0) {
          npc.alarmCooldown = 7.0;
          events.guardTriggeredAlarm = true;
          alarmPulseOrigin = { x: npc.x, z: npc.z };
        }
        npc.panicTimer = 6.5;

        if (dist <= 9.2 && los.clear && npc.taserCooldown <= 0 && !playerStealth.isHiding) {
          if (npc.state !== 'boss_aim') {
            npc.state = 'boss_aim';
            npc.taserAimTimer = 0;
            events.guardAimingStarted = true;
          }
        } else if (npc.state !== 'boss_aim') {
          npc.state = 'boss_chase';
        }
      } else if (npc.state === 'boss_aim' && (!playerDetectable || playerStealth.isHiding || !los.clear || dist > 11.0)) {
        npc.taserAimTimer = 0;
        npc.state = !playerDetectable || playerStealth.isHiding ? 'patrol' : 'boss_chase';
      } else if (!playerDetectable && (npc.state === 'boss_chase' || npc.state === 'boss_aim')) {
        npc.state = 'patrol';
      }
      continue;
    }

    // Student detection
    const detectRange = !playerDetectable
      ? 0
      : playerStealth.isHiding && !surgeActive
        ? 0
        : playerStealth.isCrouching && !surgeActive
          ? 3.8
          : surgeActive
            ? 13.5
            : 8.2;

    if (detectRange > 0 && dist < detectRange) {
      const shouldHide =
        npc.state === 'hide_cower' || (dist > 4.2 && Math.random() < 0.08 && npc.panicTimer <= 0);
      if (shouldHide && npc.state !== 'panic_flee') {
        npc.state = 'hide_cower';
        npc.panicTimer = 4.0;
      } else if (npc.state !== 'hide_cower') {
        npc.state = 'panic_flee';
        npc.panicTimer = 5.0;
      }
      if (npc.callHelpCooldown <= 0) {
        npc.callHelpCooldown = 7.5;
        events.studentCalledHelp = npc.name;
      }
    }
  }

  // Spread guard alarm panic to nearby students
  if (alarmPulseOrigin) {
    for (const npc of npcs) {
      if (npc.role === 'student' && npc.state !== 'caught') {
        const d = Math.hypot(npc.x - alarmPulseOrigin.x, npc.z - alarmPulseOrigin.z);
        if (d < 13.0) {
          npc.state = 'panic_flee';
          npc.panicTimer = Math.max(npc.panicTimer, 4.5);
        }
      }
    }
  }

  // Second pass: movement, Boss Taser firing, animations, and non-graphic caught fade
  for (let i = npcs.length - 1; i >= 0; i--) {
    const npc = npcs[i];

    if (npc.state === 'caught') {
      npc.catchTimer -= dt;
      const frac = Math.max(0, npc.catchTimer / 0.48);
      const baseScale = npc.role === 'guard' ? 1.08 : 1.0;
      npc.rig.root.scale.set(
        baseScale * (0.85 + frac * 0.15),
        baseScale * (0.72 + frac * 0.28),
        baseScale * (0.85 + frac * 0.15),
      );
      npc.rig.root.position.y = -(1 - frac) * 0.35;
      npc.rig.update(totalTime, dt, 'stunned', { noBlinking: true, nervousBreathing: true });
      if (npc.catchTimer <= 0) {
        scene.remove(npc.rig.root);
        npc.rig.dispose();
        events.caughtNpc = { name: npc.name, role: npc.role };
        npcs.splice(i, 1);
      }
      continue;
    }

    if (npc.possessed) {
      continue;
    }

    if (npc.frozen || npc.behaviorOverride === 'stand') {
      npc.rig.update(totalTime, dt, 'waiting', { phaseOffset: npc.phaseOffset });
      continue;
    }

    if (npc.state === 'boss_stagger') {
      npc.rig.update(totalTime, dt, 'stunned', { noBlinking: true, nervousBreathing: true });
      if (npc.staggerTimer <= 0) {
        npc.state = 'boss_chase';
        npc.panicTimer = 6.0;
      }
      continue;
    }

    if (npc.state === 'boss_aim') {
      const targetYaw = Math.atan2(playerX - npc.x, playerZ - npc.z);
      const yawDiff = Math.atan2(Math.sin(targetYaw - npc.yaw), Math.cos(targetYaw - npc.yaw));
      npc.yaw += yawDiff * Math.min(1, dt * 11);
      npc.rig.root.rotation.y = npc.yaw;
      npc.rig.update(totalTime, dt, 'taser_aim', { noBlinking: true });
      npc.taserAimTimer += dt;

      if (npc.taserAimTimer >= 0.85) {
        npc.taserAimTimer = 0;
        npc.taserCooldown = 2.6;
        const shotDist = Math.hypot(playerX - npc.x, playerZ - npc.z);
        const shotLos = traceBossLineOfSight(
          npc.x,
          npc.z,
          playerX,
          playerZ,
          colliders,
          playerStealth.isCrouching,
        );
        const hit = playerDetectable && !playerStealth.isHiding && shotDist <= 10.6 && shotLos.clear;
        events.guardFiredTaser = {
          fromX: npc.x,
          fromZ: npc.z,
          toX: shotLos.clear ? playerX : shotLos.hitX,
          toZ: shotLos.clear ? playerZ : shotLos.hitZ,
          hit,
        };
        npc.state = 'boss_chase';
      }
      continue;
    }

    if (npc.panicTimer > 0) {
      npc.panicTimer = Math.max(0, npc.panicTimer - dt);
      if (npc.panicTimer <= 0) {
        npc.state = npc.role === 'guard' ? 'patrol' : 'walk';
      }
    }

    if (npc.state === 'hide_cower' && (!npc.behaviorOverride || npc.behaviorOverride === 'default')) {
      const awayYaw = Math.atan2(npc.x - playerX, npc.z - playerZ);
      const diff = Math.atan2(Math.sin(awayYaw - npc.yaw), Math.cos(awayYaw - npc.yaw));
      npc.yaw += diff * Math.min(1, dt * 6);
      npc.rig.root.rotation.y = npc.yaw;
      npc.rig.root.position.set(npc.x, -0.28, npc.z);
      npc.rig.update(totalTime, dt, 'search', { nervousBreathing: true, phaseOffset: npc.phaseOffset });
      if (playerDetectable && (!playerStealth.isHiding || surgeActive) && Math.hypot(playerX - npc.x, playerZ - npc.z) < 3.4) {
        npc.state = 'panic_flee';
        npc.panicTimer = 4.5;
        npc.rig.root.position.y = 0;
      }
      continue;
    }

    npc.rig.root.position.y = 0;

    if (npc.pauseTimer > 0 && (npc.state === 'walk' || npc.state === 'patrol') && (!npc.behaviorOverride || npc.behaviorOverride === 'default')) {
      npc.pauseTimer = Math.max(0, npc.pauseTimer - dt);
      npc.rig.update(totalTime, dt, 'waiting', { phaseOffset: npc.phaseOffset });
      continue;
    }

    npc.currentNode = findNearestNavNode(npc.x, npc.z);

    if (npc.behaviorOverride === 'follow') {
      npc.targetNode = findNearestNavNode(playerX, playerZ);
      if (Math.hypot(playerX - npc.x, playerZ - npc.z) < 1.8) {
        npc.rig.update(totalTime, dt, 'waiting', { phaseOffset: npc.phaseOffset });
        continue;
      }
    } else if (npc.behaviorOverride === 'flee') {
      npc.targetNode = pickFarthestNodeFrom(playerX, playerZ, npc.currentNode);
    } else if (npc.behaviorOverride === 'patrol') {
      if (Math.hypot(SCHOOL_NAV_NODES[npc.targetNode].x - npc.x, SCHOOL_NAV_NODES[npc.targetNode].z - npc.z) < 0.65) {
        npc.patrolIdx = (npc.patrolIdx + 1) % GUARD_PATROL_ROUTE.length;
        npc.targetNode = GUARD_PATROL_ROUTE[npc.patrolIdx];
      }
    } else if (npc.state === 'boss_chase') {
      npc.targetNode = findNearestNavNode(playerX, playerZ);
    } else if (npc.state === 'panic_flee') {
      npc.targetNode = pickFarthestNodeFrom(playerX, playerZ, npc.currentNode);
    }

    const goalNode = SCHOOL_NAV_NODES[npc.targetNode];
    const distToGoal = Math.hypot(goalNode.x - npc.x, goalNode.z - npc.z);
    if (distToGoal < 0.65 && (!npc.behaviorOverride || npc.behaviorOverride === 'default')) {
      if (npc.state === 'patrol') {
        npc.patrolIdx = (npc.patrolIdx + 1) % GUARD_PATROL_ROUTE.length;
        npc.targetNode = GUARD_PATROL_ROUTE[npc.patrolIdx];
        npc.pauseTimer = 0.55;
      } else if (npc.state === 'walk') {
        const neighbors = SCHOOL_NAV_NODES[npc.currentNode].neighbors;
        const randomNext = Math.floor(Math.random() * SCHOOL_NAV_NODES.length);
        npc.targetNode =
          randomNext !== npc.currentNode ? randomNext : neighbors[0] ?? npc.currentNode;
        npc.pauseTimer = 1.0 + Math.random() * 1.4;
      } else if (npc.state === 'panic_flee') {
        npc.targetNode = pickFarthestNodeFrom(playerX, playerZ, npc.currentNode);
      }
    }

    let dx: number;
    let dz: number;
    if ((npc.state === 'boss_chase' || npc.behaviorOverride === 'follow') && npc.currentNode === npc.targetNode) {
      dx = playerX - npc.x;
      dz = playerZ - npc.z;
    } else {
      const nextHopIdx = findNextHopBfs(npc.currentNode, npc.targetNode);
      const hop = SCHOOL_NAV_NODES[nextHopIdx];
      dx = hop.x - npc.x;
      dz = hop.z - npc.z;
    }
    const hopDist = Math.hypot(dx, dz) || 1;
    const baseSpeed =
      npc.behaviorOverride === 'flee'
        ? 3.85
        : npc.behaviorOverride === 'follow'
          ? 3.1
          : npc.state === 'boss_chase'
            ? 3.35
            : npc.state === 'panic_flee'
              ? 4.05
              : npc.role === 'guard'
                ? 2.45
                : 1.95;
    const speed = baseSpeed * (npc.speedMultiplier ?? 1);

    const stepX = (dx / hopDist) * speed * dt;
    const stepZ = (dz / hopDist) * speed * dt;
    const moved = moveNpcWithCollisions(npc.x, npc.z, stepX, stepZ, colliders);
    npc.x = moved.x;
    npc.z = moved.z;
    npc.rig.root.position.set(npc.x, 0, npc.z);

    const targetYaw = Math.atan2(dx, dz);
    const yawDiff = Math.atan2(Math.sin(targetYaw - npc.yaw), Math.cos(targetYaw - npc.yaw));
    npc.yaw += yawDiff * Math.min(1, dt * 8);
    npc.rig.root.rotation.y = npc.yaw;

    // Anti-stuck safeguard
    npc.stuckTimer += dt;
    if (npc.stuckTimer >= 0.75) {
      const displaced = Math.hypot(npc.x - npc.lastCheckX, npc.z - npc.lastCheckZ);
      npc.lastCheckX = npc.x;
      npc.lastCheckZ = npc.z;
      npc.stuckTimer = 0;
      if (displaced < 0.14) {
        const nbs = SCHOOL_NAV_NODES[npc.currentNode].neighbors;
        npc.targetNode = nbs[Math.floor(Math.random() * nbs.length)] ?? 2;
      }
    }

    const animState =
      npc.state === 'panic_flee' || npc.state === 'boss_chase' || npc.behaviorOverride === 'flee'
        ? 'hunting'
        : 'walking';
    npc.rig.update(totalTime, dt, animState, {
      nervousBreathing: npc.state === 'panic_flee',
      phaseOffset: npc.phaseOffset,
    });
  }

  return events;
}
