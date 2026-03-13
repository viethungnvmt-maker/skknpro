
const MODELS = ['gemini-3-flash', 'gemini-3-pro', 'gemini-2.5-flash'];
// Index 0: Gemini 3 Flash (default)
// Index 1: Gemini 3 Pro (strong reasoning)
// Index 2: Gemini 2.5 Flash (stable + fast)
const WORDS_PER_PAGE = 420;
const TOKENS_PER_WORD = 2.4;
const MAX_SECTION_OUTPUT_TOKENS = 8192;

const SECTION_KEYS = {
  INTRO_REASON: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - I. L\u00fd do ch\u1ecdn \u0111\u1ec1 t\u00e0i',
  INTRO_PURPOSE: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - II. M\u1ee5c \u0111\u00edch nghi\u00ean c\u1ee9u',
  INTRO_OBJECT: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - III. \u0110\u1ed1i t\u01b0\u1ee3ng nghi\u00ean c\u1ee9u',
  INTRO_SURVEY: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - IV. \u0110\u1ed1i t\u01b0\u1ee3ng kh\u1ea3o s\u00e1t th\u1ef1c nghi\u1ec7m',
  INTRO_METHOD: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - V. Ph\u01b0\u01a1ng ph\u00e1p nghi\u00ean c\u1ee9u',
  INTRO_SCOPE: 'PH\u1ea6N M\u1ede \u0110\u1ea6U - VI. Ph\u1ea1m vi v\u00e0 k\u1ebf ho\u1ea1ch nghi\u00ean c\u1ee9u',
  CONTENT_THEORY: 'PH\u1ea6N N\u1ed8I DUNG - I. C\u01a1 s\u1edf l\u00fd lu\u1eadn',
  CONTENT_STATUS: 'PH\u1ea6N N\u1ed8I DUNG - II. Th\u1ef1c tr\u1ea1ng',
  CONTENT_MEASURES: 'PH\u1ea6N N\u1ed8I DUNG - III. Bi\u1ec7n ph\u00e1p th\u1ef1c hi\u1ec7n',
  CONTENT_RESULTS: 'PH\u1ea6N N\u1ed8I DUNG - IV. K\u1ebft qu\u1ea3 \u0111\u1ea1t \u0111\u01b0\u1ee3c',
  CONCLUSION_GENERAL: 'PH\u1ea6N K\u1ebeT LU\u1eacN - I. K\u1ebft lu\u1eadn chung',
  CONCLUSION_LESSONS: 'PH\u1ea6N K\u1ebeT LU\u1eacN - II. B\u00e0i h\u1ecdc kinh nghi\u1ec7m',
  CONCLUSION_PROPOSALS: 'PH\u1ea6N K\u1ebeT LU\u1eacN - III. \u0110\u1ec1 xu\u1ea5t - khuy\u1ebfn ngh\u1ecb',
  APPENDIX: 'PH\u1ee4 L\u1ee4C',
} as const;


const SECTION_LENGTH_WEIGHTS: Record<string, number> = {
  [SECTION_KEYS.INTRO_REASON]: 0.07,
  [SECTION_KEYS.INTRO_PURPOSE]: 0.05,
  [SECTION_KEYS.INTRO_OBJECT]: 0.04,
  [SECTION_KEYS.INTRO_SURVEY]: 0.05,
  [SECTION_KEYS.INTRO_METHOD]: 0.06,
  [SECTION_KEYS.INTRO_SCOPE]: 0.05,
  [SECTION_KEYS.CONTENT_THEORY]: 0.11,
  [SECTION_KEYS.CONTENT_STATUS]: 0.14,
  [SECTION_KEYS.CONTENT_MEASURES]: 0.20,
  [SECTION_KEYS.CONTENT_RESULTS]: 0.10,
  [SECTION_KEYS.CONCLUSION_GENERAL]: 0.04,
  [SECTION_KEYS.CONCLUSION_LESSONS]: 0.03,
  [SECTION_KEYS.CONCLUSION_PROPOSALS]: 0.03,
  [SECTION_KEYS.APPENDIX]: 0.03,
};

const SECTION_NAMES = Object.keys(SECTION_LENGTH_WEIGHTS);

export interface SectionLengthPlan {
  sectionName: string;
  totalPages: number;
  targetPages: number;
  targetPagesLabel: string;
  targetWords: number;
  minWords: number;
  maxWords: number;
  maxTokens: number;
}

function parsePageLimit(pageLimit?: string | number): number {
  if (pageLimit === undefined || pageLimit === null) return 0;
  const parsed = Number.parseInt(String(pageLimit).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildWordBudgets(totalPages: number): Record<string, number> {
  const totalWords = totalPages * WORDS_PER_PAGE;
  const totalWeight = SECTION_NAMES.reduce((sum, name) => sum + SECTION_LENGTH_WEIGHTS[name], 0);

  const draftBudgets = SECTION_NAMES.map((name, index) => {
    const rawWords = (totalWords * SECTION_LENGTH_WEIGHTS[name]) / totalWeight;
    const baseWords = Math.floor(rawWords);

    return {
      name,
      index,
      baseWords,
      remainder: rawWords - baseWords,
    };
  });

  let remainingWords = totalWords - draftBudgets.reduce((sum, item) => sum + item.baseWords, 0);

  draftBudgets
    .sort((a, b) => {
      if (b.remainder !== a.remainder) return b.remainder - a.remainder;
      return a.index - b.index;
    })
    .forEach((item) => {
      if (remainingWords <= 0) return;
      item.baseWords += 1;
      remainingWords -= 1;
    });

  return draftBudgets.reduce<Record<string, number>>((acc, item) => {
    acc[item.name] = item.baseWords;
    return acc;
  }, {});
}

function buildLengthPlan(sectionName: string, totalPages: number, targetWords: number): SectionLengthPlan {
  const minWords = Math.max(1, Math.round(targetWords * 0.5));
  const maxWords = Math.max(minWords, Math.round(targetWords * 1.2));

  return {
    sectionName,
    totalPages,
    targetPages: Number((targetWords / WORDS_PER_PAGE).toFixed(1)),
    targetPagesLabel: (targetWords / WORDS_PER_PAGE).toFixed(1),
    targetWords,
    minWords,
    maxWords,
    maxTokens: Math.min(
      MAX_SECTION_OUTPUT_TOKENS,
      Math.max(512, Math.round((maxWords + 60) * TOKENS_PER_WORD)),
    ),
  };
}

export function getAllSectionLengthPlans(pageLimit?: string | number): SectionLengthPlan[] {
  const totalPages = parsePageLimit(pageLimit);
  if (!totalPages) return [];

  const wordBudgets = buildWordBudgets(totalPages);
  return SECTION_NAMES.map((sectionName) => buildLengthPlan(sectionName, totalPages, wordBudgets[sectionName]));
}

export function getSectionLengthPlan(sectionName: string, pageLimit?: string | number): SectionLengthPlan | null {
  const totalPages = parsePageLimit(pageLimit);
  if (!totalPages) return null;

  const wordBudgets = buildWordBudgets(totalPages);
  const targetWords = wordBudgets[sectionName];
  if (!targetWords) return null;

  return buildLengthPlan(sectionName, totalPages, targetWords);
}

export function estimateWordCount(markdown: string): number {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = plainText.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return words?.length ?? 0;
}

export const GEMINI_MODEL_SWITCH_EVENT = 'gemini-model-auto-switched';

export interface GeminiModelSwitchDetail {
  fromModel: string;
  fromLabel: string;
  fromModelIndex: number;
  toModel: string;
  toLabel: string;
  toModelIndex: number;
  reason: string;
}

const MODEL_LABELS: Record<string, string> = {
  'gemini-3-flash': 'Gemini 3 Flash',
  'gemini-3-pro': 'Gemini 3 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
};

const MAX_RATE_LIMIT_RETRIES = 0;
const RATE_LIMIT_WAIT_BASE_MS = 12000;
const MAX_FALLBACK_MODELS = 0;

const MODEL_COOLDOWN_STORAGE_KEY = 'gemini_model_cooldowns_v1';
const RATE_LIMIT_COOLDOWN_MS = 90 * 1000;
const QUOTA_COOLDOWN_MS = 30 * 60 * 1000;
const MODEL_UNAVAILABLE_COOLDOWN_MS = 5 * 60 * 1000;
const GENERIC_ERROR_COOLDOWN_MS = 2 * 60 * 1000;

type ModelCooldownMap = Record<string, number>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorText = (error: any) => {
  const message = error?.message || '';
  const details = error?.error?.message || error?.error?.details || '';
  const status = String(error?.status || error?.error?.status || '');
  return `${message} ${details} ${status}`.toLowerCase();
};

const getModelLabel = (modelName: string) => MODEL_LABELS[modelName] || modelName;

const isRateLimitError = (text: string) => text.includes('resource_exhausted')
  || text.includes('429')
  || text.includes('too many requests')
  || text.includes('rate limit')
  || text.includes('rpm')
  || text.includes('tpm')
  || text.includes('rate_limit_exceeded');

const isQuotaError = (text: string) => text.includes('insufficient_quota')
  || text.includes('exceeded your current quota')
  || text.includes('daily limit')
  || text.includes('quota')
  || text.includes('billing')
  || text.includes('credit');

const isModelUnavailableError = (text: string) => text.includes('model not found')
  || text.includes('not found')
  || text.includes('does not exist')
  || text.includes('unsupported')
  || text.includes('overloaded')
  || text.includes('unavailable')
  || text.includes('service unavailable')
  || text.includes('503')
  || text.includes('404');

const getSwitchReasonText = (text: string) => {
  if (isQuotaError(text)) return 'hết lượt/quota';
  if (isRateLimitError(text)) return 'chạm giới hạn tốc độ tạm thời';
  if (isModelUnavailableError(text)) return 'quá tải hoặc tạm không khả dụng';
  return 'gặp lỗi tạm thời';
};

const getCooldownDurationMs = (text: string) => {
  if (isQuotaError(text)) return QUOTA_COOLDOWN_MS;
  if (isRateLimitError(text)) return RATE_LIMIT_COOLDOWN_MS;
  if (isModelUnavailableError(text)) return MODEL_UNAVAILABLE_COOLDOWN_MS;
  return GENERIC_ERROR_COOLDOWN_MS;
};

const readCooldownMap = (): ModelCooldownMap => {
  if (typeof localStorage === 'undefined') return {};

  try {
    const raw = localStorage.getItem(MODEL_COOLDOWN_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as ModelCooldownMap;
    if (!parsed || typeof parsed !== 'object') return {};

    return parsed;
  } catch {
    return {};
  }
};

const writeCooldownMap = (map: ModelCooldownMap) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(MODEL_COOLDOWN_STORAGE_KEY, JSON.stringify(map));
};

const cleanCooldownMap = (map: ModelCooldownMap) => {
  const now = Date.now();

  return Object.entries(map).reduce<ModelCooldownMap>((acc, [modelName, until]) => {
    if (typeof until === 'number' && until > now) {
      acc[modelName] = until;
    }

    return acc;
  }, {});
};

const getModelCooldownRemainingMs = (modelName: string) => {
  const map = cleanCooldownMap(readCooldownMap());
  writeCooldownMap(map);

  const until = map[modelName];
  if (!until) return 0;

  return Math.max(0, until - Date.now());
};

const isModelCoolingDown = (modelName: string) => getModelCooldownRemainingMs(modelName) > 0;

const setModelCooldownForError = (modelName: string, errorText: string) => {
  const map = cleanCooldownMap(readCooldownMap());
  const durationMs = getCooldownDurationMs(errorText);

  map[modelName] = Date.now() + durationMs;
  writeCooldownMap(map);

  return durationMs;
};

const persistPreferredModel = (modelIndex: number) => {
  if (typeof localStorage === 'undefined') return;

  localStorage.setItem('gemini_model_index', String(modelIndex));
  localStorage.setItem('ai_model_index', String(modelIndex));
};

const emitModelSwitchEvent = (detail: GeminiModelSwitchDetail) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent<GeminiModelSwitchDetail>(GEMINI_MODEL_SWITCH_EVENT, { detail }));
};

const getStoredModelIndex = () => {
  const fromStorage = parseInt(localStorage.getItem('gemini_model_index') || localStorage.getItem('ai_model_index') || '0');
  return Number.isInteger(fromStorage) && fromStorage >= 0 && fromStorage < MODELS.length ? fromStorage : 0;
};

const pickStartModelIndex = (preferredIndex: number) => {
  const preferredModel = MODELS[preferredIndex];
  if (!isModelCoolingDown(preferredModel)) return preferredIndex;

  for (let i = 0; i < MODELS.length; i++) {
    if (i === preferredIndex) continue;
    if (!isModelCoolingDown(MODELS[i])) return i;
  }

  return preferredIndex;
};

const getFallbackCandidates = (failedModelIndex: number, triedModels: Set<number>) => {
  const untriedIndexes = MODELS
    .map((_, index) => index)
    .filter((index) => index !== failedModelIndex && !triedModels.has(index));

  const readyNow = untriedIndexes.filter((index) => !isModelCoolingDown(MODELS[index]));
  return readyNow.length > 0 ? readyNow : untriedIndexes;
};

const shouldTryFallback = (errorText: string) => isRateLimitError(errorText)
  || isQuotaError(errorText)
  || isModelUnavailableError(errorText);

export async function callGeminiAI(
  prompt: string,
  modelIndex?: number,
  _triedModels?: Set<number>,
  maxTokens?: number,
  _rateLimitRetryCount = 0,
  _fallbackCount = 0,
): Promise<string | null> {
  if (modelIndex === undefined) {
    modelIndex = pickStartModelIndex(getStoredModelIndex());
  }

  const triedModels = _triedModels || new Set<number>();
  triedModels.add(modelIndex);

  const apiKey = localStorage.getItem('gemini_api_key');
  const modelName = MODELS[modelIndex];

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-gemini-key': apiKey } : {}),
      },
      body: JSON.stringify({
        prompt,
        model: modelName,
        maxTokens: maxTokens || 8192,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }

    return payload?.text || '';
  } catch (error: any) {
    const errorText = getErrorText(error);
    console.error(`Error with model ${modelName}:`, error);

    setModelCooldownForError(modelName, errorText);

    if (isRateLimitError(errorText) && _rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES) {
      const waitMs = RATE_LIMIT_WAIT_BASE_MS * (_rateLimitRetryCount + 1);
      await sleep(waitMs);
      return callGeminiAI(prompt, modelIndex, triedModels, maxTokens, _rateLimitRetryCount + 1, _fallbackCount);
    }

    if (shouldTryFallback(errorText)) {
      const candidates = getFallbackCandidates(modelIndex, triedModels);
      const fallbackIndex = candidates[0];

      if (fallbackIndex !== undefined) {
        const fallbackModel = MODELS[fallbackIndex];
        const reason = getSwitchReasonText(errorText);

        persistPreferredModel(fallbackIndex);

        emitModelSwitchEvent({
          fromModel: modelName,
          fromLabel: getModelLabel(modelName),
          fromModelIndex: modelIndex,
          toModel: fallbackModel,
          toLabel: getModelLabel(fallbackModel),
          toModelIndex: fallbackIndex,
          reason,
        });

        throw new Error(
          `${getModelLabel(modelName)} ${reason}. Hệ thống đã tự chuyển sang ${getModelLabel(fallbackModel)} để tiết kiệm request. Vui lòng bấm lại 1 lần để tiếp tục.`,
        );
      }
    }

    if (isRateLimitError(errorText)) {
      throw new Error('Model AI đang chạm giới hạn tốc độ (RPM/TPM). Hệ thống đã chuyển model dự phòng cho lần bấm tiếp theo để tiết kiệm request. Vui lòng chờ 30-60 giây rồi bấm lại.');
    }

    if (isQuotaError(errorText)) {
      throw new Error('Model AI đang hết lượt/quota. Hệ thống đã chuyển model dự phòng cho lần bấm tiếp theo để tiết kiệm request. Vui lòng bấm lại sau.');
    }

    if (isModelUnavailableError(errorText)) {
      throw new Error('Model AI đang quá tải hoặc tạm không khả dụng. Hệ thống đã chuyển model dự phòng cho lần bấm tiếp theo để tiết kiệm request. Vui lòng bấm lại sau ít phút.');
    }

    throw error;
  }
}

export const PROMPTS = {
  GENERATE_OUTLINE: (info: any) => `
    Bạn là một chuyên gia giáo dục Việt Nam. Hãy lập một dàn ý chi tiết cho Sáng kiến kinh nghiệm (SKKN) với các thông tin sau:
    - Tên đề tài: ${info.title}
    - Môn học: ${info.subject || 'Chưa xác định'}
    - Khối lớp: ${info.grade || 'Chưa xác định'}
    - Cấp học: ${info.level || 'Chưa xác định'}
    - Tên trường: ${info.school || 'Chưa xác định'}
    - Địa điểm: ${info.location || 'Chưa xác định'}
    - Điều kiện CSVC: ${info.facilities || 'Chưa xác định'}
    - Sách giáo khoa: ${info.textbook || 'Chưa xác định'}
    - Đối tượng nghiên cứu: ${info.target || 'Chưa xác định'}
    - Thời gian: ${info.duration || 'Chưa xác định'}
    - Ứng dụng AI/Công nghệ: ${info.techUsed || 'Chưa xác định'}
    - Đặc thù đề tài: ${info.focus || 'Chưa xác định'}
    ${info.pageLimit ? `- Tổng độ dài mục tiêu: khoảng ${info.pageLimit} trang A4` : ''}
    ${info.extraExamples ? '- Yêu cầu thêm nhiều bài toán thực tế, ví dụ minh họa' : ''}
    ${info.extraTables ? '- Yêu cầu bổ sung bảng biểu, số liệu thống kê' : ''}
    ${info.customRequirements ? `- Yêu cầu bổ sung: ${info.customRequirements}` : ''}

    Yeu cau dan y phai bam sat cau truc sau:
    PHAN MO DAU
      I. Ly do chon de tai
      II. Muc dich nghien cuu
      III. Doi tuong nghien cuu
      IV. Doi tuong khao sat thuc nghiem
      V. Phuong phap nghien cuu
      VI. Pham vi va ke hoach nghien cuu

    PHAN NOI DUNG
      I. Co so ly luan
        1. Gioi thieu ve phan mem Logo
        2. Vi sao Logo duoc dua vao day trong truong tieu hoc
        3. Khi hoc Logo hoc sinh duoc hoc va co the lam gi
      II. Thuc trang
        1. Thuan loi va kho khan
          1.1. Thuan loi
          1.2. Kho khan
        2. Thuc trang day - hoc phan mem Logo o truong tieu hoc
      III. Bien phap thuc hien
        1. Giup hoc sinh phat hien va khac phuc loi thuong gap
        2. Giup hoc sinh nam duoc yeu cau cua bai tap
          2.1. Tao thoi quen nghien cuu de bai, phan tich hinh mau
          2.2. Su dung cau lenh Wait giup hoc sinh phan tich de bai
        3. Giup hoc sinh viet nhanh cac cau lenh lap, cac thu tuc
        4. Bieu duong, khich le su tim toi, sang tao cua hoc sinh
      IV. Ket qua dat duoc

    PHAN KET LUAN
      I. Ket luan chung
      II. Bai hoc kinh nghiem
      III. De xuat - khuyen nghi

    PHU LUC

    QUAN TRỌNG:
    - Chỉ viết dàn ý, không viết nội dung chi tiết.
    - Không ghi số trang cho từng phần trong phần trả lời.
    - Không viết lời mở đầu hay bình luận thêm.
    - Mỗi phần gồm 3-5 ý chính ngắn gọn, rõ ràng.
    - Trả về bằng Markdown.
  `,

  WRITE_SECTION: (sectionName: string, outline: string, info: any, planOverride?: SectionLengthPlan | null) => {
    const plan = planOverride || getSectionLengthPlan(sectionName, info.pageLimit);

    const lengthBlock = plan
      ? `
    === RÀNG BUỘC ĐỘ DÀI BẮT BUỘC ===
    - Toàn bộ SKKN chỉ được dài khoảng ${plan.totalPages} trang A4.
    - Riêng mục "${sectionName}" chỉ được chiếm khoảng ${plan.targetPagesLabel} trang, tương đương khoảng ${plan.targetWords} từ.
    - Khoảng chấp nhận được cho mục này là từ ${plan.minWords} đến ${plan.maxWords} từ.
    - Trước khi trả lời, tự kiểm tra độ dài và chủ động rút gọn hoặc bổ sung để nằm trong khoảng cho phép.
    - Không được viết dài hơn đáng kể so với mức đã phân bổ cho mục này.
    ==================================
    `
      : '';

    return {
      prompt: `
    ${lengthBlock}
    Dựa trên dàn ý SKKN sau:
    ${outline}

    Hãy viết nội dung cho phần: "${sectionName}".
    Thông tin chung:
    - Tên đề tài: ${info.title}
    - Môn học: ${info.subject || 'Chưa xác định'}
    - Khối lớp: ${info.grade || 'Chưa xác định'}
    - Tên trường: ${info.school || 'Chưa xác định'}
    - Địa điểm: ${info.location || 'Chưa xác định'}
    ${info.extraExamples ? '- Yêu cầu thêm nhiều ví dụ minh họa thực tế' : ''}
    ${info.extraTables ? '- Yêu cầu bổ sung bảng biểu, số liệu thống kê' : ''}
    ${info.customRequirements ? `- Yêu cầu bổ sung: ${info.customRequirements}` : ''}

    Yêu cầu:
    - Không viết lời dẫn nhập kiểu "Dưới đây là...", "Phần này trình bày...".
    - Viết đúng trọng tâm đề tài, tránh lan man và tránh mẫu câu chung chung dùng cho mọi SKKN.
    - Văn phong sư phạm, trang trọng, cụ thể, có chi tiết thực tế lớp học khi phù hợp.
    - Nếu có bảng biểu thì điền đầy đủ số liệu hợp lý, không để ô trống.
    - Không sử dụng LaTeX.
    - Trả về đúng nội dung cuối cùng bằng Markdown, không kèm giải thích.
    ${plan ? `- Mục tiêu độ dài: khoảng ${plan.targetWords} từ, chấp nhận trong khoảng ${plan.minWords}-${plan.maxWords} từ. - BẮT BUỘC không được dưới ${plan.minWords} từ; nếu còn ngắn phải tự viết tiếp cho đủ.` : '- Viết chi tiết, đầy đủ, không tóm tắt.'}
        ${sectionName === SECTION_KEYS.CONTENT_MEASURES
      ? `- Bat buoc trinh bay du 4 nhom bien phap theo khung: (1) phat hien va khac phuc loi thuong gap; (2) nam yeu cau bai tap voi 2.1 va 2.2; (3) viet nhanh cau lenh lap, thu tuc; (4) bieu duong, khich le sang tao.`
      : ''}
    ${sectionName === SECTION_KEYS.CONTENT_RESULTS
      ? `- Ưu tiên nêu rõ số liệu trước và sau áp dụng, minh chứng định lượng và định tính.`
      : ''}
  `,
      maxTokens: plan?.maxTokens || 8192,
    };
  },

  REWRITE_SECTION_LENGTH: (
    sectionName: string,
    content: string,
    info: any,
    plan: SectionLengthPlan,
    mode: 'shorten' | 'expand',
  ) => `
    Bạn đang biên tập lại một mục trong SKKN để khớp đúng độ dài đã phân bổ.

    Thông tin cố định:
    - Tên đề tài: ${info.title}
    - Phần cần chỉnh: ${sectionName}
    - Tổng độ dài toàn bài: khoảng ${plan.totalPages} trang A4
    - Mục này chỉ được chiếm khoảng ${plan.targetPagesLabel} trang
    - Mục tiêu số từ: khoảng ${plan.targetWords} từ
    - Khoảng chấp nhận: ${plan.minWords}-${plan.maxWords} từ

    Nhiệm vụ:
    - ${mode === 'shorten' ? 'Rút gọn bớt nội dung thừa, bỏ lặp ý, giữ lại ý quan trọng nhất.' : 'Mở rộng vừa đủ bằng ví dụ, chi tiết triển khai, minh họa thực tế nhưng không lan man.'}
    - BẮT BUỘC đảm bảo bản cuối cùng nằm trong khoảng ${plan.minWords}-${plan.maxWords} từ, ưu tiên gần ${plan.targetWords} từ.
    ${sectionName === SECTION_KEYS.CONTENT_MEASURES
      ? '- BAT BUOC giu du cac y 1, 2 (bao gom 2.1, 2.2), 3, 4 trong phan bien phap; khong duoc bo muc nao du phai rut gon.'
      : ''}
    - Nếu còn ngắn hơn ${plan.minWords} từ thì tiếp tục bổ sung ý, ví dụ, minh họa để đủ độ dài.
    - Nếu còn dài hơn ${plan.maxWords} từ thì tiếp tục rút gọn cho đến khi đạt yêu cầu.
    - Không thêm lời giải thích về việc chỉnh sửa.
    - Chỉ trả về phiên bản nội dung cuối cùng bằng Markdown.

    Nội dung hiện tại:
    ${content}
  `,
  ANALYZE_TITLE: (title: string, subject?: string) => `
    Bạn là chuyên gia đánh giá tên đề tài Sáng kiến kinh nghiệm (SKKN) ở Việt Nam.

    Hãy phân tích tên đề tài sau: "${title}"
    ${subject ? `Môn học: ${subject}` : ''}

    Hãy trả về CHÍNH XÁC một JSON object (không markdown, không giải thích thêm, không bọc trong code block) với cấu trúc sau:
    {
      "totalScore": <số nguyên 0-100>,
      "rating": "<Xuất sắc|Tốt|Khá|Trung bình|Yếu>",
      "overlap": {
        "level": "<Thấp|Trung bình|Cao>",
        "explanation": "<giải thích ngắn gọn về mức độ trùng lặp>"
      },
      "criteria": [
        {
          "name": "Độ cụ thể",
          "score": <0-25>,
          "maxScore": 25,
          "description": "<giải thích ngắn>"
        },
        {
          "name": "Tính mới",
          "score": <0-30>,
          "maxScore": 30,
          "description": "<giải thích ngắn>"
        },
        {
          "name": "Tính khả thi",
          "score": <0-25>,
          "maxScore": 25,
          "description": "<giải thích ngắn>"
        },
        {
          "name": "Độ rõ ràng",
          "score": <0-20>,
          "maxScore": 20,
          "description": "<giải thích ngắn>"
        }
      ],
      "structure": {
        "action": "<hành động chính>",
        "tool": "<công cụ/phương pháp>",
        "subject": "<môn học/chủ đề>",
        "scope": "<phạm vi>",
        "purpose": "<mục đích>"
      },
      "issues": [
        "<vấn đề 1>",
        "<vấn đề 2>"
      ],
      "suggestions": [
        {
          "title": "<tên đề tài gợi ý 1>",
          "score": <điểm dự kiến 0-100>,
          "reason": "<lý do ngắn>"
        },
        {
          "title": "<tên đề tài gợi ý 2>",
          "score": <điểm dự kiến 0-100>,
          "reason": "<lý do ngắn>"
        },
        {
          "title": "<tên đề tài gợi ý 3>",
          "score": <điểm dự kiến 0-100>,
          "reason": "<lý do ngắn>"
        }
      ]
    }

    Chỉ trả về JSON thuần. totalScore = tổng 4 criteria scores.
  `,
};















