import Dexie, { type EntityTable } from 'dexie';
import type { ShelfRecord } from '../domain/shelf';
import type { BookRecord } from '../domain/book';

export class AppDatabase extends Dexie {
  shelves!: EntityTable<ShelfRecord, 'id'>;
  books!: EntityTable<BookRecord, 'id'>;

  constructor(dbName = 'CatalogadorLivrosDB') {
    super(dbName);

    this.version(1).stores({
      shelves: 'id, name, createdAt, updatedAt',
      books: 'id, shelfId, sequenceNumber, ocrStatus, createdAt, updatedAt',
    });
  }

  async updateShelfName(shelfId: string, name: string): Promise<void> {
    await this.shelves.update(shelfId, {
      name: name.trim(),
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteShelfWithBooks(shelfId: string): Promise<void> {
    await this.transaction('rw', this.shelves, this.books, async () => {
      await this.books.where('shelfId').equals(shelfId).delete();
      await this.shelves.delete(shelfId);
    });
  }

  async updateBookReviewedText(bookId: string, reviewedText: string): Promise<void> {
    await this.books.update(bookId, {
      reviewedText,
      updatedAt: new Date().toISOString(),
    });
  }

  async updateBookCopyCount(bookId: string, copyCount: number): Promise<void> {
    await this.books.update(bookId, {
      copyCount,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteBooks(bookIds: string[]): Promise<void> {
    await this.books.bulkDelete(bookIds);
  }

  async getNextSequenceNumber(shelfId: string): Promise<number> {
    const books = await this.books.where('shelfId').equals(shelfId).sortBy('sequenceNumber');
    if (books.length === 0) {
      return 1;
    }
    const maxSeq = Math.max(...books.map((b) => b.sequenceNumber));
    return maxSeq + 1;
  }
}

export function initDatabase(dbName?: string): AppDatabase {
  return new AppDatabase(dbName);
}

let defaultDbInstance: AppDatabase | null = null;

export function getDatabase(): AppDatabase {
  if (!defaultDbInstance) {
    defaultDbInstance = new AppDatabase();
  }
  return defaultDbInstance;
}
