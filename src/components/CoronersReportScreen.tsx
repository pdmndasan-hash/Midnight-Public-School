import React from 'react';
import { RotateCcw } from 'lucide-react';
import { EscapeCoronerReport } from '../types/game';

interface CoronersReportScreenProps {
  report: EscapeCoronerReport;
  day: number;
  maxDays: number;
  onRetryEscape: () => void;
  onRestart: () => void;
}

function formatSurvivalDuration(seconds: number): string {
  const safe = Math.max(0, seconds);
  if (safe < 60) {
    return `${safe.toFixed(1)}s`;
  }
  const mins = Math.floor(safe / 60);
  const rem = (safe - mins * 60).toFixed(1).padStart(4, '0');
  return `${mins}m ${rem}s`;
}

export const CoronersReportScreen: React.FC<CoronersReportScreenProps> = ({
  report,
  day,
  maxDays,
  onRetryEscape,
  onRestart,
}) => {
  const survivalFormatted = formatSurvivalDuration(report.timeSurvivedSeconds);
  const progressPct = Math.min(
    100,
    Math.round((report.distanceCoveredMeters / Math.max(1, report.totalEscapeDistanceMeters)) * 100),
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/94 p-4 sm:p-6">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded border border-red-900/60 bg-zinc-950 p-6 sm:p-8 text-left">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-red-400 font-mono-tabular">
          <span>Midnight Public School Medical Examiner</span>
          <span aria-hidden="true">·</span>
          <span>Case {report.caseNumber}</span>
          <span aria-hidden="true">·</span>
          <span>
            Shift {day} of {maxDays}
          </span>
        </div>

        <h2 className="font-display mt-2 text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
          Coroner’s Report
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{report.causeOfDeath}</p>

        <div className="mt-6 grid grid-cols-1 gap-8 border-t border-zinc-800 pt-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-zinc-400">Survival Duration</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono-tabular text-3xl font-semibold text-zinc-100">
                {survivalFormatted}
              </span>
              <span className="font-mono-tabular text-xs text-zinc-400">
                {progressPct}% of route cleared
              </span>
            </div>

            <dl className="mt-5 space-y-2.5 border-t border-zinc-800/80 pt-4 text-xs">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-zinc-400">Decedent</dt>
                <dd className="text-right font-medium text-zinc-200">{report.victimName}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-zinc-400">Assignment</dt>
                <dd className="text-right text-zinc-300">{report.victimRole}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-zinc-400">Distance Covered</dt>
                <dd className="text-right font-mono-tabular text-zinc-200">
                  {report.distanceCoveredMeters} m / {report.totalEscapeDistanceMeters} m
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-zinc-400">Bus Remaining</dt>
                <dd className="text-right font-mono-tabular text-zinc-200">
                  {report.busRemainingMeters} m
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-zinc-400">Sector Reached</dt>
                <dd className="text-right text-zinc-200">{report.sectorReached}</dd>
              </div>
            </dl>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-400">Capturing Anomaly</p>
            <h3 className="font-display mt-1 text-2xl font-semibold tracking-tight text-red-400">
              {report.captorName}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400 font-mono-tabular">
              <span>{report.captorRole === 'teacher' ? 'Faculty Mimic' : 'Student Mimic'}</span>
              <span aria-hidden="true">·</span>
              <span>{report.captorRecordId}</span>
              <span aria-hidden="true">·</span>
              <span>{report.captorDepartment}</span>
            </div>

            <div className="mt-5 border-t border-zinc-800/80 pt-4">
              <p className="text-xs font-medium text-zinc-400">Forensic Anomaly Findings</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                {report.captorAnomalyProfile}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800 pt-5">
          <button
            type="button"
            onClick={onRetryEscape}
            className="inline-flex items-center justify-center gap-2 rounded bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Retry Escape Chase</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 rounded bg-red-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-red-400 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Restart Campaign</span>
          </button>
        </div>
      </div>
    </div>
  );
};
