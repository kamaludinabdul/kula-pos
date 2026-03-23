import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { CheckCircle, Printer, CreditCard, Banknote, Wallet } from 'lucide-react';
import { printReceiptBrowser } from '../lib/receiptHelper';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { createServiceTransaction, calculateCommissionAmount } from '../lib/createServiceTransaction';

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Tunai', icon: <Banknote className="h-4 w-4" /> },
    { value: 'transfer', label: 'Transfer', icon: <CreditCard className="h-4 w-4" /> },
    { value: 'qris', label: 'QRIS', icon: <Wallet className="h-4 w-4" /> },
];

const BookingPaymentDialog = ({ isOpen, onClose, booking, pet, customer, service, room, onPaymentSuccess }) => {
    const { stores, activeStoreId, updatePetBooking, processSale, petServices } = useData();
    const { user } = useAuth();
    const { currentShift } = useShift();
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountPaid, setAmountPaid] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [receiptData, setReceiptData] = useState(null);

    if (!isOpen || !booking) return null;

    const total = booking.totalPrice || 0;
    const paid = Number(amountPaid) || total;
    const change = paymentMethod === 'cash' ? Math.max(0, paid - total) : 0;
    
    const activeStore = stores?.find(s => s.id === activeStoreId);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            // Update booking: completed + paid
            const result = await updatePetBooking(booking.id, {
                ...booking,
                status: 'completed',
                paymentStatus: 'paid',
            });

            if (!result.success) {
                alert('Gagal memproses pembayaran: ' + result.error);
                return;
            }

            // Build a receipt-compatible transaction object
            const receipt = {
                id: booking.id,
                date: new Date().toISOString(),
                cashier: 'Staff',
                customerName: customer?.name || '',
                customerPhone: customer?.phone || '',
                paymentMethod,
                amountPaid: paid,
                change,
                subtotal: total,
                total,
                items: [
                    {
                        name: booking.serviceType === 'hotel'
                            ? `Hotel - ${room?.name || 'Kamar'}`
                            : (service?.name || booking.serviceType),
                        qty: 1,
                        price: total,
                        unit: '',
                        discount: 0,
                    }
                ],
                notes: booking.notes || '',
            };

            // Determine commission configuration source
            let itemCommissionObj = service;
            if (booking.serviceType === 'hotel' && room) {
                itemCommissionObj = (petServices || []).find(s => s.id === room.linkedServiceId);
            }

            // Create Transaction Record
            const transactionItem = {
                id: booking.serviceType === 'hotel' ? `hotel-${room?.id || 'room'}` : (service?.id || 'service'),
                name: booking.serviceType === 'hotel'
                    ? `Hotel - ${room?.name || 'Kamar'}`
                    : (service?.name || booking.serviceType),
                price: total,
                qty: 1,
                unit: '',
                discount: 0,
                total: total,
                doctorFeeType: itemCommissionObj?.doctorFeeType || null,
                doctorFeeValue: itemCommissionObj?.doctorFeeValue || 0,
                doctorCommissionAmount: calculateCommissionAmount(total, 1, itemCommissionObj?.doctorFeeType, itemCommissionObj?.doctorFeeValue),
                groomerCommissionAmount: calculateCommissionAmount(total, 1, 'fixed', itemCommissionObj?.commissions?.groomerFee),
                paramedicCommissionAmount: calculateCommissionAmount(total, 1, 'fixed', itemCommissionObj?.commissions?.paramedicFee),
                cashierCommissionAmount: calculateCommissionAmount(total, 1, 'fixed', itemCommissionObj?.commissions?.cashierFee)
            };

            const txData = createServiceTransaction({
                items: [transactionItem],
                total: total,
                paymentMethod: paymentMethod,
                amountPaid: paid,
                change: change,
                customer: customer,
                store: activeStore,
                user: user,
                shiftId: currentShift?.id,
                notes: booking.notes || ''
            });

            // Make sure the transaction is added before finishing
            if (activeStore) {
                const txResult = await processSale(txData);
                if (!txResult.success) {
                    console.error("Gagal mencatat transaksi POS", txResult.error);
                    // We don't block the UI here since booking was updated, but we log the error
                }
            }

            setReceiptData(receipt);
            setIsDone(true);
            if (onPaymentSuccess) onPaymentSuccess();
        } catch (e) {
            alert('Terjadi kesalahan: ' + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = () => {
        if (receiptData) {
            printReceiptBrowser(receiptData, activeStore);
        }
    };

    const handleClose = () => {
        setIsDone(false);
        setReceiptData(null);
        setAmountPaid('');
        setPaymentMethod('cash');
        onClose();
    };

    // --- SUCCESS STATE ---
    if (isDone) {
        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-[400px]">
                    <div className="flex flex-col items-center gap-4 py-6">
                        <div className="rounded-full bg-green-100 p-4">
                            <CheckCircle className="h-12 w-12 text-green-600" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-slate-800">Pembayaran Berhasil!</h3>
                            <p className="text-slate-500 mt-1">Booking telah diselesaikan dan pembayaran tercatat.</p>
                        </div>

                        {change > 0 && (
                            <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                                <div className="text-xs text-amber-600 font-bold uppercase tracking-widest">Kembalian</div>
                                <div className="text-2xl font-black text-amber-700">Rp {change.toLocaleString('id-ID')}</div>
                            </div>
                        )}

                        <div className="flex gap-3 w-full mt-2">
                            <Button variant="outline" className="flex-1" onClick={handleClose}>
                                Tutup
                            </Button>
                            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
                                <Printer className="mr-2 h-4 w-4" />
                                Cetak Struk
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // --- PAYMENT FORM STATE ---
    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
                </DialogHeader>

                {/* Booking Summary */}
                <div className="bg-slate-50 border rounded-lg p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Hewan</span>
                        <span className="font-semibold">{pet?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Pemilik</span>
                        <span>{customer?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Layanan</span>
                        <Badge variant="outline" className="capitalize">{booking.serviceType}</Badge>
                    </div>
                    {booking.serviceType === 'hotel' && room && (
                        <div className="flex justify-between">
                            <span className="text-slate-500">Kamar</span>
                            <span>{room.name}</span>
                        </div>
                    )}
                    {booking.serviceType !== 'hotel' && service && (
                        <div className="flex justify-between">
                            <span className="text-slate-500">Item</span>
                            <span>{service.name}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center border-t pt-2 mt-2">
                        <span className="font-bold text-slate-700">Total</span>
                        <span className="text-lg font-black text-blue-600">Rp {total.toLocaleString('id-ID')}</span>
                    </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                    <Label>Metode Pembayaran</Label>
                    <div className="flex gap-2">
                        {PAYMENT_METHODS.map(({ value, label, icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setPaymentMethod(value)}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 text-xs font-semibold transition-all ${
                                    paymentMethod === value
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                            >
                                {icon} {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Amount Paid (only for cash) */}
                {paymentMethod === 'cash' && (
                    <div className="space-y-2">
                        <Label htmlFor="amountPaid">Uang Diterima (kosongkan = pas)</Label>
                        <Input
                            id="amountPaid"
                            type="number"
                            placeholder={`Min. Rp ${total.toLocaleString('id-ID')}`}
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            min={total}
                        />
                        {change > 0 && (
                            <div className="text-right text-sm font-semibold text-amber-600">
                                Kembalian: Rp {change.toLocaleString('id-ID')}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                        Batal
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {isSubmitting ? 'Memproses...' : 'Bayar & Selesaikan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BookingPaymentDialog;
