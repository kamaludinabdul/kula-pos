import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { useToast } from '../../components/ui/use-toast';
import { Loader2, RefreshCw, Calendar } from 'lucide-react';
import AlertDialog from '../../components/AlertDialog';

import { supabase } from '../../supabase';

const GeneralSettings = () => {
    const { recalculateProductStats, currentStore } = useData();
    const { toast } = useToast();
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [isReseting, setIsReseting] = useState(false);

    // Backdate transaction setting
    const [allowBackdate, setAllowBackdate] = useState(false);
    const [isSavingBackdate, setIsSavingBackdate] = useState(false);

    // Rental Mode setting
    const [enableRental, setEnableRental] = useState(false);
    const [isSavingRental, setIsSavingRental] = useState(false);

    // Load settings on mount
    useEffect(() => {
        if (currentStore) {
            setAllowBackdate(currentStore.settings?.allowBackdateTransaction || false);
            setEnableRental(currentStore.enableRental || false);
        }
    }, [currentStore]);

    // Save backdate setting
    const handleBackdateToggle = async (checked) => {
        if (!currentStore?.id) return;
        setIsSavingBackdate(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    settings: {
                        ...currentStore.settings,
                        allowBackdateTransaction: checked,
                        updatedAt: new Date().toISOString()
                    }
                })
                .eq('id', currentStore.id);

            if (error) throw error;
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
        } finally {
            setIsSavingBackdate(false);
        }
    };

    // Save rental setting (To Stores Collection for Realtime Sidebar update)
    const handleRentalToggle = async (checked) => {
        if (!currentStore?.id) return;
        setIsSavingRental(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    enableRental: checked
                })
                .eq('id', currentStore.id);

            if (error) throw error;
            // Also update local state
            setEnableRental(checked);

            toast({
                title: checked ? "Mode Rental Diaktifkan" : "Mode Rental Dinonaktifkan",
                description: checked
                    ? "Menu 'Rental Mode' akan muncul di sidebar seketika."
                    : "Menu Rental disembunyikan.",
            });
        } catch (error) {
            console.error('Error saving rental setting:', error);
            toast({
                variant: "destructive",
                title: "Gagal",
                description: "Gagal menyimpan pengaturan.",
            });
        } finally {
            setIsSavingRental(false);
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
            <h2 className="text-2xl font-bold">Pengaturan Umum</h2>

            {/* POS Features */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Fitur Transaksi POS
                    </CardTitle>
                    <CardDescription>
                        Pengaturan fitur tambahan untuk transaksi POS.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                            <Label htmlFor="backdate-switch" className="font-medium">
                                Izinkan Backdate Transaksi
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Jika aktif, Admin/Super Admin bisa membuat transaksi dengan tanggal lampau.
                            </p>
                        </div>
                        <Switch
                            id="backdate-switch"
                            checked={allowBackdate}
                            onCheckedChange={handleBackdateToggle}
                            disabled={isSavingBackdate}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                            <Label htmlFor="rental-switch" className="font-medium">
                                Aktifkan Mode Rental / Sewa
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Mengaktifkan fitur manajemen durasi (timer) untuk rental PS, Billiard, Studio, dll.
                            </p>
                        </div>
                        <Switch
                            id="rental-switch"
                            checked={enableRental}
                            onCheckedChange={handleRentalToggle}
                            disabled={isSavingRental}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Data Correction Tools */}
            <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                    <CardTitle className="text-orange-800">Perbaikan Data</CardTitle>
                    <CardDescription>Tools untuk memperbaiki data yang tidak sinkron.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        onClick={handleFixDates}
                        disabled={isReseting}
                        className="bg-white border-orange-300 hover:bg-orange-100 text-orange-700"
                    >
                        {isReseting ? 'Memproses...' : 'Perbaiki Tanggal Arus Kas (Timezone Fix)'}
                    </Button>
                </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
                Konfigurasi dasar dan pemeliharaan sistem.
            </p>


            <Card>
                <CardHeader>
                    <CardTitle>Pemeliharaan Data</CardTitle>
                    <CardDescription>
                        Lakukan kalkulasi ulang jika data statistik produk (terlaris) tidak sesuai.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium">Hitung Ulang Statistik Penjualan</div>
                            <div className="text-xs text-muted-foreground">
                                Mengkalkulasi total "Terjual" untuk semua produk berdasarkan riwayat transaksi.
                                Proses ini mungkin memakan waktu.
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRecalculateStats}
                            disabled={isRecalculating}
                            className="gap-2"
                        >
                            {isRecalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Hitung Ulang
                        </Button>
                    </div>
                </CardContent>
            </Card>


        </div>
    );
};

export default GeneralSettings;
