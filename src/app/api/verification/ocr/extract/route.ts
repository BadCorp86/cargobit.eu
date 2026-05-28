import { NextRequest, NextResponse } from 'next/server';
import { extractDocumentOcr } from '@/services/verification/ocr.service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          {
            success: false,
            error: 'FILE_REQUIRED',
            message: 'file is required',
          },
          { status: 400 },
        );
      }

      const ocr = await extractDocumentOcr({
        file,
        mimeType: file.type,
        fileName: file.name,
        documentType: formData.get('documentType') as string,
        language: (formData.get('language') as string) || undefined,
      });

      return NextResponse.json({
        success: ocr.status === 'completed' || ocr.status === 'partial',
        ocr,
      });
    }

    const body = await request.json();
    const ocr = await extractDocumentOcr({
      fileBase64: body.fileBase64,
      documentUrl: body.documentUrl,
      mimeType: body.mimeType,
      fileName: body.fileName,
      documentType: body.documentType,
      language: body.language,
      maxPdfPages: body.maxPdfPages,
    });

    return NextResponse.json({
      success: ocr.status === 'completed' || ocr.status === 'partial',
      ocr,
    });
  } catch (error) {
    console.error('[VerificationOcrAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'OCR_EXTRACTION_FAILED',
        message: error instanceof Error ? error.message : 'OCR extraction failed',
      },
      { status: 500 },
    );
  }
}
