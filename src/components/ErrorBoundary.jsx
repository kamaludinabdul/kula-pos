import React from 'react';
import { supabase } from '../supabase';
import { sendMessage } from '../services/telegram';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null, description: '', reported: false, reporting: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });

        // Auto-report to Supabase (fire and forget)
        this.autoReport(error, errorInfo);
    }

    async autoReport(error, errorInfo) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            await supabase.from('error_reports').insert({
                user_id: user?.id || null,
                user_email: user?.email || null,
                user_role: user?.user_metadata?.role || null,
                page_url: window.location.href,
                description: '[Auto-captured] Unhandled React Error',
                error_message: error?.toString() || 'Unknown error',
                error_stack: errorInfo?.componentStack || error?.stack || null,
                browser_info: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screenWidth: window.screen.width,
                    screenHeight: window.screen.height,
                },
                status: 'open',
            });

            // Send Telegram alert
            const devToken = import.meta.env.VITE_DEV_TELEGRAM_BOT_TOKEN;
            const devChatId = import.meta.env.VITE_DEV_TELEGRAM_CHAT_ID;
            if (devToken && devChatId) {
                const msg =
                    `🔴 <b>AUTO ERROR</b>\n\n` +
                    `<b>Error:</b> ${error?.message || 'Unknown'}\n` +
                    `<b>Page:</b> ${window.location.pathname}\n` +
                    `<b>User:</b> ${user?.email || 'Unknown'}\n` +
                    `<b>Time:</b> ${new Date().toLocaleString('id-ID')}`;
                await sendMessage(msg, { token: devToken, chatId: devChatId });
            }
        } catch (reportError) {
            console.warn('Auto error report failed:', reportError);
        }
    }

    async handleManualReport() {
        this.setState({ reporting: true });
        try {
            const { data: { user } } = await supabase.auth.getUser();

            await supabase.from('error_reports').insert({
                user_id: user?.id || null,
                user_email: user?.email || null,
                user_role: user?.user_metadata?.role || null,
                page_url: window.location.href,
                description: this.state.description || '[User did not provide description]',
                error_message: this.state.error?.toString() || 'Unknown error',
                error_stack: this.state.errorInfo?.componentStack || this.state.error?.stack || null,
                browser_info: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                },
                status: 'open',
            });

            // Send email via Edge Function
            try {
                await supabase.functions.invoke('send-bug-report-email', {
                    body: {
                        description: this.state.description || 'Crash report tanpa deskripsi',
                        userEmail: user?.email || '-',
                        userRole: user?.user_metadata?.role || '-',
                        userName: user?.user_metadata?.name || '-',
                        pageUrl: window.location.href,
                        errorMessage: this.state.error?.toString(),
                        errorStack: this.state.errorInfo?.componentStack?.slice(0, 500),
                        browserInfo: navigator.userAgent.slice(0, 100),
                        timestamp: new Date().toISOString(),
                    }
                });
            } catch (e) {
                console.warn('Email notification failed:', e);
            }

            this.setState({ reported: true });
        } catch (err) {
            console.error('Manual report failed:', err);
            alert('Gagal mengirim laporan: ' + err.message);
        } finally {
            this.setState({ reporting: false });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex flex-col items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-center text-white">
                            <div className="text-4xl mb-2">😵</div>
                            <h1 className="text-xl font-bold">Oops! Terjadi Kesalahan</h1>
                            <p className="text-white/80 text-sm mt-1">
                                Aplikasi mengalami masalah yang tidak terduga.
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Error Detail (Collapsible) */}
                            <details className="bg-red-50 rounded-lg p-3 text-xs">
                                <summary className="font-bold text-red-700 cursor-pointer">Detail Error (Teknis)</summary>
                                <pre className="mt-2 text-red-600 overflow-auto max-h-32 whitespace-pre-wrap">
                                    {this.state.error && this.state.error.toString()}
                                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                                </pre>
                            </details>

                            {!this.state.reported ? (
                                <>
                                    {/* Description */}
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 mb-1 block">
                                            Apa yang sedang Anda lakukan? (Opsional)
                                        </label>
                                        <textarea
                                            className="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-red-300 focus:outline-none"
                                            rows={3}
                                            placeholder="Contoh: Saya sedang menambahkan produk baru lalu klik tombol simpan..."
                                            value={this.state.description}
                                            onChange={(e) => this.setState({ description: e.target.value })}
                                        />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                                            onClick={() => this.handleManualReport()}
                                            disabled={this.state.reporting}
                                        >
                                            {this.state.reporting ? '⏳ Mengirim...' : '📨 Laporkan ke Developer'}
                                        </button>
                                        <button
                                            className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors"
                                            onClick={() => window.location.reload()}
                                        >
                                            🔄 Muat Ulang
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <div className="text-3xl mb-2">✅</div>
                                    <p className="font-bold text-green-700">Laporan terkirim!</p>
                                    <p className="text-sm text-slate-500 mt-1">Terima kasih. Tim kami akan segera menindaklanjuti.</p>
                                    <button
                                        className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-700 transition-colors"
                                        onClick={() => window.location.reload()}
                                    >
                                        🔄 Muat Ulang Halaman
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
