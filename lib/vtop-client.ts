import type {
  CaptchaResponse,
  LoginResponse,
  AttendanceData,
  AttendanceEntry,
  TimetableData,
  DayOfWeek,
  CurriculumData,
  CoursePageData,
  MarksData,
  GradesData,
  ProfileData,
  Semester,
} from '@/types/vtop';

const VTOP_BASE_URL = 'https://vtop.vit.ac.in';

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });
  return cookies;
}

export function extractJSessionId(setCookieHeader: string | string[] | null): string | null {
  if (!setCookieHeader) return null;

  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const cookie of cookies) {
    const match = cookie.match(/JSESSIONID=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export function extractCSRFToken(html: string): string | null {
  const csrfMatch = html.match(/<input[^>]*name="_csrf"[^>]*value="([^"]+)"/);
  if (csrfMatch) return csrfMatch[1];

  const metaMatch = html.match(/<meta[^>]*name="_csrf"[^>]*content="([^"]+)"/);
  if (metaMatch) return metaMatch[1];

  return null;
}

export class VTOPClient {
  private jsessionid: string;
  private csrf: string | null = null;

  constructor(jsessionid: string, csrf?: string) {
    this.jsessionid = jsessionid;
    this.csrf = csrf || null;
  }

  private get headers(): HeadersInit {
    return {
      'Cookie': `JSESSIONID=${this.jsessionid}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': VTOP_BASE_URL,
      'Referer': `${VTOP_BASE_URL}/vtop/`,
    };
  }

  private async post(endpoint: string, body?: Record<string, string>): Promise<Response> {
    const formBody = body
      ? Object.entries(body)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')
      : '';

    return fetch(`${VTOP_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: formBody,
      redirect: 'manual',
    });
  }

  static async getCaptcha(): Promise<{ captcha: CaptchaResponse; jsessionid: string }> {
    const pageResponse = await fetch(`${VTOP_BASE_URL}/vtop/open/page`, {
      method: 'GET',
      redirect: 'manual',
    });

    const jsessionid = extractJSessionId(pageResponse.headers.get('set-cookie'));
    if (!jsessionid) {
      throw new Error('Failed to get session from VTOP');
    }

    const pageHtml = await pageResponse.text();
    const csrf = extractCSRFToken(pageHtml);

    const captchaResponse = await fetch(`${VTOP_BASE_URL}/vtop/get/new/captcha`, {
      method: 'GET',
      headers: { 'Cookie': `JSESSIONID=${jsessionid}` },
    });

    if (!captchaResponse.ok) {
      throw new Error('Failed to fetch CAPTCHA');
    }

    const captchaHtml = await captchaResponse.text();

    // VTOP returns HTML with embedded base64 image - extract the data URL from src attribute
    const srcMatch = captchaHtml.match(/src="(data:image\/[^"]+)"/);
    const captchaImage = srcMatch ? srcMatch[1] : null;

    if (!captchaImage) {
      throw new Error('Failed to parse CAPTCHA image from response');
    }

    return {
      captcha: { captchaImage, csrf: csrf || '' },
      jsessionid,
    };
  }

  static async login(
    jsessionid: string,
    username: string,
    password: string,
    captcha: string,
    csrf: string
  ): Promise<LoginResponse> {
    const response = await fetch(`${VTOP_BASE_URL}/vtop/login`, {
      method: 'POST',
      headers: {
        'Cookie': `JSESSIONID=${jsessionid}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': VTOP_BASE_URL,
        'Referer': `${VTOP_BASE_URL}/vtop/open/page`,
      },
      body: new URLSearchParams({
        username,
        password,
        captchaStr: captcha,
        _csrf: csrf,
      }).toString(),
      redirect: 'manual',
    });

    const responseText = await response.text();

    if (response.status === 302 || responseText.includes('dashboard') || responseText.includes('Welcome')) {
      const nameMatch = responseText.match(/Welcome[,\s]+([^<]+)/i);
      const regNoMatch = responseText.match(/(\d{2}[A-Z]{3}\d{5})/);

      return {
        success: true,
        user: {
          name: nameMatch ? nameMatch[1].trim() : 'Student',
          registrationNumber: regNoMatch ? regNoMatch[1] : username,
        },
      };
    }

    if (responseText.toLowerCase().includes('invalid captcha')) {
      return { success: false, message: 'Invalid CAPTCHA. Please try again.' };
    }
    if (responseText.toLowerCase().includes('invalid username') || responseText.toLowerCase().includes('invalid password')) {
      return { success: false, message: 'Invalid username or password.' };
    }
    if (responseText.toLowerCase().includes('user disabled') || responseText.toLowerCase().includes('account locked')) {
      return { success: false, message: 'Account is disabled or locked. Please contact admin.' };
    }

    return { success: false, message: 'Login failed. Please try again.' };
  }

  async getDashboardCGPA(): Promise<{ cgpa: number; totalCredits: number }> {
    const response = await this.post('/vtop/get/dashboard/current/cgpa/credits');
    const html = await response.text();

    const cgpaMatch = html.match(/CGPA[:\s]*([0-9.]+)/i);
    const creditsMatch = html.match(/Credits[:\s]*(\d+)/i);

    return {
      cgpa: cgpaMatch ? parseFloat(cgpaMatch[1]) : 0,
      totalCredits: creditsMatch ? parseInt(creditsMatch[1]) : 0,
    };
  }

  async getSemesters(): Promise<Semester[]> {
    const response = await this.post('/vtop/academics/common/StudentAttendance');
    const html = await response.text();
    return parseSemesterDropdown(html);
  }

  async getAttendance(semesterId: string): Promise<AttendanceData> {
    await this.post('/vtop/academics/common/StudentAttendance');
    const response = await this.post('/vtop/processViewStudentAttendance', {
      semesterSubId: semesterId,
      _csrf: this.csrf || '',
    });
    const html = await response.text();
    return parseAttendanceHTML(html, semesterId);
  }

  async getTimetable(semesterId: string): Promise<TimetableData> {
    await this.post('/vtop/academics/common/StudentTimeTable');
    const response = await this.post('/vtop/processViewTimeTable', {
      semesterSubId: semesterId,
      _csrf: this.csrf || '',
    });
    const html = await response.text();
    return parseTimetableHTML(html, semesterId);
  }

  async getCurriculum(): Promise<CurriculumData> {
    const response = await this.post('/vtop/academics/common/Curriculum');
    const html = await response.text();
    return parseCurriculumHTML(html);
  }

  async getCoursePage(courseId: string): Promise<CoursePageData> {
    const response = await this.post('/vtop/academics/common/CoursePageConsolidated', {
      courseId,
      _csrf: this.csrf || '',
    });
    const html = await response.text();
    return parseCoursePageHTML(html);
  }

  async getMarks(semesterId: string): Promise<MarksData> {
    const response = await this.post('/vtop/examinations/StudentMarkView', {
      semesterSubId: semesterId,
      _csrf: this.csrf || '',
    });
    const html = await response.text();
    return parseMarksHTML(html, semesterId);
  }

  async getGrades(): Promise<GradesData> {
    const response = await this.post('/vtop/examinations/examGradeView/StudentGradeView');
    const html = await response.text();
    return parseGradesHTML(html);
  }

  async getProfile(): Promise<ProfileData> {
    const response = await this.post('/vtop/studentsRecord/StudentProfileAllView');
    const html = await response.text();
    return parseProfileHTML(html);
  }

  getProfilePhotoUrl(registrationNumber: string): string {
    return `${VTOP_BASE_URL}/vtop/users/image/?id=${registrationNumber}`;
  }
}

function parseSemesterDropdown(html: string): Semester[] {
  const semesters: Semester[] = [];
  const optionRegex = /<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
  let match;

  while ((match = optionRegex.exec(html)) !== null) {
    const [, id, name] = match;
    if (id && name && id !== '' && !id.includes('Select')) {
      semesters.push({
        id,
        name: name.trim(),
        isCurrent: html.includes(`selected`) && html.includes(id),
      });
    }
  }

  return semesters;
}

function parseAttendanceHTML(html: string, semesterId: string): AttendanceData {
  const entries: AttendanceEntry[] = [];
  const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let rowMatch;
  while ((rowMatch = tableRowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];

    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const cellContent = cellMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(cellContent);
    }

    if (cells.length >= 9 && /^[A-Z]{3}\d{4}/.test(cells[1])) {
      const attended = parseInt(cells[6]) || 0;
      const total = parseInt(cells[7]) || 0;
      const percentage = parseFloat(cells[8]) || (total > 0 ? (attended / total) * 100 : 0);

      entries.push({
        courseCode: cells[1],
        courseName: cells[2],
        classType: (cells[3] as 'ETH' | 'ELA' | 'EPJ' | 'SS') || 'ETH',
        slot: cells[4],
        faculty: cells[5],
        attendedClasses: attended,
        totalClasses: total,
        attendancePercentage: Math.round(percentage * 100) / 100,
        isDebarred: cells[9]?.toLowerCase().includes('debar') || percentage < 75,
      });
    }
  }

  return {
    semesterId,
    semesterName: '',
    entries,
    lastUpdated: new Date().toISOString(),
  };
}

function parseTimetableHTML(html: string, semesterId: string): TimetableData {
  const days: TimetableData['days'] = [];
  const dayNames: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  for (const day of dayNames) {
    days.push({ day, slots: [] });
  }

  return { semesterId, semesterName: '', days };
}

function parseCurriculumHTML(_html: string): CurriculumData {
  return { totalRequiredCredits: 0, totalEarnedCredits: 0, categories: [] };
}

function parseCoursePageHTML(_html: string): CoursePageData {
  return {
    courseCode: '',
    courseName: '',
    credits: 0,
    faculty: '',
    syllabus: [],
    outcomes: [],
    referenceBooks: [],
    materials: [],
  };
}

function parseMarksHTML(_html: string, semesterId: string): MarksData {
  return { semesterId, semesterName: '', courses: [] };
}

function parseGradesHTML(_html: string): GradesData {
  return { semesters: [], cgpa: 0, totalCreditsEarned: 0, totalCreditsRegistered: 0 };
}

function parseProfileHTML(_html: string): ProfileData {
  return {
    personal: {
      name: '',
      registrationNumber: '',
      applicationNumber: '',
      dateOfBirth: '',
      gender: '',
      bloodGroup: '',
      email: '',
      phone: '',
      address: '',
      nationality: '',
    },
    educational: {
      school: '',
      program: '',
      branch: '',
      admissionYear: '',
      expectedGraduation: '',
    },
    family: { fatherName: '', motherName: '' },
    proctor: { name: '', email: '' },
  };
}

/** Calculate how many consecutive classes to attend to reach target percentage */
export function calculateClassesNeeded(attended: number, total: number, targetPercentage: number): number {
  const target = targetPercentage / 100;
  if (target >= 1) return Infinity;

  const needed = Math.ceil((target * total - attended) / (1 - target));
  return Math.max(0, needed);
}

/** Calculate how many classes can be skipped while maintaining target percentage */
export function calculateClassesCanSkip(attended: number, total: number, targetPercentage: number): number {
  const target = targetPercentage / 100;
  if (target <= 0) return Infinity;

  const canSkip = Math.floor((attended / target) - total);
  return Math.max(0, canSkip);
}
