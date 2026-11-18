import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { ArrivalPerson, SchoolRecordEntry } from '../types/game';
import { PortraitCanvas } from './PortraitCanvas';

interface IdAndRecordModalProps {
  arrival: ArrivalPerson;
  records: SchoolRecordEntry[];
  caseLogCount?: number;
  onOpenCaseLogs?: () => void;
  onClose: () => void;
}

export const IdAndRecordModal: React.FC<IdAndRecordModalProps> = ({
  arrival,
  records,
  caseLogCount = 0,
  onOpenCaseLogs,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher'>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Reset search & selected record cleanly whenever a new arrival steps up
  useEffect(() => {
    setQuery('');
    setRoleFilter('all');
    setSelectedRecordId(null);
  }, [arrival.uid]);

  const sortedRecords = useMemo(
    () =>
      [...records].sort((a, b) => {
        if (a.role !== b.role) return a.role === 'student' ? -1 : 1;
        return a.fullName.localeCompare(b.fullName);
      }),
    [records],
  );

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return sortedRecords.filter((r) => {
      if (roleFilter !== 'all' && r.role !== roleFilter) return false;
      if (terms.length === 0) return true;
      const haystack = `${r.fullName} ${r.recordId} ${r.classOrSubject} ${r.dob}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [sortedRecords, query, roleFilter]);

  const selectedRecord = useMemo(
    () => (selectedRecordId ? records.find((r) => r.recordId === selectedRecordId) ?? null : null),
    [records, selectedRecordId],
  );

  const id = arrival.presentedId;
  const studentCount = useMemo(() => records.filter((r) => r.role === 'student').length, [records]);
  const teacherCount = useMemo(() => records.filter((r) => r.role === 'teacher').length, [records]);

  return (
    <div className="pointer-events-auto fixed inset-x-4 top-20 z-30 mx-auto max-h-[calc(100vh-11.5rem)] max-w-4xl overflow-y-auto rounded border border-zinc-700 bg-zinc-950/97 p-5 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-wide text-zinc-100">
            ID Verification &amp; Official School Records
          </h2>
          <p className="text-xs text-zinc-400">
            Search the database ({studentCount} students, {teacherCount} teachers) and compare every
            detail against the presented ID card.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenCaseLogs && (
            <button
              type="button"
              onClick={onOpenCaseLogs}
              className="inline-flex items-center gap-1.5 rounded border border-amber-700/70 bg-amber-950/60 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/70"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Case Logs ({caseLogCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ID and Records"
            className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Left: Actual Generated ID Card of Current Arrival */}
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wider text-amber-300">
            PRESENTED {id.role === 'teacher' ? 'STAFF ID CARD' : 'STUDENT ID CARD'}
          </div>
          <div className="rounded border border-stone-400/50 bg-[#e7e2d5] p-4 text-zinc-900">
            <div className="flex items-baseline justify-between border-b-2 border-zinc-800 pb-1.5">
              <span className="font-display text-base font-bold text-zinc-900">{id.schoolName}</span>
              <span className="font-mono-tabular text-[11px] font-semibold text-zinc-700">
                {id.role === 'teacher' ? 'STAFF' : 'STUDENT'}
              </span>
            </div>

            <div className="mt-3 flex gap-3.5">
              <PortraitCanvas
                appearance={id.photoAppearance}
                alt={`Presented ID photo of ${id.fullName}`}
                className="h-28 w-24 shrink-0 rounded-sm border border-zinc-700 object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                <div>
                  <div className="text-[10px] font-semibold text-zinc-500">FULL NAME</div>
                  <div className="truncate font-semibold text-zinc-900">{id.fullName}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-zinc-500">
                    {id.role === 'teacher' ? 'STAFF NUMBER' : 'ROLL NUMBER'}
                  </div>
                  <div className="font-mono-tabular font-semibold text-zinc-900">{id.idNumber}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-zinc-500">
                    {id.role === 'teacher' ? 'SUBJECT' : 'CLASS'}
                  </div>
                  <div className="font-medium text-zinc-800">{id.classOrSubject}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-zinc-500">DATE OF BIRTH</div>
                  <div className="font-mono-tabular font-semibold text-zinc-900">{id.dob}</div>
                </div>
              </div>
            </div>
          </div>

          {arrival.nervousOrSickNote && (
            <div className="mt-2.5 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
              Observation: {arrival.nervousOrSickNote}
            </div>
          )}
        </div>

        {/* Right: School Record Database Search + Side-by-Side Comparison */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-sky-300">
              SCHOOL RECORD DATABASE
            </span>
            <span className="font-mono-tabular text-[11px] text-zinc-400">
              {filtered.length} / {records.length} records
            </span>
          </div>

          {/* Search & Role Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, roll/staff #, class..."
                className="w-full rounded border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="flex rounded border border-zinc-700 bg-zinc-900 p-0.5 text-[11px]">
              {(['all', 'student', 'teacher'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`rounded px-2 py-1 capitalize transition-colors ${
                    roleFilter === r ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Search Results List */}
          <div className="mt-2 max-h-32 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/70">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">
                No matching student or staff records found.
              </div>
            ) : (
              filtered.map((rec) => (
                <button
                  key={rec.recordId}
                  type="button"
                  onClick={() => setSelectedRecordId(rec.recordId)}
                  className={`flex w-full items-center justify-between border-b border-zinc-800/80 px-3 py-1.5 text-left text-xs transition-colors last:border-b-0 ${
                    selectedRecord?.recordId === rec.recordId
                      ? 'bg-sky-950/75 text-sky-100'
                      : 'text-zinc-300 hover:bg-zinc-800/70'
                  }`}
                >
                  <span className="truncate font-medium">
                    {rec.fullName}
                    <span className="ml-2 text-[10px] text-zinc-400">({rec.classOrSubject})</span>
                  </span>
                  <span className="font-mono-tabular ml-2 shrink-0 text-[11px] text-zinc-400">
                    {rec.recordId}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Official Record Side-by-Side Card */}
          {selectedRecord ? (
            <div className="mt-2.5 rounded border border-sky-900/70 bg-[#0b1520] p-3.5 text-xs">
              <div className="flex items-baseline justify-between border-b border-sky-900/60 pb-1.5">
                <span className="font-semibold text-sky-200">{selectedRecord.schoolName}</span>
                <span className="font-mono-tabular text-[11px] text-sky-400">
                  OFFICIAL {selectedRecord.role === 'teacher' ? 'STAFF' : 'STUDENT'} FILE
                </span>
              </div>
              <div className="mt-2.5 flex gap-3.5">
                <PortraitCanvas
                  appearance={selectedRecord.appearance}
                  alt={`Official record photo of ${selectedRecord.fullName}`}
                  className="h-28 w-24 shrink-0 rounded-sm border border-sky-800 object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">Name:</span>
                    <span className="truncate font-semibold text-zinc-100">
                      {selectedRecord.fullName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">
                      {selectedRecord.role === 'teacher' ? 'Staff #:' : 'Roll #:'}
                    </span>
                    <span className="font-mono-tabular font-semibold text-zinc-100">
                      {selectedRecord.recordId}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">
                      {selectedRecord.role === 'teacher' ? 'Subject:' : 'Class:'}
                    </span>
                    <span className="font-medium text-zinc-100">{selectedRecord.classOrSubject}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">DOB:</span>
                    <span className="font-mono-tabular font-semibold text-zinc-100">
                      {selectedRecord.dob}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">School:</span>
                    <span className="truncate font-medium text-zinc-200">
                      {selectedRecord.schoolName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex h-36 items-center justify-center rounded border border-dashed border-zinc-800 bg-zinc-900/40 px-4 text-center text-xs text-zinc-400">
              Search by name or roll/staff number above and click a record to compare side by side.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
