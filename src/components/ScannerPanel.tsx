import React from 'react';
import { Activity, MessageSquare, ScanLine, X } from 'lucide-react';
import { ArrivalPerson } from '../types/game';

interface ScannerPanelProps {
  arrival: ArrivalPerson;
  scanCompleted: boolean;
  scanProgress: number;
  askedQuestionIdx: number | null;
  onStartScan: () => void;
  onAskQuestion: (idx: 0 | 1 | 2) => void;
  onClose: () => void;
}

const PRESET_QUESTIONS: [string, string, string] = [
  '1. Why are you entering the school tonight?',
  '2. State your full name, class/subject, and ID number.',
  '3. Are you feeling alright? You look unwell.',
];

export const ScannerPanel: React.FC<ScannerPanelProps> = ({
  arrival,
  scanCompleted,
  scanProgress,
  askedQuestionIdx,
  onStartScan,
  onAskQuestion,
  onClose,
}) => {
  const scan = arrival.bodyScan;
  const pct = Math.round(scanProgress * 100);

  return (
    <div className="pointer-events-auto fixed right-5 top-20 z-30 w-[370px] max-w-[calc(100vw-2.5rem)] rounded border border-cyan-900/75 bg-zinc-950/97 p-4 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
        <span className="text-xs font-semibold tracking-wider text-cyan-300">
          BODY SCANNER & INTERVIEW
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Body Scanner"
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scanner Viewport */}
      <div className="relative mt-3 h-48 overflow-hidden rounded border border-cyan-950 bg-[#041015] p-3">
        {!scanCompleted && scanProgress === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ScanLine className="h-8 w-8 text-cyan-500/80" />
            <p className="mt-2 text-xs text-cyan-200/80">Subject inside checkpoint scanner arch.</p>
            <button
              type="button"
              onClick={onStartScan}
              className="mt-3 rounded bg-cyan-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-700"
            >
              Run Body Scan
            </button>
          </div>
        )}

        {!scanCompleted && scanProgress > 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="font-mono-tabular text-xs font-semibold text-cyan-300">
              BIOMETRIC & X-RAY SCAN... {pct}%
            </div>
            <div className="mt-2.5 h-1.5 w-48 overflow-hidden rounded bg-cyan-950">
              <div className="h-full bg-cyan-400" style={{ width: `${pct}%` }} />
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 h-1 bg-cyan-400/70"
              style={{ top: `${pct}%` }}
            />
          </div>
        )}

        {scanCompleted && (
          <div className="grid h-full grid-cols-2 gap-3">
            {/* Skeletal & Hand X-Ray */}
            <div className="flex flex-col items-center justify-center rounded border border-cyan-900/50 bg-[#030b0f] p-1.5">
              <svg viewBox="0 0 100 130" className="h-32 w-full" aria-label="Skeletal scan">
                <circle cx="50" cy="20" r="10.5" fill="none" stroke="#67e8f9" strokeWidth="2" />
                {scan.unnaturalInternal ? (
                  <>
                    <path d="M40 34 L60 76 M60 34 L40 76" stroke="#f87171" strokeWidth="2.4" />
                    <circle cx="50" cy="54" r="13" fill="none" stroke="#f87171" strokeWidth="2" />
                  </>
                ) : (
                  <>
                    <line x1="50" y1="30" x2="50" y2="76" stroke="#67e8f9" strokeWidth="2.2" />
                    {[38, 45, 52, 59].map((ry) => (
                      <line key={ry} x1="37" y1={ry} x2="63" y2={ry} stroke="#67e8f9" strokeWidth="1.9" />
                    ))}
                    {scan.extraBones && (
                      <>
                        <line x1="34" y1="66" x2="66" y2="66" stroke="#f87171" strokeWidth="2.2" />
                        <line x1="50" y1="45" x2="86" y2="85" stroke="#f87171" strokeWidth="2.2" />
                      </>
                    )}
                  </>
                )}
                <line x1="40" y1="76" x2="60" y2="76" stroke="#67e8f9" strokeWidth="2.2" />
                <line x1="41" y1="76" x2="37" y2="116" stroke="#67e8f9" strokeWidth="2.2" />
                <line x1="59" y1="76" x2="63" y2="116" stroke="#67e8f9" strokeWidth="2.2" />
                <line x1="37" y1="38" x2="22" y2="74" stroke="#67e8f9" strokeWidth="2" />
                <line x1="63" y1="38" x2="78" y2="74" stroke="#67e8f9" strokeWidth="2" />
                {/* Right Hand Fingers Detail */}
                {Array.from({ length: scan.extraFingers ? 6 : 5 }).map((_, fi) => (
                  <line
                    key={fi}
                    x1={73 + fi * 2.6}
                    y1={76}
                    x2={74 + fi * 2.8}
                    y2={85}
                    stroke={scan.extraFingers && fi === 5 ? '#f87171' : '#67e8f9'}
                    strokeWidth="1.5"
                  />
                ))}
              </svg>
              <div className="font-mono-tabular text-[10px] text-cyan-300">
                {scan.extraBones
                  ? 'EXTRA BONES'
                  : scan.extraFingers
                    ? 'HAND: 6 DIGITS'
                    : scan.unnaturalInternal
                      ? 'HOLLOW CORE'
                      : 'ANATOMY NORMAL'}
              </div>
            </div>

            {/* Biometric Vitals */}
            <div className="flex flex-col justify-between rounded border border-cyan-900/50 bg-[#030b0f] p-2.5 text-xs">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-cyan-400">
                  <Activity className="h-3 w-3" />
                  <span>VITALS</span>
                </div>
                <div className="mt-2">
                  <div className="text-[10px] text-zinc-400">HEARTBEAT</div>
                  <div
                    className={`font-mono-tabular text-sm font-semibold ${
                      scan.heartbeatBpm === 0 || scan.heartbeatBpm > 150
                        ? 'text-red-400'
                        : 'text-cyan-100'
                    }`}
                  >
                    {scan.heartbeatBpm === 0 ? '0 BPM (NONE)' : `${scan.heartbeatBpm} BPM`}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[10px] text-zinc-400">RESPIRATION</div>
                  <div className="text-[11px] font-medium text-cyan-100">{scan.breathingStatus}</div>
                </div>
              </div>
              <div className="font-mono-tabular text-[10px] text-cyan-500">SCAN COMPLETE</div>
            </div>
          </div>
        )}
      </div>

      {/* 3 Preset Questions */}
      <div className="mt-3 rounded border border-zinc-800 bg-zinc-900/90 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
          <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
          <span>INTERVIEW QUESTIONS</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {PRESET_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onAskQuestion(idx as 0 | 1 | 2)}
              className={`w-full rounded border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                askedQuestionIdx === idx
                  ? 'border-amber-600 bg-amber-950/60 text-amber-100'
                  : 'border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {askedQuestionIdx !== null && (
          <div className="mt-2.5 rounded border border-zinc-700 bg-black/70 p-2.5 text-xs text-zinc-100">
            "{arrival.questionAnswers[askedQuestionIdx]}"
          </div>
        )}
      </div>
    </div>
  );
};
