import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileText, Search, ShieldCheck, X } from 'lucide-react';
import { CaseLogEntry } from '../types/game';

interface CaseLogsModalProps {
  logs: CaseLogEntry[];
  onClose: () => void;
  onBackToRecords?: () => void;
}

const OUTCOME_LABEL: Record<CaseLogEntry['outcome'], { text: string; classes: string }> = {
  rejected: {
    text: 'Rejected at Gate',
    classes: 'border-amber-700/60 bg-amber-950/70 text-amber-200',
  },
  tased: {
    text: 'Tased at Window',
    classes: 'border-cyan-700/60 bg-cyan-950/70 text-cyan-200',
  },
  banished: {
    text: 'Banished Inside',
    classes: 'border-emerald-700/60 bg-emerald-950/70 text-emerald-200',
  },
  locked_down: {
    text: 'Room Locked Down',
    classes: 'border-emerald-700/60 bg-emerald-950/70 text-emerald-200',
  },
  slipped_past: {
    text: 'Infiltrated School',
    classes: 'border-red-700/70 bg-red-950/80 text-red-200',
  },
};

export const CaseLogsModal: React.FC<CaseLogsModalProps> = ({
  logs,
  onClose,
  onBackToRecords,
}) => {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher'>('all');

  const patternCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of logs) {
      map.set(entry.mismatchType, (map.get(entry.mismatchType) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return [...logs]
      .reverse()
      .filter((entry) => {
        if (roleFilter !== 'all' && entry.role !== roleFilter) return false;
        if (terms.length === 0) return true;
        const haystack = `${entry.officialName} ${entry.recordId} ${entry.mismatchType} ${entry.mismatchDetails} ${entry.presentedSummary}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      });
  }, [logs, query, roleFilter]);

  return (
    <div className="pointer-events-auto fixed inset-x-4 top-20 z-30 mx-auto max-h-[calc(100vh-11.5rem)] max-w-4xl overflow-y-auto rounded border border-zinc-700 bg-zinc-950/97 p-5 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold tracking-wide text-zinc-100">
            <FileText className="h-4 w-4 text-amber-400" />
            <span>Anomaly Case Logs Archive</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Tracks encountered anomalies and their exact ID, scan, or behavioral mismatches across shifts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBackToRecords && (
            <button
              type="button"
              onClick={onBackToRecords}
              className="rounded border border-sky-800/80 bg-sky-950/60 px-3 py-1.5 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-900/70"
            >
              ID &amp; School Records
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Case Logs"
            className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Recurring Pattern Summary */}
      <div className="mt-4 rounded border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-amber-300">
            RECURRING ANOMALY PATTERNS ({logs.length} LOGGED)
          </span>
          {patternCounts.length > 0 && (
            <span className="text-[11px] text-zinc-400">
              Compare repeated telltale mismatches on later nights
            </span>
          )}
        </div>

        {patternCounts.length === 0 ? (
          <div className="text-xs text-zinc-500">
            No anomalies logged yet. Encountered fakes and their ID or scan discrepancies will be archived automatically.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {patternCounts.map(([type, count]) => (
              <button
                key={type}
                type="button"
                onClick={() => setQuery((prev) => (prev === type ? '' : type))}
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${
                  query === type
                    ? 'border-amber-500 bg-amber-950/80 text-amber-100'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-zinc-600'
                }`}
              >
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                <span>{type}</span>
                <span className="font-mono-tabular text-[11px] text-amber-300">×{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, ID #, mismatch type, or detail..."
            className="w-full rounded border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="flex rounded border border-zinc-700 bg-zinc-900 p-0.5 text-[11px]">
          {(['all', 'student', 'teacher'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded px-2.5 py-1 capitalize transition-colors ${
                roleFilter === r ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Logged Encounters */}
      <div className="mt-3 space-y-2.5">
        {filteredLogs.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-800 bg-zinc-900/35 px-4 py-8 text-center text-xs text-zinc-500">
            {logs.length === 0
              ? 'Your case archive is empty. Anomalies identified at the checkpoint or inside the school are recorded here.'
              : 'No case logs match the current filter.'}
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const badge = OUTCOME_LABEL[entry.outcome];
            return (
              <div
                key={entry.id}
                className="rounded border border-zinc-800 bg-zinc-900/75 p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-tabular rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                      DAY {entry.day}
                    </span>
                    <span className="font-semibold text-zinc-100">{entry.officialName}</span>
                    <span className="font-mono-tabular text-[11px] text-zinc-400">
                      ({entry.recordId} · {entry.role})
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${badge.classes}`}>
                    <ShieldCheck className="h-3 w-3" />
                    {badge.text}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-semibold tracking-wider text-amber-400">
                      MISMATCH TYPE: {entry.mismatchType.toUpperCase()}
                    </div>
                    <div className="mt-0.5 text-zinc-200">{entry.mismatchDetails}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold tracking-wider text-zinc-500">
                      PRESENTED ID SUMMARY
                    </div>
                    <div className="mt-0.5 font-mono-tabular text-[11px] text-zinc-300">
                      {entry.presentedSummary}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
