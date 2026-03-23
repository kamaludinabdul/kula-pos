import React, { useState, useCallback } from 'react';
import { Bug, X, Send, Loader2, CheckCircle2, Monitor, Globe, User, Store } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { sendMessage } from '../services/telegram';
import { APP_VERSION } from '../version';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useToast } from './ui/use-toast';

const BugReportDialog = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { currentStore } = useData();
    const { toast } = useToast();
    
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (!description.trim()) return;

        const browserInfo = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            online: navigator.onLine,
        };
        
        setIsSubmitting(true);
        try {
            // 1. Insert into error_reports table
            const reportData = {
                store_id: currentStore?.id || null,
                user_id: user?.id || null,
                user_email: user?.email || null,
                user_role: user?.role || null,
                page_url: window.location.href,
                description: description.trim(),
                error_message: null,
                error_stack: null,
                browser_info: browserInfo,
                app_version: APP_VERSION || null,
                status: 'open',
            };

            const { error: insertError } = await supabase
                .from('error_reports')
                .insert(reportData);

            if (insertError) {
                console.error('Failed to insert error report:', insertError);
                // Don't throw — still try telegram/email
            }

            // 2. Send Telegram notification to dev
            const devToken = import.meta.env.VITE_DEV_TELEGRAM_BOT_TOKEN;
            const devChatId = import.meta.env.VITE_DEV_TELEGRAM_CHAT_ID;

            if (devToken && devChatId) {
                const telegramMsg = 
                    `🐛 <b>BUG REPORT</b>\n\n` +
                    `📝 <b>Deskripsi:</b>\n${description.trim()}\n\n` +
                    `👤 <b>User:</b> ${user?.email || '-'} (${user?.role || '-'})\n` +
                    `🏪 <b>Store:</b> ${currentStore?.name || '-'}\n` +
                    `📍 <b>Page:</b> ${window.location.pathname}\n` +
                    `📱 <b>Version:</b> ${APP_VERSION || '-'}\n` +
                    `🕐 <b>Time:</b> ${new Date().toLocaleString('id-ID')}`;

                await sendMessage(telegramMsg, { token: devToken, chatId: devChatId }).catch(err => {
                    console.warn('Telegram dev notification failed:', err);
                });
            }

            // 3. Send email via Edge Function
            try {
                const { error: fnError } = await supabase.functions.invoke('send-bug-report-email', {
                    body: {
                        description: description.trim(),
                        userEmail: user?.email || '-',
                        userRole: user?.role || '-',
                        userName: user?.name || '-',
                        storeName: currentStore?.name || '-',
                        storeId: currentStore?.id || '-',
                        pageUrl: window.location.href,
                        appVersion: APP_VERSION || '-',
                        browserInfo: `${navigator.platform} / ${navigator.userAgent.slice(0, 80)}`,
                        timestamp: new Date().toISOString(),
                    }
                });
                if (fnError) console.warn('Email edge function failed:', fnError);
            } catch (emailErr) {
                console.warn('Email notification failed:', emailErr);
            }

            setIsSuccess(true);
            toast({ title: '✅ Laporan terkirim', description: 'Terima kasih! Tim kami akan segera menindaklanjuti.' });
            
            // Auto close after 2s
            setTimeout(() => {
                setDescription('');
                setIsSuccess(false);
                onClose();
            }, 2000);
            
        } catch (error) {
            console.error('Bug report submission error:', error);
            toast({ title: 'Gagal mengirim laporan', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    }, [description, user, currentStore, toast, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-500 to-orange-500 p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bug className="h-5 w-5" />
                            <h2 className="font-bold text-lg">Laporkan Masalah</h2>
                        </div>
                        <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="text-white/80 text-sm mt-1">Bantu kami memperbaiki aplikasi dengan melaporkan bug yang Anda temui.</p>
                </div>

                {isSuccess ? (
                    <div className="p-8 text-center">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-800">Laporan Terkirim!</h3>
                        <p className="text-sm text-slate-500 mt-2">Terima kasih atas laporannya. Tim kami akan segera memprosesnya.</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {/* Description */}
                        <div>
                            <label className="text-sm font-bold text-slate-700 mb-1.5 block">
                                Jelaskan masalahnya <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                                placeholder="Contoh: Ketika saya klik tombol simpan di halaman produk, muncul error dan data tidak tersimpan..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="resize-none"
                                autoFocus
                            />
                        </div>

                        {/* Auto-captured Context */}
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informasi Otomatis (Terkirim bersama laporan)</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-1.5 text-slate-600">
                                    <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{window.location.href.replace(window.location.origin, '')}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-600">
                                    <User className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{user?.email || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-600">
                                    <Store className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{currentStore?.name || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-600">
                                    <Monitor className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span className="truncate">v{APP_VERSION || '-'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" onClick={onClose} className="flex-1">
                                Batal
                            </Button>
                            <Button 
                                onClick={handleSubmit}
                                disabled={!description.trim() || isSubmitting}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengirim...</>
                                ) : (
                                    <><Send className="h-4 w-4 mr-2" /> Kirim Laporan</>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BugReportDialog;
