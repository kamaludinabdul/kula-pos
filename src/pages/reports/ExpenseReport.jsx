import React, { useState, useEffect } from 'react';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { supabase } from '../../supabase';
import { Calendar, FileText, Download, TrendingDown } from 'lucide-react';
import { exportToCSV } from '../../lib/utils';
import { exportExpenseReportToPDF } from '../../lib/pdfExport';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const ExpenseReport = () => {
    const { currentStore } = useData();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    // Initialize with current month
    const [datePickerDate, setDatePickerDate] = useState({
        from: new Date(new Date().setHours(0, 0, 0, 0)),
        to: new Date()
    });
    const [totalExpense, setTotalExpense] = useState(0);

    const fetchExpenses = React.useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch from Shift Movements (POS Petty Cash)
            let shiftQuery = supabase
                .from('shift_movements')
                .select('*')
                .eq('store_id', currentStore.id)
                .eq('type', 'out');

            // 2. Fetch from Cash Flow (Back Office Expenses)
            let cashFlowQuery = supabase
                .from('cash_flow')
                .select('*')
                .eq('store_id', currentStore.id)
                .eq('type', 'out');

            if (datePickerDate?.from) {
                const startDate = datePickerDate.from;
                const endDate = datePickerDate.to || datePickerDate.from;
                const queryEndDate = new Date(endDate);
                queryEndDate.setHours(23, 59, 59, 999);

                shiftQuery = shiftQuery
                    .gte('date', startDate.toISOString())
                    .lte('date', queryEndDate.toISOString());

                cashFlowQuery = cashFlowQuery
                    .gte('date', startDate.toISOString())
                    .lte('date', queryEndDate.toISOString());
            }

            const [shiftRes, cashFlowRes] = await Promise.all([shiftQuery, cashFlowQuery]);

            if (shiftRes.error) throw shiftRes.error;
            if (cashFlowRes.error) throw cashFlowRes.error;

            // Merge and Format Data
            const shiftExpenses = (shiftRes.data || []).map(item => ({
                id: item.id,
                date: item.date,
                category: item.category || 'Operasional',
                reason: item.reason || 'Kasir (Shift)',
                amount: item.amount,
                source: 'Kasir (POS)',
                cashier: item.cashier
            }));

            const backOfficeExpenses = (cashFlowRes.data || []).map(item => ({
                id: item.id,
                date: item.date, // Note: cash_flow date might be YYYY-MM-DD
                category: item.category || 'Umum',
                reason: item.description || 'Pengeluaran Arus Kas',
                amount: item.amount,
                source: 'Back Office',
                cashier: item.performed_by
            }));

            const mergedData = [...shiftExpenses, ...backOfficeExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

            setExpenses(mergedData);

            // Calculate Total
            const total = mergedData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            setTotalExpense(total);

        } catch (error) {
            console.error("Error fetching expenses:", error);
        } finally {
            setLoading(false);
        }
    }, [datePickerDate, currentStore]);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    const handleExport = () => {
        const dataToExport = expenses.map(exp => ({
            "Tanggal": new Date(exp.date).toLocaleDateString('id-ID'),
            "Waktu": new Date(exp.date).toLocaleTimeString('id-ID'),
            "Kategori": exp.category,
            "Keterangan": exp.reason,
            "Jumlah": exp.amount,
            "Kasir": exp.cashier || '-'
        }));

        exportToCSV(dataToExport, `Laporan_Pengeluaran_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleExportPDF = () => {
        const dateRangeText = `${datePickerDate?.from?.toLocaleDateString('id-ID')} - ${datePickerDate?.to?.toLocaleDateString('id-ID')}`;
        exportExpenseReportToPDF(expenses, currentStore?.name || 'KULA', dateRangeText);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Pengeluaran</h2>
                    <p className="text-muted-foreground">Arus kas keluar dari POS & Back Office</p>
                </div>
                <div className="flex w-full lg:w-auto gap-2">
                    <Button variant="outline" onClick={handleExportPDF} className="flex-1 lg:flex-none">
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                    </Button>
                    <Button variant="outline" onClick={handleExport} className="flex-1 lg:flex-none">
                        <Download className="mr-2 h-4 w-4" />
                        CSV
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <SmartDatePicker
                    date={datePickerDate}
                    onDateChange={setDatePickerDate}
                />
            </div>

            {/* Summary Card */}
            <div className="grid gap-4 md:grid-cols-3">
                <InfoCard
                    title="Total Pengeluaran"
                    value={`Rp ${totalExpense.toLocaleString()}`}
                    icon={TrendingDown}
                    variant="danger"
                    description={
                        datePickerDate?.from ? (
                            `${datePickerDate.from.toLocaleDateString('id-ID')} - ${datePickerDate.to?.toLocaleDateString('id-ID')}`
                        ) : (
                            'Semua Waktu'
                        )
                    }
                />
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block">
                <Card className="rounded-xl overflow-hidden border-none shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-lg">Rincian Pengeluaran</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>Sumber</TableHead>
                                    <TableHead>Kategori</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead>Oleh</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : expenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                            Tidak ada data pengeluaran.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    expenses.map(exp => (
                                        <TableRow key={exp.id}>
                                            <TableCell>
                                                <div className="flex flex-col text-xs">
                                                    <div className="flex items-center gap-1 font-medium">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(exp.date).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-slate-400">
                                                        <FileText className="h-3 w-3" />
                                                        {new Date(exp.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px]">{exp.source}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none text-[10px]">
                                                    {exp.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate">{exp.reason}</TableCell>
                                            <TableCell className="text-slate-600">{exp.cashier || '-'}</TableCell>
                                            <TableCell className="text-right font-bold text-red-600">
                                                Rp {Number(exp.amount).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border">Memuat data...</div>
                ) : expenses.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border">Tidak ada data.</div>
                ) : (
                    expenses.map(exp => (
                        <div key={exp.id} className="bg-white rounded-xl p-4 border-none shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[10px] uppercase tracking-tighter">{exp.source}</Badge>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none text-[10px] uppercase tracking-tighter">
                                            {exp.category}
                                        </Badge>
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-base">Rp {Number(exp.amount).toLocaleString()}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-500">{new Date(exp.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
                                    <p className="text-[10px] text-slate-400">{new Date(exp.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                <p className="text-xs text-slate-600 font-medium leading-relaxed">{exp.reason}</p>
                                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60">
                                    <div className="h-4 w-4 rounded-full bg-slate-200 flex items-center justify-center">
                                        <FileText className="h-2 w-2 text-slate-500" />
                                    </div>
                                    <span className="text-[10px] text-slate-500 italic">Oleh: {exp.cashier || '-'}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ExpenseReport;
