import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useShift } from '../../context/ShiftContext';

const CashManagementDialog = ({ isOpen, onClose }) => {
    const { addCashMovement } = useShift();
    const [type, setType] = useState('out'); // 'in' or 'out'
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [category, setCategory] = useState('Operasional');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!amount || !reason) {
            alert('Mohon isi jumlah dan keterangan.');
            return;
        }

        setLoading(true);
        const result = await addCashMovement(type, amount, reason, category);
        setLoading(false);

        if (result.success) {
            alert('Berhasil mencatat kas.');
            setAmount('');
            setReason('');
            setCategory('Operasional');
            onClose();
        } else {
            alert('Gagal mencatat kas: ' + result.error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Kelola Kas (Petty Cash)</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                            Tipe
                        </Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Pilih Tipe" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="out">Keluar (Expense)</SelectItem>
                                <SelectItem value="in">Masuk (Income)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">
                            Jumlah
                        </Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="col-span-3"
                            placeholder="0"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                            Kategori
                        </Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Pilih Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Operasional">Operasional</SelectItem>
                                <SelectItem value="Pembelian Bahan">Pembelian Bahan</SelectItem>
                                <SelectItem value="Lainnya">Lainnya</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="reason" className="text-right">
                            Keterangan
                        </Label>
                        <Input
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="col-span-3"
                            placeholder="Contoh: Beli Es Batu"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={loading} className={type === 'out' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}>
                        {loading ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CashManagementDialog;
