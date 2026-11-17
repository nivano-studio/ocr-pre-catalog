import { createWorker, type Worker } from 'tesseract.js';
import type { OcrStatus } from '../domain/book';

export interface OcrRecognitionOptions {
  manualAngle?: number;
}

export interface OcrLine {
  text: string;
  raw?: string;
  box?: [number, number, number, number];
  conf?: number;
}

export interface OcrRecognitionResult {
  text: string;
  rawText?: string;
  suggestedTitle?: string;
  confidence: number;
  status?: OcrStatus;
  selectedAngle?: number;
  engine?: 'rapidocr' | 'tesseract' | 'mock';
  lines?: OcrLine[];
}

export interface IOcrService {
  recognize(
    imageInput: Blob | File | string | Buffer,
    onProgress?: (progress: number) => void,
    options?: OcrRecognitionOptions
  ): Promise<OcrRecognitionResult>;
  terminate(): Promise<void>;
  checkHealth?(): Promise<{ online: boolean; engine?: string }>;
}

export interface TesseractServiceOptions {
  workerPath?: string;
  corePath?: string;
  langPath?: string;
  gzip?: boolean;
}

export class TesseractOcrService implements IOcrService {
  private worker: Worker | null = null;
  private isInitializing = false;
  private options: TesseractServiceOptions;

  constructor(options?: TesseractServiceOptions) {
    this.options = options || {};
  }

  private async getWorker(onProgress?: (progress: number) => void): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (this.worker) return this.worker;
    }

    this.isInitializing = true;
    try {
      const isBrowser = typeof window !== 'undefined';
      const workerPath = this.options.workerPath ?? (isBrowser ? '/tesseract/worker.min.js' : undefined);
      const corePath = this.options.corePath ?? (isBrowser ? '/tesseract/tesseract-core-simd-lstm.wasm.js' : undefined);
      const langPath = this.options.langPath ?? (isBrowser ? '/tesseract' : undefined);

      const worker = await createWorker('por', 1, {
        workerPath,
        corePath,
        langPath,
        gzip: this.options.gzip ?? true,
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        },
      });

      this.worker = worker;
      return this.worker;
    } finally {
      this.isInitializing = false;
    }
  }

  async recognize(
    imageInput: Blob | File | string | Buffer,
    onProgress?: (progress: number) => void
  ): Promise<OcrRecognitionResult> {
    const worker = await this.getWorker(onProgress);
    const result = await worker.recognize(imageInput as Parameters<Worker['recognize']>[0]);
    const rawText = result.data.text ? result.data.text.trim() : '';
    const conf = result.data.confidence;

    // Extrai primeira linha substancial como título sugerido provisório
    const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
    const suggestedTitle = lines.length > 0 ? lines[0] : rawText;

    const status: OcrStatus = conf >= 75 ? 'reliable' : conf >= 50 ? 'needs_review' : 'failed';

    return {
      text: rawText,
      rawText,
      suggestedTitle,
      confidence: Math.round(conf),
      status,
      selectedAngle: 0,
      engine: 'tesseract',
    };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      const w = this.worker;
      this.worker = null;
      await w.terminate();
    }
  }
}

/**
 * Cliente HTTP local para o microserviço Python RapidOCR (PP-OCRv4)
 * Conecta exclusivamente em http://127.0.0.1:5001
 */
export class LocalHttpOcrService implements IOcrService {
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:5001') {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<{ online: boolean; engine?: string }> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(`${this.baseUrl}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        return { online: true, engine: json.engine };
      }
      return { online: false };
    } catch {
      return { online: false };
    }
  }

  async recognize(
    imageInput: Blob | File | string | Buffer,
    onProgress?: (progress: number) => void,
    options?: OcrRecognitionOptions
  ): Promise<OcrRecognitionResult> {
    if (onProgress) onProgress(20);

    let bodyData: Blob;
    if (imageInput instanceof Blob) {
      bodyData = imageInput;
    } else if (typeof imageInput === 'string') {
      // Se for DataURL ou URL local
      const res = await fetch(imageInput);
      bodyData = await res.blob();
    } else {
      bodyData = new Blob([imageInput as unknown as BlobPart]);
    }

    if (onProgress) onProgress(40);

    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
    };
    if (options?.manualAngle !== undefined) {
      headers['X-Manual-Angle'] = String(options.manualAngle);
    }

    const response = await fetch(`${this.baseUrl}/ocr`, {
      method: 'POST',
      headers,
      body: bodyData,
    });

    if (onProgress) onProgress(80);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha no serviço OCR local (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (onProgress) onProgress(100);

    const mappedStatus: OcrStatus =
      data.status === 'reliable'
        ? 'reliable'
        : data.status === 'needs_review'
          ? 'needs_review'
          : data.status === 'failed'
            ? 'failed'
            : 'completed';

    return {
      text: data.raw_text || '',
      rawText: data.raw_text || '',
      suggestedTitle: data.suggested_title || '',
      confidence: Math.round((data.title_confidence || 0) * 100),
      status: mappedStatus,
      selectedAngle: data.selected_angle ?? 0,
      lines: data.lines || [],
      engine: 'rapidocr',
    };
  }

  async terminate(): Promise<void> {
    // Sem recursos pesados persistentes
  }
}

/**
 * Serviço de OCR Híbrido:
 * Prioriza o motor local Python (RapidOCR PP-OCRv4 no 127.0.0.1:5001) para máxima fidelidade e rotação automática.
 * Se o serviço não estiver em execução, realiza fallback gracioso para o Tesseract.js local no navegador.
 */
export class HybridOcrService implements IOcrService {
  private localService: LocalHttpOcrService;
  private tesseractService: TesseractOcrService;

  constructor() {
    this.localService = new LocalHttpOcrService();
    this.tesseractService = new TesseractOcrService();
  }

  async checkHealth(): Promise<{ online: boolean; engine?: string }> {
    return this.localService.checkHealth();
  }

  async recognize(
    imageInput: Blob | File | string | Buffer,
    onProgress?: (progress: number) => void,
    options?: OcrRecognitionOptions
  ): Promise<OcrRecognitionResult> {
    // Tenta primeiro o serviço local de alto desempenho
    try {
      return await this.localService.recognize(imageInput, onProgress, options);
    } catch (err) {
      console.warn('Serviço Python local indisponível, acionando fallback Tesseract.js:', err);
      return await this.tesseractService.recognize(imageInput, onProgress);
    }
  }

  async terminate(): Promise<void> {
    await this.tesseractService.terminate();
  }
}

export class MockOcrService implements IOcrService {
  private mockHandler: (imageInput: Blob | File | string | Buffer) => Promise<OcrRecognitionResult>;

  constructor(
    customHandler?: (imageInput: Blob | File | string | Buffer) => Promise<OcrRecognitionResult> | OcrRecognitionResult
  ) {
    if (customHandler) {
      this.mockHandler = async (input) => customHandler(input);
    } else {
      this.mockHandler = async (input) => {
        const name = typeof input === 'object' && 'name' in input ? (input as { name: string }).name : 'imagem';
        return {
          text: `TEXTO SIMULADO DO LIVRO (${name})\nAUTOR EXEMPLO\nEDITORA EXEMPLO`,
          rawText: `TEXTO SIMULADO DO LIVRO (${name})\nAUTOR EXEMPLO\nEDITORA EXEMPLO`,
          suggestedTitle: `TEXTO SIMULADO DO LIVRO (${name})`,
          confidence: 95,
          status: 'reliable',
          selectedAngle: 0,
          engine: 'mock',
        };
      };
    }
  }

  async recognize(
    imageInput: Blob | File | string | Buffer,
    onProgress?: (progress: number) => void
  ): Promise<OcrRecognitionResult> {
    if (onProgress) {
      onProgress(50);
      await new Promise((r) => setTimeout(r, 20));
      onProgress(100);
    }
    return this.mockHandler(imageInput);
  }

  async terminate(): Promise<void> {
    // No-op
  }
}

// Suporte a injeção em ambiente de teste E2E
declare global {
  interface Window {
    __MOCK_OCR_SERVICE__?: IOcrService;
  }
}

let activeOcrService: IOcrService | null = null;

export function getActiveOcrService(): IOcrService {
  if (typeof window !== 'undefined' && window.__MOCK_OCR_SERVICE__) {
    return window.__MOCK_OCR_SERVICE__;
  }

  if (!activeOcrService) {
    activeOcrService = new HybridOcrService();
  }
  return activeOcrService;
}

export function setActiveOcrService(service: IOcrService | null): void {
  activeOcrService = service;
}
