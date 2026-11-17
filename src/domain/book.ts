export type OcrStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'reliable'
  | 'needs_review';

export interface BookRecord {
  id: string;
  shelfId: string;
  sequenceNumber: number;
  rawOcrText: string;
  suggestedTitle?: string;
  confidence?: number;
  selectedAngle?: number;
  reviewedText: string;
  copyCount: number;
  ocrStatus: OcrStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CopyCountValidationResult {
  isValid: boolean;
  value?: number;
  error?: string;
}

export function validateCopyCount(value: number | string): CopyCountValidationResult {
  if (value === '' || value === null || value === undefined) {
    return {
      isValid: false,
      error: 'Informe uma quantidade válida.',
    };
  }

  const num = typeof value === 'number' ? value : Number(value);

  if (Number.isNaN(num)) {
    return {
      isValid: false,
      error: 'A quantidade de exemplares deve ser um número.',
    };
  }

  if (!Number.isInteger(num)) {
    return {
      isValid: false,
      error: 'A quantidade de exemplares deve ser um número inteiro.',
    };
  }

  if (num < 1) {
    return {
      isValid: false,
      error: 'A quantidade de exemplares deve ser no mínimo 1.',
    };
  }

  return {
    isValid: true,
    value: num,
  };
}

export function formatBookSequenceNumber(seq: number): string {
  const padded = String(seq).padStart(3, '0');
  return `LIVRO ${padded}`;
}
