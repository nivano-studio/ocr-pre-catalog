export interface TargetDimensions {
  width: number;
  height: number;
  wasScaled: boolean;
}

export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  maxSide = 2400
): TargetDimensions {
  if (origWidth <= 0 || origHeight <= 0) {
    return { width: origWidth, height: origHeight, wasScaled: false };
  }

  const currentMax = Math.max(origWidth, origHeight);
  if (currentMax <= maxSide) {
    return { width: origWidth, height: origHeight, wasScaled: false };
  }

  const scaleFactor = maxSide / currentMax;
  const width = Math.round(origWidth * scaleFactor);
  const height = Math.round(origHeight * scaleFactor);

  return {
    width,
    height,
    wasScaled: true,
  };
}

export interface PreprocessResult {
  processedBlob: Blob;
  cleanup: () => void;
}

/**
 * Trata uma imagem por vez antes do envio ao OCR:
 * - limita temporariamente o lado maior a 2.400 px mantendo a proporção;
 * - respeita a orientação;
 * - não substitui o arquivo original;
 * - libera memória e canvas após uso.
 */
export async function preprocessImage(fileOrBlob: Blob): Promise<PreprocessResult> {
  // Se estiver em ambiente sem DOM (ex: Node/Vitest), retorna o próprio blob
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      processedBlob: fileOrBlob,
      cleanup: () => {},
    };
  }

  const objectUrl = URL.createObjectURL(fileOrBlob);

  return new Promise((resolve) => {
    const img = new Image();

    const cleanup = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Ignora caso já tenha sido revogado
      }
    };

    img.onload = () => {
      try {
        const { width, height, wasScaled } = calculateTargetDimensions(
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          2400
        );

        if (!wasScaled) {
          // Não houve necessidade de redimensionar
          return resolve({
            processedBlob: fileOrBlob,
            cleanup,
          });
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            processedBlob: fileOrBlob,
            cleanup,
          });
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            // Limpa canvas
            canvas.width = 0;
            canvas.height = 0;
            cleanup();

            if (blob) {
              resolve({
                processedBlob: blob,
                cleanup: () => {},
              });
            } else {
              resolve({
                processedBlob: fileOrBlob,
                cleanup: () => {},
              });
            }
          },
          'image/jpeg',
          0.92
        );
      } catch {
        cleanup();
        resolve({
          processedBlob: fileOrBlob,
          cleanup: () => {},
        });
      }
    };

    img.onerror = () => {
      cleanup();
      resolve({
        processedBlob: fileOrBlob,
        cleanup: () => {},
      });
    };

    img.src = objectUrl;
  });
}
