import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LocalHttpOcrService } from '../../src/services/ocrService';

describe('Microserviço Local RapidOCR (127.0.0.1:5001)', () => {
  const service = new LocalHttpOcrService('http://127.0.0.1:5001');

  it('deve responder positivamente ao health check em 127.0.0.1:5001', async () => {
    const health = await service.checkHealth();
    expect(health.online).toBe(true);
    expect(health.engine).toBe('rapidocr-ppocrv4-onnx');
  });

  it('deve processar capa real e extrair título com alta fidelidade sem internet', async () => {
    const imgPath = path.resolve(__dirname, '../../imagens de teste/WhatsApp Image 2026-10-07 at 11.50.15 (1).jpeg');
    const imgBuffer = fs.readFileSync(imgPath);

    const result = await service.recognize(imgBuffer);
    expect(result.engine).toBe('rapidocr');
    expect(result.suggestedTitle).toBe('BNCC');
    expect(result.selectedAngle).toBe(270);
    expect(result.status).toBe('reliable');
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  }, 30000);
});
