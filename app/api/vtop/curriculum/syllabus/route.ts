import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedClient, apiError } from '@/lib/api-utils';

/**
 * GET /api/vtop/curriculum/syllabus?courseCode=BACHY101
 * Download course syllabus PDF
 */
export async function GET(request: NextRequest) {
  const courseCode = request.nextUrl.searchParams.get('courseCode');

  if (!courseCode) {
    return apiError('VALIDATION_ERROR', 'courseCode is required', 400);
  }

  return withAuthenticatedClient(async ({ client }) => {
    const { data, contentType } = await client.getCourseSyllabus(courseCode);

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${courseCode}_syllabus.pdf"`,
      },
    });
  });
}
