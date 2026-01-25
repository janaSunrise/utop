// VTOP API Type Definitions

// ============================================================================
// Authentication Types
// ============================================================================

export interface CaptchaResponse {
  captchaImage: string; // Base64 encoded JPEG
  csrf: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  captcha: string;
  csrf: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: {
    name: string;
    registrationNumber: string;
  };
}

export interface SessionInfo {
  jsessionid: string;
  csrf: string;
  isValid: boolean;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardCGPA {
  cgpa: number;
  totalCredits: number;
  creditsEarned: number;
}

export interface DashboardCourse {
  courseCode: string;
  courseName: string;
  classType: 'ETH' | 'ELA' | 'EPJ' | 'SS'; // Theory, Lab, Project, Soft Skills
  faculty: string;
  slot: string;
  venue: string;
}

export interface ProctorMessage {
  date: string;
  message: string;
  from: string;
}

export interface UpcomingAssignment {
  courseCode: string;
  courseName: string;
  title: string;
  dueDate: string;
  maxMarks: number;
}

export interface ScheduledEvent {
  title: string;
  date: string;
  type: string;
}

export interface DashboardData {
  cgpa: DashboardCGPA;
  currentCourses: DashboardCourse[];
  proctorMessages: ProctorMessage[];
  upcomingAssignments: UpcomingAssignment[];
  scheduledEvents: ScheduledEvent[];
}

// ============================================================================
// Attendance Types
// ============================================================================

export interface AttendanceEntry {
  courseCode: string;
  courseName: string;
  classType: 'ETH' | 'ELA' | 'EPJ' | 'SS';
  slot: string;
  faculty: string;
  attendedClasses: number;
  totalClasses: number;
  attendancePercentage: number;
  isDebarred: boolean;
}

export interface AttendanceData {
  semesterId: string;
  semesterName: string;
  entries: AttendanceEntry[];
  lastUpdated: string;
}

export interface AttendanceInsight {
  courseCode: string;
  classesNeededFor75: number;
  classesNeededFor85: number;
  canSkip: number; // How many classes can be skipped while maintaining 75%
}

// ============================================================================
// Timetable Types
// ============================================================================

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface TimetableSlot {
  startTime: string; // HH:MM format
  endTime: string;
  courseCode: string;
  courseName: string;
  classType: 'ETH' | 'ELA' | 'EPJ' | 'SS';
  faculty: string;
  venue: string;
  slot: string;
}

export interface TimetableDay {
  day: DayOfWeek;
  slots: TimetableSlot[];
}

export interface TimetableData {
  semesterId: string;
  semesterName: string;
  days: TimetableDay[];
}

// ============================================================================
// Curriculum Types
// ============================================================================

export type CurriculumCategory = 'NC' | 'UCC' | 'PCC' | 'CON' | 'OEC' | 'PMT' | 'UE';

export type CourseStatus = 'completed' | 'in_progress' | 'pending';

export interface CurriculumCourse {
  courseCode: string;
  courseName: string;
  credits: number;
  status: CourseStatus;
  grade?: string;
  semester?: string;
}

export interface CurriculumCategoryData {
  category: CurriculumCategory;
  categoryName: string;
  requiredCredits: number;
  earnedCredits: number;
  courses: CurriculumCourse[];
}

export interface CurriculumData {
  totalRequiredCredits: number;
  totalEarnedCredits: number;
  categories: CurriculumCategoryData[];
}

// ============================================================================
// Course Page Types
// ============================================================================

export interface SyllabusModule {
  moduleNumber: number;
  title: string;
  topics: string[];
  hours: number;
}

export interface CourseOutcome {
  id: string;
  description: string;
}

export interface ReferenceBook {
  title: string;
  author: string;
  publisher?: string;
  year?: string;
}

export interface CourseMaterial {
  title: string;
  type: 'pdf' | 'video' | 'link' | 'other';
  url?: string;
  uploadDate?: string;
}

export interface CoursePageData {
  courseCode: string;
  courseName: string;
  credits: number;
  faculty: string;
  syllabus: SyllabusModule[];
  outcomes: CourseOutcome[];
  referenceBooks: ReferenceBook[];
  materials: CourseMaterial[];
}

// ============================================================================
// Marks Types
// ============================================================================

export type ExamType = 'CAT1' | 'CAT2' | 'FAT' | 'DA' | 'QUIZ' | 'LAB' | 'PROJECT';

export interface ExamMark {
  examType: ExamType;
  examName: string;
  maxMarks: number;
  scoredMarks: number | null; // null if not yet graded
  weightage: number;
  status: 'graded' | 'pending' | 'absent';
}

export interface CourseMarks {
  courseCode: string;
  courseName: string;
  classType: 'ETH' | 'ELA' | 'EPJ';
  faculty: string;
  marks: ExamMark[];
  totalWeightedScore: number;
}

export interface MarksData {
  semesterId: string;
  semesterName: string;
  courses: CourseMarks[];
}

// ============================================================================
// Grades Types
// ============================================================================

export interface CourseGrade {
  courseCode: string;
  courseName: string;
  classType: 'ETH' | 'ELA' | 'EPJ';
  credits: number;
  grade: string;
  gradePoints: number;
}

export interface SemesterGrades {
  semesterId: string;
  semesterName: string;
  courses: CourseGrade[];
  sgpa: number;
  creditsRegistered: number;
  creditsEarned: number;
}

export interface GradesData {
  semesters: SemesterGrades[];
  cgpa: number;
  totalCreditsEarned: number;
  totalCreditsRegistered: number;
}

// ============================================================================
// Profile Types
// ============================================================================

export interface PersonalInfo {
  name: string;
  registrationNumber: string;
  applicationNumber: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  email: string;
  phone: string;
  address: string;
  nationality: string;
  religion?: string;
  community?: string;
}

export interface EducationalInfo {
  school: string;
  program: string;
  branch: string;
  specialization?: string;
  admissionYear: string;
  expectedGraduation: string;
}

export interface FamilyInfo {
  fatherName: string;
  fatherOccupation?: string;
  fatherPhone?: string;
  motherName: string;
  motherOccupation?: string;
  motherPhone?: string;
  guardianName?: string;
  guardianPhone?: string;
}

export interface ProctorInfo {
  name: string;
  email: string;
  phone?: string;
  cabin?: string;
}

export interface HostelInfo {
  hostelName: string;
  roomNumber: string;
  blockName: string;
  bedNumber?: string;
}

export interface ProfileData {
  personal: PersonalInfo;
  educational: EducationalInfo;
  family: FamilyInfo;
  proctor: ProctorInfo;
  hostel?: HostelInfo;
  photoUrl?: string;
}

// ============================================================================
// Credentials Types
// ============================================================================

export interface CredentialDocument {
  type: string;
  documentNumber: string;
  issuedDate?: string;
  validUntil?: string;
  status: 'verified' | 'pending' | 'expired';
}

export interface CredentialsData {
  registrationNumber: string;
  documents: CredentialDocument[];
}

// ============================================================================
// Semester Types
// ============================================================================

export interface Semester {
  id: string; // e.g., "VL2025261"
  name: string; // e.g., "Winter 2025-26"
  isCurrent: boolean;
}

// ============================================================================
// API Response Wrapper Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ApiError {
  code: 'INVALID_SESSION' | 'INVALID_CREDENTIALS' | 'INVALID_CAPTCHA' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'UNKNOWN_ERROR';
  message: string;
}
