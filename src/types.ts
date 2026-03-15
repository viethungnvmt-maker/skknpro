export interface SKKNInfo {
  title: string;
  subject: string;
  grade: string;
  level: string; // Cấp học
  school: string; // Tên trường
  location: string; // Địa điểm
  facilities: string; // Điều kiện CSVC
  textbook: string; // Sách giáo khoa
  target: string; // Đối tượng nghiên cứu
  duration: string; // Thời gian thực hiện
  techUsed: string; // Ứng dụng AI/Công nghệ
  focus: string; // Đặc thù / Trọng tâm đề tài
  customRequirements: string; // Yêu cầu bổ sung
  pageLimit: string; // Số trang giới hạn
  extraExamples: boolean; // Thêm bài toán thực tế
  extraTables: boolean; // Bổ sung bảng biểu
  referenceDocName: string; // Tên file tài liệu tham khảo đã tải lên
  referenceDocContent: string; // Nội dung tài liệu tham khảo (plain text)
  templateDocName: string; // Tên file mẫu sáng kiến đã tải lên
  templateDocContent: string; // Nội dung mẫu sáng kiến (plain text)
}

export interface LockedLengthPlan {
  totalPages: number;
  targetPages: number;
  targetPagesLabel: string;
  targetWords: number;
  minWords: number;
  maxWords: number;
  maxTokens: number;
}

export interface SKKNData {
  info: SKKNInfo;
  outline: string;
  sections: { [key: string]: string };
  currentStep: number;
  confirmedRequirements: boolean;
  lockedInfo: SKKNInfo | null;
  lockedPageLimit: string;
  lockedLengthPlans: { [key: string]: LockedLengthPlan };
}

export const INITIAL_DATA: SKKNData = {
  info: {
    title: '',
    subject: '',
    grade: '',
    level: '',
    school: '',
    location: '',
    facilities: '',
    textbook: '',
    target: '',
    duration: '',
    techUsed: '',
    focus: '',
    customRequirements: '',
    pageLimit: '',
    extraExamples: false,
    extraTables: false,
    referenceDocName: '',
    referenceDocContent: '',
    templateDocName: '',
    templateDocContent: '',
  },
  outline: '',
  sections: {},
  currentStep: 0,
  confirmedRequirements: false,
  lockedInfo: null,
  lockedPageLimit: '',
  lockedLengthPlans: {},
};

export const STEPS = [
  { id: 0, title: 'Thông tin', desc: 'Thiết lập thông tin cơ bản' },
  { id: 1, title: 'Lập Dàn Ý', desc: 'Xây dựng khung sườn cho SKKN' },
  { id: 2, title: 'I.1. Tính cấp thiết', desc: 'Tính cấp thiết phải tiến hành sáng kiến' },
  { id: 3, title: 'I.2. Mục tiêu', desc: 'Mục tiêu của đề tài, sáng kiến' },
  { id: 4, title: 'I.3. Thời gian & Phạm vi', desc: 'Thời gian, đối tượng, phạm vi nghiên cứu' },
  { id: 5, title: 'II.1. Hiện trạng vấn đề', desc: 'Nêu rõ cách làm cũ, phân tích nhược điểm' },
  { id: 6, title: 'II.2. Giải pháp', desc: 'Giải pháp thực hiện sáng kiến' },
  { id: 7, title: 'II.3. Kết quả', desc: 'Kết quả áp dụng giải pháp sáng kiến' },
  { id: 8, title: 'II.4. Hiệu quả', desc: 'Hiệu quả về khoa học, kinh tế, xã hội' },
  { id: 9, title: 'II.5. Tính khả thi', desc: 'Khả năng áp dụng vào thực tiễn' },
  { id: 10, title: 'II.6. Thời gian', desc: 'Thời gian thực hiện đề tài, sáng kiến' },
  { id: 11, title: 'II.7. Kinh phí', desc: 'Kinh phí thực hiện đề tài, sáng kiến' },
  { id: 12, title: 'III. Kiến nghị, đề xuất', desc: 'Kiến nghị và đề xuất' },
  { id: 13, title: 'Xuất SKKN', desc: 'Tổng hợp và xuất file' },
];


