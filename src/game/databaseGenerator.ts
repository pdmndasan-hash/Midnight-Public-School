import {
  AnomalyCategory,
  ArrivalPerson,
  BodyScanData,
  ClassRevealBehavior,
  HumanAppearance,
  PersonRole,
  SchoolRecordEntry,
} from '../types/game';

const OFFICIAL_SCHOOL_NAME = 'Midnight Public School';

// 32 Fictional Students
const STUDENT_PROFILES: { name: string; className: string; dob: string }[] = [
  { name: 'Hannah Vance', className: 'Class 11-B', dob: '2008-04-12' },
  { name: 'Marcus Mercer', className: 'Class 10-A', dob: '2009-09-19' },
  { name: 'Elena Kowalski', className: 'Class 12-A', dob: '2007-11-03' },
  { name: 'Noah Lin', className: 'Class 9-B', dob: '2010-02-24' },
  { name: 'Clara Holloway', className: 'Class 11-A', dob: '2008-07-15' },
  { name: 'Darius Brooks', className: 'Class 10-B', dob: '2009-05-08' },
  { name: 'Maya Sato', className: 'Class 12-B', dob: '2007-01-29' },
  { name: 'Lucas Reyes', className: 'Class 9-A', dob: '2010-08-14' },
  { name: 'Tessa Fletcher', className: 'Class 11-B', dob: '2008-10-06' },
  { name: 'Owen Whitman', className: 'Class 10-A', dob: '2009-03-21' },
  { name: 'Nadia Gomez', className: 'Class 12-A', dob: '2007-06-17' },
  { name: 'Caleb Carter', className: 'Class 9-B', dob: '2010-12-09' },
  { name: 'Sienna Patel', className: 'Class 11-A', dob: '2008-01-25' },
  { name: 'Julian Navarro', className: 'Class 10-B', dob: '2009-11-11' },
  { name: 'Iris Gallagher', className: 'Class 12-B', dob: '2007-04-04' },
  { name: 'Tobias Monroe', className: 'Class 9-A', dob: '2010-07-28' },
  { name: 'Valerie Chen', className: 'Class 11-B', dob: '2008-08-19' },
  { name: 'Ethan Morales', className: 'Class 10-A', dob: '2009-02-13' },
  { name: 'Phoebe Bennett', className: 'Class 12-A', dob: '2007-09-30' },
  { name: 'Gideon Sharpe', className: 'Class 9-B', dob: '2010-05-16' },
  { name: 'Camille Laurent', className: 'Class 11-A', dob: '2008-12-02' },
  { name: 'Xavier Alvarez', className: 'Class 10-B', dob: '2009-06-22' },
  { name: 'Audrey Takahashi', className: 'Class 12-B', dob: '2007-03-08' },
  { name: 'Simon Whitaker', className: 'Class 9-A', dob: '2010-10-27' },
  { name: 'Lydia Okafor', className: 'Class 11-B', dob: '2008-05-14' },
  { name: 'Mateo Herrera', className: 'Class 10-A', dob: '2009-08-05' },
  { name: 'Zoe Lindqvist', className: 'Class 12-A', dob: '2007-12-18' },
  { name: 'Declan Byrne', className: 'Class 9-B', dob: '2010-04-01' },
  { name: 'Freya Lindholm', className: 'Class 11-A', dob: '2008-09-23' },
  { name: 'Isaiah Coleman', className: 'Class 10-B', dob: '2009-01-10' },
  { name: 'Anika Kulkarni', className: 'Class 12-B', dob: '2007-07-07' },
  { name: 'Rowan Abernathy', className: 'Class 9-A', dob: '2010-03-19' },
];

// 10 Fictional Teachers
const TEACHER_PROFILES: { name: string; subject: string; dob: string }[] = [
  { name: 'Prof. Arthur Pendelton', subject: 'Physics', dob: '1974-03-18' },
  { name: 'Ms. Evelyn Caldwell', subject: 'Literature', dob: '1982-07-09' },
  { name: 'Mr. Julian Sterling', subject: 'Mathematics', dob: '1979-11-24' },
  { name: 'Dr. Miriam Vance', subject: 'Chemistry', dob: '1976-05-12' },
  { name: 'Ms. Helena Cross', subject: 'World History', dob: '1985-09-02' },
  { name: 'Mr. Thomas Beckett', subject: 'Biology', dob: '1980-01-27' },
  { name: 'Mrs. Grace Halstead', subject: 'Geography', dob: '1973-10-15' },
  { name: 'Mr. Victor Delgado', subject: 'Computer Science', dob: '1988-04-30' },
  { name: 'Ms. Celeste Morrison', subject: 'Art History', dob: '1984-12-06' },
  { name: 'Dr. Kenneth Carmichael', subject: 'Economics', dob: '1971-06-21' },
];

const CLASSES = [
  'Class 9-A',
  'Class 9-B',
  'Class 10-A',
  'Class 10-B',
  'Class 11-A',
  'Class 11-B',
  'Class 12-A',
  'Class 12-B',
];

const SUBJECTS = [
  'Physics',
  'Literature',
  'Mathematics',
  'Chemistry',
  'World History',
  'Biology',
  'Geography',
  'Computer Science',
  'Art History',
  'Economics',
];

const RELATED_SUBJECT_MAP: Record<string, string> = {
  Physics: 'Physical Science',
  Literature: 'English Comp',
  Mathematics: 'Applied Math',
  Chemistry: 'Organic Chem',
  'World History': 'Modern History',
  Biology: 'Life Sciences',
  Geography: 'Earth Science',
  'Computer Science': 'Data Systems',
  'Art History': 'Fine Arts',
  Economics: 'Microeconomics',
};

const SKINS = ['#c99e82', '#9d7254', '#d6b196', '#754e39', '#dfbda4', '#b48464'];
const HAIRS = ['#1b1817', '#3f281b', '#6d4c30', '#121316', '#542a21', '#8b6844'];
const EYES = ['#3d2b1f', '#2f4b3e', '#2e455d', '#4c3e26'];
const HAIR_STYLES: HumanAppearance['hairStyle'][] = [
  'short_part',
  'long_straight',
  'bun',
  'wavy_bob',
];

type IdMismatchType =
  | 'id_name_mismatch'
  | 'id_number_mismatch'
  | 'id_dob_mismatch'
  | 'id_class_subject_mismatch'
  | 'id_school_mismatch'
  | 'id_photo_mismatch';

const ALL_MISMATCH_TYPES: IdMismatchType[] = [
  'id_name_mismatch',
  'id_number_mismatch',
  'id_dob_mismatch',
  'id_class_subject_mismatch',
  'id_school_mismatch',
  'id_photo_mismatch',
];

type DifficultyTier = 'obvious' | 'subtle' | 'very_subtle';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleCopy<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeAppearance(role: PersonRole, idx: number): HumanAppearance {
  return {
    role,
    skinHex: SKINS[(idx * 5 + 1) % SKINS.length],
    hairHex: HAIRS[(idx * 3 + 2) % HAIRS.length],
    hairStyle: HAIR_STYLES[(idx * 7) % HAIR_STYLES.length],
    eyeHex: EYES[(idx * 3 + 1) % EYES.length],
    uniformHex: role === 'teacher' ? '#2c2f36' : '#1f2b3a',
    tieHex: role === 'teacher' ? '#5c2323' : '#2f455c',
    glasses: role === 'teacher' ? idx % 3 !== 0 : idx % 4 === 1,
    scarf: idx % 5 === 0,
    freckles: idx % 3 === 1,
    tiredDarkCircles: idx % 4 === 2,
    sweating: idx % 6 === 3,
  };
}

function getTierForDay(day: number): DifficultyTier {
  if (day <= 2) return 'obvious';
  if (day <= 4) return 'subtle';
  return 'very_subtle';
}

function getFakeChanceForDay(day: number): number {
  switch (day) {
    case 1:
      return 0.2;
    case 2:
      return 0.3;
    case 3:
      return 0.4;
    case 4:
      return 0.5;
    default:
      return 0.5;
  }
}

function mutateOneLetterInName(name: string, tier: DifficultyTier): string {
  const words = name.split(' ');
  const candidateWordIndices = words
    .map((w, idx) => ({ w, idx }))
    .filter(({ w }) => !w.endsWith('.') && w.length >= 4);
  const targetWordEntry =
    tier === 'very_subtle'
      ? candidateWordIndices[candidateWordIndices.length - 1]
      : pick(candidateWordIndices);
  if (!targetWordEntry) return `${name}s`;

  const w = targetWordEntry.w;
  const chars = w.split('');
  const pos =
    tier === 'obvious'
      ? Math.max(1, Math.min(chars.length - 2, Math.floor(chars.length / 2)))
      : tier === 'subtle'
        ? Math.max(1, Math.min(chars.length - 2, Math.floor(chars.length / 2)))
        : Math.max(1, chars.length - 2);

  const orig = chars[pos];
  const lower = orig.toLowerCase();

  const obviousAlt: Record<string, string> = {
    a: 'z',
    e: 'x',
    i: 'q',
    o: 'z',
    u: 'x',
    n: 'z',
    r: 'x',
    l: 'z',
    s: 'q',
    t: 'z',
  };
  const subtleAlt: Record<string, string> = {
    a: 'e',
    e: 'a',
    i: 'y',
    o: 'u',
    u: 'o',
    y: 'i',
    c: 'k',
    k: 'c',
    s: 'z',
    z: 's',
    n: 'm',
    m: 'n',
    r: 'l',
  };
  const verySubtleAlt: Record<string, string> = {
    e: 'a',
    a: 'e',
    n: 'm',
    m: 'n',
    l: 'i',
    i: 'l',
    o: 'a',
    t: 'd',
    d: 't',
    r: 'n',
    c: 'e',
    s: 'c',
    h: 'n',
    u: 'v',
    v: 'u',
  };

  const map = tier === 'obvious' ? obviousAlt : tier === 'subtle' ? subtleAlt : verySubtleAlt;
  let nextChar = map[lower] ?? (lower === 'e' ? 'a' : 'e');
  if (nextChar === lower) {
    nextChar = lower === 'e' ? 'a' : 'e';
  }
  chars[pos] = orig === orig.toUpperCase() ? nextChar.toUpperCase() : nextChar;
  words[targetWordEntry.idx] = chars.join('');
  return words.join(' ');
}

function mutateOneDigitInNumber(recordId: string, tier: DifficultyTier): string {
  const [prefix, digitsStr] = recordId.split('-');
  const digits = digitsStr.split('');
  let idx = 0;
  if (tier === 'obvious') {
    idx = 0;
  } else if (tier === 'subtle') {
    idx = Math.min(digits.length - 1, 1);
  } else {
    idx = digits.length - 1;
  }

  const orig = digits[idx];
  const verySubtleDigitMap: Record<string, string> = {
    '0': '8',
    '8': '3',
    '3': '8',
    '1': '7',
    '7': '1',
    '5': '6',
    '6': '5',
    '4': '9',
    '9': '4',
    '2': '7',
  };

  let replacement: string;
  if (tier === 'obvious') {
    const n = (Number(orig) + 5) % 10;
    replacement = String(n === 0 && idx === 0 ? 9 : n);
  } else if (tier === 'subtle') {
    replacement = String((Number(orig) + 3) % 10);
  } else {
    replacement = verySubtleDigitMap[orig] ?? String((Number(orig) + 1) % 10);
  }
  if (replacement === orig) {
    replacement = String((Number(orig) + 1) % 10);
  }

  digits[idx] = replacement;
  return `${prefix}-${digits.join('')}`;
}

function mutateDob(dob: string, role: PersonRole, tier: DifficultyTier): string {
  const [yStr, mStr, dStr] = dob.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  if (tier === 'obvious') {
    return role === 'student'
      ? `1989-${mStr}-${dStr}`
      : `2016-${mStr}-${dStr}`;
  }

  if (tier === 'subtle') {
    const newMonth = ((month + 3) % 12) + 1;
    return `${yStr}-${String(newMonth).padStart(2, '0')}-${dStr}`;
  }

  // very_subtle: off by 1 day
  const newDay = day >= 28 ? day - 1 : day + 1;
  return `${year}-${mStr}-${String(newDay).padStart(2, '0')}`;
}

function mutateClassOrSubject(
  current: string,
  role: PersonRole,
  tier: DifficultyTier,
): string {
  if (role === 'student') {
    if (tier === 'obvious') {
      return pick(['Class 3-Z', 'Class 1-X', 'Kindergarten']);
    }
    if (tier === 'subtle') {
      const currentGrade = current.split('-')[0];
      const candidates = CLASSES.filter((c) => !c.startsWith(currentGrade));
      return pick(candidates);
    }
    // very_subtle: same grade, flipped section A <-> B
    return current.endsWith('-A')
      ? current.replace(/-A$/, '-B')
      : current.replace(/-B$/, '-A');
  }

  // Teacher
  if (tier === 'obvious') {
    return pick(['Culinary Arts', 'Detention Studies', 'Class 9-A']);
  }
  if (tier === 'subtle') {
    const candidates = SUBJECTS.filter((s) => s !== current);
    return pick(candidates);
  }
  // very_subtle: closely related subject title
  return RELATED_SUBJECT_MAP[current] ?? 'General Science';
}

function mutateSchoolName(tier: DifficultyTier): string {
  if (tier === 'obvious') {
    return pick([
      'Midnite Pubilc Shool',
      'Mydnight Publick Skool',
      'Midnayt Publix School',
    ]);
  }
  if (tier === 'subtle') {
    return pick([
      'Midnght Public School',
      'Midnight Pubilc School',
      'Midnigth Public School',
      'Midnight Public Shool',
    ]);
  }
  return pick([
    'Midnight Publlic School',
    'Midmight Public School',
    'Midniqht Public School',
    'Midnight Pulbic School',
  ]);
}

function mutatePhoto(
  base: HumanAppearance,
  tier: DifficultyTier,
): { appearance: HumanAppearance; note: string } {
  const modified: HumanAppearance = { ...base };

  if (tier === 'obvious') {
    const altStyle = HAIR_STYLES.find((s) => s !== base.hairStyle) ?? 'bun';
    const altHair = HAIRS.find((h) => h !== base.hairHex) ?? '#8b6844';
    modified.hairStyle = altStyle;
    modified.hairHex = altHair;
    modified.glasses = !base.glasses;
    return {
      appearance: modified,
      note: 'Photo changed (obvious): different hairstyle, hair color, and glasses',
    };
  }

  if (tier === 'subtle') {
    modified.glasses = !base.glasses;
    modified.scarf = !base.scarf;
    return {
      appearance: modified,
      note: `Photo changed (subtle): ${modified.glasses ? 'added glasses' : 'removed glasses'} & scarf mismatch`,
    };
  }

  // very_subtle: change eye color noticeably & toggle freckles
  const vividAltEye =
    base.eyeHex === '#2e455d' || base.eyeHex === '#2f4b3e' ? '#4c2618' : '#2476a8';
  modified.eyeHex = vividAltEye;
  modified.freckles = !base.freckles;
  return {
    appearance: modified,
    note: 'Photo changed (very subtle): different eye color & cheek freckles',
  };
}

export interface GeneratedCampaign {
  records: SchoolRecordEntry[];
  days: ArrivalPerson[][];
}

export function generateFiveDayCampaign(): GeneratedCampaign {
  const records: SchoolRecordEntry[] = [];

  STUDENT_PROFILES.forEach((profile, i) => {
    records.push({
      recordId: `STU-${1011 + i * 7}`,
      role: 'student',
      fullName: profile.name,
      classOrSubject: profile.className,
      dob: profile.dob,
      schoolName: OFFICIAL_SCHOOL_NAME,
      appearance: makeAppearance('student', i),
    });
  });

  TEACHER_PROFILES.forEach((profile, i) => {
    records.push({
      recordId: `STF-${503 + i * 11}`,
      role: 'teacher',
      fullName: profile.name,
      classOrSubject: profile.subject,
      dob: profile.dob,
      schoolName: OFFICIAL_SCHOOL_NAME,
      appearance: makeAppearance('teacher', i + STUDENT_PROFILES.length),
    });
  });

  const allStudents = records.filter((r) => r.role === 'student');
  const allTeachers = records.filter((r) => r.role === 'teacher');

  const days: ArrivalPerson[][] = [];
  let lastFakeMismatch: IdMismatchType | null = null;

  for (let day = 1; day <= 5; day++) {
    const dayArrivals: ArrivalPerson[] = [];
    const arrivalsCount = 4;

    // Shuffle fresh every day and track used recordIds so nobody ever repeats on the same day
    const shuffledStudents = shuffleCopy(allStudents);
    const shuffledTeachers = shuffleCopy(allTeachers);
    const usedToday = new Set<string>();

    const teacherSlot = Math.floor(Math.random() * arrivalsCount);
    const fakeChance = getFakeChanceForDay(day);
    const tier = getTierForDay(day);

    const roomSeatPool: Record<'room101' | 'room102', number[]> = {
      room101: shuffleCopy([0, 1, 2, 3]),
      room102: shuffleCopy([0, 1, 2, 3]),
    };
    const roomSeatCursor = { room101: 0, room102: 0 };

    for (let slot = 0; slot < arrivalsCount; slot++) {
      const wantTeacher =
        slot === teacherSlot || (slot !== teacherSlot && Math.random() < 0.18);
      const poolList = wantTeacher ? shuffledTeachers : shuffledStudents;
      const rec =
        poolList.find((r) => !usedToday.has(r.recordId)) ??
        records.find((r) => !usedToday.has(r.recordId))!;
      usedToday.add(rec.recordId);

      const assignedRoom: 'room101' | 'room102' = Math.random() < 0.5 ? 'room101' : 'room102';
      const assignedSeatIndex =
        rec.role === 'teacher'
          ? 0
          : roomSeatPool[assignedRoom][roomSeatCursor[assignedRoom]++ % 4];

      // Randomly decide real vs fake for every arrival using day's fake probability
      const isFake = Math.random() < fakeChance;

      const presentedId = {
        idNumber: rec.recordId,
        role: rec.role,
        fullName: rec.fullName,
        classOrSubject: rec.classOrSubject,
        dob: rec.dob,
        schoolName: rec.schoolName,
        photoAppearance: { ...rec.appearance },
      };

      const liveAppearance: HumanAppearance = { ...rec.appearance };

      const isNervousReal = !isFake && (rec.appearance.sweating || rec.appearance.tiredDarkCircles);
      const bodyScan: BodyScanData = {
        heartbeatBpm: isNervousReal
          ? 92 + Math.floor(Math.random() * 14)
          : 66 + Math.floor(Math.random() * 14),
        breathingStatus: isNervousReal
          ? 'Rapid / Nervous (24/min)'
          : rec.appearance.tiredDarkCircles
            ? 'Shallow / Sick (19/min)'
            : 'Steady (15/min)',
        extraBones: false,
        extraFingers: false,
        unnaturalInternal: false,
      };

      let anomalyCategory: AnomalyCategory = 'none';
      let idChangeSummary = 'Real person — ID matches database record in every detail.';
      let revealBehavior: ClassRevealBehavior = 'normal';

      const reason =
        rec.role === 'teacher'
          ? `Grading ${rec.classOrSubject} midterm papers in my office.`
          : `Picking up my ${rec.classOrSubject} lab binder before tomorrow.`;

      const questionAnswers: [string, string, string] = [
        reason,
        `${rec.fullName}, ${rec.classOrSubject}, ID ${rec.recordId}.`,
        isNervousReal
          ? 'Sorry... just exhausted and freezing out there. It is creepy at night.'
          : 'Yeah, I am fine. Just want to get inside out of the fog.',
      ];

      if (isFake) {
        revealBehavior = pick([
          'not_blinking',
          'not_writing_stare',
          'copying_neighbor',
          'repeating_loop',
        ]);

        // Pick a mismatch different from the previous fake's mismatch
        const mismatchChoices = ALL_MISMATCH_TYPES.filter((m) => m !== lastFakeMismatch);
        const chosenMismatch = pick(mismatchChoices);
        lastFakeMismatch = chosenMismatch;
        anomalyCategory = chosenMismatch;

        const tierLabel =
          tier === 'obvious' ? 'obvious' : tier === 'subtle' ? 'subtle' : 'very subtle';

        switch (chosenMismatch) {
          case 'id_name_mismatch': {
            const mutated = mutateOneLetterInName(rec.fullName, tier);
            presentedId.fullName = mutated;
            idChangeSummary = `Name changed (${tierLabel}): "${rec.fullName}" -> "${mutated}"`;
            break;
          }
          case 'id_number_mismatch': {
            const mutated = mutateOneDigitInNumber(rec.recordId, tier);
            presentedId.idNumber = mutated;
            idChangeSummary = `${
              rec.role === 'teacher' ? 'Staff' : 'Roll'
            } # changed (${tierLabel}): "${rec.recordId}" -> "${mutated}"`;
            break;
          }
          case 'id_dob_mismatch': {
            const mutated = mutateDob(rec.dob, rec.role, tier);
            presentedId.dob = mutated;
            idChangeSummary = `DOB changed (${tierLabel}): "${rec.dob}" -> "${mutated}"`;
            break;
          }
          case 'id_class_subject_mismatch': {
            const mutated = mutateClassOrSubject(rec.classOrSubject, rec.role, tier);
            presentedId.classOrSubject = mutated;
            idChangeSummary = `${
              rec.role === 'teacher' ? 'Subject' : 'Class'
            } changed (${tierLabel}): "${rec.classOrSubject}" -> "${mutated}"`;
            break;
          }
          case 'id_school_mismatch': {
            const mutated = mutateSchoolName(tier);
            presentedId.schoolName = mutated;
            idChangeSummary = `School name misspelled (${tierLabel}): "${OFFICIAL_SCHOOL_NAME}" -> "${mutated}"`;
            break;
          }
          case 'id_photo_mismatch': {
            const mutatedPhoto = mutatePhoto(rec.appearance, tier);
            presentedId.photoAppearance = mutatedPhoto.appearance;
            idChangeSummary = mutatedPhoto.note;
            break;
          }
        }
      }

      dayArrivals.push({
        uid: `d${day}_s${slot}_${rec.recordId}_${Math.random().toString(36).slice(2, 6)}`,
        day,
        arrivalOrder: slot + 1,
        role: rec.role,
        isFake,
        anomalyCategory,
        assignedRoom,
        assignedSeatIndex,
        officialRecord: rec,
        presentedId,
        liveAppearance,
        bodyScan,
        noBlinking: false,
        unnaturallyStill: false,
        nervousOrSickNote: isNervousReal ? 'Appears visibly nervous / exhausted' : null,
        questionAnswers,
        classRevealBehavior: revealBehavior,
        idChangeSummary,
      });
    }

    days.push(dayArrivals);
  }

  return { records, days };
}
