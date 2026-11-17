import React from 'react';
import { Library, FolderOpen, Trash2, Plus, Calendar, Layers, Hash } from 'lucide-react';
import type { ShelfRecord } from '../domain/shelf';

export interface ShelfWithCounts extends ShelfRecord {
  totalBooks: number;
  totalCopies: number;
}

interface ShelfListProps {
  shelves: ShelfWithCounts[];
  onOpenShelf: (shelfId: string) => void;
  onRequestDeleteShelf: (shelf: ShelfWithCounts) => void;
  onOpenCreateModal: () => void;
}

export const ShelfList: React.FC<ShelfListProps> = ({
  shelves,
  onOpenShelf,
  onRequestDeleteShelf,
  onOpenCreateModal,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Minhas Prateleiras
          </h1>
          <p className="text-sm text-slate-500">
            Gerencie suas prateleiras e catalogação preliminar de livros com OCR local
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4" />
          Nova Prateleira
        </button>
      </div>

      {shelves.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <Library className="h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-base font-semibold text-slate-800">
            Nenhuma prateleira encontrada
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-sm">
            Crie sua primeira prateleira para começar a importar capas de livros e catalogar via OCR local.
          </p>
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4" />
            Criar Prateleira
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shelves.map((shelf) => (
            <div
              key={shelf.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 line-clamp-1" title={shelf.name}>
                    {shelf.name}
                  </h2>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Criada em: {new Date(shelf.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Hash className="h-4 w-4 text-slate-400" />
                    <span>
                      <strong className="text-slate-900">{shelf.totalBooks}</strong> {shelf.totalBooks === 1 ? 'livro' : 'livros'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Layers className="h-4 w-4 text-slate-400" />
                    <span>
                      <strong className="text-slate-900">{shelf.totalCopies}</strong> {shelf.totalCopies === 1 ? 'exemplar' : 'exemplares'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => onOpenShelf(shelf.id)}
                  aria-label={`Abrir prateleira ${shelf.name}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  <FolderOpen className="h-4 w-4" />
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={() => onRequestDeleteShelf(shelf)}
                  aria-label={`Excluir prateleira ${shelf.name}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
