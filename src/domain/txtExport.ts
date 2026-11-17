import type { ShelfRecord } from './shelf';
import type { BookRecord } from './book';
import { formatBookSequenceNumber } from './book';
import { calculateShelfTotals } from './shelf';

export interface TxtValidationResult {
  isValid: boolean;
  error?: string;
}

export function generateShelfTxtContent(shelf: ShelfRecord, books: BookRecord[]): string {
  const totals = calculateShelfTotals(books);

  const headerLines = [
    `PRATELEIRA: ${shelf.name}`,
    `CRIADA EM: ${new Date(shelf.createdAt).toLocaleString('pt-BR')}`,
    `TOTAL DE LIVROS: ${totals.totalBooks}`,
    `TOTAL DE EXEMPLARES: ${totals.totalCopies}`,
  ];

  const bookBlocks: string[] = [];

  // Ordena livros pelo número sequencial
  const sortedBooks = [...books].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  for (const book of sortedBooks) {
    const raw = book.rawOcrText ? book.rawOcrText.trim() : '';
    // Regra: usar Texto Revisado como conteúdo principal se não estiver vazio;
    // senão, herdar o texto bruto.
    const reviewed = book.reviewedText && book.reviewedText.trim().length > 0
      ? book.reviewedText.trim()
      : raw;

    const block = [
      formatBookSequenceNumber(book.sequenceNumber),
      `QUANTIDADE DE EXEMPLARES: ${book.copyCount || 1}`,
      'TEXTO OCR BRUTO:',
      raw || '(nenhum texto detectado)',
      '',
      'TEXTO REVISADO:',
      reviewed || '(nenhum texto revisado)',
    ].join('\n');

    bookBlocks.push(block);
  }

  const separator = '\n\n---\n\n';
  return headerLines.join('\n') + '\n\n' + bookBlocks.join(separator) + '\n';
}

export function sanitizeExportFileName(shelfName: string): string {
  const trimmed = shelfName.trim();
  if (!trimmed) {
    return 'prateleira_export.txt';
  }

  // Normaliza acentos e caracteres especiais para compatibilidade total em sistemas de arquivos
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Substitui caracteres proibidos no Windows (\ / : * ? " < > |) e outros inválidos por underline
  const sanitized = normalized
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return (sanitized || 'prateleira') + '.txt';
}

export function validateTxtExport(content: string): TxtValidationResult {
  if (!content || !content.trim()) {
    return {
      isValid: false,
      error: 'O conteúdo de exportação está vazio.',
    };
  }

  if (!content.includes('PRATELEIRA:') || !content.includes('TOTAL DE LIVROS:')) {
    return {
      isValid: false,
      error: 'O conteúdo exportado não possui o cabeçalho obrigatório da prateleira.',
    };
  }

  return {
    isValid: true,
  };
}
