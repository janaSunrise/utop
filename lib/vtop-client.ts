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
  ExamScheduleData,
} from '@/types/vtop';

const VTOP_BASE_URL = 'https://vtop.vit.ac.in';

// Request configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Debug logging - enable with VTOP_DEBUG=true
const DEBUG = process.env.VTOP_DEBUG === 'true';

function debugLog(message: string, data?: unknown): void {
  if (DEBUG) {
    console.log(`[VTOP Debug] ${message}`, data !== undefined ? data : '');
  }
}

// Minimal headers - keep-alive for load balancer stickiness
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Connection': 'keep-alive',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry a function with exponential backoff
 */
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

      // Don't retry auth errors or parse errors
      if (lastError.message === 'SESSION_EXPIRED' ||
          lastError.message.includes('INVALID') ||
          lastError.message.includes('PARSE')) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        debugLog(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError;
}

/** Get UTC formatted date string for VTOP requests */
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

  // Handle both array and comma-separated string formats
  let cookies: string[];
  if (Array.isArray(setCookieHeader)) {
    cookies = setCookieHeader;
  } else {
    // Split by comma but be careful not to split cookie values
    cookies = setCookieHeader.split(/,(?=[^;]*=)/);
  }

  for (const cookie of cookies) {
    const match = cookie.match(/JSESSIONID=([^;,\s]+)/);
    if (match) return match[1];
  }
  return null;
}

export function extractServerId(setCookieHeader: string | string[] | null): string | null {
  if (!setCookieHeader) return null;

  let cookies: string[];
  if (Array.isArray(setCookieHeader)) {
    cookies = setCookieHeader;
  } else {
    cookies = setCookieHeader.split(/,(?=[^;]*=)/);
  }

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

/** Check if VTOP response indicates session expiry */
function isSessionExpiredResponse(html: string): boolean {
  return (
    html.includes('vtop/open/page') ||
    html.includes('captchaStr') ||
    html.includes('prelogin/setup') ||
    html.includes('sessionExpiredCall') ||
    // Landing page has all four user type cards
    (html.includes('stdForm') && html.includes('empForm') && html.includes('parentForm')) ||
    // VTOP returns 404 when session is invalid
    html.includes('HTTP Status 404')
  );
}

export class VTOPClient {
  private jsessionid: string;
  private csrf: string | null = null;
  private registrationNumber: string | null = null;
  private serverId: string | null = null; // Load balancer stickiness cookie
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

  /**
   * Re-authenticate with VTOP using stored credentials.
   * Returns new session info or throws if credentials unavailable.
   */
  async reAuthenticate(): Promise<{ jsessionid: string; csrf: string }> {
    if (!this.credentials) {
      throw new Error('NO_CREDENTIALS');
    }

    // Get fresh CAPTCHA and session
    const { captcha, jsessionid } = await VTOPClient.getCaptcha();

    // For re-auth, we use a simple CAPTCHA solver or retry logic
    // In production, you'd integrate with a CAPTCHA solving service
    // For now, we throw and let the user solve it manually
    throw new Error('CAPTCHA_REQUIRED');
  }

  /**
   * Update session after re-authentication
   */
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
    // Add nocache timestamp to prevent caching (following vitap-vtop-client)
    const bodyWithNocache = {
      ...body,
      nocache: Date.now().toString(),
    };

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

  /**
   * POST request that throws SESSION_EXPIRED on redirect responses.
   * Use this for authenticated API calls. Includes retry logic for network errors.
   */
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

      // 302/301 redirect means session expired - VTOP redirects to login
      if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location');
        debugLog(`${endpoint} redirect to: ${location}`);
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
   * Flow:
   *   1. GET open/page → establish session
   *   2. POST prelogin/setup → follow redirects to login page (puts session in "login ready" state)
   *   3. GET /vtop/get/new/captcha → fetch captcha (bound to login-ready session)
   *
   * NOTE: The captcha is NOT embedded in the login page HTML - it's loaded dynamically via JavaScript.
   * For server-side requests, we must explicitly call /vtop/get/new/captcha AFTER reaching the login page.
   */
  static async getCaptcha(): Promise<{ captcha: CaptchaResponse; jsessionid: string; serverId: string | null }> {
    debugLog('getCaptcha: Starting');

    // Step 1: Get initial session from open page
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

    // Build cookie string with SERVERID for load balancer stickiness
    let cookieStr = serverId ? `JSESSIONID=${jsessionid}; SERVERID=${serverId}` : `JSESSIONID=${jsessionid}`;

    // Step 2: POST to prelogin/setup and follow redirects to login page
    // This puts the session in "login ready" state
    // VTOP flow: prelogin/setup → 302 to /vtop/init/page → 302 to /vtop/login
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

    // Update cookies from response
    const setupSessionId = extractJSessionId(setupResponse.headers.get('set-cookie'));
    const setupServerId = extractServerId(setupResponse.headers.get('set-cookie'));
    if (setupSessionId) jsessionid = setupSessionId;
    if (setupServerId) serverId = setupServerId;
    cookieStr = serverId ? `JSESSIONID=${jsessionid}; SERVERID=${serverId}` : `JSESSIONID=${jsessionid}`;

    // Step 3: Follow redirect chain to reach login page
    let loginHtml = '';
    let currentUrl = setupResponse.headers.get('location');
    let currentReferer = `${VTOP_BASE_URL}/vtop/prelogin/setup`;

    // Follow up to 3 redirects
    for (let i = 0; i < 3 && currentUrl; i++) {
      const fullUrl = currentUrl.startsWith('http') ? currentUrl : `${VTOP_BASE_URL}${currentUrl}`;
      debugLog(`getCaptcha: Following redirect ${i + 1}`, fullUrl);

      const response = await fetchWithTimeout(fullUrl, {
        method: 'GET',
        headers: {
          ...HEADERS,
          'Cookie': cookieStr,
          'Referer': currentReferer,
        },
        redirect: 'manual',
      });

      // Update cookies
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
      hasDataImage: loginHtml.includes('data:image'),
      hasCaptchaBlock: loginHtml.includes('captchaBlock'),
      htmlSnippet: loginHtml.substring(0, 1500),
    });

    // Step 4: Extract CSRF token from login page
    const loginCsrf = extractCSRFToken(loginHtml);
    const finalCsrf = loginCsrf || initialCsrf;

    // Step 5: Now fetch the captcha (session is in login-ready state)
    // The captcha is dynamically loaded via JavaScript, so we need to call this endpoint explicitly
    // IMPORTANT: Save the current session ID - the captcha is bound to THIS session
    const preCaptchaSessionId = jsessionid;
    const preCaptchaServerId = serverId;

    const captchaResponse = await fetchWithTimeout(`${VTOP_BASE_URL}/vtop/get/new/captcha`, {
      method: 'GET',
      headers: {
        ...HEADERS,
        'Cookie': cookieStr,
        'Referer': `${VTOP_BASE_URL}/vtop/login`,
      },
    });

    if (!captchaResponse.ok) {
      throw new Error('Failed to fetch CAPTCHA');
    }

    // Check if captcha endpoint updated the session (session fixation prevention)
    // IMPORTANT: Do NOT use new session/server for login - captcha is bound to PRE-CAPTCHA session
    const captchaSessionId = extractJSessionId(captchaResponse.headers.get('set-cookie'));
    const captchaServerId = extractServerId(captchaResponse.headers.get('set-cookie'));
    if (captchaSessionId || captchaServerId) {
      debugLog('getCaptcha: Captcha endpoint issued new cookies (IGNORING - using pre-captcha values)', {
        oldSession: preCaptchaSessionId.substring(0, 10),
        newSession: captchaSessionId?.substring(0, 10),
        oldServerId: preCaptchaServerId,
        newServerId: captchaServerId,
      });
      // Do NOT update - the captcha is bound to the pre-captcha session AND server
    }

    const captchaHtml = await captchaResponse.text();
    const captchaMatch = captchaHtml.match(/src="(data:image\/[^"]+)"/);
    const captchaImage = captchaMatch ? captchaMatch[1] : null;

    // Check if captcha response has a CSRF token (some VTOP versions include it)
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
      captchaHadNewCsrf: !!captchaCsrf,
    });

    // Return the PRE-CAPTCHA session ID and server ID - the captcha is bound to these
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

    // IMPORTANT: Order matters for VTOP! Browser sends _csrf first
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

    debugLog('login: Extracted from response', {
      newSessionIdPrefix: newSessionId?.substring(0, 10),
      newServerId,
    });

    const activeSessionId = newSessionId || jsessionid;
    const activeServerId = newServerId || serverId;
    const activeCookieStr = activeServerId ? `JSESSIONID=${activeSessionId}; SERVERID=${activeServerId}` : `JSESSIONID=${activeSessionId}`;
    let responseText = await response.text();
    let newCsrf: string | null = null;

    // Follow redirect to get dashboard content
    if (response.status === 302 || response.status === 301) {
      const redirectUrl = response.headers.get('location');
      debugLog('login: Following redirect', redirectUrl);

      // Check if redirect is to error page - means login failed
      if (redirectUrl?.includes('/login/error') || redirectUrl?.includes('/error')) {
        debugLog('login: Redirect to error page');
        // Fetch error page to get the actual error message
        const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `${VTOP_BASE_URL}${redirectUrl}`;
        const errorResponse = await fetchWithTimeout(fullUrl, {
          method: 'GET',
          headers: {
            ...HEADERS,
            'Cookie': activeCookieStr,
          },
        });
        const errorHtml = await errorResponse.text();

        debugLog('login: Error page content', errorHtml.substring(0, 500));

        // Try to extract error message from the page
        // VTOP typically shows errors in alert boxes or specific divs
        const alertMatch = errorHtml.match(/class="alert[^"]*"[^>]*>([^<]+)/i);
        const errorMsgMatch = errorHtml.match(/error[^>]*>([^<]+)/i);
        const extractedError = alertMatch?.[1]?.trim() || errorMsgMatch?.[1]?.trim();

        if (extractedError) {
          debugLog('login: Extracted error message', extractedError);
        }

        // Try to extract error message
        if (errorHtml.toLowerCase().includes('invalid captcha') || errorHtml.toLowerCase().includes('captcha not match')) {
          return { success: false, message: 'Invalid CAPTCHA. Please try again.' };
        }
        if (errorHtml.toLowerCase().includes('invalid user') || errorHtml.toLowerCase().includes('invalid password') || errorHtml.toLowerCase().includes('user does not exist')) {
          return { success: false, message: 'Invalid username or password.' };
        }
        if (errorHtml.toLowerCase().includes('locked') || errorHtml.toLowerCase().includes('disabled')) {
          return { success: false, message: 'Account is locked or disabled.' };
        }

        // Return extracted error if found, otherwise generic message
        return { success: false, message: extractedError || 'Login failed. Please check your credentials and try again.' };
      }

      if (redirectUrl) {
        const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `${VTOP_BASE_URL}${redirectUrl}`;
        const dashboardResponse = await fetchWithTimeout(fullUrl, {
          method: 'GET',
          headers: {
            ...HEADERS,
            'Cookie': activeCookieStr,
            'Referer': `${VTOP_BASE_URL}/vtop/login`,
          },
        });

        debugLog('login: Dashboard response', {
          status: dashboardResponse.status,
        });

        const dashboardSessionId = extractJSessionId(dashboardResponse.headers.get('set-cookie'));
        if (dashboardSessionId) {
          debugLog('login: New session from dashboard', dashboardSessionId.substring(0, 10));
          newSessionId = dashboardSessionId;
        }
        const dashboardServerId = extractServerId(dashboardResponse.headers.get('set-cookie'));
        if (dashboardServerId) {
          debugLog('login: New serverId from dashboard', dashboardServerId);
          newServerId = dashboardServerId;
        }

        responseText = await dashboardResponse.text();
        newCsrf = extractCSRFToken(responseText);
        debugLog('login: Dashboard parsed', {
          contentLength: responseText.length,
          csrfPrefix: newCsrf?.substring(0, 10),
        });
      }
    } else {
      newCsrf = extractCSRFToken(responseText);
    }

    debugLog('login: Final session', {
      newSessionIdPrefix: (newSessionId || jsessionid)?.substring(0, 10),
      newServerId: newServerId || serverId,
    });

    // Check for successful login
    if (response.status === 302 || responseText.includes('dashboard') || responseText.includes('Welcome') || responseText.includes('initialPage')) {
      debugLog('login: Success detected, dashboard length', responseText.length);

      // Extract registration number from various patterns in VTOP
      let registrationNumber = '';

      // Pattern 1: authorizedIDX hidden field
      let regNoMatch = responseText.match(/id="authorizedIDX"[^>]*value="([^"]+)"/i);
      if (regNoMatch) {
        registrationNumber = regNoMatch[1];
        debugLog('login: Found from authorizedIDX', registrationNumber);
      }

      // Pattern 2: authorizedID hidden field (alternate name)
      if (!registrationNumber) {
        regNoMatch = responseText.match(/id="authorizedID"[^>]*value="([^"]+)"/i);
        if (regNoMatch) {
          registrationNumber = regNoMatch[1];
          debugLog('login: Found from authorizedID', registrationNumber);
        }
      }

      // Pattern 3: Look for registration number in header display (25BAI0132 (STUDENT))
      if (!registrationNumber) {
        regNoMatch = responseText.match(/(\d{2}[A-Z]{2,5}\d{4,5})\s*\(STUDENT\)/i);
        if (regNoMatch) {
          registrationNumber = regNoMatch[1];
          debugLog('login: Found from header display', registrationNumber);
        }
      }

      // Pattern 4: Generic registration number pattern (must start with 2 digits, like 25BAI0132)
      if (!registrationNumber) {
        regNoMatch = responseText.match(/\b(\d{2}[A-Z]{2,5}\d{4,5})\b/);
        if (regNoMatch) {
          registrationNumber = regNoMatch[1];
          debugLog('login: Found from generic pattern', registrationNumber);
        }
      }

      debugLog('login: Final registrationNumber', registrationNumber || '(not found)');

      return {
        success: true,
        user: {
          name: username,
          registrationNumber,
        },
        newSessionId: newSessionId || jsessionid,
        newCsrf: newCsrf || csrf,
        newServerId: newServerId || serverId || undefined,
      };
    }

    // Handle specific error messages
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
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

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
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

    debugLog('getSemesters: Fetching for', this.registrationNumber);

    // First POST to initialize the page (following vitap-vtop-client pattern)
    const response = await this.post('/vtop/academics/common/StudentAttendance', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    debugLog('getSemesters: Response status', response.status);

    // 302 redirect means session expired - VTOP redirects to login
    if (response.status === 302 || response.status === 301) {
      debugLog('getSemesters: Redirect, session expired');
      throw new Error('SESSION_EXPIRED');
    }

    if (response.status !== 200) {
      debugLog('getSemesters: Non-200 status');
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
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

    // Step 1: Initialize attendance page
    await this.authenticatedPost('/vtop/academics/common/StudentAttendance', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    // Step 2: Fetch attendance data with timestamp
    const html = await this.authenticatedPost('/vtop/processViewStudentAttendance', {
      _csrf: this.csrf || '',
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      x: getUTCDateString(),
    });

    return parseAttendanceHTML(html, semesterId);
  }

  async getTimetable(semesterId: string): Promise<TimetableData> {
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

    // Step 1: Initialize timetable page
    await this.authenticatedPost('/vtop/academics/common/StudentTimeTable', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    // Step 2: Fetch timetable data
    const html = await this.authenticatedPost('/vtop/processViewTimeTable', {
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
      x: getUTCDateString(),
    });

    return parseTimetableHTML(html, semesterId);
  }

  async getCurriculum(): Promise<CurriculumData> {
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

    const html = await this.authenticatedPost('/vtop/academics/common/Curriculum', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseCurriculumHTML(html);
  }

  async getCoursePage(courseId: string): Promise<CoursePageData> {
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

    const html = await this.authenticatedPost('/vtop/academics/common/CoursePageConsolidated', {
      courseId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseCoursePageHTML(html);
  }

  async getMarks(semesterId: string): Promise<MarksData> {
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

    const html = await this.authenticatedPost('/vtop/examinations/doStudentMarkView', {
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseMarksHTML(html, semesterId);
  }

  async getGrades(): Promise<GradesData> {
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

    const html = await this.authenticatedPost('/vtop/examinations/examGradeView/StudentGradeHistory', {
      verifyMenu: 'true',
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseGradesHTML(html);
  }

  async getExamSchedule(semesterId: string): Promise<ExamScheduleData> {
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

    const html = await this.authenticatedPost('/vtop/examinations/doSearchExamScheduleForStudent', {
      semesterSubId: semesterId,
      authorizedID: this.registrationNumber,
      _csrf: this.csrf || '',
    });

    return parseExamScheduleHTML(html, semesterId);
  }

  async getProfile(): Promise<ProfileData> {
    if (!this.registrationNumber) {
      throw new Error('Registration number required');
    }

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

function parseSemesterDropdown(html: string): Semester[] {
  const semesters: Semester[] = [];

  // Look for semester select dropdown
  const selectMatch = html.match(/<select[^>]*id="semesterSubId"[^>]*>([\s\S]*?)<\/select>/i);
  const selectHtml = selectMatch ? selectMatch[1] : html;

  // Match options: <option value="VL20252605">Winter Semester 2025-26 - VLR</option>
  const optionRegex = /<option[^>]*value="([^"]*)"[^>]*>([^<]+)<\/option>/gi;
  let match;

  while ((match = optionRegex.exec(selectHtml)) !== null) {
    const [fullMatch, id, name] = match;
    // Skip empty values and placeholder options
    if (id && id.trim() !== '' && !name.toLowerCase().includes('choose') && !name.toLowerCase().includes('select')) {
      semesters.push({
        id: id.trim(),
        name: name.trim(),
        isCurrent: fullMatch.includes('selected'),
      });
    }
  }

  return semesters;
}

/** Clean text by removing HTML tags and normalizing whitespace */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')         // Remove HTML tags
    .replace(/&nbsp;/g, ' ')          // HTML entity
    .replace(/&amp;/g, '&')           // HTML entity
    .replace(/&#39;/g, "'")           // HTML entity
    .replace(/\\r\\n|\\r|\\n/g, ' ')  // Literal escape sequences from JSON
    .replace(/\\t/g, ' ')             // Literal tab escape sequences
    .replace(/[\r\n\t]+/g, ' ')       // Actual whitespace characters
    .replace(/\s+/g, ' ')             // Collapse multiple spaces
    .trim();
}

function parseAttendanceHTML(html: string, semesterId: string): AttendanceData {
  const entries: AttendanceEntry[] = [];

  // Extract semester name from the page if available
  const semesterNameMatch = html.match(/Winter Semester \d{4}-\d{2}|Fall Semester \d{4}-\d{2}/i);
  const semesterName = semesterNameMatch ? semesterNameMatch[0] : '';

  // Normalize HTML: replace HTML entities and literal escape sequences
  html = html
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\r\\n|\\r|\\n/g, '\n')
    .replace(/\\t/g, '\t');

  // Find tbody content
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return { semesterId, semesterName, entries, lastUpdated: new Date().toISOString() };
  }

  // Split by </tr> to get individual rows
  const rowsHtml = tbodyMatch[1].split('</tr>').filter(r => r.includes('<tr>'));

  for (const rowHtml of rowsHtml) {
    const row = rowHtml + '</tr>';

    // Extract class type from onclick attribute - this is the most reliable source
    // Pattern: callStudentAttendanceDetailDisplay('...', '...', '...', 'ETH')
    // Note: API response encodes quotes as &#39; HTML entities
    const onclickMatch = row.match(/callStudentAttendanceDetailDisplay\([^)]*,\s*(?:'|&#39;)([A-Z]+)(?:'|&#39;)\s*\)/);
    const classType = (onclickMatch ? onclickMatch[1] : 'TH') as 'ETH' | 'ELA' | 'EPJ' | 'SS' | 'TH';

    // Extract all cells
    const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const cells = cellMatches.map(m => cleanText(m[1]));

    // VTOP table structure:
    // [0] Sl.No
    // [1] Class Group (e.g., "General (Semester)")
    // [2] Course Detail (e.g., "BACSE104 - Structured and Object-Oriented Programming - Embedded Theory")
    // [3] Class Detail (e.g., "VL2025260501438 - D1 - PRPG23")
    // [4] Faculty Detail (e.g., "RAMESH BABU VEMULURI - SCOPE")
    // [5] Attended Classes/Days (e.g., "9")
    // [6] Total Classes (e.g., "12")
    // [7] Attendance Percentage (e.g., "75%")
    // [8] Debar Status (e.g., "-" or "Debarred & Permitted")
    // [9] Attendance Detail (link)

    if (cells.length < 10) continue;

    // Cell 2: Course Detail - "BACSE104 - Structured and Object-Oriented Programming - Embedded Theory"
    const courseDetailParts = cells[2].split(' - ').map(s => s.trim());
    if (courseDetailParts.length < 2) continue;

    const courseCode = courseDetailParts[0];
    const courseName = courseDetailParts.length > 2
      ? courseDetailParts.slice(1, -1).join(' - ')
      : courseDetailParts[1];

    // Cell 3: Class Detail - "VL2025260501438 - D1 - PRPG23" (id - slot - venue)
    const classDetailParts = cells[3].split(' - ').map(s => s.trim());
    const slot = classDetailParts.length >= 2 ? classDetailParts[1] : '';

    // Cell 4: Faculty Detail - "RAMESH BABU VEMULURI - SCOPE"
    const facultyParts = cells[4].split(' - ').map(s => s.trim());
    const faculty = facultyParts[0];

    // Cells 5, 6: Attended, Total (extract numbers)
    const attendedMatch = cells[5].match(/(\d+)/);
    const totalMatch = cells[6].match(/(\d+)/);
    const attended = attendedMatch ? parseInt(attendedMatch[1]) : 0;
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    // Cell 7: Percentage
    const percentageMatch = cells[7].match(/(\d+)%/);
    const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 0;

    // Cell 8: Debar Status - can be "-" or contain "Debarred" info
    const debarCell = cells[8].toLowerCase();
    const isDebarred = debarCell.includes('debarred') && !debarCell.includes('permitted');

    entries.push({
      courseCode,
      courseName,
      classType,
      slot,
      faculty,
      attendedClasses: attended,
      totalClasses: total,
      attendancePercentage: percentage,
      isDebarred,
    });
  }

  return { semesterId, semesterName, entries, lastUpdated: new Date().toISOString() };
}

/** Time slot mapping for VTOP timetable */
const SLOT_TIMINGS: Record<string, { start: string; end: string }> = {
  // Theory slots - Morning
  'A1': { start: '08:00', end: '08:50' },
  'B1': { start: '09:00', end: '09:50' },
  'C1': { start: '10:00', end: '10:50' },
  'D1': { start: '11:00', end: '11:50' },
  'E1': { start: '12:00', end: '12:50' },
  'F1': { start: '14:00', end: '14:50' },
  'G1': { start: '15:00', end: '15:50' },
  // Theory slots - Afternoon
  'A2': { start: '14:00', end: '14:50' },
  'B2': { start: '15:00', end: '15:50' },
  'C2': { start: '16:00', end: '16:50' },
  'D2': { start: '17:00', end: '17:50' },
  'E2': { start: '18:00', end: '18:50' },
  'F2': { start: '19:00', end: '19:50' },
  'G2': { start: '08:00', end: '08:50' },
  // Tutorial slots
  'TA1': { start: '08:50', end: '09:40' },
  'TB1': { start: '09:50', end: '10:40' },
  'TC1': { start: '10:50', end: '11:40' },
  'TD1': { start: '11:50', end: '12:40' },
  'TE1': { start: '12:50', end: '13:40' },
  'TF1': { start: '14:50', end: '15:40' },
  'TG1': { start: '15:50', end: '16:40' },
  'TA2': { start: '14:50', end: '15:40' },
  'TB2': { start: '15:50', end: '16:40' },
  'TC2': { start: '16:50', end: '17:40' },
  'TD2': { start: '17:50', end: '18:40' },
  'TE2': { start: '18:50', end: '19:40' },
  'TF2': { start: '19:50', end: '20:40' },
  'TG2': { start: '08:50', end: '09:40' },
};

/** Lab slot duration is 100 minutes */
const LAB_DURATION = 100;

function getSlotTiming(slot: string): { start: string; end: string } {
  // Check direct match
  if (SLOT_TIMINGS[slot]) {
    return SLOT_TIMINGS[slot];
  }
  // For lab slots (L1-L60, P1-P60), calculate based on position
  // Default fallback
  return { start: '00:00', end: '00:00' };
}

function parseTimetableHTML(html: string, semesterId: string): TimetableData {
  const dayNames: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const days: TimetableData['days'] = dayNames.map(day => ({ day, slots: [] }));

  // Extract semester name
  const semesterNameMatch = html.match(/(?:Winter|Fall|Summer)\s+Semester\s+\d{4}-\d{2}/i);
  const semesterName = semesterNameMatch ? semesterNameMatch[0] : '';

  // Normalize HTML
  html = html
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\r\\n|\\r|\\n/g, '\n');

  // Parse course list table first to get course details
  // Structure: class_number, course_code, course_name, course_type, ltpjc, mode, slot, venue, faculty
  const courseMap: Map<string, {
    courseCode: string;
    courseName: string;
    courseType: 'ETH' | 'ELA' | 'EPJ' | 'SS' | 'TH';
    faculty: string;
    venue: string;
    slot: string;
  }> = new Map();

  // Find course table (usually first table with course data)
  const courseTableMatch = html.match(/<table[^>]*id="timeTableStyle"[^>]*>([\s\S]*?)<\/table>/i) ||
                           html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);

  if (courseTableMatch) {
    const tbodyMatch = courseTableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (tbodyMatch) {
      const rows = tbodyMatch[1].split('</tr>').filter(r => r.includes('<tr'));

      for (const rowHtml of rows) {
        const row = rowHtml + '</tr>';
        const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        const cells = cellMatches.map(m => cleanText(m[1]));

        // Expected: [slNo, classNbr, courseCode, courseName, courseType, LTPJC, mode, slot, venue, faculty]
        if (cells.length >= 9) {
          const courseCode = cells[2];
          const courseName = cells[3];
          const courseTypeRaw = cells[4].toUpperCase();
          const courseType = (['ETH', 'ELA', 'EPJ', 'SS', 'TH'].includes(courseTypeRaw) ? courseTypeRaw : 'TH') as 'ETH' | 'ELA' | 'EPJ' | 'SS' | 'TH';
          const slot = cells[7];
          const venue = cells[8];
          const faculty = cells[9] || '';

          // Map by slot for lookup
          const slots = slot.split('+').map(s => s.trim());
          for (const s of slots) {
            courseMap.set(s, { courseCode, courseName, courseType, faculty, venue, slot });
          }
        }
      }
    }
  }

  // Parse timetable grid
  // The grid has days as rows and time slots as columns
  const gridTableMatch = html.match(/<table[^>]*id="(?:divTimeTable|timetable)"[^>]*>([\s\S]*?)<\/table>/i);
  if (gridTableMatch) {
    const gridRows = gridTableMatch[1].split('</tr>').filter(r => r.includes('<tr'));

    for (let dayIndex = 0; dayIndex < gridRows.length && dayIndex < 6; dayIndex++) {
      const row = gridRows[dayIndex] + '</tr>';
      const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];

      for (const cellMatch of cellMatches) {
        const cellContent = cleanText(cellMatch[1]);
        if (!cellContent || cellContent === '-') continue;

        // Cell may contain slot info like "A1 - SJT301" or just slot code
        const slotMatch = cellContent.match(/([A-Z]+\d+)/);
        if (slotMatch) {
          const slotCode = slotMatch[1];
          const courseInfo = courseMap.get(slotCode);

          if (courseInfo) {
            const timing = getSlotTiming(slotCode);
            days[dayIndex].slots.push({
              startTime: timing.start,
              endTime: timing.end,
              courseCode: courseInfo.courseCode,
              courseName: courseInfo.courseName,
              classType: courseInfo.courseType,
              faculty: courseInfo.faculty,
              venue: courseInfo.venue,
              slot: slotCode,
            });
          }
        }
      }
    }
  }

  return { semesterId, semesterName, days };
}

function parseCurriculumHTML(html: string): CurriculumData {
  const categories: CurriculumData['categories'] = [];
  let totalRequiredCredits = 0;
  let totalEarnedCredits = 0;

  // Normalize HTML
  html = html
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\r\\n|\\r|\\n/g, '\n');

  // Category name mapping
  const categoryNames: Record<string, string> = {
    'PC': 'Program Core',
    'PCC': 'Program Core',
    'PE': 'Program Elective',
    'UC': 'University Core',
    'UCC': 'University Core',
    'UE': 'University Elective',
    'NC': 'Non-Credit',
    'CON': 'Concentration',
    'OEC': 'Open Elective',
    'PMT': 'Project/Thesis',
  };

  // Find curriculum tables - VTOP groups courses by category
  const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[1];

    // Check if this is a curriculum table by looking for L-T-P-C headers
    if (!tableHtml.includes('Credit') && !tableHtml.includes('L-T-P')) continue;

    // Try to extract category from table header or preceding text
    const categoryMatch = tableHtml.match(/<th[^>]*colspan[^>]*>([^<]*(?:PC|PE|UC|UE|NC|CON|OEC|PMT)[^<]*)<\/th>/i) ||
                          tableMatch[0].match(/(?:PC|PCC|PE|UC|UCC|UE|NC|CON|OEC|PMT)/i);

    if (!categoryMatch) continue;

    const categoryCode = (categoryMatch[1] || categoryMatch[0]).match(/(PC|PCC|PE|UC|UCC|UE|NC|CON|OEC|PMT)/i)?.[1]?.toUpperCase() || 'PC';
    const categoryName = categoryNames[categoryCode] || categoryCode;

    const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) continue;

    const rows = tbodyMatch[1].split('</tr>').filter(r => r.includes('<tr'));
    const courses: CurriculumData['categories'][0]['courses'] = [];
    let categoryCredits = 0;
    let earnedCredits = 0;

    for (const rowHtml of rows) {
      const row = rowHtml + '</tr>';
      const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      const cells = cellMatches.map(m => cleanText(m[1]));

      if (cells.length < 3) continue;

      // Structure varies, but typically: courseCode, courseName, L, T, P, J, C or courseCode, courseName, credits
      const courseCode = cells[0];
      const courseName = cells[1];

      // Skip header rows
      if (courseCode.toLowerCase().includes('code') || courseName.toLowerCase().includes('title')) continue;

      // Try to find credits (usually last numeric column)
      let credits = 0;
      for (let i = cells.length - 1; i >= 2; i--) {
        const num = parseInt(cells[i]);
        if (!isNaN(num) && num <= 10) { // Credits are typically 1-10
          credits = num;
          break;
        }
      }

      // Check for grade/status in cells
      let status: 'completed' | 'in_progress' | 'pending' = 'pending';
      let grade: string | undefined;

      for (const cell of cells) {
        // Check for grade patterns
        if (/^[SABCDEF]$/.test(cell) || /^[SABCDEF][+-]?$/.test(cell)) {
          grade = cell;
          status = 'completed';
          earnedCredits += credits;
          break;
        }
        // Check for status indicators
        if (cell.toLowerCase().includes('registered') || cell.toLowerCase().includes('ongoing')) {
          status = 'in_progress';
        }
      }

      categoryCredits += credits;

      courses.push({
        courseCode,
        courseName,
        credits,
        status,
        grade,
      });
    }

    if (courses.length > 0) {
      categories.push({
        category: categoryCode as CurriculumData['categories'][0]['category'],
        categoryName,
        requiredCredits: categoryCredits,
        earnedCredits,
        courses,
      });

      totalRequiredCredits += categoryCredits;
      totalEarnedCredits += earnedCredits;
    }
  }

  return { totalRequiredCredits, totalEarnedCredits, categories };
}

function parseCoursePageHTML(html: string): CoursePageData {
  // Normalize HTML
  html = html
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\r\\n|\\r|\\n/g, '\n');

  // Extract course basic info
  const courseCodeMatch = html.match(/Course\s*Code[:\s]*([A-Z]{2,5}\d{4})/i);
  const courseCode = courseCodeMatch ? courseCodeMatch[1] : '';

  const courseNameMatch = html.match(/Course\s*(?:Title|Name)[:\s]*([^<\n]+)/i);
  const courseName = courseNameMatch ? cleanText(courseNameMatch[1]) : '';

  const creditsMatch = html.match(/Credits?[:\s]*(\d+)/i);
  const credits = creditsMatch ? parseInt(creditsMatch[1]) : 0;

  const facultyMatch = html.match(/Faculty[:\s]*([^<\n]+)/i) ||
                       html.match(/Instructor[:\s]*([^<\n]+)/i);
  const faculty = facultyMatch ? cleanText(facultyMatch[1]) : '';

  // Extract syllabus modules
  const syllabus: CoursePageData['syllabus'] = [];
  const moduleMatches = html.matchAll(/Module\s*(\d+)[:\s]*([\s\S]*?)(?=Module\s*\d+|Course\s*Outcome|Reference|$)/gi);

  for (const match of moduleMatches) {
    const moduleNumber = parseInt(match[1]);
    const moduleContent = match[2];

    const titleMatch = moduleContent.match(/^[:\s]*([^\n<]+)/);
    const title = titleMatch ? cleanText(titleMatch[1]) : `Module ${moduleNumber}`;

    // Extract topics as bullet points or numbered items
    const topicMatches = moduleContent.matchAll(/(?:[-•]\s*|^\d+\.\s*)([^\n<]+)/gm);
    const topics = [...topicMatches].map(m => cleanText(m[1])).filter(t => t.length > 0);

    const hoursMatch = moduleContent.match(/(\d+)\s*(?:hours?|hrs?)/i);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;

    syllabus.push({ moduleNumber, title, topics, hours });
  }

  // Extract course outcomes
  const outcomes: CoursePageData['outcomes'] = [];
  const outcomeSection = html.match(/Course\s*Outcome[s]?([\s\S]*?)(?=Reference|Textbook|Material|$)/i);

  if (outcomeSection) {
    const outcomeMatches = outcomeSection[1].matchAll(/(?:CO\s*)?(\d+)[.:\s]+([^\n<]+)/g);
    for (const match of outcomeMatches) {
      outcomes.push({
        id: `CO${match[1]}`,
        description: cleanText(match[2]),
      });
    }
  }

  // Extract reference books
  const referenceBooks: CoursePageData['referenceBooks'] = [];
  const refSection = html.match(/(?:Reference|Textbook)[s]?([\s\S]*?)(?=Material|Course\s*Page|$)/i);

  if (refSection) {
    const bookMatches = refSection[1].matchAll(/[-•\d.]\s*([^,\n<]+)(?:,\s*([^,\n<]+))?(?:,\s*([^,\n<]+))?/g);
    for (const match of bookMatches) {
      const title = cleanText(match[1]);
      if (title.length > 3) { // Skip short entries
        referenceBooks.push({
          title,
          author: match[2] ? cleanText(match[2]) : '',
          publisher: match[3] ? cleanText(match[3]) : undefined,
        });
      }
    }
  }

  // Extract materials (links to PDFs, videos, etc.)
  const materials: CoursePageData['materials'] = [];
  const materialMatches = html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);

  for (const match of materialMatches) {
    const url = match[1];
    const title = cleanText(match[2]);

    // Skip navigation links
    if (title.toLowerCase().includes('back') || title.toLowerCase().includes('home')) continue;

    let type: 'pdf' | 'video' | 'link' | 'other' = 'link';
    if (url.includes('.pdf')) type = 'pdf';
    else if (url.includes('youtube') || url.includes('video')) type = 'video';

    materials.push({ title, type, url });
  }

  return { courseCode, courseName, credits, faculty, syllabus, outcomes, referenceBooks, materials };
}

function parseMarksHTML(html: string, semesterId: string): MarksData {
  const courses: MarksData['courses'] = [];

  // Normalize HTML
  html = html
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\r\\n|\\r|\\n/g, '\n');

  // Extract semester name
  const semesterNameMatch = html.match(/(?:Winter|Fall|Summer)\s+Semester\s+\d{4}-\d{2}/i);
  const semesterName = semesterNameMatch ? semesterNameMatch[0] : '';

  // Find marks table
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return { semesterId, semesterName, courses };
  }

  const rows = tbodyMatch[1].split('</tr>').filter(r => r.includes('<tr'));

  // Group rows by course (VTOP shows each assessment as a row)
  // Structure per row: slNo, courseCode, courseTitle, courseType, slot, faculty, assessmentName, maxMarks, weightage, conductedOn, status, scoredMarks
  let currentCourse: MarksData['courses'][0] | null = null;

  for (const rowHtml of rows) {
    const row = rowHtml + '</tr>';
    const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const cells = cellMatches.map(m => cleanText(m[1]));

    if (cells.length < 8) continue;

    // Determine which format we're parsing - single row per assessment or grouped
    const courseCode = cells[1] || '';
    const courseTitle = cells[2] || '';

    // Skip header rows
    if (courseCode.toLowerCase().includes('code') || courseTitle.toLowerCase().includes('title')) continue;
    if (!courseCode || courseCode.length < 3) continue;

    // Start new course or continue existing
    if (!currentCourse || currentCourse.courseCode !== courseCode) {
      if (currentCourse) {
        courses.push(currentCourse);
      }

      const classTypeRaw = (cells[3] || 'TH').toUpperCase();
      const classType = (['ETH', 'ELA', 'EPJ', 'TH'].includes(classTypeRaw) ? classTypeRaw : 'TH') as 'ETH' | 'ELA' | 'EPJ' | 'TH';

      currentCourse = {
        courseCode,
        courseName: courseTitle,
        classType,
        faculty: cells[5] || '',
        marks: [],
        totalWeightedScore: 0,
      };
    }

    // Parse assessment info
    // Try to identify assessment columns (may vary by VTOP version)
    const assessmentName = cells[6] || cells[4] || '';
    const maxMarksStr = cells[7] || cells[5] || '0';
    const weightageStr = cells[8] || cells[6] || '0';
    const statusOrScore = cells[10] || cells[11] || cells[9] || '';
    const scoredMarksStr = cells[11] || cells[10] || cells[8] || '';

    const maxMarks = parseFloat(maxMarksStr) || 0;
    const weightage = parseFloat(weightageStr) || 0;

    // Determine status
    let status: 'graded' | 'pending' | 'absent' = 'pending';
    let scoredMarks: number | null = null;

    if (statusOrScore.toLowerCase().includes('absent')) {
      status = 'absent';
      scoredMarks = 0;
    } else if (statusOrScore.toLowerCase().includes('present') || !isNaN(parseFloat(scoredMarksStr))) {
      status = 'graded';
      scoredMarks = parseFloat(scoredMarksStr);
      if (isNaN(scoredMarks)) scoredMarks = null;
    }

    // Map assessment name to exam type
    let examType: MarksData['courses'][0]['marks'][0]['examType'] = 'DA';
    const assessmentLower = assessmentName.toLowerCase();
    if (assessmentLower.includes('cat') && assessmentLower.includes('1')) examType = 'CAT1';
    else if (assessmentLower.includes('cat') && assessmentLower.includes('2')) examType = 'CAT2';
    else if (assessmentLower.includes('fat') || assessmentLower.includes('final')) examType = 'FAT';
    else if (assessmentLower.includes('quiz')) examType = 'QUIZ';
    else if (assessmentLower.includes('lab')) examType = 'LAB';
    else if (assessmentLower.includes('project')) examType = 'PROJECT';

    if (assessmentName && maxMarks > 0) {
      currentCourse.marks.push({
        examType,
        examName: assessmentName,
        maxMarks,
        scoredMarks,
        weightage,
        status,
      });

      // Calculate weighted score
      if (scoredMarks !== null && maxMarks > 0) {
        currentCourse.totalWeightedScore += (scoredMarks / maxMarks) * weightage;
      }
    }
  }

  // Push last course
  if (currentCourse) {
    courses.push(currentCourse);
  }

  return { semesterId, semesterName, courses };
}

/** Grade to grade point mapping */
const GRADE_POINTS: Record<string, number> = {
  'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5, 'F': 0, 'N': 0, 'W': 0,
};

function parseGradesHTML(html: string): GradesData {
  const semesters: GradesData['semesters'] = [];
  let cgpa = 0;
  let totalCreditsEarned = 0;
  let totalCreditsRegistered = 0;

  // Normalize HTML
  html = html
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\r\\n|\\r|\\n/g, '\n');

  // Try to extract CGPA from summary section
  const cgpaMatch = html.match(/CGPA[:\s]*([0-9.]+)/i) ||
                    html.match(/Cumulative[^<]*GPA[:\s]*([0-9.]+)/i);
  if (cgpaMatch) {
    cgpa = parseFloat(cgpaMatch[1]) || 0;
  }

  // Extract total credits from summary
  const totalRegisteredMatch = html.match(/(?:Total\s+)?Credits?\s+Registered[:\s]*(\d+)/i);
  const totalEarnedMatch = html.match(/(?:Total\s+)?Credits?\s+Earned[:\s]*(\d+)/i);

  if (totalRegisteredMatch) totalCreditsRegistered = parseInt(totalRegisteredMatch[1]) || 0;
  if (totalEarnedMatch) totalCreditsEarned = parseInt(totalEarnedMatch[1]) || 0;

  // Find grade tables - VTOP may have one table per semester or a combined view
  const tables = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

  for (const tableMatch of tables) {
    const tableHtml = tableMatch[1];

    // Check if this is a grades table
    if (!tableHtml.toLowerCase().includes('grade') && !tableHtml.toLowerCase().includes('credit')) continue;

    // Try to extract semester name from table header
    const semesterMatch = tableHtml.match(/(?:Winter|Fall|Summer)\s+(?:Semester\s+)?(\d{4}-\d{2})/i) ||
                          tableHtml.match(/((?:Winter|Fall|Summer)\s+\d{4})/i);

    const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) continue;

    const rows = tbodyMatch[1].split('</tr>').filter(r => r.includes('<tr'));
    const courses: GradesData['semesters'][0]['courses'] = [];
    let semesterCreditsRegistered = 0;
    let semesterCreditsEarned = 0;
    let semesterGradePoints = 0;
    let currentSemesterId = '';
    let currentSemesterName = semesterMatch ? semesterMatch[1] || semesterMatch[0] : '';

    for (const rowHtml of rows) {
      const row = rowHtml + '</tr>';
      const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      const cells = cellMatches.map(m => cleanText(m[1]));

      if (cells.length < 4) continue;

      // Try to detect semester separator rows
      const semesterInRow = cells.join(' ').match(/(?:Winter|Fall|Summer)\s+(?:Semester\s+)?(\d{4}-\d{2})/i);
      if (semesterInRow && courses.length > 0) {
        // Save current semester and start new one
        const sgpa = semesterCreditsEarned > 0 ? semesterGradePoints / semesterCreditsEarned : 0;
        semesters.push({
          semesterId: currentSemesterId,
          semesterName: currentSemesterName,
          courses: [...courses],
          sgpa: Math.round(sgpa * 100) / 100,
          creditsRegistered: semesterCreditsRegistered,
          creditsEarned: semesterCreditsEarned,
        });

        courses.length = 0;
        semesterCreditsRegistered = 0;
        semesterCreditsEarned = 0;
        semesterGradePoints = 0;
        currentSemesterName = semesterInRow[1] || semesterInRow[0];
        continue;
      }

      // Parse course row: courseCode, courseTitle, courseType, credits, grade
      const courseCode = cells[0] || cells[1] || '';

      // Skip header rows and summary rows
      if (courseCode.toLowerCase().includes('code') ||
          courseCode.toLowerCase().includes('total') ||
          courseCode.toLowerCase().includes('cgpa')) continue;

      // Find grade (single letter like S, A, B, C, D, E, F, N, W)
      let grade = '';
      let credits = 0;
      let courseTitle = '';
      let courseType: 'ETH' | 'ELA' | 'EPJ' | 'TH' = 'TH';

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        // Grade detection
        if (/^[SABCDEFNW]$/.test(cell)) {
          grade = cell;
        }
        // Credits detection (1-10)
        const num = parseFloat(cell);
        if (!isNaN(num) && num >= 1 && num <= 10 && !credits) {
          credits = num;
        }
        // Course type detection
        if (['ETH', 'ELA', 'EPJ', 'TH', 'LO'].includes(cell.toUpperCase())) {
          courseType = cell.toUpperCase() as 'ETH' | 'ELA' | 'EPJ' | 'TH';
        }
        // Course title (longest text)
        if (cell.length > 10 && cell.length > courseTitle.length && !cell.match(/^\d/)) {
          courseTitle = cell;
        }
      }

      if (!courseCode || courseCode.length < 3) continue;

      const gradePoints = GRADE_POINTS[grade] || 0;

      courses.push({
        courseCode,
        courseName: courseTitle || cells[1] || '',
        classType: courseType,
        credits,
        grade,
        gradePoints,
      });

      semesterCreditsRegistered += credits;
      if (grade && grade !== 'F' && grade !== 'N' && grade !== 'W') {
        semesterCreditsEarned += credits;
        semesterGradePoints += credits * gradePoints;
      }
    }

    // Save last semester
    if (courses.length > 0) {
      const sgpa = semesterCreditsEarned > 0 ? semesterGradePoints / semesterCreditsEarned : 0;
      semesters.push({
        semesterId: currentSemesterId,
        semesterName: currentSemesterName,
        courses,
        sgpa: Math.round(sgpa * 100) / 100,
        creditsRegistered: semesterCreditsRegistered,
        creditsEarned: semesterCreditsEarned,
      });
    }
  }

  // Recalculate totals if not found
  if (totalCreditsRegistered === 0) {
    totalCreditsRegistered = semesters.reduce((sum, s) => sum + s.creditsRegistered, 0);
  }
  if (totalCreditsEarned === 0) {
    totalCreditsEarned = semesters.reduce((sum, s) => sum + s.creditsEarned, 0);
  }
  if (cgpa === 0 && semesters.length > 0) {
    const totalPoints = semesters.reduce((sum, s) => sum + (s.sgpa * s.creditsEarned), 0);
    cgpa = totalCreditsEarned > 0 ? Math.round((totalPoints / totalCreditsEarned) * 100) / 100 : 0;
  }

  return { semesters, cgpa, totalCreditsEarned, totalCreditsRegistered };
}

function parseExamScheduleHTML(html: string, semesterId: string): ExamScheduleData {
  const exams: ExamScheduleData['exams'] = [];

  // Normalize HTML
  html = html
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\r\\n|\\r|\\n/g, '\n');

  // Extract semester name
  const semesterNameMatch = html.match(/(?:Winter|Fall|Summer)\s+Semester\s+\d{4}-\d{2}/i);
  const semesterName = semesterNameMatch ? semesterNameMatch[0] : '';

  // Exam categories to look for
  const categories: { id: ExamScheduleData['exams'][0]['category']; patterns: RegExp[] }[] = [
    { id: 'CAT1', patterns: [/CAT[\s-]*1/i, /CAT[\s-]*I(?!\I)/i, /Continuous\s+Assessment\s+Test[\s-]*1/i] },
    { id: 'CAT2', patterns: [/CAT[\s-]*2/i, /CAT[\s-]*II/i, /Continuous\s+Assessment\s+Test[\s-]*2/i] },
    { id: 'FAT', patterns: [/FAT/i, /Final\s+Assessment/i, /End\s+Semester/i] },
  ];

  const categoryNames: Record<ExamScheduleData['exams'][0]['category'], string> = {
    'CAT1': 'CAT - I',
    'CAT2': 'CAT - II',
    'FAT': 'Final Assessment Test',
  };

  // Find tables for each exam category
  // VTOP typically has separate sections or tables for each exam type
  for (const category of categories) {
    const slots: ExamScheduleData['exams'][0]['slots'] = [];

    // Try to find section for this category
    let sectionHtml = html;

    // Look for category header and extract following table
    for (const pattern of category.patterns) {
      const sectionMatch = html.match(new RegExp(`${pattern.source}[\\s\\S]*?<table[^>]*>([\\s\\S]*?)<\\/table>`, 'i'));
      if (sectionMatch) {
        sectionHtml = sectionMatch[0];
        break;
      }
    }

    const tbodyMatch = sectionHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) continue;

    const rows = tbodyMatch[1].split('</tr>').filter(r => r.includes('<tr'));

    for (const rowHtml of rows) {
      const row = rowHtml + '</tr>';
      const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      const cells = cellMatches.map(m => cleanText(m[1]));

      if (cells.length < 5) continue;

      // Expected structure: courseCode, courseName, courseType, slot, date, day, session, time, venue, seatNo
      const courseCode = cells[0] || '';

      // Skip header rows
      if (courseCode.toLowerCase().includes('code') || courseCode.toLowerCase().includes('course')) continue;
      if (!courseCode || courseCode.length < 3) continue;

      const courseName = cells[1] || '';
      const classTypeRaw = (cells[2] || 'TH').toUpperCase();
      const courseType = (['ETH', 'ELA', 'EPJ', 'TH'].includes(classTypeRaw) ? classTypeRaw : 'TH') as 'ETH' | 'ELA' | 'EPJ' | 'TH';
      const slot = cells[3] || '';

      // Find date (DD-MMM-YYYY or similar format)
      let examDate = '';
      let day = '';
      let session: 'FN' | 'AN' = 'FN';
      let time = '';
      let venue = '';
      let seatNumber = '';

      for (const cell of cells) {
        // Date pattern
        if (/\d{1,2}[-/]\w{3}[-/]\d{2,4}/.test(cell) || /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(cell)) {
          examDate = cell;
        }
        // Day pattern
        if (/^(MON|TUE|WED|THU|FRI|SAT|SUN)$/i.test(cell)) {
          day = cell.toUpperCase();
        }
        // Session
        if (/^(FN|AN|FORENOON|AFTERNOON)$/i.test(cell)) {
          session = cell.toUpperCase().startsWith('A') ? 'AN' : 'FN';
        }
        // Time pattern (HH:MM)
        if (/\d{1,2}:\d{2}\s*(?:AM|PM)?/i.test(cell) && !time) {
          time = cell;
        }
        // Venue (typically room codes like SJT-301)
        if (/^[A-Z]{2,4}[-\s]?\d{3}/i.test(cell)) {
          venue = cell;
        }
        // Seat number
        if (/^(?:Seat\s*)?#?\d{1,4}$/i.test(cell)) {
          seatNumber = cell.replace(/\D/g, '');
        }
      }

      if (courseCode && examDate) {
        slots.push({
          courseCode,
          courseName,
          courseType,
          slot,
          examDate,
          day,
          session,
          time,
          venue,
          seatNumber: seatNumber || undefined,
        });
      }
    }

    if (slots.length > 0) {
      exams.push({
        category: category.id,
        categoryName: categoryNames[category.id],
        slots,
      });
    }
  }

  return { semesterId, semesterName, exams };
}

function parseProfileHTML(html: string): ProfileData {
  // VTOP profile uses tables with label cells (background #d4d3d3) and value cells (background #FAF0DD)
  // Helper to extract field value from VTOP's table structure
  const extractTableField = (label: string): string => {
    // VTOP table pattern: <td ...>#d4d3d3...>LABEL</td>\n<td ...>#FAF0DD...>VALUE</td>
    const patterns = [
      // Direct table cell pattern
      new RegExp(`<td[^>]*>${label}</td>\\s*<td[^>]*>([^<]*)`, 'i'),
      new RegExp(`<td[^>]*>${label.replace(/['\s]/g, '[^>]*')}</td>\\s*<td[^>]*>([^<]*)`, 'i'),
      // With colspan
      new RegExp(`<td[^>]*>${label}</td>\\s*<td[^>]*colspan[^>]*>([^<]*)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const value = match[1].replace(/&nbsp;/g, ' ').trim();
        if (value && value !== '-' && value !== 'N/A' && value !== 'NIL') return value;
      }
    }
    return '';
  };

  // Extract from header section (visible without expanding panels)
  // Header labels: REGISTER NUMBER:, VIT EMAIL:, PROGRAM & BRANCH:, SCHOOL NAME:
  const regNoMatch = html.match(/REGISTER\s*NUMBER[:\s]*<\/label>\s*<label[^>]*>(\d{2}[A-Z]{2,4}\d{4,5})/i) ||
                     html.match(/(\d{2}[A-Z]{2,4}\d{4,5})/);
  const registrationNumber = regNoMatch ? regNoMatch[1] : '';

  const vitEmailMatch = html.match(/VIT\s*EMAIL[:\s]*<\/label>\s*<label[^>]*>([a-zA-Z0-9._%+-]+@vitstudent\.ac\.in)/i) ||
                        html.match(/([a-zA-Z0-9._%+-]+@vitstudent\.ac\.in)/i);
  const vitEmail = vitEmailMatch ? vitEmailMatch[1] : '';

  const programMatch = html.match(/PROGRAM\s*(?:&amp;|&|AND)\s*BRANCH[:\s]*<\/label>\s*<label[^>]*>([^<]+)/i);
  const programBranch = programMatch ? programMatch[1].trim() : '';

  const schoolMatch = html.match(/SCHOOL\s*NAME[:\s]*<\/label>\s*<label[^>]*>([^<]+)/i);
  const school = schoolMatch ? schoolMatch[1].trim() : '';

  // Extract student name from near the photo (in a <p> tag after the img)
  const nameMatch = html.match(/<img[^>]*class="img[^>]*>[\s\S]*?<p[^>]*>([A-Z][A-Z\s]+)<\/p>/i) ||
                    html.match(/<p[^>]*style="[^"]*text-align:\s*center[^"]*font-weight:\s*bold[^"]*">([A-Z][A-Z\s]+)<\/p>/i);
  const studentName = nameMatch ? nameMatch[1].trim() : '';

  // Photo - VTOP embeds base64 photo directly in the HTML
  const photoMatch = html.match(/src="(data:(?:null|image\/[^"]+);base64,[^"]+)"/i);
  const photoUrl = photoMatch ? photoMatch[1] : undefined;

  // Parse from PERSONAL INFORMATION table
  const personalName = extractTableField('STUDENT NAME') || studentName;
  const applicationNumber = extractTableField('APPLICATION NUMBER');
  const dateOfBirth = extractTableField('DATE OF BIRTH');
  const gender = extractTableField('GENDER');
  const bloodGroup = extractTableField('BLOOD GROUP');
  const mobileNumber = extractTableField('MOBILE NUMBER');
  const nationality = extractTableField('NATIONALITY');
  const personalEmail = extractTableField('EMAIL');

  // Address - combine permanent address fields
  const streetName = extractTableField('STREET NAME');
  const areaName = extractTableField('AREA NAME');
  const city = extractTableField('CITY');
  const state = extractTableField('STATE');
  const pincode = extractTableField('PINCODE');
  const address = [streetName, areaName, city, state, pincode].filter(Boolean).join(', ');

  // Check for hostel section
  const hasHostel = html.toUpperCase().includes('HOSTEL INFORMATION');

  return {
    personal: {
      name: personalName,
      registrationNumber,
      applicationNumber,
      dateOfBirth,
      gender,
      bloodGroup,
      email: vitEmail || personalEmail,
      phone: mobileNumber,
      address,
      nationality,
    },
    educational: {
      school,
      program: programBranch,
      branch: '', // Often combined with program in VTOP
      admissionYear: '', // Not directly in profile
      expectedGraduation: '',
    },
    family: {
      fatherName: extractTableField("FATHER'S NAME") || extractTableField('FATHER NAME'),
      fatherOccupation: extractTableField("FATHER'S OCCUPATION") || undefined,
      fatherPhone: extractTableField("FATHER'S MOBILE") || extractTableField("FATHER'S PHONE") || undefined,
      motherName: extractTableField("MOTHER'S NAME") || extractTableField('MOTHER NAME'),
      motherOccupation: extractTableField("MOTHER'S OCCUPATION") || undefined,
      motherPhone: extractTableField("MOTHER'S MOBILE") || extractTableField("MOTHER'S PHONE") || undefined,
      guardianName: extractTableField("GUARDIAN'S NAME") || extractTableField('GUARDIAN NAME') || undefined,
      guardianPhone: extractTableField("GUARDIAN'S MOBILE") || extractTableField("GUARDIAN'S PHONE") || undefined,
    },
    proctor: {
      name: extractTableField('PROCTOR NAME') || extractTableField('FA NAME') || extractTableField('FACULTY ADVISOR'),
      email: extractTableField('PROCTOR EMAIL') || extractTableField('FA EMAIL'),
      phone: extractTableField('PROCTOR MOBILE') || extractTableField('FA MOBILE') || undefined,
      cabin: extractTableField('CABIN') || extractTableField('CABIN NUMBER') || undefined,
    },
    hostel: hasHostel ? {
      hostelName: extractTableField('HOSTEL NAME') || extractTableField('HOSTEL'),
      roomNumber: extractTableField('ROOM NUMBER') || extractTableField('ROOM NO'),
      blockName: extractTableField('BLOCK') || extractTableField('BLOCK NAME'),
      bedNumber: extractTableField('BED NUMBER') || extractTableField('BED') || undefined,
    } : undefined,
    photoUrl,
  };
}

/** Calculate classes needed to reach target percentage: (attended + x) / (total + x) >= target */
export function calculateClassesNeeded(attended: number, total: number, targetPercentage: number): number {
  const target = targetPercentage / 100;
  if (target >= 1) return Infinity;
  const needed = Math.ceil((target * total - attended) / (1 - target));
  return Math.max(0, needed);
}

/** Calculate classes that can be skipped while maintaining target: attended / (total + x) >= target */
export function calculateClassesCanSkip(attended: number, total: number, targetPercentage: number): number {
  const target = targetPercentage / 100;
  if (target <= 0) return Infinity;
  const canSkip = Math.floor((attended / target) - total);
  return Math.max(0, canSkip);
}
