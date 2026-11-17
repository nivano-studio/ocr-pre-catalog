import { describe, it, expect } from 'vitest';
import { generateShelfTxtContent, sanitizeExportFileName, validateTxtExport } from '@/domain/txtExport';
import type { ShelfRecord } from '@/domain/shelf';
import type { BookRecord } from '@/domain/book';

describe('Domain: TXT Export & Sanitization', () => {
  const mockShelf: ShelfRecord = {
    id: 'shelf-123',
    name: 'História do Brasil & Literatura',
    createdAt: '2026-10-07T12:00:00.000Z',
    updatedAt: '2026-10-07T12:00:00.000Z',
  };

  const mockBooks: BookRecord[] = [
    {
      id: 'b-1',
      shelfId: 'shelf-123',
      sequenceNumber: 1,
      rawOcrText: 'DOM CASMURRO\nMACHADO DE ASSIS',
      reviewedText: 'Dom Casmurro - Machado de Assis (Edição Crítica)',
      copyCount: 2,
      ocrStatus: 'completed',
      createdAt: '2026-10-07T12:05:00.000Z',
      updatedAt: '2026-10-07T12:10:00.000Z',
    },
    {
      id: 'b-2',
      shelfId: 'shelf-123',
      sequenceNumber: 2,
      rawOcrText: 'MEMORIAS POSTHUMAS DE BRAZ CUBAS',
      reviewedText: '', // Vazio: deve herdar o texto bruto no campo TEXTO REVISADO
      copyCount: 1,
      ocrStatus: 'completed',
      createdAt: '2026-10-07T12:06:00.000Z',
      updatedAt: '2026-10-07T12:06:00.000Z',
    },
  ];

  it('deve gerar conteúdo TXT exatamente no formato obrigatório', () => {
    const txt = generateShelfTxtContent(mockShelf, mockBooks);

    expect(txt).toContain('PRATELEIRA: História do Brasil & Literatura');
    expect(txt).toContain('TOTAL DE LIVROS: 2');
    expect(txt).toContain('TOTAL DE EXEMPLARES: 3');

    // Livro 001
    expect(txt).toContain('LIVRO 001');
    expect(txt).toContain('QUANTIDADE DE EXEMPLARES: 2');
    expect(txt).toContain('TEXTO OCR BRUTO:\nDOM CASMURRO\nMACHADO DE ASSIS');
    expect(txt).toContain('TEXTO REVISADO:\nDom Casmurro - Machado de Assis (Edição Crítica)');

    // Separador
    expect(txt).toContain('---');

    // Livro 002 (fallback para texto bruto quando revisado vazio)
    expect(txt).toContain('LIVRO 002');
    expect(txt).toContain('QUANTIDADE DE EXEMPLARES: 1');
    expect(txt).toContain('TEXTO OCR BRUTO:\nMEMORIAS POSTHUMAS DE BRAZ CUBAS');
    expect(txt).toContain('TEXTO REVISADO:\nMEMORIAS POSTHUMAS DE BRAZ CUBAS');
  });

  it('deve sanitizar o nome de arquivo para download prevenindo caracteres proibidos no Windows', () => {
    expect(sanitizeExportFileName('História: Volume 1 / 2 <Especial>?*|')).toBe('Historia_Volume_1_2_Especial.txt');
    expect(sanitizeExportFileName('   ')).toBe('prateleira_export.txt');
    expect(sanitizeExportFileName('Prateleira com Acentos e Ç')).toBe('Prateleira_com_Acentos_e_C.txt');
  });

  it('deve validar o conteúdo gerado antes do download', () => {
    const validTxt = generateShelfTxtContent(mockShelf, mockBooks);
    expect(validateTxtExport(validTxt).isValid).toBe(true);

    expect(validateTxtExport('').isValid).toBe(false);
    expect(validateTxtExport('Arquivo corrompido sem cabecalho').isValid).toBe(false);
  });
});
