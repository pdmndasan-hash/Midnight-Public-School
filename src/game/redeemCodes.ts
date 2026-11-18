import { CampaignSaveData, RedeemCodeId } from '../types/game';

const CAMPAIGN_SAVE_KEY = 'mps_campaign_save_v1';

export interface RedeemCodeMetadata {
  code: RedeemCodeId;
  title: string;
  lines: string[];
  accent: 'red' | 'amber' | 'violet' | 'cyan' | 'gold';
  singleActivationToggle?: boolean;
}

export const REDEEM_CODE_REGISTRY: Record<RedeemCodeId, RedeemCodeMetadata> = {
  '6754': {
    code: '6754',
    title: 'SHIFT 5 ENDING',
    lines: ['CODE REDEEMED SUCCESSFULLY!', 'SHIFT 5 ENDING UNLOCKED!'],
    accent: 'red',
  },
  STPGY: {
    code: 'STPGY',
    title: 'ANOMALY MODE',
    lines: ['ANOMALY MODE UNLOCKED!', 'WELCOME TO THE DARK SIDE.'],
    accent: 'red',
  },
  PUPPET777: {
    code: 'PUPPET777',
    title: 'NPC MIND CONTROL',
    lines: ['MIND CONTROL UNLOCKED!', 'AIM AT AN NPC & PRESS [E] TO POSSESS IN ANOMALY MODE.'],
    accent: 'violet',
    singleActivationToggle: true,
  },
  IMMORTAL999: {
    code: 'IMMORTAL999',
    title: 'IMMORTALITY',
    lines: ['IMMORTALITY UNLOCKED!', 'SUPERNATURAL PROTECTION ACTIVE ACROSS SHIFTS & POSSESSION.'],
    accent: 'cyan',
    singleActivationToggle: true,
  },
  OWNER2026: {
    code: 'OWNER2026',
    title: 'ULTIMATE OWNER MODE',
    lines: ['OWNER MODE ACTIVATED 👑', 'ALL OWNER POWERS UNLOCKED!'],
    accent: 'gold',
    singleActivationToggle: true,
  },
};

export function normalizeRedeemCode(raw: string): RedeemCodeId | null {
  const cleaned = raw.trim().toUpperCase();
  if (cleaned === '6754') return '6754';
  if (cleaned === 'STPGY') return 'STPGY';
  if (cleaned === 'PUPPET777') return 'PUPPET777';
  if (cleaned === 'IMMORTAL999') return 'IMMORTAL999';
  if (cleaned === 'OWNER2026') return 'OWNER2026';
  return null;
}

export function loadCampaignSave(): CampaignSaveData {
  const fallback: CampaignSaveData = {
    highestDayReached: 1,
    completedCampaign: false,
    totalFakesStopped: 0,
    shift6Completed: false,
    redeemedCodes: [],
  };
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_SAVE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CampaignSaveData>;
    const validCodes = Array.isArray(parsed.redeemedCodes)
      ? parsed.redeemedCodes.filter((c): c is RedeemCodeId => {
          const norm = normalizeRedeemCode(String(c));
          return norm !== null && norm !== 'OWNER2026';
        })
      : [];
    return {
      highestDayReached: Math.max(1, Math.min(5, Number(parsed.highestDayReached) || 1)),
      completedCampaign: Boolean(parsed.completedCampaign),
      totalFakesStopped: Math.max(0, Number(parsed.totalFakesStopped) || 0),
      shift6Completed: Boolean(parsed.shift6Completed),
      redeemedCodes: Array.from(new Set(validCodes)),
    };
  } catch {
    return fallback;
  }
}

export function saveCampaignProgress(data: CampaignSaveData): void {
  try {
    const sanitized: CampaignSaveData = {
      ...data,
      highestDayReached: Math.max(1, Math.min(5, Number(data.highestDayReached) || 1)),
      redeemedCodes: Array.from(new Set(data.redeemedCodes.filter((c) => c !== 'OWNER2026'))),
    };
    window.localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore storage quota or restricted iframe storage errors
  }
}
