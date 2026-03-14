import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Layout,
  PenTool,
  Download,
  Settings,
  Moon,
  Sun,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Save,
  Trash2,
  Eye,
  FileDown,
  CheckCircle2,
  Search,
  BookOpen,
  MapPin,
  Monitor,
  Users,
  Calendar,
  Cpu,
  Target,
  Pencil,
  School,
  GraduationCap
} from 'lucide-react';
import Swal from 'sweetalert2';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { INITIAL_DATA, type LockedLengthPlan, type SKKNData, STEPS } from './types';
import { GEMINI_MODEL_SWITCH_EVENT, callGeminiAI, estimateWordCount, getAllSectionLengthPlans, getSectionLengthPlan, PROMPTS, type GeminiModelSwitchDetail, type SectionLengthPlan } from './services/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Section names for writing steps
const SECTION_MAP: { [key: number]: string } = {
  2: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - I. L\u00fd do ch\u1ecdn \u0111\u1ec1 t\u00e0i',
  3: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - II. M\u1ee5c \u0111\u00edch nghi\u00ean c\u1ee9u',
  4: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - III. \u0110\u1ed1i t\u01b0\u1ee3ng nghi\u00ean c\u1ee9u',
  5: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - IV. \u0110\u1ed1i t\u01b0\u1ee3ng kh\u1ea3o s\u00e1t th\u1ef1c nghi\u1ec7m',
  6: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - V. Ph\u01b0\u01a1ng ph\u00e1p nghi\u00ean c\u1ee9u',
  7: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - VI. Ph\u1ea1m vi v\u00e0 k\u1ebf ho\u1ea1ch nghi\u00ean c\u1ee9u',
  8: 'PH\u1ea6N N\u1ed8I DUNG - I. C\u01a1 s\u1edf l\u00fd lu\u1eadn',
  9: 'PH\u1ea6N N\u1ed8I DUNG - II. Th\u1ef1c tr\u1ea1ng',
  10: 'PH\u1ea6N N\u1ed8I DUNG - III. Bi\u1ec7n ph\u00e1p th\u1ef1c hi\u1ec7n',
  11: 'PH\u1ea6N N\u1ed8I DUNG - IV. K\u1ebft qu\u1ea3 \u0111\u1ea1t \u0111\u01b0\u1ee3c',
  12: 'PH\u1ea6N K\u1ebeT LU\u1eacN - I. K\u1ebft lu\u1eadn chung',
  13: 'PH\u1ea6N K\u1ebeT LU\u1eacN - II. B\u00e0i h\u1ecdc kinh nghi\u1ec7m',
  14: 'PH\u1ea6N K\u1ebeT LU\u1eacN - III. \u0110\u1ec1 xu\u1ea5t - khuy\u1ebfn ngh\u1ecb',
  15: 'PH\u1ee4 L\u1ee4C',
};

const SECTION_ORDER = Object.values(SECTION_MAP);
const SIDEBAR_SECTION_SUBITEMS: Record<number, string[]> = {
  8: [
    '1. Gi\u1edbi thi\u1ec7u v\u1ec1 ph\u1ea7n m\u1ec1m Logo',
    '2. V\u00ec sao Logo \u0111\u01b0\u1ee3c \u0111\u01b0a v\u00e0o d\u1ea1y trong tr\u01b0\u1eddng ti\u1ec3u h\u1ecdc',
    '3. Khi h\u1ecdc Logo h\u1ecdc sinh \u0111\u01b0\u1ee3c h\u1ecdc v\u00e0 c\u00f3 th\u1ec3 l\u00e0m g\u00ec',
  ],
  9: [
    '1. Thu\u1eadn l\u1ee3i v\u00e0 kh\u00f3 kh\u0103n (1.1 Thu\u1eadn l\u1ee3i, 1.2 Kh\u00f3 kh\u0103n)',
    '2. Th\u1ef1c tr\u1ea1ng d\u1ea1y - h\u1ecdc ph\u1ea7n m\u1ec1m Logo \u1edf tr\u01b0\u1eddng ti\u1ec3u h\u1ecdc',
  ],
  10: [
    '1. Gi\u00fap h\u1ecdc sinh ph\u00e1t hi\u1ec7n v\u00e0 kh\u1eafc ph\u1ee5c l\u1ed7i th\u01b0\u1eddng g\u1eb7p',
    '2. Gi\u00fap h\u1ecdc sinh n\u1eafm y\u00eau c\u1ea7u c\u1ee7a b\u00e0i t\u1eadp (2.1, 2.2)',
    '3. Gi\u00fap h\u1ecdc sinh vi\u1ebft nhanh c\u00e2u l\u1ec7nh l\u1eb7p, th\u1ee7 t\u1ee5c',
    '4. Bi\u1ec3u d\u01b0\u01a1ng, kh\u00edch l\u1ec7 s\u1ef1 t\u00ecm t\u00f2i, s\u00e1ng t\u1ea1o',
  ],
};

const SECTION_NAME_MIGRATION: Record<string, string> = {
  'I.1. Tính c?p thi?t ph?i ti?n hành sáng ki?n': SECTION_MAP[2],
  'I.2. M?c tiêu c?a d? tài, sáng ki?n': SECTION_MAP[3],
  'I.3. Th?i gian, d?i tu?ng, ph?m vi nghiên c?u': SECTION_MAP[4],
  'II.1. Hi?n tr?ng v?n d?': SECTION_MAP[9],
  'II.2. Gi?i pháp th?c hi?n sáng ki?n': SECTION_MAP[10],
  'II.3. K?t qu? sau khi áp d?ng gi?i pháp sáng ki?n': SECTION_MAP[11],
  'II.4. Hi?u qu? c?a sáng ki?n': SECTION_MAP[11],
  'II.5. Tính kh? thi': SECTION_MAP[11],
  'II.6. Th?i gian th?c hi?n': SECTION_MAP[7],
  'II.7. Kinh phí th?c hi?n': SECTION_MAP[10],
  'III. Ki?n ngh?, d? xu?t': SECTION_MAP[14],

  'I.1. Lí do ch?n d? tài': SECTION_MAP[2],
  'I.2. M?c dích nghiên c?u': SECTION_MAP[3],
  'I.3. Ð?i tu?ng nghiên c?u': SECTION_MAP[4],
  'I.4. Ð?i tu?ng kh?o sát': SECTION_MAP[5],
  'I.5. Phuong pháp nghiên c?u': SECTION_MAP[6],
  'I.6. Ph?m vi tri?n khai': SECTION_MAP[7],
  'II.1. Co s? lí lu?n': SECTION_MAP[8],
  'II.2. Th?c tr?ng': SECTION_MAP[9],
  'II.3. Các bi?n pháp th?c hi?n sáng ki?n': SECTION_MAP[10],
  'II.4. Hi?u qu? d?t du?c sau khi áp d?ng sáng ki?n': SECTION_MAP[11],
  'III. K?t qu?': SECTION_MAP[12],
};

const remapSectionKeys = (sections: Record<string, string>) => Object.entries(sections || {}).reduce<Record<string, string>>((acc, [name, value]) => {
  const mappedName = SECTION_NAME_MIGRATION[name] || name;
  const current = acc[mappedName] || '';
  const incoming = String(value || '');

  if (!current || estimateWordCount(incoming) > estimateWordCount(current)) {
    acc[mappedName] = incoming;
  }

  return acc;
}, {});

const serializeLengthPlans = (plans: ReturnType<typeof getAllSectionLengthPlans>) =>
  plans.reduce<Record<string, LockedLengthPlan>>((acc, { sectionName, ...plan }) => {
    acc[sectionName] = plan;
    return acc;
  }, {});

const toPositiveNumber = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const coerceLockedLengthPlan = (plan?: Partial<LockedLengthPlan> | null): LockedLengthPlan | null => {
  if (!plan) return null;

  const wordSeed = toPositiveNumber(plan.targetWords)
    ?? toPositiveNumber(plan.minWords)
    ?? toPositiveNumber(plan.maxWords);
  if (!wordSeed) return null;

  const targetWords = Math.max(60, Math.round(toPositiveNumber(plan.targetWords) ?? wordSeed));
  const minWords = Math.max(1, Math.round(targetWords * 0.5));
  const maxWords = Math.max(minWords, Math.round(targetWords * 1.2));
  const targetPages = Number((targetWords / 420).toFixed(1));
  const targetPagesLabel = (targetWords / 420).toFixed(1);
  const maxTokens = Math.min(
    8192,
    Math.max(512, Math.round((maxWords + 60) * 2.4)),
  );
  const totalPages = Math.max(1, Math.round(toPositiveNumber(plan.totalPages) ?? 1));

  return {
    totalPages,
    targetPages,
    targetPagesLabel,
    targetWords,
    minWords,
    maxWords,
    maxTokens,
  };
};

const normalizeLockedLengthPlans = (
  lockedPlans: Record<string, LockedLengthPlan> | undefined,
  pageLimit: string,
) => {
  const fallbackPlans = serializeLengthPlans(getAllSectionLengthPlans(pageLimit));

  return SECTION_ORDER.reduce<Record<string, LockedLengthPlan>>((acc, sectionName) => {
    const plan = coerceLockedLengthPlan(lockedPlans?.[sectionName]) || coerceLockedLengthPlan(fallbackPlans[sectionName]);
    if (plan) acc[sectionName] = plan;
    return acc;
  }, {});
};

const hydrateLockedLengthPlans = (lockedPlans: Record<string, LockedLengthPlan>, pageLimit: string) => {
  const fallbackPlans = serializeLengthPlans(getAllSectionLengthPlans(pageLimit));

  return SECTION_ORDER.reduce<Array<LockedLengthPlan & { sectionName: string }>>((acc, sectionName) => {
    const plan = coerceLockedLengthPlan(lockedPlans[sectionName]) || coerceLockedLengthPlan(fallbackPlans[sectionName]);
    if (plan) acc.push({ sectionName, ...plan });
    return acc;
  }, []);
};

const EXPORT_WORDS_PER_PAGE = 420;
const EXPORT_TOTAL_TOLERANCE_RATIO = 0.05;
const EXPORT_MIN_SECTION_ADJUSTMENT = 45;
const MAX_EXPORT_NORMALIZATION_PASSES = 2;
const MAX_EXPORT_SECTIONS_PER_PASS = 4;
const APP_BUILD_TAG = '2026-03-14-r17';
const normalizeLoadedData = (candidate: SKKNData): SKKNData => {
  const normalizedSections = remapSectionKeys(candidate.sections || {});

  if (!candidate.confirmedRequirements) {
    return {
      ...candidate,
      sections: normalizedSections,
      lockedInfo: null,
      lockedPageLimit: '',
      lockedLengthPlans: {},
    };
  }

  const lockedInfo = { ...INITIAL_DATA.info, ...(candidate.lockedInfo || candidate.info) };
  const lockedPageLimit = candidate.lockedPageLimit || lockedInfo.pageLimit || '';
  const lockedLengthPlans = normalizeLockedLengthPlans(candidate.lockedLengthPlans, lockedPageLimit);

  return {
    ...candidate,
    sections: normalizedSections,
    lockedInfo,
    lockedPageLimit,
    lockedLengthPlans,
  };
};

export default function App() {
  const [data, setData] = useState<SKKNData>(() => {
    // Try loading v3 data first
    const saved = localStorage.getItem('skkn_data_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return normalizeLoadedData({ ...INITIAL_DATA, ...parsed, info: { ...INITIAL_DATA.info, ...parsed.info } });
      } catch { return INITIAL_DATA; }
    }
    // Migrate from v2 if exists
    const oldSaved = localStorage.getItem('skkn_data_v2');
    if (oldSaved) {
      try {
        const parsed = JSON.parse(oldSaved);
        // Map old section names to new section names
        const sectionMigration: { [key: string]: string } = {
          'I. Ð?t v?n d?': SECTION_MAP[2],
          'II.1. Hi?n tr?ng v?n d?': SECTION_MAP[9],
          'II.2. Gi?i pháp th?c hi?n sáng ki?n': SECTION_MAP[10],
          'II.3. K?t qu? sau khi áp d?ng gi?i pháp sáng ki?n': SECTION_MAP[11],
          'II.4. Hi?u qu? c?a sáng ki?n': SECTION_MAP[11],
          'II.5. Tính kh? thi': SECTION_MAP[11],
          'II.6-7. Th?i gian & Kinh phí th?c hi?n': SECTION_MAP[7],
          'III. Ki?n ngh?, d? xu?t': SECTION_MAP[14],
        };
        const legacyCurrentSections: { [key: string]: string } = {
          'I.1. T?nh c?p thi?t ph?i ti?n h?nh s?ng ki?n': SECTION_MAP[2],
          'I.2. M?c ti?u c?a d? t?i, s?ng ki?n': SECTION_MAP[3],
          'I.3. Th?i gian, d?i tu?ng, ph?m vi nghi?n c?u': SECTION_MAP[4],
          'II.1. Hi?n tr?ng v?n d?': SECTION_MAP[9],
          'II.2. Gi?i ph?p th?c hi?n s?ng ki?n': SECTION_MAP[10],
          'II.3. K?t qu? sau khi ?p d?ng gi?i ph?p s?ng ki?n': SECTION_MAP[11],
          'II.4. Hi?u qu? c?a s?ng ki?n': SECTION_MAP[11],
          'II.5. T?nh kh? thi': SECTION_MAP[11],
          'II.6. Th?i gian th?c hi?n': SECTION_MAP[7],
          'II.7. Kinh ph? th?c hi?n': SECTION_MAP[10],
          'III. Ki?n ngh?, d? xu?t': SECTION_MAP[14],
        };
        const newSections: { [key: string]: string } = {};
        if (parsed.sections) {
          Object.entries(parsed.sections).forEach(([key, value]) => {
            const newKey = sectionMigration[key] || legacyCurrentSections[key] || key;
            newSections[newKey] = value as string;
          });
        }
        const migrated = {
          ...INITIAL_DATA,
          ...parsed,
          info: { ...INITIAL_DATA.info, ...parsed.info },
          sections: newSections,
          currentStep: Math.min(parsed.currentStep || 0, 16),
        };
        // Save migrated data as v3
        localStorage.setItem('skkn_data_v3', JSON.stringify(migrated));
        return normalizeLoadedData(migrated);
      } catch { return INITIAL_DATA; }
    }
    return INITIAL_DATA;
  });
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => parseInt(localStorage.getItem('gemini_model_index') || localStorage.getItem('ai_model_index') || '0'));
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const exportInFlightRef = useRef(false);
  const hasLockedSession = data.confirmedRequirements && !!data.lockedInfo;
  const activeInfo = hasLockedSession ? data.lockedInfo! : data.info;
  const normalizeSectionLengthPlan = (sectionName: string, plan?: Partial<SectionLengthPlan> | null): SectionLengthPlan | null => {
    const normalized = coerceLockedLengthPlan(plan as Partial<LockedLengthPlan> | null);
    return normalized ? { sectionName, ...normalized } : null;
  };

  const sectionLengthPlans = hasLockedSession
    ? hydrateLockedLengthPlans(data.lockedLengthPlans, data.lockedPageLimit || data.info.pageLimit)
    : getAllSectionLengthPlans(data.info.pageLimit);
  const activePageLimitLabel = hasLockedSession ? data.lockedPageLimit : data.info.pageLimit;

  const resolveSectionLengthPlan = (sectionName: string) => {
    if (hasLockedSession) {
      const lockedPlan = normalizeSectionLengthPlan(sectionName, data.lockedLengthPlans[sectionName]);
      if (lockedPlan) return lockedPlan;

      const fallbackPlan = getSectionLengthPlan(sectionName, data.lockedPageLimit || data.info.pageLimit);
      return normalizeSectionLengthPlan(sectionName, fallbackPlan);
    }

    const dynamicPlan = getSectionLengthPlan(sectionName, data.info.pageLimit);
    return normalizeSectionLengthPlan(sectionName, dynamicPlan);
  };

  const toSafePositiveInt = (value: unknown) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const direct = Number(trimmed.replace(',', '.'));
      if (Number.isFinite(direct) && direct > 0) return Math.round(direct);

      const match = trimmed.match(/\d+(?:[.,]\d+)?/);
      if (match) {
        const parsed = Number(match[0].replace(',', '.'));
        if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
      }
    }

    return 0;
  };

  const toRuntimePlan = (plan: SectionLengthPlan | null): SectionLengthPlan | null => {
    if (!plan) return null;

    const targetWords = Math.max(60, toSafePositiveInt(plan.targetWords));
    const minWords = Math.max(1, Math.round(targetWords * 0.5));
    const maxWords = Math.max(minWords, Math.round(targetWords * 1.2));
    const maxTokens = Math.min(8192, Math.max(512, Math.round((maxWords + 60) * 2.4)));

    return {
      ...plan,
      targetWords,
      minWords,
      maxWords,
      maxTokens,
    };
  };

  const getHardMinWords = (plan: Pick<SectionLengthPlan, 'minWords' | 'targetWords'>) => {
    const targetWords = toSafePositiveInt(plan.targetWords);
    if (targetWords > 0) return Math.max(1, Math.round(targetWords * 0.5));

    const minWords = toSafePositiveInt(plan.minWords);
    return Math.max(1, minWords);
  };

  const buildSectionAwareFallbackContent = (
    sectionName: string,
    info: SKKNData['info'],
    missingWords: number,
  ) => {
    const lower = sectionName.toLowerCase();
    const subject = info.subject || 'm?n h?c';
    const grade = info.grade || 'l?p h?c';
    const school = info.school || '??n v? c?ng t?c';
    const location = info.location || '??a ph??ng';
    const target = info.target || 'h?c sinh';
    const duration = info.duration || 'n?m h?c hi?n t?i';
    const topic = info.title || '?? t?i';

    let blocks: string[] = [];

    if (lower.includes('??i t??ng nghi?n c?u')) {
      blocks = [
        `### ??i t??ng tr?c ti?p\n??i t??ng nghi?n c?u tr?c ti?p l? ${target} thu?c ${grade} t?i ${school} (${location}). Nh?m n?y ???c l?a ch?n v? g?n tr?c ti?p v?i m?c ti?u c?a ?? t?i "${topic}" v? ph?n ?nh ??ng b?i c?nh tri?n khai.`,
        `### ??c ?i?m v? ti?u ch? l?a ch?n\n??i t??ng ???c x?c ??nh theo c?c ti?u ch?: m?c ?? tham gia h?c t?p, kh? n?ng h?p t?c, nhu c?u h? tr? v? th?i quen h?c t?p. Vi?c ch?n m?u b?o ??m c? ?? c?c m?c n?ng l?c ?? k?t qu? nghi?n c?u c? ?? tin c?y.`,
        `### Ph?m vi theo d?i\nQu? tr?nh theo d?i di?n ra trong ${duration}, g?m giai ?o?n kh?o s?t ban ??u, ?p d?ng gi?i ph?p v? ??nh gi? sau can thi?p. M?i giai ?o?n ??u c? minh ch?ng c? th? ?? ??i s?nh s? ti?n b? c?a h?c sinh.`,
      ];
    } else if (lower.includes('m?c ??ch nghi?n c?u')) {
      blocks = [
        `### M?c ti?u t?ng qu?t\nM?c ti?u t?ng qu?t c?a ?? t?i "${topic}" l? n?ng cao ch?t l??ng d?y h?c ${subject} cho ${grade}, ??ng th?i t?ng t?nh ch? ??ng v? hi?u qu? h?c t?p c?a h?c sinh trong ?i?u ki?n th?c t? t?i ${school}.`,
        `### M?c ti?u c? th?\n?? t?i h??ng ??n ba nh?m m?c ti?u: ki?n th?c, k? n?ng v? th?i ??. ? t?ng nh?m, gi?o vi?n x?c ??nh ch? b?o quan s?t r? r?ng ?? theo d?i m?c ?? thay ??i tr??c v? sau khi ?p d?ng gi?i ph?p.`,
      ];
    } else if (lower.includes('c? s? l? lu?n')) {
      blocks = [
        `### N?n t?ng l? thuy?t\nPh?n n?y l?m r? c?c kh?i ni?m c?t l?i, c?n c? ch??ng tr?nh v? ??nh h??ng ph?t tri?n ph?m ch?t, n?ng l?c li?n quan ??n ${subject}. C? s? l? lu?n c?n li?n h? tr?c ti?p v?i b?i c?nh d?y h?c t?i ${school}.`,
        `### Li?n h? th?c ti?n\nNgo?i l? thuy?t, c?n n?u c?c d?n ch?ng t? th?c t? d?y h?c ? ${grade}, t? ?? ch? ra v? sao gi?i ph?p ???c l?a ch?n ph? h?p v? c? t?nh kh? thi khi tri?n khai trong nh? tr??ng.`,
      ];
    } else if (lower.includes('th?c tr?ng')) {
      blocks = [
        `### B?c tranh tr??c can thi?p\nTh?c tr?ng c?n m? t? r? ?i?m m?nh, ?i?m h?n ch? v? s? li?u kh?o s?t ??u v?o c?a h?c sinh. C?c bi?u hi?n n?n g?n v?i m?c ?? ho?n th?nh nhi?m v?, th?i ?? h?c t?p v? ch?t l??ng s?n ph?m h?c t?p.`,
        `### Nguy?n nh?n v? t?c ??ng\nB?n c?nh m? t? hi?n tr?ng, c?n ph?n t?ch nguy?n nh?n theo c?c nh?m: h?c sinh, gi?o vi?n, ?i?u ki?n c? s? v?t ch?t v? s? ph?i h?p ph? huynh. Ph?n t?ch n?y gi?p l?m r? s? c?n thi?t c?a c?c bi?n ph?p ? ph?n sau.`,
      ];
    } else if (lower.includes('bi?n ph?p th?c hi?n')) {
      blocks = [
        `### C?ch t? ch?c bi?n ph?p\nM?i bi?n ph?p c?n n?u r? m?c ti?u, ti?n tr?nh th?c hi?n, h?c li?u s? d?ng v? c?ch ??nh gi?. N?i dung n?n t?ch theo c?c b??c c? th? ?? gi?o vi?n kh?c c? th? tri?n khai l?i.`,
        `### Minh ch?ng tri?n khai\nC?n b? sung v? d? c? th? t?i l?p: c?ch giao nhi?m v?, c?ch x? l? l?i th??ng g?p, c?ch ph?n h?i cho h?c sinh v? k?t qu? thu ???c sau t?ng ho?t ??ng. C?c m?c 2.1 v? 2.2 n?n tr?nh b?y t?ch b?ch, kh?ng g?p ?.`,
      ];
    } else if (lower.includes('k?t qu? ??t ???c')) {
      blocks = [
        `### So s?nh tr??c v? sau\nK?t qu? n?n th? hi?n theo d?ng ??i s?nh tr??c - sau b?ng s? li?u ??nh l??ng k?m nh?n x?t ??nh t?nh. C?n n?u r? ch? s? ?o l??ng v? th?i ?i?m ??nh gi? ?? b?o ??m t?nh thuy?t ph?c.`,
        `### T?c ??ng gi?o d?c\nNgo?i s? li?u, n?n m? t? t?c ??ng ??n th?i ?? h?c t?p, m?c ?? t? tin, kh? n?ng h?p t?c v? ch?t l??ng s?n ph?m c?a h?c sinh sau khi ?p d?ng gi?i ph?p.`,
      ];
    } else {
      blocks = [
        `N?i dung c?n ???c m? r?ng b?ng minh ch?ng c? th? theo b?i c?nh d?y h?c ${subject} t?i ${school}, tr?nh di?n ??t ng?n g?n qu? m?c.`,
        `C?n b? sung th?m v? d? tri?n khai, ti?u ch? ??nh gi? v? nh?n x?t k?t qu? ?? ph?n n?y ?? ?? s?u v? d? ?p d?ng trong th?c t?.`,
      ];
    }

    let addition = blocks.join('\n\n');
    const targetWords = Math.max(80, missingWords + 30);

    while (estimateWordCount(addition) < targetWords) {
      addition += '\n\nTi?p t?c b? sung minh ch?ng th?c t? theo t?ng t?nh hu?ng l?p h?c, n?u r? c?ch t? ch?c, ti?u ch? ??nh gi? v? ?i?u ch?nh sau khi tri?n khai.';
    }

    return addition.trim();
  };




  useEffect(() => {
    localStorage.setItem('skkn_data_v3', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    // @ts-ignore
    if (window.MathJax && window.MathJax.typeset) {
      // @ts-ignore
      window.MathJax.typeset();
    }
  }, [data.sections, data.currentStep]);

  useEffect(() => {
    const onModelAutoSwitched = (event: Event) => {
      const detail = (event as CustomEvent<GeminiModelSwitchDetail>).detail;
      if (!detail) return;

      setSelectedModel(detail.toModelIndex);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: `Ðã t? chuy?n model: ${detail.toLabel}`,
        text: `${detail.fromLabel} ${detail.reason}. H? th?ng dã t? chuy?n d? vi?t ti?p.`,
        timer: 3200,
        showConfirmButton: false,
      });
    };

    window.addEventListener(GEMINI_MODEL_SWITCH_EVENT, onModelAutoSwitched as EventListener);
    return () => {
      window.removeEventListener(GEMINI_MODEL_SWITCH_EVENT, onModelAutoSwitched as EventListener);
    };
  }, []);

  const handleUpdateInfo = (field: string, value: string | boolean) => {
    setData(prev => {
      if (prev.confirmedRequirements) return prev;

      return {
        ...prev,
        info: { ...prev.info, [field]: value }
      };
    });
  };

  const goToStep = (stepId: number) => {
    setData(prev => ({ ...prev, currentStep: stepId }));
  };

  const generateOutline = async () => {
    if (!activeInfo.title) {
      Swal.fire('L?i', 'Vui lòng nh?p tên d? tài!', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const prompt = PROMPTS.GENERATE_OUTLINE(activeInfo);
      const result = await callGeminiAI(prompt);
      if (result) {
        setData(prev => ({ ...prev, outline: result }));
        Swal.fire('Thành công', 'Ðã t?o dàn ý chi ti?t b?ng AI!', 'success');
      }
    } catch (error: any) {
      Swal.fire('L?i', error.message || 'Không th? k?t n?i v?i AI', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const fitSectionToLength = async (sectionName: string, content: string, outline: string) => {
    const rawPlan = resolveSectionLengthPlan(sectionName);
    const plan = toRuntimePlan(rawPlan);
    const originalWordCount = estimateWordCount(content);

    if (!plan) {
      return { content, wordCount: originalWordCount, adjusted: false, plan: null };
    }

    if (originalWordCount >= plan.minWords && originalWordCount <= plan.maxWords) {
      return { content, wordCount: originalWordCount, adjusted: false, plan };
    }

    type RewriteCandidate = {
      content: string;
      wordCount: number;
      mode: 'original' | 'shorten' | 'expand' | 'regenerate';
    };

    const direction: 'shorten' | 'expand' = originalWordCount > plan.maxWords ? 'shorten' : 'expand';
    const candidates: RewriteCandidate[] = [
      { content, wordCount: originalWordCount, mode: 'original' },
    ];

    const runRewrite = async (baseContent: string, mode: 'shorten' | 'expand') => {
      const rewritePrompt = PROMPTS.REWRITE_SECTION_LENGTH(
        sectionName,
        baseContent,
        activeInfo,
        plan,
        mode,
      );

      const rewritten = await callGeminiAI(rewritePrompt, undefined, undefined, plan.maxTokens);
      if (!rewritten || !rewritten.trim()) return null;

      return {
        content: rewritten,
        wordCount: estimateWordCount(rewritten),
        mode,
      } as RewriteCandidate;
    };

    const runRegenerate = async () => {
      const { prompt: basePrompt, maxTokens } = PROMPTS.WRITE_SECTION(sectionName, outline, activeInfo, plan);
      const strictPrompt = `${basePrompt}

=== YÊU C?U C?NG V? Ð? DÀI ===
- Bài tr? v? KHÔNG du?c du?i ${plan.minWords} t?.
- N?u chua d? d? dài, hãy t? vi?t ti?p thêm ví d?/chi ti?t th?c t? cho d?n khi d?t yêu c?u.
- Không tr? v? b?n nháp quá ng?n.
==============================`;

      const regenerated = await callGeminiAI(strictPrompt, undefined, undefined, maxTokens);
      if (!regenerated || !regenerated.trim()) return null;

      return {
        content: regenerated,
        wordCount: estimateWordCount(regenerated),
        mode: 'regenerate' as const,
      };
    };

    const firstRewrite = await runRewrite(content, direction);
    if (firstRewrite) {
      candidates.push(firstRewrite);
    }

    const latestCandidate = firstRewrite || candidates[0];
    if (latestCandidate.wordCount < plan.minWords || latestCandidate.wordCount > plan.maxWords) {
      const secondMode: 'shorten' | 'expand' = latestCandidate.wordCount > plan.maxWords ? 'shorten' : 'expand';
      const secondRewrite = await runRewrite(latestCandidate.content, secondMode);
      if (secondRewrite) {
        candidates.push(secondRewrite);
      }
    }

    const hardMinWords = getHardMinWords(plan);
    const hardMaxWords = plan.maxWords;

    const scoreCandidate = (candidate: RewriteCandidate) => {
      const distanceFromTarget = Math.abs(candidate.wordCount - plan.targetWords);
      const softPenalty = candidate.wordCount < plan.minWords
        ? (plan.minWords - candidate.wordCount) * 1.5
        : candidate.wordCount > plan.maxWords
          ? (candidate.wordCount - plan.maxWords)
          : 0;
      const hardPenalty = candidate.wordCount < hardMinWords
        ? (hardMinWords - candidate.wordCount) * 4
        : candidate.wordCount > hardMaxWords
          ? (candidate.wordCount - hardMaxWords) * 2
          : 0;
      return distanceFromTarget + softPenalty + hardPenalty;
    };

    const reliableCandidates = candidates.filter(
      (candidate) => candidate.wordCount >= hardMinWords && candidate.wordCount <= hardMaxWords,
    );
    const selectionPool = reliableCandidates.length > 0 ? reliableCandidates : candidates;

    let bestCandidate = selectionPool.reduce((best, current) =>
      scoreCandidate(current) < scoreCandidate(best) ? current : best,
    );

    // Safety guard: expand flow must not collapse to a much shorter section.
    if (direction === 'expand' && bestCandidate.wordCount < Math.floor(originalWordCount * 0.85)) {
      bestCandidate = candidates[0];
    }

    // Safety guard: shorten flow must not accidentally bloat the section.
    if (direction === 'shorten' && bestCandidate.wordCount > Math.ceil(originalWordCount * 1.05)) {
      bestCandidate = candidates[0];
    }

    // If still severely short, regenerate from scratch once with a stricter length demand.
    if (bestCandidate.wordCount < hardMinWords) {
      const regenerated = await runRegenerate();
      if (regenerated) {
        const regeneratedIsBetter = regenerated.wordCount >= hardMinWords
          || scoreCandidate(regenerated) < scoreCandidate(bestCandidate)
          || regenerated.wordCount > bestCandidate.wordCount;

        if (regeneratedIsBetter) {
          bestCandidate = regenerated;
        }
      }
    }

    return {
      content: bestCandidate.content,
      wordCount: bestCandidate.wordCount,
      adjusted: bestCandidate.content !== content,
      plan,
    };
  };

  const generateSection = async (sectionName: string) => {
    setIsLoading(true);
    try {
      const rawActivePlan = resolveSectionLengthPlan(sectionName);
      const activePlan = toRuntimePlan(rawActivePlan);
      const { prompt, maxTokens } = PROMPTS.WRITE_SECTION(sectionName, data.outline, activeInfo, activePlan);
      const initialResult = await callGeminiAI(prompt, undefined, undefined, maxTokens);
      if (initialResult) {
        let finalResult = {
          content: initialResult,
          wordCount: estimateWordCount(initialResult),
          adjusted: false,
          plan: activePlan,
        };

        if (activePlan) {
          const hardMinWords = getHardMinWords(activePlan);
          if (finalResult.wordCount < hardMinWords) {
            const strictRewritePrompt = `${prompt}

=== CH? Ð? B?T BU?C Ð? DÀI (TH? L?I 1 L?N) ===
- Vi?t l?i HOÀN CH?NH m?c "${sectionName}".
- Ð? dài b?t bu?c: t? ${hardMinWords} d?n ${activePlan.maxWords} t?.
- C?u trúc t?i thi?u 3 do?n, m?i do?n 3-5 câu.
- Nêu rõ b?i c?nh th?c t? l?p h?c, cách tri?n khai và tiêu chí dánh giá k?t qu?.
- N?u chua d? d? dài, t? b? sung ví d? minh h?a th?c t? cho d? trong cùng l?n tr? l?i.
- Không gi?i thích thêm, ch? tr? v? n?i dung cu?i cùng b?ng Markdown.
============================================

N?i dung hi?n có (dang quá ng?n, ch? d? tham chi?u):
${finalResult.content}`;

            const retriedResult = await callGeminiAI(
              strictRewritePrompt,
              undefined,
              undefined,
              Math.max(maxTokens, activePlan.maxTokens),
            );

            if (retriedResult) {
              const retriedWordCount = estimateWordCount(retriedResult);
              if (retriedWordCount > finalResult.wordCount) {
                finalResult = {
                  content: retriedResult,
                  wordCount: retriedWordCount,
                  adjusted: true,
                  plan: activePlan,
                };
              }
            }
          }
        }

        if (activePlan) {
          const hardMinWords = getHardMinWords(activePlan);
          if (finalResult.wordCount < hardMinWords) {
            const missingWords = hardMinWords - finalResult.wordCount;
            const fallbackAddition = buildSectionAwareFallbackContent(sectionName, activeInfo, missingWords);
            const mergedContent = `${finalResult.content.trim()}\n\n${fallbackAddition}`.trim();

            finalResult = {
              content: mergedContent,
              wordCount: estimateWordCount(mergedContent),
              adjusted: true,
              plan: activePlan,
            };
          }
        }

        setData(prev => ({
          ...prev,
          sections: { ...prev.sections, [sectionName]: finalResult.content }
        }));

        const shortBaselinePlan = toRuntimePlan((finalResult.plan || activePlan) as SectionLengthPlan | null);
        const minRequiredWords = shortBaselinePlan ? getHardMinWords(shortBaselinePlan) : 0;
        const obviouslyShort = finalResult.wordCount < 50;
        const stillShort = obviouslyShort || (minRequiredWords > 0
          && finalResult.wordCount < minRequiredWords);

        const successMessage = finalResult.plan
          ? `Ðã vi?t xong "${sectionName}" v?i kho?ng ${finalResult.wordCount} t? (m?c tiêu ${finalResult.plan.targetWords} t?, t?i thi?u ${minRequiredWords} t?).${finalResult.adjusted ? ' AI dã t? cân l?i d? dài sau khi vi?t.' : ''}${stillShort ? ' N?i dung v?n hoi ng?n, b?n có th? b?m "Vi?t l?i b?ng AI" d? m? r?ng thêm.' : ''} [build ${APP_BUILD_TAG}]`
          : `Ðã vi?t xong "${sectionName}"! [build ${APP_BUILD_TAG}]`;

        Swal.fire(stillShort ? 'C?n m? r?ng thêm' : 'Thành công', successMessage, stillShort ? 'warning' : 'success');
      }
    } catch (error: any) {
      Swal.fire('L?i', error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const confirmRequirements = () => {
    setData(prev => {
      if (prev.confirmedRequirements) {
        return {
          ...prev,
          confirmedRequirements: false,
          lockedInfo: null,
          lockedPageLimit: '',
          lockedLengthPlans: {},
        };
      }

      const lockedInfo = { ...prev.info };
      const lockedPlans = getAllSectionLengthPlans(lockedInfo.pageLimit);
      return {
        ...prev,
        confirmedRequirements: true,
        lockedInfo,
        lockedPageLimit: lockedInfo.pageLimit.trim(),
        lockedLengthPlans: serializeLengthPlans(lockedPlans),
      };
    });
  };

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.removeItem('openai_api_key');
    localStorage.setItem('gemini_model_index', String(selectedModel));
    localStorage.setItem('ai_model_index', String(selectedModel));
    setShowSettings(false);
    Swal.fire('Ðã luu', 'C?u hình dã du?c c?p nh?t!', 'success');
  };
  const exportPDF = () => {
    const element = document.getElementById('preview-content');
    if (!element) return;
    // @ts-ignore
    import('html2pdf.js').then((html2pdf) => {
      const opt = {
        margin: 1,
        filename: `${data.info.title || 'sang-kien-kinh-nghiem'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };
      html2pdf.default().from(element).set(opt).save();
    });
  };

  const renderMarkdown = (content: string): string => {
    // Manually convert markdown tables to HTML before marked.parse
    // because marked sometimes fails with AI-generated table formats
    const convertTables = (md: string): string => {
      const lines = md.split('\n');
      let result = '';
      let i = 0;
      while (i < lines.length) {
        const line = lines[i].trim();
        // Detect table: line starts with | and next line is separator (|---|)
        if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:]*-+/.test(lines[i + 1].trim())) {
          // Parse header
          const headers = line.split('|').filter(c => c.trim() !== '');
          // Skip separator line
          i += 2;
          // Parse data rows
          const rows: string[][] = [];
          while (i < lines.length && lines[i].trim().startsWith('|')) {
            const cells = lines[i].trim().split('|').filter(c => c.trim() !== '');
            // Skip separator-only rows (all dashes)
            if (!cells.every(c => /^[\s:-]+$/.test(c))) {
              rows.push(cells);
            }
            i++;
          }
          // Build HTML table
          let table = '<table style="border-collapse:collapse;width:100%;margin:10pt 0;">';
          table += '<thead><tr>';
          headers.forEach(h => {
            table += `<th style="border:1pt solid #000;padding:4pt 8pt;font-weight:bold;background:#f0f0f0;">${h.trim()}</th>`;
          });
          table += '</tr></thead>';
          if (rows.length > 0) {
            table += '<tbody>';
            rows.forEach(row => {
              table += '<tr>';
              row.forEach(cell => {
                table += `<td style="border:1pt solid #000;padding:4pt 8pt;">${cell.trim()}</td>`;
              });
              table += '</tr>';
            });
            table += '</tbody>';
          }
          table += '</table>';
          result += table + '\n';
        } else {
          result += lines[i] + '\n';
          i++;
        }
      }
      return result;
    };

    const withTables = convertTables(content);
    const html = marked.parse(withTables);
    return typeof html === 'string' ? html : '';
  };
  const resetData = () => {
    Swal.fire({
      title: 'Xóa d? li?u?',
      text: 'T?t c? n?i dung hi?n t?i s? b? xóa!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xóa ngay',
      cancelButtonText: 'H?y'
    }).then((result) => {
      if (result.isConfirmed) {
        setData(INITIAL_DATA);
        localStorage.removeItem('skkn_data_v3');
      }
    });
  };
  const analyzeTitle = async () => {
    if (!activeInfo.title) {
      Swal.fire('L?i', 'Vui lòng nh?p tên d? tài tru?c!', 'warning');
      return;
    }
    setIsAnalyzing(true);
    setShowAnalysis(true);
    setAnalysisResult(null);
    try {
      const prompt = PROMPTS.ANALYZE_TITLE(activeInfo.title, activeInfo.subject);
      const result = await callGeminiAI(prompt);
      if (result) {
        let jsonStr = result.trim();
        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '');
        // Try to extract JSON object from surrounding text
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        const parsed = JSON.parse(jsonStr);
        setAnalysisResult(parsed);
      } else {
        throw new Error('AI không tr? v? k?t qu?');
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      let msg = error.message || 'Vui lòng th? l?i.';
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.toLowerCase().includes('rpm/tpm')) {
        msg = 'B?n dang ch?m gi?i h?n t?c d? theo phút (RPM/TPM), không ph?i h?t quota ngày. Vui lòng ch? 30-60 giây r?i th? l?i.';
      } else if (msg.includes('NOT_FOUND') || msg.includes('404')) {
        msg = 'Model AI không kh? d?ng. H? th?ng dã t? th? model khác; n?u v?n l?i, vui lòng th? l?i sau ít phút.';
      }
      Swal.fire('L?i', msg, 'error');
      setShowAnalysis(false);
    } finally {
      setIsAnalyzing(false);
    }
  };
  const getScoreColor = (score: number, max: number) => {
    const pct = score / max;
    if (pct >= 0.8) return 'bg-green-500';
    if (pct >= 0.6) return 'bg-yellow-400';
    if (pct >= 0.4) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getOverlapColor = (level: string) => {
    if (level === 'Th?p') return 'bg-green-500';
    if (level === 'Trung bình') return 'bg-yellow-400';
    return 'bg-red-500';
  };

  // RENDER: Step 0 - Thông tin
  const renderInfoStep = () => (
    <div className="space-y-6">
      <div className="banner-header">
        <h2 className="text-2xl font-bold">Thi?t l?p Thông tin Sáng ki?n</h2>
        <p className="text-white/80 mt-1">Cung c?p thông tin chính xác d? AI t?o ra b?n th?o ch?t lu?ng nh?t</p>
      </div>

      <fieldset disabled={hasLockedSession} className="contents">
        <div className="content-card space-y-6">
          <h3 className="section-title">1. Thông tin b?t bu?c</h3>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tên d? tài SKKN <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Pencil size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.title}
                  onChange={(e) => handleUpdateInfo('title', e.target.value)}
                  placeholder='VD: "?ng d?ng AI d? nâng cao hi?u qu? d?y h?c môn Toán THPT"'
                  className="form-input-icon"
                />
              </div>
              <button
                onClick={analyzeTitle}
                disabled={!data.info.title || isAnalyzing}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <Search size={14} /> {isAnalyzing ? 'Ðang phân tích...' : 'Phân tích'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Môn h?c/Linh v?c <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <select
                  value={data.info.subject}
                  onChange={(e) => handleUpdateInfo('subject', e.target.value)}
                  className="form-input-icon appearance-none"
                >
                  <option value="">-- Ch?n môn h?c --</option>
                  <option value="Toán">Toán</option>
                  <option value="Ng? van">Ng? van</option>
                  <option value="Ti?ng Anh">Ti?ng Anh</option>
                  <option value="V?t lý">V?t lý</option>
                  <option value="Hóa h?c">Hóa h?c</option>
                  <option value="Sinh h?c">Sinh h?c</option>
                  <option value="L?ch s?">L?ch s?</option>
                  <option value="Ð?a lý">Ð?a lý</option>
                  <option value="GDCD/GDKT&PL">GDCD/GDKT&amp;PL</option>
                  <option value="Tin h?c">Tin h?c</option>
                  <option value="Công ngh?">Công ngh?</option>
                  <option value="Th? d?c">Th? d?c</option>
                  <option value="Âm nh?c">Âm nh?c</option>
                  <option value="M? thu?t">M? thu?t</option>
                  <option value="Khoa h?c t? nhiên">Khoa h?c t? nhiên</option>
                  <option value="Khoa h?c xã h?i">Khoa h?c xã h?i</option>
                  <option value="Ho?t d?ng tr?i nghi?m">Ho?t d?ng tr?i nghi?m</option>
                  <option value="Giáo d?c qu?c phòng">Giáo d?c qu?c phòng</option>
                  <option value="Ti?ng Pháp">Ti?ng Pháp</option>
                  <option value="Ti?ng Trung">Ti?ng Trung</option>
                  <option value="Ti?ng Nh?t">Ti?ng Nh?t</option>
                  <option value="Ð?o d?c">Ð?o d?c</option>
                  <option value="T? nhiên và Xã h?i">T? nhiên và Xã h?i</option>
                  <option value="Qu?n lý giáo d?c">Qu?n lý giáo d?c</option>
                  <option value="Giáo d?c m?m non">Giáo d?c m?m non</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">C?p h?c</label>
              <div className="relative">
                <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <select
                  value={data.info.level}
                  onChange={(e) => handleUpdateInfo('level', e.target.value)}
                  className="form-input-icon appearance-none"
                >
                  <option value="">-- Ch?n c?p h?c --</option>
                  <option value="Ti?u h?c">Ti?u h?c</option>
                  <option value="THCS">THCS</option>
                  <option value="THPT">THPT</option>
                  <option value="M?m non">M?m non</option>
                  <option value="Liên c?p">Liên c?p</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kh?i l?p</label>
              <div className="relative">
                <School size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.grade}
                  onChange={(e) => handleUpdateInfo('grade', e.target.value)}
                  placeholder="VD: L?p 12, Kh?i 6-9"
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tên tru?ng / Ðon v? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.info.school}
                onChange={(e) => handleUpdateInfo('school', e.target.value)}
                placeholder={`VD: Tr\u01b0\u1eddng THPT Nguy\u1ec5n Du`}
                className="form-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {`\u0110\u1ecba \u0111i\u1ec3m (Huy\u1ec7n, T\u1ec9nh)`} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.location}
                  onChange={(e) => handleUpdateInfo('location', e.target.value)}
                  placeholder={`VD: Qu\u1eadn 1, TP.HCM`}
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {`\u0110i\u1ec1u ki\u1ec7n CSVC (Tivi, M\u00e1y chi\u1ebfu, WiFi...)`} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Monitor size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={data.info.facilities}
                onChange={(e) => handleUpdateInfo('facilities', e.target.value)}
                placeholder={`VD: Ph\u00f2ng m\u00e1y chi\u1ebfu, Tivi th\u00f4ng minh, Internet \u1ed5n \u0111\u1ecbnh...`}
                className="form-input-icon"
              />
            </div>
          </div>
        </div>

        <div className="content-card space-y-6">
          <h3 className="section-title">
            {`2. Th\u00f4ng tin b\u1ed5 sung`}
            <span className="text-xs text-amber-500 font-normal ml-2 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              {`(Khuy\u00ean d\u00f9ng \u0111\u1ec3 t\u0103ng chi ti\u1ebft)`}
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sách giáo khoa</label>
              <div className="relative">
                <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.textbook}
                  onChange={(e) => handleUpdateInfo('textbook', e.target.value)}
                  placeholder={`VD: K\u1ebft n\u1ed1i tri th\u1ee9c, C\u00e1nh di\u1ec1u...`}
                  className="form-input-icon"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{`\u0110\u1ed1i t\u01b0\u1ee3ng nghi\u00ean c\u1ee9u`}</label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.target}
                  onChange={(e) => handleUpdateInfo('target', e.target.value)}
                  placeholder={`VD: 45 HS l\u1edbp 12A (th\u1ef1c nghi\u1ec7m)...`}
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{`Th\u1eddi gian th\u1ef1c hi\u1ec7n`}</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.duration}
                  onChange={(e) => handleUpdateInfo('duration', e.target.value)}
                  placeholder={`VD: N\u0103m h\u1ecdc 2024-2025`}
                  className="form-input-icon"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{`\u1ee8ng d\u1ee5ng AI/C\u00f4ng ngh\u1ec7`}</label>
              <div className="relative">
                <Cpu size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.techUsed}
                  onChange={(e) => handleUpdateInfo('techUsed', e.target.value)}
                  placeholder={`VD: S\u1eed d\u1ee5ng ChatGPT, Canva, Padlet...`}
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{`\u0110\u1eb7c th\u00f9 / Tr\u1ecdng t\u00e2m \u0111\u1ec1 t\u00e0i`}</label>
            <div className="relative">
              <Target size={16} className="absolute left-3 top-3.5 text-slate-400" />
              <textarea
                value={data.info.focus}
                onChange={(e) => handleUpdateInfo('focus', e.target.value)}
                placeholder={`M\u00f4 t\u1ea3 ng\u1eafn g\u1ecdn v\u1ec1 \u0111\u1eb7c th\u00f9 ho\u1eb7c tr\u1ecdng t\u00e2m c\u1ee7a \u0111\u1ec1 t\u00e0i...`}
                rows={2}
                className="form-input-icon resize-none"
              />
            </div>
          </div>
        </div>

        <div className="content-card space-y-6">
          <h3 className="section-title">
            {`4. Y\u00eau c\u1ea7u kh\u00e1c`}
            <span className="text-xs text-slate-400 font-normal ml-2">{`(T\u00f9y ch\u1ecdn - AI s\u1ebd tu\u00e2n th\u1ee7 nghi\u00eam ng\u1eb7t)`}</span>
          </h3>

          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={data.info.extraExamples}
                onChange={(e) => handleUpdateInfo('extraExamples', e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-amber-300 text-amber-500 focus:ring-amber-200"
              />
              <span className="text-sm">
                <span className="font-bold text-amber-600">{`\uD83D\uDCCA Th\u00eam nhi\u1ec1u`}</span>{' '}
                <span className="font-bold text-amber-600">{`b\u00e0i to\u00e1n th\u1ef1c t\u1ebf, v\u00ed d\u1ee5 minh h\u1ecda`}</span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={data.info.extraTables}
                onChange={(e) => handleUpdateInfo('extraTables', e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-purple-300 text-purple-500 focus:ring-purple-200"
              />
              <span className="text-sm">
                <span className="font-bold text-purple-600">{`\uD83D\uDCC8 B\u1ed5 sung`}</span>{' '}
                <span className="font-bold text-purple-600">{`b\u1ea3ng bi\u1ec3u, s\u1ed1 li\u1ec7u th\u1ed1ng k\u00ea`}</span>
              </span>
            </label>

            <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3">
              <span className="text-sm text-purple-700 dark:text-purple-300">{`\uD83D\uDCC4 S\u1ed1 trang SKKN c\u1ea7n gi\u1edbi h\u1ea1n:`}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={data.info.pageLimit}
                onChange={(e) => handleUpdateInfo('pageLimit', e.target.value)}
                placeholder="VD: 18"
                disabled={hasLockedSession}
                className="w-24 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-slate-400">{`(\u0110\u1ec3 tr\u1ed1ng n\u1ebfu kh\u00f4ng gi\u1edbi h\u1ea1n)`}</span>
            </div>

            {hasLockedSession && (
              <div className="hint-box">
                <p>
                  {`\u0110\u00e3 kh\u00f3a to\u00e0n b\u1ed9 c\u1ea5u h\u00ecnh phi\u00ean vi\u1ebft hi\u1ec7n t\u1ea1i`}
                  {data.lockedPageLimit ? `, trong \u0111\u00f3 s\u1ed1 trang \u0111\u01b0\u1ee3c ch\u1ed1t \u1edf m\u1ee9c ${data.lockedPageLimit} trang.` : '.'}
                  {' '}{`C\u00e1c checkbox, y\u00eau c\u1ea7u b\u1ed5 sung v\u00e0 th\u00f4ng tin m\u00f4 t\u1ea3 s\u1ebd gi\u1eef nguy\u00ean cho \u0111\u1ebfn khi b\u1ea1n m\u1edf kh\u00f3a.`}
                </p>
              </div>
            )}

            {sectionLengthPlans.length > 0 && (
              <div className="info-box space-y-2">
                <p className="font-semibold">
                  {hasLockedSession
                    ? `Ph\u00e2n b\u1ed5 \u0111\u00e3 kh\u00f3a cho l\u01b0\u1ee3t vi\u1ebft hi\u1ec7n t\u1ea1i (${activePageLimitLabel} trang)`
                    : `Ph\u00e2n b\u1ed5 \u0111\u1ed9 d\u00e0i d\u1ef1 ki\u1ebfn theo gi\u1edbi h\u1ea1n ${activePageLimitLabel} trang`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {sectionLengthPlans.map((plan) => (
                    <div
                      key={plan.sectionName}
                      className="flex items-start justify-between gap-3 rounded-lg bg-white/70 dark:bg-slate-900/30 px-3 py-2"
                    >
                      <span className="leading-relaxed">{plan.sectionName}</span>
                      <span className="font-semibold whitespace-nowrap">~{plan.targetPagesLabel} trang ({plan.targetWords} {`t\u1eeb`})</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs opacity-80">
                  {hasLockedSession
                    ? `M\u1ed7i l\u1ea7n vi\u1ebft ti\u1ebfp theo s\u1ebd d\u00f9ng \u0111\u00fang snapshot n\u00e0y, bao g\u1ed3m checkbox v\u00e0 y\u00eau c\u1ea7u b\u1ed5 sung, cho \u0111\u1ebfn khi b\u1ea1n m\u1edf kh\u00f3a.`
                    : `App s\u1ebd d\u00f9ng ph\u00e2n b\u1ed5 n\u00e0y khi g\u1ecdi AI v\u00e0 t\u1ef1 bi\u00ean t\u1eadp l\u1ea1i n\u1ebfu m\u1ee5c n\u00e0o l\u1ec7ch qu\u00e1 xa kh\u1ecfi m\u1ee9c \u0111\u00e3 chia.`}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{`Y\u00eau c\u1ea7u b\u1ed5 sung kh\u00e1c (t\u00f9y \u00fd):`}</label>
            <textarea
              value={data.info.customRequirements}
              onChange={(e) => handleUpdateInfo('customRequirements', e.target.value)}
              placeholder={`Nh\u1eadp c\u00e1c y\u00eau c\u1ea7u \u0111\u1eb7c bi\u1ec7t kh\u00e1c c\u1ee7a b\u1ea1n. V\u00ed d\u1ee5:
• Vi\u1ebft ng\u1eafn g\u1ecdn ph\u1ea7n c\u01a1 s\u1edf l\u00fd lu\u1eadn (kho\u1ea3ng 3 trang)
• T\u1eadp trung v\u00e0o gi\u1ea3i ph\u00e1p \u1ee9ng d\u1ee5ng AI
• Vi\u1ebft theo phong c\u00e1ch h\u1ecdc thu\u1eadt nghi\u00eam t\u00fac...`}
              rows={4}
              className="form-input resize-none"
            />
          </div>
        </div>
      </fieldset>

      <button onClick={confirmRequirements} className={hasLockedSession ? 'btn-confirmed' : 'btn-confirm'}>
        {hasLockedSession ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {`\u0110\u00e3 kh\u00f3a phi\u00ean vi\u1ebft - B\u1ea5m \u0111\u1ec3 m\u1edf kh\u00f3a v\u00e0 s\u1eeda l\u1ea1i`}
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Save size={18} /> {`X\u00e1c nh\u1eadn l\u01b0u c\u00e1c y\u00eau c\u1ea7u n\u00e0y`}
          </span>
        )}
      </button>

      {hasLockedSession && (
        <p className="text-center text-xs text-green-600 dark:text-green-400">
          {`C\u00e1c y\u00eau c\u1ea7u \u0111\u00e3 \u0111\u01b0\u1ee3c l\u01b0u! AI s\u1ebd tu\u00e2n th\u1ee7 NGHI\u00caM NG\u1eb6T khi vi\u1ebft SKKN.`}
        </p>
      )}

      <div className="content-card space-y-5">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 italic">{`T\u00f9y ch\u1ecdn kh\u1edfi t\u1ea1o`}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => { goToStep(1); }}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-all"
          >
            <Sparkles size={18} /> {`AI L\u1eadp D\u00e0n \u00dd Chi Ti\u1ebft`}
          </button>
          <button className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <FileText size={18} /> {`S\u1eed D\u1ee5ng D\u00e0n \u00dd C\u00f3 S\u1eb5n`}
          </button>
        </div>
        <div className="info-box flex items-start gap-2">
          <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
          <p>{`H\u1ec7 th\u1ed1ng AI s\u1ebd t\u1ef1 \u0111\u1ed9ng ph\u00e2n t\u00edch \u0111\u1ec1 t\u00e0i v\u00e0 t\u1ea1o ra d\u00e0n \u00fd chi ti\u1ebft g\u1ed3m 6 ph\u1ea7n chu\u1ea9n B\u1ed9 GD&\u0110T. B\u1ea1n c\u00f3 th\u1ec3 ch\u1ec9nh s\u1eeda l\u1ea1i sau khi t\u1ea1o xong.`}</p>
        </div>
        <button
          onClick={() => { goToStep(1); generateOutline(); }}
          disabled={!data.info.title || isLoading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {`B\u1eaft \u0111\u1ea7u l\u1eadp d\u00e0n \u00fd ngay`}
        </button>
      </div>
    </div>
  );
  const renderOutlineStep = () => (
    <div className="space-y-6">
      <div className="banner-header">
        <h2 className="text-2xl font-bold">{`L\u1eadp D\u00e0n \u00dd SKKN`}</h2>
        <p className="text-white/80 mt-1">{`X\u00e2y d\u1ef1ng khung s\u01b0\u1eddn chi ti\u1ebft cho S\u00e1ng ki\u1ebfn kinh nghi\u1ec7m`}</p>
      </div>

      {data.outline ? (
        <div className="content-card space-y-4">
          <div className="doc-preview-bar">
            <div className="dot bg-red-400" />
            <div className="dot bg-amber-400" />
            <div className="dot bg-green-400" />
            <span className="ml-2 text-xs text-slate-500">{`\uD83D\uDCC4 B\u1ea3n th\u1ea3o SKKN.docx`}</span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-b-xl border border-slate-100 dark:border-slate-700 min-h-[400px]">
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(data.outline) }} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={generateOutline} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary-dark transition-colors"><Sparkles size={14} /> {`T\u1ea1o l\u1ea1i d\u00e0n \u00fd`}</button>
            <button onClick={() => goToStep(2)} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">{`Ti\u1ebfp t\u1ee5c vi\u1ebft n\u1ed9i dung`} <ChevronRight size={14} /></button>
          </div>
          <details className="mt-4">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-primary transition-colors">{`Ch\u1ec9nh s\u1eeda d\u00e0n \u00fd (Markdown)`}</summary>
            <textarea value={data.outline} onChange={(e) => setData(prev => ({ ...prev, outline: e.target.value }))} className="w-full mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm resize-none min-h-[300px]" />
          </details>
        </div>
      ) : (
        <div className="content-card flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Layout size={40} /></div>
          <div>
            <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">{`Ch\u01b0a c\u00f3 d\u00e0n \u00fd`}</p>
            <p className="text-sm text-slate-400 mt-1">{`Nh\u1ea5n n\u00fat b\u00ean d\u01b0\u1edbi \u0111\u1ec3 AI t\u1ea1o d\u00e0n \u00fd chi ti\u1ebft`}</p>
          </div>
          <button onClick={generateOutline} disabled={isLoading || !data.info.title} className="btn-primary max-w-sm disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? `\u0110ang t\u1ea1o d\u00e0n \u00fd...` : `T\u1ea1o d\u00e0n \u00fd b\u1eb1ng AI`}</button>
        </div>
      )}
    </div>
  );

  const renderWriteStep = (stepId: number) => {
    const sectionName = SECTION_MAP[stepId];
    if (!sectionName) return null;
    const content = data.sections[sectionName] || '';

    return (
      <div className="space-y-6">
        <div className="banner-header">
          <h2 className="text-2xl font-bold">{STEPS[stepId].title}</h2>
          <p className="text-white/80 mt-1">{STEPS[stepId].desc}</p>
        </div>

        <div className="content-card space-y-4">
          {content ? (
            <>
              <div className="doc-preview-bar">
                <div className="dot bg-red-400" />
                <div className="dot bg-amber-400" />
                <div className="dot bg-green-400" />
                <span className="ml-2 text-xs text-slate-500">{`\uD83D\uDCC4 `}{sectionName}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-b-xl border border-slate-100 dark:border-slate-700 min-h-[300px]">
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => generateSection(sectionName)} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50"><Sparkles size={14} /> {`Vi\u1ebft l\u1ea1i b\u1eb1ng AI`}</button>
                {stepId < 16 && (
                  <button onClick={() => goToStep(stepId + 1)} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">{`Ti\u1ebfp t\u1ee5c`} <ChevronRight size={14} /></button>
                )}
              </div>
              <details className="mt-2">
                <summary className="text-sm text-slate-500 cursor-pointer hover:text-primary">{`Ch\u1ec9nh s\u1eeda n\u1ed9i dung`}</summary>
                <textarea value={content} onChange={(e) => setData(prev => ({ ...prev, sections: { ...prev.sections, [sectionName]: e.target.value } }))} className="w-full mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm resize-none min-h-[300px] outline-none" />
              </details>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><PenTool size={40} /></div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">{`Ch\u01b0a c\u00f3 n\u1ed9i dung`}</p>
                <p className="text-sm text-slate-400 mt-1">{`Nh\u1ea5n n\u00fat b\u00ean d\u01b0\u1edbi \u0111\u1ec3 AI vi\u1ebft ph\u1ea7n n\u00e0y`}</p>
              </div>
              <div className="info-box max-w-md text-left"><p>{`AI s\u1ebd d\u1ef1a tr\u00ean d\u00e0n \u00fd \u0111\u00e3 t\u1ea1o \u0111\u1ec3 vi\u1ebft n\u1ed9i dung chi ti\u1ebft cho ph\u1ea7n `}<strong>{sectionName}</strong>.</p></div>
              <button onClick={() => generateSection(sectionName)} disabled={isLoading} className="btn-primary max-w-sm disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? `\u0110ang vi\u1ebft...` : `AI vi\u1ebft "${STEPS[stepId].title}"`}</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const buildDraftLengthMetrics = (sectionsMap = data.sections) => {
    const items = SECTION_ORDER.flatMap((sectionName) => {
      const rawPlan = resolveSectionLengthPlan(sectionName);
      const plan = toRuntimePlan(rawPlan);
      const content = sectionsMap[sectionName] || '';

      if (!plan || !content.trim()) return [];

      const wordCount = estimateWordCount(content);
      return [{
        sectionName,
        content,
        plan,
        wordCount,
        availableExpand: Math.max(0, plan.maxWords - wordCount),
        availableShrink: Math.max(0, wordCount - plan.minWords),
        targetDelta: plan.targetWords - wordCount,
      }];
    });

    const totalActualWords = items.reduce((sum, item) => sum + item.wordCount, 0);
    const totalTargetWords = items.reduce((sum, item) => sum + item.plan.targetWords, 0);
    const totalDeltaWords = totalTargetWords - totalActualWords;
    const totalActualPages = (totalActualWords / EXPORT_WORDS_PER_PAGE).toFixed(1);
    const totalTargetPages = totalTargetWords > 0 ? (totalTargetWords / EXPORT_WORDS_PER_PAGE).toFixed(1) : '0.0';
    const overallToleranceWords = totalTargetWords > 0
      ? Math.max(120, Math.round(totalTargetWords * EXPORT_TOTAL_TOLERANCE_RATIO))
      : 0;

    return {
      items,
      totalActualWords,
      totalTargetWords,
      totalDeltaWords,
      totalActualPages,
      totalTargetPages,
      overallToleranceWords,
      needsNormalization: totalTargetWords > 0 && Math.abs(totalDeltaWords) > overallToleranceWords,
    };
  };

  const retargetSectionPlan = (plan: SectionLengthPlan, targetWords: number): SectionLengthPlan => {
    const safeTargetWords = Math.max(60, Math.round(targetWords));
    const minWords = Math.max(1, Math.round(safeTargetWords * 0.5));
    const maxWords = Math.max(minWords, Math.round(safeTargetWords * 1.2));

    return {
      ...plan,
      targetWords: safeTargetWords,
      targetPages: Number((safeTargetWords / EXPORT_WORDS_PER_PAGE).toFixed(1)),
      targetPagesLabel: (safeTargetWords / EXPORT_WORDS_PER_PAGE).toFixed(1),
      minWords,
      maxWords,
      maxTokens: Math.min(8192, Math.max(512, Math.round((maxWords + 60) * 2.4))),
    };
  };

  const buildExportNormalizationRequests = (metrics: any) => {
    if (!metrics.needsNormalization) return [];

    const mode = metrics.totalDeltaWords > 0 ? 'expand' : 'shorten';
    const candidates = metrics.items
      .map((item: any) => ({
        ...item,
        capacity: mode === 'expand' ? item.availableExpand : item.availableShrink,
        priority: mode === 'expand'
          ? Math.max(0, item.plan.targetWords - item.wordCount)
          : Math.max(0, item.wordCount - item.plan.targetWords),
      }))
      .filter((item: any) => item.capacity >= 20)
      .sort((a: any, b: any) => (b.priority + b.capacity * 0.25) - (a.priority + a.capacity * 0.25))
      .slice(0, MAX_EXPORT_SECTIONS_PER_PASS);

    let remaining = Math.abs(metrics.totalDeltaWords);
    const requests: Array<{
      sectionName: string;
      mode: 'expand' | 'shorten';
      targetWords: number;
      currentWords: number;
      adjustedPlan: SectionLengthPlan;
    }> = [];

    candidates.forEach((candidate: any, index: number) => {
      if (remaining <= 0) return;

      const slotsLeft = Math.max(1, candidates.length - index);
      let requestedChange = Math.round(remaining / slotsLeft);

      if (remaining >= EXPORT_MIN_SECTION_ADJUSTMENT && candidate.capacity >= EXPORT_MIN_SECTION_ADJUSTMENT) {
        requestedChange = Math.max(EXPORT_MIN_SECTION_ADJUSTMENT, requestedChange);
      }

      requestedChange = Math.min(candidate.capacity, requestedChange, remaining);
      if (requestedChange < 20) return;

      remaining -= requestedChange;
      const targetWords = mode === 'expand'
        ? candidate.wordCount + requestedChange
        : candidate.wordCount - requestedChange;

      requests.push({
        sectionName: candidate.sectionName,
        mode,
        targetWords,
        currentWords: candidate.wordCount,
        adjustedPlan: retargetSectionPlan(candidate.plan, targetWords),
      });
    });

    return requests;
  };

  const normalizeDraftForExport = async (silent = false) => {
    if (!hasLockedSession && !activeInfo.pageLimit.trim()) {
      const currentMetrics = buildDraftLengthMetrics(data.sections);
      return {
        sections: { ...data.sections },
        changed: false,
        adjustedSections: 0,
        before: currentMetrics,
        after: currentMetrics,
      };
    }

    const before = buildDraftLengthMetrics(data.sections);
    if (!before.totalTargetWords) {
      return {
        sections: { ...data.sections },
        changed: false,
        adjustedSections: 0,
        before,
        after: before,
      };
    }

    let workingSections = { ...data.sections };
    let adjustedSections = 0;
    let pass = 0;

    while (pass < MAX_EXPORT_NORMALIZATION_PASSES) {
      const metrics = buildDraftLengthMetrics(workingSections);
      if (!metrics.needsNormalization) break;

      const requests = buildExportNormalizationRequests(metrics);
      if (!requests.length) break;

      for (const request of requests) {
        const currentContent = workingSections[request.sectionName] || '';
        if (!currentContent.trim()) continue;

        const rewritePrompt = PROMPTS.REWRITE_SECTION_LENGTH(
          request.sectionName,
          currentContent,
          activeInfo,
          request.adjustedPlan,
          request.mode,
        );

        const revisedContent = await callGeminiAI(
          rewritePrompt,
          undefined,
          undefined,
          request.adjustedPlan.maxTokens,
        );

        if (revisedContent && revisedContent.trim()) {
          const currentDistance = Math.abs(request.adjustedPlan.targetWords - request.currentWords);
          const revisedWords = estimateWordCount(revisedContent);
          const revisedDistance = Math.abs(request.adjustedPlan.targetWords - revisedWords);
          const movedInRightDirection = request.mode === 'shorten'
            ? revisedWords < request.currentWords
            : revisedWords > request.currentWords;

          if (revisedDistance <= currentDistance || movedInRightDirection) {
            workingSections[request.sectionName] = revisedContent;
            adjustedSections += 1;
          }
        }
      }

      pass += 1;
    }

    const after = buildDraftLengthMetrics(workingSections);
    const changed = SECTION_ORDER.some((sectionName) => (workingSections[sectionName] || '') !== (data.sections[sectionName] || ''));

    if (changed) {
      setData((prev) => ({
        ...prev,
        sections: { ...prev.sections, ...workingSections },
      }));
    }

    if (!silent) {
      const summaryText = after.totalTargetWords
        ? `T?ng hi?n t?i kho?ng ${after.totalActualWords} t? (~${after.totalActualPages} trang), m?c tiêu ${after.totalTargetWords} t? (~${after.totalTargetPages} trang).`
        : `T?ng hi?n t?i kho?ng ${after.totalActualWords} t?.`;

      Swal.fire(
        changed ? 'Ðã chu?n hóa tru?c khi xu?t' : 'Không c?n chu?n hóa thêm',
        changed
          ? `${summaryText} App dã cân l?i ${adjustedSections} m?c d? kéo t?ng d? dài sát m?c tiêu hon.`
          : `${summaryText} B?n th?o hi?n dã khá sát gi?i h?n b?n d?t ra.`,
        changed ? 'success' : 'info',
      );
    }

    return {
      sections: workingSections,
      changed,
      adjustedSections,
      before,
      after,
    };
  };

  const handleNormalizeBeforeExport = async () => {
    setIsLoading(true);
    try {
      await normalizeDraftForExport();
    } catch (error: any) {
      Swal.fire('L?i', error.message || 'Không th? chu?n hóa toàn bài tru?c khi xu?t.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const exportMarkdown = async () => {
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    setIsLoading(true);
    try {
      const { sections } = await normalizeDraftForExport(true);
      const allContent = SECTION_ORDER.map((sectionName) => sections[sectionName] || '').join('\n\n---\n\n');
      const blob = new Blob([allContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SKKN_' + (activeInfo.title || 'export') + '.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      Swal.fire('Loi', error.message || 'Khong the chuan hoa va xuat Markdown.', 'error');
    } finally {
      setIsLoading(false);
      exportInFlightRef.current = false;
    }
  };  // ==========================================
  // Export to DOCX (Word-compatible HTML)
  // ==========================================
  const exportToDocx = async () => {
    if (exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    setIsLoading(true);
    try {
      const exportSections = { ...data.sections };

      const getSectionHtml = (stepId: number) => {
        const sectionName = SECTION_MAP[stepId];
        let md = exportSections[sectionName] || '';
        if (!md) return '';

        md = md.replace(/^.*[Dd]u?i dây.*$/gm, '');
        md = md.replace(/^.*n?i dung chi ti?t.*$/gm, '');
        md = md.replace(/^.*du?c (vi?t|trình bày) theo.*$/gm, '');
        md = md.replace(/^.*yêu c?u v? d? dài.*$/gm, '');
        md = md.replace(/^.*van phong và các nguyên t?c.*$/gm, '');
        md = md.replace(/^.*các nguyên t?c dã d? ra.*$/gm, '');
        md = md.replace(/^.*[Pp]h?n này trình bày.*$/gm, '');
        md = md.replace(/^.*[Ss]au dây là.*$/gm, '');
        md = md.replace(/^.*\([Kk]ho?ng \d+.*\).*$/gm, '');

        md = md.replace(/^#{0,6}\s*I\.\s*(Ð?T V?N Ð?|Ð?t v?n d?).*$/gim, '');
        md = md.replace(/^#{0,6}\s*II\.\s*(N?I DUNG|N?i dung).*$/gim, '');
        md = md.replace(/^#{0,6}\s*III\.\s*(KI?N NGH?|Ki?n ngh?|K?T QU?|K?t qu?).*$/gim, '');
        md = md.replace(/^#{0,6}\s*Ph?n\s*[IVX]+\.\s*.*$/gim, '');
        md = md.replace(/^#{0,6}\s*I{1,3}[\.\d]*[\.\-\s].*?(Ð?t v?n d?|Lí do ch?n d? tài|Lý do ch?n d? tài|M?c dích nghiên c?u|Ð?i tu?ng nghiên c?u|Ð?i tu?ng kh?o sát|Phuong pháp nghiên c?u|Ph?m vi tri?n khai|Hi?n tr?ng|Th?c tr?ng|Co s? lí lu?n|Gi?i pháp|Các bi?n pháp|K?t qu?|Hi?u qu?|Hi?u qu? d?t du?c|Tính kh? thi|Kinh phí|Ki?n ngh?|Ð?T V?N Ð?|N?I DUNG).*$/gim, '');
        md = md.replace(/^#{0,6}\s*\d+[\.\)]\s*(Lí do ch?n d? tài|Lý do ch?n d? tài|M?c dích nghiên c?u|Ð?i tu?ng nghiên c?u|Ð?i tu?ng kh?o sát|Phuong pháp nghiên c?u|Ph?m vi tri?n khai|Co s? lí lu?n|Th?c tr?ng|Hi?n tr?ng|Các bi?n pháp|Gi?i pháp|K?t qu?|Hi?u qu?|Hi?u qu? d?t du?c|Tính kh? thi|Th?i gian th?c hi?n|Kinh phí|Ki?n ngh?).*$/gim, '');
        md = md.replace(/\n{3,}/g, '\n\n');
        md = md.trim();

        let html = renderMarkdown(md);
        html = html.replace(/\$/g, '');
        html = html.replace(/\\/g, '');
        return html;
      };

      const bodyHtml = `
<h1 style="text-align:center; font-size:16pt; font-weight:bold;">N?I DUNG SÁNG KI?N KINH NGHI?M</h1>

<h2 style="font-size:14pt; font-weight:bold;">PH?N M? Ð?U</h2>

<h3 style="font-size:13pt; font-weight:bold;">I. LÝ DO CH?N Ð? TÀI</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(2)}</div>

<h3 style="font-size:13pt; font-weight:bold;">II. M?C ÐÍCH NGHIÊN C?U</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(3)}</div>

<h3 style="font-size:13pt; font-weight:bold;">III. Ð?I TU?NG NGHIÊN C?U</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(4)}</div>

<h3 style="font-size:13pt; font-weight:bold;">IV. Ð?I TU?NG KH?O SÁT TH?C NGHI?M</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(5)}</div>

<h3 style="font-size:13pt; font-weight:bold;">V. PHUONG PHÁP NGHIÊN C?U</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(6)}</div>

<h3 style="font-size:13pt; font-weight:bold;">VI. PH?M VI VÀ K? HO?CH NGHIÊN C?U</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(7)}</div>

<h2 style="font-size:14pt; font-weight:bold;">PH?N N?I DUNG</h2>

<h3 style="font-size:13pt; font-weight:bold;">I. CO S? LÝ LU?N</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(8)}</div>

<h3 style="font-size:13pt; font-weight:bold;">II. TH?C TR?NG</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(9)}</div>

<h3 style="font-size:13pt; font-weight:bold;">III. BI?N PHÁP TH?C HI?N</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(10)}</div>

<h3 style="font-size:13pt; font-weight:bold;">IV. K?T QU? Ð?T ÐU?C</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(11)}</div>

<h2 style="font-size:14pt; font-weight:bold;">PH?N K?T LU?N</h2>

<h3 style="font-size:13pt; font-weight:bold;">I. K?T LU?N CHUNG</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(12)}</div>

<h3 style="font-size:13pt; font-weight:bold;">II. BÀI H?C KINH NGHI?M</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(13)}</div>

<h3 style="font-size:13pt; font-weight:bold;">III. Ð? XU?T - KHUY?N NGH?</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(14)}</div>

<h2 style="font-size:14pt; font-weight:bold;">PH? L?C</h2>
<div style="margin-bottom:12pt;">${getSectionHtml(15)}</div>
`;

      const docHtml = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<meta name="Originator" content="Microsoft Word 15">
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page {
    size: A4;
    margin: 2.54cm 3.18cm 2.54cm 3.18cm;
  }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 13pt;
    line-height: 1.5;
    color: #000;
  }
  h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-top: 12pt; margin-bottom: 6pt; }
  h2 { font-size: 14pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
  h3 { font-size: 13pt; font-weight: bold; margin-top: 10pt; margin-bottom: 4pt; }
  h4 { font-size: 13pt; font-weight: bold; font-style: italic; margin-top: 8pt; margin-bottom: 4pt; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
  th, td { border: 1pt solid #000; padding: 4pt 8pt; font-size: 13pt; text-align: left; }
  th { font-weight: bold; background-color: #f0f0f0; }
  p { margin-top: 0; margin-bottom: 6pt; text-align: justify; text-indent: 1.27cm; }
  ul, ol { margin-left: 1cm; margin-bottom: 6pt; }
  li { margin-bottom: 3pt; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 12pt; }
  th, td { border: 1pt solid #000; padding: 4pt 8pt; font-size: 12pt; }
  th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
  blockquote { margin-left: 1cm; padding-left: 10pt; border-left: 3pt solid #ccc; font-style: italic; }
  code { font-family: 'Courier New', monospace; font-size: 11pt; background-color: #f5f5f5; padding: 1pt 4pt; }
  pre { font-family: 'Courier New', monospace; font-size: 11pt; background-color: #f5f5f5; padding: 8pt; margin-bottom: 6pt; white-space: pre-wrap; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  hr { border: none; border-top: 1pt solid #999; margin: 12pt 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

      const blob = new Blob(['\ufeff' + docHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SKKN_${activeInfo.title || 'export'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      Swal.fire('L\u1ed7i', error.message || 'Kh\u00f4ng th\u1ec3 xu\u1ea5t file Word.', 'error');
    } finally {
      setIsLoading(false);
      exportInFlightRef.current = false;
    }
  };
  const renderExportStep = () => {
    const allSections = Object.keys(SECTION_MAP).map(k => Number(k));
    const completedSections = allSections.filter(k => !!data.sections[SECTION_MAP[k]]);
    const totalSections = allSections.length;
    const progress = Math.round((completedSections.length / totalSections) * 100);
    const draftLengthMetrics = buildDraftLengthMetrics();
    const draftDeltaLabel = draftLengthMetrics.totalDeltaWords === 0
      ? 'Ðang kh?p r?t sát m?c tiêu t?ng th?.'
      : draftLengthMetrics.totalDeltaWords > 0
        ? `Toàn bài hi?n còn thi?u kho?ng ${draftLengthMetrics.totalDeltaWords} t? (~${(draftLengthMetrics.totalDeltaWords / EXPORT_WORDS_PER_PAGE).toFixed(1)} trang).`
        : `Toàn bài hi?n dang dài hon kho?ng ${Math.abs(draftLengthMetrics.totalDeltaWords)} t? (~${(Math.abs(draftLengthMetrics.totalDeltaWords) / EXPORT_WORDS_PER_PAGE).toFixed(1)} trang).`;

    return (
      <div className="space-y-6">
        <div className="banner-header">
          <h2 className="text-2xl font-bold">{`Xu\u1ea5t SKKN`}</h2>
          <p className="text-white/80 mt-1">{`T\u1ed5ng h\u1ee3p v\u00e0 xu\u1ea5t file ho\u00e0n ch\u1ec9nh`}</p>
        </div>
        <div className="content-card space-y-5">
          <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200">{`Ti\u1ebfn \u0111\u1ed9 ho\u00e0n th\u00e0nh`}</h3>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          <p className="text-sm text-slate-500">{completedSections.length}/{totalSections} ph?n dã hoàn thành ({progress}%)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allSections.map(k => {
              const done = !!data.sections[SECTION_MAP[k]];
              return (
                <div key={k} onClick={() => goToStep(k)} className={cn('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all', done ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-primary/50')}>
                  {done ? <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> : <PenTool size={18} className="text-slate-400 flex-shrink-0" />}
                  <span className={cn('text-sm font-medium', done ? 'text-green-700 dark:text-green-300' : 'text-slate-500')}>{SECTION_MAP[k]}</span>
                </div>
              );
            })}
          </div>
        </div>
        {completedSections.length === totalSections && (
          <div className="content-card space-y-4">
            <h3 className="font-bold text-lg text-green-600 dark:text-green-400">{`SKKN \u0111\u00e3 ho\u00e0n th\u00e0nh!`}</h3>
            <p className="text-sm text-slate-500">{`T\u1ea5t c\u1ea3 c\u00e1c ph\u1ea7n \u0111\u00e3 \u0111\u01b0\u1ee3c vi\u1ebft xong. B\u1ea1n c\u00f3 th\u1ec3 xem l\u1ea1i t\u1eebng ph\u1ea7n ho\u1eb7c xu\u1ea5t file.`}</p>
            {draftLengthMetrics.totalTargetWords > 0 && (
              <div className="info-box space-y-2">
                <p className="font-semibold">{`Chu\u1ea9n h\u00f3a t\u1ed5ng \u0111\u1ed9 d\u00e0i tr\u01b0\u1edbc khi xu\u1ea5t`}</p>
                <p>{`T\u1ed5ng hi\u1ec7n t\u1ea1i kho\u1ea3ng `}{draftLengthMetrics.totalActualWords}{` t\u1eeb (~`}{draftLengthMetrics.totalActualPages}{` trang), m\u1ee5c ti\u00eau kho\u1ea3ng `}{draftLengthMetrics.totalTargetWords}{` t\u1eeb (~`}{draftLengthMetrics.totalTargetPages}{` trang).`}</p>
                <p>{draftDeltaLabel}</p>
                <p className="text-xs opacity-80">{`N\u00fat t\u1ea3i xu\u1ed1ng s\u1ebd xu\u1ea5t ngay theo n\u1ed9i dung hi\u1ec7n t\u1ea1i, kh\u00f4ng ch\u1edd AI. N\u1ebfu c\u1ea7n c\u00e2n l\u1ea1i \u0111\u1ed9 d\u00e0i, h\u00e3y b\u1ea5m \"Chu\u1ea9n h\u00f3a to\u00e0n b\u00e0i\" tr\u01b0\u1edbc.`}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => { void handleNormalizeBeforeExport(); }} disabled={isLoading || !draftLengthMetrics.totalTargetWords} className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Sparkles size={18} /> {'Chu\u1ea9n h\u00f3a to\u00e0n b\u00e0i'}</button>
              <button onClick={() => { void exportToDocx(); }} disabled={isLoading} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"><FileText size={18} /> {'T\u1ea3i xu\u1ed1ng SKKN (.docx)'}</button>
              <button onClick={() => { void exportMarkdown(); }} disabled={isLoading} className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileDown size={18} /> {'T\u1ea3i xu\u1ed1ng Markdown (.md)'}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCurrentStep = () => {
    const stepId = data.currentStep;
    if (stepId === 0) return renderInfoStep();
    if (stepId === 1) return renderOutlineStep();
    if (SECTION_MAP[stepId]) return renderWriteStep(stepId);
    if (stepId === 16) return renderExportStep();
    return null;
  };

  // Check if step is completed
  const isStepCompleted = (stepId: number): boolean => {
    if (stepId === 0) return data.confirmedRequirements;
    if (stepId === 1) return !!data.outline;
    if (SECTION_MAP[stepId]) return !!data.sections[SECTION_MAP[stepId]];
    if (stepId === 16) {
      const allSections = Object.keys(SECTION_MAP).map(k => Number(k));
      return allSections.every(k => !!data.sections[SECTION_MAP[k]]);
    }
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 sidebar flex flex-col z-20 flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles size={22} className="text-primary" />
            <h1 className="font-bold text-lg text-primary">Viethung</h1>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{`Tr\u1ee3 l\u00ed vi\u1ebft SKKN th\u00f4ng minh`} • build {APP_BUILD_TAG}</p>
        </div>

        {/* Step Navigation */}
        <nav className="flex-1 overflow-y-auto">
          {STEPS.map((step) => {
            const isActive = data.currentStep === step.id;
            const completed = isStepCompleted(step.id);
            const subItems = SIDEBAR_SECTION_SUBITEMS[step.id] || [];

            return (
              <button
                key={step.id}
                onClick={() => goToStep(step.id)}
                className={cn(
                  "step-item w-full text-left",
                  isActive && "active",
                  completed && "completed"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-sm",
                    isActive ? "font-bold text-primary" : "font-medium text-slate-700 dark:text-slate-300"
                  )}>
                    {step.title}
                  </span>
                  {completed && (
                    <CheckCircle2 size={14} className="step-check text-primary flex-shrink-0" />
                  )}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5">{step.desc}</span>
                {subItems.length > 0 && (
                  <div className="mt-1.5 space-y-0.5 pl-3 pr-1">
                    {subItems.map((item) => (
                      <div
                        key={item}
                        className={cn(
                          'text-[10px] leading-snug',
                          isActive ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400',
                        )}
                      >
                        - {item}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom of sidebar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          {data.info.title && (
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2">
              <p className="text-[10px] text-slate-400">Ð? tài:</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">{data.info.title}</p>
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => {
                localStorage.setItem('skkn_data_v3', JSON.stringify(data));
                Swal.fire({ icon: 'success', title: 'Ðã luu!', timer: 1000, showConfirmButton: false });
              }}
              className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-xs transition-all"
            >
              <Save size={14} /> Luu phiên
            </button>
            <button
              onClick={resetData}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top bar */}
        <header className="h-12 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 flex items-center justify-end px-4 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Settings size={14} /> Cài d?t API Key
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={data.currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {renderCurrentStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4 max-w-xs">
              <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="font-bold text-slate-700 dark:text-slate-200">{`\u0110ang ch\u1edd n\u1ed9i dung t\u1eeb chuy\u00ean gia AI...`}</p>
              <p className="text-xs text-slate-400 text-center">{`Qu\u00e1 tr\u00ecnh n\u00e0y c\u00f3 th\u1ec3 m\u1ea5t 30-60 gi\u00e2y t\u00f9y thu\u1ed9c v\u00e0o \u0111\u1ed9 ph\u1ee9c t\u1ea1p`}</p>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="bottom-bar">
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Ðang vi?t...
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Settings size={20} className="text-primary" /></div>
                <div>
                  <h3 className="font-bold text-lg">Thi?t l?p Model & API Key</h3>
                  <p className="text-xs text-slate-400">K?t n?i v?i Google Gemini API</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="ml-auto text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>
              <div className="p-5 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Ch?n Model AI</label>
                  <div className="space-y-2">
                    {[
                      { name: 'Gemini 3 Flash', desc: 'Nhanh, hi?u qu? cho tác v? thông thu?ng', badge: 'Default' },
                      { name: 'Gemini 3 Pro', desc: 'M?nh m?, phù h?p tác v? ph?c t?p', badge: '' },
                      { name: 'Gemini 2.5 Flash', desc: '?n d?nh, t?c d? cao', badge: '' },
                    ].map((model, i) => (
                      <div key={i} onClick={() => setSelectedModel(i)} className={cn('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all', selectedModel === i ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 hover:border-primary/50')}>
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Sparkles size={16} className="text-primary" /></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{model.name}</span>
                            {model.badge && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">{model.badge}</span>}
                          </div>
                          <p className="text-[11px] text-slate-400">{model.desc}</p>
                        </div>
                        {selectedModel === i && <CheckCircle2 size={18} className="text-primary" />}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs italic text-amber-600 dark:text-amber-400">
                  {`N\u1ebfu model \u0111ang ch\u1ecdn h\u1ebft l\u01b0\u1ee3t ho\u1eb7c qu\u00e1 t\u1ea3i, h\u1ec7 th\u1ed1ng s\u1ebd t\u1ef1 chuy\u1ec3n model kh\u00e1c v\u00e0 \u00e1p d\u1ee5ng t\u1eeb l\u1ea7n b\u1ea5m ti\u1ebfp theo \u0111\u1ec3 ti\u1ebft ki\u1ec7m quota.`}
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">{`API Key`}</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Nh?p Gemini API Key (AIza...)" className="form-input" />
                </div>
                <div className="hint-box space-y-1">
                  <p className="font-semibold text-xs">{`H\u01b0\u1edbng d\u1eabn l\u1ea5y Gemini API Key:`}</p>
                  <ol className="text-xs space-y-0.5 list-decimal list-inside">
                    <li>Truy c?p Google AI Studio</li>
                    <li>Ðang nh?p tài kho?n Google</li>
                    <li>Vào m?c API Keys và nh?n "Create API key"</li>
                    <li>Copy key và dán vào ô trên</li>
                  </ol>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" className="inline-flex items-center gap-1 text-xs text-amber-600 font-bold hover:underline mt-1">{`M\u1edf trang API Keys`}</a>
                </div>
                <button onClick={saveApiKey} className="btn-primary">Luu c?u hình</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Title Analysis Modal */}
      <AnimatePresence>
        {showAnalysis && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAnalysis(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white rounded-2xl shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 to-purple-600 p-5 rounded-t-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Target size={22} className="text-green-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Phân Tích Tên Ð? Tài</h3>
                    <p className="text-white/70 text-xs">K?t qu? dánh giá chi ti?t (Quy trình 3 l?p)</p>
                  </div>
                </div>
                <button onClick={() => setShowAnalysis(false)} className="text-white/60 hover:text-white text-2xl">&times;</button>
              </div>

              {isAnalyzing ? (
                <div className="p-12 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <p className="font-semibold text-slate-300">Ðang phân tích tên d? tài...</p>
                  <p className="text-xs text-slate-500">AI dang dánh giá theo 4 tiêu chí</p>
                </div>
              ) : analysisResult ? (
                <div className="p-5 space-y-5">
                  {/* Score & Overlap */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 rounded-xl p-5 text-center">
                      <p className="text-sm text-slate-400 mb-1">T?ng di?m</p>
                      <p className="text-5xl font-black">
                        {analysisResult.totalScore}<span className="text-lg text-slate-500">/100</span>
                      </p>
                      <p className="text-sm mt-1">? {analysisResult.rating}</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-5">
                      <p className="text-sm text-slate-400 mb-2">M?c d? trùng l?p</p>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold mb-2 ${getOverlapColor(analysisResult.overlap?.level)}`}>
                        {analysisResult.overlap?.level}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{analysisResult.overlap?.explanation}</p>
                    </div>
                  </div>

                  {/* Detailed Scores */}
                  <div className="bg-slate-800 rounded-xl p-5 space-y-4">
                    <h4 className="font-bold flex items-center gap-2">{`Chi ti\u1ebft \u0111i\u1ec3m s\u1ed1`}</h4>
                    {analysisResult.criteria?.map((c: any, i: number) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{c.name}</span>
                          <span className="text-sm font-bold">{c.score}/{c.maxScore}</span>
                        </div>
                        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getScoreColor(c.score, c.maxScore)}`}
                            style={{ width: `${(c.score / c.maxScore) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400">{c.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Title Structure */}
                  {analysisResult.structure && (
                    <div className="bg-slate-800 rounded-xl p-5">
                      <h4 className="font-bold mb-3 flex items-center gap-2">{`C\u1ea5u tr\u00fac t\u00ean \u0111\u1ec1 t\u00e0i`}</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: 'Hành d?ng', value: analysisResult.structure.action },
                          { label: 'Công c?', value: analysisResult.structure.tool },
                          { label: 'Môn h?c', value: analysisResult.structure.subject },
                          { label: 'Ph?m vi', value: analysisResult.structure.scope },
                          { label: 'M?c dích', value: analysisResult.structure.purpose },
                        ].map((item, i) => (
                          <div key={i} className="bg-slate-700 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-slate-400 mb-1">{item.label}</p>
                            <p className="text-xs font-semibold leading-tight">{item.value || '-'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Issues */}
                  {analysisResult.issues && analysisResult.issues.length > 0 && (
                    <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-5">
                      <h4 className="font-bold text-amber-400 mb-2 flex items-center gap-2">{`V\u1ea5n \u0111\u1ec1 c\u1ea7n kh\u1eafc ph\u1ee5c`} ({analysisResult.issues.length})</h4>
                      <ul className="space-y-2">
                        {analysisResult.issues.map((issue: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                            <span className="text-amber-400 mt-0.5">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggestions */}
                  {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-yellow-400 flex items-center gap-2">? Ð? xu?t tên thay th?</h4>
                      {analysisResult.suggestions.map((s: any, i: number) => (
                        <div key={i} className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
                          <div className="flex-1">
                            <p className="font-semibold text-sm leading-snug">{s.title}</p>
                            <p className="text-xs text-slate-400 mt-1">{s.reason}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-green-400 font-bold text-sm">{s.score}d</span>
                            <button
                              onClick={() => {
                                handleUpdateInfo('title', s.title);
                                setShowAnalysis(false);
                                Swal.fire({ icon: 'success', title: 'Ðã áp d?ng!', text: 'Tên d? tài dã du?c c?p nh?t.', timer: 1500, showConfirmButton: false });
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                              S? d?ng
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



































































