import { describe, it, expect } from 'vitest';
import { validateFileBatch } from '@/domain/batchValidation';

describe('Domain: Batch Validation Rules', () => {
  const createMockFile = (name: string, size: number, type: string): { name: string; size: number; type: string } => ({
    name,
    size,
    type,
  });

  it('deve aceitar formatos válidos (JPG, JPEG, PNG, WebP) dentro dos limites', () => {
    const files = [
      createMockFile('capa1.jpg', 2 * 1024 * 1024, 'image/jpeg'),
      createMockFile('capa2.jpeg', 3 * 1024 * 1024, 'image/jpeg'),
      createMockFile('capa3.png', 4 * 1024 * 1024, 'image/png'),
      createMockFile('capa4.webp', 1 * 1024 * 1024, 'image/webp'),
    ];

    const result = validateFileBatch(files as File[]);
    expect(result.isValid).toBe(true);
    expect(result.acceptedFiles.length).toBe(4);
    expect(result.rejectedFiles.length).toBe(0);
    expect(result.hasExceededRecommendedCount).toBe(false);
  });

  it('deve rejeitar formatos não suportados com mensagem clara', () => {
    const files = [
      createMockFile('documento.pdf', 1024, 'application/pdf'),
      createMockFile('animacao.gif', 1024, 'image/gif'),
      createMockFile('capa.jpg', 1024, 'image/jpeg'),
    ];

    const result = validateFileBatch(files as File[]);
    expect(result.isValid).toBe(true); // Ainda válido porque há 1 aceito, mas com rejeições detalhadas
    expect(result.acceptedFiles.length).toBe(1);
    expect(result.rejectedFiles.length).toBe(2);
    expect(result.rejectedFiles[0].reason).toContain('Formato não suportado');
    expect(result.rejectedFiles[1].reason).toContain('Formato não suportado');
  });

  it('deve rejeitar arquivo individual que ultrapasse 20 MB', () => {
    const files = [
      createMockFile('enorme.jpg', 21 * 1024 * 1024, 'image/jpeg'),
      createMockFile('ok.jpg', 5 * 1024 * 1024, 'image/jpeg'),
    ];

    const result = validateFileBatch(files as File[]);
    expect(result.acceptedFiles.length).toBe(1);
    expect(result.rejectedFiles.length).toBe(1);
    expect(result.rejectedFiles[0].reason).toContain('20 MB');
  });

  it('deve bloquear o lote caso ultrapasse o limite absoluto de 100 imagens', () => {
    const files = Array.from({ length: 101 }, (_, i) =>
      createMockFile(`livro_${i}.png`, 100 * 1024, 'image/png')
    );

    const result = validateFileBatch(files as File[]);
    expect(result.isValid).toBe(false);
    expect(result.globalError).toContain('100');
  });

  it('deve sinalizar aviso quando ultrapassar o limite recomendado de 50 imagens (mas <= 100)', () => {
    const files = Array.from({ length: 55 }, (_, i) =>
      createMockFile(`livro_${i}.png`, 100 * 1024, 'image/png')
    );

    const result = validateFileBatch(files as File[]);
    expect(result.isValid).toBe(true);
    expect(result.hasExceededRecommendedCount).toBe(true);
    expect(result.acceptedFiles.length).toBe(55);
  });

  it('deve rejeitar caso o tamanho total acumulado ultrapasse 500 MB', () => {
    // Simula lote de mais de 500 MB
    const bigBatch = Array.from({ length: 27 }, (_, i) =>
      createMockFile(`parte_${i}.jpg`, 19 * 1024 * 1024, 'image/jpeg') // 27 * 19MB = 513MB
    );

    const result = validateFileBatch(bigBatch as File[]);
    expect(result.isValid).toBe(false);
    expect(result.globalError).toContain('500 MB');
  });
});
