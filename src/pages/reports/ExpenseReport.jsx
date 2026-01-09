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
            let queryBuilder = supabase
                .from('shift_movements')
                .select('*')
                .eq('store_id', currentStore.id)
                .eq('type', 'out')
                .order('date', { ascending: false });

            if (datePickerDate?.from) {
                const startDate = datePickerDate.from;
                const endDate = datePickerDate.to || datePickerDate.from;
                const queryEndDate = new Date(endDate);
                queryEndDate.setHours(23, 59, 59, 999);

                queryBuilder = queryBuilder
                    .gte('date', startDate.toISOString())
                    .lte('date', queryEndDate.toISOString());
            }

            const { data, error } = await queryBuilder;
            if (error) throw error;

            setExpenses(data || []);

            // Calculate Total
            const total = (data || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
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
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Pengeluaran (Expense)</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportPDF}>
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" />
                            CSV
                        </Button>
                    </div>
                </div>

                <div className="flex justify-start">
                    <SmartDatePicker
                        date={datePickerDate}
                        onDateChange={setDatePickerDate}
                    />
                </div>
            </div>

            {/* Summary Card */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">Rp {totalExpense.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            {datePickerDate?.from ? (
                                `${datePickerDate.from.toLocaleDateString('id-ID')} - ${datePickerDate.to?.toLocaleDateString('id-ID')}`
                            ) : (
                                'Semua Waktu'
                            )}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Expense Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Rincian Pengeluaran</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Waktu</TableHead>
                                    <TableHead>Kategori</TableHead>
                                    <TableHead>Keterangan</TableHead>
                                    <TableHead>Kasir</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : expenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            Tidak ada data pengeluaran.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    expenses.map(exp => (
                                        <TableRow key={exp.id}>
                                            <TableCell>
                                                <div className="flex flex-col text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(exp.date).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                        <FileText className="h-3 w-3" />
                                                        {new Date(exp.date).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    {exp.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{exp.reason}</TableCell>
                                            <TableCell>{exp.cashier || '-'}</TableCell>
                                            <TableCell className="text-right font-medium text-red-600">
                                                Rp {Number(exp.amount).toLocaleString()}
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

export default ExpenseReport;
