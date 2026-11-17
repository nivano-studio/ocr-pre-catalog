import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Plus,
  Minus,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit3,
  RotateCw,
  RotateCcw,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { BookRecord } from '../domain/book';
import { formatBookSequenceNumber, validateCopyCount } from '../domain/book';

interface BookCardProps {
  book: BookRecord;
  tempPhotoUrl?: string | null;
  isSelected: boolean;
  onToggleSelect: (bookId: string) => void;
  onUpdateReviewedText: (bookId: string, newText: string) => void;
  onUpdateCopyCount: (bookId: string, count: number) => void;
  onDeleteBook: (bookId: string) => void;
  onPreviewPhoto: (url: string, title: string) => void;
  onRotatePhoto?: (bookId: string, direction: 'cw' | 'ccw') => void;
  onReprocessOcr?: (bookId: string) => void;
  isReprocessing?: boolean;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  tempPhotoUrl,
  isSelected,
  onToggleSelect,
  onUpdateReviewedText,
  onUpdateCopyCount,
  onDeleteBook,
  onPreviewPhoto,
  onRotatePhoto,
  onReprocessOcr,
  isReprocessing = false,
}) => {
  const [localReviewedText, setLocalReviewedText] = useState(book.reviewedText);
  const [isEditingText, setIsEditingText] = useState(false);
  const [copyCountInput, setCopyCountInput] = useState(String(book.copyCount));
  const [copyCountError, setCopyCountError] = useState<string | null>(null);

  useEffect(() => {
    setLocalReviewedText(book.reviewedText);
  }, [book.reviewedText]);

  const formattedSeq = formatBookSequenceNumber(book.sequenceNumber);

  const handleReviewedTextBlur = () => {
    setIsEditingText(false);
    if (localReviewedText !== book.reviewedText) {
      onUpdateReviewedText(book.id, localReviewedText);
    }
  };

  const handleCopyCountChange = (valStr: string) => {
    setCopyCountInput(valStr);
    const validation = validateCopyCount(valStr);
    if (validation.isValid && validation.value !== undefined) {
      setCopyCountError(null);
      onUpdateCopyCount(book.id, validation.value);
    } else {
      setCopyCountError(validation.error || 'Inválido');
    }
  };

  const handleIncrement = () => {
    const nextVal = (book.copyCount || 1) + 1;
    setCopyCountInput(String(nextVal));
    setCopyCountError(null);
    onUpdateCopyCount(book.id, nextVal);
  };

  const handleDecrement = () => {
    if ((book.copyCount || 1) > 1) {
      const nextVal = (book.copyCount || 1) - 1;
      setCopyCountInput(String(nextVal));
      setCopyCountError(null);
      onUpdateCopyCount(book.id, nextVal);
    }
  };

  const handleUseSuggestedTitle = () => {
    if (book.suggestedTitle) {
      setLocalReviewedText(book.suggestedTitle);
      onUpdateReviewedText(book.id, book.suggestedTitle);
    }
  };

  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
        isSelected ? 'border-blue-500 bg-blue-50/20 ring-1 ring-blue-500' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {/* Identificação e Cabeçalho do Cartão */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id={`select-book-${book.id}`}
            checked={isSelected}
            onChange={() => onToggleSelect(book.id)}
            aria-label={`Selecionar ${formattedSeq}`}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-base font-bold text-slate-900">{formattedSeq}</h3>
              {book.selectedAngle !== undefined && book.selectedAngle !== 0 && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                  {book.selectedAngle}°
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {book.ocrStatus === 'reliable' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Extração Confiável
                </span>
              )}
              {book.ocrStatus === 'needs_review' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-3 w-3 text-amber-600" /> Revisão Recomendada
                </span>
              )}
              {book.ocrStatus === 'completed' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> OCR Concluído
                </span>
              )}
              {book.ocrStatus === 'failed' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="h-3 w-3 text-rose-600" /> Falha de OCR
                </span>
              )}
              {book.ocrStatus === 'pending' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Clock className="h-3.5 w-3.5" /> Pendente
                </span>
              )}
              {book.confidence !== undefined && book.confidence > 0 && (
                <span className="text-[11px] text-slate-500 font-mono">
                  ({book.confidence}% conf.)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ações da Capa (sessão temporária), Rotação e Excluir Livro */}
        <div className="flex flex-wrap items-center gap-2">
          {tempPhotoUrl ? (
            <>
              <button
                type="button"
                onClick={() => onPreviewPhoto(tempPhotoUrl, formattedSeq)}
                aria-label={`Visualizar foto temporária da capa de ${formattedSeq}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-blue-400"
              >
                <ImageIcon className="h-3.5 w-3.5 text-blue-600" />
                Ver Foto da Sessão
              </button>

              {onRotatePhoto && (
                <div className="inline-flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={() => onRotatePhoto(book.id, 'ccw')}
                    title="Girar foto 90° para esquerda (anti-horário)"
                    aria-label={`Girar 90 graus para a esquerda ${formattedSeq}`}
                    className="inline-flex items-center rounded-l-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-400"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRotatePhoto(book.id, 'cw')}
                    title="Girar foto 90° para direita (horário)"
                    aria-label={`Girar 90 graus para a direita ${formattedSeq}`}
                    className="inline-flex items-center rounded-r-md border border-l-0 border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-400"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {onReprocessOcr && (
                <button
                  type="button"
                  onClick={() => onReprocessOcr(book.id)}
                  disabled={isReprocessing}
                  title="Reprocessar OCR desta capa na orientação atual"
                  aria-label={`Reprocessar OCR de ${formattedSeq}`}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 focus:ring-2 focus:ring-blue-400"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
                  Reprocessar OCR
                </button>
              )}
            </>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400"
              title="A foto original não fica salva no banco de dados. Foi descartada ao fechar/recarregar a sessão."
            >
              (Sem foto em sessão)
            </span>
          )}

          <button
            type="button"
            onClick={() => onDeleteBook(book.id)}
            aria-label={`Remover ${formattedSeq}`}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Título Sugerido em Destaque */}
      {book.suggestedTitle && (
        <div className="mt-3.5 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/60 px-3.5 py-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Sparkles className="h-4 w-4 shrink-0 text-indigo-600" />
            <div className="truncate">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800">
                Título Sugerido:{' '}
              </span>
              <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                {book.suggestedTitle}
              </span>
            </div>
          </div>
          {localReviewedText !== book.suggestedTitle && (
            <button
              type="button"
              onClick={handleUseSuggestedTitle}
              className="shrink-0 text-xs font-medium text-indigo-700 hover:text-indigo-900 underline ml-2"
            >
              Usar no Texto
            </button>
          )}
        </div>
      )}

      <div className="mt-3.5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Texto OCR Bruto (Coluna 5) */}
        <div className="lg:col-span-5 rounded-lg border border-slate-100 bg-slate-50 p-3.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Texto OCR Bruto
          </label>
          <div className="mt-1.5 min-h-[5rem] max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-slate-700">
            {book.rawOcrText ? (
              book.rawOcrText
            ) : book.ocrStatus === 'failed' ? (
              <span className="italic text-red-500">
                {book.errorMessage || 'Falha ao processar texto desta capa.'}
              </span>
            ) : (
              <span className="italic text-slate-400">Nenhum texto detectado pelo OCR</span>
            )}
          </div>
        </div>

        {/* Texto Revisado (Coluna 5) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`reviewed-text-${book.id}`}
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              Texto Revisado <span className="font-normal lowercase text-slate-400">(editável)</span>
            </label>
            <Edit3 className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <textarea
            id={`reviewed-text-${book.id}`}
            rows={3}
            value={localReviewedText}
            placeholder={book.suggestedTitle || book.rawOcrText || 'Digite o texto revisado aqui...'}
            onFocus={() => setIsEditingText(true)}
            onChange={(e) => setLocalReviewedText(e.target.value)}
            onBlur={handleReviewedTextBlur}
            className={`mt-1.5 flex-1 w-full rounded-md border p-2 text-xs shadow-sm transition-colors focus:ring-2 ${
              isEditingText
                ? 'border-blue-500 focus:ring-blue-500'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          />
        </div>

        {/* Quantidade de Exemplares (Coluna 2) */}
        <div className="lg:col-span-2 flex flex-col justify-start rounded-lg border border-slate-100 bg-slate-50/50 p-3">
          <label
            htmlFor={`copy-count-${book.id}`}
            className="block text-center text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            Exemplares
          </label>

          <div className="mt-2 flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={(book.copyCount || 1) <= 1}
              aria-label={`Diminuir exemplares de ${formattedSeq}`}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 focus:ring-2 focus:ring-blue-400"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            <input
              id={`copy-count-${book.id}`}
              type="number"
              min={1}
              step={1}
              value={copyCountInput}
              onChange={(e) => handleCopyCountChange(e.target.value)}
              aria-label={`Quantidade de exemplares de ${formattedSeq}`}
              className="h-8 w-12 rounded border border-slate-300 bg-white text-center text-sm font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-400"
            />

            <button
              type="button"
              onClick={handleIncrement}
              aria-label={`Aumentar exemplares de ${formattedSeq}`}
              className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 focus:ring-2 focus:ring-blue-400"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {copyCountError && (
            <p role="alert" className="mt-1 text-center font-medium text-[10px] text-red-600">
              {copyCountError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
