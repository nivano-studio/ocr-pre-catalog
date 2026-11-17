import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Upload,
  Download,
  Search,
  Trash2,
  AlertCircle,
  FileText,
  Layers,
  Hash,
  Info,
  Cpu,
} from 'lucide-react';
import type { ShelfRecord } from '../domain/shelf';
import type { BookRecord, OcrStatus } from '../domain/book';
import { calculateShelfTotals } from '../domain/shelf';
import { validateFileBatch, type RejectedFileInfo } from '../domain/batchValidation';
import {
  createQueueItem,
  updateQueueItemStatus,
  calculateQueueSummary,
  cancelRemainingQueue,
  type QueueItem,
} from '../domain/queue';
import { generateShelfTxtContent, sanitizeExportFileName, validateTxtExport } from '../domain/txtExport';
import { getDatabase } from '../storage/db';
import { getActiveOcrService } from '../services/ocrService';
import { preprocessImage } from '../services/imagePreprocessor';
import { BookCard } from './BookCard';
import { OcrQueueView } from './OcrQueueView';
import { ImagePreviewModal } from './ImagePreviewModal';
import { ConfirmationModal } from './ConfirmationModal';

interface ShelfDetailProps {
  shelf: ShelfRecord;
  onBack: () => void;
}

export const ShelfDetail: React.FC<ShelfDetailProps> = ({ shelf, onBack }) => {
  const db = getDatabase();

  const [books, setBooks] = useState<BookRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());

  // Fila de processamento OCR
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const queueFilesMapRef = useRef<Map<string, File>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mapeamento em memória da sessão: bookId -> temporary Object URL e bookId -> Blob
  // Descartado ao recarregar ou fechar a página (nunca persistido no IndexedDB)
  const [sessionPhotos, setSessionPhotos] = useState<Map<string, string>>(new Map());
  const sessionFilesMapRef = useRef<Map<string, Blob | File>>(new Map());
  const [reprocessingBookIds, setReprocessingBookIds] = useState<Set<string>>(new Set());

  // Status de conexão do serviço local OCR
  const [ocrEngineInfo, setOcrEngineInfo] = useState<{ online: boolean; engine?: string }>({
    online: false,
  });

  // Alertas e Rejeições da importação
  const [batchWarnings, setBatchWarnings] = useState<string | null>(null);
  const [rejectedFilesList, setRejectedFilesList] = useState<RejectedFileInfo[]>([]);

  // Modais
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: 'single' | 'selected';
    bookId?: string;
  }>({ isOpen: false, type: 'selected' });

  // Carrega livros do IndexedDB
  const loadBooks = useCallback(async () => {
    const list = await db.books.where('shelfId').equals(shelf.id).sortBy('sequenceNumber');
    setBooks(list);
  }, [db, shelf.id]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Checa saúde do microserviço OCR local
  useEffect(() => {
    const service = getActiveOcrService();
    if (service.checkHealth) {
      service
        .checkHealth()
        .then((res) => setOcrEngineInfo(res))
        .catch(() => setOcrEngineInfo({ online: false }));
    }
  }, []);

  // Libera Object URLs ao desmontar componente
  useEffect(() => {
    const photos = sessionPhotos;
    return () => {
      photos.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // No-op
        }
      });
    };
  }, [sessionPhotos]);

  // Processador sequencial da fila de OCR (1 imagem por vez)
  const processNextInQueue = useCallback(async () => {
    if (isQueueRunning) return;

    const pendingItem = queue.find((item) => item.status === 'pending');
    if (!pendingItem) {
      setIsQueueRunning(false);
      return;
    }

    setIsQueueRunning(true);
    abortControllerRef.current = new AbortController();

    const file = queueFilesMapRef.current.get(pendingItem.id);
    if (!file) {
      setQueue((prev) =>
        prev.map((it) =>
          it.id === pendingItem.id
            ? updateQueueItemStatus(it, 'failed', { errorMessage: 'Arquivo não encontrado na sessão' })
            : it
        )
      );
      setIsQueueRunning(false);
      return;
    }

    // 1. Marca item como 'processing'
    setQueue((prev) =>
      prev.map((it) => (it.id === pendingItem.id ? updateQueueItemStatus(it, 'processing') : it))
    );

    let rawOcrText = '';
    let suggestedTitle = '';
    let confidence = 0;
    let selectedAngle = 0;
    let ocrStatus: OcrStatus = 'completed';
    let errorMessage: string | undefined = undefined;

    try {
      // 2. Pré-processamento individual
      const { processedBlob, cleanup } = await preprocessImage(file);

      // 3. Reconhecimento OCR local
      const ocrService = getActiveOcrService();
      const result = await ocrService.recognize(processedBlob);
      cleanup();

      rawOcrText = result.rawText || result.text;
      suggestedTitle = result.suggestedTitle || result.text;
      confidence = result.confidence;
      selectedAngle = result.selectedAngle || 0;
      ocrStatus = result.status || 'completed';
    } catch (err) {
      ocrStatus = 'failed';
      errorMessage = err instanceof Error ? err.message : 'Falha no processamento OCR.';
    }

    // 4. Salva livro provisório no IndexedDB (apenas dados de texto)
    try {
      const nextSeq = await db.getNextSequenceNumber(shelf.id);
      const newBookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const newBook: BookRecord = {
        id: newBookId,
        shelfId: shelf.id,
        sequenceNumber: nextSeq,
        rawOcrText,
        suggestedTitle,
        confidence,
        selectedAngle,
        reviewedText: suggestedTitle || rawOcrText, // Pré-preenchido com o título sugerido
        copyCount: 1, // Padrão 1
        ocrStatus,
        errorMessage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.books.add(newBook);

      // Associa os dados temporários da sessão a este bookId (apenas em memória RAM)
      if (pendingItem.tempImageUrl) {
        setSessionPhotos((prev) => {
          const updated = new Map(prev);
          updated.set(newBookId, pendingItem.tempImageUrl!);
          return updated;
        });
        sessionFilesMapRef.current.set(newBookId, file);
      }

      await loadBooks();
    } catch (dbErr) {
      console.error('Erro ao persistir livro no IndexedDB:', dbErr);
    }

    // 5. Atualiza status na fila
    setQueue((prev) =>
      prev.map((it) =>
        it.id === pendingItem.id
          ? updateQueueItemStatus(it, ocrStatus === 'failed' ? 'failed' : 'completed', {
              rawOcrText,
              errorMessage,
            })
          : it
      )
    );

    setIsQueueRunning(false);
  }, [db, isQueueRunning, loadBooks, queue, shelf.id]);

  useEffect(() => {
    const hasPending = queue.some((it) => it.status === 'pending');
    if (hasPending && !isQueueRunning) {
      processNextInQueue();
    }
  }, [queue, isQueueRunning, processNextInQueue]);

  // Rotação manual da imagem na sessão (em memória via Canvas)
  const handleRotatePhoto = async (bookId: string, direction: 'cw' | 'ccw') => {
    const currentUrl = sessionPhotos.get(bookId);
    if (!currentUrl) return;

    try {
      const img = new Image();
      img.src = currentUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Erro ao carregar imagem para rotação'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (direction === 'cw') {
        ctx.translate(canvas.width, 0);
        ctx.rotate((90 * Math.PI) / 180);
      } else {
        ctx.translate(0, canvas.height);
        ctx.rotate((-90 * Math.PI) / 180);
      }
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return;
        try {
          URL.revokeObjectURL(currentUrl);
        } catch {
          // No-op
        }
        const newUrl = URL.createObjectURL(blob);
        setSessionPhotos((prev) => {
          const updated = new Map(prev);
          updated.set(bookId, newUrl);
          return updated;
        });
        sessionFilesMapRef.current.set(bookId, blob);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Erro ao girar imagem:', err);
    }
  };

  // Reprocessamento de OCR individual para um livro existente na sessão
  const handleReprocessOcr = async (bookId: string) => {
    const blob = sessionFilesMapRef.current.get(bookId);
    if (!blob) return;

    setReprocessingBookIds((prev) => new Set(prev).add(bookId));
    try {
      const { processedBlob, cleanup } = await preprocessImage(blob);
      const ocrService = getActiveOcrService();
      const result = await ocrService.recognize(processedBlob);
      cleanup();

      const rawOcrText = result.rawText || result.text;
      const suggestedTitle = result.suggestedTitle || result.text;

      await db.books.update(bookId, {
        rawOcrText,
        suggestedTitle,
        reviewedText: suggestedTitle || rawOcrText,
        confidence: result.confidence,
        selectedAngle: result.selectedAngle,
        ocrStatus: result.status || 'completed',
        errorMessage: undefined,
        updatedAt: new Date().toISOString(),
      });

      await loadBooks();
    } catch (err) {
      console.error('Erro ao reprocessar OCR:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao reprocessar OCR';
      await db.books.update(bookId, {
        ocrStatus: 'failed',
        errorMessage: msg,
        updatedAt: new Date().toISOString(),
      });
      await loadBooks();
    } finally {
      setReprocessingBookIds((prev) => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
    }
  };

  // Importação e validação de arquivos
  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setBatchWarnings(null);
    setRejectedFilesList([]);

    const filesArray = Array.from(fileList);
    const validation = validateFileBatch(filesArray);

    if (!validation.isValid && validation.globalError) {
      setBatchWarnings(validation.globalError);
      setRejectedFilesList(validation.rejectedFiles);
      return;
    }

    if (validation.rejectedFiles.length > 0) {
      setRejectedFilesList(validation.rejectedFiles);
    }

    if (validation.hasExceededRecommendedCount) {
      setBatchWarnings(
        `Atenção: O lote contém ${validation.acceptedFiles.length} imagens. Recomendamos até 50 imagens por lote para melhor revisão visual.`
      );
    }

    if (validation.acceptedFiles.length === 0) return;

    // Constrói itens da fila mantendo apenas referências de sessão
    const newQueueItems: QueueItem[] = [];
    validation.acceptedFiles.forEach((file) => {
      const tempUrl = URL.createObjectURL(file);
      const item = createQueueItem(file.name, file.size, tempUrl);
      newQueueItems.push(item);
      queueFilesMapRef.current.set(item.id, file);
    });

    setQueue((prev) => [...prev, ...newQueueItems]);
  };

  // Cancelamento da fila
  const handleCancelQueue = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setQueue((prev) => cancelRemainingQueue(prev));
    setIsQueueRunning(false);
  };

  // Repetição de item falho na fila
  const handleRetryQueueItem = (item: QueueItem) => {
    setQueue((prev) =>
      prev.map((it) => (it.id === item.id ? updateQueueItemStatus(it, 'pending') : it))
    );
  };

  // Atualizações de texto revisado e quantidade de exemplares
  const handleUpdateReviewedText = async (bookId: string, newText: string) => {
    await db.updateBookReviewedText(bookId, newText);
    await loadBooks();
  };

  const handleUpdateCopyCount = async (bookId: string, count: number) => {
    await db.updateBookCopyCount(bookId, count);
    await loadBooks();
  };

  // Exclusão de livros
  const handleDeleteSingleBook = (bookId: string) => {
    setDeleteConfirmation({
      isOpen: true,
      type: 'single',
      bookId,
    });
  };

  const handleDeleteSelectedBooks = () => {
    if (selectedBookIds.size === 0) return;
    setDeleteConfirmation({
      isOpen: true,
      type: 'selected',
    });
  };

  const confirmDelete = async () => {
    if (deleteConfirmation.type === 'single' && deleteConfirmation.bookId) {
      await db.deleteBooks([deleteConfirmation.bookId]);
      const url = sessionPhotos.get(deleteConfirmation.bookId);
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // No-op
        }
        setSessionPhotos((prev) => {
          const m = new Map(prev);
          m.delete(deleteConfirmation.bookId!);
          return m;
        });
        sessionFilesMapRef.current.delete(deleteConfirmation.bookId);
      }
      setSelectedBookIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteConfirmation.bookId!);
        return next;
      });
    } else if (deleteConfirmation.type === 'selected') {
      const ids = Array.from(selectedBookIds);
      await db.deleteBooks(ids);
      ids.forEach((id) => {
        const url = sessionPhotos.get(id);
        if (url) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // No-op
          }
        }
        sessionFilesMapRef.current.delete(id);
      });
      setSessionPhotos((prev) => {
        const m = new Map(prev);
        ids.forEach((id) => m.delete(id));
        return m;
      });
      setSelectedBookIds(new Set());
    }

    setDeleteConfirmation({ isOpen: false, type: 'selected' });
    await loadBooks();
  };

  // Seleção de livros
  const toggleSelectBook = (bookId: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedBookIds.size === filteredBooks.length && filteredBooks.length > 0) {
      setSelectedBookIds(new Set());
    } else {
      setSelectedBookIds(new Set(filteredBooks.map((b) => b.id)));
    }
  };

  // Exportação TXT
  const handleExportTxt = () => {
    if (books.length === 0) {
      alert('Não há livros para exportar.');
      return;
    }

    const txtContent = generateShelfTxtContent(shelf, books);
    const val = validateTxtExport(txtContent);
    if (!val.isValid) {
      alert(val.error || 'Não foi possível validar o arquivo de exportação.');
      return;
    }

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const fileName = sanitizeExportFileName(shelf.name);

    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  // Busca e totais
  const filteredBooks = books.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const raw = (b.rawOcrText || '').toLowerCase();
    const rev = (b.reviewedText || '').toLowerCase();
    const title = (b.suggestedTitle || '').toLowerCase();
    return raw.includes(q) || rev.includes(q) || title.includes(q);
  });

  const totals = calculateShelfTotals(books);
  const queueSummary = calculateQueueSummary(queue);

  return (
    <div className="space-y-6">
      {/* Barra de Navegação Superior */}
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar para a lista de prateleiras"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{shelf.name}</h1>
              {/* Indicador do Motor de OCR Local */}
              <div
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px]"
                title={
                  ocrEngineInfo.online
                    ? 'Motor local RapidOCR PP-OCRv4 conectado via 127.0.0.1:5001'
                    : 'Operando via Tesseract.js local no navegador'
                }
              >
                <Cpu className="h-3.5 w-3.5 text-slate-500" />
                {ocrEngineInfo.online ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-emerald-800">RapidOCR Local (ONNX)</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="font-semibold text-amber-800">Tesseract.js (Navegador)</span>
                  </>
                )}
              </div>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Criada em: {new Date(shelf.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportTxt}
            disabled={books.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Exportar TXT
          </button>

          {selectedBookIds.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelectedBooks}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 focus:ring-2 focus:ring-red-400"
            >
              <Trash2 className="h-4 w-4" />
              Excluir Selecionados ({selectedBookIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Cartões de Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Hash className="h-4 w-4 text-blue-600" />
            <span>Total de Livros</span>
          </div>
          <p id="total-books-indicator" className="mt-2 text-2xl font-bold text-slate-900">
            {totals.totalBooks}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Layers className="h-4 w-4 text-emerald-600" />
            <span>Total de Exemplares</span>
          </div>
          <p id="total-copies-indicator" className="mt-2 text-2xl font-bold text-slate-900">
            {totals.totalCopies}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <FileText className="h-4 w-4 text-amber-600" />
            <span>Formato Aceito</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-700">JPG, JPEG, PNG, WebP</p>
          <span className="text-[10px] text-slate-400">Até 20 MB/foto</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Info className="h-4 w-4 text-indigo-600" />
            <span>Limite do Lote</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-700">Recomendado: 50 fotos</p>
          <span className="text-[10px] text-slate-400">Máx absoluto: 100 fotos / 500 MB</span>
        </div>
      </div>

      {/* Área de Importação e Drag-and-Drop */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFilesSelected(e.dataTransfer.files);
        }}
        className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/30 p-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50"
      >
        <Upload className="h-10 w-10 text-blue-500" />
        <h2 className="mt-3 text-sm font-semibold text-slate-800">
          Arraste e solte fotos das capas dos livros aqui
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          ou clique no botão abaixo para selecionar arquivos do seu computador
        </p>

        <label
          htmlFor="file-upload-input"
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus-within:ring-2 focus-within:ring-blue-400"
        >
          <Upload className="h-4 w-4" />
          Selecionar Capas de Livros
          <input
            id="file-upload-input"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </label>
      </div>

      {/* Avisos de Lote e Arquivos Rejeitados */}
      {batchWarnings && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Aviso sobre o lote:</p>
            <p className="mt-0.5">{batchWarnings}</p>
          </div>
        </div>
      )}

      {rejectedFilesList.length > 0 && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800"
        >
          <div className="flex items-center gap-2 font-semibold text-red-900">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span>Arquivos rejeitados ({rejectedFilesList.length}):</span>
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {rejectedFilesList.map((item, idx) => (
              <li key={idx}>
                <strong>{item.fileName}</strong>: {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Visualização da Fila de OCR */}
      <OcrQueueView
        queueItems={queue}
        summary={queueSummary}
        isProcessing={isQueueRunning}
        onCancelQueue={handleCancelQueue}
        onRetryItem={handleRetryQueueItem}
      />

      {/* Barra de Busca e Seleção de Livros */}
      {books.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, texto OCR ou revisado..."
              aria-label="Buscar livros na prateleira"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              {selectedBookIds.size === filteredBooks.length && filteredBooks.length > 0
                ? 'Desmarcar todos'
                : 'Selecionar todos'}
            </button>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-500">
              Exibindo {filteredBooks.length} de {books.length} livros
            </span>
          </div>
        </div>
      )}

      {/* Lista de Livros Cadastrados */}
      {filteredBooks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
          {books.length === 0
            ? 'Nenhum livro importado nesta prateleira ainda. Adicione fotos de capas acima.'
            : 'Nenhum livro corresponde ao filtro de busca.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              tempPhotoUrl={sessionPhotos.get(book.id) || null}
              isSelected={selectedBookIds.has(book.id)}
              onToggleSelect={toggleSelectBook}
              onUpdateReviewedText={handleUpdateReviewedText}
              onUpdateCopyCount={handleUpdateCopyCount}
              onDeleteBook={handleDeleteSingleBook}
              onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
              onRotatePhoto={handleRotatePhoto}
              onReprocessOcr={handleReprocessOcr}
              isReprocessing={reprocessingBookIds.has(book.id)}
            />
          ))}
        </div>
      )}

      {/* Modal de Pré-visualização de Imagem em Sessão */}
      <ImagePreviewModal
        isOpen={!!previewPhoto}
        imageUrl={previewPhoto?.url || null}
        bookTitle={previewPhoto?.title || ''}
        onClose={() => setPreviewPhoto(null)}
      />

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Confirmar Exclusão"
        message={
          deleteConfirmation.type === 'single'
            ? 'Tem certeza de que deseja excluir este livro provisório? Esta ação é irreversível.'
            : `Tem certeza de que deseja excluir os ${selectedBookIds.size} livros selecionados? Esta ação é irreversível.`
        }
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmation({ isOpen: false, type: 'selected' })}
      />
    </div>
  );
};
