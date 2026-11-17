import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { createWorker } from 'tesseract.js';

describe('Smoke: Real Local Tesseract.js OCR Execution', () => {
  it('deve executar OCR real localmente sobre imagem raster de fixture e extrair texto não vazio', async () => {
    const fixturePath = path.resolve(__dirname, '../fixtures/livro-fixture.png');
    expect(fs.existsSync(fixturePath)).toBe(true);

    const tessdataPath = path.resolve(__dirname, '../../public/tesseract');
    expect(fs.existsSync(path.join(tessdataPath, 'por.traineddata.gz'))).toBe(true);

    // Carrega o worker apontando para os dados locais de traineddata
    const worker = await createWorker('por', 1, {
      langPath: tessdataPath,
      gzip: true,
    });

    try {
      const result = await worker.recognize(fixturePath);
      const recognizedText = result.data.text ? result.data.text.trim() : '';

      console.log('--- [SMOKE TEST OCR REAL OUTPUT] ---');
      console.log('Texto bruto reconhecido:\n' + recognizedText);
      console.log('Confiança média:', result.data.confidence);
      console.log('------------------------------------');

      // 1. O texto não pode ser vazio
      expect(recognizedText.length).toBeGreaterThan(0);

      // 2. Após normalização, deve conter ao menos uma palavra esperada da capa
      // A capa gerada possui "DOM CASMURRO", "MACHADO DE ASSIS", "LIVRARIA", "EDICAO"
      const normalized = recognizedText.toUpperCase();
      const expectedWords = ['DOM', 'CASMURRO', 'MACHADO', 'ASSIS', 'LIVRARIA', 'EDICAO', 'BRASIL'];
      const matchedWords = expectedWords.filter((w) => normalized.includes(w));

      console.log('Palavras-chave identificadas com sucesso:', matchedWords);
      expect(matchedWords.length).toBeGreaterThanOrEqual(1);
    } finally {
      await worker.terminate();
    }
  }, 60000);
});
