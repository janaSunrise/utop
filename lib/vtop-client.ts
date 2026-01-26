/**
 * VTOP HTTP client for VIT's student portal.
 * Handles authentication, session management, and API requests.
 * HTML parsing is delegated to vtop-parsers.ts for separation of concerns.
 */

import type {
  CaptchaResponse,
  LoginResponse,
  AttendanceData,
  TimetableData,
  CurriculumData,
  CoursePageData,
  MarksData,
  GradesData,
  ProfileData,
  Semester,
  ExamScheduleData,
} from '@/types/vtop';

import {
  parseSemesterDropdown,
  parseAttendanceHTML,
  parseTimetableHTML,
  parseCurriculumHTML,
  parseCoursePageHTML,
  parseMarksHTML,
  parseGradesHTML,
  parseExamScheduleHTML,
  parseProfileHTML,
} from './vtop-parsers';

// Re-export utilities for external use
export { calculateClassesNeeded, calculateClassesCanSkip } from './vtop-parsers';

const VTOP_BASE_URL = 'https://vtop.vit.ac.in';

const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000;

const DEBUG = process.env.VTOP_DEBUG === 'true';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[VTOP Debug] ${message}`, data !== undefined ? data : '');
  }
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Connection': 'keep-alive',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = MAX_RETRIES,
  initialDelay = INITIAL_RETRY_DELAY
): Promise<T> {
  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.message === 'SESSION_EXPIRED' ||
          lastError.message.includes('INVALID') ||
          lastError.message.includes('PARSE')) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        debugLog(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  throw lastError;
}

function getUTCDateString(): string {
  return new Date().toUTCString();
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  });
  return cookies;
}

export function extractJSessionId(setCookieHeader: string | string[] | null): string | null {
  if (!setCookieHeader) return null;

  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader.split(/,(?=[^;]*=)/);

  for (const cookie of cookies) {
    const match = cookie.match(/JSESSIONID=([^;,\s]+)/);
    if (match) return match[1];
  }
  return null;
}

export function extractServerId(setCookieHeader: string | string[] | null): string | null {
  if (!setCookieHeader) return null;

  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader.split(/,(?=[^;]*=)/);

  for (const cookie of cookies) {
    const match = cookie.match(/SERVERID=([^;,\s]+)/);
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

function isSessionExpiredResponse(html: string): boolean {
  return (
    html.includes('vtop/open/page') ||
    html.includes('captchaStr') ||
    html.includes('prelogin/setup') ||
    html.includes('sessionExpiredCall') ||
    (html.includes('stdForm') && html.includes('empForm') && html.includes('parentForm')) ||
    html.includes('HTTP Status 404')
  );
}

export class VTOPClient {
  private jsessionid: string;
  private csrf: string | null = null;
  private registrationNumber: string | null = null;
  private serverId: string | null = null;
  private credentials?: { username: string; password: string };

  constructor(
    jsessionid: string,
    csrf?: string,
    registrationNumber?: string,
    credentials?: { username: string; password: string },
    serverId?: string
  ) {
    this.jsessionid = jsessionid;
    this.csrf = csrf || null;
    this.registrationNumber = registrationNumber || null;
    this.serverId = serverId || null;
    this.credentials = credentials;
  }

  updateSession(jsessionid: string, csrf: string): void {
    this.jsessionid = jsessionid;
    this.csrf = csrf;
  }

  getSessionInfo(): { jsessionid: string; csrf: string | null; registrationNumber: string | null; serverId: string | null } {
    return { jsessionid: this.jsessionid, csrf: this.csrf, registrationNumber: this.registrationNumber, serverId: this.serverId };
  }

  setServerId(serverId: string): void {
    this.serverId = serverId;
  }

  setRegistrationNumber(regNo: string): void {
    this.registrationNumber = regNo;
  }

  private get headers(): HeadersInit {
    let cookieStr = `JSESSIONID=${this.jsessionid}`;
    if (this.serverId) {
      cookieStr += `; SERVERID=${this.serverId}`;
    }
    return {
      ...HEADERS,
      'Cookie': cookieStr,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `${VTOP_BASE_URL}/vtop/content`,
      'Origin': VTOP_BASE_URL,
    };
  }

  private async post(endpoint: string, body?: Record<string, string>): Promise<Response> {
    const bodyWithNocache = { ...body, nocache: Date.now().toString() };

    const formBody = Object.entries(bodyWithNocache)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    debugLog(`POST ${endpoint}`, { bodyKeys: Object.keys(bodyWithNocache) });

    return fetchWithTimeout(`${VTOP_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: formBody,
      redirect: 'manual',
    });
  }

  private async authenticatedPost(endpoint: string, body?: Record<string, string>): Promise<string> {
    debugLog(`authenticatedPost ${endpoint}`, {
      jsessionidPrefix: this.jsessionid?.substring(0, 10),
      serverId: this.serverId,
      registrationNumber: this.registrationNumber,
    });

    return withRetry(async () => {
      const response = await this.post(endpoint, body);

      debugLog(`${endpoint} response`, {
        status: response.status,
        setCookie: response.headers.get('set-cookie')?.substring(0, 50),
      });

      if (response.status === 302 || response.status === 301) {
        debugLog(`${endpoint} redirect to: ${response.headers.get('location')}`);
        throw new Error('SESSION_EXPIRED');
      }

      if (response.status !== 200) {
        debugLog(`${endpoint} status ${response.status}`);
        throw new Error(`VTOP_ERROR: ${response.status}`);
      }

      const html = await response.text();

      if (isSessionExpiredResponse(html)) {
        debugLog(`${endpoint} session expired in content`);
        throw new Error('SESSION_EXPIRED');
      }

      return html;
    });
  }

  /**
   * Initialize session and get CAPTCHA for login.
   */
  static async getCaptcha(): Promise<{ captcha: CaptchaResponse; jsessionid: string; serverId: string | null }> {
    debugLog('getCaptcha: Starting');

    // Step 1: Get initial session
    const pageResponse = await fetchWithTimeout(`${VTOP_BASE_URL}/vtop/open/page`, {
      method: 'GET',
      headers: HEADERS,
      redirect: 'manual',
    });

    let jsessionid = extractJSessionId(pageResponse.headers.get('set-cookie'));
    let serverId = extractServerId(pageResponse.headers.get('set-cookie'));
    if (!jsessionid) {
      throw new Error('Failed to get session from VTOP');
    }

    debugLog('getCaptcha: Got initial session', {
      jsessionidPrefix: jsessionid.substring(0, 10),
      serverId,
    });

    const pageHtml = await pageResponse.text();
    const initialCsrf = extractCSRFToken(pageHtml);

    let cookieStr = serverId ? `JSESSIONID=${jsessionid}; SERVERID=${serverId}` : `JSESSIONID=${jsessionid}`;

    // Step 2: POST to prelogin/setup
    const setupResponse = await fetchWithTimeout(`${VTOP_BASE_URL}/vtop/prelogin/setup`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Cookie': cookieStr,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${VTOP_BASE_URL}/vtop/open/page`,
      },
      body: new URLSearchParams({
        flag: 'VTOP',
        _csrf: initialCsrf || '',
      }).toString(),
      redirect: 'manual',
    });

    debugLog('getCaptcha: prelogin/setup response', {
      status: setupResponse.status,
      location: setupResponse.headers.get('location'),
    });

    const setupSessionId = extractJSessionId(setupResponse.headers.get('set-cookie'));
    const setupServerId = extractServerId(setupResponse.headers.get('set-cookie'));
    if (setupSessionId) jsessionid = setupSessionId;
    if (setupServerId) serverId = setupServerId;
    cookieStr = serverId ? `JSESSIONID=${jsessionid}; SERVERID=${serverId}` : `JSESSIONID=${jsessionid}`;

    // Step 3: Follow redirect chain to login page
    let loginHtml = '';
    let currentUrl = setupResponse.headers.get('location');
    let currentReferer = `${VTOP_BASE_URL}/vtop/prelogin/setup`;

    for (let i = 0; i < 3 && currentUrl; i++) {
      const fullUrl = currentUrl.startsWith('http') ? currentUrl : `${VTOP_BASE_URL}${currentUrl}`;
      debugLog(`getCaptcha: Following redirect ${i + 1}`, fullUrl);

      const response = await fetchWithTimeout(fullUrl, {
        method: 'GET',
        headers: { ...HEADERS, 'Cookie': cookieStr, 'Referer': currentReferer },
        redirect: 'manual',
      });

      const newSessionId = extractJSessionId(response.headers.get('set-cookie'));
      const newServerId = extractServerId(response.headers.get('set-cookie'));
      if (newSessionId) jsessionid = newSessionId;
      if (newServerId) serverId = newServerId;
      cookieStr = serverId ? `JSESSIONID=${jsessionid}; SERVERID=${serverId}` : `JSESSIONID=${jsessionid}`;

      if (response.status === 302 || response.status === 301) {
        currentReferer = fullUrl;
        currentUrl = response.headers.get('location');
      } else {
        loginHtml = await response.text();
        currentUrl = null;
      }
    }

    debugLog('getCaptcha: Reached login page', {
      htmlLength: loginHtml.length,
      jsessionidPrefix: jsessionid.substring(0, 10),
      serverId,
    });

    // Step 4: Extract CSRF token
    const loginCsrf = extractCSRFToken(loginHtml);
    const finalCsrf = loginCsrf || initialCsrf;

    // Step 5: Fetch captcha
    const preCaptchaSessionId = jsessionid;
    const preCaptchaServerId = serverId;

    const captchaResponse = await fetchWithTimeout(`${VTOP_BASE_URL}/vtop/get/new/captcha`, {
      method: 'GET',
      headers: { ...HEADERS, 'Cookie': cookieStr, 'Referer': `${VTOP_BASE_URL}/vtop/login` },
    });

    if (!captchaResponse.ok) {
      throw new Error('Failed to fetch CAPTCHA');
    }

    const captchaHtml = await captchaResponse.text();
    const captchaMatch = captchaHtml.match(/src="(data:image\/[^"]+)"/);
    const captchaImage = captchaMatch ? captchaMatch[1] : null;

    const captchaCsrf = extractCSRFToken(captchaHtml);
    const useCsrf = captchaCsrf || finalCsrf;

    if (!captchaImage) {
      debugLog('getCaptcha: Failed to find captcha in response', captchaHtml.substring(0, 500));
      throw new Error('Failed to parse CAPTCHA image from response');
    }

    debugLog('getCaptcha: Success', {
      captchaLength: captchaImage.length,
      csrfPrefix: useCsrf?.substring(0, 10),
      jsessionidPrefix: preCaptchaSessionId.substring(0, 10),
      serverId,
    });

    return {
      captcha: { captchaImage, csrf: useCsrf || '' },
      jsessionid: preCaptchaSessionId,
      serverId: preCaptchaServerId,
    };
  }

  static async login(
    jsessionid: string,
    username: string,
    password: string,
    captcha: string,
    csrf: string,
    serverId?: string | null
  ): Promise<LoginResponse & { newSessionId?: string; newCsrf?: string; newServerId?: string }> {
    debugLog('login: Starting', {
      jsessionidPrefix: jsessionid?.substring(0, 10),
      serverId,
      csrfPrefix: csrf?.substring(0, 10),
    });

    const cookieStr = serverId ? `JSESSIONID=${jsessionid}; SERVERID=${serverId}` : `JSESSIONID=${jsessionid}`;

    const loginBody = new URLSearchParams({
      _csrf: csrf,
      username,
      password,
      captchaStr: captcha,
    }).toString();

    debugLog('login: Sending request', {
      url: `${VTOP_BASE_URL}/vtop/login`,
      bodyPreview: `username=${username}&password=***&captchaStr=${captcha}`,
    });

    const response = await fetchWithTimeout(`${VTOP_BASE_URL}/vtop/login`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Cookie': cookieStr,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': VTOP_BASE_URL,
        'Referer': `${VTOP_BASE_URL}/vtop/login`,
        'Upgrade-Insecure-Requests': '1',
      },
      body: loginBody,
      redirect: 'manual',
    });

    debugLog('login: Response', {
      status: response.status,
      location: response.headers.get('location'),
    });

    let newSessionId = extractJSessionId(response.headers.get('set-cookie'));
    let newServerId = extractServerId(response.headers.get('set-cookie'));

    const activeSessionId = newSessionId || jsessionid;
    const activeServerId = newServerId || serverId;
    const activeCookieStr = activeServerId ? `JSESSIONID=${activeSessionId}; SERVERID=${activeServerId}` : `JSESSIONID=${activeSessionId}`;
    let responseText = await response.text();
    let newCsrf: string | null = null;

    // Follow redirect to get dashboard content
    if (response.status === 302 || response.status === 301) {
      const redirectUrl = response.headers.get('location');
      debugLog('login: Following redirect', redirectUrl);

      if (redirectUrl?.includes('/login/error') || redirectUrl?.includes('/error')) {
        const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `${VTOP_BASE_URL}${redirectUrl}`;
        const errorResponse = await fetchWithTimeout(fullUrl, {
          method: 'GET',
          headers: { ...HEADERS, 'Cookie': activeCookieStr },
        });
        const errorHtml = await errorResponse.text();

        if (errorHtml.toLowerCase().includes('invalid captcha') || errorHtml.toLowerCase().includes('captcha not match')) {
          return { success: false, message: 'Invalid CAPTCHA. Please try again.' };
        }
        if (errorHtml.toLowerCase().includes('invalid user') || errorHtml.toLowerCase().includes('invalid password') || errorHtml.toLowerCase().includes('user does not exist')) {
          return { success: false, message: 'Invalid username or password.' };
        }
        if (errorHtml.toLowerCase().includes('locked') || errorHtml.toLowerCase().includes('disabled')) {
          return { success: false, message: 'Account is locked or disabled.' };
        }

        return { success: false, message: 'Login failed. Please check your credentials and try again.' };
      }

      if (redirectUrl) {
        const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `${VTOP_BASE_URL}${redirectUrl}`;
        const dashboardResponse = await fetchWithTimeout(fullUrl, {
          method: 'GET',
          headers: { ...HEADERS, 'Cookie': activeCookieStr, 'Referer': `${VTOP_BASE_URL}/vtop/login` },
        });

        const dashboardSessionId = extractJSessionId(dashboardResponse.headers.get('set-cookie'));
        if (dashboardSessionId) newSessionId = dashboardSessionId;
        const dashboardServerId = extractServerId(dashboardResponse.headers.get('set-cookie'));
        if (dashboardServerId) newServerId = dashboardServerId;

        responseText = await dashboardResponse.text();
        newCsrf = extractCSRFToken(responseText);
      }
    } else {
      newCsrf = extractCSRFToken(responseText);
    }

    // Check for successful login
    if (response.status === 302 || responseText.includes('dashboard') || responseText.includes('Welcome') || responseText.includes('initialPage')) {
      debugLog('login: Success detected, dashboard length', responseText.length);

      let registrationNumber = '';

      // Try multiple patterns to extract registration number
      let regNoMatch = responseText.match(/id="authorizedIDX"[^>]*value="([^"]+)"/i);
      if (regNoMatch) registrationNumber = regNoMatch[1];

      if (!registrationNumber) {
        regNoMatch = responseText.match(/id="authorizedID"[^>]*value="([^"]+)"/i);
        if (regNoMatch) registrationNumber = regNoMatch[1];
      }

      if (!registrationNumber) {
        regNoMatch = responseText.match(/(\d{2}[A-Z]{2,5}\d{4,5})\s*\(STUDENT\)/i);
        if (regNoMatch) registrationNumber = regNoMatch[1];
      }

      if (!registrationNumber) {
        regNoMatch = responseText.match(/\b(\d{2}[A-Z]{2,5}\d{4,5})\b/);
        if (regNoMatch) registrationNumber = regNoMatch[1];
      }

      debugLog('login: Final registrationNumber', registrationNumber || '(not found)');

      return {
        success: true,
        user: { name: username, registrationNumber },
        newSessionId: newSessionId || jsessionid,
        newCsrf: newCsrf || csrf,
        newServerId: newServerId || serverId || undefined,
      };
    }

    if (responseText.toLowerCase().includes('invalid captcha')) {
      return { success: false, message: 'Invalid CAPTCHA. Please try again.' };
    }
    if (responseText.toLowerCase().includes('invalid username') || responseText.toLowerCase().includes('invalid password')) {
      return { success: false, message: 'Invalid username or password.' };
    }
    if (responseText.toLowerCase().includes('user disabled') || responseText.toLowerCase().includes('account locked')) {
      return { success: false, message: 'Account is disabled or locked.' };
    }

    return { success: false, message: 'Login failed. Please try again.' };
  }

  async getDashboardCGPA(): Promise<{ cgpa: number; totalCredits: number }> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    const html = await this.authenticatedPost('/vtop/get/dashboard/current/cgpa/credits', {
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    const cgpaMatch = html.match(/CGPA[:\s]*([0-9.]+)/i);
    const creditsMatch = html.match(/Credits[:\s]*(\d+)/i);

    return {
      cgpa: cgpaMatch ? parseFloat(cgpaMatch[1]) : 0,
      totalCredits: creditsMatch ? parseInt(creditsMatch[1]) : 0,
    };
  }

  async getSemesters(): Promise<Semester[]> {
    const { semesters } = await this.getSemestersWithDebug();
    return semesters;
  }

  async getSemestersWithDebug(): Promise<{ semesters: Semester[]; rawHtml: string }> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    debugLog('getSemesters: Fetching for', this.registrationNumber);

    const response = await this.post('/vtop/academics/common/StudentAttendance', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    debugLog('getSemesters: Response status', response.status);

    if (response.status === 302 || response.status === 301) {
      debugLog('getSemesters: Redirect, session expired');
      throw new Error('SESSION_EXPIRED');
    }

    if (response.status !== 200) {
      return { semesters: [], rawHtml: `Status: ${response.status}` };
    }

    const html = await response.text();
    debugLog('getSemesters: Response length', html.length);

    if (isSessionExpiredResponse(html)) {
      debugLog('getSemesters: Session expired in content');
      throw new Error('SESSION_EXPIRED');
    }

    const semesters = parseSemesterDropdown(html);
    debugLog('getSemesters: Parsed semesters count', semesters.length);
    return { semesters, rawHtml: html };
  }

  async getAttendance(semesterId: string): Promise<AttendanceData> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    await this.authenticatedPost('/vtop/academics/common/StudentAttendance', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    const html = await this.authenticatedPost('/vtop/processViewStudentAttendance', {
      _csrf: this.csrf || '',
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      x: getUTCDateString(),
    });

    return parseAttendanceHTML(html, semesterId);
  }

  async getTimetable(semesterId: string): Promise<TimetableData> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    await this.authenticatedPost('/vtop/academics/common/StudentTimeTable', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    const html = await this.authenticatedPost('/vtop/processViewTimeTable', {
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
      x: getUTCDateString(),
    });

    return parseTimetableHTML(html, semesterId);
  }

  async getCurriculum(): Promise<CurriculumData> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    const html = await this.authenticatedPost('/vtop/academics/common/Curriculum', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseCurriculumHTML(html);
  }

  async getCoursePage(courseId: string): Promise<CoursePageData> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    const html = await this.authenticatedPost('/vtop/academics/common/CoursePageConsolidated', {
      courseId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseCoursePageHTML(html);
  }

  async getMarks(semesterId: string): Promise<MarksData> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    const html = await this.authenticatedPost('/vtop/examinations/doStudentMarkView', {
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseMarksHTML(html, semesterId);
  }

  async getGrades(semesterId: string): Promise<GradesData> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    // Navigate to grade view page first
    await this.authenticatedPost('/vtop/examinations/examGradeView/StudentGradeHistory', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    // Fetch grades for specific semester
    const html = await this.authenticatedPost('/vtop/examinations/examGradeView/doStudentGradeView', {
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseGradesHTML(html, semesterId);
  }

  async getExamSchedule(semesterId: string): Promise<ExamScheduleData> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    const html = await this.authenticatedPost('/vtop/examinations/doSearchExamScheduleForStudent', {
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseExamScheduleHTML(html, semesterId);
  }

  async getProfile(): Promise<ProfileData> {
    if (!this.registrationNumber) throw new Error('Registration number required');

    const html = await this.authenticatedPost('/vtop/studentsRecord/StudentProfileAllView', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
      x: getUTCDateString(),
    });

    return parseProfileHTML(html);
  }

  getProfilePhotoUrl(registrationNumber: string): string {
    return `${VTOP_BASE_URL}/vtop/users/image/?id=${registrationNumber}`;
  }
}
