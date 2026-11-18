import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function configureColorTex(tex: THREE.CanvasTexture, anisotropy: number, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function configureDataTex(tex: THREE.CanvasTexture, anisotropy: number, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export interface SchoolTextureSet {
  wallMap: THREE.CanvasTexture;
  wallBump: THREE.CanvasTexture;
  floorMap: THREE.CanvasTexture;
  floorBump: THREE.CanvasTexture;
  ceilingMap: THREE.CanvasTexture;
  woodMap: THREE.CanvasTexture;
  lockerMap: THREE.CanvasTexture;
  cardboardMap: THREE.CanvasTexture;
  blackboardNormal: THREE.CanvasTexture;
  blackboardAnomaly: THREE.CanvasTexture;
  blackboardHallucinations: THREE.CanvasTexture[];
  noticeNormal: THREE.CanvasTexture;
  noticeAnomaly: THREE.CanvasTexture;
  portraitNormal: THREE.CanvasTexture;
  portraitAnomaly: THREE.CanvasTexture;
  distortedFaceMap: THREE.CanvasTexture;
  dustSprite: THREE.CanvasTexture;
  dispose: () => void;
}

export function createSchoolTextures(maxAnisotropy: number): SchoolTextureSet {
  // 1. Peeling plaster institutional wall + lower wainscoting + grime
  const [wallC, wCtx] = makeCanvas(512, 512);
  const [wallBC, wbCtx] = makeCanvas(512, 512);
  wCtx.fillStyle = '#6c7267';
  wCtx.fillRect(0, 0, 512, 512);
  wbCtx.fillStyle = '#808080';
  wbCtx.fillRect(0, 0, 512, 512);

  // Lower dark green-gray wainscoting
  wCtx.fillStyle = '#3c433e';
  wCtx.fillRect(0, 330, 512, 182);
  wCtx.fillStyle = '#252926';
  wCtx.fillRect(0, 322, 512, 10);

  // Grime & water stains
  for (let i = 0; i < 65; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 14 + Math.random() * 55;
    const g = wCtx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(28, 30, 25, 0.24)');
    g.addColorStop(1, 'rgba(28, 30, 25, 0)');
    wCtx.fillStyle = g;
    wCtx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Peeling paint patches revealing raw plaster
  for (let i = 0; i < 22; i++) {
    const px = Math.random() * 480;
    const py = 40 + Math.random() * 420;
    const pw = 12 + Math.random() * 34;
    const ph = 8 + Math.random() * 24;
    wCtx.fillStyle = '#4f4c45';
    wCtx.fillRect(px, py, pw, ph);
    wCtx.fillStyle = '#8b887d';
    wCtx.fillRect(px + 2, py + 2, pw - 4, ph - 5);
    wbCtx.fillStyle = '#303030';
    wbCtx.fillRect(px, py, pw, ph);
    wbCtx.fillStyle = '#d4d4d4';
    wbCtx.fillRect(px + 1, py + 1, pw - 2, 3);
  }
  // Fine plaster grain
  for (let i = 0; i < 2400; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const v = 100 + Math.floor(Math.random() * 55);
    wbCtx.fillStyle = `rgb(${v},${v},${v})`;
    wbCtx.fillRect(gx, gy, 2, 2);
  }
  const wallMap = configureColorTex(new THREE.CanvasTexture(wallC), maxAnisotropy, 4, 1);
  const wallBump = configureDataTex(new THREE.CanvasTexture(wallBC), maxAnisotropy, 4, 1);

  // 2. Scuffed school linoleum tiles
  const [floorC, fCtx] = makeCanvas(512, 512);
  const [floorBC, fbCtx] = makeCanvas(512, 512);
  const tileSize = 128;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const alt = (r + c) % 2 === 0;
      fCtx.fillStyle = alt ? '#5b5b55' : '#464844';
      fCtx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);

      // Subtle marble flecks
      for (let k = 0; k < 45; k++) {
        fCtx.fillStyle = alt ? 'rgba(220,218,208,0.08)' : 'rgba(20,22,20,0.14)';
        fCtx.fillRect(
          c * tileSize + Math.random() * tileSize,
          r * tileSize + Math.random() * tileSize,
          2 + Math.random() * 7,
          1 + Math.random() * 4,
        );
      }

      // Tile grout seam
      fCtx.strokeStyle = '#252624';
      fCtx.lineWidth = 3;
      fCtx.strokeRect(c * tileSize, r * tileSize, tileSize, tileSize);

      fbCtx.fillStyle = '#9a9a9a';
      fbCtx.fillRect(c * tileSize + 2, r * tileSize + 2, tileSize - 4, tileSize - 4);
      fbCtx.strokeStyle = '#222222';
      fbCtx.lineWidth = 4;
      fbCtx.strokeRect(c * tileSize, r * tileSize, tileSize, tileSize);
    }
  }
  // Scuff marks & dirt streaks
  for (let i = 0; i < 80; i++) {
    fCtx.strokeStyle = 'rgba(18, 18, 16, 0.28)';
    fCtx.lineWidth = 1 + Math.random() * 2.5;
    fCtx.beginPath();
    const sx = Math.random() * 512;
    const sy = Math.random() * 512;
    fCtx.moveTo(sx, sy);
    fCtx.lineTo(sx + (Math.random() - 0.5) * 40, sy + (Math.random() - 0.5) * 40);
    fCtx.stroke();
  }
  const floorMap = configureColorTex(new THREE.CanvasTexture(floorC), maxAnisotropy, 8, 8);
  const floorBump = configureDataTex(new THREE.CanvasTexture(floorBC), maxAnisotropy, 8, 8);

  // 3. Acoustic ceiling grid
  const [ceilC, cCtx] = makeCanvas(512, 512);
  cCtx.fillStyle = '#7b7c74';
  cCtx.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cCtx.strokeStyle = '#40423e';
      cCtx.lineWidth = 4;
      cCtx.strokeRect(c * 128, r * 128, 128, 128);
      if (Math.random() < 0.35) {
        cCtx.fillStyle = 'rgba(42, 38, 30, 0.25)';
        cCtx.fillRect(c * 128 + 8, r * 128 + 8, 50 + Math.random() * 50, 40 + Math.random() * 60);
      }
    }
  }
  for (let i = 0; i < 1800; i++) {
    cCtx.fillStyle = 'rgba(30,30,28,0.32)';
    cCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const ceilingMap = configureColorTex(new THREE.CanvasTexture(ceilC), maxAnisotropy, 6, 6);

  // 4. Worn Oak Wood (desks, doors, trim)
  const [woodC, wdCtx] = makeCanvas(512, 512);
  wdCtx.fillStyle = '#5e432b';
  wdCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 3) {
    const shade = 65 + Math.sin(y * 0.08) * 14 + Math.random() * 12;
    wdCtx.fillStyle = `rgba(${shade + 22}, ${shade}, ${shade - 22}, 0.45)`;
    wdCtx.fillRect(0, y, 512, 2);
  }
  // Desk scratches & ink blotches
  for (let i = 0; i < 40; i++) {
    wdCtx.strokeStyle = 'rgba(32, 20, 12, 0.45)';
    wdCtx.beginPath();
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    wdCtx.moveTo(x, y);
    wdCtx.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 16);
    wdCtx.stroke();
  }
  const woodMap = configureColorTex(new THREE.CanvasTexture(woodC), maxAnisotropy);

  // 5. Scratched Metal Locker
  const [lockC, lCtx] = makeCanvas(256, 512);
  lCtx.fillStyle = '#404c54';
  lCtx.fillRect(0, 0, 256, 512);
  lCtx.strokeStyle = '#252d33';
  lCtx.lineWidth = 6;
  lCtx.strokeRect(4, 4, 248, 504);
  // Top & bottom louver vents
  lCtx.fillStyle = '#1b2024';
  for (let v = 0; v < 5; v++) {
    lCtx.fillRect(48, 42 + v * 14, 160, 6);
    lCtx.fillRect(48, 405 + v * 14, 160, 6);
  }
  // Scratches & rust spots
  for (let i = 0; i < 45; i++) {
    lCtx.strokeStyle = Math.random() > 0.3 ? 'rgba(180,190,198,0.28)' : 'rgba(95,55,30,0.35)';
    lCtx.lineWidth = 1;
    lCtx.beginPath();
    const sx = Math.random() * 256;
    const sy = Math.random() * 512;
    lCtx.moveTo(sx, sy);
    lCtx.lineTo(sx + (Math.random() - 0.5) * 55, sy + (Math.random() - 0.5) * 65);
    lCtx.stroke();
  }
  const lockerMap = configureColorTex(new THREE.CanvasTexture(lockC), maxAnisotropy);

  // 6. Corrugated Cardboard
  const [boxC, bCtx] = makeCanvas(256, 256);
  bCtx.fillStyle = '#7b5e3f';
  bCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    bCtx.fillStyle = y % 8 === 0 ? 'rgba(45,30,15,0.16)' : 'rgba(200,170,130,0.08)';
    bCtx.fillRect(0, y, 256, 2);
  }
  bCtx.strokeStyle = '#4a3621';
  bCtx.lineWidth = 4;
  bCtx.strokeRect(2, 2, 252, 252);
  const cardboardMap = configureColorTex(new THREE.CanvasTexture(boxC), maxAnisotropy);

  // 7. Blackboard Normal vs Anomaly
  const drawBlackboard = (anomaly: boolean) => {
    const [bbC, ctx] = makeCanvas(1024, 512);
    ctx.fillStyle = '#1b2b22';
    ctx.fillRect(0, 0, 1024, 512);
    // Chalk dust haze
    for (let i = 0; i < 40; i++) {
      const gx = Math.random() * 1024;
      const gy = Math.random() * 512;
      const g = ctx.createRadialGradient(gx, gy, 5, gx, gy, 95);
      g.addColorStop(0, 'rgba(220,230,220,0.06)');
      g.addColorStop(1, 'rgba(220,230,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - 95, gy - 95, 190, 190);
    }
    ctx.font = 'bold 34px "Public Sans", sans-serif';
    ctx.fillStyle = 'rgba(232, 236, 228, 0.85)';
    if (!anomaly) {
      ctx.fillText('MIDNIGHT PUBLIC SCHOOL — ROOM 204', 70, 95);
      ctx.font = '26px "Public Sans", sans-serif';
      ctx.fillStyle = 'rgba(218, 224, 215, 0.78)';
      ctx.fillText('Algebra Review: Chapters 4 - 6', 70, 170);
      ctx.fillText('Quiet Study Period: 11:00 PM - 12:00 AM', 70, 225);
      ctx.fillText('Lock all classroom cabinets before leaving.', 70, 280);
      ctx.font = '22px "IBM Plex Mono", monospace';
      ctx.fillText('x² + 5x - 14 = 0   =>   (x + 7)(x - 2) = 0', 70, 365);
    } else {
      ctx.fillText('MIDNIGHT PUBLIC SCHOOL — ROOM 204', 70, 95);
      ctx.font = 'bold 46px "Oswald", sans-serif';
      ctx.fillStyle = 'rgba(210, 60, 52, 0.92)';
      ctx.fillText('IT IS STANDING BEHIND YOU', 70, 210);
      ctx.font = '32px "Public Sans", sans-serif';
      ctx.fillStyle = 'rgba(235, 225, 220, 0.88)';
      ctx.fillText('DO NOT TURN AROUND. REPORT IMMEDIATELY.', 70, 285);
      ctx.fillText('IT KNOWS YOU ARE LOOKING.', 70, 355);
    }
    return configureColorTex(new THREE.CanvasTexture(bbC), maxAnisotropy);
  };

  const drawBlackboardHallucination = (
    headline: string,
    line1: string,
    line2: string,
  ): THREE.CanvasTexture => {
    const [bbC, ctx] = makeCanvas(1024, 512);
    ctx.fillStyle = '#17231c';
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 45; i++) {
      const gx = Math.random() * 1024;
      const gy = Math.random() * 512;
      const g = ctx.createRadialGradient(gx, gy, 5, gx, gy, 105);
      g.addColorStop(0, i % 5 === 0 ? 'rgba(170, 38, 36, 0.14)' : 'rgba(220, 230, 220, 0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - 105, gy - 105, 210, 210);
    }
    ctx.font = 'bold 56px "Oswald", sans-serif';
    ctx.fillStyle = 'rgba(232, 78, 70, 0.94)';
    ctx.fillText(headline, 72, 165);
    ctx.font = 'bold 36px "Public Sans", sans-serif';
    ctx.fillStyle = 'rgba(238, 234, 226, 0.9)';
    ctx.fillText(line1, 72, 265);
    ctx.fillText(line2, 72, 335);
    ctx.font = '24px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(210, 198, 190, 0.65)';
    ctx.fillText('00:00 · IT IS INSIDE THE SCHOOL · DO NOT BLINK', 72, 428);
    return configureColorTex(new THREE.CanvasTexture(bbC), maxAnisotropy);
  };

  // 8. Notice Board Normal vs Anomaly
  const drawNoticeBoard = (anomaly: boolean) => {
    const [nbC, ctx] = makeCanvas(512, 384);
    ctx.fillStyle = '#6c4d32';
    ctx.fillRect(0, 0, 512, 384);
    const drawPaper = (x: number, y: number, w: number, h: number, title: string, body: string, red = false) => {
      ctx.fillStyle = red ? '#dfd0cc' : '#dcd8cc';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = red ? '#8b1e1a' : '#25292c';
      ctx.font = 'bold 18px "Oswald", sans-serif';
      ctx.fillText(title, x + 12, y + 32);
      ctx.font = '14px "Public Sans", sans-serif';
      ctx.fillText(body, x + 12, y + 60);
      // Pin
      ctx.fillStyle = '#992222';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 10, 4, 0, Math.PI * 2);
      ctx.fill();
    };
    if (!anomaly) {
      drawPaper(26, 28, 210, 145, 'FIRE DRILL PROCEDURE', 'Exit via West Stairwell');
      drawPaper(265, 34, 215, 140, 'SCIENCE FAIR', 'Gymnasium · Friday 6 PM');
      drawPaper(38, 198, 200, 150, 'LOST & FOUND', 'Claim items at Main Office');
      drawPaper(270, 202, 210, 146, 'NIGHT CUSTODIAN', 'Lights out at 12:15 AM');
    } else {
      drawPaper(26, 28, 210, 145, 'DO NOT BLINK', 'Stay inside the box', true);
      drawPaper(265, 34, 215, 140, 'MISSING: EVERYONE', 'Last seen in Corridor', true);
      drawPaper(38, 198, 200, 150, 'IT HEARS THE TASER', 'Only use in Check Room', true);
      drawPaper(270, 202, 210, 146, 'LOOK AT THE WALL', 'Wrong shadows are real', true);
    }
    return configureColorTex(new THREE.CanvasTexture(nbC), maxAnisotropy);
  };

  // 9. Portrait Normal vs Anomaly
  const drawPortrait = (anomaly: boolean) => {
    const [pC, ctx] = makeCanvas(256, 320);
    ctx.fillStyle = '#1d1c19';
    ctx.fillRect(0, 0, 256, 320);
    // Vignette
    const grad = ctx.createRadialGradient(128, 130, 18, 128, 150, 130);
    grad.addColorStop(0, '#5a5346');
    grad.addColorStop(1, '#141311');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 320);

    // Coat & shoulders
    ctx.fillStyle = '#151618';
    ctx.beginPath();
    ctx.moveTo(45, 320);
    ctx.quadraticCurveTo(128, 190, 211, 320);
    ctx.fill();

    // Head silhouette partially lit
    ctx.fillStyle = '#756857';
    ctx.beginPath();
    ctx.ellipse(128, 126, 38, 49, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hair
    ctx.fillStyle = '#24211e';
    ctx.beginPath();
    ctx.ellipse(128, 92, 40, 24, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Heavy shadow across top of face
    const shadow = ctx.createLinearGradient(0, 82, 0, 150);
    shadow.addColorStop(0, 'rgba(12, 12, 12, 0.85)');
    shadow.addColorStop(1, 'rgba(12, 12, 12, 0.05)');
    ctx.fillStyle = shadow;
    ctx.fillRect(88, 82, 80, 70);

    if (anomaly) {
      // Hollow pitch-black eye sockets & eerie pale pinpoints
      ctx.fillStyle = '#050505';
      ctx.beginPath();
      ctx.ellipse(112, 120, 9, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(144, 120, 9, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e5ded2';
      ctx.fillRect(111, 119, 3, 3);
      ctx.fillRect(143, 119, 3, 3);
      // Elongated dark mouth
      ctx.fillStyle = '#080606';
      ctx.beginPath();
      ctx.ellipse(128, 154, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Subtle normal shadow eyes
      ctx.fillStyle = '#1f1c18';
      ctx.fillRect(108, 118, 9, 4);
      ctx.fillRect(139, 118, 9, 4);
      ctx.fillRect(118, 152, 20, 3);
    }

    ctx.strokeStyle = '#3d2f1f';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 242, 306);
    return configureColorTex(new THREE.CanvasTexture(pC), maxAnisotropy);
  };

  // 10. Soft Dust Sprite
  const [dustC, dCtx] = makeCanvas(64, 64);
  const dGrad = dCtx.createRadialGradient(32, 32, 1, 32, 32, 30);
  dGrad.addColorStop(0, 'rgba(235, 240, 230, 0.9)');
  dGrad.addColorStop(0.4, 'rgba(215, 225, 215, 0.35)');
  dGrad.addColorStop(1, 'rgba(215, 225, 215, 0)');
  dCtx.fillStyle = dGrad;
  dCtx.fillRect(0, 0, 64, 64);
  const dustSprite = configureColorTex(new THREE.CanvasTexture(dustC), 1);

  // 10b. Distorted Pale Face for Critical-Sanity Corridor Hallucinations
  const drawDistortedFace = (): THREE.CanvasTexture => {
    const [fc, ctx] = makeCanvas(256, 320);
    ctx.clearRect(0, 0, 256, 320);

    const outerFade = ctx.createRadialGradient(128, 152, 28, 128, 156, 126);
    outerFade.addColorStop(0, 'rgba(214, 212, 206, 0.92)');
    outerFade.addColorStop(0.55, 'rgba(110, 108, 104, 0.72)');
    outerFade.addColorStop(0.84, 'rgba(18, 20, 22, 0.45)');
    outerFade.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = outerFade;
    ctx.beginPath();
    ctx.ellipse(128, 154, 78, 118, 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Stretched hollow eyes
    ctx.fillStyle = 'rgba(4, 4, 6, 0.96)';
    ctx.beginPath();
    ctx.ellipse(94, 126, 17, 26, -0.14, 0, Math.PI * 2);
    ctx.ellipse(162, 122, 18, 28, 0.16, 0, Math.PI * 2);
    ctx.fill();

    // Unsettling pale pinpoint pupils
    ctx.fillStyle = 'rgba(244, 240, 232, 0.9)';
    ctx.fillRect(93, 124, 4, 5);
    ctx.fillRect(160, 120, 4, 5);

    // Gaping warped mouth
    ctx.fillStyle = 'rgba(6, 4, 5, 0.97)';
    ctx.beginPath();
    ctx.ellipse(128, 214, 28, 44, -0.06, 0, Math.PI * 2);
    ctx.fill();

    // Scanline static streaks across face
    for (let y = 24; y < 296; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.07)';
      ctx.fillRect(22, y, 212, 2);
    }

    return configureColorTex(new THREE.CanvasTexture(fc), maxAnisotropy);
  };

  const blackboardNormal = drawBlackboard(false);
  const blackboardAnomaly = drawBlackboard(true);
  const blackboardHallucinations = [
    blackboardAnomaly,
    drawBlackboardHallucination(
      'YOU LET ONE INSIDE',
      'COUNT THE EMPTY DESKS AGAIN.',
      'ONE OF THEM IS NOT BLINKING.',
    ),
    drawBlackboardHallucination(
      'LOOK AT THE CORRIDOR',
      'DO NOT TRUST THE FACE IN THE HALL.',
      'IT HEARS YOUR HEARTBEAT.',
    ),
  ];
  const noticeNormal = drawNoticeBoard(false);
  const noticeAnomaly = drawNoticeBoard(true);
  const portraitNormal = drawPortrait(false);
  const portraitAnomaly = drawPortrait(true);
  const distortedFaceMap = drawDistortedFace();

  return {
    wallMap,
    wallBump,
    floorMap,
    floorBump,
    ceilingMap,
    woodMap,
    lockerMap,
    cardboardMap,
    blackboardNormal,
    blackboardAnomaly,
    blackboardHallucinations,
    noticeNormal,
    noticeAnomaly,
    portraitNormal,
    portraitAnomaly,
    distortedFaceMap,
    dustSprite,
    dispose: () => {
      wallMap.dispose();
      wallBump.dispose();
      floorMap.dispose();
      floorBump.dispose();
      ceilingMap.dispose();
      woodMap.dispose();
      lockerMap.dispose();
      cardboardMap.dispose();
      blackboardNormal.dispose();
      blackboardHallucinations.forEach((tex) => tex.dispose());
      noticeNormal.dispose();
      noticeAnomaly.dispose();
      portraitNormal.dispose();
      portraitAnomaly.dispose();
      distortedFaceMap.dispose();
      dustSprite.dispose();
    },
  };
}

export function renderTvBroadcastCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
): void {
  // Phase 1: 0 - 2.2s TV static turning on
  // Phase 2: 2.2 - 13.0s News Anchor warning (face shadowed)
  // Phase 3: 13.0 - 15.2s Glitch showing shadowy corridor entity
  // Phase 4: 15.2 - 16.5s Power off horizontal collapse
  ctx.fillStyle = '#090b0e';
  ctx.fillRect(0, 0, w, h);

  if (elapsed >= 15.3) {
    // CRT Collapse line
    const p = Math.min(1, (elapsed - 15.3) / 0.55);
    const barH = Math.max(2, (1 - p) * 24);
    const barW = Math.max(0, (1 - Math.max(0, p - 0.5) * 2) * w);
    ctx.fillStyle = '#d7e8ff';
    ctx.fillRect((w - barW) / 2, h / 2 - barH / 2, barW, barH);
    return;
  }

  if (elapsed < 2.1) {
    // Snow static
    for (let i = 0; i < 950; i++) {
      const v = Math.floor(Math.random() * 200);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 5, 3);
    }
    ctx.fillStyle = 'rgba(20, 26, 34, 0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#cdd6df';
    ctx.font = 'bold 20px "IBM Plex Mono", monospace';
    ctx.fillText('CH 03 · SIGNAL ACQUIRING...', 24, 38);
  } else if (elapsed >= 13.0 && elapsed < 15.3) {
    // Violent glitch frame showing shadowy figure in a school corridor!
    ctx.fillStyle = '#121614';
    ctx.fillRect(0, 0, w, h);

    // Perspective school corridor walls
    ctx.strokeStyle = '#2d3530';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.34, h * 0.32);
    ctx.lineTo(w * 0.34, h * 0.68);
    ctx.lineTo(0, h);
    ctx.moveTo(w, 0);
    ctx.lineTo(w * 0.66, h * 0.32);
    ctx.lineTo(w * 0.66, h * 0.68);
    ctx.lineTo(w, h);
    ctx.stroke();

    // Flickering overhead strip
    ctx.fillStyle = Math.random() > 0.35 ? 'rgba(210, 235, 225, 0.5)' : 'rgba(180, 40, 40, 0.45)';
    ctx.fillRect(w * 0.43, h * 0.14, w * 0.14, 10);

    // Tall shadowy silhouette in corridor center
    const jitterX = (Math.random() - 0.5) * 18;
    const jitterY = (Math.random() - 0.5) * 8;
    ctx.fillStyle = '#040506';
    ctx.beginPath();
    ctx.ellipse(w / 2 + jitterX, h * 0.43 + jitterY, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w / 2 - 34 + jitterX, h * 0.46 + jitterY, 68, h * 0.34);

    // Faint glowing pinpoints in deep shadow
    ctx.fillStyle = 'rgba(235, 220, 200, 0.72)';
    ctx.fillRect(w / 2 - 10 + jitterX, h * 0.42 + jitterY, 4, 4);
    ctx.fillRect(w / 2 + 6 + jitterX, h * 0.42 + jitterY, 4, 4);

    // Chromatic glitch bands
    for (let i = 0; i < 8; i++) {
      const gy = Math.random() * h;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(220, 40, 40, 0.35)' : 'rgba(180, 235, 255, 0.28)';
      ctx.fillRect(0, gy, w, 4 + Math.random() * 10);
    }
  } else {
    // News Broadcast Studio (dim low-key lighting, anchor's upper face veiled in shadow)
    const studioGrad = ctx.createLinearGradient(0, 0, 0, h);
    studioGrad.addColorStop(0, '#101824');
    studioGrad.addColorStop(1, '#090d14');
    ctx.fillStyle = studioGrad;
    ctx.fillRect(0, 0, w, h);

    // Studio backdrop screen
    ctx.fillStyle = '#182436';
    ctx.fillRect(28, 32, w - 56, h - 115);
    ctx.strokeStyle = '#314563';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 32, w - 56, h - 115);

    // Anchor suit & tie
    ctx.fillStyle = '#14171c';
    ctx.beginPath();
    ctx.moveTo(w * 0.29, h - 75);
    ctx.quadraticCurveTo(w * 0.5, h * 0.46, w * 0.71, h - 75);
    ctx.fill();

    // White collar + tie
    ctx.fillStyle = '#b9bec7';
    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.57);
    ctx.lineTo(w * 0.55, h * 0.57);
    ctx.lineTo(w * 0.5, h * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6f2323';
    ctx.fillRect(w * 0.492, h * 0.58, 8, 52);

    // Anchor head (jaw lit, eyes hidden by dramatic top shadow)
    ctx.fillStyle = '#927f70';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.43, 30, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hair
    ctx.fillStyle = '#1a1b1f';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.34, 33, 20, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Dramatic shadow over upper face
    const faceShadow = ctx.createLinearGradient(0, h * 0.34, 0, h * 0.48);
    faceShadow.addColorStop(0, 'rgba(6, 8, 12, 0.96)');
    faceShadow.addColorStop(0.65, 'rgba(6, 8, 12, 0.78)');
    faceShadow.addColorStop(1, 'rgba(6, 8, 12, 0.0)');
    ctx.fillStyle = faceShadow;
    ctx.fillRect(w * 0.42, h * 0.33, w * 0.16, h * 0.17);

    // Animated mouth speaking
    const talk = Math.abs(Math.sin(elapsed * 11)) * 5;
    ctx.fillStyle = '#2b1b19';
    ctx.fillRect(w * 0.478, h * 0.49, 22, 2 + talk);

    // News desk foreground
    ctx.fillStyle = '#1e2736';
    ctx.fillRect(0, h - 82, w, 46);

    // Breaking News Banner & Ticker
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px "Oswald", sans-serif';
    ctx.fillText('WBNL NIGHTLY BULLETIN  ·  00:00 AM  ·  EMERGENCY ADVISORY', 16, 23);

    ctx.fillStyle = '#11161f';
    ctx.fillRect(0, h - 42, w, 42);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px "IBM Plex Mono", monospace';
    const ticker = 'STAY OUT OF SCHOOL BUILDINGS AFTER MIDNIGHT  ·  ANOMALIES ACTIVE  ·  HIDE & REMAIN STILL  ·  ';
    const offset = (elapsed * 95) % 520;
    ctx.fillText(ticker + ticker, 16 - offset, h - 16);
  }

  // CRT Scanlines overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 2);
  }
}
