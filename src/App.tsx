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
import { GEMINI_MODEL_SWITCH_EVENT, callGeminiAI, estimateWordCount, getAllSectionLengthPlans, getSectionLengthPlan, PROMPTS, type GeminiModelSwitchDetail, type SectionLengthPlan } from './services/gemini';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Section names for writing steps
const SECTION_MAP: { [key: number]: string } = {
  2: 'PHẦN MỞ ĐẦU - I. Lý do chọn đề tài',
  3: 'PHẦN MỞ ĐẦU - II. Mục đích nghiên cứu',
  4: 'PHẦN MỞ ĐẦU - III. Đối tượng nghiên cứu',
  5: 'PHẦN MỞ ĐẦU - IV. Đối tượng khảo sát thực nghiệm',
  6: 'PHẦN MỞ ĐẦU - V. Phương pháp nghiên cứu',
  7: 'PHẦN MỞ ĐẦU - VI. Phạm vi và kế hoạch nghiên cứu',
  8: 'PHẦN NỘI DUNG - I. Cơ sở lý luận',
  9: 'PHẦN NỘI DUNG - II. Thực trạng',
  10: 'PHẦN NỘI DUNG - III. Biện pháp thực hiện',
  11: 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
  12: 'PHẦN KẾT LUẬN - I. Kết luận chung',
  13: 'PHẦN KẾT LUẬN - II. Bài học kinh nghiệm',
  14: 'PHẦN KẾT LUẬN - III. Đề xuất - khuyến nghị',
  15: 'PHỤ LỤC',
};

const SECTION_ORDER = Object.values(SECTION_MAP);

const SECTION_NAME_MIGRATION: Record<string, string> = {
  'I.1. Tính cấp thiết phải tiến hành sáng kiến': 'PHẦN MỞ ĐẦU - I. Lý do chọn đề tài',
  'I.2. Mục tiêu của đề tài, sáng kiến': 'PHẦN MỞ ĐẦU - II. Mục đích nghiên cứu',
  'I.3. Thời gian, đối tượng, phạm vi nghiên cứu': 'PHẦN MỞ ĐẦU - III. Đối tượng nghiên cứu',
  'II.1. Hiện trạng vấn đề': 'PHẦN NỘI DUNG - II. Thực trạng',
  'II.2. Giải pháp thực hiện sáng kiến': 'PHẦN NỘI DUNG - III. Biện pháp thực hiện',
  'II.3. Kết quả sau khi áp dụng giải pháp sáng kiến': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
  'II.4. Hiệu quả của sáng kiến': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
  'II.5. Tính khả thi': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
  'II.6. Thời gian thực hiện': 'PHẦN MỞ ĐẦU - VI. Phạm vi và kế hoạch nghiên cứu',
  'II.7. Kinh phí thực hiện': 'PHẦN NỘI DUNG - III. Biện pháp thực hiện',
  'III. Kiến nghị, đề xuất': 'PHẦN KẾT LUẬN - III. Đề xuất - khuyến nghị',

  'I.1. Lí do chọn đề tài': 'PHẦN MỞ ĐẦU - I. Lý do chọn đề tài',
  'I.2. Mục đích nghiên cứu': 'PHẦN MỞ ĐẦU - II. Mục đích nghiên cứu',
  'I.3. Đối tượng nghiên cứu': 'PHẦN MỞ ĐẦU - III. Đối tượng nghiên cứu',
  'I.4. Đối tượng khảo sát': 'PHẦN MỞ ĐẦU - IV. Đối tượng khảo sát thực nghiệm',
  'I.5. Phương pháp nghiên cứu': 'PHẦN MỞ ĐẦU - V. Phương pháp nghiên cứu',
  'I.6. Phạm vi triển khai': 'PHẦN MỞ ĐẦU - VI. Phạm vi và kế hoạch nghiên cứu',
  'II.1. Cơ sở lí luận': 'PHẦN NỘI DUNG - I. Cơ sở lý luận',
  'II.2. Thực trạng': 'PHẦN NỘI DUNG - II. Thực trạng',
  'II.3. Các biện pháp thực hiện sáng kiến': 'PHẦN NỘI DUNG - III. Biện pháp thực hiện',
  'II.4. Hiệu quả đạt được sau khi áp dụng sáng kiến': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
  'III. Kết quả': 'PHẦN KẾT LUẬN - I. Kết luận chung',
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
const APP_BUILD_TAG = '2026-03-13-r9';
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
          'I. Đặt vấn đề': 'PHẦN MỞ ĐẦU - I. Lý do chọn đề tài',
          'II.1. Hiện trạng vấn đề': 'PHẦN NỘI DUNG - II. Thực trạng',
          'II.2. Giải pháp thực hiện sáng kiến': 'PHẦN NỘI DUNG - III. Biện pháp thực hiện',
          'II.3. Kết quả sau khi áp dụng giải pháp sáng kiến': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
          'II.4. Hiệu quả của sáng kiến': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
          'II.5. Tính khả thi': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
          'II.6-7. Thời gian & Kinh phí thực hiện': 'PHẦN MỞ ĐẦU - VI. Phạm vi và kế hoạch nghiên cứu',
          'III. Kiến nghị, đề xuất': 'PHẦN KẾT LUẬN - III. Đề xuất - khuyến nghị',
        };
        const legacyCurrentSections: { [key: string]: string } = {
          'I.1. T�nh c?p thi?t ph?i ti?n h�nh s�ng ki?n': 'PHẦN MỞ ĐẦU - I. Lý do chọn đề tài',
          'I.2. M?c ti�u c?a d? t�i, s�ng ki?n': 'PHẦN MỞ ĐẦU - II. Mục đích nghiên cứu',
          'I.3. Th?i gian, d?i tu?ng, ph?m vi nghi�n c?u': 'PHẦN MỞ ĐẦU - III. Đối tượng nghiên cứu',
          'II.1. Hi?n tr?ng v?n d?': 'PHẦN NỘI DUNG - II. Thực trạng',
          'II.2. Gi?i ph�p th?c hi?n s�ng ki?n': 'PHẦN NỘI DUNG - III. Biện pháp thực hiện',
          'II.3. K?t qu? sau khi �p d?ng gi?i ph�p s�ng ki?n': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
          'II.4. Hi?u qu? c?a s�ng ki?n': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
          'II.5. T�nh kh? thi': 'PHẦN NỘI DUNG - IV. Kết quả đạt được',
          'II.6. Th?i gian th?c hi?n': 'PHẦN MỞ ĐẦU - VI. Phạm vi và kế hoạch nghiên cứu',
          'II.7. Kinh ph� th?c hi?n': 'PHẦN NỘI DUNG - III. Biện pháp thực hiện',
          'III. Ki?n ngh?, d? xu?t': 'PHẦN KẾT LUẬN - III. Đề xuất - khuyến nghị',
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

  const buildLengthFallbackContent = (
    sectionName: string,
    info: SKKNData['info'],
    missingWords: number,
  ) => {
    const subject = info.subject || 'môn học';
    const grade = info.grade || 'lớp học';
    const school = info.school || 'đơn vị công tác';
    const topic = info.title || 'đề tài';

    const baseParagraphs = [
      `Để bảo đảm phần "${sectionName}" phản ánh đúng yêu cầu của đề tài "${topic}", giáo viên xác định rõ mục tiêu theo ba lớp: mục tiêu kiến thức, mục tiêu năng lực và mục tiêu phẩm chất. Với đặc thù ${subject} ở ${grade} tại ${school}, mỗi mục tiêu đều gắn trực tiếp với biểu hiện quan sát được trong quá trình học tập, tránh nêu chung chung hoặc quá lý thuyết.`,
      `Trong quá trình triển khai, mục tiêu được cụ thể hóa thành các chỉ báo theo từng giai đoạn thực hiện: trước khi áp dụng, trong khi áp dụng và sau khi áp dụng giải pháp. Ở mỗi giai đoạn, giáo viên ghi nhận mức độ tham gia của học sinh, chất lượng sản phẩm học tập, khả năng vận dụng kiến thức vào tình huống thực tế và mức độ hợp tác của nhóm. Các minh chứng này giúp việc đánh giá trở nên nhất quán và có căn cứ.`,
      `Bên cạnh đó, mục tiêu của sáng kiến cũng cần bảo đảm tính khả thi tại đơn vị: phù hợp điều kiện cơ sở vật chất, phù hợp thời lượng dạy học, và có thể nhân rộng cho các lớp tương đương. Giáo viên xây dựng kế hoạch điều chỉnh theo phản hồi thực tế để giữ đúng mục tiêu cốt lõi, đồng thời bổ sung hoạt động hỗ trợ cho học sinh còn hạn chế, từ đó nâng dần hiệu quả thực hiện theo từng chu kỳ.`,
    ];

    let addition = baseParagraphs.join('\n\n');
    const targetWords = Math.max(80, missingWords + 20);

    while (estimateWordCount(addition) < targetWords) {
      addition += `\n\nNgoài ra, giáo viên tiếp tục đối chiếu mục tiêu với kết quả định kỳ theo tuần, điều chỉnh nội dung và phương pháp tổ chức hoạt động để bảo đảm tiến độ và chất lượng đầu ra của học sinh.`;
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
        title: `Đã tự chuyển model: ${detail.toLabel}`,
        text: `${detail.fromLabel} ${detail.reason}. Hệ thống đã tự chuyển để viết tiếp.`,
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
      Swal.fire('Lỗi', 'Vui lòng nhập tên đề tài!', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const prompt = PROMPTS.GENERATE_OUTLINE(activeInfo);
      const result = await callGeminiAI(prompt);
      if (result) {
        setData(prev => ({ ...prev, outline: result }));
        Swal.fire('Thành công', 'Đã tạo dàn ý chi tiết bằng AI!', 'success');
      }
    } catch (error: any) {
      Swal.fire('Lỗi', error.message || 'Không thể kết nối với AI', 'error');
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

=== YÊU CẦU CỨNG VỀ ĐỘ DÀI ===
- Bài trả về KHÔNG được dưới ${plan.minWords} từ.
- Nếu chưa đủ độ dài, hãy tự viết tiếp thêm ví dụ/chi tiết thực tế cho đến khi đạt yêu cầu.
- Không trả về bản nháp quá ngắn.
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

=== CHẾ ĐỘ BẮT BUỘC ĐỘ DÀI (THỬ LẠI 1 LẦN) ===
- Viết lại HOÀN CHỈNH mục "${sectionName}".
- Độ dài bắt buộc: từ ${hardMinWords} đến ${activePlan.maxWords} từ.
- Cấu trúc tối thiểu 3 đoạn, mỗi đoạn 3-5 câu.
- Nêu rõ bối cảnh thực tế lớp học, cách triển khai và tiêu chí đánh giá kết quả.
- Nếu chưa đủ độ dài, tự bổ sung ví dụ minh họa thực tế cho đủ trong cùng lần trả lời.
- Không giải thích thêm, chỉ trả về nội dung cuối cùng bằng Markdown.
============================================

Nội dung hiện có (đang quá ngắn, chỉ để tham chiếu):
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
            const fallbackAddition = buildLengthFallbackContent(sectionName, activeInfo, missingWords);
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
          ? `Đã viết xong "${sectionName}" với khoảng ${finalResult.wordCount} từ (mục tiêu ${finalResult.plan.targetWords} từ, tối thiểu ${minRequiredWords} từ).${finalResult.adjusted ? ' AI đã tự cân lại độ dài sau khi viết.' : ''}${stillShort ? ' Nội dung vẫn hơi ngắn, bạn có thể bấm "Viết lại bằng AI" để mở rộng thêm.' : ''} [build ${APP_BUILD_TAG}]`
          : `Đã viết xong "${sectionName}"! [build ${APP_BUILD_TAG}]`;

        Swal.fire(stillShort ? 'Cần mở rộng thêm' : 'Thành công', successMessage, stillShort ? 'warning' : 'success');
      }
    } catch (error: any) {
      Swal.fire('Lỗi', error.message, 'error');
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
    Swal.fire('Đã lưu', 'Cấu hình đã được cập nhật!', 'success');
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
      title: 'Xóa dữ liệu?',
      text: 'Tất cả nội dung hiện tại sẽ bị xóa!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Xóa ngay',
      cancelButtonText: 'Hủy'
    }).then((result) => {
      if (result.isConfirmed) {
        setData(INITIAL_DATA);
        localStorage.removeItem('skkn_data_v3');
      }
    });
  };
  const analyzeTitle = async () => {
    if (!activeInfo.title) {
      Swal.fire('Lỗi', 'Vui lòng nhập tên đề tài trước!', 'warning');
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
        throw new Error('AI không trả về kết quả');
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      let msg = error.message || 'Vui lòng thử lại.';
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.toLowerCase().includes('rpm/tpm')) {
        msg = 'Bạn đang chạm giới hạn tốc độ theo phút (RPM/TPM), không phải hết quota ngày. Vui lòng chờ 30-60 giây rồi thử lại.';
      } else if (msg.includes('NOT_FOUND') || msg.includes('404')) {
        msg = 'Model AI không khả dụng. Hệ thống đã tự thử model khác; nếu vẫn lỗi, vui lòng thử lại sau ít phút.';
      }
      Swal.fire('Lỗi', msg, 'error');
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
    if (level === 'Thấp') return 'bg-green-500';
    if (level === 'Trung bình') return 'bg-yellow-400';
    return 'bg-red-500';
  };

  // RENDER: Step 0 - Thông tin
  const renderInfoStep = () => (
    <div className="space-y-6">
      <div className="banner-header">
        <h2 className="text-2xl font-bold">Thiết lập Thông tin Sáng kiến</h2>
        <p className="text-white/80 mt-1">Cung cấp thông tin chính xác để AI tạo ra bản thảo chất lượng nhất</p>
      </div>

      <fieldset disabled={hasLockedSession} className="contents">
        <div className="content-card space-y-6">
          <h3 className="section-title">1. Thông tin bắt buộc</h3>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tên đề tài SKKN <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Pencil size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.title}
                  onChange={(e) => handleUpdateInfo('title', e.target.value)}
                  placeholder='VD: "Ứng dụng AI để nâng cao hiệu quả dạy học môn Toán THPT"'
                  className="form-input-icon"
                />
              </div>
              <button
                onClick={analyzeTitle}
                disabled={!data.info.title || isAnalyzing}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                <Search size={14} /> {isAnalyzing ? 'Đang phân tích...' : 'Phân tích'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Môn học/Lĩnh vực <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <BookOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <select
                  value={data.info.subject}
                  onChange={(e) => handleUpdateInfo('subject', e.target.value)}
                  className="form-input-icon appearance-none"
                >
                  <option value="">-- Chọn môn học --</option>
                  <option value="Toán">Toán</option>
                  <option value="Ngữ văn">Ngữ văn</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Vật lý">Vật lý</option>
                  <option value="Hóa học">Hóa học</option>
                  <option value="Sinh học">Sinh học</option>
                  <option value="Lịch sử">Lịch sử</option>
                  <option value="Địa lý">Địa lý</option>
                  <option value="GDCD/GDKT&PL">GDCD/GDKT&amp;PL</option>
                  <option value="Tin học">Tin học</option>
                  <option value="Công nghệ">Công nghệ</option>
                  <option value="Thể dục">Thể dục</option>
                  <option value="Âm nhạc">Âm nhạc</option>
                  <option value="Mỹ thuật">Mỹ thuật</option>
                  <option value="Khoa học tự nhiên">Khoa học tự nhiên</option>
                  <option value="Khoa học xã hội">Khoa học xã hội</option>
                  <option value="Hoạt động trải nghiệm">Hoạt động trải nghiệm</option>
                  <option value="Giáo dục quốc phòng">Giáo dục quốc phòng</option>
                  <option value="Tiếng Pháp">Tiếng Pháp</option>
                  <option value="Tiếng Trung">Tiếng Trung</option>
                  <option value="Tiếng Nhật">Tiếng Nhật</option>
                  <option value="Đạo đức">Đạo đức</option>
                  <option value="Tự nhiên và Xã hội">Tự nhiên và Xã hội</option>
                  <option value="Quản lý giáo dục">Quản lý giáo dục</option>
                  <option value="Giáo dục mầm non">Giáo dục mầm non</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cấp học</label>
              <div className="relative">
                <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                <select
                  value={data.info.level}
                  onChange={(e) => handleUpdateInfo('level', e.target.value)}
                  className="form-input-icon appearance-none"
                >
                  <option value="">-- Chọn cấp học --</option>
                  <option value="Tiểu học">Tiểu học</option>
                  <option value="THCS">THCS</option>
                  <option value="THPT">THPT</option>
                  <option value="Mầm non">Mầm non</option>
                  <option value="Liên cấp">Liên cấp</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Khối lớp</label>
              <div className="relative">
                <School size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.grade}
                  onChange={(e) => handleUpdateInfo('grade', e.target.value)}
                  placeholder="VD: Lớp 12, Khối 6-9"
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tên trường / Đơn vị <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.info.school}
                onChange={(e) => handleUpdateInfo('school', e.target.value)}
                placeholder="VD: Trường THPT Nguyễn Du"
                className="form-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Địa điểm (Huyện, Tỉnh) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.location}
                  onChange={(e) => handleUpdateInfo('location', e.target.value)}
                  placeholder="VD: Quận 1, TP.HCM"
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Điều kiện CSVC (Tivi, Máy chiếu, WiFi...) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Monitor size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={data.info.facilities}
                onChange={(e) => handleUpdateInfo('facilities', e.target.value)}
                placeholder="VD: Phòng máy chiếu, Tivi thông minh, Internet ổn định..."
                className="form-input-icon"
              />
            </div>
          </div>
        </div>

        <div className="content-card space-y-6">
          <h3 className="section-title">
            2. Thông tin bổ sung
            <span className="text-xs text-amber-500 font-normal ml-2 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              (Khuyên dùng để tăng chi tiết)
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
                  placeholder="VD: Kết nối tri thức, Cánh diều..."
                  className="form-input-icon"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Đối tượng nghiên cứu</label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.target}
                  onChange={(e) => handleUpdateInfo('target', e.target.value)}
                  placeholder="VD: 45 HS lớp 12A (thực nghiệm)..."
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Thời gian thực hiện</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.duration}
                  onChange={(e) => handleUpdateInfo('duration', e.target.value)}
                  placeholder="VD: Năm học 2024-2025"
                  className="form-input-icon"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ứng dụng AI/Công nghệ</label>
              <div className="relative">
                <Cpu size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={data.info.techUsed}
                  onChange={(e) => handleUpdateInfo('techUsed', e.target.value)}
                  placeholder="VD: Sử dụng ChatGPT, Canva, Padlet..."
                  className="form-input-icon"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Đặc thù / Trọng tâm đề tài</label>
            <div className="relative">
              <Target size={16} className="absolute left-3 top-3.5 text-slate-400" />
              <textarea
                value={data.info.focus}
                onChange={(e) => handleUpdateInfo('focus', e.target.value)}
                placeholder="Mô tả ngắn gọn về đặc thù hoặc trọng tâm của đề tài..."
                rows={2}
                className="form-input-icon resize-none"
              />
            </div>
          </div>
        </div>

        <div className="content-card space-y-6">
          <h3 className="section-title">
            4. Yêu cầu khác
            <span className="text-xs text-slate-400 font-normal ml-2">(Tùy chọn - AI sẽ tuân thủ nghiêm ngặt)</span>
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
                <span className="font-bold text-amber-600">📊 Thêm nhiều</span>{' '}
                <span className="font-bold text-amber-600">bài toán thực tế, ví dụ minh họa</span>
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
                <span className="font-bold text-purple-600">📈 Bổ sung</span>{' '}
                <span className="font-bold text-purple-600">bảng biểu, số liệu thống kê</span>
              </span>
            </label>

            <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3">
              <span className="text-sm text-purple-700 dark:text-purple-300">📄 Số trang SKKN cần giới hạn:</span>
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
              <span className="text-xs text-slate-400">(Để trống nếu không giới hạn)</span>
            </div>

            {hasLockedSession && (
              <div className="hint-box">
                <p>
                  Đã khóa toàn bộ cấu hình phiên viết hiện tại
                  {data.lockedPageLimit ? `, trong đó số trang được chốt ở mức ${data.lockedPageLimit} trang.` : '.'}
                  {' '}Các checkbox, yêu cầu bổ sung và thông tin mô tả sẽ giữ nguyên cho đến khi bạn mở khóa.
                </p>
              </div>
            )}

            {sectionLengthPlans.length > 0 && (
              <div className="info-box space-y-2">
                <p className="font-semibold">
                  {hasLockedSession
                    ? `Phân bổ đã khóa cho lượt viết hiện tại (${activePageLimitLabel} trang)`
                    : `Phân bổ độ dài dự kiến theo giới hạn ${activePageLimitLabel} trang`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {sectionLengthPlans.map((plan) => (
                    <div
                      key={plan.sectionName}
                      className="flex items-start justify-between gap-3 rounded-lg bg-white/70 dark:bg-slate-900/30 px-3 py-2"
                    >
                      <span className="leading-relaxed">{plan.sectionName}</span>
                      <span className="font-semibold whitespace-nowrap">~{plan.targetPagesLabel} trang ({plan.targetWords} từ)</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs opacity-80">
                  {hasLockedSession
                    ? 'Mọi lần viết tiếp theo sẽ dùng đúng snapshot này, bao gồm checkbox và yêu cầu bổ sung, cho đến khi bạn mở khóa.'
                    : 'App sẽ dùng phân bổ này khi gọi AI và tự biên tập lại nếu mục nào lệch quá xa khỏi mức đã chia.'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">🖊️ Yêu cầu bổ sung khác (tùy ý):</label>
            <textarea
              value={data.info.customRequirements}
              onChange={(e) => handleUpdateInfo('customRequirements', e.target.value)}
              placeholder={`Nhập các yêu cầu đặc biệt khác của bạn. Ví dụ:
• Viết ngắn gọn phần cơ sở lý luận (khoảng 3 trang)
• Tập trung vào giải pháp ứng dụng AI
• Viết theo phong cách học thuật nghiêm túc...`}
              rows={4}
              className="form-input resize-none"
            />
          </div>
        </div>
      </fieldset>

      <button onClick={confirmRequirements} className={hasLockedSession ? 'btn-confirmed' : 'btn-confirm'}>
        {hasLockedSession ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> ✅ Đã khóa phiên viết - Bấm để mở khóa và sửa lại
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Save size={18} /> 💾 Xác nhận lưu các yêu cầu này
          </span>
        )}
      </button>

      {hasLockedSession && (
        <p className="text-center text-xs text-green-600 dark:text-green-400">
          ✅ Các yêu cầu đã được lưu! AI sẽ tuân thủ NGHIÊM NGẶT khi viết SKKN.
        </p>
      )}

      <div className="content-card space-y-5">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 italic">Tùy chọn khởi tạo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => { goToStep(1); }}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5 transition-all"
          >
            <Sparkles size={18} /> AI Lập Dàn Ý Chi Tiết
          </button>
          <button className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <FileText size={18} /> Sử Dụng Dàn Ý Có Sẵn
          </button>
        </div>
        <div className="info-box flex items-start gap-2">
          <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
          <p>Hệ thống AI sẽ tự động phân tích đề tài và tạo ra dàn ý chi tiết gồm 6 phần chuẩn Bộ GD&amp;ĐT. Bạn có thể chỉnh sửa lại sau khi tạo xong.</p>
        </div>
        <button
          onClick={() => { goToStep(1); generateOutline(); }}
          disabled={!data.info.title || isLoading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🚀 Bắt đầu lập dàn ý ngay
        </button>
      </div>
    </div>
  );
  const renderOutlineStep = () => (
    <div className="space-y-6">
      <div className="banner-header">
        <h2 className="text-2xl font-bold">Lập Dàn Ý SKKN</h2>
        <p className="text-white/80 mt-1">Xây dựng khung sườn chi tiết cho Sáng kiến kinh nghiệm</p>
      </div>

      {data.outline ? (
        <div className="content-card space-y-4">
          <div className="doc-preview-bar">
            <div className="dot bg-red-400" />
            <div className="dot bg-amber-400" />
            <div className="dot bg-green-400" />
            <span className="ml-2 text-xs text-slate-500">📄 Bản thảo SKKN.docx</span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-b-xl border border-slate-100 dark:border-slate-700 min-h-[400px]">
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(data.outline) }} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={generateOutline} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary-dark transition-colors"><Sparkles size={14} /> Tạo lại dàn ý</button>
            <button onClick={() => goToStep(2)} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">Tiếp tục viết nội dung <ChevronRight size={14} /></button>
          </div>
          <details className="mt-4">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-primary transition-colors">📝 Chỉnh sửa dàn ý (Markdown)</summary>
            <textarea value={data.outline} onChange={(e) => setData(prev => ({ ...prev, outline: e.target.value }))} className="w-full mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 outline-none font-mono text-sm resize-none min-h-[300px]" />
          </details>
        </div>
      ) : (
        <div className="content-card flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Layout size={40} /></div>
          <div>
            <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">Chưa có dàn ý</p>
            <p className="text-sm text-slate-400 mt-1">Nhấn nút bên dưới để AI tạo dàn ý chi tiết</p>
          </div>
          <button onClick={generateOutline} disabled={isLoading || !data.info.title} className="btn-primary max-w-sm disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? '⏳ Đang tạo dàn ý...' : '🚀 Tạo dàn ý bằng AI'}</button>
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
                <span className="ml-2 text-xs text-slate-500">📄 {sectionName}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-b-xl border border-slate-100 dark:border-slate-700 min-h-[300px]">
                <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => generateSection(sectionName)} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50"><Sparkles size={14} /> Viết lại bằng AI</button>
                {stepId < 16 && (
                  <button onClick={() => goToStep(stepId + 1)} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">Tiếp tục <ChevronRight size={14} /></button>
                )}
              </div>
              <details className="mt-2">
                <summary className="text-sm text-slate-500 cursor-pointer hover:text-primary">📝 Chỉnh sửa nội dung</summary>
                <textarea value={content} onChange={(e) => setData(prev => ({ ...prev, sections: { ...prev.sections, [sectionName]: e.target.value } }))} className="w-full mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm resize-none min-h-[300px] outline-none" />
              </details>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><PenTool size={40} /></div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-300 text-lg">Chưa có nội dung</p>
                <p className="text-sm text-slate-400 mt-1">Nhấn nút bên dưới để AI viết phần này</p>
              </div>
              <div className="info-box max-w-md text-left"><p>💡 AI sẽ dựa trên dàn ý đã tạo để viết nội dung chi tiết cho phần <strong>{sectionName}</strong>.</p></div>
              <button onClick={() => generateSection(sectionName)} disabled={isLoading} className="btn-primary max-w-sm disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? '⏳ Đang viết...' : `🚀 AI viết "${STEPS[stepId].title}"`}</button>
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
        ? `Tổng hiện tại khoảng ${after.totalActualWords} từ (~${after.totalActualPages} trang), mục tiêu ${after.totalTargetWords} từ (~${after.totalTargetPages} trang).`
        : `Tổng hiện tại khoảng ${after.totalActualWords} từ.`;

      Swal.fire(
        changed ? 'Đã chuẩn hóa trước khi xuất' : 'Không cần chuẩn hóa thêm',
        changed
          ? `${summaryText} App đã cân lại ${adjustedSections} mục để kéo tổng độ dài sát mục tiêu hơn.`
          : `${summaryText} Bản thảo hiện đã khá sát giới hạn bạn đặt ra.`,
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
      Swal.fire('Lỗi', error.message || 'Không thể chuẩn hóa toàn bài trước khi xuất.', 'error');
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
      a.download = 'SKKN_' + (activeInfo.title || 'export') + '.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      Swal.fire('Loi', error.message || 'Khong the chuan hoa va xuat Markdown.', 'error');
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

        md = md.replace(/^.*[Dd]ưới đây.*$/gm, '');
        md = md.replace(/^.*nội dung chi tiết.*$/gm, '');
        md = md.replace(/^.*được (viết|trình bày) theo.*$/gm, '');
        md = md.replace(/^.*yêu cầu về độ dài.*$/gm, '');
        md = md.replace(/^.*văn phong và các nguyên tắc.*$/gm, '');
        md = md.replace(/^.*các nguyên tắc đã đề ra.*$/gm, '');
        md = md.replace(/^.*[Pp]hần này trình bày.*$/gm, '');
        md = md.replace(/^.*[Ss]au đây là.*$/gm, '');
        md = md.replace(/^.*\([Kk]hoảng \d+.*\).*$/gm, '');

        md = md.replace(/^#{0,6}\s*I\.\s*(ĐẶT VẤN ĐỀ|Đặt vấn đề).*$/gim, '');
        md = md.replace(/^#{0,6}\s*II\.\s*(NỘI DUNG|Nội dung).*$/gim, '');
        md = md.replace(/^#{0,6}\s*III\.\s*(KIẾN NGHỊ|Kiến nghị|KẾT QUẢ|Kết quả).*$/gim, '');
        md = md.replace(/^#{0,6}\s*Phần\s*[IVX]+\.\s*.*$/gim, '');
        md = md.replace(/^#{0,6}\s*I{1,3}[\.\d]*[\.\-\s].*?(Đặt vấn đề|Lí do chọn đề tài|Lý do chọn đề tài|Mục đích nghiên cứu|Đối tượng nghiên cứu|Đối tượng khảo sát|Phương pháp nghiên cứu|Phạm vi triển khai|Hiện trạng|Thực trạng|Cơ sở lí luận|Giải pháp|Các biện pháp|Kết quả|Hiệu quả|Hiệu quả đạt được|Tính khả thi|Kinh phí|Kiến nghị|ĐẶT VẤN ĐỀ|NỘI DUNG).*$/gim, '');
        md = md.replace(/^#{0,6}\s*\d+[\.\)]\s*(Lí do chọn đề tài|Lý do chọn đề tài|Mục đích nghiên cứu|Đối tượng nghiên cứu|Đối tượng khảo sát|Phương pháp nghiên cứu|Phạm vi triển khai|Cơ sở lí luận|Thực trạng|Hiện trạng|Các biện pháp|Giải pháp|Kết quả|Hiệu quả|Hiệu quả đạt được|Tính khả thi|Thời gian thực hiện|Kinh phí|Kiến nghị).*$/gim, '');
        md = md.replace(/\n{3,}/g, '\n\n');
        md = md.trim();

        let html = renderMarkdown(md);
        html = html.replace(/\$/g, '');
        html = html.replace(/\\/g, '');
        return html;
      };

      const bodyHtml = `
<h1 style="text-align:center; font-size:16pt; font-weight:bold;">NỘI DUNG SÁNG KIẾN KINH NGHIỆM</h1>

<h2 style="font-size:14pt; font-weight:bold;">PHẦN MỞ ĐẦU</h2>

<h3 style="font-size:13pt; font-weight:bold;">I. LÝ DO CHỌN ĐỀ TÀI</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(2)}</div>

<h3 style="font-size:13pt; font-weight:bold;">II. MỤC ĐÍCH NGHIÊN CỨU</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(3)}</div>

<h3 style="font-size:13pt; font-weight:bold;">III. ĐỐI TƯỢNG NGHIÊN CỨU</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(4)}</div>

<h3 style="font-size:13pt; font-weight:bold;">IV. ĐỐI TƯỢNG KHẢO SÁT THỰC NGHIỆM</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(5)}</div>

<h3 style="font-size:13pt; font-weight:bold;">V. PHƯƠNG PHÁP NGHIÊN CỨU</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(6)}</div>

<h3 style="font-size:13pt; font-weight:bold;">VI. PHẠM VI VÀ KẾ HOẠCH NGHIÊN CỨU</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(7)}</div>

<h2 style="font-size:14pt; font-weight:bold;">PHẦN NỘI DUNG</h2>

<h3 style="font-size:13pt; font-weight:bold;">I. CƠ SỞ LÝ LUẬN</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(8)}</div>

<h3 style="font-size:13pt; font-weight:bold;">II. THỰC TRẠNG</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(9)}</div>

<h3 style="font-size:13pt; font-weight:bold;">III. BIỆN PHÁP THỰC HIỆN</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(10)}</div>

<h3 style="font-size:13pt; font-weight:bold;">IV. KẾT QUẢ ĐẠT ĐƯỢC</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(11)}</div>

<h2 style="font-size:14pt; font-weight:bold;">PHẦN KẾT LUẬN</h2>

<h3 style="font-size:13pt; font-weight:bold;">I. KẾT LUẬN CHUNG</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(12)}</div>

<h3 style="font-size:13pt; font-weight:bold;">II. BÀI HỌC KINH NGHIỆM</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(13)}</div>

<h3 style="font-size:13pt; font-weight:bold;">III. ĐỀ XUẤT - KHUYẾN NGHỊ</h3>
<div style="margin-bottom:12pt;">${getSectionHtml(14)}</div>

<h2 style="font-size:14pt; font-weight:bold;">PHỤ LỤC</h2>
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
      a.download = `SKKN_${activeInfo.title || 'export'}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      Swal.fire('Lỗi', error.message || 'Không thể chuẩn hóa và xuất file Word.', 'error');
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
      ? 'Đang khớp rất sát mục tiêu tổng thể.'
      : draftLengthMetrics.totalDeltaWords > 0
        ? `Toàn bài hiện còn thiếu khoảng ${draftLengthMetrics.totalDeltaWords} từ (~${(draftLengthMetrics.totalDeltaWords / EXPORT_WORDS_PER_PAGE).toFixed(1)} trang).`
        : `Toàn bài hiện đang dài hơn khoảng ${Math.abs(draftLengthMetrics.totalDeltaWords)} từ (~${(Math.abs(draftLengthMetrics.totalDeltaWords) / EXPORT_WORDS_PER_PAGE).toFixed(1)} trang).`;

    return (
      <div className="space-y-6">
        <div className="banner-header">
          <h2 className="text-2xl font-bold">Xuất SKKN</h2>
          <p className="text-white/80 mt-1">Tổng hợp và xuất file hoàn chỉnh</p>
        </div>
        <div className="content-card space-y-5">
          <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200">📊 Tiến độ hoàn thành</h3>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          <p className="text-sm text-slate-500">{completedSections.length}/{totalSections} phần đã hoàn thành ({progress}%)</p>
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
            <h3 className="font-bold text-lg text-green-600 dark:text-green-400">🎉 SKKN đã hoàn thành!</h3>
            <p className="text-sm text-slate-500">Tất cả các phần đã được viết xong. Bạn có thể xem lại từng phần hoặc xuất file.</p>
            {draftLengthMetrics.totalTargetWords > 0 && (
              <div className="info-box space-y-2">
                <p className="font-semibold">Chuẩn hóa tổng độ dài trước khi xuất</p>
                <p>Tổng hiện tại khoảng {draftLengthMetrics.totalActualWords} từ (~{draftLengthMetrics.totalActualPages} trang), mục tiêu khoảng {draftLengthMetrics.totalTargetWords} từ (~{draftLengthMetrics.totalTargetPages} trang).</p>
                <p>{draftDeltaLabel}</p>
                <p className="text-xs opacity-80">Khi bấm xuất file, app sẽ tự cân lại một vài mục lớn nếu tổng độ dài còn lệch nhiều.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => { void handleNormalizeBeforeExport(); }} disabled={isLoading || !draftLengthMetrics.totalTargetWords} className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Sparkles size={18} /> Chuẩn hóa toàn bài</button>
              <button onClick={() => { void exportToDocx(); }} disabled={isLoading} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"><FileText size={18} /> Tải xuống SKKN (.doc)</button>
              <button onClick={() => { void exportMarkdown(); }} disabled={isLoading} className="flex items-center gap-2 px-6 py-3 bg-slate-600 text-white rounded-xl font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileDown size={18} /> Tải xuống Markdown (.md)</button>
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
          <p className="text-[11px] text-slate-400 mt-0.5">Trợ lí viết SKKN thông minh • build {APP_BUILD_TAG}</p>
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
              <p className="text-[10px] text-slate-400">Đề tài:</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">{data.info.title}</p>
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => {
                localStorage.setItem('skkn_data_v3', JSON.stringify(data));
                Swal.fire({ icon: 'success', title: 'Đã lưu!', timer: 1000, showConfirmButton: false });
              }}
              className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-xs transition-all"
            >
              <Save size={14} /> Lưu phiên
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
              <Settings size={14} /> Cài đặt API Key
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
              <p className="font-bold text-slate-700 dark:text-slate-200">Đang chờ nội dung từ chuyên gia AI...</p>
              <p className="text-xs text-slate-400 text-center">Quá trình này có thể mất 30-60 giây tùy thuộc vào độ phức tạp</p>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="bottom-bar">
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Đang viết...
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
                  <h3 className="font-bold text-lg">Thiết lập Model & API Key</h3>
                  <p className="text-xs text-slate-400">Kết nối với Google Gemini API</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="ml-auto text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>
              <div className="p-5 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Chọn Model AI</label>
                  <div className="space-y-2">
                    {[
                      { name: 'Gemini 3 Flash', desc: 'Nhanh, hiệu quả cho tác vụ thông thường', badge: 'Default' },
                      { name: 'Gemini 3 Pro', desc: 'Mạnh mẽ, phù hợp tác vụ phức tạp', badge: '' },
                      { name: 'Gemini 2.5 Flash', desc: 'Ổn định, tốc độ cao', badge: '' },
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
                  💡 Nếu model đang chọn hết lượt hoặc quá tải, hệ thống sẽ tự chuyển model khác và áp dụng từ lần bấm tiếp theo để tiết kiệm quota.
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">🔑 API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Nhập Gemini API Key (AIza...)" className="form-input" />
                </div>
                <div className="hint-box space-y-1">
                  <p className="font-semibold text-xs">📖 Hướng dẫn lấy Gemini API Key:</p>
                  <ol className="text-xs space-y-0.5 list-decimal list-inside">
                    <li>Truy cập Google AI Studio</li>
                    <li>Đăng nhập tài khoản Google</li>
                    <li>Vào mục API Keys và nhấn "Create API key"</li>
                    <li>Copy key và dán vào ô trên</li>
                  </ol>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" className="inline-flex items-center gap-1 text-xs text-amber-600 font-bold hover:underline mt-1">🔗 Mở trang API Keys</a>
                </div>
                <button onClick={saveApiKey} className="btn-primary">Lưu cấu hình</button>
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
                    <h3 className="font-bold text-lg">Phân Tích Tên Đề Tài</h3>
                    <p className="text-white/70 text-xs">Kết quả đánh giá chi tiết (Quy trình 3 lớp)</p>
                  </div>
                </div>
                <button onClick={() => setShowAnalysis(false)} className="text-white/60 hover:text-white text-2xl">&times;</button>
              </div>

              {isAnalyzing ? (
                <div className="p-12 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <p className="font-semibold text-slate-300">Đang phân tích tên đề tài...</p>
                  <p className="text-xs text-slate-500">AI đang đánh giá theo 4 tiêu chí</p>
                </div>
              ) : analysisResult ? (
                <div className="p-5 space-y-5">
                  {/* Score & Overlap */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 rounded-xl p-5 text-center">
                      <p className="text-sm text-slate-400 mb-1">Tổng điểm</p>
                      <p className="text-5xl font-black">
                        {analysisResult.totalScore}<span className="text-lg text-slate-500">/100</span>
                      </p>
                      <p className="text-sm mt-1">⭐ {analysisResult.rating}</p>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-5">
                      <p className="text-sm text-slate-400 mb-2">Mức độ trùng lặp</p>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold mb-2 ${getOverlapColor(analysisResult.overlap?.level)}`}>
                        🔁 {analysisResult.overlap?.level}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{analysisResult.overlap?.explanation}</p>
                    </div>
                  </div>

                  {/* Detailed Scores */}
                  <div className="bg-slate-800 rounded-xl p-5 space-y-4">
                    <h4 className="font-bold flex items-center gap-2">📊 Chi tiết điểm số</h4>
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
                      <h4 className="font-bold mb-3 flex items-center gap-2">🧩 Cấu trúc tên đề tài</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: 'Hành động', value: analysisResult.structure.action },
                          { label: 'Công cụ', value: analysisResult.structure.tool },
                          { label: 'Môn học', value: analysisResult.structure.subject },
                          { label: 'Phạm vi', value: analysisResult.structure.scope },
                          { label: 'Mục đích', value: analysisResult.structure.purpose },
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
                      <h4 className="font-bold text-amber-400 mb-2 flex items-center gap-2">⚠️ Vấn đề cần khắc phục ({analysisResult.issues.length})</h4>
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
                      <h4 className="font-bold text-yellow-400 flex items-center gap-2">✨ Đề xuất tên thay thế</h4>
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
                                Swal.fire({ icon: 'success', title: 'Đã áp dụng!', text: 'Tên đề tài đã được cập nhật.', timer: 1500, showConfirmButton: false });
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                              Sử dụng
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
























































