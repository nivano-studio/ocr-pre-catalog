import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  bookTitle: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  imageUrl,
  bookTitle,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-lg bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 id="image-preview-title" className="text-base font-semibold text-slate-800">
            Foto da Capa (Sessão Ativa): {bookTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar visualização da foto"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="mt-4 flex max-h-[75vh] items-center justify-center overflow-auto">
          <img
            src={imageUrl}
            alt={`Capa original para ${bookTitle}`}
            className="max-h-[70vh] max-w-full rounded object-contain"
          />
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          Nota: Esta foto existe apenas temporariamente na memória da sessão atual e não é salva no banco de dados.
        </p>
      </div>
    </div>
  );
};
