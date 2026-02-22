import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Save, Send } from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { sendMessage } from '../../services/telegram';

const TelegramSettings = () => {
    const { activeStoreId, currentStore, updateStore } = useData();
    const [formData, setFormData] = useState({
        telegramBotToken: '',
        telegramChatId: '',
        telegramNotifyShift: false,
        telegramNotifyTransaction: false,
        telegramNotifyLowStock: false,
        telegramNotifyShiftReminder: false,
        shiftOpenTime: '08:00',
        shiftCloseTime: '22:00'
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (currentStore) {
            setFormData(prev => {
                const newData = {
                    telegramBotToken: currentStore.telegramBotToken || '',
                    telegramChatId: currentStore.telegramChatId || '',
                    telegramNotifyShift: currentStore.telegramNotifyShift || false,
                    telegramNotifyTransaction: currentStore.telegramNotifyTransaction || false,
                    telegramNotifyLowStock: currentStore.telegramNotifyLowStock || false,
                    telegramNotifyShiftReminder: currentStore.telegramNotifyShiftReminder || false,
                    shiftOpenTime: currentStore.shiftOpenTime || '08:00',
                    shiftCloseTime: currentStore.shiftCloseTime || '22:00'
                };

                // Simple shallow comparison
                if (
                    prev.telegramBotToken === newData.telegramBotToken &&
                    prev.telegramChatId === newData.telegramChatId &&
                    prev.telegramNotifyShift === newData.telegramNotifyShift &&
                    prev.telegramNotifyTransaction === newData.telegramNotifyTransaction &&
                    prev.telegramNotifyLowStock === newData.telegramNotifyLowStock &&
                    prev.telegramNotifyShiftReminder === newData.telegramNotifyShiftReminder &&
                    prev.shiftOpenTime === newData.shiftOpenTime &&
                    prev.shiftCloseTime === newData.shiftCloseTime
                ) {
                    return prev;
                }

                return newData;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        currentStore?.telegramBotToken,
        currentStore?.telegramChatId,
        currentStore?.telegramNotifyShift,
        currentStore?.telegramNotifyTransaction,
        currentStore?.telegramNotifyLowStock,
        currentStore?.telegramNotifyShiftReminder,
        currentStore?.shiftOpenTime,
        currentStore?.shiftCloseTime
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSwitchChange = (name, checked) => {
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const [isTesting, setIsTesting] = useState(false);
    const handleTestMessage = async () => {
        if (!formData.telegramBotToken || !formData.telegramChatId) {
            alert('Harap isi Token dan Chat ID terlebih dahulu.');
            return;
        }

        setIsTesting(true);
        const testMsg = `🧪 <b>TES KONEKSI BOT</b>\n\nHalo dari Kasir Pro! Jika Anda menerima pesan ini, bot Anda sudah terkonfigurasi dengan benar.\n\n⏰ Waktu: ${new Date().toLocaleString('id-ID')}`;

        try {
            const success = await sendMessage(testMsg, {
                token: formData.telegramBotToken,
                chatId: formData.telegramChatId
            });

            if (success) {
                alert('✅ Pesan tes berhasil terkirim! Silakan cek Telegram Anda.');
            } else {
                alert('❌ Gagal mengirim pesan tes. Pastikan Bot Token dan Chat ID benar, dan bot sudah ditambahkan ke chat tersebut.');
            }
        } catch (error) {
            console.error('Telegram test error:', error);
            alert('❌ Terjadi kesalahan saat mencoba mengirim pesan.');
        } finally {
            setIsTesting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeStoreId) return;

        setIsSaving(true);
        const result = await updateStore(activeStoreId, formData);
        setIsSaving(false);

        if (result.success) {
            alert('Pengaturan Telegram berhasil disimpan!');
        } else {
            alert('Gagal menyimpan pengaturan Telegram.');
        }
    };

    if (!currentStore) return <div>Loading...</div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    <CardTitle>Notifikasi Telegram</CardTitle>
                </div>
                <CardDescription>Atur notifikasi otomatis ke Telegram untuk aktivitas toko.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4 border-b pb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Kredensial Bot</h3>
                        <div className="space-y-2">
                            <Label htmlFor="telegramBotToken">Bot Token</Label>
                            <Input
                                id="telegramBotToken"
                                name="telegramBotToken"
                                value={formData.telegramBotToken}
                                onChange={handleChange}
                                placeholder="Contoh: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                            />
                            <p className="text-xs text-muted-foreground">
                                Dapatkan dari @BotFather di Telegram.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="telegramChatId">Chat ID</Label>
                            <Input
                                id="telegramChatId"
                                name="telegramChatId"
                                value={formData.telegramChatId}
                                onChange={handleChange}
                                placeholder="Contoh: -1001234567890 atau 123456789"
                            />
                            <p className="text-xs text-muted-foreground">
                                ID Chat atau Grup tujuan notifikasi.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={handleTestMessage}
                            disabled={isTesting}
                        >
                            <Send className="h-3.5 w-3.5 mr-2" />
                            {isTesting ? 'Mencoba kirim...' : 'Tes Kirim Pesan'}
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Pengaturan Notifikasi</h3>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label htmlFor="telegramNotifyShift" className="text-base">Buka / Tutup Shift</Label>
                                <p className="text-xs text-muted-foreground">
                                    Kirim notifikasi saat kasir membuka atau menutup shift.
                                </p>
                            </div>
                            <Switch
                                id="telegramNotifyShift"
                                checked={formData.telegramNotifyShift}
                                onCheckedChange={(checked) => handleSwitchChange('telegramNotifyShift', checked)}
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label htmlFor="telegramNotifyTransaction" className="text-base">Transaksi Baru</Label>
                                <p className="text-xs text-muted-foreground">
                                    Kirim notifikasi untuk setiap transaksi yang berhasil.
                                </p>
                            </div>
                            <Switch
                                id="telegramNotifyTransaction"
                                checked={formData.telegramNotifyTransaction}
                                onCheckedChange={(checked) => handleSwitchChange('telegramNotifyTransaction', checked)}
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <Label htmlFor="telegramNotifyLowStock" className="text-base">Peringatan Stok Menipis</Label>
                                <p className="text-xs text-muted-foreground">
                                    Kirim notifikasi jika stok produk kurang dari 5.
                                </p>
                            </div>
                            <Switch
                                id="telegramNotifyLowStock"
                                checked={formData.telegramNotifyLowStock}
                                onCheckedChange={(checked) => handleSwitchChange('telegramNotifyLowStock', checked)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Pengingat Shift (Reminder)</h3>
                        <div className="p-3 border rounded-lg bg-slate-50 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="telegramNotifyShiftReminder" className="text-base">Pengingat Buka/Tutup</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Kirim notifikasi jika toko belum buka/tutup shift sesuai jam operasional.
                                    </p>
                                </div>
                                <Switch
                                    id="telegramNotifyShiftReminder"
                                    checked={formData.telegramNotifyShiftReminder}
                                    onCheckedChange={(checked) => handleSwitchChange('telegramNotifyShiftReminder', checked)}
                                />
                            </div>

                            {formData.telegramNotifyShiftReminder && (
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="shiftOpenTime">Jam Buka (Open)</Label>
                                        <Input
                                            id="shiftOpenTime"
                                            name="shiftOpenTime"
                                            type="time"
                                            value={formData.shiftOpenTime}
                                            onChange={handleChange}
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Notif jika belum buka shift setelah jam ini.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="shiftCloseTime">Jam Tutup (Close)</Label>
                                        <Input
                                            id="shiftCloseTime"
                                            name="shiftCloseTime"
                                            type="time"
                                            value={formData.shiftCloseTime}
                                            onChange={handleChange}
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Notif jika shift masih buka setelah jam ini.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isSaving}>
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};

export default TelegramSettings;
