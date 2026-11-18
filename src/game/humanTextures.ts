import * as THREE from 'three';
import { HumanAppearance } from '../types/game';

export interface HumanSkinTextures {
  skinBump: THREE.CanvasTexture;
  irisMap: THREE.CanvasTexture;
  fabricBump: THREE.CanvasTexture;
  dispose: () => void;
}

export function createHumanRealismTextures(maxAnisotropy: number): HumanSkinTextures {
  // 1. Fine Skin Pore & Micro-Imperfection Bump Map
  const skinC = document.createElement('canvas');
  skinC.width = 256;
  skinC.height = 256;
  const sCtx = skinC.getContext('2d')!;
  sCtx.fillStyle = '#808080';
  sCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.random() > 0.5 ? 105 : 148;
    sCtx.fillStyle = `rgb(${v},${v},${v})`;
    sCtx.fillRect(x, y, 1.5, 1.5);
  }
  const skinBump = new THREE.CanvasTexture(skinC);
  skinBump.colorSpace = THREE.NoColorSpace;
  skinBump.wrapS = THREE.RepeatWrapping;
  skinBump.wrapT = THREE.RepeatWrapping;
  skinBump.repeat.set(3, 3);
  skinBump.anisotropy = maxAnisotropy;

  // 2. Realistic Iris & Sclera Texture
  const eyeC = document.createElement('canvas');
  eyeC.width = 128;
  eyeC.height = 128;
  const eCtx = eyeC.getContext('2d')!;
  eCtx.fillStyle = '#e8e4dc';
  eCtx.fillRect(0, 0, 128, 128);
  // Subtle sclera veins
  eCtx.strokeStyle = 'rgba(175, 80, 80, 0.16)';
  eCtx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    eCtx.beginPath();
    eCtx.moveTo(i < 4 ? 0 : 128, 35 + Math.random() * 58);
    eCtx.lineTo(64 + (Math.random() - 0.5) * 20, 64 + (Math.random() - 0.5) * 20);
    eCtx.stroke();
  }
  // Iris outer limbal ring
  eCtx.fillStyle = '#1b1d21';
  eCtx.beginPath();
  eCtx.arc(64, 64, 28, 0, Math.PI * 2);
  eCtx.fill();
  // Iris color ring
  eCtx.fillStyle = '#473626';
  eCtx.beginPath();
  eCtx.arc(64, 64, 25, 0, Math.PI * 2);
  eCtx.fill();
  // Iris radial fibers
  for (let a = 0; a < 36; a++) {
    const ang = (a / 36) * Math.PI * 2;
    eCtx.strokeStyle = a % 2 === 0 ? 'rgba(145,115,80,0.45)' : 'rgba(30,22,16,0.45)';
    eCtx.beginPath();
    eCtx.moveTo(64 + Math.cos(ang) * 10, 64 + Math.sin(ang) * 10);
    eCtx.lineTo(64 + Math.cos(ang) * 24, 64 + Math.sin(ang) * 24);
    eCtx.stroke();
  }
  // Pupil
  eCtx.fillStyle = '#070709';
  eCtx.beginPath();
  eCtx.arc(64, 64, 11, 0, Math.PI * 2);
  eCtx.fill();
  // Wet specular catchlight
  eCtx.fillStyle = 'rgba(255,255,255,0.88)';
  eCtx.beginPath();
  eCtx.arc(57, 56, 3.5, 0, Math.PI * 2);
  eCtx.fill();

  const irisMap = new THREE.CanvasTexture(eyeC);
  irisMap.colorSpace = THREE.SRGBColorSpace;
  irisMap.anisotropy = maxAnisotropy;

  // 3. Woven Uniform Fabric & Folds Bump Map
  const fabC = document.createElement('canvas');
  fabC.width = 256;
  fabC.height = 256;
  const fCtx = fabC.getContext('2d')!;
  fCtx.fillStyle = '#808080';
  fCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    fCtx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    fCtx.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 2) {
    fCtx.fillStyle = x % 4 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    fCtx.fillRect(x, 0, 1, 256);
  }
  // Soft diagonal drape folds
  for (let i = 0; i < 6; i++) {
    const grad = fCtx.createLinearGradient(0, i * 42, 256, i * 42 + 28);
    grad.addColorStop(0, 'rgba(55,55,55,0.22)');
    grad.addColorStop(0.5, 'rgba(200,200,200,0.22)');
    grad.addColorStop(1, 'rgba(55,55,55,0.22)');
    fCtx.fillStyle = grad;
    fCtx.fillRect(0, i * 42, 256, 28);
  }
  const fabricBump = new THREE.CanvasTexture(fabC);
  fabricBump.colorSpace = THREE.NoColorSpace;
  fabricBump.wrapS = THREE.RepeatWrapping;
  fabricBump.wrapT = THREE.RepeatWrapping;
  fabricBump.repeat.set(2, 2);
  fabricBump.anisotropy = maxAnisotropy;

  return {
    skinBump,
    irisMap,
    fabricBump,
    dispose: () => {
      skinBump.dispose();
      irisMap.dispose();
      fabricBump.dispose();
    },
  };
}

function adjustHex(hex: string, factor: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}

export function drawPhotorealisticPortrait(
  canvas: HTMLCanvasElement,
  app: HumanAppearance,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  // Institutional studio photo backdrop with soft radial falloff
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.08, w * 0.5, h * 0.5, w * 0.78);
  bg.addColorStop(0, '#5a636e');
  bg.addColorStop(1, '#2d333b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Shoulders & Uniform Blazer with fabric fold shadows
  const coatGrad = ctx.createLinearGradient(w * 0.2, h * 0.65, w * 0.8, h);
  coatGrad.addColorStop(0, adjustHex(app.uniformHex, 1.15));
  coatGrad.addColorStop(0.5, app.uniformHex);
  coatGrad.addColorStop(1, adjustHex(app.uniformHex, 0.7));
  ctx.fillStyle = coatGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.04, h);
  ctx.quadraticCurveTo(w * 0.16, h * 0.72, w * 0.36, h * 0.69);
  ctx.lineTo(w * 0.64, h * 0.69);
  ctx.quadraticCurveTo(w * 0.84, h * 0.72, w * 0.96, h);
  ctx.closePath();
  ctx.fill();

  // Shirt & Tie / Collar
  ctx.fillStyle = '#e2e0da';
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.69);
  ctx.lineTo(w * 0.62, h * 0.69);
  ctx.lineTo(w * 0.5, h * 0.94);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = app.tieHex;
  ctx.beginPath();
  ctx.moveTo(w * 0.47, h * 0.74);
  ctx.lineTo(w * 0.53, h * 0.74);
  ctx.lineTo(w * 0.52, h * 0.95);
  ctx.lineTo(w * 0.48, h * 0.95);
  ctx.closePath();
  ctx.fill();

  if (app.scarf) {
    ctx.fillStyle = '#5f2525';
    ctx.fillRect(w * 0.3, h * 0.65, w * 0.4, h * 0.11);
  }

  // Neck with chin cast shadow
  const neckGrad = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.72);
  neckGrad.addColorStop(0, adjustHex(app.skinHex, 0.68));
  neckGrad.addColorStop(1, app.skinHex);
  ctx.fillStyle = neckGrad;
  ctx.fillRect(w * 0.41, h * 0.55, w * 0.18, h * 0.16);

  // Back hair layer (for long hair / bob)
  if (app.hairStyle === 'long_straight' || app.hairStyle === 'wavy_bob') {
    ctx.fillStyle = adjustHex(app.hairHex, 0.85);
    const len = app.hairStyle === 'long_straight' ? h * 0.52 : h * 0.36;
    ctx.beginPath();
    ctx.roundRect(w * 0.23, h * 0.2, w * 0.54, len, 18);
    ctx.fill();
  }

  // Ears
  ctx.fillStyle = adjustHex(app.skinHex, 0.9);
  ctx.beginPath();
  ctx.ellipse(w * 0.285, h * 0.44, w * 0.032, h * 0.058, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.715, h * 0.44, w * 0.032, h * 0.058, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head / Face with realistic 3D directional lighting gradient
  const faceGrad = ctx.createRadialGradient(w * 0.44, h * 0.38, w * 0.04, w * 0.5, h * 0.44, w * 0.26);
  faceGrad.addColorStop(0, adjustHex(app.skinHex, 1.12));
  faceGrad.addColorStop(0.65, app.skinHex);
  faceGrad.addColorStop(1, adjustHex(app.skinHex, 0.76));
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.43, w * 0.21, h * 0.215, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle deterministic pores / freckles / imperfections
  if (app.freckles) {
    ctx.fillStyle = 'rgba(110, 68, 45, 0.48)';
    const freckleOffsets = [
      [-0.12, 0.035], [-0.095, 0.048], [-0.075, 0.032], [-0.11, 0.055], [-0.085, 0.058],
      [-0.06, 0.044], [0.06, 0.044], [0.075, 0.032], [0.095, 0.048], [0.12, 0.035],
      [0.085, 0.058], [0.11, 0.055], [-0.02, 0.03], [0.02, 0.03],
    ];
    for (const [ox, oy] of freckleOffsets) {
      ctx.beginPath();
      ctx.arc(w * (0.5 + ox), h * (0.43 + oy), 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (app.tiredDarkCircles) {
    ctx.fillStyle = 'rgba(42, 32, 48, 0.32)';
    ctx.beginPath();
    ctx.ellipse(w * 0.415, h * 0.425, w * 0.048, h * 0.016, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.585, h * 0.425, w * 0.048, h * 0.016, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brows
  ctx.strokeStyle = adjustHex(app.hairHex, 0.9);
  ctx.lineWidth = Math.max(2, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.375);
  ctx.quadraticCurveTo(w * 0.415, h * 0.36, w * 0.465, h * 0.378);
  ctx.moveTo(w * 0.535, h * 0.378);
  ctx.quadraticCurveTo(w * 0.585, h * 0.36, w * 0.64, h * 0.375);
  ctx.stroke();

  // Realistic Eyes with Sclera, Iris, Pupil, and Moisture Catchlight
  [0.415, 0.585].forEach((ex) => {
    ctx.fillStyle = '#ebe8e2';
    ctx.beginPath();
    ctx.ellipse(w * ex, h * 0.41, w * 0.044, h * 0.021, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = app.eyeHex;
    ctx.beginPath();
    ctx.arc(w * ex, h * 0.41, w * 0.022, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(w * ex, h * 0.41, w * 0.01, 0, Math.PI * 2);
    ctx.fill();

    // Moisture catchlight
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(w * ex - w * 0.007, h * 0.404, w * 0.0045, 0, Math.PI * 2);
    ctx.fill();

    // Upper lash shadow
    ctx.strokeStyle = '#181515';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(w * ex, h * 0.412, w * 0.04, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  });

  // Nose shadow & bridge highlight
  ctx.fillStyle = adjustHex(app.skinHex, 0.8);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.42);
  ctx.lineTo(w * 0.48, h * 0.49);
  ctx.lineTo(w * 0.52, h * 0.49);
  ctx.closePath();
  ctx.fill();

  // Lips
  ctx.fillStyle = adjustHex(app.skinHex, 0.72);
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.545, w * 0.052, h * 0.013, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mustache
  if (app.mustache) {
    ctx.fillStyle = adjustHex(app.hairHex, 0.85);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.503);
    ctx.quadraticCurveTo(w * 0.43, h * 0.498, w * 0.39, h * 0.532);
    ctx.quadraticCurveTo(w * 0.445, h * 0.526, w * 0.5, h * 0.521);
    ctx.quadraticCurveTo(w * 0.555, h * 0.526, w * 0.61, h * 0.532);
    ctx.quadraticCurveTo(w * 0.57, h * 0.498, w * 0.5, h * 0.503);
    ctx.closePath();
    ctx.fill();
  }

  // Glasses
  if (app.glasses) {
    ctx.strokeStyle = '#1b1d22';
    ctx.lineWidth = Math.max(1.8, w * 0.016);
    ctx.strokeRect(w * 0.355, h * 0.382, w * 0.12, h * 0.056);
    ctx.strokeRect(w * 0.525, h * 0.382, w * 0.12, h * 0.056);
    ctx.beginPath();
    ctx.moveTo(w * 0.475, h * 0.408);
    ctx.lineTo(w * 0.525, h * 0.408);
    ctx.stroke();
  }

  // Top Hair Crown & Strands
  if (app.hairStyle === 'bun') {
    ctx.fillStyle = app.hairHex;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.17, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  const hairGrad = ctx.createLinearGradient(w * 0.3, h * 0.18, w * 0.7, h * 0.36);
  hairGrad.addColorStop(0, adjustHex(app.hairHex, 1.2));
  hairGrad.addColorStop(1, adjustHex(app.hairHex, 0.78));
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.27, h * 0.38);
  ctx.quadraticCurveTo(w * 0.28, h * 0.18, w * 0.5, h * 0.185);
  ctx.quadraticCurveTo(w * 0.72, h * 0.18, w * 0.73, h * 0.38);
  ctx.quadraticCurveTo(w * 0.62, h * 0.27, w * 0.5, h * 0.29);
  ctx.quadraticCurveTo(w * 0.38, h * 0.27, w * 0.27, h * 0.38);
  ctx.closePath();
  ctx.fill();

  // Subtle deterministic film grain
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = i >> 2;
    const hash = ((px * 2654435761) >>> 24) / 255 - 0.5;
    const grain = hash * 8;
    d[i] = Math.min(255, Math.max(0, d[i] + grain));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + grain));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + grain));
  }
  ctx.putImageData(imgData, 0, 0);
}
