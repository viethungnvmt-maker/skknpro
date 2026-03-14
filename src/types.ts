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
  { id: 0, title: 'Th\u00f4ng tin', desc: 'Thi\u1ebft l\u1eadp th\u00f4ng tin c\u01a1 b\u1ea3n' },
  { id: 1, title: 'L\u1eadp d\u00e0n \u00fd', desc: 'X\u00e2y d\u1ef1ng khung s\u01b0\u1eddn cho SKKN' },
  { id: 2, title: '1. T\u00ean s\u00e1ng ki\u1ebfn', desc: 'N\u00eau t\u00ean s\u00e1ng ki\u1ebfn r\u00f5 r\u00e0ng, ng\u1eafn g\u1ecdn' },
  { id: 3, title: '2. L\u0129nh v\u1ef1c \u00e1p d\u1ee5ng s\u00e1ng ki\u1ebfn', desc: 'X\u00e1c \u0111\u1ecbnh m\u00f4n/l\u0129nh v\u1ef1c, \u0111\u1ed1i t\u01b0\u1ee3ng \u00e1p d\u1ee5ng' },
  { id: 4, title: '3. M\u00f4 t\u1ea3 c\u00e1c gi\u1ea3i ph\u00e1p c\u0169 th\u01b0\u1eddng l\u00e0m', desc: 'Ph\u00e2n t\u00edch c\u00e1ch l\u00e0m c\u0169 v\u00e0 h\u1ea1n ch\u1ebf' },
  { id: 5, title: '4. Ng\u00e0y s\u00e1ng ki\u1ebfn \u0111\u01b0\u1ee3c \u00e1p d\u1ee5ng l\u1ea7n \u0111\u1ea7u ho\u1eb7c \u00e1p d\u1ee5ng th\u1eed', desc: 'Ghi r\u00f5 m\u1ed1c th\u1eddi gian tri\u1ec3n khai' },
  { id: 6, title: '5. N\u1ed9i dung', desc: 'Bao g\u1ed3m 5.1 m\u00f4 t\u1ea3 gi\u1ea3i ph\u00e1p m\u1edbi, 5.2 kh\u1ea3 n\u0103ng \u00e1p d\u1ee5ng, 5.3 \u0111\u00e1nh gi\u00e1 l\u1ee3i \u00edch' },
  { id: 7, title: 'Xu\u1ea5t SKKN', desc: 'T\u1ed5ng h\u1ee3p v\u00e0 xu\u1ea5t file' },
];





