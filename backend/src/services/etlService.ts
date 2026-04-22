/**
 * eTimeTrackLite Web Scraper Service
 *
 * Logs into the eTimeTrackLite ASP.NET web portal and downloads attendance
 * records for a given date range.
 */
import crypto from 'crypto';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function createEtlClient(baseUrl: string) {
  const jar = new CookieJar();
  return wrapper(
    axios.create({
      jar,
      baseURL: baseUrl,
      withCredentials: true,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: {
        'User-Agent': DESKTOP_UA,
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
  );
}

// ── Credential encryption (AES-256-CBC) ──────────────────────────────────────
// Used to store ETL Portal passwords in MongoDB in a retrievable (non-bcrypt) form.
function getEncKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'hrms-default-key-change-in-production';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptForStorage(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

export function decryptFromStorage(stored: string): string {
  const [ivHex, encHex] = stored.split(':');
  if (!ivHex || !encHex) throw new Error('Invalid encrypted credential format');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getEncKey(), Buffer.from(ivHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
}
// ─────────────────────────────────────────────────────────────────────────────

export interface EtlAttendanceRecord {
  employeeDeviceId: string;
  timestamp: Date;
  punchType: number;
  raw: string;
}

export interface EtlFetchResult {
  success: boolean;
  message: string;
  records: EtlAttendanceRecord[];
}

/**
 * AES-128-ECB encryption matching:
 *   CryptoJS.AES.encrypt(plain, CryptoJS.enc.Utf8.parse(key), {mode:ECB, padding:Pkcs7})
 *
 * The key is the 16-digit number from StaffloginDialog$txtKey.
 */
function encryptPassword(plain: string, secretKey: string): string {
  const keyBuf = Buffer.from(secretKey, 'utf8');
  const keySize = keyBuf.length <= 16 ? 16 : keyBuf.length <= 24 ? 24 : 32;
  const paddedKey = Buffer.alloc(keySize, 0);
  keyBuf.copy(paddedKey);
  const cipher = crypto.createCipheriv(`aes-${keySize * 8}-ecb` as crypto.CipherGCMTypes, paddedKey, null);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return encrypted.toString('base64');
}

function extractHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const matches = html.matchAll(/<input[^>]+type="hidden"[^>]*>/gi);
  for (const m of matches) {
    const nameM = m[0].match(/name="([^"]*)"/i);
    const valM = m[0].match(/value="([^"]*)"/i);
    if (nameM) fields[nameM[1]] = valM ? valM[1] : '';
  }
  return fields;
}

function extractFieldByName(html: string, fieldName: string): string {
  // Avoid $ in regex — search by literal index
  const nameAttr = `name="${fieldName}"`;
  const idx = html.indexOf(nameAttr);
  if (idx === -1) return '';
  const chunk = html.substring(Math.max(0, idx - 200), idx + 300);
  const m = chunk.match(/value="([^"]*)"/);
  return m ? m[1] : '';
}

/**
 * Parse attendance lines from eTimeTrackLite export.
 * Supported formats:
 *   TAB-delimited: PIN\tDate Time\tVerifyType\tPunchType
 *   Comma-delimited: PIN,Date Time,VerifyType,PunchType
 */
function parseAttendanceData(raw: string): EtlAttendanceRecord[] {
  const records: EtlAttendanceRecord[] = [];
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip HTML, headers
    if (line.startsWith('<') || line.startsWith('PIN') || line.startsWith('No.')) continue;

    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    if (parts.length < 2) continue;

    const pin = parts[0]?.trim();
    const dateTime = parts[1]?.trim();
    if (!pin || !dateTime || !/^\d/.test(pin)) continue;

    const timestamp = new Date(dateTime.replace(' ', 'T'));
    if (isNaN(timestamp.getTime())) continue;

    const punchType = parseInt(parts[3]?.trim() || '0') || 0;
    records.push({ employeeDeviceId: pin, timestamp, punchType, raw: line });
  }
  return records;
}

async function etlLogin(
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ client: ReturnType<typeof createEtlClient>; success: boolean; message: string }> {
  const client = createEtlClient(baseUrl);

  // Step 1: GET login page
  const r1 = await client.get('/iclock/');
  if (r1.status !== 200) {
    return { client, success: false, message: `eTimeTrackLite unreachable (HTTP ${r1.status})` };
  }

  const html1 = String(r1.data);
  const hidden = extractHiddenFields(html1);
  const txtKey = extractFieldByName(html1, 'StaffloginDialog$txtKey');
  if (!txtKey) {
    return { client, success: false, message: 'Could not find login key on eTimeTrackLite page (server may be down or URL is wrong)' };
  }

  // Step 2: Encrypt password & POST login form
  const encPassword = encryptPassword(password, txtKey);
  const formData = new URLSearchParams({
    ...hidden,
    '__EVENTTARGET': '',
    '__EVENTARGUMENT': '',
    'StaffloginDialog$txt_LoginName': username,
    'StaffloginDialog$Txt_Password': encPassword,
    'StaffloginDialog$txtKey': txtKey,
    'StaffloginDialog$Btn_Ok': 'Login',
  });

  const r2 = await client.post('/iclock/', formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${baseUrl}/iclock/` },
  });

  const loginBody = String(r2.data);
  const finalUrl: string = (r2.request as { res?: { responseUrl?: string } })?.res?.responseUrl || '';

  // Login failed if form still visible or server redirected to logout
  const stillOnLogin = /name="StaffloginDialog\$Btn_Ok"/i.test(loginBody);
  const errorMsg = (loginBody.match(/InValidError[\s\S]{0,200}<font color="Red">([^<]+)</i) || [])[1];
  const redirectedToLogout = /LogOut\.aspx/i.test(finalUrl) && loginBody.length < 2000;

  if (stillOnLogin || redirectedToLogout) {
    const reason = errorMsg ? errorMsg.trim() : redirectedToLogout ? 'server rejected login (check User-Agent or credentials)' : 'invalid username or password';
    return { client, success: false, message: `eTimeTrackLite login failed — ${reason}` };
  }

  return { client, success: true, message: 'Login successful' };
}

export async function fetchFromETimeTrackLite(
  baseUrl: string,   // e.g. http://98.70.41.54:85
  username: string,
  password: string,
  fromDate: string,  // YYYY-MM-DD
  toDate: string     // YYYY-MM-DD
): Promise<EtlFetchResult> {

  const { client, success, message } = await etlLogin(baseUrl, username, password);
  if (!success) return { success: false, message, records: [] };

  // Try multiple export approaches (cookie jar is shared via client)
  const approaches: Array<() => Promise<EtlAttendanceRecord[]>> = [
    // Approach 1: attlog.aspx form POST
    async () => {
      const r = await client.get('/iclock/attlog.aspx');
      return tryDownloadAttLog(client, String(r.data), fromDate, toDate);
    },
    // Approach 2: download.aspx with date params
    async () => {
      const r = await client.get(`/iclock/download.aspx?sDate=${fromDate}&eDate=${toDate}`);
      const body = String(r.data);
      const parsed = parseAttendanceData(body);
      if (parsed.length > 0) return parsed;
      return tryDownloadAttLog(client, body, fromDate, toDate);
    },
  ];

  for (const attempt of approaches) {
    try {
      const records = await attempt();
      if (records.length > 0) {
        return {
          success: true,
          message: `Fetched ${records.length} attendance record(s) from ${fromDate} to ${toDate}`,
          records,
        };
      }
    } catch (e) {
      console.warn('[ETL] Approach failed:', (e as Error).message);
    }
  }

  return {
    success: true,
    message: 'Login succeeded but no attendance records found for the selected date range.',
    records: [],
  };
}

async function tryDownloadAttLog(
  client: ReturnType<typeof createEtlClient>,
  pageHtml: string,
  fromDate: string,
  toDate: string
): Promise<EtlAttendanceRecord[]> {
  const hidden = extractHiddenFields(pageHtml);

  const fieldVariants = [
    { from: 'sDate', to: 'eDate' },
    { from: 'StartDate', to: 'EndDate' },
    { from: 'FromDate', to: 'ToDate' },
    { from: 'start_date', to: 'end_date' },
  ];

  for (const { from, to } of fieldVariants) {
    const formData = new URLSearchParams({
      ...hidden,
      '__EVENTTARGET': '',
      '__EVENTARGUMENT': '',
      [from]: fromDate,
      [to]: toDate,
    });

    try {
      const r = await client.post('/iclock/attlog.aspx', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const parsed = parseAttendanceData(String(r.data));
      if (parsed.length > 0) return parsed;
    } catch { /* try next */ }
  }

  return [];
}

/**
 * Parse manually-pasted or uploaded attendance data.
 * Accepts TAB-delimited or comma-separated lines in iClock format:
 *   PIN  Date Time  VerifyType  PunchType
 */
export function parseManualAttendanceData(raw: string): EtlAttendanceRecord[] {
  return parseAttendanceData(raw);
}

// ── Employee scraper ──────────────────────────────────────────────────────────

export interface EtlEmployee {
  pin: string;
  name: string;
  department?: string;
}

/**
 * Login to eTimeTrackLite and attempt to scrape the employee/staff list.
 * Returns an empty array when login succeeds but the employee-list page is
 * not found (different firmware versions use different URL patterns).
 */
export async function fetchEmployeesFromETL(
  baseUrl: string,
  username: string,
  password: string,
): Promise<{ success: boolean; employees: EtlEmployee[]; message: string }> {
  const { client, success, message } = await etlLogin(baseUrl, username, password);
  if (!success) return { success: false, employees: [], message };

  const staffPages = [
    '/iclock/StaffInfo.aspx',
    '/iclock/UserInfo.aspx',
    '/iclock/Staff.aspx',
    '/iclock/EmployeeInfo.aspx',
    '/iclock/Personnel/StaffInfo.aspx',
  ];

  for (const page of staffPages) {
    try {
      const r = await client.get(page);
      if (r.status === 200) {
        const body = String(r.data);
        if (body.includes('RedirectToHome')) continue;
        const employees = parseEmployeeTable(body);
        if (employees.length > 0) {
          return { success: true, employees, message: `Found ${employees.length} employee(s) from ${page}` };
        }
      }
    } catch { /* try next */ }
  }

  return {
    success: true,
    employees: [],
    message: 'Login succeeded but employee list page not found. Employees will be auto-created from punch data.',
  };
}

function parseEmployeeTable(html: string): EtlEmployee[] {
  const employees: EtlEmployee[] = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(td => td.replace(/<[^>]+>/g, '').trim());
    if (cells.length < 2) continue;
    const pin = cells[0];
    const name = cells[1];
    if (!pin || !name || !/^\d+$/.test(pin) || name.toLowerCase() === 'pin') continue;
    employees.push({ pin, name, department: cells[2] || undefined });
  }
  return employees;
}

// ── Direct iClock Server / ESSL REST Pull ─────────────────────────────────────
/**
 * Fetch attendance data from an eTimeTrackLite server using multiple strategies:
 * 1. ESSL REST API (JWT token — newer ZKTeco/ESSL firmware)
 * 2. iClock cdata GET with table=ATTLOG (device-protocol pull mode)
 * 3. Portal HTML scraping (fallback — same as fetchFromETimeTrackLite)
 *
 * Strategy 1 & 2 work without knowing the web-portal password when the server
 * exposes a REST endpoint or allows device-style pulls.
 */
export async function fetchFromIClockServerDirect(
  serverUrl: string,    // e.g. http://98.70.41.54:85
  deviceSN: string,     // e.g. CGKK220762223
  lastSync?: Date,
  username?: string,
  password?: string,
): Promise<EtlFetchResult> {

  // Calculate Stamp — 2-hour overlap to avoid gaps
  const overlapMs = 2 * 60 * 60 * 1000;
  const fromDate = lastSync
    ? new Date(lastSync.getTime() - overlapMs)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1); // start of current month

  const fromStr = fromDate.toISOString().replace('T', ' ').split('.')[0];
  const toStr = new Date().toISOString().replace('T', ' ').split('.')[0];
  const stampSec = Math.floor(fromDate.getTime() / 1000);

  const client = createEtlClient(serverUrl);

  // ── Strategy 1: ESSL REST API (JWT token-auth) ─────────────────────────────
  if (username && password) {
    try {
      const tokenRes = await client.post('/iclock/api/token-auth/', { username, password }, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (tokenRes.status === 200 && tokenRes.data?.token) {
        const token = String(tokenRes.data.token);
        console.log('[iClockDirect] REST API token obtained');

        // Paginate through all records
        const allRecords: EtlAttendanceRecord[] = [];
        let nextUrl: string | null =
          `/iclock/api/attlogs/?page_size=1000&terminal_sn=${deviceSN}&start_time=${encodeURIComponent(fromStr)}&end_time=${encodeURIComponent(toStr)}`;

        while (nextUrl) {
          const currentUrl: string = nextUrl;
          // eslint-disable-next-line no-await-in-loop
          const logsRes = await client.get<{ next?: string; data?: unknown[] }>(currentUrl, {
            headers: { Authorization: `JWT ${token}` },
            baseURL: serverUrl,
          });
          if (logsRes.status !== 200 || !logsRes.data) break;
          const pageRecs = parseRestApiLogs(logsRes.data.data || []);
          allRecords.push(...pageRecs);
          // Follow "next" page URL if provided
          const rawNext: string | null = logsRes.data.next || null;
          if (!rawNext) {
            nextUrl = null;
          } else if (rawNext.startsWith('http')) {
            nextUrl = rawNext.replace(serverUrl, '');
          } else {
            nextUrl = rawNext;
          }
        }

        if (allRecords.length > 0) {
          return {
            success: true,
            message: `Fetched ${allRecords.length} records via ESSL REST API`,
            records: allRecords,
          };
        }
      }
    } catch (e) {
      console.warn('[iClockDirect] REST API attempt failed:', (e as Error).message);
    }
  }

  // ── Strategy 2: iClock cdata GET — table=ATTLOG (no auth needed on some servers) ──
  const cdataUrls = [
    `/iclock/cdata?SN=${deviceSN}&table=ATTLOG&Stamp=${stampSec}&command_id=0`,
    `/iclock/cdata?SN=${deviceSN}&table=ATTLOG&Stamp=0&command_id=0`,
    `/iclock/download?SN=${deviceSN}&table=ATTLOG&Stamp=${stampSec}`,
  ];

  for (const path of cdataUrls) {
    try {
      const res = await client.get(path);
      if (res.status === 200) {
        const body = String(res.data);
        // Only count if actual punch records present (not just server config response)
        if (body.includes('\t') && /\d{4}-\d{2}-\d{2}/.test(body)) {
          const records = parseAttendanceData(body);
          if (records.length > 0) {
            console.log(`[iClockDirect] iClock cdata returned ${records.length} records from ${path}`);
            // Filter to afterFromDate
            const filtered = records.filter(r => r.timestamp >= fromDate);
            return {
              success: true,
              message: `Fetched ${filtered.length} records via iClock cdata protocol`,
              records: filtered,
            };
          }
        }
      }
    } catch (e) {
      console.warn(`[iClockDirect] cdata GET ${path} failed:`, (e as Error).message);
    }
  }

  // ── Strategy 3: Portal scraping (fallback) ────────────────────────────────
  if (username && password) {
    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = new Date().toISOString().split('T')[0];
    console.log(`[iClockDirect] Falling back to portal scraping ${fromDateStr} → ${toDateStr}`);
    return fetchFromETimeTrackLite(serverUrl, username, password, fromDateStr, toDateStr);
  }

  return {
    success: false,
    message: 'Could not fetch data from the server. Please enter portal credentials in Device > Configure Live Sync.',
    records: [],
  };
}

function parseRestApiLogs(data: unknown[]): EtlAttendanceRecord[] {
  // ESSL REST API attlog record:
  // { emp_code, punch_time, punch_state, verify_type, terminal_sn, work_code, ... }
  const records: EtlAttendanceRecord[] = [];
  if (!Array.isArray(data)) return records;

  for (const item of data) {
    const d = item as {
      emp_code?: string | number;
      punch_time?: string;
      punch_state?: string | number;
    };
    if (!d.emp_code || !d.punch_time) continue;
    const timestamp = new Date(String(d.punch_time).replace(' ', 'T'));
    if (isNaN(timestamp.getTime())) continue;
    records.push({
      employeeDeviceId: String(d.emp_code),
      timestamp,
      punchType: parseInt(String(d.punch_state || '0')) || 0,
      raw: JSON.stringify(d),
    });
  }
  return records;
}
