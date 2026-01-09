import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Search, ArrowUpDown, TrendingUp, Download, FileText, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getDateRange } from '../../lib/utils';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { supabase } from '../../supabase';

const SalesPerformanceReport = () => {
    const { salesTargets, currentStore } = useData(); // Removed transactions
    const [activeTab, setActiveTab] = useState('target');
    const [isLoading, setIsLoading] = useState(false);

    // --- State for Ranking Tab ---
    const [rankingTransactions, setRankingTransactions] = useState([]);
    const [datePickerDate, setDatePickerDate] = useState(() => {
        const { startDate, endDate } = getDateRange('today');
        return { from: startDate, to: endDate };
    });

    useEffect(() => {
        if (!datePickerDate?.from) {
            const { startDate, endDate } = getDateRange('today');
            setDatePickerDate({ from: startDate, to: endDate });
        }
    }, [datePickerDate?.from]);

    // Fetch Ranking Data via RPC
    useEffect(() => {
        const fetchRankingData = async () => {
            if (!currentStore?.id || activeTab !== 'ranking') return;
            if (!datePickerDate?.from) return;

            setIsLoading(true);
            try {
                const startDate = datePickerDate.from;
                const endDate = datePickerDate.to || datePickerDate.from;
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);

                const { data, error } = await supabase.rpc('get_sales_person_ranking', {
                    p_store_id: currentStore.id,
                    p_start_date: startDate.toISOString(),
                    p_end_date: endDateTime.toISOString()
                });

                if (error) throw error;

                const processed = (data || []).map(row => ({
                    id: row.sales_person_id,
                    name: row.sales_person_name,
                    totalSales: parseFloat(row.total_sales),
                    totalDiscount: parseFloat(row.total_discount),
                    transactionCount: parseInt(row.transaction_count)
                }));

                setRankingTransactions(processed);
            } catch (error) {
                console.error("Error fetching ranking RPC:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRankingData();
    }, [currentStore, activeTab, datePickerDate]);


    const [rankingSearchTerm, setRankingSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'totalSales', direction: 'desc' });

    // --- State for Target Tab ---
    const [targetTransactions, setTargetTransactions] = useState([]);
    const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
    const [targetYear, setTargetYear] = useState(new Date().getFullYear());
    const [targetSearchTerm, setTargetSearchTerm] = useState('');

    // Fetch Target Transactions
    useEffect(() => {
        const fetchTargetData = async () => {
            if (!currentStore?.id || activeTab !== 'target') return;

            setIsLoading(true);
            try {
                // Construct start and end of the target month
                const startDate = new Date(targetYear, targetMonth - 1, 1);
                const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999); // last day of month

                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('store_id', currentStore.id)
                    .gte('date', startDate.toISOString())
                    .lte('date', endDate.toISOString());

                if (error) throw error;
                setTargetTransactions(data || []);
            } catch (error) {
                console.error("Error fetching target data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTargetData();
    }, [currentStore, activeTab, targetMonth, targetYear]);


    // --- Helper Functions for Ranking Tab ---
    const salesData = useMemo(() => {
        let result = [...rankingTransactions];

        if (rankingSearchTerm) {
            result = result.filter(item =>
                item.name.toLowerCase().includes(rankingSearchTerm.toLowerCase())
            );
        }

        // Sort handled by RPC, but keeping for local UI sorting if needed
        result.sort((a, b) => {
            if (sortConfig.key === 'totalSales') {
                return sortConfig.direction === 'asc' ? a.totalSales - b.totalSales : b.totalSales - a.totalSales;
            } else if (sortConfig.key === 'transactionCount') {
                return sortConfig.direction === 'asc' ? a.transactionCount - b.transactionCount : b.transactionCount - a.transactionCount;
            }
            return 0;
        });

        return result;
    }, [rankingTransactions, rankingSearchTerm, sortConfig]);

    const [targetSortConfig, setTargetSortConfig] = useState({ key: null, direction: 'asc' });

    // --- Logic for Target Tab ---
    const targetPerformance = useMemo(() => {
        // Filter targets by selected Month and Year
        const filteredTargets = salesTargets.filter(target => {
            return target.month === parseInt(targetMonth) && target.year === parseInt(targetYear);
        });

        let result = filteredTargets.map(target => {
            // Filter transactions for this target's period and user using FETCHED targetTransactions
            // Note: targetTransactions are ALREADY filtered by month/year via query, so just filter by user
            const usersTransactions = targetTransactions.filter(t => (t.sales_person_id === target.userId) || (t.cashier_id === target.userId));

            let currentQty = 0;
            usersTransactions.forEach(t => {
                t.items.forEach(item => {
                    if (target.categoryId === 'all') {
                        currentQty += item.qty;
                    } else {
                        const itemCats = Array.isArray(item.category) ? item.category : [item.category];
                        const itemCatNames = itemCats.map(c => {
                            const name = (typeof c === 'object' && c?.name) ? c.name : c;
                            return String(name || '').toLowerCase().trim();
                        });

                        const rawTargetCatName = (typeof target.categoryName === 'object' && target.categoryName?.name) ? target.categoryName.name : target.categoryName;
                        const targetCatName = String(rawTargetCatName || '').toLowerCase().trim();

                        if (itemCatNames.includes(targetCatName)) {
                            currentQty += item.qty;
                        }
                    }
                });
            });

            return {
                ...target,
                currentQty,
                progress: Math.min(100, (currentQty / target.targetQty) * 100),
                categoryDisplayName: typeof target.categoryName === 'object' && target.categoryName?.name ? target.categoryName.name : target.categoryName
            };
        });

        if (targetSearchTerm) {
            result = result.filter(item =>
                item.userName.toLowerCase().includes(targetSearchTerm.toLowerCase())
            );
        }

        // Sorting Logic
        if (targetSortConfig.key) {
            result.sort((a, b) => {
                let aValue, bValue;
                if (targetSortConfig.key === 'userName') {
                    aValue = (a.userName || '').toLowerCase();
                    bValue = (b.userName || '').toLowerCase();
                } else if (targetSortConfig.key === 'category') {
                    aValue = (a.categoryDisplayName || '').toLowerCase();
                    bValue = (b.categoryDisplayName || '').toLowerCase();
                } else if (targetSortConfig.key === 'targetQty') {
                    aValue = a.targetQty || 0;
                    bValue = b.targetQty || 0;
                } else if (targetSortConfig.key === 'currentQty') {
                    aValue = a.currentQty || 0;
                    bValue = b.currentQty || 0;
                } else if (targetSortConfig.key === 'progress') {
                    aValue = a.progress || 0;
                    bValue = b.progress || 0;
                }

                if (aValue < bValue) return targetSortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return targetSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [salesTargets, targetTransactions, targetMonth, targetYear, targetSearchTerm, targetSortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleTargetSort = (key) => {
        setTargetSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Generate Year Options (e.g., current year - 2 to current year + 2)
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    const handleExportExcel = () => {
        let dataToExport = [];
        let fileName = '';

        if (activeTab === 'ranking') {
            fileName = `Sales_Ranking_${new Date().toISOString().split('T')[0]}.xlsx`;
            dataToExport = salesData.map((item, index) => ({
                "No": index + 1,
                "Nama Sales": item.name,
                "Jumlah Transaksi": item.transactionCount,
                "Total Diskon": item.totalDiscount,
                "Total Penjualan": item.totalSales
            }));
        } else {
            fileName = `Sales_Target_${targetMonth}-${targetYear}.xlsx`;
            dataToExport = targetPerformance.map(item => ({
                "Nama Staff": item.userName,
                "Periode": `${item.month}/${item.year}`,
                "Kategori": typeof item.categoryName === 'object' && item.categoryName?.name ? item.categoryName.name : item.categoryName,
                "Target": item.targetQty,
                "Tercapai": item.currentQty,
                "Progress (%)": `${item.progress.toFixed(1)}%`
            }));
        }

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, fileName);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        if (activeTab === 'ranking') {
            doc.text("Laporan Peringkat Sales", 14, 15);
            doc.setFontSize(10);
            const { from, to } = datePickerDate;
            const dateLabel = from ? `${from.toLocaleDateString('id-ID')} - ${to ? to.toLocaleDateString('id-ID') : from.toLocaleDateString('id-ID')}` : 'Semua';
            doc.text(`Periode: ${dateLabel}`, 14, 22);

            const tableColumn = ["No", "Nama Sales", "Jml Transaksi", "Total Diskon", "Total Penjualan"];
            const tableRows = salesData.map((item, index) => [
                index + 1,
                item.name,
                item.transactionCount,
                `Rp ${item.totalDiscount.toLocaleString()}`,
                `Rp ${item.totalSales.toLocaleString()}`
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 25,
            });

            doc.save(`Sales_Ranking_${new Date().toISOString().split('T')[0]}.pdf`);
        } else {
            doc.text("Laporan Pencapaian Target Sales", 14, 15);
            doc.setFontSize(10);
            doc.text(`Periode: ${targetMonth}/${targetYear}`, 14, 22);

            const tableColumn = ["Nama Staff", "Periode", "Kategori", "Target", "Tercapai", "Progress"];
            const tableRows = targetPerformance.map(item => [
                item.userName,
                `${item.month}/${item.year}`,
                typeof item.categoryName === 'object' && item.categoryName?.name ? item.categoryName.name : item.categoryName,
                item.targetQty,
                item.currentQty,
                `${item.progress.toFixed(1)}%`
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 25,
            });

            doc.save(`Sales_Target_${targetMonth}-${targetYear}.pdf`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Performa Sales</h2>
                    <p className="text-muted-foreground">
                        Pantau kinerja penjualan tim sales Anda.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportExcel}>
                        <FileText className="mr-2 h-4 w-4 text-green-600" />
                        Export Excel
                    </Button>
                    <Button variant="outline" onClick={handleExportPDF}>
                        <Download className="mr-2 h-4 w-4 text-red-600" />
                        Export PDF
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="ranking">Peringkat Sales</TabsTrigger>
                    <TabsTrigger value="target">Pencapaian Target</TabsTrigger>
                </TabsList>

                <TabsContent value="ranking" className="mt-4 space-y-4">
                    {/* Filters for Ranking */}
                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-card p-4 rounded-lg border shadow-sm">
                        <div className="w-full md:w-64">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari Sales..."
                                    value={rankingSearchTerm}
                                    onChange={(e) => setRankingSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <SmartDatePicker
                                date={datePickerDate}
                                onDateChange={setDatePickerDate}
                            />
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-blue-500" />
                                Peringkat Sales
                                {isLoading && <span className="text-xs text-muted-foreground font-normal ml-2">(Memuat data...)</span>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead>Nama Sales</TableHead>
                                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('transactionCount')}>
                                            <div className="flex items-center justify-end gap-1">
                                                Jumlah Transaksi
                                                <ArrowUpDown className="h-4 w-4" />
                                            </div>
                                        </TableHead>
                                        <TableHead className="text-right">Total Diskon</TableHead>
                                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('totalSales')}>
                                            <div className="flex items-center justify-end gap-1">
                                                Total Penjualan
                                                <ArrowUpDown className="h-4 w-4" />
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Memuat data...
                                            </TableCell>
                                        </TableRow>
                                    ) : salesData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Belum ada data penjualan sales pada periode ini.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        salesData.map((item, index) => (
                                            <TableRow key={item.id}>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                <TableCell className="text-right">{item.transactionCount}</TableCell>
                                                <TableCell className="text-right text-red-500">
                                                    {item.totalDiscount > 0 ? `Rp ${item.totalDiscount.toLocaleString()}` : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-blue-600">
                                                    Rp {item.totalSales.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="target" className="mt-4 space-y-4">
                    {/* Filters for Target */}
                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-card p-4 rounded-lg border shadow-sm">
                        <div className="w-full md:w-64">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cari Staff..."
                                    value={targetSearchTerm}
                                    onChange={(e) => setTargetSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <Select value={String(targetMonth)} onValueChange={(v) => setTargetMonth(parseInt(v))}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Pilih Bulan" />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                    <SelectItem key={month} value={String(month)}>
                                        {new Date(0, month - 1).toLocaleString('id-ID', { month: 'long' })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={String(targetYear)} onValueChange={(v) => setTargetYear(parseInt(v))}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Pilih Tahun" />
                            </SelectTrigger>
                            <SelectContent>
                                {yearOptions.map((year) => (
                                    <SelectItem key={year} value={String(year)}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-green-500" />
                                Pencapaian Target
                                {isLoading && <span className="text-xs text-muted-foreground font-normal ml-2">(Memuat data...)</span>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleTargetSort('userName')}>
                                            <div className="flex items-center gap-1">
                                                Nama Staff
                                                <ArrowUpDown className="h-4 w-4" />
                                            </div>
                                        </TableHead>
                                        <TableHead>Periode</TableHead>
                                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleTargetSort('category')}>
                                            <div className="flex items-center gap-1">
                                                Kategori
                                                <ArrowUpDown className="h-4 w-4" />
                                            </div>
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleTargetSort('targetQty')}>
                                            <div className="flex items-center gap-1">
                                                Target
                                                <ArrowUpDown className="h-4 w-4" />
                                            </div>
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleTargetSort('currentQty')}>
                                            <div className="flex items-center gap-1">
                                                Tercapai
                                                <ArrowUpDown className="h-4 w-4" />
                                            </div>
                                        </TableHead>
                                        <TableHead className="w-[200px] cursor-pointer hover:bg-muted/50" onClick={() => handleTargetSort('progress')}>
                                            <div className="flex items-center gap-1">
                                                Progress
                                                <ArrowUpDown className="h-4 w-4" />
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Memuat data...
                                            </TableCell>
                                        </TableRow>
                                    ) : targetPerformance.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                Belum ada target yang diset untuk periode ini.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        targetPerformance.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.userName}</TableCell>
                                                <TableCell>{item.month}/{item.year}</TableCell>
                                                <TableCell>{typeof item.categoryName === 'object' && item.categoryName?.name ? item.categoryName.name : item.categoryName}</TableCell>
                                                <TableCell>{item.targetQty}</TableCell>
                                                <TableCell className={item.currentQty >= item.targetQty ? "text-green-600 font-bold" : ""}>
                                                    {item.currentQty}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="w-full bg-secondary rounded-full h-2.5">
                                                            <div
                                                                className={`h-2.5 rounded-full ${item.progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${item.progress}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="text-xs text-right text-muted-foreground">
                                                            {item.progress.toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default SalesPerformanceReport;
