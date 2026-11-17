import { describe, it, expect } from 'vitest';

export function normalizeTextStrict(text: string): string {
  if (!text) return '';
  const nfkc = text.normalize('NFKC');
  const cleaned = nfkc.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return cleaned.toUpperCase().trim().replace(/\s+/g, ' ');
}

export function normalizeTextLoose(text: string): string {
  if (!text) return '';
  const strict = normalizeTextStrict(text);
  const nfd = strict.normalize('NFD');
  return nfd.replace(/[\u0300-\u036f]/g, '');
}

export function computeLevenshtein(s1: string | string[], s2: string | string[]): number {
  if (s1.length < s2.length) return computeLevenshtein(s2, s1);
  if (s2.length === 0) return s1.length;
  let previousRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < s2.length; j++) {
      const insertions = previousRow[j + 1] + 1;
      const deletions = currentRow[j] + 1;
      const substitutions = previousRow[j] + (s1[i] !== s2[j] ? 1 : 0);
      currentRow.push(Math.min(insertions, deletions, substitutions));
    }
    previousRow = currentRow;
  }
  return previousRow[previousRow.length - 1];
}

export function calculateCer(expected: string, actual: string): number {
  const expNorm = normalizeTextLoose(expected);
  const actNorm = normalizeTextLoose(actual);
  if (!expNorm) return !actNorm ? 0 : 1;
  const dist = computeLevenshtein(expNorm, actNorm);
  return Number((dist / Math.max(expNorm.length, 1)).toFixed(4));
}

export function calculateWer(expected: string, actual: string): number {
  const expWords = normalizeTextLoose(expected).split(' ').filter(Boolean);
  const actWords = normalizeTextLoose(actual).split(' ').filter(Boolean);
  if (expWords.length === 0) return actWords.length === 0 ? 0 : 1;
  const dist = computeLevenshtein(expWords, actWords);
  return Number((dist / Math.max(expWords.length, 1)).toFixed(4));
}

describe('OCR Evaluation Metrics & Text Normalization', () => {
  it('deve normalizar texto removendo acentos e pontuação em modo loose', () => {
    const raw = 'CATECISMO DA IGREJA CATÓLICA!';
    const normalized = normalizeTextLoose(raw);
    expect(normalized).toBe('CATECISMO DA IGREJA CATOLICA');
  });

  it('deve identificar correspondência exata normalizada', () => {
    const expected = 'O MILAGRE DA MANHÃ';
    const actual = 'O MILAGRE DA MANHA';
    expect(normalizeTextLoose(expected)).toBe(normalizeTextLoose(actual));
  });

  it('deve calcular CER = 0 e WER = 0 para strings idênticas', () => {
    const exp = 'BNCC';
    const act = 'BNCC';
    expect(calculateCer(exp, act)).toBe(0);
    expect(calculateWer(exp, act)).toBe(0);
  });

  it('deve calcular CER e WER proporcionais para pequenas discrepâncias', () => {
    const exp = 'REDESCOBRINDO SUA BIBLIA';
    const act = 'REDESCOBRINDO SUA BIBLIAS'; // 1 letra a mais
    const cer = calculateCer(exp, act);
    expect(cer).toBeGreaterThan(0);
    expect(cer).toBeLessThan(0.1);
  });

  it('deve calcular CER próximo de 1 para strings completamente disjuntas', () => {
    const exp = 'DOM CASMURRO';
    const act = 'OUTRO LIVRO DIFERENTE';
    const cer = calculateCer(exp, act);
    expect(cer).toBeGreaterThan(0.7);
  });
});
