import React, { useEffect, useRef } from 'react';
import { FastForward, Volume2, VolumeX } from 'lucide-react';

interface IntroOverlayProps {
  caption: string;
  progress: number;
  muted: boolean;
  onSpeakLine: (line: string) => void;
  onStopSpeech: () => void;
  onSkip: () => void;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({
  caption,
  progress,
  muted,
  onSpeakLine,
  onStopSpeech,
  onSkip,
}) => {
  const lastSpokenRef = useRef<string>('');
  const isReporterSpeaking = caption.startsWith('"') && caption.endsWith('"');

  useEffect(() => {
    if (!isReporterSpeaking || muted) {
      lastSpokenRef.current = '';
      onStopSpeech();
      return;
    }

    const cleanLine = caption.slice(1, -1).trim();
    if (cleanLine && lastSpokenRef.current !== cleanLine) {
      lastSpokenRef.current = cleanLine;
      onSpeakLine(cleanLine);
    }
  }, [caption, isReporterSpeaking, muted, onSpeakLine, onStopSpeech]);

  useEffect(() => {
    return () => {
      onStopSpeech();
    };
  }, [onStopSpeech]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono-tabular text-xs tracking-wider text-zinc-400">
            WBNL NIGHTLY BULLETIN · 00:00 AM
          </div>
          {isReporterSpeaking && (
            <div className="inline-flex items-center gap-1.5 rounded border border-red-900/60 bg-red-950/70 px-2.5 py-0.5 font-mono-tabular text-[10px] font-semibold tracking-wider text-red-200">
              {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              <span>{muted ? 'ANCHOR AUDIO MUTED' : 'ANCHOR VOICEOVER LIVE'}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onStopSpeech();
            onSkip();
          }}
          className="pointer-events-auto inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-950/90 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-400 whitespace-nowrap shrink-0"
        >
          <span>Skip Intro</span>
          <FastForward className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Bottom Broadcast Captions & Progress */}
      <div className="mx-auto w-full max-w-2xl">
        {caption && (
          <div className="mb-4 rounded border border-zinc-800 bg-black/85 px-5 py-3.5 text-center text-sm leading-relaxed text-zinc-100 md:text-base">
            {caption}
          </div>
        )}
        <div className="h-1 w-full overflow-hidden rounded bg-zinc-900">
          <div
            className="h-full bg-red-700 transition-transform duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
