export type QueueStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface QueueItem {
  id: string;
  fileName: string;
  position: number;
  status: QueueStatus;
  rawOcrText?: string;
  errorMessage?: string;
  tempImageUrl?: string;
}

export interface QueueSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  processing: number;
  pending: number;
  cancelled: number;
  progressPercent: number;
}

export function createQueueItem(
  fileName: string,
  position: number,
  tempImageUrl?: string
): QueueItem {
  return {
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    fileName,
    position,
    status: 'pending',
    tempImageUrl,
  };
}

export function updateQueueItemStatus(
  item: QueueItem,
  status: QueueStatus,
  extra?: { rawOcrText?: string; errorMessage?: string }
): QueueItem {
  return {
    ...item,
    status,
    rawOcrText: extra?.rawOcrText !== undefined ? extra.rawOcrText : item.rawOcrText,
    errorMessage: extra?.errorMessage !== undefined ? extra.errorMessage : item.errorMessage,
  };
}

export function calculateQueueSummary(items: QueueItem[]): QueueSummary {
  const total = items.length;
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let processing = 0;
  let pending = 0;
  let cancelled = 0;

  for (const item of items) {
    switch (item.status) {
      case 'completed':
        completed++;
        break;
      case 'failed':
        failed++;
        break;
      case 'skipped':
        skipped++;
        break;
      case 'processing':
        processing++;
        break;
      case 'pending':
        pending++;
        break;
      case 'cancelled':
        cancelled++;
        break;
    }
  }

  // Itens finalizados ou não acionáveis no progresso
  const processedCount = completed + failed + skipped + cancelled;
  const progressPercent = total > 0 ? Math.round((processedCount / total) * 100) : 0;

  return {
    total,
    completed,
    failed,
    skipped,
    processing,
    pending,
    cancelled,
    progressPercent,
  };
}

export function cancelRemainingQueue(items: QueueItem[]): QueueItem[] {
  return items.map((item) => {
    if (item.status === 'pending' || item.status === 'processing') {
      return {
        ...item,
        status: 'cancelled',
      };
    }
    return item;
  });
}
