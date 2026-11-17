import React, { useState, useEffect, useRef } from 'react';
import { X, BookPlus } from 'lucide-react';
import { validateShelfName } from '../domain/shelf';

interface CreateShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export const CreateShelfModal: React.FC<CreateShelfModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateShelfName(name);
    if (!validation.isValid || !validation.cleanName) {
      setError(validation.error || 'Nome inválido.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onCreate(validation.cleanName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar prateleira.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-shelf-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-slate-800">
            <BookPlus className="h-5 w-5 text-blue-600" />
            <h2 id="create-shelf-modal-title" className="text-lg font-semibold">
              Criar Nova Prateleira
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de criação de prateleira"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          <div>
            <label htmlFor="shelf-name-input" className="block text-sm font-medium text-slate-700">
              Nome da Prateleira <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              id="shelf-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: Literatura Brasileira, Coleção de História..."
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            {error && (
              <p role="alert" className="mt-1 text-sm font-medium text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-slate-400"
            >
              Cancelar
            </button>
            <button
              id="submit-create-shelf-btn"
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Prateleira'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
