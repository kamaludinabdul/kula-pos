import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Save, Gift } from 'lucide-react';

const LoyaltySettings = () => {
    const { currentStore, updateStoreSettings } = useData();
    const [loading, setLoading] = useState(false);

    const [settings, setSettings] = useState({
        isActive: false,
        ruleType: 'multiple', // 'minimum' or 'multiple'
        minTransactionAmount: 0,
        pointsReward: 0,
        ratioAmount: 10000,
        ratioPoints: 1,
        expiryEnabled: false,
        expiryDate: '',
        lastResetDate: ''
    });

    useEffect(() => {
        if (currentStore?.loyaltySettings) {
            setSettings(prev => {
                const newData = {
                    isActive: currentStore.loyaltySettings.isActive ?? false,
                    ruleType: currentStore.loyaltySettings.ruleType || 'multiple',
                    minTransactionAmount: currentStore.loyaltySettings.minTransactionAmount || 0,
                    pointsReward: currentStore.loyaltySettings.pointsReward || 0,
                    ratioAmount: currentStore.loyaltySettings.ratioAmount || 10000,
                    ratioPoints: currentStore.loyaltySettings.ratioPoints || 1,
                    expiryEnabled: currentStore.loyaltySettings.expiryEnabled ?? false,
                    expiryDate: currentStore.loyaltySettings.expiryDate || '',
                    lastResetDate: currentStore.loyaltySettings.lastResetDate || ''
                };

                if (
                    prev.isActive === newData.isActive &&
                    prev.ruleType === newData.ruleType &&
                    prev.minTransactionAmount === newData.minTransactionAmount &&
                    prev.pointsReward === newData.pointsReward &&
                    prev.ratioAmount === newData.ratioAmount &&
                    prev.ratioPoints === newData.ratioPoints &&
                    prev.expiryEnabled === newData.expiryEnabled &&
                    prev.expiryDate === newData.expiryDate
                ) {
                    return prev;
                }

                return newData;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        currentStore?.loyaltySettings?.isActive,
        currentStore?.loyaltySettings?.ruleType,
        currentStore?.loyaltySettings?.minTransactionAmount,
        currentStore?.loyaltySettings?.pointsReward,
        currentStore?.loyaltySettings?.ratioAmount,
        currentStore?.loyaltySettings?.ratioPoints
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Keep as string to allow empty input, will convert to number on submit
        setSettings(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
    };

    const handleSwitchChange = (checked) => {
        setSettings(prev => ({ ...prev, isActive: checked }));
    };

    const handleRadioChange = (value) => {
        setSettings(prev => ({ ...prev, ruleType: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Convert empty strings to 0 before saving
            const settingsToSave = {
                ...settings,
                minTransactionAmount: settings.minTransactionAmount === '' ? 0 : Number(settings.minTransactionAmount),
                pointsReward: settings.pointsReward === '' ? 0 : Number(settings.pointsReward),
                ratioAmount: settings.ratioAmount === '' ? 0 : Number(settings.ratioAmount),
                ratioPoints: settings.ratioPoints === '' ? 0 : Number(settings.ratioPoints)
            };

            await updateStoreSettings({
                loyaltySettings: settingsToSave
            });
            alert('Pengaturan poin loyalitas berhasil disimpan!');
        } catch (error) {
            console.error("Error saving loyalty settings:", error);
            alert('Gagal menyimpan pengaturan.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Pengaturan Poin Loyalitas</h2>
                <p className="text-muted-foreground">
                    Atur bagaimana pelanggan mendapatkan poin dari transaksi mereka.
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gift className="h-5 w-5" />
                            Sistem Poin
                        </CardTitle>
                        <CardDescription>
                            Aktifkan sistem poin untuk meningkatkan loyalitas pelanggan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="loyalty-active" className="flex flex-col space-y-1">
                                <span>Aktifkan Poin Loyalitas</span>
                                <span className="font-normal text-xs text-muted-foreground">
                                    Pelanggan akan mendapatkan poin otomatis setelah transaksi selesai.
                                </span>
                            </Label>
                            <Switch
                                id="loyalty-active"
                                checked={settings.isActive}
                                onCheckedChange={handleSwitchChange}
                            />
                        </div>

                        {settings.isActive && (
                            <div className="space-y-6 border-t pt-6">
                                <div className="space-y-3">
                                    <Label>Metode Perhitungan Poin</Label>
                                    <RadioGroup
                                        value={settings.ruleType}
                                        onValueChange={handleRadioChange}
                                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                    >
                                        <div>
                                            <RadioGroupItem value="minimum" id="rule-minimum" className="peer sr-only" />
                                            <Label
                                                htmlFor="rule-minimum"
                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                            >
                                                <span className="text-lg font-semibold mb-1">Minimum Pembelian</span>
                                                <span className="text-sm text-center text-muted-foreground">
                                                    Dapat poin tetap jika belanja di atas nominal tertentu.
                                                </span>
                                            </Label>
                                        </div>
                                        <div>
                                            <RadioGroupItem value="multiple" id="rule-multiple" className="peer sr-only" />
                                            <Label
                                                htmlFor="rule-multiple"
                                                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                                            >
                                                <span className="text-lg font-semibold mb-1">Kelipatan Pembelian</span>
                                                <span className="text-sm text-center text-muted-foreground">
                                                    Dapat poin untuk setiap kelipatan nominal tertentu.
                                                </span>
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {settings.ruleType === 'minimum' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/50 rounded-lg">
                                        <div className="space-y-2">
                                            <Label htmlFor="minTransactionAmount">Minimum Total Belanja (Rp)</Label>
                                            <Input
                                                id="minTransactionAmount"
                                                name="minTransactionAmount"
                                                type="number"
                                                value={settings.minTransactionAmount}
                                                onChange={handleChange}
                                                placeholder="Contoh: 50000"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Pelanggan harus belanja minimal segini untuk dapat poin.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="pointsReward">Jumlah Poin yang Didapat</Label>
                                            <Input
                                                id="pointsReward"
                                                name="pointsReward"
                                                type="number"
                                                value={settings.pointsReward}
                                                onChange={handleChange}
                                                placeholder="Contoh: 10"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Poin tetap yang diberikan jika syarat terpenuhi.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/50 rounded-lg">
                                        <div className="space-y-2">
                                            <Label htmlFor="ratioAmount">Setiap Kelipatan Belanja (Rp)</Label>
                                            <Input
                                                id="ratioAmount"
                                                name="ratioAmount"
                                                type="number"
                                                value={settings.ratioAmount}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="ratioPoints">Mendapatkan Poin Sebesar</Label>
                                            <Input
                                                id="ratioPoints"
                                                name="ratioPoints"
                                                type="number"
                                                value={settings.ratioPoints}
                                                onChange={handleChange}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Contoh: Setiap belanja Rp 10.000 dapat 1 poin.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Point Expiry Settings */}
                        {settings.isActive && (
                            <div className="space-y-4 border-t pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium">Masa Berlaku Poin</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Atur tanggal kadaluarsa untuk reset otomatis semua poin pelanggan
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settings.expiryEnabled}
                                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, expiryEnabled: checked }))}
                                    />
                                </div>

                                {settings.expiryEnabled && (
                                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                                        <div className="space-y-2">
                                            <Label htmlFor="expiryDate">Tanggal Kadaluarsa</Label>
                                            <Input
                                                id="expiryDate"
                                                name="expiryDate"
                                                type="date"
                                                value={settings.expiryDate}
                                                onChange={(e) => setSettings(prev => ({ ...prev, expiryDate: e.target.value }))}
                                                min={new Date().toISOString().split('T')[0]}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Semua poin pelanggan akan direset ke 0 pada tanggal ini
                                            </p>
                                        </div>

                                        {settings.lastResetDate && (
                                            <div className="text-sm text-muted-foreground">
                                                Reset terakhir: {new Date(settings.lastResetDate).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button type="submit" disabled={loading}>
                                <Save className="mr-2 h-4 w-4" />
                                {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
};

export default LoyaltySettings;
