import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
// Index 0: "Gemini 3 Flash" -> gemini-2.5-flash (default, confirmed available)
// Index 1: "Gemini 3 Pro" -> gemini-2.0-flash (fallback)
// Index 2: "Gemini 2.5 Flash" -> gemini-2.5-flash

const WORDS_PER_PAGE = 420;
const TOKENS_PER_WORD = 2.4;
const MAX_SECTION_OUTPUT_TOKENS = 8192;

const SECTION_LENGTH_WEIGHTS: Record<string, number> = {
  'I.1. Tính cấp thiết phải tiến hành sáng kiến': 0.08,
  'I.2. Mục tiêu của đề tài, sáng kiến': 0.04,
  'I.3. Thời gian, đối tượng, phạm vi nghiên cứu': 0.03,
  'II.1. Hiện trạng vấn đề': 0.1,
  'II.2. Giải pháp thực hiện sáng kiến': 0.25,
  'II.3. Kết quả sau khi áp dụng giải pháp sáng kiến': 0.15,
  'II.4. Hiệu quả của sáng kiến': 0.15,
  'II.5. Tính khả thi': 0.06,
  'II.6. Thời gian thực hiện': 0.03,
  'II.7. Kinh phí thực hiện': 0.02,
  'III. Kiến nghị, đề xuất': 0.1,
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

export async function callGeminiAI(prompt: string, modelIndex?: number, _triedModels?: Set<number>, maxTokens?: number): Promise<string | null> {
  if (modelIndex === undefined) {
    modelIndex = parseInt(localStorage.getItem('gemini_model_index') || '0');
    if (isNaN(modelIndex) || modelIndex < 0 || modelIndex >= MODELS.length) modelIndex = 0;
  }

  const triedModels = _triedModels || new Set<number>();
  triedModels.add(modelIndex);

  const apiKey = localStorage.getItem('gemini_api_key') || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Vui lòng cấu hình API Key trong phần cài đặt.');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const modelName = MODELS[modelIndex];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        maxOutputTokens: maxTokens || 8192,
      },
    });

    return response.text || '';
  } catch (error: any) {
    console.error(`Error with model ${MODELS[modelIndex]}:`, error);

    for (let i = 0; i < MODELS.length; i++) {
      if (!triedModels.has(i)) {
        console.log(`Falling back to ${MODELS[i]}...`);
        return callGeminiAI(prompt, i, triedModels, maxTokens);
      }
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

    Yêu cầu dàn ý phải bám sát cấu trúc chuẩn SKKN:
    I. Đặt vấn đề
      1. Tính cấp thiết phải tiến hành sáng kiến
      2. Mục tiêu của đề tài, sáng kiến
      3. Thời gian, đối tượng, phạm vi nghiên cứu
    II. Nội dung của sáng kiến
      1. Hiện trạng vấn đề
      2. Giải pháp thực hiện sáng kiến để giải quyết vấn đề
      3. Kết quả sau khi áp dụng giải pháp sáng kiến tại đơn vị
      4. Hiệu quả của sáng kiến
      5. Tính khả thi
      6. Thời gian thực hiện đề tài, sáng kiến
      7. Kinh phí thực hiện đề tài, sáng kiến
    III. Kiến nghị, đề xuất

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
    ${plan ? `- Mục tiêu độ dài: khoảng ${plan.targetWords} từ, chấp nhận trong khoảng ${plan.minWords}-${plan.maxWords} từ.` : '- Viết chi tiết, đầy đủ, không tóm tắt.'}
    ${sectionName.includes('Hiệu quả') ? `- Bắt buộc chia rõ 3 mục con: 4.1. Hiệu quả về khoa học, 4.2. Hiệu quả về kinh tế, 4.3. Hiệu quả về xã hội.` : ''}
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


