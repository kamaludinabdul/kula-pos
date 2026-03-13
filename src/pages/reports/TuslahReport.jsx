import React, { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Printer, Calendar as CalendarIcon, FileSpreadsheet, Activity } from 'lucide-react';
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Calendar } from "../../components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
import * as XLSX from 'xlsx';
import { useBusinessType } from '../../hooks/useBusinessType';

const TuslahReport = () => {
    const { transactions } = useData();
    const { isPharmacy } = useBusinessType();

    // Default to last 30 days
    const [dateRange, setDateRange] = useState({
        from: subDays(new Date(), 30),
        to: new Date()
    });
    const [quickFilter, setQuickFilter] = useState('30days');

    const handleQuickFilter = (value) => {
        setQuickFilter(value);
        const today = new Date();
        switch (value) {
            case 'today':
                setDateRange({ from: today, to: today });
                break;
            case '7days':
                setDateRange({ from: subDays(today, 7), to: today });
                break;
            case '30days':
                setDateRange({ from: subDays(today, 30), to: today });
                break;
            case 'thisMonth':
                setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
                break;
            default:
                break;
        }
    };

    const tuslahTransactions = useMemo(() => {
        if (!transactions) return [];

        let filtered = transactions.filter(t => t.status === 'completed' && parseFloat(t.tuslah_fee || 0) > 0);

        // Filter by date range
        if (dateRange.from && dateRange.to) {
            const startStr = format(dateRange.from, 'yyyy-MM-dd');
            const endStr = format(dateRange.to, 'yyyy-MM-dd');
            filtered = filtered.filter(t => {
                const txDate = format(new Date(t.date), 'yyyy-MM-dd');
                return txDate >= startStr && txDate <= endStr;
            });
        }

        // Sort latest first
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, dateRange]);

    const totalTuslah = useMemo(() => {
        return tuslahTransactions.reduce((sum, t) => sum + parseFloat(t.tuslah_fee || 0), 0);
    }, [tuslahTransactions]);

    const formatRupiah = (number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
    };

    const handleExportExcel = () => {
        const exportData = tuslahTransactions.map(t => ({
            'Tanggal': format(new Date(t.date), 'dd MMM yyyy HH:mm', { locale: id }),
            'No. Struk': t.receipt_number || t.id.substring(0, 8),
            'Kasir': t.cashier_name || 'System',
            'Pasien': t.patient_name || '-',
            'Dokter': t.doctor_name || '-',
            'No. Resep': t.prescription_number || '-',
            'Total Tagihan': parseFloat(t.total) || 0,
            'Biaya Tuslah/Embalase': parseFloat(t.tuslah_fee) || 0
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan_Tuslah");
        XLSX.writeFile(wb, `Laporan_Tuslah_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const html = `
            <html>
                <head>
                    <title>Laporan Tuslah / Embalase - Kula POS</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 20px; color: #333; }
                        h1 { font-size: 20px; margin-bottom: 5px; }
                        p { color: #666; font-size: 14px; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                        th { background-color: #f8f9fa; font-weight: 600; }
                        .text-right { text-align: right; }
                        .summary-box { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; width: fit-content; margin-bottom: 20px; background-color: #f8fafc; }
                        .summary-value { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 5px;}
                    </style>
                </head>
                <body>
                    <h1>Laporan Tuslah / Embalase</h1>
                    <p>Periode: ${format(dateRange.from, 'dd MMM yyyy', { locale: id })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: id })}</p>
                    
                    <div class="summary-box">
                        <div>Total Pendapatan Tuslah</div>
                        <div class="summary-value">${formatRupiah(totalTuslah)}</div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>No. Struk</th>
                                <th>Pasien</th>
                                <th>Dokter / No. Resep</th>
                                <th class="text-right">Biaya Tuslah</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tuslahTransactions.map(t => `
                                <tr>
                                    <td>${format(new Date(t.date), 'dd MMM yyyy HH:mm', { locale: id })}</td>
                                    <td>${t.receipt_number || t.id.substring(0, 8)}</td>
                                    <td>${t.patient_name || '-'}</td>
                                    <td>${t.doctor_name ? `${t.doctor_name} ${t.prescription_number ? `(${t.prescription_number})` : ''}` : '-'}</td>
                                    <td class="text-right">${formatRupiah(parseFloat(t.tuslah_fee) || 0)}</td>
                                </tr>
                            `).join('')}
                            ${tuslahTransactions.length === 0 ? '<tr><td colspan="5" style="text-align: center;">Tidak ada data tuslah</td></tr>' : ''}
                        </tbody>
                    </table>
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };


    if (!isPharmacy) {
        return (
            <div className="flex h-[80vh] items-center justify-center p-4">
                <Card className="max-w-md w-full text-center p-8 bg-slate-50 border-dashed border-2">
                    <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Modul Apotek Tidak Aktif</h2>
                    <p className="text-slate-500 mb-4 text-sm">
                        Laporan Tuslah & Embalase khusus hanya untuk profil bisnis Apotek (Pharmacy).
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 max-w-7xl animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="h-6 w-6 text-teal-600" />
                        Laporan Tuslah & Embalase
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Lacak penerimaan biaya jasa resep per transaksi</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={handlePrint} variant="outline" className="bg-white">
                        <Printer className="w-4 h-4 mr-2" />
                        Cetak PDF
                    </Button>
                    <Button onClick={handleExportExcel} className="bg-emerald-600 hover:bg-emerald-700">
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* Filter Section */}
            <Card className="mb-6 shadow-sm border-slate-200">
                <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium text-slate-700">Rentang Waktu</label>
                            <div className="flex gap-2 relative z-10">
                                <Select value={quickFilter} onValueChange={handleQuickFilter}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Pilih Waktu" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">Hari Ini</SelectItem>
                                        <SelectItem value="7days">7 Hari Terakhir</SelectItem>
                                        <SelectItem value="30days">30 Hari Terakhir</SelectItem>
                                        <SelectItem value="thisMonth">Bulan Ini</SelectItem>
                                        <SelectItem value="custom">Kustom</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-[280px] justify-start text-left font-normal bg-white"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                                            {dateRange.from ? (
                                                dateRange.to ? (
                                                    <>
                                                        {format(dateRange.from, "dd MMM yyyy", { locale: id })} -{" "}
                                                        {format(dateRange.to, "dd MMM yyyy", { locale: id })}
                                                    </>
                                                ) : (
                                                    format(dateRange.from, "dd MMM yyyy", { locale: id })
                                                )
                                            ) : (
                                                <span>Pilih tanggal</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange.from}
                                            selected={dateRange}
                                            onSelect={(range) => {
                                                setDateRange(range || { from: new Date(), to: new Date() });
                                                setQuickFilter('custom');
                                            }}
                                            numberOfMonths={2}
                                            locale={id}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="shadow-sm border-slate-200 col-span-1 border-l-4 border-l-teal-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Tuslah/Embalase</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-800">{formatRupiah(totalTuslah)}</div>
                        <p className="text-xs text-slate-500 mt-1">Dari {tuslahTransactions.length} transaksi</p>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions List */}
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <CardTitle className="text-lg">Daftar Transaksi Tuslah</CardTitle>
                    <CardDescription>
                        Menampilkan transaksi resep yang mengandung biaya tuslah/embalase
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>No. Struk</TableHead>
                                    <TableHead>Pasien</TableHead>
                                    <TableHead>Dokter / No. Resep</TableHead>
                                    <TableHead className="text-right">Biaya Tuslah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tuslahTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                                            Tidak ada transaksi tuslah pada periode ini.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tuslahTransactions.map((tx) => (
                                        <TableRow key={tx.id} className="hover:bg-slate-50">
                                            <TableCell className="font-medium whitespace-nowrap text-xs sm:text-sm">
                                                {format(new Date(tx.date), 'dd MMM yyyy, HH:mm')}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono bg-slate-50/50">
                                                    {tx.receipt_number || tx.id.substring(0, 8)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {tx.patient_name || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{tx.doctor_name || '-'}</span>
                                                    {tx.prescription_number && (
                                                        <span className="text-xs text-slate-500">Resep: {tx.prescription_number}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-teal-600">
                                                +{formatRupiah(tx.tuslah_fee)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
};

export default TuslahReport; 
