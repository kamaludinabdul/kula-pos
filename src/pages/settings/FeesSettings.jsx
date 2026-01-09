import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Save, Coins, Percent } from 'lucide-react';

const FeesSettings = () => {
    const { activeStoreId, currentStore, updateStore } = useData();
    const [formData, setFormData] = useState({
        taxRate: 0,
        serviceCharge: 0,
        taxType: 'exclusive',
        enableDiscount: false,
        discountPin: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (currentStore) {
            setFormData(prev => {
                const newData = {
                    taxRate: currentStore.taxRate || 0,
                    serviceCharge: currentStore.serviceCharge || 0,
                    taxType: currentStore.taxType || 'exclusive',
                    enableDiscount: currentStore.enableDiscount || false,
                    discountPin: currentStore.discountPin || ''
                };

                if (
                    prev.taxRate === newData.taxRate &&
                    prev.serviceCharge === newData.serviceCharge &&
                    prev.taxType === newData.taxType &&
                    prev.enableDiscount === newData.enableDiscount &&
                    prev.discountPin === newData.discountPin
                ) {
                    return prev;
                }

                return newData;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        currentStore?.taxRate,
        currentStore?.serviceCharge,
        currentStore?.taxType,
        currentStore?.enableDiscount,
        currentStore?.discountPin
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeStoreId) return;

        setIsSaving(true);
        const result = await updateStore(activeStoreId, formData);
        setIsSaving(false);

        if (result.success) {
            alert('Pengaturan berhasil disimpan!');
        } else {
            alert('Gagal menyimpan pengaturan.');
        }
    };

    if (!currentStore) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5" />
                        <CardTitle>Biaya & Pajak</CardTitle>
                    </div>
                    <CardDescription>Atur pajak, biaya layanan, dan metode perhitungan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="taxRate">Pajak (%)</Label>
                            <Input
                                id="taxRate"
                                name="taxRate"
                                type="number"
                                value={formData.taxRate}
                                onChange={handleChange}
                                placeholder="0"
                                min="0"
                                step="0.1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taxType">Tipe Pajak</Label>
                            <Select
                                name="taxType"
                                value={formData.taxType}
                                onValueChange={(value) => setFormData(prev => ({ ...prev, taxType: value }))}
                            >
                                <SelectTrigger id="taxType">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="exclusive">Belum Termasuk (Exclusive)</SelectItem>
                                    <SelectItem value="inclusive">Sudah Termasuk (Inclusive)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {formData.taxType === 'exclusive'
                                    ? 'Pajak akan ditambahkan di atas harga produk.'
                                    : 'Harga produk sudah termasuk pajak. Pajak akan dihitung mundur dari total.'}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="serviceCharge">Biaya Layanan (%)</Label>
                            <Input
                                id="serviceCharge"
                                name="serviceCharge"
                                type="number"
                                value={formData.serviceCharge}
                                onChange={handleChange}
                                placeholder="0"
                                min="0"
                                step="0.1"
                            />
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSaving}>
                                <Save className="h-4 w-4 mr-2" />
                                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Percent className="h-5 w-5" />
                        <CardTitle>Pengaturan Diskon</CardTitle>
                    </div>
                    <CardDescription>Konfigurasi fitur diskon transaksi.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="enableDiscount" className="flex flex-col space-y-1">
                                <span>Aktifkan Diskon Transaksi</span>
                                <span className="font-normal text-xs text-muted-foreground">
                                    Izinkan kasir memberikan diskon manual saat pembayaran.
                                </span>
                            </Label>
                            <Switch
                                id="enableDiscount"
                                checked={formData.enableDiscount}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableDiscount: checked }))}
                            />
                        </div>

                        {formData.enableDiscount && (
                            <div className="space-y-2 pt-2 border-t">
                                <Label htmlFor="discountPin">PIN Otorisasi Diskon (Opsional)</Label>
                                <Input
                                    id="discountPin"
                                    name="discountPin"
                                    type="text"
                                    value={formData.discountPin}
                                    onChange={handleChange}
                                    placeholder="Masukkan PIN (Contoh: 1234)"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Jika diisi, staff/kasir (non-admin) wajib memasukkan PIN ini untuk memberikan diskon.
                                    Kosongkan jika ingin bebas tanpa PIN.
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSaving}>
                                <Save className="h-4 w-4 mr-2" />
                                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default FeesSettings;
