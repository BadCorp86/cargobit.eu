import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import type { SubmittedDocumentType } from '@/services/verification-workflow.service';

export type OcrExtractionStatus = 'completed' | 'partial' | 'skipped' | 'failed';
export type OcrExtractionSource = 'image_ocr' | 'pdf_text' | 'pdf_page_ocr';

export interface OcrExtractedFields {
  vatNumbers: string[];
  documentNumbers: string[];
  dates: string[];
  expiryDate?: string;
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence?: number;
  source: OcrExtractionSource;
}

export interface DocumentOcrExtraction {
  status: OcrExtractionStatus;
  source: OcrExtractionSource;
  language: string;
  text: string;
  confidence?: number;
  pageCount?: number;
  pages: OcrPageResult[];
  extractedFields: OcrExtractedFields;
  warnings: string[];
  error?: string;
}

export interface DocumentOcrInput {
  buffer?: Buffer;
  file?: File;
  fileBase64?: string;
  documentUrl?: string;
  mimeType?: string;
  fileName?: string;
  documentType?: SubmittedDocumentType | string;
  language?: string;
  maxPdfPages?: number;
}

const OCR_MIN_TEXT_LENGTH = 24;

export async function extractDocumentOcr(input: DocumentOcrInput): Promise<DocumentOcrExtraction> {
  if (process.env.OCR_ENABLED === 'false') {
    return emptyOcrResult('skipped', 'image_ocr', input.language, ['OCR ist per Environment Variable deaktiviert.']);
  }

  try {
    const buffer = await loadDocumentBuffer(input);
    const mimeType = detectMimeType(input.mimeType, input.fileName, buffer);
    const language = input.language || process.env.OCR_LANG || 'deu+eng';

    if (!buffer) {
      return emptyOcrResult('skipped', 'image_ocr', language, ['Keine Datei fuer OCR uebergeben.']);
    }

    if (mimeType === 'application/pdf') {
      return extractPdfOcr({
        buffer,
        language,
        maxPdfPages: input.maxPdfPages || Number(process.env.OCR_MAX_PDF_PAGES || 2),
      });
    }

    if (mimeType.startsWith('image/')) {
      return extractImageOcr(buffer, language);
    }

    return emptyOcrResult('skipped', 'image_ocr', language, [
      `Dateityp ${mimeType || 'unbekannt'} wird fuer OCR noch nicht unterstuetzt.`,
    ]);
  } catch (error) {
    return {
      ...emptyOcrResult('failed', 'image_ocr', input.language),
      error: error instanceof Error ? error.message : 'OCR fehlgeschlagen.',
    };
  }
}

export async function extractDocumentOcrFromFile(
  file: File,
  input: Omit<DocumentOcrInput, 'file' | 'mimeType' | 'fileName'> = {},
) {
  return extractDocumentOcr({
    ...input,
    file,
    mimeType: file.type,
    fileName: file.name,
  });
}

async function extractImageOcr(buffer: Buffer, language: string): Promise<DocumentOcrExtraction> {
  const sharp = (await import('sharp')).default;
  const { createWorker } = await import('tesseract.js');
  const processed = await sharp(buffer)
    .rotate()
    .resize({ width: 2400, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();

  const worker = await createWorker(language, 1, {
    workerPath: path.join(process.cwd(), 'node_modules/tesseract.js/src/worker-script/node/index.js'),
    corePath: path.join(process.cwd(), 'node_modules/tesseract.js-core'),
    langPath: process.env.OCR_LANG_PATH,
    cachePath: process.env.OCR_CACHE_PATH || path.join('/tmp', 'cargobit-ocr-cache'),
  });

  try {
    const result = await worker.recognize(processed);
    const text = sanitizeOcrText(result.data.text);
    const confidence = Math.round(result.data.confidence || 0);

    return {
      status: text.length >= OCR_MIN_TEXT_LENGTH ? 'completed' : 'partial',
      source: 'image_ocr',
      language,
      text,
      confidence,
      pageCount: 1,
      pages: [{ pageNumber: 1, text, confidence, source: 'image_ocr' }],
      extractedFields: extractFieldsFromText(text),
      warnings: text.length >= OCR_MIN_TEXT_LENGTH ? [] : ['OCR hat nur wenig Text erkannt.'],
    };
  } finally {
    await worker.terminate();
  }
}

async function extractPdfOcr(input: {
  buffer: Buffer;
  language: string;
  maxPdfPages: number;
}): Promise<DocumentOcrExtraction> {
  const { PDFParse } = await import('pdf-parse');
  PDFParse.setWorker(path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'));
  const parser = new PDFParse({ data: input.buffer });

  try {
    const textResult = await parser.getText({
      first: input.maxPdfPages,
      pageJoiner: '\n',
    });
    const text = sanitizeOcrText(textResult.text || '');

    if (text.length >= OCR_MIN_TEXT_LENGTH) {
      return {
        status: 'completed',
        source: 'pdf_text',
        language: input.language,
        text,
        pageCount: textResult.total,
        pages: textResult.pages.map((page: any) => ({
          pageNumber: page.num,
          text: sanitizeOcrText(page.text || ''),
          source: 'pdf_text' as const,
        })),
        extractedFields: extractFieldsFromText(text),
        warnings: textResult.total > input.maxPdfPages
          ? [`Nur die ersten ${input.maxPdfPages} PDF-Seiten wurden ausgewertet.`]
          : [],
      };
    }

    const screenshots = await parser.getScreenshot({
      first: input.maxPdfPages,
      imageBuffer: true,
      imageDataUrl: false,
      desiredWidth: 1800,
    });
    const pageResults: OcrPageResult[] = [];

    for (const page of screenshots.pages) {
      const pageOcr = await extractImageOcr(Buffer.from(page.data), input.language);
      pageResults.push({
        pageNumber: page.pageNumber,
        text: pageOcr.text,
        confidence: pageOcr.confidence,
        source: 'pdf_page_ocr',
      });
    }

    const pageText = sanitizeOcrText(pageResults.map((page) => page.text).join('\n\n'));
    const confidenceValues = pageResults
      .map((page) => page.confidence)
      .filter((value): value is number => typeof value === 'number');

    return {
      status: pageText.length >= OCR_MIN_TEXT_LENGTH ? 'completed' : 'partial',
      source: 'pdf_page_ocr',
      language: input.language,
      text: pageText,
      confidence: confidenceValues.length
        ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
        : undefined,
      pageCount: screenshots.total,
      pages: pageResults,
      extractedFields: extractFieldsFromText(pageText),
      warnings: [
        'PDF enthielt wenig eingebetteten Text; OCR wurde auf gerenderten Seiten ausgefuehrt.',
        ...(screenshots.total > input.maxPdfPages ? [`Nur die ersten ${input.maxPdfPages} PDF-Seiten wurden per OCR ausgewertet.`] : []),
      ],
    };
  } finally {
    await parser.destroy();
  }
}

async function loadDocumentBuffer(input: DocumentOcrInput): Promise<Buffer | undefined> {
  if (input.buffer) return input.buffer;

  if (input.file) {
    return Buffer.from(await input.file.arrayBuffer());
  }

  if (input.fileBase64) {
    const base64 = input.fileBase64.includes(',')
      ? input.fileBase64.split(',').pop() || ''
      : input.fileBase64;
    return Buffer.from(base64, 'base64');
  }

  if (!input.documentUrl) return undefined;

  if (input.documentUrl.startsWith('http://') || input.documentUrl.startsWith('https://')) {
    const response = await fetch(input.documentUrl);
    if (!response.ok) {
      throw new Error(`Dokument konnte nicht geladen werden: HTTP ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  const localPath = resolveLocalDocumentPath(input.documentUrl);
  if (!localPath || !existsSync(localPath)) {
    throw new Error(`Lokale Datei nicht gefunden: ${input.documentUrl}`);
  }

  return readFile(localPath);
}

function resolveLocalDocumentPath(documentUrl: string) {
  const cleanPath = documentUrl.split('?')[0];
  const withoutLeadingSlash = cleanPath.replace(/^\/+/, '');

  if (withoutLeadingSlash.startsWith('uploads/')) {
    return path.join(process.cwd(), withoutLeadingSlash);
  }

  if (withoutLeadingSlash.startsWith('upload/')) {
    return path.join(process.cwd(), withoutLeadingSlash);
  }

  if (withoutLeadingSlash.startsWith('public/')) {
    return path.join(process.cwd(), withoutLeadingSlash);
  }

  return undefined;
}

function detectMimeType(mimeType?: string, fileName?: string, buffer?: Buffer) {
  if (mimeType) return mimeType.toLowerCase();

  if (buffer?.subarray(0, 4).toString() === '%PDF') return 'application/pdf';

  const normalizedName = (fileName || '').toLowerCase();
  if (normalizedName.endsWith('.pdf')) return 'application/pdf';
  if (normalizedName.endsWith('.png')) return 'image/png';
  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) return 'image/jpeg';
  if (normalizedName.endsWith('.webp')) return 'image/webp';

  return 'application/octet-stream';
}

function extractFieldsFromText(text: string): OcrExtractedFields {
  const vatNumbers = uniqueMatches(text, /\b[A-Z]{2}\s?[A-Z0-9]{8,14}\b/g)
    .map((value) => value.replace(/\s/g, ''));
  const documentNumbers = uniqueMatches(
    text,
    /\b(?:HRB|HRA|UST-?ID|VAT|NR\.?|NO\.?|NUMMER|LICENSE|LIZENZ)\s*[:#.-]?\s*([A-Z0-9/-]{4,24})\b/gi,
    1,
  );
  const dates = uniqueMatches(
    text,
    /\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g,
  ).map(normalizeDate).filter(Boolean) as string[];

  return {
    vatNumbers,
    documentNumbers,
    dates,
    expiryDate: extractExpiryDate(text),
  };
}

function extractExpiryDate(text: string) {
  const expiryMatch = text.match(
    /(?:gueltig bis|gültig bis|valid until|expires|ablaufdatum|expiry date)\s*[:#.-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  );

  return expiryMatch ? normalizeDate(expiryMatch[1]) : undefined;
}

function uniqueMatches(text: string, regex: RegExp, group = 0) {
  return Array.from(text.matchAll(regex))
    .map((match) => match[group])
    .filter(Boolean)
    .map((match) => match.trim())
    .filter((value, index, list) => list.indexOf(value) === index);
}

function normalizeDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const parts = value.split(/[./-]/);
  if (parts.length !== 3) return undefined;

  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];

  return `${year}-${month}-${day}`;
}

function sanitizeOcrText(text: string) {
  return text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

function emptyOcrResult(
  status: OcrExtractionStatus,
  source: OcrExtractionSource,
  language = process.env.OCR_LANG || 'deu+eng',
  warnings: string[] = [],
): DocumentOcrExtraction {
  return {
    status,
    source,
    language,
    text: '',
    pages: [],
    extractedFields: {
      vatNumbers: [],
      documentNumbers: [],
      dates: [],
    },
    warnings,
  };
}
