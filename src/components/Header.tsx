import React from 'react';
import { BookOpen, ShieldCheck } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Catalogador Local de Livros
            </h1>
            <p className="text-xs text-slate-500">
              Catalogação preliminar por OCR local (sem envio para nuvem)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="hidden sm:inline">100% Offline e Local</span>
          <span className="sm:hidden">Local</span>
        </div>
      </div>
    </header>
  );
};
