import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { TrendingUp, Crown } from 'lucide-react';

const SalesPerformanceSettings = () => {
    const { currentStore, updateStoreSettings } = useData();
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        enableSalesPerformance: false
    });

    // Check if user has premium plan
    const isPremium = currentStore?.plan === 'pro' || currentStore?.plan === 'enterprise';

    useEffect(() => {
        if (currentStore) {
            setSettings({
                enableSalesPerformance: currentStore.enableSalesPerformance || false
            });
        }
    }, [currentStore]);

    const handleSwitchChange = (checked) => {
        setSettings(prev => ({ ...prev, enableSalesPerformance: checked }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateStoreSettings(settings);
            alert('Pengaturan Sales Performance berhasil disimpan!');
        } catch (error) {
            console.error("Error saving sales performance settings:", error);
            alert('Gagal menyimpan pengaturan.');
        } finally {
            setLoading(false);
        }
    };

    if (!isPremium) {
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Sales Performance</h2>
                    <p className="text-muted-foreground">
                        Fitur tracking performa sales untuk meningkatkan produktivitas tim.
                    </p>
                </div>

                <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center">
                                <Crown className="h-8 w-8 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-amber-900">Fitur Premium</h3>
                                <p className="text-sm text-amber-700 mt-2">
                                    Sales Performance hanya tersedia untuk paket <strong>Pro</strong> dan <strong>Enterprise</strong>.
                                </p>
                            </div>
                            <div className="bg-white rounded-lg p-4 w-full max-w-md border border-amber-200">
                                <p className="text-sm text-slate-600 mb-3">Fitur yang akan Anda dapatkan:</p>
                                <ul className="text-sm text-left space-y-2 text-slate-700">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-0.5">✓</span>
                                        <span>Tracking penjualan per sales person</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-0.5">✓</span>
                                        <span>Laporan performa sales detail</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-0.5">✓</span>
                                        <span>Target penjualan dan monitoring</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-0.5">✓</span>
                                        <span>Komisi otomatis berdasarkan penjualan</span>
                                    </li>
                                </ul>
                            </div>
                            <Button className="bg-amber-600 hover:bg-amber-700">
                                Upgrade ke Premium
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Sales Performance</h2>
                <p className="text-muted-foreground">
                    Aktifkan tracking performa sales untuk monitoring dan target penjualan.
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Pengaturan Sales Performance
                        </CardTitle>
                        <CardDescription>
                            Kelola fitur tracking penjualan per sales person.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="sales-performance" className="flex flex-col space-y-1">
                                <span>Aktifkan Sales Performance</span>
                                <span className="font-normal text-xs text-muted-foreground">
                                    Tampilkan dropdown pilihan sales di POS dan aktifkan laporan performa sales.
                                </span>
                            </Label>
                            <Switch
                                id="sales-performance"
                                checked={settings.enableSalesPerformance}
                                onCheckedChange={handleSwitchChange}
                            />
                        </div>

                        {settings.enableSalesPerformance && (
                            <div className="border-t pt-6 space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-blue-900 mb-2">Cara Menggunakan:</h4>
                                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                                        <li>Tambahkan user dengan role "Sales" di Staff Management</li>
                                        <li>Dropdown "Pilih Sales" akan muncul di POS</li>
                                        <li>Pilih sales person sebelum checkout</li>
                                        <li>Lihat laporan di Reports → Sales Performance</li>
                                    </ol>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
};

export default SalesPerformanceSettings;
