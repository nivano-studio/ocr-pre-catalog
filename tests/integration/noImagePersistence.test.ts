import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { initDatabase, type AppDatabase } from '../../src/storage/db';
import type { BookRecord } from '../../src/domain/book';

describe('Garantia de Não Persistência de Imagens', () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = initDatabase(`test-no-image-db-${Date.now()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('deve armazenar apenas registros textuais e metadados, sem propriedades binárias ou base64', async () => {
    const shelfId = 'shelf-test-1';
    await db.shelves.add({
      id: shelfId,
      name: 'Prateleira Teste',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const bookRecord: BookRecord = {
      id: 'book-test-1',
      shelfId,
      sequenceNumber: 1,
      rawOcrText: 'TEXTO OCR BRUTO',
      suggestedTitle: 'TITULO SUGERIDO',
      reviewedText: 'TITULO SUGERIDO',
      confidence: 85,
      selectedAngle: 270,
      copyCount: 2,
      ocrStatus: 'reliable',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.books.add(bookRecord);

    const storedBook = await db.books.get('book-test-1');
    expect(storedBook).toBeDefined();

    // Inspeciona todas as propriedades do registro persistido
    const recordKeys = Object.keys(storedBook!);
    for (const key of recordKeys) {
      const val = (storedBook as unknown as Record<string, unknown>)[key];
      // Nenhuma chave ou valor deve ser Blob, File, ArrayBuffer ou Data URL Base64
      expect(val instanceof Blob).toBe(false);
      expect(val instanceof ArrayBuffer).toBe(false);
      expect(val instanceof Uint8Array).toBe(false);

      if (typeof val === 'string') {
        expect(val.startsWith('data:image')).toBe(false);
        expect(val.startsWith('blob:')).toBe(false);
        expect(val.length).toBeLessThan(10000); // Não é um dump base64 de imagem
      }
    }
  });

  it('deve verificar que o schema do IndexedDB não contém índices ou tabelas de imagem', () => {
    const tableNames = db.tables.map((t) => t.name);
    expect(tableNames).toContain('shelves');
    expect(tableNames).toContain('books');
    expect(tableNames).not.toContain('images');
    expect(tableNames).not.toContain('photos');
  });
});
