import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Loader2, UploadCloud, AlertCircle } from 'lucide-react';
import { useToast } from '../../../components/ui/use-toast';
import { supabase } from '../../../supabase';
import { compressImage } from '../../../utils/imageCompressor';

const ReuploadDialog = ({ isOpen, onClose, invoice, onSuccess }) => {
    const { toast } = useToast();
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);

    // Reset state on open
    React.useEffect(() => {
        if (isOpen) {
            setFile(null);
            setPreviewUrl(null);
            setLoading(false);
        }
    }, [isOpen]);

    const dataURLToBlob = async (dataUrl) => {
        const res = await fetch(dataUrl);
        return await res.blob();
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            try {
                // Compress image before setting state
                const compressedDataUrl = await compressImage(selectedFile, 1000, 0.7);
                const compressedBlob = await dataURLToBlob(compressedDataUrl);
                const compressedFile = new File([compressedBlob], selectedFile.name, {
                    type: selectedFile.type,
                    lastModified: Date.now(),
                });

                setFile(compressedFile);
                setPreviewUrl(compressedDataUrl);
            } catch (error) {
                console.error("Compression error:", error);
                toast({
                    title: "Gagal memproses gambar",
                    description: "Terjadi kesalahan saat mengompres gambar.",
                    variant: "destructive"
                });
            }
        }
    };

    const handleSubmit = async () => {
        if (!file || !invoice) return;

        setLoading(true);
        try {
            // 1. Upload new proof
            const fileExt = file.name.split('.').pop();
            const fileName = `${invoice.id}_${Date.now()}.${fileExt}`;
            const filePath = `${invoice.store_id}/${fileName}`; // Verify if store_id is available in invoice object

            if (!invoice.store_id) throw new Error("Store ID missing from invoice data");

            const { error: uploadError } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Update invoice status via RPC (to bypass RLS restriction on UPDATE)
            const { data: rpcData, error: rpcError } = await supabase.rpc('reupload_payment_proof', {
                p_invoice_id: invoice.id,
                p_proof_url: filePath
            });

            if (rpcError) throw rpcError;
            if (rpcData && !rpcData.success) throw new Error(rpcData.message || 'Gagal memperbarui invoice');

            toast({
                title: "Bukti Terkirim",
                description: "Bukti pembayaran telah diperbarui. Mohon tunggu verifikasi admin.",
            });

            onSuccess?.();
            onClose();

        } catch (error) {
            console.error("Re-upload error:", error);
            toast({
                title: "Gagal Mengirim",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    if (!invoice) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Perbaiki Pembayaran</DialogTitle>
                    <DialogDescription>
                        Upload ulang bukti transfer untuk Invoice <strong>#{invoice.unique_code ? `INV...${invoice.unique_code}` : invoice.id.slice(0, 8)}</strong>
                    </DialogDescription>
                </DialogHeader>

                {invoice.rejection_reason && (
                    <Alert variant="destructive" className="my-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Alasan Penolakan</AlertTitle>
                        <AlertDescription>
                            "{invoice.rejection_reason}"
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4 py-2">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="reupload-picture">Bukti Transfer Baru</Label>
                        <Input id="reupload-picture" type="file" accept="image/*" onChange={handleFileChange} className="w-full" />
                        <p className="text-[0.8rem] text-muted-foreground">
                            Pastikan nominal transfer sesuai tagihan: <strong>Rp {invoice?.amount?.toLocaleString('id-ID')}</strong>
                        </p>
                    </div>

                    {previewUrl && (
                        <div className="relative rounded-lg overflow-hidden border aspect-video bg-slate-100 flex items-center justify-center">
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={!file || loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...
                            </>
                        ) : (
                            <>
                                <UploadCloud className="mr-2 h-4 w-4" /> Kirim
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReuploadDialog;
