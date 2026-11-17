import { describe, it, expect } from 'vitest';
import { validateShelfName, calculateShelfTotals } from '@/domain/shelf';
import type { BookRecord } from '@/domain/book';

describe('Domain: Shelf Validation & Calculations', () => {
  describe('validateShelfName', () => {
    it('deve rejeitar nomes vazios ou compostos apenas por espaços', () => {
      expect(validateShelfName('')).toEqual({
        isValid: false,
        error: 'O nome da prateleira é obrigatório.',
      });
      expect(validateShelfName('   ')).toEqual({
        isValid: false,
        error: 'O nome da prateleira é obrigatório.',
      });
    });

    it('deve aceitar nomes válidos e retornar o nome limpo (trimmed)', () => {
      const result = validateShelfName('  Ficção Científica  ');
      expect(result.isValid).toBe(true);
      expect(result.cleanName).toBe('Ficção Científica');
      expect(result.error).toBeUndefined();
    });

    it('deve rejeitar nomes excessivamente longos (ex: > 100 caracteres)', () => {
      const longName = 'A'.repeat(101);
      const result = validateShelfName(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('100 caracteres');
    });
  });

  describe('calculateShelfTotals', () => {
    it('deve retornar 0 livros e 0 exemplares para prateleira vazia', () => {
      const totals = calculateShelfTotals([]);
      expect(totals).toEqual({ totalBooks: 0, totalCopies: 0 });
    });

    it('deve calcular corretamente a quantidade de livros e a soma dos exemplares', () => {
      const mockBooks: BookRecord[] = [
        {
          id: '1',
          shelfId: 's1',
          sequenceNumber: 1,
          rawOcrText: 'Livro 1',
          reviewedText: 'Livro 1 Revisado',
          copyCount: 1,
          ocrStatus: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          shelfId: 's1',
          sequenceNumber: 2,
          rawOcrText: 'Livro 2',
          reviewedText: '',
          copyCount: 3,
          ocrStatus: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          shelfId: 's1',
          sequenceNumber: 3,
          rawOcrText: '',
          reviewedText: '',
          copyCount: 2,
          ocrStatus: 'failed',
          errorMessage: 'Erro no OCR',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const totals = calculateShelfTotals(mockBooks);
      expect(totals.totalBooks).toBe(3);
      expect(totals.totalCopies).toBe(6);
    });
  });
});
