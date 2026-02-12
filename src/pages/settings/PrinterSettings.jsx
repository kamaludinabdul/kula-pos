import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { printerService } from '../../services/printer';
import { printReceiptBrowser } from '../../lib/receiptHelper';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Save, Printer, Bluetooth, CheckCircle, XCircle } from 'lucide-react';

const PrinterSettings = () => {
    const { activeStoreId, currentStore, updateStore } = useData();
    const [formData, setFormData] = useState({
        printerType: 'bluetooth',
        printerWidth: '58mm',
        receiptHeader: '',
        receiptFooter: '',
        autoPrintReceipt: false
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerStatus, setPrinterStatus] = useState({
        connected: printerService.isConnected(),
        name: printerService.getDeviceName()
    });

    useEffect(() => {
        if (currentStore) {
            setFormData(prev => {
                const newData = {
                    printerType: currentStore.printerType || 'bluetooth',
                    printerWidth: currentStore.printerWidth || '58mm',
                    receiptHeader: currentStore.receiptHeader || '',
                    receiptFooter: currentStore.receiptFooter || 'Terima Kasih',
                    autoPrintReceipt: currentStore.autoPrintReceipt || false
                };

                if (
                    prev.printerType === newData.printerType &&
                    prev.printerWidth === newData.printerWidth &&
                    prev.receiptHeader === newData.receiptHeader &&
                    prev.receiptFooter === newData.receiptFooter &&
                    prev.autoPrintReceipt === newData.autoPrintReceipt
                ) {
                    return prev;
                }

                return newData;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        currentStore?.printerType,
        currentStore?.printerWidth,
        currentStore?.receiptHeader,
        currentStore?.receiptFooter,
        currentStore?.autoPrintReceipt
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
            alert('Pengaturan printer berhasil disimpan!');
        } else {
            alert('Gagal menyimpan pengaturan.');
        }
    };

    const handleConnectPrinter = async () => {
        const result = await printerService.connect();
        if (result.success) {
            setPrinterStatus({ connected: true, name: result.name });
            alert(`Terhubung ke ${result.name}`);
        } else {
            alert(`Koneksi gagal: ${result.error}`);
        }
    };

    const handleDisconnectPrinter = () => {
        printerService.disconnect();
        setPrinterStatus({ connected: false, name: null });
    };

    const handleTestPrint = async () => {
        setIsPrinting(true);
        try {
            if (formData.printerType === 'bluetooth') {
                const result = await printerService.printTestReceipt(currentStore);
                if (result.success) {
                    alert('Test print berhasil! Silakan cek printer Anda.');
                } else {
                    alert(`Test print gagal: ${result.error}`);
                }
            } else {
                // Standard Printer - Use Browser Print (High Quality) to match POS
                const dummyTransaction = {
                    id: 'TEST-12345',
                    date: new Date(),
                    cashier: 'Staff Test',
                    customerName: 'Pelanggan Demo',
                    items: [
                        { name: 'Kopi Susu Gula Aren', qty: 2, price: 18000 },
                        { name: 'Roti Bakar Coklat', qty: 1, price: 25000 }
                    ],
                    subtotal: 61000,
                    total: 61000,
                    amountPaid: 100000,
                    change: 39000,
                    paymentMethod: 'cash',
                    pointsEarned: 10,
                    customerTotalPoints: 150
                };

                printReceiptBrowser(dummyTransaction, currentStore);
            }
        } catch (error) {
            alert(`Test print gagal: ${error.message}`);
        } finally {
            setIsPrinting(false);
        }
    };

    if (!currentStore) return <div>Loading...</div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5" />
                    <CardTitle>Koneksi & Struk</CardTitle>
                </div>
                <CardDescription>Konfigurasi koneksi printer dan tampilan struk.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="printerType">Tipe Printer</Label>
                        <Select
                            name="printerType"
                            value={formData.printerType}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, printerType: value }))}
                        >
                            <SelectTrigger id="printerType">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bluetooth">Bluetooth Thermal (Mobile/Portable)</SelectItem>
                                <SelectItem value="standard">Printer Standar (USB/WiFi/Driver PC)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.printerType === 'bluetooth' && (
                        <Card className="bg-muted/50">
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    {printerStatus.connected ? (
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-5 w-5 text-green-600" />
                                            <div>
                                                <p className="font-medium">Terhubung</p>
                                                <p className="text-sm text-muted-foreground">{printerStatus.name}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <XCircle className="h-5 w-5 text-muted-foreground" />
                                            <p className="text-muted-foreground">Printer Belum Terhubung</p>
                                        </div>
                                    )}
                                </div>
                                {!printerStatus.connected ? (
                                    <div className="space-y-2">
                                        <Button type="button" variant="outline" onClick={handleConnectPrinter} className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
                                            <Bluetooth className="h-4 w-4 mr-2" />
                                            Hubungkan Printer Bluetooth
                                        </Button>
                                        <Button type="button" variant="ghost" onClick={handleTestPrint} disabled={isPrinting} className="w-full text-gray-500">
                                            <Printer className="h-4 w-4 mr-2" />
                                            {isPrinting ? 'Mencetak...' : 'Test Print (Simulasi)'}
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button type="button" variant="outline" onClick={handleTestPrint} disabled={isPrinting}>
                                                <Printer className="h-4 w-4 mr-2" />
                                                {isPrinting ? 'Mencetak...' : 'Test Print'}
                                            </Button>
                                            <Button type="button" variant="outline" onClick={handleDisconnectPrinter} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                                Putuskan Koneksi
                                            </Button>
                                        </div>
                                    </>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    Catatan: Hanya mendukung Printer Thermal Bluetooth (ESC/POS).
                                </p>
                            </CardContent>
                        </Card>
                    )}


                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="autoPrintReceipt"
                            checked={formData.autoPrintReceipt}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoPrintReceipt: checked }))}
                        />
                        <Label htmlFor="autoPrintReceipt" className="cursor-pointer font-normal">Cetak Struk Otomatis</Label>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="printerWidth">Ukuran Kertas</Label>
                        <Select
                            name="printerWidth"
                            value={formData.printerWidth}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, printerWidth: value }))}
                        >
                            <SelectTrigger id="printerWidth">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="58mm">58mm (Thermal Kecil)</SelectItem>
                                <SelectItem value="80mm">80mm (Thermal Besar)</SelectItem>
                                <>
                                    <SelectItem value="A4">A4 (Standar Dokumen)</SelectItem>
                                    <SelectItem value="Letter">Letter</SelectItem>
                                    <SelectItem value="continuous">Continuous Form (Dot Matrix)</SelectItem>
                                </>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="receiptHeader">Header Struk (Atas)</Label>
                        <Textarea
                            id="receiptHeader"
                            name="receiptHeader"
                            value={formData.receiptHeader}
                            onChange={handleChange}
                            placeholder="Contoh: Selamat Datang!"
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="receiptFooter">Footer Struk (Bawah)</Label>
                        <Textarea
                            id="receiptFooter"
                            name="receiptFooter"
                            value={formData.receiptFooter}
                            onChange={handleChange}
                            placeholder="Contoh: Terima Kasih atas kunjungan Anda"
                            rows={2}
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isSaving}>
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </form>
            </CardContent >
        </Card >
    );
};

export default PrinterSettings;
