import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/use-toast';
import { Loader2, RefreshCw, Calendar, Sparkles, Settings2, Database, Wrench } from 'lucide-react';
import AlertDialog from '../../components/AlertDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

import { supabase } from '../../supabase';
import { useBusinessType } from '../../hooks/useBusinessType';

const GeneralSettings = () => {
    const { recalculateProductStats, currentStore, updateStore, updateStoreSettings } = useData();
    const { toast } = useToast();
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [isReseting, setIsReseting] = useState(false);

    // Backdate transaction setting
    const [allowBackdate, setAllowBackdate] = useState(false);
    const [isSavingBackdate, setIsSavingBackdate] = useState(false);

    // Grace Period setting
    const [gracePeriod, setGracePeriod] = useState(0);
    const [isSavingGrace, setIsSavingGrace] = useState(false);

    const { hasFeature } = useBusinessType();

    // Shared Customers state
    const [enableSharedCustomers, setEnableSharedCustomers] = useState(false);
    const [isSavingSharedCustomers, setIsSavingSharedCustomers] = useState(false);

    // AI Configuration State
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [isSavingAiKey, setIsSavingAiKey] = useState(false);

    // Load settings on mount
    useEffect(() => {
        if (currentStore) {
            setAllowBackdate(currentStore.settings?.allowBackdateTransaction || false);
            setGracePeriod(currentStore.settings?.grace_period || 0);
            setEnableSharedCustomers(currentStore.settings?.enableSharedCustomers || false);
            setGeminiApiKey(currentStore.settings?.geminiApiKey || '');
        }
    }, [currentStore]);

    // Save backdate setting
    // Save backdate setting
    const handleBackdateToggle = async (checked) => {
        if (!currentStore?.id) return;
        setIsSavingBackdate(true);
        try {
            // Use updateStoreSettings from DataContext which handles both Supabase update 
            // and local optimistic state update
            const result = await updateStoreSettings({
                allowBackdateTransaction: checked
            });

            if (!result.success) throw new Error(result.error);

            setAllowBackdate(checked);
            toast({
                title: checked ? "Fitur Diaktifkan" : "Fitur Dinonaktifkan",
                description: checked
                    ? "Admin sekarang bisa backdate transaksi."
                    : "Transaksi hanya bisa dibuat untuk hari ini.",
            });
        } catch (error) {
            console.error('Error saving backdate setting:', error);
            toast({
                variant: "destructive",
                title: "Gagal",
                description: "Gagal menyimpan pengaturan.",
            });
            // Revert local state on error if needed, but updateStoreSettings usually handles fetchStores
            setAllowBackdate(!checked);
        } finally {
            setIsSavingBackdate(false);
        }
    };



    const handleSharedCustomersToggle = async (checked) => {
        if (!currentStore?.id) return;
        setIsSavingSharedCustomers(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    settings: {
                        ...currentStore.settings,
                        enableSharedCustomers: checked,
                        updatedAt: new Date().toISOString()
                    }
                })
                .eq('id', currentStore.id);

            if (error) throw error;
            setEnableSharedCustomers(checked);
            toast({
                title: checked ? "Database Dishared" : "Database Dipisah",
                description: checked
                    ? "Pelanggan dari seluruh toko Anda akan terlihat di sini."
                    : "Hanya pelanggan yang terdaftar di toko ini yang akan muncul.",
            });
            // Background fetch to refresh data
            updateStore(currentStore.id, {
                settings: { ...currentStore.settings, enableSharedCustomers: checked }
            });
        } catch (error) {
            console.error('Error saving shared customers setting:', error);
            toast({
                variant: "destructive",
                title: "Gagal",
                description: "Gagal menyimpan pengaturan.",
            });
        } finally {
            setIsSavingSharedCustomers(false);
        }
    };

    const handleAiKeySave = async () => {
        if (!currentStore?.id) return;
        setIsSavingAiKey(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    settings: {
                        ...currentStore.settings,
                        geminiApiKey: geminiApiKey,
                        updatedAt: new Date().toISOString()
                    }
                })
                .eq('id', currentStore.id);

            if (error) throw error;
            toast({
                title: "Berhasil Menyimpan",
                description: "API Key Gemini berhasil disimpan.",
            });
            updateStore(currentStore.id, {
                settings: { ...currentStore.settings, geminiApiKey: geminiApiKey }
            });
        } catch (error) {
            console.error('Error saving AI key:', error);
            toast({
                variant: "destructive",
                title: "Gagal",
                description: "Gagal menyimpan API Key Gemini.",
            });
        } finally {
            setIsSavingAiKey(false);
        }
    };

    const handleGracePeriodChange = async (value) => {
        if (!currentStore?.id) return;
        const numValue = parseInt(value) || 0;
        setGracePeriod(numValue); // Optimistic UI
    };

    const saveGracePeriod = async () => {
        if (!currentStore?.id) return;
        setIsSavingGrace(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    settings: {
                        ...currentStore.settings,
                        grace_period: gracePeriod,
                        updatedAt: new Date().toISOString()
                    }
                })
                .eq('id', currentStore.id);

            if (error) throw error;
            toast({
                title: "Berhasil",
                description: `Masa toleransi diatur ke ${gracePeriod} menit.`,
            });
        } catch (error) {
            console.error('Error saving grace period:', error);
            toast({
                variant: "destructive",
                title: "Gagal",
                description: "Gagal menyimpan masa toleransi.",
            });
        } finally {
            setIsSavingGrace(false);
        }
    };

    const handleRecalculateStats = async () => {
        setIsRecalculating(true);
        try {
            const result = await recalculateProductStats();
            if (result.success) {
                toast({
                    title: "Berhasil",
                    description: `Statistik produk berhasil diperbarui. ${result.count ? result.count + ' produk diproses.' : ''}`,
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Gagal",
                    description: result.error || "Gagal memperbarui statistik.",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message,
            });
        } finally {
            setIsRecalculating(false);
        }
    };

    // --- Data Migration: Fix Cash Flow Dates ---
    const handleFixDates = async () => {
        if (!confirm('Apakah Anda yakin ingin memperbaiki tanggal transaksi Arus Kas? Proses ini akan mencocokkan tanggal dengan waktu pembuatan (Local Time).')) return;

        setIsReseting(true);
        try {
            const { data: cashFlows, error } = await supabase
                .from('cash_flow')
                .select('id, date, created_at')
                .eq('store_id', currentStore.id);

            if (error) throw error;

            let updatedCount = 0;
            const updates = [];

            (cashFlows || []).forEach(data => {
                // [FIX] Skip 'Penjualan (Rekap)' entries as they are backdated by design
                if (data.category === 'Penjualan (Rekap)' || data.category === 'Penjualan') {
                    return;
                }

                if (data.created_at) {
                    const createdDate = new Date(data.created_at);
                    // Format to YYYY-MM-DD in Local Time
                    const correctDateStr = createdDate.getFullYear() + '-' +
                        String(createdDate.getMonth() + 1).padStart(2, '0') + '-' +
                        String(createdDate.getDate()).padStart(2, '0');

                    if (data.date !== correctDateStr) {
                        updates.push(
                            supabase
                                .from('cash_flow')
                                .update({ date: correctDateStr })
                                .eq('id', data.id)
                        );
                        updatedCount++;
                    }
                }
            });

            await Promise.all(updates);
            alert(`Berhasil memperbaiki ${updatedCount} data tanggal.`);

        } catch (error) {
            console.error("Error fixing dates:", error);
            alert("Gagal memperbaiki data: " + error.message);
        } finally {
            setIsReseting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Pengaturan Umum</h2>
                <p className="text-muted-foreground mt-1">
                    Konfigurasi dasar, fitur tambahan, dan pemeliharaan sistem.
                </p>
            </div>

            <Tabs defaultValue="features" className="space-y-6">
                <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="features" className="gap-2">
                        <Settings2 className="h-4 w-4" />
                        Fitur POS
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Kecerdasan Buatan
                    </TabsTrigger>
                    <TabsTrigger value="maintenance" className="gap-2">
                        <Wrench className="h-4 w-4" />
                        Pemeliharaan & Data
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: POS Features */}
                <TabsContent value="features" className="space-y-6 mt-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-indigo-500" />
                                Operasional & Transaksi
                            </CardTitle>
                            <CardDescription>
                                Kelola fitur tambahan untuk alur transaksi di kasir.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="space-y-1">
                                    <Label htmlFor="backdate-switch" className="font-medium">
                                        Izinkan Backdate Transaksi
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Admin/Super Admin bisa mencatat transaksi dengan tanggal lampau.
                                    </p>
                                </div>
                                <Switch
                                    id="backdate-switch"
                                    checked={allowBackdate}
                                    onCheckedChange={handleBackdateToggle}
                                    disabled={isSavingBackdate}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="space-y-1">
                                    <Label htmlFor="shared-customers-switch" className="font-medium">
                                        Berbagi Database Pelanggan
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Gunakan database pelanggan yang sama untuk seluruh cabang/toko Anda.
                                    </p>
                                </div>
                                <Switch
                                    id="shared-customers-switch"
                                    checked={enableSharedCustomers}
                                    onCheckedChange={handleSharedCustomersToggle}
                                    disabled={isSavingSharedCustomers}
                                />
                            </div>

                            {hasFeature('rental_timer') && (
                                <div className="flex items-center justify-between p-4 border rounded-lg bg-indigo-50/50 border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-1">
                                        <Label htmlFor="grace-period" className="font-medium text-indigo-900">
                                            Masa Toleransi (Menit)
                                        </Label>
                                        <p className="text-xs text-indigo-700/70">
                                            Waktu tambahan sebelum denda atau jam berikutnya dihitung.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            id="grace-period"
                                            type="number"
                                            value={gracePeriod}
                                            onChange={(e) => handleGracePeriodChange(e.target.value)}
                                            className="w-20 bg-white"
                                        />
                                        <Button
                                            size="sm"
                                            onClick={saveGracePeriod}
                                            disabled={isSavingGrace}
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            {isSavingGrace ? '...' : 'Simpan'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: AI Configuration */}
                <TabsContent value="ai" className="mt-0">
                    <Card className="border-purple-200 bg-purple-50/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-purple-900">
                                <Sparkles className="h-5 w-5 fill-purple-600 text-purple-600" />
                                Konfigurasi AI (Gemini)
                            </CardTitle>
                            <CardDescription className="text-purple-700/70">
                                Fitur Enterprise POS menggunakan Google Gemini untuk analisis data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <Label htmlFor="gemini-api-key" className="font-medium text-purple-900">
                                    Gemini API Key
                                </Label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Input
                                        id="gemini-api-key"
                                        type="password"
                                        placeholder="AIzaSy..."
                                        value={geminiApiKey}
                                        onChange={(e) => setGeminiApiKey(e.target.value)}
                                        className="bg-white border-purple-200 focus-visible:ring-purple-500"
                                    />
                                    <Button
                                        onClick={handleAiKeySave}
                                        disabled={isSavingAiKey}
                                        className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                                    >
                                        {isSavingAiKey ? 'Menyimpan...' : 'Simpan API Key'}
                                    </Button>
                                </div>
                                <div className="bg-white/50 border border-purple-100 rounded-lg p-3">
                                    <p className="text-xs text-purple-800 leading-relaxed">
                                        Dapatkan kunci gratis di <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="font-bold underline">Google AI Studio</a>.
                                        AI digunakan untuk prediksi omset, analisis stok, dan rekomendasi promo.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Maintenance */}
                <TabsContent value="maintenance" className="space-y-6 mt-0">
                    <Card className="border-orange-200 bg-orange-50/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-orange-900">
                                <Database className="h-5 w-5 text-orange-500" />
                                Perbaikan Tanggal & Timezone
                            </CardTitle>
                            <CardDescription className="text-orange-800/70">
                                Perbaiki data transaksi yang memiliki tanggal tidak sesuai dengan waktu input.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="outline"
                                onClick={handleFixDates}
                                disabled={isReseting}
                                className="w-full sm:w-auto bg-white border-orange-200 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
                            >
                                {isReseting ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
                                ) : (
                                    'Jalankan Fix Tanggal Arus Kas'
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <RefreshCw className="h-5 w-5 text-slate-500" />
                                Sinkronisasi Statistik
                            </CardTitle>
                            <CardDescription>
                                Hitung ulang data agregasi produk jika statistik terlaris terlihat tidak muncul.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-slate-50 gap-4">
                                <div className="space-y-1">
                                    <div className="text-sm font-semibold">Hitung Ulang Statistik Penjualan</div>
                                    <p className="text-xs text-muted-foreground">
                                        Mengkalkulasi ulang kolom "Terjual" di tabel produk berdasarkan histori.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRecalculateStats}
                                    disabled={isRecalculating}
                                    className="gap-2 shrink-0"
                                >
                                    {isRecalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    Proses Sekarang
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default GeneralSettings;
