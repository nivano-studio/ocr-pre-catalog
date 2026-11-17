import type { BookRecord } from './book';

export interface ShelfRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShelfValidationResult {
  isValid: boolean;
  cleanName?: string;
  error?: string;
}

export interface ShelfTotals {
  totalBooks: number;
  totalCopies: number;
}

export function validateShelfName(name: string): ShelfValidationResult {
  const clean = name ? name.trim() : '';
  if (!clean) {
    return {
      isValid: false,
      error: 'O nome da prateleira é obrigatório.',
    };
  }

  if (clean.length > 100) {
    return {
      isValid: false,
      error: 'O nome da prateleira deve ter no máximo 100 caracteres.',
    };
  }

  return {
    isValid: true,
    cleanName: clean,
  };
}

export function calculateShelfTotals(books: BookRecord[]): ShelfTotals {
  const totalBooks = books.length;
  const totalCopies = books.reduce((acc, book) => acc + (book.copyCount || 1), 0);

  return {
    totalBooks,
    totalCopies,
  };
}
