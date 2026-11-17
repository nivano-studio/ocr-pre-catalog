import { describe, it, expect } from 'vitest';
import { validateCopyCount, formatBookSequenceNumber } from '@/domain/book';

describe('Domain: Book Validation & Formatting', () => {
  describe('validateCopyCount', () => {
    it('deve aceitar inteiros positivos válidos', () => {
      expect(validateCopyCount(1)).toEqual({ isValid: true, value: 1 });
      expect(validateCopyCount(5)).toEqual({ isValid: true, value: 5 });
      expect(validateCopyCount('3')).toEqual({ isValid: true, value: 3 });
    });

    it('deve rejeitar zero', () => {
      const res = validateCopyCount(0);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('A quantidade de exemplares deve ser no mínimo 1.');
    });

    it('deve rejeitar números negativos', () => {
      const res = validateCopyCount(-2);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('A quantidade de exemplares deve ser no mínimo 1.');
    });

    it('deve rejeitar decimais', () => {
      const res = validateCopyCount(2.5);
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('A quantidade de exemplares deve ser um número inteiro.');
    });

    it('deve rejeitar NaN e valores não numéricos', () => {
      expect(validateCopyCount(NaN).isValid).toBe(false);
      expect(validateCopyCount('abc').isValid).toBe(false);
      expect(validateCopyCount('').isValid).toBe(false);
    });
  });

  describe('formatBookSequenceNumber', () => {
    it('deve formatar número sequencial com zero à esquerda de no mínimo 3 dígitos', () => {
      expect(formatBookSequenceNumber(1)).toBe('LIVRO 001');
      expect(formatBookSequenceNumber(42)).toBe('LIVRO 042');
      expect(formatBookSequenceNumber(100)).toBe('LIVRO 100');
      expect(formatBookSequenceNumber(1234)).toBe('LIVRO 1234');
    });
  });
});
