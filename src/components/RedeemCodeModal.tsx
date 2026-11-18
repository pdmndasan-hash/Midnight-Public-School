import React, { useEffect, useRef, useState } from 'react';
import { RedeemCodeId } from '../types/game';

export interface RedeemAttemptResult {
  ok: boolean;
  alreadyUnlocked?: boolean;
  code?: RedeemCodeId;
  title?: string;
  lines: string[];
  accent?: 'red' | 'amber' | 'violet' | 'cyan' | 'gold';
}

interface RedeemCodeModalProps {
  onClose: () => void;
  onMenuClick: () => void;
  onRedeemCode: (raw: string) => RedeemAttemptResult;
  onUnlockShift5Ending: () => void;
  onUnlockAnomalyMode: () => void;
  onUnlockOwnerMode: () => void;
}

export const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({
  onClose,
  onMenuClick,
  onRedeemCode,
  onUnlockShift5Ending,
  onUnlockAnomalyMode,
  onUnlockOwnerMode,
}) => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<RedeemAttemptResult | null>(null);
  const [closing, setClosing] = useState(false);
  const [flashCount, setFlashCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockRef.current) {
        e.preventDefault();
        onMenuClick();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onMenuClick]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRef.current || submitting) return;

    const trimmed = code.trim();
    if (!trimmed) {
      setResult({
        ok: false,
        lines: ['Please enter a secret code first.'],
      });
      setFlashCount((n) => n + 1);
      inputRef.current?.focus();
      return;
    }

    const res = onRedeemCode(trimmed);
    setResult(res);

    if (!res.ok) {
      if (!res.alreadyUnlocked) {
        setFlashCount((n) => n + 1);
      } else if (res.code === 'OWNER2026') {
        lockRef.current = true;
        setSubmitting(true);
        fadeTimerRef.current = window.setTimeout(() => setClosing(true), 450);
        timerRef.current = window.setTimeout(() => {
          onClose();
          onUnlockOwnerMode();
        }, 720);
        return;
      }
      inputRef.current?.focus();
      return;
    }

    lockRef.current = true;
    setSubmitting(true);

    const launchDelay = res.code === '6754' || res.code === 'STPGY' || res.code === 'OWNER2026' ? 1050 : 950;
    fadeTimerRef.current = window.setTimeout(() => {
      setClosing(true);
    }, launchDelay - 280);

    timerRef.current = window.setTimeout(() => {
      onClose();
      if (res.code === '6754') {
        onUnlockShift5Ending();
      } else if (res.code === 'STPGY') {
        onUnlockAnomalyMode();
      } else if (res.code === 'OWNER2026') {
        onUnlockOwnerMode();
      }
    }, launchDelay);
  };

  const handleCancel = () => {
    if (lockRef.current || submitting) return;
    onMenuClick();
    onClose();
  };

  const resultToneClass = !result
    ? 'text-zinc-500'
    : !result.ok && !result.alreadyUnlocked
      ? 'text-red-400'
      : result.alreadyUnlocked
        ? 'text-amber-300'
        : result.accent === 'gold'
          ? 'text-amber-300'
          : result.accent === 'cyan'
            ? 'text-cyan-300'
            : result.accent === 'violet'
              ? 'text-purple-300'
              : 'text-emerald-400';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="redeem-modal-title"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/84 p-4 backdrop-blur-[2px] transition-opacity duration-300 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`relative w-full max-w-md overflow-hidden rounded border border-red-900/75 bg-zinc-950 p-6 sm:p-7 shadow-[0_0_52px_rgba(153,27,27,0.38)] transition-transform duration-300 ${
          closing ? 'scale-95' : 'scale-100'
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(185,28,28,0.16),transparent_68%)]"
        />

        {flashCount > 0 && result && !result.ok && !result.alreadyUnlocked && (
          <div
            key={flashCount}
            aria-hidden="true"
            className="animate-redeem-flash pointer-events-none absolute inset-0 rounded border-2 border-red-500/85 bg-red-900/25"
          />
        )}

        <div className="relative z-10">
          <h2
            id="redeem-modal-title"
            className="font-display text-3xl font-bold tracking-wider text-zinc-100"
          >
            REDEEM YOUR CODE
          </h2>
          <p className="mt-2 text-sm text-zinc-300">
            Enter a secret code to unlock a hidden power or special game mode.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <input
                ref={inputRef}
                type="text"
                value={code}
                disabled={submitting}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (result && !result.ok) setResult(null);
                }}
                placeholder="Enter code here..."
                aria-label="Secret redeem code"
                className="font-mono-tabular w-full rounded border border-zinc-800 bg-black/85 px-4 py-3 text-base tracking-widest text-zinc-100 placeholder:text-zinc-500 placeholder:tracking-normal focus:border-red-700 focus:outline-none focus:ring-1 focus:ring-red-700/70 disabled:opacity-60"
              />
            </div>

            <div className="min-h-[3.5rem] rounded border border-zinc-900 bg-black/60 px-3.5 py-2.5 text-xs">
              {result ? (
                <div className={`space-y-1 font-medium tracking-wide ${resultToneClass}`}>
                  {result.lines.map((line, i) => (
                    <p
                      key={line}
                      className={
                        i === 1 && result.code === '6754'
                          ? 'text-red-400'
                          : i === 1 && result.code === 'STPGY'
                            ? 'text-zinc-200'
                            : ''
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500">Awaiting verification code...</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="min-h-[44px] rounded border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold tracking-wide text-zinc-200 transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-zinc-400 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded border border-red-700/80 bg-red-800 px-5 py-2.5 text-sm font-semibold tracking-wide text-white shadow-[0_0_16px_rgba(185,28,28,0.32)] transition-all hover:bg-red-700 hover:shadow-[0_0_22px_rgba(220,38,38,0.5)] focus-visible:outline-2 focus-visible:outline-red-400 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                REDEEM
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
