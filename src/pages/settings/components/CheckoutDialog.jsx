import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Info, Upload, CheckCircle2, Loader2, Copy } from 'lucide-react';
import { toast } from '../../../components/ui/use-toast';
import { supabase } from '../../../supabase';
import { useData } from '../../../context/DataContext';

const CheckoutDialog = ({ isOpen, onClose, plan }) => {
    const { currentStore } = useData();
    const [step, setStep] = useState(1); // 1: Details & QRIS, 2: Upload Proof, 3: Success
    const [duration, setDuration] = useState('1');
    const [uniqueCode, setUniqueCode] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFile(null);
            setPreviewUrl(null);
            setUniqueCode(Math.floor(Math.random() * 900) + 100); // 100-999
        }
    }, [isOpen]);

    const getPrice = () => {
        // Use priceValue (numeric) if available, otherwise 0
        const basePrice = plan?.priceValue ?? 0;
        if (typeof basePrice !== 'number') return 0;
        return basePrice;
    };

    const calculateTotal = () => {
        const months = parseInt(duration);
        const subtotal = getPrice() * months;
        // Discount logic for yearly? e.g. 12 months pay for 10?
        // keeping it simple for now
        let total = subtotal;
        if (months === 12) {
            total = subtotal * 0.9; // 10% discount for yearly
        }
        return total;
    };

    const finalTotal = calculateTotal() + uniqueCode;

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Disalin ke clipboard",
            description: "Nominal bayar berhasil disalin."
        });
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.size > 1 * 1024 * 1024) { // 1MB limit
                toast({
                    title: "Ukuran file terlalu besar",
                    description: "Maksimal ukuran file adalah 1MB",
                    variant: "destructive"
                });
                return;
            }
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleSubmit = async () => {
        if (!file) {
            toast({
                title: "Bukti transfer belum diupload",
                description: "Mohon upload bukti transfer terlebih dahulu.",
                variant: "destructive"
            });
            return;
        }

        setUploading(true);
        try {
            // 1. Upload File
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentStore.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('payment-proofs')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // Store relative path for private bucket access via signed URL
            const proofUrl = fileName;

            // 2. Insert Invoice Record
            const { error: insertError } = await supabase
                .from('subscription_invoices')
                .insert({
                    store_id: currentStore.id,
                    plan_id: plan.id,
                    amount: finalTotal, // includes unique code
                    unique_code: uniqueCode,
                    duration_months: parseInt(duration),
                    status: 'pending',
                    payment_method: 'qris',
                    proof_url: proofUrl,
                    created_at: new Date().toISOString()
                });

            if (insertError) throw insertError;

            setStep(3); // Success Step
            toast({
                title: "Pesanan Berhasil",
                description: "Bukti pembayaran telah dikirim."
            });

        } catch (error) {
            console.error("Checkout Error:", error);
            toast({
                title: "Gagal mengirim pesanan",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                {step === 1 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Checkout Paket {plan?.name}</DialogTitle>
                            <DialogDescription>
                                Lengkapi detail pesanan untuk mendapatkan QRIS pembayaran.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {/* Duration Selection */}
                            <div className="space-y-2">
                                <Label>Durasi Langganan</Label>
                                <Select value={duration} onValueChange={setDuration}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih durasi" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 Bulan</SelectItem>
                                        <SelectItem value="3">3 Bulan</SelectItem>
                                        <SelectItem value="6">6 Bulan</SelectItem>
                                        <SelectItem value="12">1 Tahun (Hemat 10%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Summary */}
                            <div className="rounded-lg border p-4 bg-slate-50 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Harga Paket</span>
                                    <span>Rp {parseInt(getPrice()).toLocaleString('id-ID')} / bulan</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Durasi</span>
                                    <span>{duration} Bulan</span>
                                </div>
                                {duration === '12' && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Diskon Tahunan</span>
                                        <span>-10%</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm font-medium text-amber-600">
                                    <span className="flex items-center gap-1">Kode Unik <Info className="h-3 w-3" /></span>
                                    <span>{uniqueCode}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total Bayar</span>
                                    <div className="flex items-center gap-2">
                                        <span>Rp {finalTotal.toLocaleString('id-ID')}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(finalTotal)}>
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    *Mohon transfer <strong>PERSIS</strong> sampai 3 digit terakhir untuk verifikasi otomatis.
                                </p>
                            </div>

                            {/* QRIS Display */}
                            <div className="flex flex-col items-center justify-center space-y-3 p-4 border rounded-lg">
                                <span className="text-sm font-medium">Scan QRIS untuk Membayar</span>
                                <div className="bg-white p-2 rounded-lg border shadow-sm">
                                    {/* Try loading qris.png from public folder, fallback to SVG placeholder */}
                                    <img
                                        src="/qris.png"
                                        alt="QRIS Code"
                                        className="w-48 h-48 object-contain"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = `data:image/svg+xml;utf8,${encodeURIComponent(
                                                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f1f5f9"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" text-anchor="middle" dy=".3em" fill="#64748b">QRIS CODE</text></svg>'
                                            )}`;
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                    Mendukung BCA, Mandiri, BRI, GoPay, OVO, Dana, ShopeePay
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={onClose}>Batal</Button>
                            <Button onClick={() => setStep(2)}>Sudah Bayar? Upload Bukti</Button>
                        </DialogFooter>
                    </>
                )}

                {step === 2 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Upload Bukti Pembayaran</DialogTitle>
                            <DialogDescription>
                                Upload screenshoot atau foto bukti transfer Anda.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Total yang harus dibayar</AlertTitle>
                                <AlertDescription className="font-bold">
                                    Rp {finalTotal.toLocaleString('id-ID')}
                                </AlertDescription>
                            </Alert>

                            <div className="grid w-full max-w-sm items-center gap-1.5">
                                <Label htmlFor="picture">Bukti Transfer</Label>
                                <Input id="picture" type="file" accept="image/*" onChange={handleFileChange} />
                            </div>

                            {previewUrl && (
                                <div className="mt-4 relative rounded-lg border overflow-hidden h-48 w-full bg-slate-100 flex items-center justify-center">
                                    <img src={previewUrl} alt="Preview" className="h-full object-contain" />
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setStep(1)} disabled={uploading}>Kembali</Button>
                            <Button onClick={handleSubmit} disabled={!file || uploading}>
                                {uploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Mengirim...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Kirim Bukti
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {step === 3 && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-center text-green-600">Pesanan Diterima!</DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-col items-center justify-center py-6 space-y-4">
                            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <p className="text-center text-muted-foreground">
                                Terima kasih! Pesanan Anda sedang kami verifikasi.<br />
                                Layanan akan aktif maksimal 1x24 jam setelah pembayaran dikonfirmasi.
                            </p>
                        </div>

                        <DialogFooter>
                            <Button onClick={onClose} className="w-full">Tutup</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CheckoutDialog;
