import { describe, it, expect } from 'vitest';
import {
  createQueueItem,
  updateQueueItemStatus,
  calculateQueueSummary,
  cancelRemainingQueue,
  type QueueItem,
} from '@/domain/queue';

describe('Domain: Queue State & Transitions', () => {
  it('deve inicializar item de fila com status pending', () => {
    const item = createQueueItem('capa.jpg', 1);
    expect(item.id).toBeDefined();
    expect(item.fileName).toBe('capa.jpg');
    expect(item.position).toBe(1);
    expect(item.status).toBe('pending');
  });

  it('deve permitir transições válidas de status', () => {
    const item = createQueueItem('capa.jpg', 1);
    const processing = updateQueueItemStatus(item, 'processing');
    expect(processing.status).toBe('processing');

    const completed = updateQueueItemStatus(processing, 'completed', { rawOcrText: 'TEXTO CAPA' });
    expect(completed.status).toBe('completed');
    expect(completed.rawOcrText).toBe('TEXTO CAPA');

    const failed = updateQueueItemStatus(processing, 'failed', { errorMessage: 'Falha no OCR' });
    expect(failed.status).toBe('failed');
    expect(failed.errorMessage).toBe('Falha no OCR');
  });

  it('deve calcular sumário correto da fila', () => {
    const items: QueueItem[] = [
      { id: '1', fileName: '1.jpg', position: 1, status: 'completed' },
      { id: '2', fileName: '2.jpg', position: 2, status: 'completed' },
      { id: '3', fileName: '3.jpg', position: 3, status: 'failed', errorMessage: 'Erro' },
      { id: '4', fileName: '4.jpg', position: 4, status: 'skipped' },
      { id: '5', fileName: '5.jpg', position: 5, status: 'processing' },
      { id: '6', fileName: '6.jpg', position: 6, status: 'pending' },
    ];

    const summary = calculateQueueSummary(items);
    expect(summary.total).toBe(6);
    expect(summary.completed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.processing).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.progressPercent).toBe(Math.round(((2 + 1 + 1) / 6) * 100));
  });

  it('deve cancelar apenas itens pendentes, preservando os já concluídos e com falha', () => {
    const items: QueueItem[] = [
      { id: '1', fileName: '1.jpg', position: 1, status: 'completed' },
      { id: '2', fileName: '2.jpg', position: 2, status: 'failed', errorMessage: 'Erro' },
      { id: '3', fileName: '3.jpg', position: 3, status: 'processing' },
      { id: '4', fileName: '4.jpg', position: 4, status: 'pending' },
    ];

    const updated = cancelRemainingQueue(items);
    expect(updated[0].status).toBe('completed');
    expect(updated[1].status).toBe('failed');
    expect(updated[2].status).toBe('cancelled');
    expect(updated[3].status).toBe('cancelled');
  });
});
