export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export const MAX_FILES_ABSOLUTE = 100;
export const RECOMMENDED_FILES_PER_BATCH = 50;
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_BATCH_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

export interface RejectedFileInfo {
  fileName: string;
  reason: string;
}

export interface BatchValidationResult {
  isValid: boolean;
  acceptedFiles: File[];
  rejectedFiles: RejectedFileInfo[];
  totalSizeBytes: number;
  hasExceededRecommendedCount: boolean;
  globalError?: string;
}

export function isSupportedImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (file.type && ACCEPTED_MIME_TYPES.includes(file.type as typeof ACCEPTED_MIME_TYPES[number])) {
    return true;
  }
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function validateFileBatch(files: File[]): BatchValidationResult {
  const rejectedFiles: RejectedFileInfo[] = [];
  const acceptedFiles: File[] = [];

  if (files.length > MAX_FILES_ABSOLUTE) {
    return {
      isValid: false,
      acceptedFiles: [],
      rejectedFiles: [],
      totalSizeBytes: 0,
      hasExceededRecommendedCount: true,
      globalError: `O lote excede o limite máximo permitido de ${MAX_FILES_ABSOLUTE} imagens (${files.length} fornecidas). Reduza a quantidade e tente novamente.`,
    };
  }

  let totalSizeBytes = 0;

  for (const file of files) {
    if (!isSupportedImageFile(file)) {
      rejectedFiles.push({
        fileName: file.name,
        reason: 'Formato não suportado. Utilize apenas arquivos JPG, JPEG, PNG ou WebP.',
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejectedFiles.push({
        fileName: file.name,
        reason: `Arquivo excede o tamanho máximo de 20 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      });
      continue;
    }

    totalSizeBytes += file.size;
    acceptedFiles.push(file);
  }

  if (totalSizeBytes > MAX_BATCH_SIZE_BYTES) {
    return {
      isValid: false,
      acceptedFiles,
      rejectedFiles,
      totalSizeBytes,
      hasExceededRecommendedCount: acceptedFiles.length > RECOMMENDED_FILES_PER_BATCH,
      globalError: `O tamanho total do lote (${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB) ultrapassa o limite permitido de 500 MB.`,
    };
  }

  const hasExceededRecommendedCount = acceptedFiles.length > RECOMMENDED_FILES_PER_BATCH;

  return {
    isValid: acceptedFiles.length > 0 || rejectedFiles.length === 0,
    acceptedFiles,
    rejectedFiles,
    totalSizeBytes,
    hasExceededRecommendedCount,
  };
}
