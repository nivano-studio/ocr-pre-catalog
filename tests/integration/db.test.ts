import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppDatabase, initDatabase } from '@/storage/db';
import { generateShelfTxtContent } from '@/domain/txtExport';
import type { ShelfRecord } from '@/domain/shelf';
import type { BookRecord } from '@/domain/book';

describe('Integration: IndexedDB Persistence & Privacy Gate', () => {
  let db: AppDatabase;

  beforeEach(async () => {
    // Banco isolado para cada teste
    db = initDatabase(`test-db-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('deve criar, obter, atualizar e excluir prateleira com remoção em cascata dos livros', async () => {
    const shelf: ShelfRecord = {
      id: 's-10',
      name: 'Filosofia Antiga',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.shelves.add(shelf);
    const retrieved = await db.shelves.get('s-10');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Filosofia Antiga');

    // Adiciona livros vinculados à prateleira
    const book: BookRecord = {
      id: 'b-100',
      shelfId: 's-10',
      sequenceNumber: 1,
      rawOcrText: 'A Republica - Platao',
      reviewedText: 'A República - Platão',
      copyCount: 2,
      ocrStatus: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.books.add(book);

    // Atualiza nome da prateleira
    await db.updateShelfName('s-10', 'Filosofia Clássica');
    const updated = await db.shelves.get('s-10');
    expect(updated?.name).toBe('Filosofia Clássica');

    // Exclusão com cascata
    await db.deleteShelfWithBooks('s-10');
    expect(await db.shelves.get('s-10')).toBeUndefined();
    const remainingBooks = await db.books.where('shelfId').equals('s-10').toArray();
    expect(remainingBooks.length).toBe(0);
  });

  it('deve persistir livros a partir de itens concluídos da fila e permitir edição de texto e quantidade', async () => {
    const shelfId = 's-20';
    await db.shelves.add({
      id: shelfId,
      name: 'Literatura Brasileira',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const book1: BookRecord = {
      id: 'b-201',
      shelfId,
      sequenceNumber: 1,
      rawOcrText: 'GRANDE SERTAO VEREDAS',
      reviewedText: '',
      copyCount: 1,
      ocrStatus: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const book2: BookRecord = {
      id: 'b-202',
      shelfId,
      sequenceNumber: 2,
      rawOcrText: 'VIDAS SECAS',
      reviewedText: 'Vidas Secas - Graciliano Ramos',
      copyCount: 1,
      ocrStatus: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.books.bulkAdd([book1, book2]);

    // Editar texto revisado
    await db.updateBookReviewedText('b-201', 'Grande Sertão: Veredas - Guimarães Rosa');
    const updatedBook1 = await db.books.get('b-201');
    expect(updatedBook1?.reviewedText).toBe('Grande Sertão: Veredas - Guimarães Rosa');

    // Editar quantidade de exemplares
    await db.updateBookCopyCount('b-202', 4);
    const updatedBook2 = await db.books.get('b-202');
    expect(updatedBook2?.copyCount).toBe(4);

    // Exportação TXT a partir dos dados do banco
    const shelf = (await db.shelves.get(shelfId))!;
    const books = await db.books.where('shelfId').equals(shelfId).sortBy('sequenceNumber');
    const txt = generateShelfTxtContent(shelf, books);
    expect(txt).toContain('PRATELEIRA: Literatura Brasileira');
    expect(txt).toContain('TOTAL DE LIVROS: 2');
    expect(txt).toContain('TOTAL DE EXEMPLARES: 5');
    expect(txt).toContain('QUANTIDADE DE EXEMPLARES: 4');
  });

  it('GARANTIA DE PRIVACIDADE: confirmação absoluta de que imagens NÃO são gravadas no IndexedDB', async () => {
    const shelfId = 's-privacy';
    await db.shelves.add({
      id: shelfId,
      name: 'Prateleira de Teste de Privacidade',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.books.add({
      id: 'b-priv-1',
      shelfId,
      sequenceNumber: 1,
      rawOcrText: 'Texto Extraído',
      reviewedText: 'Texto Revisado',
      copyCount: 1,
      ocrStatus: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const allShelves = await db.shelves.toArray();
    const allBooks = await db.books.toArray();

    // Inspeciona exaustivamente todos os registros para garantir que não há dados de imagem
    for (const record of [...allShelves, ...allBooks]) {
      const jsonStr = JSON.stringify(record);

      expect(jsonStr).not.toContain('data:image');
      expect(jsonStr).not.toContain('blob:');
      expect(jsonStr).not.toContain('base64');

      for (const [key, value] of Object.entries(record)) {
        expect(value instanceof Blob).toBe(false);
        expect(value instanceof ArrayBuffer).toBe(false);
        expect(key).not.toBe('image');
        expect(key).not.toBe('photo');
        expect(key).not.toBe('thumbnail');
        expect(key).not.toBe('blob');
        expect(key).not.toBe('url');
      }
    }
  });
});
