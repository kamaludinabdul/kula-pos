import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { AlertCircle } from 'lucide-react';

const StampAdjustmentDialog = ({ open, onOpenChange, customer, stampData, onSuccess }) => {
    const { adjustCustomerStamps } = useData();
    const [type, setType] = useState('addition'); // 'deduction' or 'addition'
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const numAmount = parseInt(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setError('Jumlah harus lebih dari 0');
            return;
        }

        if (!reason.trim()) {
            setError('Alasan harus diisi');
            return;
        }

        if (type === 'deduction' && numAmount > stampData.currentStamps) {
            setError(`Tidak bisa mengurangi lebih dari stamp saat ini (${stampData.currentStamps})`);
            return;
        }

        setLoading(true);
        const adjustAmount = type === 'deduction' ? -numAmount : numAmount;

        try {
            const result = await adjustCustomerStamps(customer.id, stampData.stampId, adjustAmount, reason, type);
            if (result.success) {
                setAmount('');
                setReason('');
                setType('addition');
                onOpenChange(false);
                if (onSuccess) onSuccess();
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            setError(err.message || 'Gagal menyesuaikan stamp');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setAmount('');
        setReason('');
        setType('addition');
        setError('');
        onOpenChange(false);
    };

    if (!customer || !stampData) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Sesuaikan Jumlah Stamp</DialogTitle>
                    <DialogDescription>
                        Program: <span className="font-bold text-slate-800">{stampData.ruleName}</span><br />
                        Pelanggan: <span className="font-bold text-slate-800">{customer.name}</span><br />
                        Stamp Saat Ini: <span className="font-bold text-amber-600">{stampData.currentStamps}</span> / {stampData.targetStamps}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-3">
                        <Label>Tipe Penyesuaian</Label>
                        <RadioGroup value={type} onValueChange={setType}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="addition" id="add-stamp" />
                                <Label htmlFor="add-stamp" className="font-normal cursor-pointer">
                                    Tambah Stamp
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="deduction" id="deduct-stamp" />
                                <Label htmlFor="deduct-stamp" className="font-normal cursor-pointer">
                                    Kurangi Stamp
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="stamp-amount">Jumlah Stamp</Label>
                        <Input
                            id="stamp-amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Masukkan jumlah stamp"
                            min="1"
                            max={type === 'deduction' ? stampData.currentStamps : undefined}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="stamp-reason">Catatan / Alasan *</Label>
                        <Textarea
                            id="stamp-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Contoh: Koreksi transaksi yang lupa discan"
                            rows={3}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Alasan ini akan tercatat dalam history poin/stamp loyalitas.
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-red-50 p-2 rounded-md">
                            <AlertCircle className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700">
                            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default StampAdjustmentDialog;
