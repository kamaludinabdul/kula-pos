import React from 'react';
import { useToast } from './use-toast';

export const Toaster = () => {
    const { toasts } = useToast();

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`
                        min-w-[300px] p-4 rounded-md shadow-lg border flex items-start gap-3 bg-white pointer-events-auto transition-all animate-in slide-in-from-right-full
                        ${t.variant === 'destructive' ? 'border-red-500 bg-red-50' : 'border-slate-200'}
                    `}
                >
                    <div className="flex-1">
                        {t.title && <h3 className={`font-semibold text-sm ${t.variant === 'destructive' ? 'text-red-900' : 'text-slate-900'}`}>{t.title}</h3>}
                        {t.description && <p className={`text-sm mt-1 ${t.variant === 'destructive' ? 'text-red-700' : 'text-slate-500'}`}>{t.description}</p>}
                    </div>
                </div>
            ))}
        </div>
    );
};
