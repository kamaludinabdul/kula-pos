import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

export const StartShiftDialog = ({ isOpen, onClose, onStart, initialCash, setInitialCash }) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleStart = async () => {
        setIsSubmitting(true);
        try { await onStart(); } finally { setIsSubmitting(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Buka Shift Baru</DialogTitle>
                    <DialogDescription>Masukkan modal awal kasir untuk memulai shift.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="initial-cash">Modal Awal (Rp)</Label>
                        <Input
                            id="initial-cash"
                            type="number"
                            placeholder="0"
                            value={initialCash}
                            onChange={(e) => setInitialCash(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</Button>
                    <Button onClick={handleStart} disabled={isSubmitting}>
                        {isSubmitting ? 'Memproses...' : 'Buka Shift'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const EndShiftDialog = ({
    isOpen, onClose, onEnd,
    finalCash, setFinalCash,
    finalNonCash, setFinalNonCash,
    shiftNotes, setShiftNotes,
    currentShift,
    isLoading // Add Loading Prop
}) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleEnd = async () => {
        setIsSubmitting(true);
        try { await onEnd(); } finally { setIsSubmitting(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Tutup Shift</DialogTitle>
                    <DialogDescription>Masukkan total uang tunai dan bukti transfer/EDC saat ini.</DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="py-8 flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        <span className="ml-2">Menghitung ringkasan shift...</span>
                    </div>
                ) : (
                    <>
                        {/* Shift Summary */}
                        {/* Shift Summary */}
                        <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm mb-4 border">
                            <div className="flex justify-between font-medium">
                                <span>Modal Awal:</span>
                                <span>Rp {(Number(currentShift?.initialCash) || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                                <span>Total Transaksi:</span>
                                <span>{currentShift?.transactions || 0}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                                <span>Total Penjualan:</span>
                                <span>Rp {(currentShift?.totalSales || 0).toLocaleString()}</span>
                            </div>
                            <div className="border-t pt-2 mt-2 space-y-1">
                                <div className="text-xs text-muted-foreground font-semibold">Ringkasan Kas:</div>
                                <div className="flex justify-between">
                                    <span>Tunai Diterima:</span>
                                    <span className="text-green-600">Rp {(currentShift?.totalCashSales || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Non-Tunai:</span>
                                    <span className="text-blue-600">Rp {(currentShift?.totalNonCashSales || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Kas Masuk:</span>
                                    <span className="text-green-600">+ Rp {(currentShift?.totalCashIn || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Kas Keluar:</span>
                                    <span className="text-red-600">- Rp {(currentShift?.totalCashOut || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {currentShift?.paymentStats && Object.keys(currentShift.paymentStats).length > 0 && (
                                <div className="border-t pt-2 mt-2 space-y-1">
                                    <div className="text-xs text-muted-foreground font-semibold">Detail Metode Pembayaran:</div>
                                    {Object.entries(currentShift.paymentStats).map(([method, amount]) => (
                                        <div key={method} className="flex justify-between pl-2 text-xs text-slate-600">
                                            <span className="capitalize">{method === 'cash' ? 'Tunai' : method}:</span>
                                            <span>Rp {Number(amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="final-cash">Total Uang Tunai (Fisik) (Rp)</Label>
                                <Input
                                    id="final-cash"
                                    type="number"
                                    placeholder="0"
                                    value={finalCash}
                                    onChange={(e) => setFinalCash(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="final-non-cash">Total Uang Transfer/EDC (Rp)</Label>
                                <Input
                                    id="final-non-cash"
                                    type="number"
                                    placeholder="0"
                                    value={finalNonCash}
                                    onChange={(e) => setFinalNonCash(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="shift-notes">Catatan (Opsional)</Label>
                                <Textarea
                                    id="shift-notes"
                                    placeholder="Selisih, pengeluaran tak terduga, dll."
                                    value={shiftNotes}
                                    onChange={(e) => setShiftNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</Button>
                            <Button variant="destructive" onClick={handleEnd} disabled={isSubmitting || isLoading}>
                                {isSubmitting ? 'Memproses...' : 'Tutup Shift'}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
