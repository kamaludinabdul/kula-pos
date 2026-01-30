import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Separator } from '../../../components/ui/separator';
import { Badge } from '../../../components/ui/badge';
import { Printer, Download, CheckCircle2, CloudDownload, Calendar, CreditCard, Building } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useData } from '../../../context/DataContext';

dayjs.locale('id');

const InvoiceDialog = ({ isOpen, onClose, invoice }) => {
    const { currentStore } = useData();
    const invoiceRef = useRef(null);

    if (!invoice) return null;



    const handleDownload = async () => {
        if (!invoiceRef.current) return;

        try {
            const canvas = await html2canvas(invoiceRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Invoice-${invoice.id.slice(0, 8)}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        }
    };

    const statusColors = {
        pending: "warning",
        approved: "success",
        paid: "success",
        failed: "destructive",
        expired: "secondary"
    };

    const statusLabels = {
        pending: "Menunggu Konfirmasi",
        approved: "Lunas / Aktif",
        paid: "Lunas",
        failed: "Gagal",
        expired: "Kadaluarsa"
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <div ref={invoiceRef} className="p-6 bg-white rounded-lg">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                            {/* Use Kula Logo */}
                            <div className="flex items-center gap-2">
                                <img
                                    src="/logo.png"
                                    alt="Kula POS"
                                    className="h-12 w-auto object-contain"
                                    onError={(e) => {
                                        e.target.style.display = 'none'; // Hide if fails
                                        // Maybe show text fallback?
                                    }}
                                />
                                <div className="flex flex-col">
                                    <span className="font-bold text-xl text-indigo-600">Kula POS</span>
                                    <span className="text-xs text-muted-foreground">PT. Kula Indonesia</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-bold text-slate-900 mb-1">INVOICE</h2>
                            <p className="text-sm text-muted-foreground font-mono">#{invoice.unique_code ? `INV-${dayjs(invoice.created_at).format('YYYYMM')}-${invoice.unique_code}` : invoice.id.slice(0, 8).toUpperCase()}</p>
                            <Badge variant={statusColors[invoice.status] || "outline"} className="mt-2">
                                {statusLabels[invoice.status] || invoice.status}
                            </Badge>
                        </div>
                    </div>

                    <Separator className="my-6" />

                    {/* Bill To & Details */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Ditagihkan Kepada</h3>
                            <p className="font-semibold text-slate-900">{currentStore?.name}</p>
                            <p className="text-sm text-slate-600">{currentStore?.address || "Alamat tidak tersedia"}</p>
                            <p className="text-sm text-slate-600 mt-1">{currentStore?.phone}</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Tanggal Inv</span>
                                <span className="font-medium">{dayjs(invoice.created_at).format('DD MMMM YYYY, HH:mm')}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Metode Bayar</span>
                                <span className="font-medium capitalize">{invoice.payment_method || 'Transfer'}</span>
                            </div>
                            {invoice.approved_at && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Dikonfirmasi</span>
                                    <span className="font-medium text-green-600">{dayjs(invoice.approved_at).format('DD MMM YYYY')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="border rounded-lg overflow-hidden mb-8">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="py-3 px-4 text-left font-medium text-slate-500">Deskripsi</th>
                                    <th className="py-3 px-4 text-center font-medium text-slate-500">Durasi</th>
                                    <th className="py-3 px-4 text-right font-medium text-slate-500">Jumlah</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                <tr>
                                    <td className="py-4 px-4">
                                        <p className="font-semibold text-slate-900">
                                            Paket Langganan {invoice.plan_id === 'pro' ? 'PRO' : invoice.plan_id === 'enterprise' ? 'Enterprise' : 'Basic'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Akses fitur premium untuk {invoice.duration_months} bulan.
                                        </p>
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        {invoice.duration_months} Bulan
                                    </td>
                                    <td className="py-4 px-4 text-right font-medium">
                                        Rp {(invoice.amount - (invoice.unique_code || 0)).toLocaleString('id-ID')}
                                    </td>
                                </tr>
                                {invoice.unique_code > 0 && (
                                    <tr>
                                        <td className="py-3 px-4 text-slate-600">Kode Unik (Verifikasi)</td>
                                        <td className="py-3 px-4 text-center text-slate-400">-</td>
                                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                                            Rp {invoice.unique_code}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold border-t">
                                <tr>
                                    <td colSpan={2} className="py-4 px-4 text-right">Total Bayar</td>
                                    <td className="py-4 px-4 text-right text-indigo-700 text-lg">
                                        Rp {invoice.amount?.toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Footer Warning/Note */}
                    <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-500">
                        <p className="font-semibold mb-1">Catatan:</p>
                        <p>Invoice ini adalah bukti pembayaran yang sah yang diterbitkan oleh sistem komputer dan tidak memerlukan tanda tangan basah.</p>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:justify-between sm:items-center w-full mt-4">
                    <p className="text-xs text-muted-foreground hidden sm:block">
                        ID: {invoice.id}
                    </p>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" className="flex-1 sm:flex-none" onClick={handleDownload}>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </Button>
                        <Button onClick={onClose} className="flex-1 sm:flex-none">
                            Tutup
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default InvoiceDialog;
