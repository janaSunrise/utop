/**
 * HTML parsing functions for VTOP responses.
 * Separates parsing logic from the HTTP client for maintainability.
 * Uses cheerio for robust HTML parsing.
 */

import * as cheerio from 'cheerio';
import type {
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

/**
 * Normalize VTOP HTML by replacing HTML entities and escape sequences.
 * VTOP responses often contain HTML entities and literal escape sequences
 * that need to be normalized before parsing.
 */
export function normalizeHtml(html: string): string {
  return html
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\r\\n|\\r|\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

/**
 * Clean text by removing HTML tags and normalizing whitespace.
 */
export function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\\r\\n|\\r|\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSemesterDropdown(html: string): Semester[] {
  const $ = cheerio.load(html);
  const semesters: Semester[] = [];

  // Find the semester dropdown
  const select = $('select#semesterSubId, select[name="semesterSubId"]').first();
  const options = select.length ? select.find('option') : $('option');

  options.each((_, option) => {
    const $option = $(option);
    const id = $option.attr('value')?.trim() || '';
    const name = $option.text().trim();
    const isSelected = $option.is('[selected]');

    // Skip empty values and placeholder options
    if (id && !name.toLowerCase().includes('choose') && !name.toLowerCase().includes('select')) {
      semesters.push({
        id,
        name,
        isCurrent: isSelected,
      });
    }
  });

  return semesters;
}

export function parseAttendanceHTML(html: string, semesterId: string): AttendanceData {
  html = normalizeHtml(html);
  const $ = cheerio.load(html);
  const entries: AttendanceEntry[] = [];

  // Extract semester name from selected dropdown or page text
  const selectedOption = $('select#semesterSubId option[selected]').last();
  let semesterName = selectedOption.text().trim();
  if (!semesterName) {
    const semesterMatch = html.match(/(?:Winter|Fall|Summer)\s+Semester\s+\d{4}-\d{2}/i);
    semesterName = semesterMatch ? semesterMatch[0] : '';
  }

  // Find the attendance table
  const table = $('table tbody').first();

  table.find('tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');

    // VTOP table: [slNo, classGroup, courseDetail, classDetail, facultyDetail, attended, total, percentage, debarStatus, link]
    if (cells.length < 10) return;

    // Extract class type from onclick attribute - most reliable source
    const onclick = $row.find('[onclick]').attr('onclick') || '';
    const onclickMatch = onclick.match(/callStudentAttendanceDetailDisplay\([^)]*,\s*['"]([A-Z]+)['"]\s*\)/);
    const classType = (onclickMatch ? onclickMatch[1] : 'TH') as 'ETH' | 'ELA' | 'EPJ' | 'SS' | 'TH';

    // Extract course details from cell 2 (0-indexed)
    const courseDetail = $(cells[2]).text().trim();
    const courseDetailParts = courseDetail.split(' - ').map(s => s.trim());
    if (courseDetailParts.length < 2) return;

    const courseCode = courseDetailParts[0];
    const courseName = courseDetailParts.length > 2
      ? courseDetailParts.slice(1, -1).join(' - ')
      : courseDetailParts[1];

    // Extract slot from cell 3
    const classDetail = $(cells[3]).text().trim();
    const classDetailParts = classDetail.split(' - ').map(s => s.trim());
    const slot = classDetailParts.length >= 2 ? classDetailParts[1] : '';

    // Extract faculty from cell 4
    const facultyDetail = $(cells[4]).text().trim();
    const facultyParts = facultyDetail.split(' - ').map(s => s.trim());
    const faculty = facultyParts[0];

    // Extract attendance numbers
    const attendedText = $(cells[5]).text().trim();
    const totalText = $(cells[6]).text().trim();
    const percentageText = $(cells[7]).text().trim();

    const attendedMatch = attendedText.match(/(\d+)/);
    const totalMatch = totalText.match(/(\d+)/);
    const attended = attendedMatch ? parseInt(attendedMatch[1]) : 0;
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    const percentageMatch = percentageText.match(/(\d+)/);
    const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 0;

    // Check debarred status from cell 8
    const debarCell = $(cells[8]).text().trim().toLowerCase();
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
  });

  return { semesterId, semesterName, entries, lastUpdated: new Date().toISOString() };
}

const SLOT_TIMINGS: Record<string, { start: string; end: string }> = {
  'A1': { start: '08:00', end: '08:50' },
  'B1': { start: '09:00', end: '09:50' },
  'C1': { start: '10:00', end: '10:50' },
  'D1': { start: '11:00', end: '11:50' },
  'E1': { start: '12:00', end: '12:50' },
  'F1': { start: '14:00', end: '14:50' },
  'G1': { start: '15:00', end: '15:50' },
  'A2': { start: '14:00', end: '14:50' },
  'B2': { start: '15:00', end: '15:50' },
  'C2': { start: '16:00', end: '16:50' },
  'D2': { start: '17:00', end: '17:50' },
  'E2': { start: '18:00', end: '18:50' },
  'F2': { start: '19:00', end: '19:50' },
  'G2': { start: '08:00', end: '08:50' },
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

function getSlotTiming(slot: string): { start: string; end: string } {
  return SLOT_TIMINGS[slot] || { start: '00:00', end: '00:00' };
}

export function parseTimetableHTML(html: string, semesterId: string): TimetableData {
  const dayNames: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const days: TimetableData['days'] = dayNames.map(day => ({ day, slots: [] }));

  const semesterNameMatch = html.match(/(?:Winter|Fall|Summer)\s+Semester\s+\d{4}-\d{2}/i);
  const semesterName = semesterNameMatch ? semesterNameMatch[0] : '';

  html = normalizeHtml(html);

  // Build course map from course list table
  const courseMap: Map<string, {
    courseCode: string;
    courseName: string;
    courseType: 'ETH' | 'ELA' | 'EPJ' | 'SS' | 'TH';
    faculty: string;
    venue: string;
    slot: string;
  }> = new Map();

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

        if (cells.length >= 9) {
          const courseCode = cells[2];
          const courseName = cells[3];
          const courseTypeRaw = cells[4].toUpperCase();
          const courseType = (['ETH', 'ELA', 'EPJ', 'SS', 'TH'].includes(courseTypeRaw) ? courseTypeRaw : 'TH') as 'ETH' | 'ELA' | 'EPJ' | 'SS' | 'TH';
          const slot = cells[7];
          const venue = cells[8];
          const faculty = cells[9] || '';

          const slots = slot.split('+').map(s => s.trim());
          for (const s of slots) {
            courseMap.set(s, { courseCode, courseName, courseType, faculty, venue, slot });
          }
        }
      }
    }
  }

  // Parse timetable grid
  const gridTableMatch = html.match(/<table[^>]*id="(?:divTimeTable|timetable)"[^>]*>([\s\S]*?)<\/table>/i);
  if (gridTableMatch) {
    const gridRows = gridTableMatch[1].split('</tr>').filter(r => r.includes('<tr'));

    for (let dayIndex = 0; dayIndex < gridRows.length && dayIndex < 6; dayIndex++) {
      const row = gridRows[dayIndex] + '</tr>';
      const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];

      for (const cellMatch of cellMatches) {
        const cellContent = cleanText(cellMatch[1]);
        if (!cellContent || cellContent === '-') continue;

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

export function parseCurriculumHTML(html: string): CurriculumData {
  const $ = cheerio.load(html);
  const categories: CurriculumData['categories'] = [];
  let totalRequiredCredits = 0;
  let totalEarnedCredits = 0;

  // Category name mappings
  const categoryNames: Record<string, string> = {
    'NC': 'Non-Credit Course',
    'UCC': 'University Core Courses',
    'PCC': 'Programme Core Courses',
    'CON': 'Concentration',
    'OEC': 'Open Elective Courses',
    'PMT': 'Program Minor Track',
    'UE': 'University Elective',
    'PC': 'Program Core',
    'PE': 'Program Elective',
    'UC': 'University Core',
  };

  // Extract total credits from "Total Credits: X" text
  const totalCreditsMatch = $.text().match(/Total\s*Credits[:\s]*(\d+)/i);
  if (totalCreditsMatch) {
    totalRequiredCredits = parseInt(totalCreditsMatch[1]) || 0;
  }

  // Parse category cards - look for symbol-label divs with category info
  $('[id^="symbol-"]').each((_, element) => {
    const $el = $(element);
    const categoryId = $el.attr('id')?.replace('symbol-', '') || '';

    if (!categoryId) return;

    // Extract category code from first div child
    const categoryCode = $el.find('> div').first().text().trim().toUpperCase();
    if (!categoryCode) return;

    // Extract credits and max credits from the small/span pairs
    let earnedCredits = 0;
    let requiredCredits = 0;

    $el.find('> div').each((_, div) => {
      const $div = $(div);
      const smallText = $div.find('small').text().toLowerCase();
      const spanText = $div.find('span').text().trim();
      const value = parseInt(spanText) || 0;

      if (smallText.includes('credit:') && !smallText.includes('max')) {
        earnedCredits = value;
      } else if (smallText.includes('max')) {
        requiredCredits = value;
      }
    });

    // Find category name from sibling elements
    const $card = $el.closest('.card, .row');
    let categoryName = $card.find('.d-block.text-sm, span.d-block').text().trim();

    // Fallback to our mapping if not found
    if (!categoryName) {
      categoryName = categoryNames[categoryCode] || categoryCode;
    }

    // Only add valid categories
    if (categoryCode && requiredCredits > 0) {
      categories.push({
        category: categoryCode as CurriculumData['categories'][0]['category'],
        categoryName,
        requiredCredits,
        earnedCredits,
        courses: [], // Courses are loaded dynamically via AJAX
      });

      totalEarnedCredits += earnedCredits;
    }
  });

  // If no symbol-label elements found, try alternative parsing (table-based curriculum)
  if (categories.length === 0) {
    // Fallback to legacy table-based parsing for older VTOP versions
    html = normalizeHtml(html);

    const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

    for (const tableMatch of tableMatches) {
      const tableHtml = tableMatch[1];

      if (!tableHtml.includes('Credit') && !tableHtml.includes('L-T-P')) continue;

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
      let catEarnedCredits = 0;

      for (const rowHtml of rows) {
        const row = rowHtml + '</tr>';
        const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        const cells = cellMatches.map(m => cleanText(m[1]));

        if (cells.length < 3) continue;

        const courseCode = cells[0];
        const courseName = cells[1];

        if (courseCode.toLowerCase().includes('code') || courseName.toLowerCase().includes('title')) continue;

        let credits = 0;
        for (let i = cells.length - 1; i >= 2; i--) {
          const num = parseInt(cells[i]);
          if (!isNaN(num) && num <= 10) {
            credits = num;
            break;
          }
        }

        let status: 'completed' | 'in_progress' | 'pending' = 'pending';
        let grade: string | undefined;

        for (const cell of cells) {
          if (/^[SABCDEF]$/.test(cell) || /^[SABCDEF][+-]?$/.test(cell)) {
            grade = cell;
            status = 'completed';
            catEarnedCredits += credits;
            break;
          }
          if (cell.toLowerCase().includes('registered') || cell.toLowerCase().includes('ongoing')) {
            status = 'in_progress';
          }
        }

        categoryCredits += credits;

        courses.push({ courseCode, courseName, credits, status, grade });
      }

      if (courses.length > 0) {
        categories.push({
          category: categoryCode as CurriculumData['categories'][0]['category'],
          categoryName,
          requiredCredits: categoryCredits,
          earnedCredits: catEarnedCredits,
          courses,
        });

        totalRequiredCredits += categoryCredits;
        totalEarnedCredits += catEarnedCredits;
      }
    }
  }

  return { totalRequiredCredits, totalEarnedCredits, categories };
}

/**
 * Parse curriculum category detail HTML (loaded via AJAX for each category).
 * Returns the list of courses in that category.
 */
export function parseCurriculumCategoryHTML(html: string): CurriculumData['categories'][0]['courses'] {
  const $ = cheerio.load(html);
  const courses: CurriculumData['categories'][0]['courses'] = [];

  // Find all tables with course data
  $('table.example tbody tr, table.table tbody tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');

    // Skip if not enough cells
    if (cells.length < 5) return;

    // S.No., Code/Syllabus, Title, Type, Credit, L, T, P, J
    // Index:  0      1         2      3      4    5  6  7  8
    const courseCodeCell = $(cells[1]);
    const courseCode = courseCodeCell.find('span.float-start').text().trim() ||
                       courseCodeCell.text().trim().split(/\s+/)[0];
    const courseName = $(cells[2]).text().trim();
    const courseType = $(cells[3]).text().trim();
    const creditsStr = $(cells[4]).text().trim();
    const credits = parseFloat(creditsStr) || 0;

    // Skip header rows or empty rows
    if (!courseCode || courseCode.toLowerCase().includes('code')) return;
    if (!courseName || courseName.toLowerCase().includes('title')) return;

    // Determine status - in this view we don't have grade/status info
    // so all courses are shown as 'pending' by default
    let status: 'completed' | 'in_progress' | 'pending' = 'pending';

    courses.push({
      courseCode,
      courseName,
      credits,
      status,
    });
  });

  return courses;
}

export function parseCoursePageHTML(html: string): CoursePageData {
  html = normalizeHtml(html);

  const courseCodeMatch = html.match(/Course\s*Code[:\s]*([A-Z]{2,5}\d{4})/i);
  const courseCode = courseCodeMatch ? courseCodeMatch[1] : '';

  const courseNameMatch = html.match(/Course\s*(?:Title|Name)[:\s]*([^<\n]+)/i);
  const courseName = courseNameMatch ? cleanText(courseNameMatch[1]) : '';

  const creditsMatch = html.match(/Credits?[:\s]*(\d+)/i);
  const credits = creditsMatch ? parseInt(creditsMatch[1]) : 0;

  const facultyMatch = html.match(/Faculty[:\s]*([^<\n]+)/i) ||
                       html.match(/Instructor[:\s]*([^<\n]+)/i);
  const faculty = facultyMatch ? cleanText(facultyMatch[1]) : '';

  const syllabus: CoursePageData['syllabus'] = [];
  const moduleMatches = html.matchAll(/Module\s*(\d+)[:\s]*([\s\S]*?)(?=Module\s*\d+|Course\s*Outcome|Reference|$)/gi);

  for (const match of moduleMatches) {
    const moduleNumber = parseInt(match[1]);
    const moduleContent = match[2];

    const titleMatch = moduleContent.match(/^[:\s]*([^\n<]+)/);
    const title = titleMatch ? cleanText(titleMatch[1]) : `Module ${moduleNumber}`;

    const topicMatches = moduleContent.matchAll(/(?:[-•]\s*|^\d+\.\s*)([^\n<]+)/gm);
    const topics = [...topicMatches].map(m => cleanText(m[1])).filter(t => t.length > 0);

    const hoursMatch = moduleContent.match(/(\d+)\s*(?:hours?|hrs?)/i);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;

    syllabus.push({ moduleNumber, title, topics, hours });
  }

  const outcomes: CoursePageData['outcomes'] = [];
  const outcomeSection = html.match(/Course\s*Outcome[s]?([\s\S]*?)(?=Reference|Textbook|Material|$)/i);

  if (outcomeSection) {
    const outcomeMatches = outcomeSection[1].matchAll(/(?:CO\s*)?(\d+)[.:\s]+([^\n<]+)/g);
    for (const match of outcomeMatches) {
      outcomes.push({ id: `CO${match[1]}`, description: cleanText(match[2]) });
    }
  }

  const referenceBooks: CoursePageData['referenceBooks'] = [];
  const refSection = html.match(/(?:Reference|Textbook)[s]?([\s\S]*?)(?=Material|Course\s*Page|$)/i);

  if (refSection) {
    const bookMatches = refSection[1].matchAll(/[-•\d.]\s*([^,\n<]+)(?:,\s*([^,\n<]+))?(?:,\s*([^,\n<]+))?/g);
    for (const match of bookMatches) {
      const title = cleanText(match[1]);
      if (title.length > 3) {
        referenceBooks.push({
          title,
          author: match[2] ? cleanText(match[2]) : '',
          publisher: match[3] ? cleanText(match[3]) : undefined,
        });
      }
    }
  }

  const materials: CoursePageData['materials'] = [];
  const materialMatches = html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi);

  for (const match of materialMatches) {
    const url = match[1];
    const title = cleanText(match[2]);

    if (title.toLowerCase().includes('back') || title.toLowerCase().includes('home')) continue;

    let type: 'pdf' | 'video' | 'link' | 'other' = 'link';
    if (url.includes('.pdf')) type = 'pdf';
    else if (url.includes('youtube') || url.includes('video')) type = 'video';

    materials.push({ title, type, url });
  }

  return { courseCode, courseName, credits, faculty, syllabus, outcomes, referenceBooks, materials };
}

export function parseMarksHTML(html: string, semesterId: string): MarksData {
  const $ = cheerio.load(html);
  const courses: MarksData['courses'] = [];

  // Extract semester name from dropdown
  const selectedOption = $('select#semesterSubId option[selected]').last();
  const semesterName = selectedOption.text().trim() || '';

  // Find main table - look for table with course data
  const mainTable = $('table.customTable').first();

  // Get all rows from the main table
  const rows = mainTable.find('> tr, > tbody > tr');

  rows.each((index, row) => {
    const $row = $(row);

    // Skip header rows
    if ($row.hasClass('tableHeader')) return;

    // Check if this is a course info row (has direct td children with course data)
    const cells = $row.find('> td');
    if (cells.length >= 7 && !$row.find('table').length) {
      // This is a course header row
      const courseCode = $(cells[2]).text().trim();
      const courseName = $(cells[3]).text().trim();
      const courseTypeRaw = $(cells[4]).text().trim();
      const faculty = $(cells[6]).text().trim();

      // Skip if it looks like a header
      if (courseCode.toLowerCase().includes('code')) return;

      // Map course type
      let classType: 'ETH' | 'ELA' | 'EPJ' | 'TH' = 'TH';
      const ctLower = courseTypeRaw.toLowerCase();
      if (ctLower.includes('embedded theory')) classType = 'ETH';
      else if (ctLower.includes('embedded lab') || ctLower.includes('lab only')) classType = 'ELA';
      else if (ctLower.includes('project')) classType = 'EPJ';

      // Find the next row which contains the marks table
      const nextRow = $row.next('tr');
      const marksTable = nextRow.find('table.customTable-level1');

      const marks: MarksData['courses'][0]['marks'] = [];
      let totalWeightedScore = 0;

      if (marksTable.length) {
        marksTable.find('tr.tableContent-level1').each((_, markRow) => {
          const markCells = $(markRow).find('td');
          if (markCells.length >= 7) {
            const examName = $(markCells[1]).text().trim();
            const maxMarks = parseFloat($(markCells[2]).text().trim()) || 0;
            const weightage = parseFloat($(markCells[3]).text().trim()) || 0;
            const statusText = $(markCells[4]).text().trim();
            const scoredMarksStr = $(markCells[5]).text().trim();

            // Skip header rows
            if (examName.toLowerCase().includes('mark title')) return;

            let status: 'graded' | 'pending' | 'absent' = 'pending';
            let scoredMarks: number | null = null;

            if (statusText.toLowerCase().includes('absent')) {
              status = 'absent';
              scoredMarks = 0;
            } else if (statusText.toLowerCase().includes('present')) {
              status = 'graded';
              scoredMarks = parseFloat(scoredMarksStr);
              if (isNaN(scoredMarks)) scoredMarks = null;
            }

            // Determine exam type
            let examType: MarksData['courses'][0]['marks'][0]['examType'] = 'DA';
            const examLower = examName.toLowerCase();
            if (examLower.includes('continuous assessment test') && examLower.includes('- i')) {
              examType = 'CAT1';
            } else if (examLower.includes('continuous assessment test') && examLower.includes('- ii')) {
              examType = 'CAT2';
            } else if (examLower.includes('final assessment')) {
              examType = 'FAT';
            } else if (examLower.includes('quiz')) {
              examType = 'QUIZ';
            } else if (examLower.includes('project')) {
              examType = 'PROJECT';
            }

            if (examName && maxMarks > 0) {
              marks.push({
                examType,
                examName,
                maxMarks,
                scoredMarks,
                weightage,
                status,
              });

              if (scoredMarks !== null && maxMarks > 0) {
                totalWeightedScore += (scoredMarks / maxMarks) * weightage;
              }
            }
          }
        });
      }

      if (courseCode && courseCode.length >= 3) {
        courses.push({
          courseCode,
          courseName,
          classType,
          faculty,
          marks,
          totalWeightedScore,
        });
      }
    }
  });

  return { semesterId, semesterName, courses };
}

const GRADE_POINTS: Record<string, number> = {
  'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5, 'F': 0, 'N': 0, 'W': 0,
};

export function parseGradesHTML(html: string, semesterId?: string): GradesData {
  const $ = cheerio.load(html);
  const semesters: GradesData['semesters'] = [];

  // Check for "No Records Found"
  if (html.toLowerCase().includes('no records found') || html.toLowerCase().includes('no record found')) {
    return {
      semesters: [],
      cgpa: 0,
      totalCreditsEarned: 0,
      totalCreditsRegistered: 0,
    };
  }

  // Get semester name from dropdown
  const selectedOption = $('select#semesterSubId option[selected]').last();
  const semesterName = selectedOption.text().trim() || '';

  const courses: GradesData['semesters'][0]['courses'] = [];
  let semesterCreditsRegistered = 0;
  let semesterCreditsEarned = 0;
  let semesterGradePoints = 0;
  let sgpa = 0;
  let cgpa = 0;

  // VTOP grades table structure:
  // Col 0: Sl.No.
  // Col 1: Course Code
  // Col 2: Course Title
  // Col 3: Course Type (e.g., "Embedded Theory and Lab", "Lab Only", "Online Course")
  // Col 4: L (Lecture credits)
  // Col 5: P (Practical credits)
  // Col 6: J (Project credits)
  // Col 7: C (Total Credits) - THIS IS THE ONE WE NEED
  // Col 8: Grading Type
  // Col 9: Grand Total (percentage)
  // Col 10: Grade
  // Col 11: View Mark (button)

  // Find all table rows
  $('table tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td');

    // Need at least 11 cells for a valid grade row
    if (cells.length < 11) return;

    // Extract cell values
    const cellTexts: string[] = [];
    cells.each((_, cell) => {
      cellTexts.push($(cell).text().trim());
    });

    // Check if this is a GPA row (contains "GPA :" or "SGPA")
    const rowText = cellTexts.join(' ');
    const gpaMatch = rowText.match(/(?:GPA|SGPA)\s*:\s*([0-9.]+)/i);
    if (gpaMatch) {
      sgpa = parseFloat(gpaMatch[1]) || 0;
      return;
    }

    // Skip header rows
    const firstCell = cellTexts[0].toLowerCase();
    if (firstCell.includes('sl') || firstCell.includes('code') || firstCell.includes('#')) {
      return;
    }

    // Column 1: Course Code (e.g., BACHY105, BCSE101)
    const courseCode = cellTexts[1]?.toUpperCase() || '';
    if (!courseCode || !/^[A-Z]{2,5}\d{3,4}[A-Z]?$/.test(courseCode)) {
      return;
    }

    // Column 2: Course Title
    const courseName = cellTexts[2] || '';

    // Column 3: Course Type
    const courseTypeRaw = cellTexts[3] || '';
    let classType: 'ETH' | 'ELA' | 'EPJ' | 'TH' = 'TH';
    const ctLower = courseTypeRaw.toLowerCase();
    if (ctLower.includes('embedded theory') && ctLower.includes('lab')) {
      classType = 'ETH';
    } else if (ctLower.includes('lab only') || ctLower.includes('embedded lab')) {
      classType = 'ELA';
    } else if (ctLower.includes('project')) {
      classType = 'EPJ';
    } else if (ctLower.includes('theory') || ctLower.includes('online')) {
      classType = 'TH';
    }

    // Column 7: Total Credits (C column) - This is the key fix!
    const creditsStr = cellTexts[7] || '';
    const credits = parseFloat(creditsStr) || 0;

    // Column 10: Grade
    const gradeStr = cellTexts[10] || '';
    const grade = /^[SABCDEFNW]$/.test(gradeStr.toUpperCase()) ? gradeStr.toUpperCase() : '';

    const gradePointValue = GRADE_POINTS[grade] || 0;

    courses.push({
      courseCode,
      courseName,
      classType,
      credits,
      grade,
      gradePoints: gradePointValue,
    });

    semesterCreditsRegistered += credits;
    if (grade && grade !== 'F' && grade !== 'N' && grade !== 'W') {
      semesterCreditsEarned += credits;
      semesterGradePoints += credits * gradePointValue;
    }
  });

  // Calculate SGPA from data if not found in page
  if (!sgpa && semesterCreditsEarned > 0) {
    sgpa = Math.round((semesterGradePoints / semesterCreditsEarned) * 100) / 100;
  }

  // Try to find CGPA in page text
  const pageText = $.text();
  const cgpaMatch = pageText.match(/CGPA[:\s]*([0-9.]+)/i);
  if (cgpaMatch) cgpa = parseFloat(cgpaMatch[1]) || 0;

  if (courses.length > 0) {
    semesters.push({
      semesterId: semesterId || '',
      semesterName,
      courses,
      sgpa,
      creditsRegistered: semesterCreditsRegistered,
      creditsEarned: semesterCreditsEarned,
    });
  }

  return {
    semesters,
    cgpa,
    totalCreditsEarned: semesterCreditsEarned,
    totalCreditsRegistered: semesterCreditsRegistered,
  };
}

export function parseExamScheduleHTML(html: string, semesterId: string): ExamScheduleData {
  const exams: ExamScheduleData['exams'] = [];

  html = normalizeHtml(html);

  const semesterNameMatch = html.match(/(?:Winter|Fall|Summer)\s+Semester\s+\d{4}-\d{2}/i);
  const semesterName = semesterNameMatch ? semesterNameMatch[0] : '';

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

  for (const category of categories) {
    const slots: ExamScheduleData['exams'][0]['slots'] = [];

    let sectionHtml = html;

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

      const courseCode = cells[0] || '';

      if (courseCode.toLowerCase().includes('code') || courseCode.toLowerCase().includes('course')) continue;
      if (!courseCode || courseCode.length < 3) continue;

      const courseName = cells[1] || '';
      const classTypeRaw = (cells[2] || 'TH').toUpperCase();
      const courseType = (['ETH', 'ELA', 'EPJ', 'TH'].includes(classTypeRaw) ? classTypeRaw : 'TH') as 'ETH' | 'ELA' | 'EPJ' | 'TH';
      const slot = cells[3] || '';

      let examDate = '';
      let day = '';
      let session: 'FN' | 'AN' = 'FN';
      let time = '';
      let venue = '';
      let seatNumber = '';

      for (const cell of cells) {
        if (/\d{1,2}[-/]\w{3}[-/]\d{2,4}/.test(cell) || /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(cell)) {
          examDate = cell;
        }
        if (/^(MON|TUE|WED|THU|FRI|SAT|SUN)$/i.test(cell)) {
          day = cell.toUpperCase();
        }
        if (/^(FN|AN|FORENOON|AFTERNOON)$/i.test(cell)) {
          session = cell.toUpperCase().startsWith('A') ? 'AN' : 'FN';
        }
        if (/\d{1,2}:\d{2}\s*(?:AM|PM)?/i.test(cell) && !time) {
          time = cell;
        }
        if (/^[A-Z]{2,4}[-\s]?\d{3}/i.test(cell)) {
          venue = cell;
        }
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

export function parseProfileHTML(html: string): ProfileData {
  const DEBUG = process.env.VTOP_DEBUG === 'true';

  // Helper to extract field value from HTML using multiple patterns
  const extractField = (searchHtml: string, labels: string[]): string => {
    for (const label of labels) {
      const patterns = [
        // Standard table format: <td>LABEL</td><td>VALUE</td>
        new RegExp(`<td[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*>\\s*([^<]+)`, 'i'),
        // With colspan
        new RegExp(`<td[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*colspan[^>]*>\\s*([^<]+)`, 'i'),
        // th/td format
        new RegExp(`<th[^>]*>\\s*${label}\\s*</th>\\s*<td[^>]*>\\s*([^<]+)`, 'i'),
        // Label/value in divs or spans
        new RegExp(`${label}[:\\s]*</(?:label|span|div|td|th)>\\s*<(?:label|span|div|td)[^>]*>\\s*([^<]+)`, 'i'),
        // Colon separated inline (be more specific to avoid header matches)
        new RegExp(`>${label}\\s*:\\s*</[^>]+>\\s*<[^>]+>\\s*([^<]+)`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = searchHtml.match(pattern);
        if (match && match[1]) {
          const value = cleanText(match[1]);
          // Filter out section headers and invalid values
          if (value &&
              value !== '-' &&
              value !== 'N/A' &&
              value !== 'NIL' &&
              value !== 'null' &&
              value.length > 0 &&
              value.length < 200 && // Reasonable length limit
              !value.toUpperCase().includes('INFORMATION') &&
              !value.toUpperCase().includes('DETAILS') &&
              !value.toUpperCase().includes('SECTION') &&
              !/^\s*$/.test(value)) {
            return value;
          }
        }
      }
    }
    return '';
  };

  // Find all tables/cards in the HTML and categorize them
  const findSectionByHeader = (headers: string[]): string => {
    for (const header of headers) {
      // Look for card/panel with this header
      const cardPattern = new RegExp(
        `(?:<div[^>]*class="[^"]*card[^"]*"[^>]*>|<div[^>]*>)\\s*[\\s\\S]*?${header}[\\s\\S]*?(?=<div[^>]*class="[^"]*card|$)`,
        'i'
      );
      const cardMatch = html.match(cardPattern);
      if (cardMatch) return cardMatch[0];

      // Look for table section
      const tablePattern = new RegExp(
        `${header}[\\s\\S]*?<table[^>]*>([\\s\\S]*?)</table>`,
        'i'
      );
      const tableMatch = html.match(tablePattern);
      if (tableMatch) return tableMatch[0];

      // Generic section (header to next major header)
      const sectionPattern = new RegExp(
        `${header}[\\s\\S]*?(?=(?:PERSONAL|FAMILY|PARENT|PROCTOR|FACULTY\\s*ADVISOR|FA\\s*DETAILS|HOSTEL|ADDRESS)\\s*(?:INFORMATION|DETAILS)|$)`,
        'i'
      );
      const sectionMatch = html.match(sectionPattern);
      if (sectionMatch && sectionMatch[0].length > 50) return sectionMatch[0];
    }
    return '';
  };

  // Get sections
  const familySection = findSectionByHeader(['FAMILY\\s*(?:INFORMATION|DETAILS)', 'PARENT[S\']?\\s*(?:INFORMATION|DETAILS)']);
  const proctorSection = findSectionByHeader(['PROCTOR\\s*(?:INFORMATION|DETAILS)', 'FA\\s*(?:INFORMATION|DETAILS)', 'FACULTY\\s*ADVISOR\\s*(?:INFORMATION|DETAILS)']);
  const hostelSection = findSectionByHeader(['HOSTEL\\s*(?:INFORMATION|DETAILS)']);
  const addressSection = findSectionByHeader(['(?:PERMANENT\\s*)?ADDRESS\\s*(?:INFORMATION|DETAILS)?']);

  if (DEBUG) {
    console.log('[Profile Parser] Section lengths:', {
      family: familySection.length,
      proctor: proctorSection.length,
      hostel: hostelSection.length,
      address: addressSection.length,
    });
  }

  // Extract registration number from header area
  const regNoMatch = html.match(/REGISTER\s*(?:NUMBER|NO)[.:\s]*<\/label>\s*<label[^>]*>(\d{2}[A-Z]{2,4}\d{4,5})/i) ||
                     html.match(/Registration\s*(?:Number|No)[.:\s]*(\d{2}[A-Z]{2,4}\d{4,5})/i) ||
                     html.match(/(\d{2}[A-Z]{2,4}\d{4,5})/);
  const registrationNumber = regNoMatch ? regNoMatch[1] : '';

  // VIT email
  const vitEmailMatch = html.match(/VIT\s*EMAIL[:\s]*<\/label>\s*<label[^>]*>([a-zA-Z0-9._%+-]+@vitstudent\.ac\.in)/i) ||
                        html.match(/([a-zA-Z0-9._%+-]+@vitstudent\.ac\.in)/i);
  const vitEmail = vitEmailMatch ? vitEmailMatch[1] : '';

  // Program and school from header
  const programMatch = html.match(/PROGRAM\s*(?:&amp;|&|AND)\s*BRANCH[:\s]*<\/label>\s*<label[^>]*>([^<]+)/i);
  const programBranch = programMatch ? cleanText(programMatch[1]) : '';

  const schoolMatch = html.match(/SCHOOL\s*(?:NAME)?[:\s]*<\/label>\s*<label[^>]*>([^<]+)/i);
  const school = schoolMatch ? cleanText(schoolMatch[1]) : '';

  // Student name from photo area or header
  const nameMatch = html.match(/<img[^>]*class="img[^>]*>[\s\S]*?<p[^>]*>([A-Z][A-Z\s]+)<\/p>/i) ||
                    html.match(/<p[^>]*style="[^"]*text-align:\s*center[^"]*font-weight:\s*bold[^"]*">([A-Z][A-Z\s]+)<\/p>/i);
  const studentName = nameMatch ? nameMatch[1].trim() : '';

  // Photo
  const photoMatch = html.match(/src="(data:(?:null|image\/[^"]+);base64,[^"]+)"/i);
  const photoUrl = photoMatch ? photoMatch[1] : undefined;

  // Personal info extraction - search full HTML
  const personalName = extractField(html, ['STUDENT\\s*NAME', 'NAME']) || studentName;
  const applicationNumber = extractField(html, ['APPLICATION\\s*(?:NUMBER|NO)', 'APPL(?:ICATION)?\\s*NO']);
  const dateOfBirth = extractField(html, ['DATE\\s*OF\\s*BIRTH', 'DOB', 'D\\.O\\.B']);
  const gender = extractField(html, ['GENDER', 'SEX']);
  const bloodGroup = extractField(html, ['BLOOD\\s*GROUP', 'BLOOD\\s*TYPE']);
  const mobileNumber = extractField(html, ['MOBILE\\s*(?:NUMBER|NO)?', 'PHONE\\s*(?:NUMBER|NO)?', 'CONTACT\\s*(?:NUMBER|NO)?']);
  const nationality = extractField(html, ['NATIONALITY', 'NATION']);
  const personalEmail = extractField(html, ['PERSONAL\\s*EMAIL', 'EMAIL\\s*ID']);

  // Address - search full HTML or address section
  const searchAddr = addressSection || html;
  const streetName = extractField(searchAddr, ['STREET\\s*(?:NAME)?']);
  const areaName = extractField(searchAddr, ['AREA\\s*(?:NAME)?', 'LOCALITY']);
  const city = extractField(searchAddr, ['CITY', 'TOWN']);
  const state = extractField(searchAddr, ['STATE', 'PROVINCE']);
  const pincode = extractField(searchAddr, ['PINCODE', 'PIN\\s*CODE', 'ZIP\\s*(?:CODE)?', 'POSTAL\\s*CODE']);
  const address = [streetName, areaName, city, state, pincode].filter(Boolean).join(', ');

  // Family info - Father section
  const fatherSection = html.match(/FATHER\s*DETAILS[\s\S]*?(?=MOTHER\s*DETAILS|$)/i)?.[0] || '';
  const fatherName = extractField(fatherSection || html, ["FATHER\\s*NAME"]);
  const fatherOccupation = extractField(fatherSection || html, ["OCCUPATION"]);
  const fatherPhone = extractField(fatherSection || html, ["MOBILE\\s*NUMBER"]);

  // Family info - Mother section
  const motherSection = html.match(/MOTHER\s*DETAILS[\s\S]*?(?=GUARDIAN|$)/i)?.[0] || '';
  const motherName = motherSection ? extractField(motherSection, ["^NAME"]) : '';
  const motherOccupation = motherSection ? extractField(motherSection, ["OCCUPATION"]) : '';
  const motherPhone = motherSection ? extractField(motherSection, ["MOBILE\\s*NUMBER"]) : '';

  const guardianName = extractField(html, ["GUARDIAN\\s*INFO"]);
  const guardianPhone = '';

  // Proctor/FA info - look for FACULTY fields in proctor section
  const proctorName = extractField(proctorSection || html, ['FACULTY\\s*NAME']);
  const proctorEmail = extractField(proctorSection || html, ['FACULTY\\s*EMAIL']);
  const proctorPhone = extractField(proctorSection || html, ['FACULTY\\s*MOBILE\\s*NUMBER']);
  const cabin = extractField(proctorSection || html, ['CABIN']);

  // Hostel info - only if hostel section exists
  const hasHostel = hostelSection.length > 50; // Must have substantial content, not just header

  // Hostel fields - only extract if we have a real hostel section
  const blockName = hasHostel ? extractField(hostelSection, ['BLOCK\\s*NAME']) : '';
  const roomNumber = hasHostel ? extractField(hostelSection, ['ROOM\\s*NO\\.?']) : '';
  const bedType = hasHostel ? extractField(hostelSection, ['BED\\s*TYPE']) : '';
  // Use block name as hostel name since there's no separate field
  const hostelName = blockName;

  if (DEBUG) {
    console.log('[Profile Parser] Extracted values:', {
      fatherName, motherName, proctorName,
      hostelName, roomNumber, blockName,
    });
  }

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
      branch: '',
      admissionYear: '',
      expectedGraduation: '',
    },
    family: {
      fatherName,
      fatherOccupation: fatherOccupation || undefined,
      fatherPhone: fatherPhone || undefined,
      motherName,
      motherOccupation: motherOccupation || undefined,
      motherPhone: motherPhone || undefined,
      guardianName: guardianName || undefined,
      guardianPhone: guardianPhone || undefined,
    },
    proctor: {
      name: proctorName,
      email: proctorEmail,
      phone: proctorPhone || undefined,
      cabin: cabin || undefined,
    },
    hostel: hasHostel ? {
      hostelName,
      roomNumber,
      blockName,
      bedNumber: bedType || undefined,
    } : undefined,
    photoUrl,
  };
}

/** Calculate classes needed to reach target percentage */
export function calculateClassesNeeded(attended: number, total: number, targetPercentage: number): number {
  const target = targetPercentage / 100;
  if (target >= 1) return Infinity;
  const needed = Math.ceil((target * total - attended) / (1 - target));
  return Math.max(0, needed);
}

/** Calculate classes that can be skipped while maintaining target */
export function calculateClassesCanSkip(attended: number, total: number, targetPercentage: number): number {
  const target = targetPercentage / 100;
  if (target <= 0) return Infinity;
  const canSkip = Math.floor((attended / target) - total);
  return Math.max(0, canSkip);
}
