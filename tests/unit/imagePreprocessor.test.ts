import { describe, it, expect } from 'vitest';
import { calculateTargetDimensions } from '@/services/imagePreprocessor';

describe('Services: Image Preprocessor Dimensions', () => {
  it('não deve alterar dimensões menores ou iguais a 2400px no lado maior', () => {
    const dims1 = calculateTargetDimensions(1200, 1600, 2400);
    expect(dims1).toEqual({ width: 1200, height: 1600, wasScaled: false });

    const dims2 = calculateTargetDimensions(2400, 1800, 2400);
    expect(dims2).toEqual({ width: 2400, height: 1800, wasScaled: false });
  });

  it('deve redimensionar proporcionalmente quando a largura exceder 2400px', () => {
    // 3600 x 2400 -> redimensiona por fator 2400/3600 = 2/3 -> 2400 x 1600
    const dims = calculateTargetDimensions(3600, 2400, 2400);
    expect(dims.wasScaled).toBe(true);
    expect(dims.width).toBe(2400);
    expect(dims.height).toBe(1600);
  });

  it('deve redimensionar proporcionalmente quando a altura exceder 2400px (caso comum em capas de livro)', () => {
    // 2000 x 4000 -> redimensiona por fator 2400/4000 = 0.6 -> 1200 x 2400
    const dims = calculateTargetDimensions(2000, 4000, 2400);
    expect(dims.wasScaled).toBe(true);
    expect(dims.width).toBe(1200);
    expect(dims.height).toBe(2400);
  });
});
