/**
 * HTML parsing functions for VTOP responses.
 * Separates parsing logic from the HTTP client for maintainability.
 */

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
  const semesters: Semester[] = [];

  const selectMatch = html.match(/<select[^>]*id="semesterSubId"[^>]*>([\s\S]*?)<\/select>/i);
  const selectHtml = selectMatch ? selectMatch[1] : html;

  const optionRegex = /<option[^>]*value="([^"]*)"[^>]*>([^<]+)<\/option>/gi;
  let match;

  while ((match = optionRegex.exec(selectHtml)) !== null) {
    const [fullMatch, id, name] = match;
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

export function parseAttendanceHTML(html: string, semesterId: string): AttendanceData {
  const entries: AttendanceEntry[] = [];

  const semesterNameMatch = html.match(/Winter Semester \d{4}-\d{2}|Fall Semester \d{4}-\d{2}/i);
  const semesterName = semesterNameMatch ? semesterNameMatch[0] : '';

  html = normalizeHtml(html);

  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return { semesterId, semesterName, entries, lastUpdated: new Date().toISOString() };
  }

  const rowsHtml = tbodyMatch[1].split('</tr>').filter(r => r.includes('<tr>'));

  for (const rowHtml of rowsHtml) {
    const row = rowHtml + '</tr>';

    // Extract class type from onclick - most reliable source
    const onclickMatch = row.match(/callStudentAttendanceDetailDisplay\([^)]*,\s*(?:'|&#39;)([A-Z]+)(?:'|&#39;)\s*\)/);
    const classType = (onclickMatch ? onclickMatch[1] : 'TH') as 'ETH' | 'ELA' | 'EPJ' | 'SS' | 'TH';

    const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const cells = cellMatches.map(m => cleanText(m[1]));

    // VTOP table: [slNo, classGroup, courseDetail, classDetail, facultyDetail, attended, total, percentage, debarStatus, link]
    if (cells.length < 10) continue;

    const courseDetailParts = cells[2].split(' - ').map(s => s.trim());
    if (courseDetailParts.length < 2) continue;

    const courseCode = courseDetailParts[0];
    const courseName = courseDetailParts.length > 2
      ? courseDetailParts.slice(1, -1).join(' - ')
      : courseDetailParts[1];

    const classDetailParts = cells[3].split(' - ').map(s => s.trim());
    const slot = classDetailParts.length >= 2 ? classDetailParts[1] : '';

    const facultyParts = cells[4].split(' - ').map(s => s.trim());
    const faculty = facultyParts[0];

    const attendedMatch = cells[5].match(/(\d+)/);
    const totalMatch = cells[6].match(/(\d+)/);
    const attended = attendedMatch ? parseInt(attendedMatch[1]) : 0;
    const total = totalMatch ? parseInt(totalMatch[1]) : 0;

    const percentageMatch = cells[7].match(/(\d+)%/);
    const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 0;

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
  const categories: CurriculumData['categories'] = [];
  let totalRequiredCredits = 0;
  let totalEarnedCredits = 0;

  html = normalizeHtml(html);

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
    let earnedCredits = 0;

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
          earnedCredits += credits;
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
        earnedCredits,
        courses,
      });

      totalRequiredCredits += categoryCredits;
      totalEarnedCredits += earnedCredits;
    }
  }

  return { totalRequiredCredits, totalEarnedCredits, categories };
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
  const courses: MarksData['courses'] = [];

  html = normalizeHtml(html);

  const semesterNameMatch = html.match(/(?:Winter|Fall|Summer)\s+Semester\s+\d{4}-\d{2}/i);
  const semesterName = semesterNameMatch ? semesterNameMatch[0] : '';

  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return { semesterId, semesterName, courses };
  }

  const rows = tbodyMatch[1].split('</tr>').filter(r => r.includes('<tr'));
  let currentCourse: MarksData['courses'][0] | null = null;

  for (const rowHtml of rows) {
    const row = rowHtml + '</tr>';
    const cellMatches = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    const cells = cellMatches.map(m => cleanText(m[1]));

    if (cells.length < 8) continue;

    const courseCode = cells[1] || '';
    const courseTitle = cells[2] || '';

    if (courseCode.toLowerCase().includes('code') || courseTitle.toLowerCase().includes('title')) continue;
    if (!courseCode || courseCode.length < 3) continue;

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

    const assessmentName = cells[6] || cells[4] || '';
    const maxMarksStr = cells[7] || cells[5] || '0';
    const weightageStr = cells[8] || cells[6] || '0';
    const statusOrScore = cells[10] || cells[11] || cells[9] || '';
    const scoredMarksStr = cells[11] || cells[10] || cells[8] || '';

    const maxMarks = parseFloat(maxMarksStr) || 0;
    const weightage = parseFloat(weightageStr) || 0;

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

      if (scoredMarks !== null && maxMarks > 0) {
        currentCourse.totalWeightedScore += (scoredMarks / maxMarks) * weightage;
      }
    }
  }

  if (currentCourse) {
    courses.push(currentCourse);
  }

  return { semesterId, semesterName, courses };
}

const GRADE_POINTS: Record<string, number> = {
  'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5, 'F': 0, 'N': 0, 'W': 0,
};

export function parseGradesHTML(html: string): GradesData {
  const semesters: GradesData['semesters'] = [];
  let cgpa = 0;
  let totalCreditsEarned = 0;
  let totalCreditsRegistered = 0;

  html = normalizeHtml(html);

  const cgpaMatch = html.match(/CGPA[:\s]*([0-9.]+)/i) ||
                    html.match(/Cumulative[^<]*GPA[:\s]*([0-9.]+)/i);
  if (cgpaMatch) {
    cgpa = parseFloat(cgpaMatch[1]) || 0;
  }

  const totalRegisteredMatch = html.match(/(?:Total\s+)?Credits?\s+Registered[:\s]*(\d+)/i);
  const totalEarnedMatch = html.match(/(?:Total\s+)?Credits?\s+Earned[:\s]*(\d+)/i);

  if (totalRegisteredMatch) totalCreditsRegistered = parseInt(totalRegisteredMatch[1]) || 0;
  if (totalEarnedMatch) totalCreditsEarned = parseInt(totalEarnedMatch[1]) || 0;

  const tables = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);

  for (const tableMatch of tables) {
    const tableHtml = tableMatch[1];

    if (!tableHtml.toLowerCase().includes('grade') && !tableHtml.toLowerCase().includes('credit')) continue;

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

      const semesterInRow = cells.join(' ').match(/(?:Winter|Fall|Summer)\s+(?:Semester\s+)?(\d{4}-\d{2})/i);
      if (semesterInRow && courses.length > 0) {
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

      const courseCode = cells[0] || cells[1] || '';

      if (courseCode.toLowerCase().includes('code') ||
          courseCode.toLowerCase().includes('total') ||
          courseCode.toLowerCase().includes('cgpa')) continue;

      let grade = '';
      let credits = 0;
      let courseTitle = '';
      let courseType: 'ETH' | 'ELA' | 'EPJ' | 'TH' = 'TH';

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (/^[SABCDEFNW]$/.test(cell)) {
          grade = cell;
        }
        const num = parseFloat(cell);
        if (!isNaN(num) && num >= 1 && num <= 10 && !credits) {
          credits = num;
        }
        if (['ETH', 'ELA', 'EPJ', 'TH', 'LO'].includes(cell.toUpperCase())) {
          courseType = cell.toUpperCase() as 'ETH' | 'ELA' | 'EPJ' | 'TH';
        }
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
  const extractTableField = (label: string): string => {
    const patterns = [
      new RegExp(`<td[^>]*>${label}</td>\\s*<td[^>]*>([^<]*)`, 'i'),
      new RegExp(`<td[^>]*>${label.replace(/['\s]/g, '[^>]*')}</td>\\s*<td[^>]*>([^<]*)`, 'i'),
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

  const nameMatch = html.match(/<img[^>]*class="img[^>]*>[\s\S]*?<p[^>]*>([A-Z][A-Z\s]+)<\/p>/i) ||
                    html.match(/<p[^>]*style="[^"]*text-align:\s*center[^"]*font-weight:\s*bold[^"]*">([A-Z][A-Z\s]+)<\/p>/i);
  const studentName = nameMatch ? nameMatch[1].trim() : '';

  const photoMatch = html.match(/src="(data:(?:null|image\/[^"]+);base64,[^"]+)"/i);
  const photoUrl = photoMatch ? photoMatch[1] : undefined;

  const personalName = extractTableField('STUDENT NAME') || studentName;
  const applicationNumber = extractTableField('APPLICATION NUMBER');
  const dateOfBirth = extractTableField('DATE OF BIRTH');
  const gender = extractTableField('GENDER');
  const bloodGroup = extractTableField('BLOOD GROUP');
  const mobileNumber = extractTableField('MOBILE NUMBER');
  const nationality = extractTableField('NATIONALITY');
  const personalEmail = extractTableField('EMAIL');

  const streetName = extractTableField('STREET NAME');
  const areaName = extractTableField('AREA NAME');
  const city = extractTableField('CITY');
  const state = extractTableField('STATE');
  const pincode = extractTableField('PINCODE');
  const address = [streetName, areaName, city, state, pincode].filter(Boolean).join(', ');

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
      branch: '',
      admissionYear: '',
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
