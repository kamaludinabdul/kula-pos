import React, { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../../version';
import {
    CreditCard,
    Banknote,
    QrCode,
    CheckCircle,
    Printer,
    Download,
    Loader2,
    Calendar
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Calendar as CalendarComponent } from "../ui/calendar";
import { cn, formatDate } from "../../lib/utils";
import { useBusinessType } from '../../hooks/useBusinessType';

const CheckoutDialog = ({
    isOpen,
    onClose,
    total,
    onProcessPayment,
    paymentSuccess,
    onPrintReceipt,
    onPrintEtiket,
    onDownloadReceipt,
    onCloseSuccess,
    store,
    lastTransaction,
    user, // NEW: For role-based date picker
    selectedCustomer,
    pointsEarned,
    stampUpdates = []
}) => {
    const cashInputRef = useRef(null);
    const receiptRef = useRef(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [cashAmount, setCashAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const hasAutoPrinted = useRef(false);
    const [transactionDate, setTransactionDate] = useState(new Date()); // NEW: Transaction date

    // Check if user can backdate (admin/super_admin AND setting enabled)
    const canBackdate = (user?.role === 'owner' || user?.role === 'super_admin') && store?.settings?.allowBackdateTransaction;
    const { term, isPharmacy } = useBusinessType();

    // Auto print receipt
    useEffect(() => {
        if (paymentSuccess) {
            if (store?.autoPrintReceipt && !hasAutoPrinted.current) {
                // Small delay to ensure modal is rendered and animations settle
                const timer = setTimeout(() => {
                    onPrintReceipt();
                    hasAutoPrinted.current = true;
                }, 500);
                return () => clearTimeout(timer);
            }
        } else {
            hasAutoPrinted.current = false;
        }
    }, [paymentSuccess, store, onPrintReceipt]);

    // Auto focus cash input
    useEffect(() => {
        if (isOpen && !paymentSuccess && paymentMethod === 'cash') {
            setTimeout(() => cashInputRef.current?.focus(), 100);
        }
    }, [isOpen, paymentSuccess, paymentMethod]);

    const change = (parseFloat(cashAmount) || 0) - total;
    const isCashSufficient = paymentMethod !== 'cash' || (parseFloat(cashAmount) >= total);

    const handleProcess = async () => {
        if (isProcessing) return;

        const parsedCash = parseFloat(cashAmount) || 0;

        if (paymentMethod === 'cash' && parsedCash < total) {
            alert(`Pembayaran Gagal: Uang tunai kurang! (Butuh: ${total}, Input: ${parsedCash})`);
            return;
        }

        setIsProcessing(true);

        try {
            await onProcessPayment({
                paymentMethod,
                cashAmount: paymentMethod === 'cash' ? parsedCash : total,
                change: paymentMethod === 'cash' ? (parsedCash - total) : 0,
                transactionDate: canBackdate ? transactionDate : new Date() // NEW: Pass transaction date
            });
        } catch (error) {
            console.error("Payment failed", error);
            alert(`Error System (CheckoutDialog): ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Quick cash suggestions
    const suggestions = [
        total,
        Math.ceil(total / 5000) * 5000,
        Math.ceil(total / 10000) * 10000,
        Math.ceil(total / 50000) * 50000,
        Math.ceil(total / 100000) * 100000
    ].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4);

    const handleDownload = async () => {
        if (receiptRef.current) {
            try {
                const canvas = await html2canvas(receiptRef.current, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    useCORS: true
                });
                const image = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = image;
                link.download = `receipt-${lastTransaction?.id || 'transaction'}.png`;
                link.click();
            } catch (error) {
                console.error('Error generating receipt image:', error);
                // Fallback to prop if provided
                if (onDownloadReceipt) onDownloadReceipt();
            }
        } else if (onDownloadReceipt) {
            onDownloadReceipt();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (isProcessing) return;
            if (paymentSuccess) {
                onCloseSuccess();
            } else {
                onClose(open);
            }
        }}>
            <DialogContent className={cn(
                "max-h-[90vh] overflow-y-auto scrollbar-hide",
                paymentSuccess ? "sm:max-w-md" : "sm:max-w-lg"
            )}>
                <DialogHeader className={paymentSuccess ? "sr-only" : ""}>
                    <DialogTitle>{paymentSuccess ? "Pembayaran Berhasil" : "Pembayaran"}</DialogTitle>
                    <DialogDescription>
                        {paymentSuccess
                            ? "Detail transaksi dan opsi cetak struk"
                            : `Total tagihan Rp ${total.toLocaleString('id-ID')}`
                        }
                    </DialogDescription>
                </DialogHeader>

                {paymentSuccess ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4 w-full">
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-lg">Pembayaran Berhasil!</span>
                        </div>

                        {/* Explicit Points Notification */}
                        {(lastTransaction?.pointsEarned > 0 || lastTransaction?.customerTotalPoints > 0) && (
                            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm border border-blue-100 flex flex-col gap-1">
                                {lastTransaction.pointsEarned > 0 && <span>Anda mendapatkan <b>+{lastTransaction.pointsEarned} Poin</b></span>}
                                {lastTransaction.customerTotalPoints > 0 && <span>Total Sisa Poin: <b>{lastTransaction.customerTotalPoints}</b></span>}
                            </div>
                        )}

                        {/* Receipt Preview Area - Visual Matching POS (Legacy Style Restored) */}
                        <div className="w-full bg-slate-50 flex justify-center items-start py-4 border rounded-lg shadow-inner max-h-[50vh] overflow-y-auto">
                            <div
                                id="receipt-preview"
                                ref={receiptRef}
                                className="bg-white p-4 shadow-sm w-[80mm] h-fit text-sm font-mono relative"
                                style={{ color: '#000' }}
                            >
                                <div className="text-center mb-4">
                                    {store?.logo && (
                                        <div className="flex justify-center mb-2">
                                            <img src={store.logo} alt="Store Logo" className="h-12 object-contain filter grayscale" />
                                        </div>
                                    )}
                                    <div className="font-bold text-lg uppercase">{store?.name || 'Store Name'}</div>
                                    <div className="text-xs text-gray-500">{store?.address}</div>
                                    <div className="text-xs text-gray-500">{store?.phone}</div>
                                    <div className="border-b border-dashed border-gray-300 my-2"></div>
                                    <div className="text-xs whitespace-pre-wrap">{store?.receiptHeader}</div>
                                </div>

                                <div className="text-xs text-gray-500 mb-2">
                                    <div className="flex justify-between">
                                        <span>{formatDate(lastTransaction?.date || Date.now())}</span>
                                        <span>{lastTransaction?.cashier || 'Staff'}</span>
                                    </div>
                                    <div>No: #{lastTransaction?.id}</div>
                                    {lastTransaction?.customerName && (
                                        <div className="mt-1">
                                            <span className="font-bold text-gray-700">{term('customer')}: {lastTransaction.customerName}</span>
                                            {lastTransaction.customerPhone && <div className="text-[10px]">HP: {lastTransaction.customerPhone}</div>}
                                        </div>
                                    )}
                                    {lastTransaction?.patient_name && (
                                        <div className="mt-1">
                                            <span className="font-bold text-gray-700">Pasien: {lastTransaction.patient_name}</span>
                                            <div className="text-[10px]">Dokter: {lastTransaction.doctor_name || '-'}</div>
                                            {lastTransaction.prescription_number && <div className="text-[10px]">No. Resep: {lastTransaction.prescription_number}</div>}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1 mb-4 border-t border-dashed border-gray-300 py-2">
                                    {lastTransaction?.items?.map((item, idx) => {
                                        const originalTotal = item.price * item.qty;
                                        const itemDiscount = (item.discount || 0) * item.qty;
                                        const finalItemTotal = originalTotal - itemDiscount;

                                        if (itemDiscount > 0) {
                                            return (
                                                <div key={idx} className="mb-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="flex-1 text-left">{item.name} x{item.qty}{item.unit ? ` ${item.unit}` : ''}</span>
                                                        <span className="text-right line-through text-gray-400">{originalTotal.toLocaleString('id-ID')}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-red-500">
                                                        <span className="flex-1 text-left ml-2 text-[10px]">Diskon</span>
                                                        <span className="text-right text-[10px]">-{itemDiscount.toLocaleString('id-ID')}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs font-bold">
                                                        <span className="flex-1"></span>
                                                        <span className="text-right">{finalItemTotal.toLocaleString('id-ID')}</span>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div key={idx} className="flex justify-between text-xs">
                                                    <span className="flex-1 text-left">{item.name} x{item.qty}{item.unit ? ` ${item.unit}` : ''}</span>
                                                    <span className="text-right">Rp {finalItemTotal.toLocaleString('id-ID')}</span>
                                                </div>
                                            );
                                        }
                                    })}
                                </div>

                                <div className="text-right text-xs mb-2 border-b border-dashed border-gray-300 pb-2">
                                    Total Qty: {lastTransaction?.items ? lastTransaction.items.reduce((acc, item) => acc + Number(item.qty), 0) : 0}
                                </div>

                                <div className="border-t border-dashed border-gray-300 pt-2 space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span>Subtotal</span>
                                        <span>Rp {(lastTransaction?.subtotal || 0).toLocaleString('id-ID')}</span>
                                    </div>
                                    {lastTransaction?.discount > 0 && (
                                        <div className="flex justify-between text-red-500">
                                            <span>Diskon</span>
                                            <span>- Rp {lastTransaction.discount.toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                    {lastTransaction?.tax > 0 && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>Tax</span>
                                            <span>Rp {lastTransaction.tax.toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                    {lastTransaction?.serviceCharge > 0 && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>Service</span>
                                            <span>Rp {lastTransaction.serviceCharge.toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                    {lastTransaction?.tuslah_fee > 0 && (
                                        <div className="flex justify-between text-gray-500">
                                            <span>Biaya Tuslah/Embalase</span>
                                            <span>Rp {lastTransaction.tuslah_fee.toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-1 mt-1">
                                        <span>Total</span>
                                        <span>Rp {(lastTransaction?.total || 0).toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{(lastTransaction?.paymentMethod || 'cash').toUpperCase()}</span>
                                        <span>Rp {(lastTransaction?.amountPaid || lastTransaction?.cashAmount || lastTransaction?.total || 0).toLocaleString('id-ID')}</span>
                                    </div>
                                    {lastTransaction?.change > 0 && (
                                        <div className="flex justify-between font-medium">
                                            <span>Kembalian</span>
                                            <span>Rp {Number(lastTransaction.change).toLocaleString('id-ID')}</span>
                                        </div>
                                    )}

                                    {/* Integrated Points Info */}
                                    {(lastTransaction?.pointsEarned > 0 || lastTransaction?.customerTotalPoints > 0) && (
                                        <div className="border-t border-dashed border-gray-300 mt-2 pt-2 space-y-1">
                                            {lastTransaction.pointsEarned > 0 && (
                                                <div className="flex justify-between text-xs">
                                                    <span>Poin Didapat</span>
                                                    <span>+{lastTransaction.pointsEarned}</span>
                                                </div>
                                            )}
                                            {lastTransaction.customerTotalPoints > 0 && (
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span>Sisa Poin</span>
                                                    <span>{lastTransaction.customerTotalPoints}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Integrated Stamp Info */}
                                    {(lastTransaction?.payment_details?.stamp_updates?.length > 0 || lastTransaction?.stampUpdates?.length > 0) && (
                                        <div className="border-t border-dashed border-gray-300 mt-2 pt-2 space-y-1">
                                            <div className="text-[10px] font-bold text-gray-700 tracking-widest uppercase text-center mb-1">PROGRAM STAMP</div>
                                            {(lastTransaction.payment_details?.stamp_updates || lastTransaction.stampUpdates).map((stamp, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-50 rounded px-2 py-1">
                                                    <span className="text-gray-600 truncate">{stamp.rule_name}</span>
                                                    <span className="font-bold whitespace-nowrap ml-2">
                                                        {stamp.reward_reached ? `🎁 Reward (${stamp.target_stamps}/${stamp.target_stamps})` : `${stamp.current_stamps} / ${stamp.target_stamps}`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-dashed border-gray-300 mt-4 pt-3 text-center text-[10px] text-slate-400">
                                    <p className="whitespace-pre-wrap">{store?.receiptFooter || "Terima Kasih"}</p>
                                    <p className="mt-1 text-[8px] text-slate-300">KULA v{APP_VERSION}</p>
                                </div>
                            </div>
                        </div>

                        {/* Receipt Buttons */}
                        <div className="grid grid-cols-2 gap-3 w-full pt-2">
                            <Button variant="outline" onClick={onPrintReceipt} className="flex gap-2">
                                <Printer size={16} /> Cetak Struk
                            </Button>
                            <Button variant="outline" onClick={handleDownload} className="flex gap-2">
                                <Download size={16} /> Simpan Gambar
                            </Button>

                            {(isPharmacy || lastTransaction?.tuslah_fee > 0 || lastTransaction?.patient_name) && (
                                <Button
                                    variant="outline"
                                    onClick={() => onPrintEtiket && onPrintEtiket()}
                                    className="col-span-2 flex gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                >
                                    <Sparkles size={16} /> Cetak Etiket Obat (🧪)
                                </Button>
                            )}

                            <Button onClick={onCloseSuccess} className="col-span-2 bg-primary hover:bg-primary/90 text-white mt-1">
                                Transaksi Baru
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="py-4 space-y-6 px-1">
                            {/* Big Total & Loyalty Info */}
                            <div className="bg-slate-900 text-white p-6 rounded-xl text-center shadow-lg relative overflow-hidden">
                                <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-1">Total Bayar</p>
                                <h2 className="text-4xl font-bold">Rp {total.toLocaleString('id-ID')}</h2>

                                {selectedCustomer && (
                                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-xs">
                                        <div className="text-left w-1/2 overflow-hidden text-ellipsis whitespace-nowrap pr-2">
                                            <p className="text-slate-400">Poin {term('customer')}</p>
                                            <p className="font-bold text-amber-400">{selectedCustomer.loyaltyPoints || 0}</p>
                                            {pointsEarned > 0 && <p className="font-bold text-green-400 text-[10px] mt-0.5">+{pointsEarned} Poin Transaksi Ini</p>}
                                        </div>
                                        {(stampUpdates && stampUpdates.length > 0) && (
                                            <div className="text-right w-1/2 border-l border-white/10 pl-2 flex flex-col items-end">
                                                <p className="text-slate-400 mb-0.5">Potensi Stamp</p>
                                                {stampUpdates.map((stamp, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 mt-0.5 max-w-full">
                                                        <span className="text-[10px] text-white overflow-hidden text-ellipsis whitespace-nowrap">+{stamp.completed_count ? 'Selesai!' : '1'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Transaction Date Picker - Admin Only */}
                            {canBackdate && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-amber-600" />
                                            <Label className="text-amber-800 font-medium">Tanggal Transaksi</Label>
                                        </div>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-[180px] justify-start text-left font-normal",
                                                        transactionDate.toDateString() !== new Date().toDateString() && "border-amber-400 bg-amber-100"
                                                    )}
                                                >
                                                    <Calendar className="mr-2 h-4 w-4" />
                                                    {format(transactionDate, "dd MMM yyyy", { locale: id })}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="end">
                                                <CalendarComponent
                                                    mode="single"
                                                    selected={transactionDate}
                                                    onSelect={(date) => {
                                                        if (date) {
                                                            // Preserve current time when selecting new date
                                                            const now = new Date();
                                                            date.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
                                                            setTransactionDate(date);
                                                        }
                                                    }}
                                                    disabled={(date) => date > new Date()}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    {transactionDate.toDateString() !== new Date().toDateString() && (
                                        <p className="text-xs text-amber-700 mt-2">
                                            ⚠️ Transaksi akan dicatat pada tanggal {format(transactionDate, "dd MMMM yyyy", { locale: id })}
                                        </p>
                                    )}
                                </div>
                            )}

                            <Tabs value={paymentMethod} onValueChange={setPaymentMethod} className="w-full">
                                <TabsList className="grid grid-cols-3 w-full h-11">
                                    <TabsTrigger value="cash" className="text-xs sm:text-sm">Tunai</TabsTrigger>
                                    <TabsTrigger value="qris" className="text-xs sm:text-sm">QRIS</TabsTrigger>
                                    <TabsTrigger value="transfer" className="text-xs sm:text-sm">Transfer</TabsTrigger>
                                </TabsList>

                                <div className="mt-4">
                                    <TabsContent value="cash" className="space-y-4 mt-0">
                                        <div className="space-y-2">
                                            <Label>Uang Diterima</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                                                <Input
                                                    ref={cashInputRef}
                                                    type="number"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    className="pl-10 text-lg font-bold h-12"
                                                    placeholder="0"
                                                    value={cashAmount}
                                                    onChange={(e) => setCashAmount(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && isCashSufficient && handleProcess()}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
                                            {suggestions.map((amount) => (
                                                <Button
                                                    key={amount}
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-[10px] sm:text-xs h-9 px-1 truncate"
                                                    onClick={() => setCashAmount(amount.toString())}
                                                >
                                                    {amount.toLocaleString('id-ID')}
                                                </Button>
                                            ))}
                                        </div>

                                        <div className={cn(
                                            "p-4 rounded-lg border flex justify-between items-center transition-colors",
                                            change >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                                        )}>
                                            <span className={cn("font-medium", change >= 0 ? "text-green-700" : "text-red-700")}>
                                                {change >= 0 ? "Kembalian" : "Kurang"}
                                            </span>
                                            <span className={cn("text-xl font-bold", change >= 0 ? "text-green-700" : "text-red-700")}>
                                                Rp {Math.abs(change).toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="qris">
                                        <div className="bg-slate-50 p-8 rounded-lg border border-dashed flex flex-col items-center justify-center text-center">
                                            <QrCode size={48} className="text-slate-400 mb-4" />
                                            <p className="font-medium text-slate-700">Scan QRIS</p>
                                            <p className="text-sm text-muted-foreground mt-1">Pastikan pembayaran berhasil.</p>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="transfer">
                                        <div className="bg-slate-50 p-6 rounded-lg border space-y-4">
                                            <div className="space-y-2">
                                                <Label>Catatan / Ref</Label>
                                                <Input placeholder="Contoh: Transfer BCA a.n Budi" />
                                            </div>
                                        </div>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </div>

                        <DialogFooter className="flex flex-row gap-3 mt-4 pb-2">
                            <Button variant="outline" onClick={() => onClose(false)} disabled={isProcessing} className="flex-1">Batal</Button>
                            <Button
                                onClick={handleProcess}
                                disabled={!isCashSufficient || isProcessing}
                                className="flex-1"
                            >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                {isProcessing ? 'Memproses' : 'Bayar'}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CheckoutDialog;
