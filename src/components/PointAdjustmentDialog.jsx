import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { AlertCircle } from 'lucide-react';

const PointAdjustmentDialog = ({ open, onOpenChange, customer, onSuccess }) => {
    const { adjustCustomerPoints, refreshData } = useData();
    const [type, setType] = useState('deduction'); // 'deduction' or 'addition'
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

        setLoading(true);
        const adjustAmount = type === 'deduction' ? -numAmount : numAmount;
        const result = await adjustCustomerPoints(customer.id, adjustAmount, reason, type);

        if (result.success) {
            // Refresh data to ensure UI updates
            await refreshData();

            alert(`Berhasil ${type === 'deduction' ? 'mengurangi' : 'menambah'} ${numAmount} poin`);
            setAmount('');
            setReason('');
            setType('deduction');
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } else {
            setError(result.error?.message || 'Gagal menyesuaikan poin');
        }

        setLoading(false);
    };

    const handleClose = () => {
        setAmount('');
        setReason('');
        setType('deduction');
        setError('');
        onOpenChange(false);
    };

    if (!customer) return null;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Sesuaikan Poin - {customer.name}</DialogTitle>
                    <DialogDescription>
                        Poin saat ini: <span className="font-bold">{customer.loyaltyPoints || customer.points || 0}</span> poin
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-3">
                        <Label>Tipe Penyesuaian</Label>
                        <RadioGroup value={type} onValueChange={setType}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="deduction" id="deduction" />
                                <Label htmlFor="deduction" className="font-normal cursor-pointer">
                                    Kurangi Poin
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="addition" id="addition" />
                                <Label htmlFor="addition" className="font-normal cursor-pointer">
                                    Tambah Poin
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Jumlah Poin</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Masukkan jumlah poin"
                            min="1"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">Alasan *</Label>
                        <Textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Contoh: Kompensasi kesalahan transaksi"
                            rows={3}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Alasan akan tercatat dalam history penyesuaian
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PointAdjustmentDialog;
