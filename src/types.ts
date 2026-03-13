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
  { id: 2, title: 'Mở đầu I. Lý do chọn đề tài', desc: 'Nêu lý do chọn đề tài' },
  { id: 3, title: 'Mở đầu II. Mục đích nghiên cứu', desc: 'Xác định mục đích nghiên cứu' },
  { id: 4, title: 'Mở đầu III. Đối tượng nghiên cứu', desc: 'Mô tả đối tượng nghiên cứu' },
  { id: 5, title: 'Mở đầu IV. Đối tượng khảo sát thực nghiệm', desc: 'Xác định đối tượng khảo sát thực nghiệm' },
  { id: 6, title: 'Mở đầu V. Phương pháp nghiên cứu', desc: 'Trình bày phương pháp nghiên cứu' },
  { id: 7, title: 'Mở đầu VI. Phạm vi và kế hoạch nghiên cứu', desc: 'Giới hạn phạm vi và kế hoạch nghiên cứu' },
  { id: 8, title: 'Nội dung I. Cơ sở lý luận', desc: 'Nền tảng lý luận của đề tài' },
  { id: 9, title: 'Nội dung II. Thực trạng', desc: 'Phân tích thực trạng dạy - học hiện tại' },
  { id: 10, title: 'Nội dung III. Biện pháp thực hiện', desc: 'Các biện pháp triển khai sáng kiến' },
  { id: 11, title: 'Nội dung IV. Kết quả đạt được', desc: 'Kết quả sau khi áp dụng biện pháp' },
  { id: 12, title: 'Kết luận I. Kết luận chung', desc: 'Tổng kết nội dung cốt lõi' },
  { id: 13, title: 'Kết luận II. Bài học kinh nghiệm', desc: 'Rút ra bài học kinh nghiệm' },
  { id: 14, title: 'Kết luận III. Đề xuất - khuyến nghị', desc: 'Đề xuất và khuyến nghị' },
  { id: 15, title: 'Phụ lục', desc: 'Minh chứng, bảng biểu, tư liệu kèm theo' },
  { id: 16, title: 'Xuất SKKN', desc: 'Tổng hợp và xuất file' },
];




