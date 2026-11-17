import React from 'react';
import { Play, XCircle, RotateCcw, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import type { QueueItem, QueueSummary } from '../domain/queue';

interface OcrQueueViewProps {
  queueItems: QueueItem[];
  summary: QueueSummary;
  isProcessing: boolean;
  onCancelQueue: () => void;
  onRetryItem: (item: QueueItem) => void;
}

export const OcrQueueView: React.FC<OcrQueueViewProps> = ({
  queueItems,
  summary,
  isProcessing,
  onCancelQueue,
  onRetryItem,
}) => {
  if (queueItems.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            ) : (
              <Play className="h-5 w-5 text-slate-700" />
            )}
            <h2 className="text-base font-semibold text-slate-900">
              Fila de Processamento OCR {isProcessing ? '(Processando 1 por vez...)' : '(Finalizada / Pausada)'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Processamento 100% local sem envio de imagens ou texto para servidores externos.
          </p>
        </div>

        {isProcessing && (
          <button
            type="button"
            onClick={onCancelQueue}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 focus:ring-2 focus:ring-red-400"
          >
            <XCircle className="h-4 w-4" />
            Cancelar Fila Restante
          </button>
        )}
      </div>

      {/* Barra de Progresso */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>Progresso Geral: {summary.progressPercent}%</span>
          <span>
            {summary.completed + summary.failed + summary.skipped + summary.cancelled} de {summary.total} processados
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${summary.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Indicadores de Status */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 p-2 text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>
            Concluídos: <strong>{summary.completed}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-red-50 p-2 text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span>
            Falhou: <strong>{summary.failed}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-amber-800">
          <Clock className="h-4 w-4 text-amber-600" />
          <span>
            Pendentes: <strong>{summary.pending}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 p-2 text-blue-800">
          <Loader2 className="h-4 w-4 text-blue-600" />
          <span>
            Em andamento: <strong>{summary.processing}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2 text-slate-700">
          <XCircle className="h-4 w-4 text-slate-400" />
          <span>
            Cancelados: <strong>{summary.cancelled}</strong>
          </span>
        </div>
      </div>

      {/* Lista dos Itens da Fila */}
      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
        {queueItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-2.5 text-xs">
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="font-mono text-slate-400 w-8">#{item.position}</span>
              <span className="font-medium text-slate-800 truncate max-w-xs sm:max-w-md" title={item.fileName}>
                {item.fileName}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {item.status === 'pending' && (
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                  <Clock className="h-3 w-3" /> Pendente
                </span>
              )}
              {item.status === 'processing' && (
                <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" /> Processando OCR
                </span>
              )}
              {item.status === 'completed' && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Concluído
                </span>
              )}
              {item.status === 'failed' && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 font-medium text-red-800" title={item.errorMessage}>
                    <AlertCircle className="h-3 w-3 text-red-600" /> Falhou
                  </span>
                  {item.tempImageUrl && (
                    <button
                      type="button"
                      onClick={() => onRetryItem(item)}
                      aria-label={`Repetir OCR para ${item.fileName}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      <RotateCcw className="h-3 w-3" /> Repetir
                    </button>
                  )}
                </div>
              )}
              {item.status === 'cancelled' && (
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                  <XCircle className="h-3 w-3" /> Cancelado
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
