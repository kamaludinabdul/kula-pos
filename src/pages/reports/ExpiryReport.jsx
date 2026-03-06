import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { CalendarIcon, Download, AlertTriangle, AlertCircle, RefreshCw, Clock, ChevronLeft, ChevronRight, Trash2, History } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, differenceInDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

const ITEMS_PER_PAGE = 10;

const ExpiryReport = () => {
    const { activeStoreId, products, fetchAllProducts, adjustStock } = useData();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [expiredData, setExpiredData] = useState([]);
    const [nearlyExpiredData, setNearlyExpiredData] = useState([]);
    const [historyData, setHistoryData] = useState([]);

    const [expiredPage, setExpiredPage] = useState(1);
    const [nearlyPage, setNearlyPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [isWritingOff, setIsWritingOff] = useState(false);
    const [activeTab, setActiveTab] = useState("active");

    // Config: 30 days is our "nearly expired" threshold
    const NEARLY_EXPIRED_THRESHOLD = 30;

    const loadHistory = useCallback(async () => {
        if (!activeStoreId) return;
        try {
            const { data, error } = await supabase
                .from('cash_flow')
                .select('*')
                .eq('store_id', activeStoreId)
                .eq('expense_group', 'write_off')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setHistoryData(data || []);
        } catch (error) {
            console.error("Gagal memuat riwayat pemusnahan:", error);
        }
    }, [activeStoreId]);

    const loadData = useCallback(async () => {
        if (!activeStoreId) return;
        setLoading(true);
        try {
            // Make sure products match store
            if (products.length === 0) {
                await fetchAllProducts(activeStoreId);
            }

            // Fetch active batches that actually have an expired_date
            const { data: batches, error } = await supabase
                .from('batches')
                .select('*')
                .eq('store_id', activeStoreId)
                .gt('current_qty', 0)
                .not('expired_date', 'is', null)
                .order('expired_date', { ascending: true });

            if (error) throw error;

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const expired = [];
            const nearlyExpired = [];

            batches.forEach(batch => {
                const expiry = new Date(batch.expired_date);
                const diffDays = differenceInDays(expiry, now);

                // Find product to append name/barcode info
                const product = products.find(p => p.id === batch.product_id) || { name: 'Produk Dihapus', code: '-' };

                const reportItem = {
                    ...batch,
                    productName: product.name,
                    productCode: product.code || product.barcode || '-',
                    daysUntilExpiry: diffDays
                };

                if (diffDays < 0) {
                    expired.push(reportItem);
                } else if (diffDays <= NEARLY_EXPIRED_THRESHOLD) {
                    nearlyExpired.push(reportItem);
                }
            });

            setExpiredData(expired);
            setNearlyExpiredData(nearlyExpired);
            setExpiredPage(1);
            setNearlyPage(1);
            loadHistory();
        } catch (error) {
            console.error("Gagal memuat laporan kedaluwarsa:", error);
        } finally {
            setLoading(false);
        }
    }, [activeStoreId, products, fetchAllProducts, loadHistory]);

    const handleWriteOff = async () => {
        if (!selectedBatch || !activeStoreId) return;

        setIsWritingOff(true);
        try {
            const lossValue = selectedBatch.current_qty * (selectedBatch.buy_price || 0);

            // 1. Set batch qty to 0 First
            const { error: batchError } = await supabase
                .from('batches')
                .update({
                    current_qty: 0,
                    note: (selectedBatch.note || '') + ` [Pemusnahan: ${format(new Date(), 'dd/MM/yy')}]`
                })
                .eq('id', selectedBatch.id);

            if (batchError) throw batchError;

            // 2. Reduce System Stock and record movement using adjustStock
            // Use negative quantity for reduction
            const adjustResult = await adjustStock(
                selectedBatch.product_id,
                -selectedBatch.current_qty,
                'out',
                `Pemusnahan stok kedaluwarsa/rusak (Batch: ${selectedBatch.id.slice(0, 8)})`
            );

            if (!adjustResult.success) {
                console.error("Gagal mengurangi stok sistem:", adjustResult.error);
                // We don't throw here to ensure cash flow is still recorded even if movement fails,
                // but ideally it should all succeed.
            }

            // 3. Insert into cash_flow as non-cash expense
            const { error: cashError } = await supabase
                .from('cash_flow')
                .insert({
                    store_id: activeStoreId,
                    type: 'out',
                    category: 'Pemusnahan Stok',
                    expense_group: 'write_off',
                    amount: lossValue,
                    description: `Pemusnahan: ${selectedBatch.productName} (${selectedBatch.productCode}) - ${selectedBatch.current_qty} pcs`,
                    date: format(new Date(), 'yyyy-MM-dd'),
                    performed_by: user?.name || 'Staff'
                });

            if (cashError) throw cashError;

            setIsConfirmOpen(false);
            setSelectedBatch(null);
            loadData();
        } catch (error) {
            console.error("Gagal memproses pemusnahan:", error);
            alert("Terjadi kesalahan saat memproses pemusnahan: " + (error.message || "Unknown error"));
        } finally {
            setIsWritingOff(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        const formatData = (data, status) => data.map(item => ({
            'Nama Produk': item.productName,
            'Kode/Barcode': item.productCode,
            'Status': status,
            'Tanggal Kedaluwarsa': format(new Date(item.expired_date), 'dd MMM yyyy', { locale: id }),
            'Sisa Hari': item.daysUntilExpiry < 0 ? `Lewat ${Math.abs(item.daysUntilExpiry)} hari` : `${item.daysUntilExpiry} hari`,
            'Sisa Stok': item.current_qty,
            'Harga Beli/Pcs': item.buy_price,
            'Nilai Kerugian': item.current_qty * (item.buy_price || 0)
        }));

        const combinedData = [
            ...formatData(expiredData, 'Kedaluwarsa'),
            ...formatData(nearlyExpiredData, 'Hampir Kedaluwarsa')
        ];

        if (combinedData.length === 0) {
            alert('Tidak ada data untuk diekspor');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(combinedData);

        // Auto-fix column widths
        const colWidths = [
            { wch: 25 }, { wch: 15 }, { wch: 18 },
            { wch: 20 }, { wch: 15 }, { wch: 10 },
            { wch: 15 }, { wch: 15 }
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Expiry Report");
        XLSX.writeFile(wb, `Laporan_Kedaluwarsa_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-orange-500" />
                        Laporan Barang Kedaluwarsa
                    </h1>
                    <p className="text-slate-500">Pantau stok produk yang kedaluwarsa atau mendekati masa kedaluwarsa.</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={loadData} variant="outline" disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Muat Ulang
                    </Button>
                    <Button onClick={handleExport} className="bg-indigo-600 hover:bg-indigo-700">
                        <Download className="h-4 w-4 mr-2" /> Export Excel
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="active" className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Stok Aktif
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <History className="h-4 w-4" /> Riwayat Pemusnahan
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-8 mt-6">

                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-slate-300" />
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Expired Items Table */}
                            <Card className="border-slate-200 shadow-sm overflow-hidden">
                                <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-red-600" />
                                        <h2 className="font-bold text-slate-800">Telah Kedaluwarsa</h2>
                                    </div>
                                    <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100">{expiredData.length} Batch</Badge>
                                </div>
                                <div className="p-0">
                                    {expiredData.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500 italic">Tidak ada produk yang telah kedaluwarsa.</div>
                                    ) : (
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead>Produk</TableHead>
                                                    <TableHead>Tgl Masuk</TableHead>
                                                    <TableHead>Tgl Kedaluwarsa</TableHead>
                                                    <TableHead className="text-right">Lewat</TableHead>
                                                    <TableHead className="text-right">Sisa Stok</TableHead>
                                                    <TableHead className="text-right">Potensi Rugi</TableHead>
                                                    <TableHead className="w-[100px] text-center">Aksi</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {expiredData.slice((expiredPage - 1) * ITEMS_PER_PAGE, expiredPage * ITEMS_PER_PAGE).map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <div className="font-bold text-slate-900">{item.productName}</div>
                                                            <div className="text-xs text-slate-500 font-mono">{item.productCode}</div>
                                                        </TableCell>
                                                        <TableCell className="text-sm">{format(new Date(item.date), 'dd MMM yyyy')}</TableCell>
                                                        <TableCell className="font-bold text-red-600">
                                                            {format(new Date(item.expired_date), 'dd MMM yyyy', { locale: id })}
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm font-medium text-slate-600">
                                                            {Math.abs(item.daysUntilExpiry)} Hari
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">{item.current_qty}</TableCell>
                                                        <TableCell className="text-right text-red-600 font-medium">
                                                            Rp {(item.current_qty * (item.buy_price || 0)).toLocaleString('id-ID')}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 gap-1 py-0 px-2"
                                                                onClick={() => {
                                                                    setSelectedBatch(item);
                                                                    setIsConfirmOpen(true);
                                                                }}
                                                                title="Musnahkan Barang"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="text-[10px] font-bold">Buang</span>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                                {expiredData.length > ITEMS_PER_PAGE && (
                                    <div className="flex items-center justify-between px-4 py-3 border-t">
                                        <span className="text-sm text-slate-500">
                                            Halaman {expiredPage} dari {Math.ceil(expiredData.length / ITEMS_PER_PAGE)} (Total: {expiredData.length})
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setExpiredPage(Math.max(1, expiredPage - 1))} disabled={expiredPage === 1}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => setExpiredPage(Math.min(Math.ceil(expiredData.length / ITEMS_PER_PAGE), expiredPage + 1))} disabled={expiredPage === Math.ceil(expiredData.length / ITEMS_PER_PAGE)}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>

                            {/* Nearly Expired Items Table */}
                            <Card className="border-slate-200 shadow-sm overflow-hidden">
                                <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-orange-500" />
                                        <h2 className="font-bold text-slate-800">Akan Kedaluwarsa ({NEARLY_EXPIRED_THRESHOLD} Hari)</h2>
                                    </div>
                                    <Badge className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">{nearlyExpiredData.length} Batch</Badge>
                                </div>
                                <div className="p-0">
                                    {nearlyExpiredData.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500 italic">Tidak ada produk yang mendekati masa kedaluwarsa.</div>
                                    ) : (
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead>Produk</TableHead>
                                                    <TableHead>Tgl Masuk</TableHead>
                                                    <TableHead>Tgl Kedaluwarsa</TableHead>
                                                    <TableHead className="text-right">Sisa Waktu</TableHead>
                                                    <TableHead className="text-right">Sisa Stok</TableHead>
                                                    <TableHead className="text-right">Nilai Modal</TableHead>
                                                    <TableHead className="w-[100px] text-center">Aksi</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {nearlyExpiredData.slice((nearlyPage - 1) * ITEMS_PER_PAGE, nearlyPage * ITEMS_PER_PAGE).map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <div className="font-bold text-slate-900">{item.productName}</div>
                                                            <div className="text-xs text-slate-500 font-mono">{item.productCode}</div>
                                                        </TableCell>
                                                        <TableCell className="text-sm">{format(new Date(item.date), 'dd MMM yyyy')}</TableCell>
                                                        <TableCell className="font-bold text-orange-600">
                                                            {format(new Date(item.expired_date), 'dd MMM yyyy', { locale: id })}
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm font-medium text-slate-600 flex justify-end">
                                                            <Badge variant="outline" className={`${item.daysUntilExpiry <= 7 ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                                {item.daysUntilExpiry === 0 ? 'Hari Ini' : `${item.daysUntilExpiry} Hari`}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">{item.current_qty}</TableCell>
                                                        <TableCell className="text-right text-slate-600 font-medium">
                                                            Rp {(item.current_qty * (item.buy_price || 0)).toLocaleString('id-ID')}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 h-8 gap-1 py-0 px-2"
                                                                onClick={() => {
                                                                    setSelectedBatch(item);
                                                                    setIsConfirmOpen(true);
                                                                }}
                                                                title="Musnahkan Barang"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="text-[10px] font-bold">Buang</span>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                                {nearlyExpiredData.length > ITEMS_PER_PAGE && (
                                    <div className="flex items-center justify-between px-4 py-3 border-t">
                                        <span className="text-sm text-slate-500">
                                            Halaman {nearlyPage} dari {Math.ceil(nearlyExpiredData.length / ITEMS_PER_PAGE)} (Total: {nearlyExpiredData.length})
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setNearlyPage(Math.max(1, nearlyPage - 1))} disabled={nearlyPage === 1}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => setNearlyPage(Math.min(Math.ceil(nearlyExpiredData.length / ITEMS_PER_PAGE), nearlyPage + 1))} disabled={nearlyPage === Math.ceil(nearlyExpiredData.length / ITEMS_PER_PAGE)}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <History className="h-5 w-5 text-indigo-500" />
                                <h2 className="font-bold text-slate-800">Riwayat Pemusnahan Barang</h2>
                            </div>
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">{historyData.length} Record</Badge>
                        </div>
                        <div className="p-0">
                            {historyData.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                                    <History className="h-12 w-12 text-slate-200" />
                                    <p className="italic">Belum ada riwayat pemusnahan barang.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="py-4">Tanggal</TableHead>
                                            <TableHead>Keterangan Pemusnahan</TableHead>
                                            <TableHead>Oleh</TableHead>
                                            <TableHead className="text-right">Nilai Kerugian</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyData.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE).map(item => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                <TableCell className="font-medium">
                                                    {format(new Date(item.date), 'dd MMM yyyy', { locale: id })}
                                                </TableCell>
                                                <TableCell className="max-w-[350px]">
                                                    <div className="text-sm font-semibold text-slate-800">{item.description}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">ID: {item.id.slice(0, 8)}...</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px] bg-slate-50">{item.performed_by}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-red-600">
                                                    Rp {Number(item.amount).toLocaleString('id-ID')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                        {historyData.length > ITEMS_PER_PAGE && (
                            <div className="flex items-center justify-between px-4 py-3 border-t">
                                <span className="text-sm text-slate-500">
                                    Halaman {historyPage} dari {Math.ceil(historyData.length / ITEMS_PER_PAGE)} (Total: {historyData.length})
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setHistoryPage(Math.max(1, historyPage - 1))} disabled={historyPage === 1}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setHistoryPage(Math.min(Math.ceil(historyData.length / ITEMS_PER_PAGE), historyPage + 1))} disabled={historyPage === Math.ceil(historyData.length / ITEMS_PER_PAGE)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleWriteOff}
                title="Konfirmasi Pemusnahan Barang"
                description={selectedBatch ? (
                    <div className="space-y-3 pt-2">
                        <p>Apakah Anda yakin ingin memusnahkan stok berikut?</p>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                            <div className="font-bold text-red-800">{selectedBatch.productName}</div>
                            <div className="text-red-600 flex justify-between mt-1">
                                <span>Jumlah: <strong>{selectedBatch.current_qty} pcs</strong></span>
                                <span>Nilai Rugi: <strong>Rp {(selectedBatch.current_qty * (selectedBatch.buy_price || 0)).toLocaleString('id-ID')}</strong></span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 italic">Tindakan ini akan mengurangi stok menjadi 0 dan mencatat kerugian di laporan keuangan (Non-Tunai).</p>
                    </div>
                ) : "Apakah Anda yakin?"}
                confirmText={isWritingOff ? "Memproses..." : "Ya, Musnahkan"}
                cancelText="Batal"
                variant="destructive"
                isLoading={isWritingOff}
            />
        </div>
    );
};

export default ExpiryReport;
