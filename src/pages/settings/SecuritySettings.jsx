import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Loader2, Save, Shield } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';
import { supabase } from '../../supabase';

const SecuritySettings = () => {
    const { currentStore } = useData();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // State
    const [autoLockEnabled, setAutoLockEnabled] = useState(false);
    const [autoLockDuration, setAutoLockDuration] = useState(30); // minutes

    useEffect(() => {
        if (currentStore?.settings) {
            setAutoLockEnabled(currentStore.settings.autoLockEnabled || false);
            setAutoLockDuration(currentStore.settings.autoLockDuration || 30);
        }
    }, [currentStore]);

    const handleSave = async () => {
        if (!currentStore?.id) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    settings: {
                        ...currentStore.settings,
                        autoLockEnabled: autoLockEnabled,
                        autoLockDuration: parseInt(autoLockDuration)
                    }
                })
                .eq('id', currentStore.id);

            if (error) throw error;

            toast({
                title: "Pengaturan Disimpan",
                description: "Pengaturan keamanan berhasil diperbarui.",
            });
        } catch (error) {
            console.error("Error saving security settings:", error);
            toast({
                variant: "destructive",
                title: "Gagal Menyimpan",
                description: "Terjadi kesalahan saat menyimpan pengaturan.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Keamanan & Layar Kunci</h2>
                <p className="text-muted-foreground">
                    Atur preferensi keamanan dan kunci layar otomatis untuk aplikasi.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <CardTitle>Kunci Layar Otomatis</CardTitle>
                    </div>
                    <CardDescription>
                        Aplikasi akan otomatis terkunci atau logout jika tidak ada aktivitas dalam durasi tertentu.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="auto-lock-mode" className="flex flex-col space-y-1">
                            <span>Aktifkan Auto Lock</span>
                            <span className="font-normal text-xs text-muted-foreground">
                                Jika aktif, sistem akan logout otomatis saat tidak digunakan.
                            </span>
                        </Label>
                        <Switch
                            id="auto-lock-mode"
                            checked={autoLockEnabled}
                            onCheckedChange={setAutoLockEnabled}
                        />
                    </div>

                    {autoLockEnabled && (
                        <div className="space-y-2 max-w-sm transition-all animate-in fade-in slide-in-from-top-2">
                            <Label htmlFor="duration">Durasi Timeout (Menit)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="duration"
                                    type="number"
                                    min="1"
                                    max="1440" // 24 hours
                                    value={autoLockDuration}
                                    onChange={(e) => setAutoLockDuration(e.target.value)}
                                />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">Menit</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Contoh: 30 menit. Maksimal 1440 menit (24 jam).
                            </p>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSave} disabled={loading} className="gap-2">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Simpan Perubahan
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SecuritySettings;
