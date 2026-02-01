import React, { useRef, useState } from 'react';
import { X, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
const APP_VERSION = "0.13.2";
import { printerService } from '../services/printer';
import { formatDate } from '../lib/utils';
import { getOptimizedImage } from '../utils/supabaseImage';

import { useAuth } from '../context/AuthContext';
import { printReceiptBrowser } from '../lib/receiptHelper';

const ReceiptModal = ({ isOpen, onClose, transaction, store }) => {
    const { checkPermission } = useAuth();
    const receiptRef = useRef(null);
    const [isPrinting, setIsPrinting] = useState(false);

    if (!isOpen || !transaction) return null;

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            // 1. Check connection, attempt to connect if needed
            let isConnected = printerService.isConnected();
            if (!isConnected) {
                try {
                    const connectResult = await printerService.connect();
                    if (connectResult.success) {
                        isConnected = true;
                    } else {
                        // User cancelled or connection failed
                        console.log("Connection failed or cancelled:", connectResult.error);
                    }
                } catch (err) {
                    console.error("Auto-connect error:", err);
                }
            }

            // 2. Print if connected
            if (isConnected) {
                const result = await printerService.printReceipt(transaction, store);
                if (result.success) {
                    // Success
                } else {
                    alert('Gagal mencetak ke printer thermal: ' + result.error + '\nBeralih ke tampilan browser...');
                    handleBrowserPrint();
                }
            } else {
                // Not connected and failed to connect -> Browser Print
                handleBrowserPrint();
            }
        } catch (error) {
            console.error("Print error:", error);
            alert("Terjadi kesalahan saat mencetak.");
        } finally {
            setIsPrinting(false);
        }
    };

    const handleBrowserPrint = () => {
        printReceiptBrowser(transaction, store);
    };

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
                link.download = `receipt-${transaction.id}.png`;
                link.click();
            } catch (error) {
                console.error('Error generating receipt image:', error);
                alert('Gagal mengunduh gambar struk.');
            }
        }
    };

    // Calculate totals for display
    const subtotal = transaction.subtotal || transaction.total;
    const tax = transaction.tax || 0;
    const serviceCharge = transaction.serviceCharge || 0;
    const finalTotal = transaction.total;



    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Detail Struk</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="w-full bg-slate-50 flex justify-center items-start py-4 border rounded-lg shadow-inner max-h-[70vh] overflow-y-auto">
                    {/* Receipt Preview Area - Visual Matching POS */}
                    <div
                        id="receipt-preview"
                        ref={receiptRef}
                        className="bg-white p-4 shadow-sm w-[58mm] h-fit text-sm font-mono relative"
                        style={{ color: '#000' }}
                    >
                        {(transaction.status === 'cancelled' || transaction.status === 'void') && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 z-10 flex flex-col items-center justify-center pointer-events-none">
                                <div className="border-[6px] border-red-500/30 text-red-500/30 text-5xl font-bold px-4 py-2 uppercase tracking-widest">
                                    VOID
                                </div>
                            </div>
                        )}
                        <div className="text-center mb-4">
                            {store?.logo && (
                                <div className="flex justify-center mb-2">
                                    <img src={getOptimizedImage(store.logo, { width: 100, quality: 70 })} alt="Store Logo" className="h-12 object-contain filter grayscale" />
                                </div>
                            )}
                            <div className="font-bold text-lg uppercase">{store?.name || 'Store Name'}</div>
                            <div className="text-xs text-gray-500">{store?.address}</div>
                            <div className="text-xs text-gray-500">{store?.phone}</div>
                            <div className="border-b border-dashed border-gray-300 my-2"></div>
                            <div className="text-xs">{store?.receiptHeader}</div>
                        </div>

                        <div className="text-xs text-gray-500 mb-2">
                            <div className="flex justify-between">
                                <div className="flex justify-between">
                                    <span>{formatDate(transaction.date)}</span>
                                    <span>{transaction.cashier || 'Staff'}</span>
                                </div>
                                <span>{transaction.cashier || 'Staff'}</span>
                            </div>
                            <div>No: #${transaction.id}</div>
                            {transaction.customerName && (
                                <div className="mt-1">
                                    <span className="font-bold text-gray-700">Pelanggan: {transaction.customerName}</span>
                                    {transaction.customerPhone && <div className="text-[10px]">HP: {transaction.customerPhone}</div>}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1 mb-4 border-t border-dashed border-gray-300 py-2">
                            {transaction.items && transaction.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="flex-1 text-left">{item.name} x{item.qty}{item.unit ? ` ${item.unit}` : ''}</span>
                                    <span className="text-right">Rp {((item.price - (item.discount || 0)) * item.qty).toLocaleString('id-ID')}</span>
                                </div>
                            ))}
                        </div>

                        <div className="text-right text-xs mb-2 border-b border-dashed border-gray-300 pb-2">
                            Total Qty: {transaction.items ? transaction.items.reduce((acc, item) => acc + Number(item.qty), 0) : 0}
                        </div>

                        <div className="border-t border-dashed border-gray-300 pt-2 space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                            </div>
                            {transaction.discount > 0 && (
                                <div className="flex justify-between text-red-500">
                                    <span>Diskon</span>
                                    <span>- Rp {transaction.discount.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                            {tax > 0 && (
                                <div className="flex justify-between text-gray-500">
                                    <span>Tax ({store?.taxRate || 0}%)</span>
                                    <span>Rp {tax.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                            {serviceCharge > 0 && (
                                <div className="flex justify-between text-gray-500">
                                    <span>Service</span>
                                    <span>Rp {serviceCharge.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-1 mt-1">
                                <span>Total</span>
                                <span>Rp {finalTotal.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>{(transaction.paymentMethod || 'cash').toUpperCase()}</span>
                                <span>Rp {transaction.amountPaid ? Number(transaction.amountPaid).toLocaleString('id-ID') : finalTotal.toLocaleString('id-ID')}</span>
                            </div>
                            {transaction.change > 0 && (
                                <div className="flex justify-between font-medium">
                                    <span>Kembalian</span>
                                    <span>Rp {Number(transaction.change).toLocaleString('id-ID')}</span>
                                </div>
                            )}
                        </div>

                        {(transaction.pointsEarned > 0 || transaction.customerTotalPoints > 0) && (
                            <div className="border-t border-dashed border-gray-300 mt-3 pt-3 space-y-1 text-xs text-center">
                                <div className="font-bold text-gray-700 mb-1">POIN LOYALITAS</div>
                                {transaction.pointsEarned > 0 && (
                                    <div className="flex justify-between">
                                        <span>Poin Transaksi:</span>
                                        <span className="font-bold text-green-600">+{transaction.pointsEarned}</span>
                                    </div>
                                )}
                                {transaction.customerTotalPoints && (
                                    <div className="flex justify-between font-bold border-t border-gray-100 pt-1">
                                        <span>Total Poin:</span>
                                        <span className="text-blue-600">{transaction.customerTotalPoints}</span>
                                    </div>
                                )}
                            </div>
                        )}



                        <div className="border-t border-dashed border-gray-300 mt-4 pt-3 text-center text-[10px] text-slate-400">
                            <p>{store?.receiptFooter || "Terima Kasih"}</p>
                            <p className="mt-2 text-[8px] text-slate-300">KULA v{APP_VERSION}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t flex gap-3 justify-end bg-white">
                    {checkPermission('transactions.print') && (
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Printer size={16} />
                            {isPrinting ? 'Mencetak...' : 'Cetak'}
                        </button>
                    )}
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        <Download size={16} />
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReceiptModal;
