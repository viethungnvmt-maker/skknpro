import React, { useState, useEffect } from 'react';
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
import { callGeminiAI, estimateWordCount, getAllSectionLengthPlans, getSectionLengthPlan, PROMPTS, type SectionLengthPlan } from './services/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Section names for writing steps
const SECTION_MAP: { [key: number]: string } = {
  2: 'I.1. TÃ­nh cáº¥p thiáº¿t pháº£i tiáº¿n hÃ nh sÃ¡ng kiáº¿n',
  3: 'I.2. Má»¥c tiÃªu cá»§a Ä‘á» tÃ i, sÃ¡ng kiáº¿n',
  4: 'I.3. Thá»i gian, Ä‘á»‘i tÆ°á»£ng, pháº¡m vi nghiÃªn cá»©u',
  5: 'II.1. Hiá»‡n tráº¡ng váº¥n Ä‘á»',
  6: 'II.2. Giáº£i phÃ¡p thá»±c hiá»‡n sÃ¡ng kiáº¿n',
  7: 'II.3. Káº¿t quáº£ sau khi Ã¡p dá»¥ng giáº£i phÃ¡p sÃ¡ng kiáº¿n',
  8: 'II.4. Hiá»‡u quáº£ cá»§a sÃ¡ng kiáº¿n',
  9: 'II.5. TÃ­nh kháº£ thi',
  10: 'II.6. Thá»i gian thá»±c hiá»‡n',
  11: 'II.7. Kinh phÃ­ thá»±c hiá»‡n',
  12: 'III. Kiáº¿n nghá»‹, Ä‘á» xuáº¥t',
};

// Step 13 is export/review of all sections// Step 13 is export/review of all sections
const REVIEW_MAP: { [key: number]: number } = {};
const SECTION_ORDER = Object.values(SECTION_MAP);

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
const APP_BUILD_TAG = '2026-03-13-r6';
const normalizeLoadedData = (candidate: SKKNData): SKKNData => {
  if (!candidate.confirmedRequirements) {
    return {
      ...candidate,
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
          'I. Äáº·t váº¥n Ä‘á»': 'I.1. TÃ­nh cáº¥p thiáº¿t pháº£i tiáº¿n hÃ nh sÃ¡ng kiáº¿n',
          'II.1. Hiá»‡n tráº¡ng váº¥n Ä‘á»': 'II.1. Hiá»‡n tráº¡ng váº¥n Ä‘á»',
          'II.2. Giáº£i phÃ¡p thá»±c hiá»‡n sÃ¡ng kiáº¿n': 'II.2. Giáº£i phÃ¡p thá»±c hiá»‡n sÃ¡ng kiáº¿n',
          'II.3. Káº¿t quáº£ sau khi Ã¡p dá»¥ng giáº£i phÃ¡p sÃ¡ng kiáº¿n': 'II.3. Káº¿t quáº£ sau khi Ã¡p dá»¥ng giáº£i phÃ¡p sÃ¡ng kiáº¿n',
          'II.4. Hiá»‡u quáº£ cá»§a sÃ¡ng kiáº¿n': 'II.4. Hiá»‡u quáº£ cá»§a sÃ¡ng kiáº¿n',
          'II.5. TÃ­nh kháº£ thi': 'II.5. TÃ­nh kháº£ thi',
          'II.6-7. Thá»i gian & Kinh phÃ­ thá»±c hiá»‡n': 'II.6. Thá»i gian thá»±c hiá»‡n',
          'III. Kiáº¿n nghá»‹, Ä‘á» xuáº¥t': 'III. Kiáº¿n nghá»‹, Ä‘á» xuáº¥t',
        };
        const legacyCurrentSections: { [key: string]: string } = {
          'I.1. Tï¿½nh c?p thi?t ph?i ti?n hï¿½nh sï¿½ng ki?n': 'I.1. TÃ­nh cáº¥p thiáº¿t pháº£i tiáº¿n hÃ nh sÃ¡ng kiáº¿n',
          'I.2. M?c tiï¿½u c?a d? tï¿½i, sï¿½ng ki?n': 'I.2. Má»¥c tiÃªu cá»§a Ä‘á» tÃ i, sÃ¡ng kiáº¿n',
          'I.3. Th?i gian, d?i tu?ng, ph?m vi nghiï¿½n c?u': 'I.3. Thá»i gian, Ä‘á»‘i tÆ°á»£ng, pháº¡m vi nghiÃªn cá»©u',
          'II.1. Hi?n tr?ng v?n d?': 'II.1. Hiá»‡n tráº¡ng váº¥n Ä‘á»',
          'II.2. Gi?i phï¿½p th?c hi?n sï¿½ng ki?n': 'II.2. Giáº£i phÃ¡p thá»±c hiá»‡n sÃ¡ng kiáº¿n',
          'II.3. K?t qu? sau khi ï¿½p d?ng gi?i phï¿½p sï¿½ng ki?n': 'II.3. Káº¿t quáº£ sau khi Ã¡p dá»¥ng giáº£i phÃ¡p sÃ¡ng kiáº¿n',
          'II.4. Hi?u qu? c?a sï¿½ng ki?n': 'II.4. Hiá»‡u quáº£ cá»§a sÃ¡ng kiáº¿n',
          'II.5. Tï¿½nh kh? thi': 'II.5. TÃ­nh kháº£ thi',
          'II.6. Th?i gian th?c hi?n': 'II.6. Thá»i gian thá»±c hiá»‡n',
          'II.7. Kinh phï¿½ th?c hi?n': 'II.7. Kinh phÃ­ thá»±c hiá»‡n',
          'III. Ki?n ngh?, d? xu?t': 'III. Kiáº¿n nghá»‹, Ä‘á» xuáº¥t',
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
          currentStep: Math.min(parsed.currentStep || 0, 13),
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
      Swal.fire('Lá»—i', 'Vui lÃ²ng nháº­p tÃªn Ä‘á» tÃ i!', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const prompt = PROMPTS.GENERATE_OUTLINE(activeInfo);
      const result = await callGeminiAI(prompt);
      if (result) {
        setData(prev => ({ ...prev, outline: result }));
        Swal.fire('ThÃ nh cÃ´ng', 'ÄÃ£ táº¡o dÃ n Ã½ chi tiáº¿t báº±ng AI!', 'success');
      }
    } catch (error: any) {
      Swal.fire('Lá»—i', error.message || 'KhÃ´ng thá»ƒ káº¿t ná»‘i vá»›i AI', 'error');
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

=== YÃŠU Cáº¦U Cá»¨NG Vá»€ Äá»˜ DÃ€I ===
- BÃ i tráº£ vá» KHÃ”NG Ä‘Æ°á»£c dÆ°á»›i ${plan.minWords} tá»«.
- Náº¿u chÆ°a Ä‘á»§ Ä‘á»™ dÃ i, hÃ£y tá»± viáº¿t tiáº¿p thÃªm vÃ­ dá»¥/chi tiáº¿t thá»±c táº¿ cho Ä‘áº¿n khi Ä‘áº¡t yÃªu cáº§u.
- KhÃ´ng tráº£ vá» báº£n nhÃ¡p quÃ¡ ngáº¯n.
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
        let finalResult = await fitSectionToLength(sectionName, initialResult, data.outline);

        // Final retry guard for very short output.
        if (activePlan) {
          const hardMinWords = getHardMinWords(activePlan);
          if (finalResult.wordCount < hardMinWords) {
            const retryPrompt = `${prompt}

=== YÃŠU Cáº¦U Cá»¨NG Báº®T BUá»˜C ===
- Ná»™i dung tráº£ vá» tá»‘i thiá»ƒu ${activePlan.minWords} tá»«.
- Náº¿u thiáº¿u Ä‘á»™ dÃ i, tiáº¿p tá»¥c viáº¿t chi tiáº¿t thá»±c táº¿ cho Ä‘áº¿n khi Ä‘á»§.
================================`;

            const retryResult = await callGeminiAI(retryPrompt, undefined, undefined, maxTokens);
            if (retryResult) {
              const retried = await fitSectionToLength(sectionName, retryResult, data.outline);
              if (retried.wordCount > finalResult.wordCount) {
                finalResult = retried;
              }
            }

            if (finalResult.wordCount < hardMinWords) {
              const expandPrompt = `${PROMPTS.REWRITE_SECTION_LENGTH(
                sectionName,
                finalResult.content,
                activeInfo,
                activePlan,
                'expand',
              )}

=== YÃŠU Cáº¦U Cá»¨NG Báº®T BUá»˜C ===
- Báº£n cuá»‘i pháº£i Ä‘áº¡t tá»‘i thiá»ƒu ${activePlan.minWords} tá»«.
- KhÃ´ng Ä‘á»•i Ã½ chÃ­nh, chá»‰ bá»• sung vÃ­ dá»¥/diá»…n giáº£i Ä‘á»ƒ tÄƒng Ä‘á»™ dÃ i Ä‘Ãºng yÃªu cáº§u.
================================`;

              const expandedResult = await callGeminiAI(expandPrompt, undefined, undefined, activePlan.maxTokens);
              if (expandedResult) {
                const expanded = await fitSectionToLength(sectionName, expandedResult, data.outline);
                if (expanded.wordCount > finalResult.wordCount) {
                  finalResult = expanded;
                }
              }
            }
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
          ? `ÄÃ£ viáº¿t xong "${sectionName}" vá»›i khoáº£ng ${finalResult.wordCount} tá»« (má»¥c tiÃªu ${finalResult.plan.targetWords} tá»«, tá»‘i thiá»ƒu ${minRequiredWords} tá»«).${finalResult.adjusted ? ' AI Ä‘Ã£ tá»± cÃ¢n láº¡i Ä‘á»™ dÃ i sau khi viáº¿t.' : ''}${stillShort ? ' Ná»™i dung váº«n hÆ¡i ngáº¯n, báº¡n cÃ³ thá»ƒ báº¥m "Viáº¿t láº¡i báº±ng AI" Ä‘á»ƒ má»Ÿ rá»™ng thÃªm.' : ''} [build ${APP_BUILD_TAG}]`
          : `ÄÃ£ viáº¿t xong "${sectionName}"! [build ${APP_BUILD_TAG}]`;

        Swal.fire(stillShort ? 'Cáº§n má»Ÿ rá»™ng thÃªm' : 'ThÃ nh cÃ´ng', successMessage, stillShort ? 'warning' : 'success');
      }
    } catch (error: any) {
      Swal.fire('Lá»—i', error.message, 'error');
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
    Swal.fire('ÄÃ£ lÆ°u', 'Cáº¥u hÃ¬nh Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t!', 'success');
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
      title: 'XÃ³a dá»¯ liá»‡u?',
      text: 'Táº¥t cáº£ ná»™i dung hiá»‡n táº¡i sáº½ bá»‹ xÃ³a!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'XÃ³a ngay',
      cancelButtonText: 'Há»§y'
    }).then((result) => {
      if (result.isConfirmed) {
        setData(INITIAL_DATA);
        localStorage.removeItem('skkn_data_v3');
      }
    });
  };
  const analyzeTitle = async () => {
    if (!activeInfo.title) {
      Swal.fire('Lá»—i', 'Vui lÃ²ng nháº­p tÃªn Ä‘á» tÃ i trÆ°á»›c!', 'warning');
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
        throw new Error('AI khÃ´ng tráº£ vá» káº¿t quáº£');
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      let msg = error.message || 'Vui lÃ²ng thá»­ láº¡i.';
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.toLowerCase().includes('rpm/tpm')) {
        msg = 'Báº¡n Ä‘ang cháº¡m giá»›i háº¡n tá»‘c Ä‘á»™ theo phÃºt (RPM/TPM), khÃ´ng pháº£i háº¿t quota ngÃ y. Vui lÃ²ng chá» 30-60 giÃ¢y rá»“i thá»­ láº¡i.';
      } else if (msg.includes('NOT_FOUND') || msg.includes('404')) {
        msg = 'Model AI khÃ´ng kháº£ dá»¥ng. Vui lÃ²ng Ä‘á»•i model trong CÃ i Ä‘áº·t.';
      }
      Swal.fire('Lá»—i', msg, 'error');
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
    if (level === 'Tháº¥p') return 'bg-green-500';
    if (level === 'Trung bÃ¬nh') return 'bg-yellow-400';
    return 'bg-red-500';
  };

  // RENDER: Step 0 - ThÃ´ng tin
  const renderInfoStep = () => (
    <div className="space-y-6">
      <div className="banner-header">
        <h2 className="text-2xl font-bold">Thiáº¿t láº­p ThÃ´ng tin SÃ¡ng kiáº¿n</h2>
        <p className="text-white/80 mt-1">Cung cáº¥p thÃ´ng tin chÃ­nh xÃ¡c Ä‘á»ƒ AI táº¡o ra báº£n tháº£o cháº¥t lÆ°á»£ng nháº¥t</p>
      </div>

      <fieldset disabled={hasLockedSession} className="contents">
        <div className="content-card space-y-6">
          <h3 className="section-title">1. ThÃ´ng tin báº¯t buá»™c</h3>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              TÃªn Ä‘á» tÃ i SKKN <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Pencil size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.title}
                  onChange={(e) => handleUpdateInfo('title', e.target.value)}
                  placeholder='VD: "á»¨ng dá»¥ng AI Ä‘á»ƒ nÃ¢ng cao hiá»‡u quáº£ dáº¡y há»c mÃ´n ToÃ¡n THPT"'
                  className="form-input-icon"
                />
              </div>
              <button
                onClick={analyzeTitle}
                disabled={!data.info.title || isAnalyzing}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <Search size={14} /> {isAnalyzing ? 'Äang phÃ¢n tÃ­ch...' : 'PhÃ¢n tÃ­ch'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                MÃ´n há»c/LÄ©nh vá»±c <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <select
                  value={data.info.subject}
                  onChange={(e) => handleUpdateInfo('subject', e.target.value)}
                  className="form-input-icon appearance-none"
                >
                  <option value="">-- Chá»n mÃ´n há»c --</option>
                  <option value="ToÃ¡n">ToÃ¡n</option>
                  <option value="Ngá»¯ vÄƒn">Ngá»¯ vÄƒn</option>
                  <option value="Tiáº¿ng Anh">Tiáº¿ng Anh</option>
                  <option value="Váº­t lÃ½">Váº­t lÃ½</option>
                  <option value="HÃ³a há»c">HÃ³a há»c</option>
                  <option value="Sinh há»c">Sinh há»c</option>
                  <option value="Lá»‹ch sá»­">Lá»‹ch sá»­</option>
                  <option value="Äá»‹a lÃ½">Äá»‹a lÃ½</option>
                  <option value="GDCD/GDKT&PL">GDCD/GDKT&amp;PL</option>
                  <option value="Tin há»c">Tin há»c</option>
                  <option value="CÃ´ng nghá»‡">CÃ´ng nghá»‡</option>
                  <option value="Thá»ƒ dá»¥c">Thá»ƒ dá»¥c</option>
                  <option value="Ã‚m nháº¡c">Ã‚m nháº¡c</option>
                  <option value="Má»¹ thuáº­t">Má»¹ thuáº­t</option>
                  <option value="Khoa há»c tá»± nhiÃªn">Khoa há»c tá»± nhiÃªn</option>
                  <option value="Khoa há»c xÃ£ há»™i">Khoa há»c xÃ£ há»™i</option>
                  <option value="Hoáº¡t Ä‘á»™ng tráº£i nghiá»‡m">Hoáº¡t Ä‘á»™ng tráº£i nghiá»‡m</option>
                  <option value="GiÃ¡o dá»¥c quá»‘c phÃ²ng">GiÃ¡o dá»¥c quá»‘c phÃ²ng</option>
                  <option value="Tiáº¿ng PhÃ¡p">Tiáº¿ng PhÃ¡p</option>
                  <option value="Tiáº¿ng Trung">Tiáº¿ng Trung</option>
                  <option value="Tiáº¿ng Nháº­t">Tiáº¿ng Nháº­t</option>
                  <option value="Äáº¡o Ä‘á»©c">Äáº¡o Ä‘á»©c</option>
                  <option value="Tá»± nhiÃªn vÃ  XÃ£ há»™i">Tá»± nhiÃªn vÃ  XÃ£ há»™i</option>
                  <option value="Quáº£n lÃ½ giÃ¡o dá»¥c">Quáº£n lÃ½ giÃ¡o dá»¥c</option>
                  <option value="GiÃ¡o dá»¥c máº§m non">GiÃ¡o dá»¥c máº§m non</option>
                  <option value="KhÃ¡c">KhÃ¡c</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cáº¥p há»c</label>
              <div className="relative">
                <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <select
                  value={data.info.level}
                  onChange={(e) => handleUpdateInfo('level', e.target.value)}
                  className="form-input-icon appearance-none"
                >
                  <option value="">-- Chá»n cáº¥p há»c --</option>
                  <option value="Tiá»ƒu há»c">Tiá»ƒu há»c</option>
                  <option value="THCS">THCS</option>
                  <option value="THPT">THPT</option>
                  <option value="Máº§m non">Máº§m non</option>
                  <option value="LiÃªn cáº¥p">LiÃªn cáº¥p</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Khá»‘i lá»›p</label>
              <div className="relative">
                <School size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.grade}
                  onChange={(e) => handleUpdateInfo('grade', e.target.value)}
                  placeholder="VD: Lá»›p 12, Khá»‘i 6-9"
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                TÃªn trÆ°á»ng / ÄÆ¡n vá»‹ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.info.school}
                onChange={(e) => handleUpdateInfo('school', e.target.value)}
                placeholder="VD: TrÆ°á»ng THPT Nguyá»…n Du"
                className="form-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Äá»‹a Ä‘iá»ƒm (Huyá»‡n, Tá»‰nh) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.location}
                  onChange={(e) => handleUpdateInfo('location', e.target.value)}
                  placeholder="VD: Quáº­n 1, TP.HCM"
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Äiá»u kiá»‡n CSVC (Tivi, MÃ¡y chiáº¿u, WiFi...) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Monitor size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={data.info.facilities}
                onChange={(e) => handleUpdateInfo('facilities', e.target.value)}
                placeholder="VD: PhÃ²ng mÃ¡y chiáº¿u, Tivi thÃ´ng minh, Internet á»•n Ä‘á»‹nh..."
                className="form-input-icon"
              />
            </div>
          </div>
        </div>

        <div className="content-card space-y-6">
          <h3 className="section-title">
            2. ThÃ´ng tin bá»• sung
            <span className="text-xs text-amber-500 font-normal ml-2 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              (KhuyÃªn dÃ¹ng Ä‘á»ƒ tÄƒng chi tiáº¿t)
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">SÃ¡ch giÃ¡o khoa</label>
              <div className="relative">
                <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.textbook}
                  onChange={(e) => handleUpdateInfo('textbook', e.target.value)}
                  placeholder="VD: Káº¿t ná»‘i tri thá»©c, CÃ¡nh diá»u..."
                  className="form-input-icon"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Äá»‘i tÆ°á»£ng nghiÃªn cá»©u</label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.target}
                  onChange={(e) => handleUpdateInfo('target', e.target.value)}
                  placeholder="VD: 45 HS lá»›p 12A (thá»±c nghiá»‡m)..."
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Thá»i gian thá»±c hiá»‡n</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.duration}
                  onChange={(e) => handleUpdateInfo('duration', e.target.value)}
                  placeholder="VD: NÄƒm há»c 2024-2025"
                  className="form-input-icon"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">á»¨ng dá»¥ng AI/CÃ´ng nghá»‡</label>
              <div className="relative">
                <Cpu size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.techUsed}
                  onChange={(e) => handleUpdateInfo('techUsed', e.target.value)}
                  placeholder="VD: Sá»­ dá»¥ng ChatGPT, Canva, Padlet..."
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Äáº·c thÃ¹ / Trá»ng tÃ¢m Ä‘á» tÃ i</label>
            <div className="relative">
              <Target size={16} className="absolute left-3 top-3.5 text-slate-400" />
              <textarea
                value={data.info.focus}
                onChange={(e) => handleUpdateInfo('focus', e.target.value)}
                placeholder="MÃ´ táº£ ngáº¯n gá»n vá» Ä‘áº·c thÃ¹ hoáº·c trá»ng tÃ¢m cá»§a Ä‘á» tÃ i..."
                rows={2}
                className="form-input-icon resize-none"
              />
            </div>
          </div>
        </div>

        <div className="content-card space-y-6">
          <h3 className="section-title">
            4. YÃªu cáº§u khÃ¡c
            <span className="text-xs text-slate-400 font-normal ml-2">(TÃ¹y chá»n - AI sáº½ tuÃ¢n thá»§ nghiÃªm ngáº·t)</span>
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
                <span className="font-bold text-amber-600">ðŸ“Š ThÃªm nhiá»u</span>{' '}
                <span className="font-bold text-amber-600">bÃ i toÃ¡n thá»±c táº¿, vÃ­ dá»¥ minh há»a</span>
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
                <span className="font-bold text-purple-600">ðŸ“ˆ Bá»• sung</span>{' '}
                <span className="font-bold text-purple-600">báº£ng biá»ƒu, sá»‘ liá»‡u thá»‘ng kÃª</span>
              </span>
            </label>

            <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3">
              <span className="text-sm text-purple-700 dark:text-purple-300">ðŸ“„ Sá»‘ trang SKKN cáº§n giá»›i háº¡n:</span>
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
              <span className="text-xs text-slate-400">(Äá»ƒ trá»‘ng náº¿u khÃ´ng giá»›i háº¡n)</span>
            </div>

            {hasLockedSession && (
              <div className="hint-box">
                <p>
                  ÄÃ£ khÃ³a toÃ n bá»™ cáº¥u hÃ¬nh phiÃªn viáº¿t hiá»‡n táº¡i
                  {data.lockedPageLimit ? `, trong Ä‘Ã³ sá»‘ trang Ä‘Æ°á»£c chá»‘t á»Ÿ má»©c ${data.lockedPageLimit} trang.` : '.'}
                  {' '}CÃ¡c checkbox, yÃªu cáº§u bá»• sung vÃ  thÃ´ng tin mÃ´ táº£ sáº½ giá»¯ nguyÃªn cho Ä‘áº¿n khi báº¡n má»Ÿ khÃ³a.
                </p>
              </div>
            )}

            {sectionLengthPlans.length > 0 && (
              <div className="info-box space-y-2">
                <p className="font-semibold">
                  {hasLockedSession
                    ? `PhÃ¢n bá»• Ä‘Ã£ khÃ³a cho lÆ°á»£t viáº¿t hiá»‡n táº¡i (${activePageLimitLabel} trang)`
                    : `PhÃ¢n bá»• Ä‘á»™ dÃ i dá»± kiáº¿n theo giá»›i háº¡n ${activePageLimitLabel} trang`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {sectionLengthPlans.map((plan) => (
                    <div
                      key={plan.sectionName}
                      className="flex items-start justify-between gap-3 rounded-lg bg-white/70 dark:bg-slate-900/30 px-3 py-2"
                    >
                      <span className="leading-relaxed">{plan.sectionName}</span>
                      <span className="font-semibold whitespace-nowrap">~{plan.targetPagesLabel} trang ({plan.targetWords} tá»«)</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs opacity-80">
                  {hasLockedSession
                    ? 'Má»i láº§n viáº¿t tiáº¿p theo sáº½ dÃ¹ng Ä‘Ãºng snapshot nÃ y, bao gá»“m checkbox vÃ  yÃªu cáº§u bá»• sung, cho Ä‘áº¿n khi báº¡n má»Ÿ khÃ³a.'
                    : 'App sáº½ dÃ¹ng phÃ¢n bá»• nÃ y khi gá»i AI vÃ  tá»± biÃªn táº­p láº¡i náº¿u má»¥c nÃ o lá»‡ch quÃ¡ xa khá»i má»©c Ä‘Ã£ chia.'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">ðŸ–Šï¸ YÃªu cáº§u bá»• sung khÃ¡c (tÃ¹y Ã½):</label>
            <textarea
              value={data.info.customRequirements}
              onChange={(e) => handleUpdateInfo('customRequirements', e.target.value)}
              placeholder={`Nháº­p cÃ¡c yÃªu cáº§u Ä‘áº·c biá»‡t khÃ¡c cá»§a báº¡n. VÃ­ dá»¥:
â€¢ Viáº¿t ngáº¯n gá»n pháº§n cÆ¡ sá»Ÿ lÃ½ luáº­n (khoáº£ng 3 trang)
â€¢ Táº­p trung vÃ o giáº£i phÃ¡p á»©ng dá»¥ng AI
â€¢ Viáº¿t theo phong cÃ¡ch há»c thuáº­t nghiÃªm tÃºc...`}
              rows={4}
              className="form-input resize-none"
            />
          </div>
        </div>
      </fieldset>

      <button onClick={confirmRequirements} className={hasLockedSession ? 'btn-confirmed' : 'btn-confirm'}>
        {hasLockedSession ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> âœ… ÄÃ£ khÃ³a phiÃªn viáº¿t - Báº¥m Ä‘á»ƒ má»Ÿ khÃ³a vÃ  sá»­a láº¡i
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Save size={18} /> ðŸ’¾ XÃ¡c nháº­n lÆ°u cÃ¡c yÃªu cáº§u nÃ y
          </span>
        )}
      </button>

      {hasLockedSession && (
        <p className="text-center text-xs text-green-600 dark:text-green-400">
          âœ… CÃ¡c yÃªu cáº§u Ä‘Ã£ Ä‘Æ°á»£c lÆ°u! AI sáº½ tuÃ¢n thá»§ NGHIÃŠM NGáº¶T khi viáº¿t SKKN.
        </p>
      )}

      <div className="content-card space-y-5">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 italic">TÃ¹y chá»n khá»Ÿi táº¡o</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => { goToStep(1); }}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-all"
          >
            <Sparkles size={18} /> AI Láº­p DÃ n Ã Chi Tiáº¿t
          </button>
          <button className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <FileText size={18} /> Sá»­ Dá»¥ng DÃ n Ã CÃ³ Sáºµn
          </button>
        </div>
        <div className="info-box flex items-start gap-2">
          <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
          <p>Há»‡ thá»‘ng AI sáº½ tá»± Ä‘á»™ng phÃ¢n tÃ­ch Ä‘á» tÃ i vÃ  táº¡o ra dÃ n Ã½ chi tiáº¿t gá»“m 6 pháº§n chuáº©n Bá»™ GD&amp;ÄT. Báº¡n cÃ³ thá»ƒ chá»‰nh sá»­a láº¡i sau khi táº¡o xong.</p>
        </div>
        <button
          onClick={() => { goToStep(1); generateOutline(); }}
          disabled={!data.info.title || isLoading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ðŸš€ Báº¯t Ä‘áº§u láº­p dÃ n Ã½ ngay
        </button>
      </div>
    </div>
  );
  const renderOutlineStep = () => (
    <div className="space-y-6">
      <div className="banner-header">
        <h2 className="text-2xl font-bold">Láº­p DÃ n Ã SKKN</h2>
        <p className="text-white/80 mt-1">XÃ¢y dá»±ng khung sÆ°á»n chi tiáº¿t cho SÃ¡ng kiáº¿n kinh nghiá»‡m</p>
      </div>

      {data.outline ? (
        <div className="content-card space-y-4">
          <div className="doc-preview-bar">
            <div className="dot bg-red-400" />
            <div className="dot bg-amber-400" />
            <div className="dot bg-green-400" />
            <span className="ml-2 text-xs text-slate-500">ðŸ“„ Báº£n tháº£o SKKN.docx</span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-b-xl border border-slate-100 dark:border-slate-700 min-h-[400px]">
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(data.outline) }} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={generateOutline} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary-dark transition-colors"><Sparkles size={14} /> Táº¡o láº¡i dÃ n Ã½</button>
            <button onClick={() => goToStep(2)} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">Tiáº¿p tá»¥c viáº¿t ná»™i dung <ChevronRight size={14} /></button>
          </div>
          <details className="mt-4">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-primary transition-colors">ðŸ“ Chá»‰nh sá»­a dÃ n Ã½ (Markdown)</summary>
            <textarea value={data.outline} onChange={(e) => setData(prev => ({ ...prev, outline: e.target.value }))} className="w-full mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm resize-none min-h-[300px]" />
          </details>
        </div>
      ) : (
        <div className="content-card flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Layout size={40} /></div>
          <div>
            <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">ChÆ°a cÃ³ dÃ n Ã½</p>
            <p className="text-sm text-slate-400 mt-1">Nháº¥n nÃºt bÃªn dÆ°á»›i Ä‘á»ƒ AI táº¡o dÃ n Ã½ chi tiáº¿t</p>
          </div>
          <button onClick={generateOutline} disabled={isLoading || !data.info.title} className="btn-primary max-w-sm disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? 'â³ Äang táº¡o dÃ n Ã½...' : 'ðŸš€ Táº¡o dÃ n Ã½ báº±ng AI'}</button>
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
                <span className="ml-2 text-xs text-slate-500">ðŸ“„ {sectionName}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-b-xl border border-slate-100 dark:border-slate-700 min-h-[300px]">
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => generateSection(sectionName)} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50"><Sparkles size={14} /> Viáº¿t láº¡i báº±ng AI</button>
                {stepId < 13 && (
                  <button onClick={() => goToStep(stepId + 1)} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">Tiáº¿p tá»¥c <ChevronRight size={14} /></button>
                )}
              </div>
              <details className="mt-2">
                <summary className="text-sm text-slate-500 cursor-pointer hover:text-primary">ðŸ“ Chá»‰nh sá»­a ná»™i dung</summary>
                <textarea value={content} onChange={(e) => setData(prev => ({ ...prev, sections: { ...prev.sections, [sectionName]: e.target.value } }))} className="w-full mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm resize-none min-h-[300px] outline-none" />
              </details>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><PenTool size={40} /></div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">ChÆ°a cÃ³ ná»™i dung</p>
                <p className="text-sm text-slate-400 mt-1">Nháº¥n nÃºt bÃªn dÆ°á»›i Ä‘á»ƒ AI viáº¿t pháº§n nÃ y</p>
              </div>
              <div className="info-box max-w-md text-left"><p>ðŸ’¡ AI sáº½ dá»±a trÃªn dÃ n Ã½ Ä‘Ã£ táº¡o Ä‘á»ƒ viáº¿t ná»™i dung chi tiáº¿t cho pháº§n <strong>{sectionName}</strong>.</p></div>
              <button onClick={() => generateSection(sectionName)} disabled={isLoading} className="btn-primary max-w-sm disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? 'â³ Äang viáº¿t...' : `ðŸš€ AI viáº¿t "${STEPS[stepId].title}"`}</button>
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
        ? `Tá»•ng hiá»‡n táº¡i khoáº£ng ${after.totalActualWords} tá»« (~${after.totalActualPages} trang), má»¥c tiÃªu ${after.totalTargetWords} tá»« (~${after.totalTargetPages} trang).`
        : `Tá»•ng hiá»‡n táº¡i khoáº£ng ${after.totalActualWords} tá»«.`;

      Swal.fire(
        changed ? 'ÄÃ£ chuáº©n hÃ³a trÆ°á»›c khi xuáº¥t' : 'KhÃ´ng cáº§n chuáº©n hÃ³a thÃªm',
        changed
          ? `${summaryText} App Ä‘Ã£ cÃ¢n láº¡i ${adjustedSections} má»¥c Ä‘á»ƒ kÃ©o tá»•ng Ä‘á»™ dÃ i sÃ¡t má»¥c tiÃªu hÆ¡n.`
          : `${summaryText} Báº£n tháº£o hiá»‡n Ä‘Ã£ khÃ¡ sÃ¡t giá»›i háº¡n báº¡n Ä‘áº·t ra.`,
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
      Swal.fire('Lá»—i', error.message || 'KhÃ´ng thá»ƒ chuáº©n hÃ³a toÃ n bÃ i trÆ°á»›c khi xuáº¥t.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const exportMarkdown = async () => {
    setIsLoading(true);
    try {
      const { sections } = await normalizeDraftForExport(true);
      const allContent = SECTION_ORDER.map((sectionName) => sections[sectionName] || '').join('\n\n---\n\n');
      const blob = new Blob([allContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SKKN_${activeInfo.title || 'export'}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      Swal.fire('Lá»—i', error.message || 'KhÃ´ng thá»ƒ chuáº©n hÃ³a vÃ  xuáº¥t Markdown.', 'error');
    } finally {
      setIsLoading(false);
    }
  };  // ==========================================
  // Export to DOCX (Word-compatible HTML)
  // ==========================================
  const exportToDocx = async () => {
    setIsLoading(true);
    try {
      const { sections: exportSections } = await normalizeDraftForExport(true);

      const getSectionHtml = (stepId: number) => {
        const sectionName = SECTION_MAP[stepId];
        let md = exportSections[sectionName] || '';
        if (!md) return '';

        md = md.replace(/^.*[Dd]Æ°á»›i Ä‘Ã¢y.*$/gm, '');
        md = md.replace(/^.*ná»™i dung chi tiáº¿t.*$/gm, '');
        md = md.replace(/^.*Ä‘Æ°á»£c (viáº¿t|trÃ¬nh bÃ y) theo.*$/gm, '');
        md = md.replace(/^.*yÃªu cáº§u vá» Ä‘á»™ dÃ i.*$/gm, '');
        md = md.replace(/^.*vÄƒn phong vÃ  cÃ¡c nguyÃªn táº¯c.*$/gm, '');
        md = md.replace(/^.*cÃ¡c nguyÃªn táº¯c Ä‘Ã£ Ä‘á» ra.*$/gm, '');
        md = md.replace(/^.*[Pp]háº§n nÃ y trÃ¬nh bÃ y.*$/gm, '');
        md = md.replace(/^.*[Ss]au Ä‘Ã¢y lÃ .*$/gm, '');
        md = md.replace(/^.*\([Kk]hoáº£ng \d+.*\).*$/gm, '');

        md = md.replace(/^#{0,6}\s*I\.\s*(Äáº¶T Váº¤N Äá»€|Äáº·t váº¥n Ä‘á»).*$/gim, '');
        md = md.replace(/^#{0,6}\s*II\.\s*(Ná»˜I DUNG|Ná»™i dung).*$/gim, '');
        md = md.replace(/^#{0,6}\s*III\.\s*(KIáº¾N NGHá»Š|Kiáº¿n nghá»‹).*$/gim, '');
        md = md.replace(/^#{0,6}\s*I{1,3}[\.\d]*[\.\-\s].*?(Äáº·t váº¥n Ä‘á»|TÃ­nh cáº¥p thiáº¿t|Má»¥c tiÃªu|Thá»i gian.*Ä‘á»‘i tÆ°á»£ng|Hiá»‡n tráº¡ng|Giáº£i phÃ¡p|Káº¿t quáº£|Hiá»‡u quáº£|TÃ­nh kháº£ thi|Kinh phÃ­|Kiáº¿n nghá»‹|Äáº¶T Váº¤N Äá»€|Ná»˜I DUNG).*$/gim, '');
        md = md.replace(/^#{0,6}\s*\d+[\.\)]\s*(TÃ­nh cáº¥p thiáº¿t|Má»¥c tiÃªu|Thá»i gian.*Ä‘á»‘i tÆ°á»£ng|Hiá»‡n tráº¡ng|Giáº£i phÃ¡p|Káº¿t quáº£|Hiá»‡u quáº£|TÃ­nh kháº£ thi|Thá»i gian thá»±c hiá»‡n|Kinh phÃ­|Kiáº¿n nghá»‹).*$/gim, '');
        md = md.replace(/\n{3,}/g, '\n\n');
        md = md.trim();

        let html = renderMarkdown(md);
        html = html.replace(/\$/g, '');
        html = html.replace(/\\/g, '');
        return html;
      };

      const bodyHtml = `
<h1 style="text-align:center; font-size:16pt; font-weight:bold;">Ná»˜I DUNG SÃNG KIáº¾N KINH NGHIá»†M</h1>

<h2 style="font-size:14pt; font-weight:bold;">I. Äáº·t váº¥n Ä‘á»</h2>

<h3 style="font-size:13pt; font-weight:bold;">1. TÃ­nh cáº¥p thiáº¿t pháº£i tiáº¿n hÃ nh sÃ¡ng kiáº¿n</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(2)}</div>

<h3 style="font-size:13pt; font-weight:bold;">2. Má»¥c tiÃªu cá»§a Ä‘á» tÃ i, sÃ¡ng kiáº¿n</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(3)}</div>

<h3 style="font-size:13pt; font-weight:bold;">3. Thá»i gian, Ä‘á»‘i tÆ°á»£ng, pháº¡m vi nghiÃªn cá»©u</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(4)}</div>

<h2 style="font-size:14pt; font-weight:bold;">II. Ná»™i dung cá»§a sÃ¡ng kiáº¿n</h2>

<h3 style="font-size:13pt; font-weight:bold;">1. Hiá»‡n tráº¡ng váº¥n Ä‘á»</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(5)}</div>

<h3 style="font-size:13pt; font-weight:bold;">2. Giáº£i phÃ¡p thá»±c hiá»‡n sÃ¡ng kiáº¿n Ä‘á»ƒ giáº£i quyáº¿t váº¥n Ä‘á»</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(6)}</div>

<h3 style="font-size:13pt; font-weight:bold;">3. Káº¿t quáº£ sau khi Ã¡p dá»¥ng giáº£i phÃ¡p sÃ¡ng kiáº¿n táº¡i Ä‘Æ¡n vá»‹</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(7)}</div>

<h3 style="font-size:13pt; font-weight:bold;">4. Hiá»‡u quáº£ cá»§a sÃ¡ng kiáº¿n</h3>
<h4 style="font-size:13pt; font-weight:bold; font-style:italic;">4.1. Hiá»‡u quáº£ vá» khoa há»c</h4>
<h4 style="font-size:13pt; font-weight:bold; font-style:italic;">4.2. Hiá»‡u quáº£ vá» kinh táº¿</h4>
<h4 style="font-size:13pt; font-weight:bold; font-style:italic;">4.3. Hiá»‡u quáº£ vá» xÃ£ há»™i</h4>
<div style="margin-bottom:12pt;">${getSectionHtml(8)}</div>

<h3 style="font-size:13pt; font-weight:bold;">5. TÃ­nh kháº£ thi (kháº£ nÄƒng Ã¡p dá»¥ng vÃ o thá»±c tiá»…n cÃ´ng tÃ¡c cá»§a Ä‘Æ¡n vá»‹, Ä‘á»‹a phÆ°Æ¡ng)</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(9)}</div>

<h3 style="font-size:13pt; font-weight:bold;">6. Thá»i gian thá»±c hiá»‡n Ä‘á» tÃ i, sÃ¡ng kiáº¿n</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(10)}</div>

<h3 style="font-size:13pt; font-weight:bold;">7. Kinh phÃ­ thá»±c hiá»‡n Ä‘á» tÃ i, sÃ¡ng kiáº¿n</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(11)}</div>

<h2 style="font-size:14pt; font-weight:bold;">III. Kiáº¿n nghá»‹, Ä‘á» xuáº¥t</h2>
<div style="margin-bottom:12pt;">${getSectionHtml(12)}</div>
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
      a.download = `SKKN_${activeInfo.title || 'export'}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      Swal.fire('Lá»—i', error.message || 'KhÃ´ng thá»ƒ chuáº©n hÃ³a vÃ  xuáº¥t file Word.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  const renderExportStep = () => {
    const allSections = Object.keys(SECTION_MAP).map(k => Number(k));
    const completedSections = allSections.filter(k => !!data.sections[SECTION_MAP[k]]);
    const totalSections = allSections.length;
    const progress = Math.round((completedSections.length / totalSections) * 100);
    const draftLengthMetrics = buildDraftLengthMetrics();
    const draftDeltaLabel = draftLengthMetrics.totalDeltaWords === 0
      ? 'Äang khá»›p ráº¥t sÃ¡t má»¥c tiÃªu tá»•ng thá»ƒ.'
      : draftLengthMetrics.totalDeltaWords > 0
        ? `ToÃ n bÃ i hiá»‡n cÃ²n thiáº¿u khoáº£ng ${draftLengthMetrics.totalDeltaWords} tá»« (~${(draftLengthMetrics.totalDeltaWords / EXPORT_WORDS_PER_PAGE).toFixed(1)} trang).`
        : `ToÃ n bÃ i hiá»‡n Ä‘ang dÃ i hÆ¡n khoáº£ng ${Math.abs(draftLengthMetrics.totalDeltaWords)} tá»« (~${(Math.abs(draftLengthMetrics.totalDeltaWords) / EXPORT_WORDS_PER_PAGE).toFixed(1)} trang).`;

    return (
      <div className="space-y-6">
        <div className="banner-header">
          <h2 className="text-2xl font-bold">Xuáº¥t SKKN</h2>
          <p className="text-white/80 mt-1">Tá»•ng há»£p vÃ  xuáº¥t file hoÃ n chá»‰nh</p>
        </div>
        <div className="content-card space-y-5">
          <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200">ðŸ“Š Tiáº¿n Ä‘á»™ hoÃ n thÃ nh</h3>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          <p className="text-sm text-slate-500">{completedSections.length}/{totalSections} pháº§n Ä‘Ã£ hoÃ n thÃ nh ({progress}%)</p>
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
            <h3 className="font-bold text-lg text-green-600 dark:text-green-400">ðŸŽ‰ SKKN Ä‘Ã£ hoÃ n thÃ nh!</h3>
            <p className="text-sm text-slate-500">Táº¥t cáº£ cÃ¡c pháº§n Ä‘Ã£ Ä‘Æ°á»£c viáº¿t xong. Báº¡n cÃ³ thá»ƒ xem láº¡i tá»«ng pháº§n hoáº·c xuáº¥t file.</p>
            {draftLengthMetrics.totalTargetWords > 0 && (
              <div className="info-box space-y-2">
                <p className="font-semibold">Chuáº©n hÃ³a tá»•ng Ä‘á»™ dÃ i trÆ°á»›c khi xuáº¥t</p>
                <p>Tá»•ng hiá»‡n táº¡i khoáº£ng {draftLengthMetrics.totalActualWords} tá»« (~{draftLengthMetrics.totalActualPages} trang), má»¥c tiÃªu khoáº£ng {draftLengthMetrics.totalTargetWords} tá»« (~{draftLengthMetrics.totalTargetPages} trang).</p>
                <p>{draftDeltaLabel}</p>
                <p className="text-xs opacity-80">Khi báº¥m xuáº¥t file, app sáº½ tá»± cÃ¢n láº¡i má»™t vÃ i má»¥c lá»›n náº¿u tá»•ng Ä‘á»™ dÃ i cÃ²n lá»‡ch nhiá»u.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => { void handleNormalizeBeforeExport(); }} disabled={isLoading || !draftLengthMetrics.totalTargetWords} className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Sparkles size={18} /> Chuáº©n hÃ³a toÃ n bÃ i</button>
              <button onClick={() => { void exportToDocx(); }} disabled={isLoading} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"><FileText size={18} /> Táº£i xuá»‘ng SKKN (.doc)</button>
              <button onClick={() => { void exportMarkdown(); }} disabled={isLoading} className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileDown size={18} /> Táº£i xuá»‘ng Markdown (.md)</button>
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
    if (stepId >= 2 && stepId <= 12) return renderWriteStep(stepId);
    if (stepId === 13) return renderExportStep();
    return null;
  };

  // Check if step is completed
  const isStepCompleted = (stepId: number): boolean => {
    if (stepId === 0) return data.confirmedRequirements;
    if (stepId === 1) return !!data.outline;
    if (SECTION_MAP[stepId]) return !!data.sections[SECTION_MAP[stepId]];
    if (stepId === 13) {
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
          <p className="text-[11px] text-slate-400 mt-0.5">Trá»£ lÃ­ viáº¿t SKKN thÃ´ng minh â€¢ build {APP_BUILD_TAG}</p>
        </div>

        {/* Step Navigation */}
        <nav className="flex-1 overflow-y-auto">
          {STEPS.map((step) => {
            const isActive = data.currentStep === step.id;
            const completed = isStepCompleted(step.id);

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
              </button>
            );
          })}
        </nav>

        {/* Bottom of sidebar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
          {data.info.title && (
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2">
              <p className="text-[10px] text-slate-400">Äá» tÃ i:</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">{data.info.title}</p>
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => {
                localStorage.setItem('skkn_data_v3', JSON.stringify(data));
                Swal.fire({ icon: 'success', title: 'ÄÃ£ lÆ°u!', timer: 1000, showConfirmButton: false });
              }}
              className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-xs transition-all"
            >
              <Save size={14} /> LÆ°u phiÃªn
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
              <Settings size={14} /> CÃ i Ä‘áº·t API Key
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
              <p className="font-bold text-slate-700 dark:text-slate-200">Äang chá» ná»™i dung tá»« chuyÃªn gia AI...</p>
              <p className="text-xs text-slate-400 text-center">QuÃ¡ trÃ¬nh nÃ y cÃ³ thá»ƒ máº¥t 30-60 giÃ¢y tÃ¹y thuá»™c vÃ o Ä‘á»™ phá»©c táº¡p</p>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="bottom-bar">
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Äang viáº¿t...
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
                  <h3 className="font-bold text-lg">Thiáº¿t láº­p Model & API Key</h3>
                  <p className="text-xs text-slate-400">Káº¿t ná»‘i vá»›i Google Gemini API</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="ml-auto text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>
              <div className="p-5 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Chá»n Model AI</label>
                  <div className="space-y-2">
                    {[
                      { name: 'Gemini 2.5 Flash', desc: 'Nhanh vÃ  cÃ¢n báº±ng cho háº§u háº¿t tÃ¡c vá»¥', badge: 'Default' },
                      { name: 'Gemini 2.0 Flash', desc: 'Máº¡nh hÆ¡n cho tÃ¡c vá»¥ dÃ i vÃ  phá»©c táº¡p', badge: '' },
                      { name: 'Gemini 2.0 Flash Lite', desc: 'Nhanh, chi phÃ­ tháº¥p', badge: '' },
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
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">ðŸ”‘ API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Nháº­p Gemini API Key (AIza...)" className="form-input" />
                </div>
                <div className="hint-box space-y-1">
                  <p className="font-semibold text-xs">ðŸ“– HÆ°á»›ng dáº«n láº¥y Gemini API Key:</p>
                  <ol className="text-xs space-y-0.5 list-decimal list-inside">
                    <li>Truy cáº­p Google AI Studio</li>
                    <li>ÄÄƒng nháº­p tÃ i khoáº£n Google</li>
                    <li>VÃ o má»¥c API Keys vÃ  nháº¥n "Create API key"</li>
                    <li>Copy key vÃ  dÃ¡n vÃ o Ã´ trÃªn</li>
                  </ol>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" className="inline-flex items-center gap-1 text-xs text-amber-600 font-bold hover:underline mt-1">ðŸ”— Má»Ÿ trang API Keys</a>
                </div>
                <button onClick={saveApiKey} className="btn-primary">LÆ°u cáº¥u hÃ¬nh</button>
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
                    <h3 className="font-bold text-lg">PhÃ¢n TÃ­ch TÃªn Äá» TÃ i</h3>
                    <p className="text-white/70 text-xs">Káº¿t quáº£ Ä‘Ã¡nh giÃ¡ chi tiáº¿t (Quy trÃ¬nh 3 lá»›p)</p>
                  </div>
                </div>
                <button onClick={() => setShowAnalysis(false)} className="text-white/60 hover:text-white text-2xl">&times;</button>
              </div>

              {isAnalyzing ? (
                <div className="p-12 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <p className="font-semibold text-slate-300">Äang phÃ¢n tÃ­ch tÃªn Ä‘á» tÃ i...</p>
                  <p className="text-xs text-slate-500">AI Ä‘ang Ä‘Ã¡nh giÃ¡ theo 4 tiÃªu chÃ­</p>
                </div>
              ) : analysisResult ? (
                <div className="p-5 space-y-5">
                  {/* Score & Overlap */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 rounded-xl p-5 text-center">
                      <p className="text-sm text-slate-400 mb-1">Tá»•ng Ä‘iá»ƒm</p>
                      <p className="text-5xl font-black">
                        {analysisResult.totalScore}<span className="text-lg text-slate-500">/100</span>
                      </p>
                      <p className="text-sm mt-1">â­ {analysisResult.rating}</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-5">
                      <p className="text-sm text-slate-400 mb-2">Má»©c Ä‘á»™ trÃ¹ng láº·p</p>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold mb-2 ${getOverlapColor(analysisResult.overlap?.level)}`}>
                        ðŸ” {analysisResult.overlap?.level}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{analysisResult.overlap?.explanation}</p>
                    </div>
                  </div>

                  {/* Detailed Scores */}
                  <div className="bg-slate-800 rounded-xl p-5 space-y-4">
                    <h4 className="font-bold flex items-center gap-2">ðŸ“Š Chi tiáº¿t Ä‘iá»ƒm sá»‘</h4>
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
                      <h4 className="font-bold mb-3 flex items-center gap-2">ðŸ§© Cáº¥u trÃºc tÃªn Ä‘á» tÃ i</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: 'HÃ nh Ä‘á»™ng', value: analysisResult.structure.action },
                          { label: 'CÃ´ng cá»¥', value: analysisResult.structure.tool },
                          { label: 'MÃ´n há»c', value: analysisResult.structure.subject },
                          { label: 'Pháº¡m vi', value: analysisResult.structure.scope },
                          { label: 'Má»¥c Ä‘Ã­ch', value: analysisResult.structure.purpose },
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
                      <h4 className="font-bold text-amber-400 mb-2 flex items-center gap-2">âš ï¸ Váº¥n Ä‘á» cáº§n kháº¯c phá»¥c ({analysisResult.issues.length})</h4>
                      <ul className="space-y-2">
                        {analysisResult.issues.map((issue: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                            <span className="text-amber-400 mt-0.5">â€¢</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggestions */}
                  {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-bold text-yellow-400 flex items-center gap-2">âœ¨ Äá» xuáº¥t tÃªn thay tháº¿</h4>
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
                                Swal.fire({ icon: 'success', title: 'ÄÃ£ Ã¡p dá»¥ng!', text: 'TÃªn Ä‘á» tÃ i Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t.', timer: 1500, showConfirmButton: false });
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                              Sá»­ dá»¥ng
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










