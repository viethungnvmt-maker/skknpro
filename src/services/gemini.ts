
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
// Index 0: Gemini 2.5 Flash (default)
// Index 1: Gemini 2.0 Flash (stable + fast)
// Index 2: Gemini 2.0 Flash Lite (lower cost)
const WORDS_PER_PAGE = 420;
const TOKENS_PER_WORD = 2.4;
const MAX_SECTION_OUTPUT_TOKENS = 8192;

const SECTION_LENGTH_WEIGHTS: Record<string, number> = {
  'I.1. TÃ­nh cáº¥p thiáº¿t pháº£i tiáº¿n hÃ nh sÃ¡ng kiáº¿n': 0.08,
  'I.2. Má»¥c tiÃªu cá»§a Ä‘á» tÃ i, sÃ¡ng kiáº¿n': 0.04,
  'I.3. Thá»i gian, Ä‘á»‘i tÆ°á»£ng, pháº¡m vi nghiÃªn cá»©u': 0.03,
  'II.1. Hiá»‡n tráº¡ng váº¥n Ä‘á»': 0.1,
  'II.2. Giáº£i phÃ¡p thá»±c hiá»‡n sÃ¡ng kiáº¿n': 0.25,
  'II.3. Káº¿t quáº£ sau khi Ã¡p dá»¥ng giáº£i phÃ¡p sÃ¡ng kiáº¿n': 0.15,
  'II.4. Hiá»‡u quáº£ cá»§a sÃ¡ng kiáº¿n': 0.15,
  'II.5. TÃ­nh kháº£ thi': 0.06,
  'II.6. Thá»i gian thá»±c hiá»‡n': 0.03,
  'II.7. Kinh phÃ­ thá»±c hiá»‡n': 0.02,
  'III. Kiáº¿n nghá»‹, Ä‘á» xuáº¥t': 0.1,
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

  const words = plainText.match(/[\p{L}\p{N}]+(?:['â€™-][\p{L}\p{N}]+)*/gu);
  return words?.length ?? 0;
}

const RATE_LIMIT_WAIT_BASE_MS = 12000;
const MAX_RATE_LIMIT_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorText = (error: any) => {
  const message = error?.message || '';
  const details = error?.error?.message || error?.error?.details || '';
  const status = String(error?.status || error?.error?.status || '');
  return `${message} ${details} ${status}`.toLowerCase();
};

const isRateLimitError = (error: any) => {
  const text = getErrorText(error);
  return text.includes('resource_exhausted')
    || text.includes('429')
    || text.includes('too many requests')
    || text.includes('rate limit')
    || text.includes('rpm')
    || text.includes('tpm')
    || text.includes('rate_limit_exceeded');
};

export async function callGeminiAI(
  prompt: string,
  modelIndex?: number,
  _triedModels?: Set<number>,
  maxTokens?: number,
  _rateLimitRetryCount = 0,
): Promise<string | null> {
  if (modelIndex === undefined) {
    modelIndex = parseInt(localStorage.getItem('gemini_model_index') || localStorage.getItem('ai_model_index') || '0');
    if (isNaN(modelIndex) || modelIndex < 0 || modelIndex >= MODELS.length) modelIndex = 0;
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
    console.error(`Error with model ${modelName}:`, error);

    if (isRateLimitError(error)) {
      if (_rateLimitRetryCount < MAX_RATE_LIMIT_RETRIES) {
        const waitMs = RATE_LIMIT_WAIT_BASE_MS * (_rateLimitRetryCount + 1);
        console.warn(`Rate limit hit on ${modelName}. Retrying in ${waitMs}ms...`);
        await sleep(waitMs);
        return callGeminiAI(prompt, modelIndex, triedModels, maxTokens, _rateLimitRetryCount + 1);
      }

      throw new Error(
        'Äang cháº¡m giá»›i háº¡n tá»‘c Ä‘á»™ API (RPM/TPM), khÃ´ng pháº£i háº¿t quota ngÃ y. Vui lÃ²ng chá» 30-60 giÃ¢y rá»“i thá»­ láº¡i.',
      );
    }

    for (let i = 0; i < MODELS.length; i++) {
      if (triedModels.has(i)) continue;
      if (MODELS[i] === modelName) continue;

      console.log(`Falling back to ${MODELS[i]}...`);
      return callGeminiAI(prompt, i, triedModels, maxTokens, 0);
    }

    throw error;
  }
}

export const PROMPTS = {
  GENERATE_OUTLINE: (info: any) => `
    Báº¡n lÃ  má»™t chuyÃªn gia giÃ¡o dá»¥c Viá»‡t Nam. HÃ£y láº­p má»™t dÃ n Ã½ chi tiáº¿t cho SÃ¡ng kiáº¿n kinh nghiá»‡m (SKKN) vá»›i cÃ¡c thÃ´ng tin sau:
    - TÃªn Ä‘á» tÃ i: ${info.title}
    - MÃ´n há»c: ${info.subject || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Khá»‘i lá»›p: ${info.grade || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Cáº¥p há»c: ${info.level || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - TÃªn trÆ°á»ng: ${info.school || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Äá»‹a Ä‘iá»ƒm: ${info.location || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Äiá»u kiá»‡n CSVC: ${info.facilities || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - SÃ¡ch giÃ¡o khoa: ${info.textbook || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Äá»‘i tÆ°á»£ng nghiÃªn cá»©u: ${info.target || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Thá»i gian: ${info.duration || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - á»¨ng dá»¥ng AI/CÃ´ng nghá»‡: ${info.techUsed || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Äáº·c thÃ¹ Ä‘á» tÃ i: ${info.focus || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    ${info.pageLimit ? `- Tá»•ng Ä‘á»™ dÃ i má»¥c tiÃªu: khoáº£ng ${info.pageLimit} trang A4` : ''}
    ${info.extraExamples ? '- YÃªu cáº§u thÃªm nhiá»u bÃ i toÃ¡n thá»±c táº¿, vÃ­ dá»¥ minh há»a' : ''}
    ${info.extraTables ? '- YÃªu cáº§u bá»• sung báº£ng biá»ƒu, sá»‘ liá»‡u thá»‘ng kÃª' : ''}
    ${info.customRequirements ? `- YÃªu cáº§u bá»• sung: ${info.customRequirements}` : ''}

    YÃªu cáº§u dÃ n Ã½ pháº£i bÃ¡m sÃ¡t cáº¥u trÃºc chuáº©n SKKN:
    I. Äáº·t váº¥n Ä‘á»
      1. TÃ­nh cáº¥p thiáº¿t pháº£i tiáº¿n hÃ nh sÃ¡ng kiáº¿n
      2. Má»¥c tiÃªu cá»§a Ä‘á» tÃ i, sÃ¡ng kiáº¿n
      3. Thá»i gian, Ä‘á»‘i tÆ°á»£ng, pháº¡m vi nghiÃªn cá»©u
    II. Ná»™i dung cá»§a sÃ¡ng kiáº¿n
      1. Hiá»‡n tráº¡ng váº¥n Ä‘á»
      2. Giáº£i phÃ¡p thá»±c hiá»‡n sÃ¡ng kiáº¿n Ä‘á»ƒ giáº£i quyáº¿t váº¥n Ä‘á»
      3. Káº¿t quáº£ sau khi Ã¡p dá»¥ng giáº£i phÃ¡p sÃ¡ng kiáº¿n táº¡i Ä‘Æ¡n vá»‹
      4. Hiá»‡u quáº£ cá»§a sÃ¡ng kiáº¿n
      5. TÃ­nh kháº£ thi
      6. Thá»i gian thá»±c hiá»‡n Ä‘á» tÃ i, sÃ¡ng kiáº¿n
      7. Kinh phÃ­ thá»±c hiá»‡n Ä‘á» tÃ i, sÃ¡ng kiáº¿n
    III. Kiáº¿n nghá»‹, Ä‘á» xuáº¥t

    QUAN TRá»ŒNG:
    - Chá»‰ viáº¿t dÃ n Ã½, khÃ´ng viáº¿t ná»™i dung chi tiáº¿t.
    - KhÃ´ng ghi sá»‘ trang cho tá»«ng pháº§n trong pháº§n tráº£ lá»i.
    - KhÃ´ng viáº¿t lá»i má»Ÿ Ä‘áº§u hay bÃ¬nh luáº­n thÃªm.
    - Má»—i pháº§n gá»“m 3-5 Ã½ chÃ­nh ngáº¯n gá»n, rÃµ rÃ ng.
    - Tráº£ vá» báº±ng Markdown.
  `,

  WRITE_SECTION: (sectionName: string, outline: string, info: any, planOverride?: SectionLengthPlan | null) => {
    const plan = planOverride || getSectionLengthPlan(sectionName, info.pageLimit);

    const lengthBlock = plan
      ? `
    === RÃ€NG BUá»˜C Äá»˜ DÃ€I Báº®T BUá»˜C ===
    - ToÃ n bá»™ SKKN chá»‰ Ä‘Æ°á»£c dÃ i khoáº£ng ${plan.totalPages} trang A4.
    - RiÃªng má»¥c "${sectionName}" chá»‰ Ä‘Æ°á»£c chiáº¿m khoáº£ng ${plan.targetPagesLabel} trang, tÆ°Æ¡ng Ä‘Æ°Æ¡ng khoáº£ng ${plan.targetWords} tá»«.
    - Khoáº£ng cháº¥p nháº­n Ä‘Æ°á»£c cho má»¥c nÃ y lÃ  tá»« ${plan.minWords} Ä‘áº¿n ${plan.maxWords} tá»«.
    - TrÆ°á»›c khi tráº£ lá»i, tá»± kiá»ƒm tra Ä‘á»™ dÃ i vÃ  chá»§ Ä‘á»™ng rÃºt gá»n hoáº·c bá»• sung Ä‘á»ƒ náº±m trong khoáº£ng cho phÃ©p.
    - KhÃ´ng Ä‘Æ°á»£c viáº¿t dÃ i hÆ¡n Ä‘Ã¡ng ká»ƒ so vá»›i má»©c Ä‘Ã£ phÃ¢n bá»• cho má»¥c nÃ y.
    ==================================
    `
      : '';

    return {
      prompt: `
    ${lengthBlock}
    Dá»±a trÃªn dÃ n Ã½ SKKN sau:
    ${outline}

    HÃ£y viáº¿t ná»™i dung cho pháº§n: "${sectionName}".
    ThÃ´ng tin chung:
    - TÃªn Ä‘á» tÃ i: ${info.title}
    - MÃ´n há»c: ${info.subject || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Khá»‘i lá»›p: ${info.grade || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - TÃªn trÆ°á»ng: ${info.school || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    - Äá»‹a Ä‘iá»ƒm: ${info.location || 'ChÆ°a xÃ¡c Ä‘á»‹nh'}
    ${info.extraExamples ? '- YÃªu cáº§u thÃªm nhiá»u vÃ­ dá»¥ minh há»a thá»±c táº¿' : ''}
    ${info.extraTables ? '- YÃªu cáº§u bá»• sung báº£ng biá»ƒu, sá»‘ liá»‡u thá»‘ng kÃª' : ''}
    ${info.customRequirements ? `- YÃªu cáº§u bá»• sung: ${info.customRequirements}` : ''}

    YÃªu cáº§u:
    - KhÃ´ng viáº¿t lá»i dáº«n nháº­p kiá»ƒu "DÆ°á»›i Ä‘Ã¢y lÃ ...", "Pháº§n nÃ y trÃ¬nh bÃ y...".
    - Viáº¿t Ä‘Ãºng trá»ng tÃ¢m Ä‘á» tÃ i, trÃ¡nh lan man vÃ  trÃ¡nh máº«u cÃ¢u chung chung dÃ¹ng cho má»i SKKN.
    - VÄƒn phong sÆ° pháº¡m, trang trá»ng, cá»¥ thá»ƒ, cÃ³ chi tiáº¿t thá»±c táº¿ lá»›p há»c khi phÃ¹ há»£p.
    - Náº¿u cÃ³ báº£ng biá»ƒu thÃ¬ Ä‘iá»n Ä‘áº§y Ä‘á»§ sá»‘ liá»‡u há»£p lÃ½, khÃ´ng Ä‘á»ƒ Ã´ trá»‘ng.
    - KhÃ´ng sá»­ dá»¥ng LaTeX.
    - Tráº£ vá» Ä‘Ãºng ná»™i dung cuá»‘i cÃ¹ng báº±ng Markdown, khÃ´ng kÃ¨m giáº£i thÃ­ch.
    ${plan ? `- Má»¥c tiÃªu Ä‘á»™ dÃ i: khoáº£ng ${plan.targetWords} tá»«, cháº¥p nháº­n trong khoáº£ng ${plan.minWords}-${plan.maxWords} tá»«.` : '- Viáº¿t chi tiáº¿t, Ä‘áº§y Ä‘á»§, khÃ´ng tÃ³m táº¯t.'}
    ${sectionName.includes('Hiá»‡u quáº£') ? `- Báº¯t buá»™c chia rÃµ 3 má»¥c con: 4.1. Hiá»‡u quáº£ vá» khoa há»c, 4.2. Hiá»‡u quáº£ vá» kinh táº¿, 4.3. Hiá»‡u quáº£ vá» xÃ£ há»™i.` : ''}
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
    Báº¡n Ä‘ang biÃªn táº­p láº¡i má»™t má»¥c trong SKKN Ä‘á»ƒ khá»›p Ä‘Ãºng Ä‘á»™ dÃ i Ä‘Ã£ phÃ¢n bá»•.

    ThÃ´ng tin cá»‘ Ä‘á»‹nh:
    - TÃªn Ä‘á» tÃ i: ${info.title}
    - Pháº§n cáº§n chá»‰nh: ${sectionName}
    - Tá»•ng Ä‘á»™ dÃ i toÃ n bÃ i: khoáº£ng ${plan.totalPages} trang A4
    - Má»¥c nÃ y chá»‰ Ä‘Æ°á»£c chiáº¿m khoáº£ng ${plan.targetPagesLabel} trang
    - Má»¥c tiÃªu sá»‘ tá»«: khoáº£ng ${plan.targetWords} tá»«
    - Khoáº£ng cháº¥p nháº­n: ${plan.minWords}-${plan.maxWords} tá»«

    Nhiá»‡m vá»¥:
    - ${mode === 'shorten' ? 'RÃºt gá»n bá»›t ná»™i dung thá»«a, bá» láº·p Ã½, giá»¯ láº¡i Ã½ quan trá»ng nháº¥t.' : 'Má»Ÿ rá»™ng vá»«a Ä‘á»§ báº±ng vÃ­ dá»¥, chi tiáº¿t triá»ƒn khai, minh há»a thá»±c táº¿ nhÆ°ng khÃ´ng lan man.'}
    - Báº®T BUá»˜C Ä‘áº£m báº£o báº£n cuá»‘i cÃ¹ng náº±m trong khoáº£ng ${plan.minWords}-${plan.maxWords} tá»«, Æ°u tiÃªn gáº§n ${plan.targetWords} tá»«.
    - Náº¿u cÃ²n ngáº¯n hÆ¡n ${plan.minWords} tá»« thÃ¬ tiáº¿p tá»¥c bá»• sung Ã½, vÃ­ dá»¥, minh há»a Ä‘á»ƒ Ä‘á»§ Ä‘á»™ dÃ i.
    - Náº¿u cÃ²n dÃ i hÆ¡n ${plan.maxWords} tá»« thÃ¬ tiáº¿p tá»¥c rÃºt gá»n cho Ä‘áº¿n khi Ä‘áº¡t yÃªu cáº§u.
    - KhÃ´ng thÃªm lá»i giáº£i thÃ­ch vá» viá»‡c chá»‰nh sá»­a.
    - Chá»‰ tráº£ vá» phiÃªn báº£n ná»™i dung cuá»‘i cÃ¹ng báº±ng Markdown.

    Ná»™i dung hiá»‡n táº¡i:
    ${content}
  `,
  ANALYZE_TITLE: (title: string, subject?: string) => `
    Báº¡n lÃ  chuyÃªn gia Ä‘Ã¡nh giÃ¡ tÃªn Ä‘á» tÃ i SÃ¡ng kiáº¿n kinh nghiá»‡m (SKKN) á»Ÿ Viá»‡t Nam.

    HÃ£y phÃ¢n tÃ­ch tÃªn Ä‘á» tÃ i sau: "${title}"
    ${subject ? `MÃ´n há»c: ${subject}` : ''}

    HÃ£y tráº£ vá» CHÃNH XÃC má»™t JSON object (khÃ´ng markdown, khÃ´ng giáº£i thÃ­ch thÃªm, khÃ´ng bá»c trong code block) vá»›i cáº¥u trÃºc sau:
    {
      "totalScore": <sá»‘ nguyÃªn 0-100>,
      "rating": "<Xuáº¥t sáº¯c|Tá»‘t|KhÃ¡|Trung bÃ¬nh|Yáº¿u>",
      "overlap": {
        "level": "<Tháº¥p|Trung bÃ¬nh|Cao>",
        "explanation": "<giáº£i thÃ­ch ngáº¯n gá»n vá» má»©c Ä‘á»™ trÃ¹ng láº·p>"
      },
      "criteria": [
        {
          "name": "Äá»™ cá»¥ thá»ƒ",
          "score": <0-25>,
          "maxScore": 25,
          "description": "<giáº£i thÃ­ch ngáº¯n>"
        },
        {
          "name": "TÃ­nh má»›i",
          "score": <0-30>,
          "maxScore": 30,
          "description": "<giáº£i thÃ­ch ngáº¯n>"
        },
        {
          "name": "TÃ­nh kháº£ thi",
          "score": <0-25>,
          "maxScore": 25,
          "description": "<giáº£i thÃ­ch ngáº¯n>"
        },
        {
          "name": "Äá»™ rÃµ rÃ ng",
          "score": <0-20>,
          "maxScore": 20,
          "description": "<giáº£i thÃ­ch ngáº¯n>"
        }
      ],
      "structure": {
        "action": "<hÃ nh Ä‘á»™ng chÃ­nh>",
        "tool": "<cÃ´ng cá»¥/phÆ°Æ¡ng phÃ¡p>",
        "subject": "<mÃ´n há»c/chá»§ Ä‘á»>",
        "scope": "<pháº¡m vi>",
        "purpose": "<má»¥c Ä‘Ã­ch>"
      },
      "issues": [
        "<váº¥n Ä‘á» 1>",
        "<váº¥n Ä‘á» 2>"
      ],
      "suggestions": [
        {
          "title": "<tÃªn Ä‘á» tÃ i gá»£i Ã½ 1>",
          "score": <Ä‘iá»ƒm dá»± kiáº¿n 0-100>,
          "reason": "<lÃ½ do ngáº¯n>"
        },
        {
          "title": "<tÃªn Ä‘á» tÃ i gá»£i Ã½ 2>",
          "score": <Ä‘iá»ƒm dá»± kiáº¿n 0-100>,
          "reason": "<lÃ½ do ngáº¯n>"
        },
        {
          "title": "<tÃªn Ä‘á» tÃ i gá»£i Ã½ 3>",
          "score": <Ä‘iá»ƒm dá»± kiáº¿n 0-100>,
          "reason": "<lÃ½ do ngáº¯n>"
        }
      ]
    }

    Chá»‰ tráº£ vá» JSON thuáº§n. totalScore = tá»•ng 4 criteria scores.
  `,
};




