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
  { id: 0, title: 'Thông tin', desc: 'Thiết lập thông tin cơ bản' },
  { id: 1, title: 'Lập Dàn Ý', desc: 'Xây dựng khung sườn cho SKKN' },
  { id: 2, title: 'I.1. Lí do chọn đề tài', desc: 'Nêu lí do chọn đề tài' },
  { id: 3, title: 'I.2. Mục đích nghiên cứu', desc: 'Xác định mục đích nghiên cứu' },
  { id: 4, title: 'I.3. Đối tượng nghiên cứu', desc: 'Mô tả đối tượng nghiên cứu' },
  { id: 5, title: 'I.4. Đối tượng khảo sát', desc: 'Xác định nhóm khảo sát cụ thể' },
  { id: 6, title: 'I.5. Phương pháp nghiên cứu', desc: 'Trình bày phương pháp nghiên cứu sử dụng' },
  { id: 7, title: 'I.6. Phạm vi triển khai', desc: 'Mô tả phạm vi và giới hạn triển khai' },
  { id: 8, title: 'II.1. Cơ sở lí luận', desc: 'Nêu cơ sở lí luận cho sáng kiến' },
  { id: 9, title: 'II.2. Thực trạng', desc: 'Phân tích thực trạng trước khi áp dụng' },
  { id: 10, title: 'II.3. Các biện pháp thực hiện sáng kiến', desc: 'Trình bày các biện pháp triển khai' },
  { id: 11, title: 'II.4. Hiệu quả đạt được', desc: 'Đánh giá hiệu quả sau khi áp dụng sáng kiến' },
  { id: 12, title: 'III. Kết quả', desc: 'Tổng kết kết quả của sáng kiến' },
  { id: 13, title: 'Xuất SKKN', desc: 'Tổng hợp và xuất file' },
];



