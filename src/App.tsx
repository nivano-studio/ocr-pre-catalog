import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ShelfList, type ShelfWithCounts } from './components/ShelfList';
import { ShelfDetail } from './components/ShelfDetail';
import { CreateShelfModal } from './components/CreateShelfModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { getDatabase } from './storage/db';
import type { ShelfRecord } from './domain/shelf';

export const App: React.FC = () => {
  const db = getDatabase();

  const [shelves, setShelves] = useState<ShelfWithCounts[]>([]);
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [shelfToDelete, setShelfToDelete] = useState<ShelfWithCounts | null>(null);

  const loadShelves = useCallback(async () => {
    const allShelves = await db.shelves.toArray();
    const withCounts: ShelfWithCounts[] = await Promise.all(
      allShelves.map(async (shelf) => {
        const books = await db.books.where('shelfId').equals(shelf.id).toArray();
        const totalBooks = books.length;
        const totalCopies = books.reduce((sum, b) => sum + (b.copyCount || 1), 0);
        return {
          ...shelf,
          totalBooks,
          totalCopies,
        };
      })
    );
    // Ordena da mais recente para a mais antiga
    withCounts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setShelves(withCounts);
  }, [db]);

  useEffect(() => {
    loadShelves();
  }, [loadShelves]);

  const handleCreateShelf = async (name: string) => {
    const newShelfId = `shelf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newShelf: ShelfRecord = {
      id: newShelfId,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.shelves.add(newShelf);
    await loadShelves();
    setActiveShelfId(newShelfId);
  };

  const handleConfirmDeleteShelf = async () => {
    if (!shelfToDelete) return;
    await db.deleteShelfWithBooks(shelfToDelete.id);
    if (activeShelfId === shelfToDelete.id) {
      setActiveShelfId(null);
    }
    setShelfToDelete(null);
    await loadShelves();
  };

  const activeShelf = shelves.find((s) => s.id === activeShelfId);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {activeShelf ? (
          <ShelfDetail
            shelf={activeShelf}
            onBack={() => {
              setActiveShelfId(null);
              loadShelves();
            }}
          />
        ) : (
          <ShelfList
            shelves={shelves}
            onOpenShelf={(id) => setActiveShelfId(id)}
            onRequestDeleteShelf={(s) => setShelfToDelete(s)}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />
        )}
      </main>

      {/* Modal para Criação de Prateleira */}
      <CreateShelfModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateShelf}
      />

      {/* Modal de Confirmação para Excluir Prateleira */}
      <ConfirmationModal
        isOpen={!!shelfToDelete}
        title="Excluir Prateleira"
        message={`Tem certeza de que deseja excluir permanentemente a prateleira "${shelfToDelete?.name}" e todos os livros contidos nela?`}
        confirmLabel="Sim, excluir prateleira"
        cancelLabel="Cancelar"
        isDestructive
        onConfirm={handleConfirmDeleteShelf}
        onCancel={() => setShelfToDelete(null)}
      />
    </div>
  );
};

export default App;
