import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Search, Download, FileText, Calendar, Wallet, User as UserIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getDateRange } from '../../lib/utils';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { safeSupabaseRpc } from '../../utils/supabaseHelper';
import { Badge } from '../../components/ui/badge';

const DoctorCommissionReport = () => {
    const { currentStore } = useData();
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState([]);
    const [expandedDoctors, setExpandedDoctors] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    
    const [dateRange, setDateRange] = useState(() => {
        const { startDate, endDate } = getDateRange('thisMonth');
        return { from: startDate, to: endDate };
    });

    const fetchReport = useCallback(async () => {
        if (!currentStore?.id || !dateRange.from) return;

        setIsLoading(true);
        try {
            const startDate = dateRange.from;
            const endDate = dateRange.to || dateRange.from;
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);

            const data = await safeSupabaseRpc({
                rpcName: 'get_all_commissions_report',
                params: {
                    p_store_id: currentStore.id,
                    p_start_date: startDate.toISOString(),
                    p_end_date: endDateTime.toISOString()
                }
            });

            setReportData(data || []);
        } catch (error) {
            console.error("Error fetching doctor commission report:", error);
        } finally {
            setIsLoading(false);
        }
    }, [currentStore, dateRange]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return reportData;
        return reportData.filter(d => 
            d.staff_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [reportData, searchTerm]);

    const totalAllCommission = useMemo(() => {
        return reportData.reduce((sum, d) => sum + parseFloat(d.total_commission || 0), 0);
    }, [reportData]);

    const toggleDoctor = (doctorId) => {
        const newExpanded = new Set(expandedDoctors);
        if (newExpanded.has(doctorId)) {
            newExpanded.delete(doctorId);
        } else {
            newExpanded.add(doctorId);
        }
        setExpandedDoctors(newExpanded);
    };

    const handleExportExcel = () => {
        const dataToExport = reportData.flatMap(d => 
            d.item_details.map(item => ({
                "Staff": `${d.staff_name} (${d.staff_role})`,
                "Tanggal": new Date(item.date).toLocaleDateString('id-ID'),
                "Pasien": item.patient_name || '-',
                "Item": item.item_name,
                "Peran Item": item.role_context || '-',
                "Harga": item.price,
                "Qty": item.qty,
                "Komisi": item.commission
            }))
        );

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Komisi Dokter");
        XLSX.writeFile(wb, `Laporan_Komisi_Dokter_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.text("Laporan Komisi Dokter", 14, 15);
        doc.setFontSize(10);
        const dateLabel = `${dateRange.from.toLocaleDateString('id-ID')} - ${dateRange.to?.toLocaleDateString('id-ID') || ''}`;
        doc.text(`Periode: ${dateLabel}`, 14, 22);

        const tableColumn = ["Staff", "Pasien", "Item", "Peran", "Tanggal", "Komisi"];
        const tableRows = reportData.flatMap(d => 
            d.item_details.map(item => [
                `${d.staff_name} (${d.staff_role})`,
                item.patient_name || '-',
                item.item_name,
                item.role_context || '-',
                new Date(item.date).toLocaleDateString('id-ID'),
                `Rp ${item.commission.toLocaleString()}`
            ])
        );

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 25,
        });

        doc.save(`Laporan_Komisi_Dokter_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Laporan Bagi Hasil Klinik</h1>
                    <p className="text-muted-foreground">
                        Rekapitulasi komisi seluruh staf (Dokter, Groomer, Paramedis, Kasir) berdasarkan layanan dan produk.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportExcel}>
                        <FileText className="mr-2 h-4 w-4 text-green-600" />
                        Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF}>
                        <Download className="mr-2 h-4 w-4 text-red-600" />
                        PDF
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-indigo-50 border-indigo-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-600 flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Total Komisi (Periode Ini)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-indigo-900">
                            Rp {totalAllCommission.toLocaleString('id-ID')}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari Dokter..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <SmartDatePicker
                        date={dateRange}
                        onDateChange={setDateRange}
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Nama Staf (Role)</TableHead>
                                <TableHead className="text-right">Jumlah Item</TableHead>
                                <TableHead className="text-right">Total Komisi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        Memuat data...
                                    </TableCell>
                                </TableRow>
                            ) : filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        Belum ada data komisi pada periode ini.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((staffObj) => (
                                    <React.Fragment key={staffObj.staff_id}>
                                        <TableRow 
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => toggleDoctor(staffObj.staff_id)}
                                        >
                                            <TableCell>
                                                {expandedDoctors.has(staffObj.staff_id) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                                                {staffObj.staff_name} <span className="text-xs text-slate-500 font-normal ml-1">({staffObj.staff_role})</span>
                                            </TableCell>
                                            <TableCell className="text-right">{staffObj.total_items}</TableCell>
                                            <TableCell className="text-right font-bold text-indigo-600">
                                                Rp {parseFloat(staffObj.total_commission).toLocaleString('id-ID')}
                                            </TableCell>
                                        </TableRow>
                                        {expandedDoctors.has(staffObj.staff_id) && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="p-0">
                                                    <div className="bg-slate-50 p-4 border-y border-slate-200">
                                                        <Table>
                                                            <TableHeader className="bg-white">
                                                                <TableRow>
                                                                    <TableHead className="text-xs">Tanggal</TableHead>
                                                                    <TableHead className="text-xs">Pasien</TableHead>
                                                                    <TableHead className="text-xs">Item</TableHead>
                                                                    <TableHead className="text-xs">Peran</TableHead>
                                                                    <TableHead className="text-xs text-right">Harga</TableHead>
                                                                    <TableHead className="text-xs text-right">Qty</TableHead>
                                                                    <TableHead className="text-xs text-right">Komisi</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {staffObj.item_details.map((item, idx) => (
                                                                    <TableRow key={idx} className="bg-white">
                                                                        <TableCell className="text-xs">
                                                                            {new Date(item.date).toLocaleDateString('id-ID')}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs">
                                                                            {item.patient_name || '-'}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs font-medium">
                                                                            {item.item_name}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs">
                                                                            <Badge variant="outline" className="text-[10px] font-normal py-0">
                                                                                {item.role_context}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-right">
                                                                            Rp {item.price.toLocaleString('id-ID')}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-right">
                                                                            {item.qty}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs text-right font-semibold text-indigo-600">
                                                                            Rp {item.commission.toLocaleString('id-ID')}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default DoctorCommissionReport;
