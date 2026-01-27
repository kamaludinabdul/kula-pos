import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { safeSupabaseQuery, safeSupabaseRpc } from '../utils/supabaseHelper';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search, Save, CheckCircle2, History, Plus, Minus, DollarSign, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const StockOpname = () => {
    const { products, currentStore, refreshData, fetchAllProducts } = useData();
    const activeStoreId = currentStore?.id;

    // Fetch all products for stock opname
    useEffect(() => {
        if (activeStoreId && products.length === 0) {
            fetchAllProducts(activeStoreId);
        }
    }, [activeStoreId, products.length, fetchAllProducts]);
    const [searchTerm, setSearchTerm] = useState('');
    const [opnameData, setOpnameData] = useState({});
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [sortBy, setSortBy] = useState('name'); // name, stock-asc, stock-desc

    // History
    const [opnameHistory, setOpnameHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [historySortOrder, setHistorySortOrder] = useState('desc'); // 'desc' (newest), 'asc' (oldest)

    const fetchOpnameHistory = React.useCallback(async () => {
        setLoadingHistory(true);
        try {
            const data = await safeSupabaseQuery({
                tableName: 'stock_opname_sessions',
                queryBuilder: (q) => q.order('created_at', { ascending: historySortOrder === 'asc' }).limit(20),
                fallbackParams: `?order=created_at.${historySortOrder === 'desc' ? 'desc' : 'asc'}&limit=20`
            });

            const mappedHistory = (data || []).map(session => ({
                id: session.id,
                date: session.created_at,
                notes: session.notes,
                totalProducts: session.total_products,
                totalDifferenceValue: session.total_difference_value,
                records: session.records // records is likely JSONB, check if it needs mapping or is already objects
            }));

            setOpnameHistory(mappedHistory);
        } catch (error) {
            console.error("Error fetching opname history:", error);
        } finally {
            setLoadingHistory(false);
        }
    }, [historySortOrder]);

    useEffect(() => {
        fetchOpnameHistory();
    }, [fetchOpnameHistory]);

    const toggleSession = (sessionId) => {
        const newExpanded = new Set(expandedSessions);
        if (newExpanded.has(sessionId)) {
            newExpanded.delete(sessionId);
        } else {
            newExpanded.add(sessionId);
        }
        setExpandedSessions(newExpanded);
    };

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.code && product.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.barcode && product.barcode.includes(searchTerm))
    );

    // Sort products
    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (sortBy === 'stock-asc') {
            return (a.stock || 0) - (b.stock || 0);
        } else if (sortBy === 'stock-desc') {
            return (b.stock || 0) - (a.stock || 0);
        }
        // Default: sort by name
        return a.name.localeCompare(b.name);
    });

    const handlePhysicalStockChange = (productId, value) => {
        // Allow empty string to let user clear the input
        if (value === '') {
            setOpnameData(prev => ({
                ...prev,
                [productId]: {
                    ...prev[productId],
                    physicalStock: ''
                }
            }));
            return;
        }

        const intValue = parseInt(value);
        // Only update if it's a valid non-negative number
        if (!isNaN(intValue) && intValue >= 0) {
            setOpnameData(prev => ({
                ...prev,
                [productId]: {
                    ...prev[productId],
                    physicalStock: intValue
                }
            }));
        }
    };

    const handleNotesChange = (productId, value) => {
        setOpnameData(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                notes: value
            }
        }));
    };

    const getPhysicalStock = (productId) => {
        return opnameData[productId]?.physicalStock ?? '';
    };

    const getProductNotes = (productId) => {
        return opnameData[productId]?.notes ?? '';
    };

    const getDifference = (product) => {
        const physical = opnameData[product.id]?.physicalStock;
        if (physical === undefined || physical === '') return null;
        return physical - (product.stock || 0);
    };

    const getDifferenceValue = (product) => {
        const diff = getDifference(product);
        if (diff === null) return null;
        return diff * (product.sellPrice || 0);
    };

    const handleSaveOpname = async () => {
        setSaving(true);
        try {
            const opnameRecords = [];

            // Process each product with opname data
            for (const [productId, data] of Object.entries(opnameData)) {
                if (data.physicalStock === undefined || data.physicalStock === '') continue;

                const product = products.find(p => p.id === productId);
                if (!product) continue;

                const systemStock = product.stock || 0;
                const physicalStock = data.physicalStock;
                const difference = physicalStock - systemStock;
                const differenceValue = difference * (product.sell_price || product.sellPrice || 0);

                opnameRecords.push({
                    productId,
                    productName: product.name || 'Unknown Product',
                    productCode: product.code || '',
                    systemStock,
                    physicalStock,
                    difference,
                    differenceValue: differenceValue || 0,
                    sellPrice: product.sell_price || product.sellPrice || 0,
                    notes: data.notes || ''
                });

                // Removed unused totalDifferenceValue increment
            }

            if (opnameRecords.length === 0) {
                alert('Tidak ada data opname untuk disimpan.');
                setSaving(false);
                return;
            }

            const result = await safeSupabaseRpc({
                rpcName: 'process_opname_session',
                params: {
                    p_store_id: activeStoreId,
                    p_notes: notes || '',
                    p_records: opnameRecords
                }
            });
            if (!result.success) throw new Error(result.error);

            // Refresh global data to reflect stock changes
            await refreshData();

            alert(`Stock Opname berhasil disimpan! ${opnameRecords.length} produk diupdate.`);
            setOpnameData({});
            setNotes('');
            fetchOpnameHistory(); // Refresh history
        } catch (error) {
            console.error('Error saving stock opname:', error);
            alert('Gagal menyimpan stock opname: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = Object.keys(opnameData).some(id =>
        opnameData[id]?.physicalStock !== undefined && opnameData[id]?.physicalStock !== ''
    );

    const totalDifferences = filteredProducts.reduce((sum, product) => {
        const diff = getDifference(product);
        return diff !== null ? sum + Math.abs(diff) : sum;
    }, 0);

    const totalDifferenceValue = filteredProducts.reduce((sum, product) => {
        const diffValue = getDifferenceValue(product);
        return diffValue !== null ? sum + diffValue : sum;
    }, 0);

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Tabs defaultValue="opname" className="w-full">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Stock Opname</h1>
                        <p className="text-muted-foreground">Penghitungan fisik stok vs sistem</p>
                    </div>
                    <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
                        <TabsList className="grid grid-cols-2 w-full sm:w-[300px]">
                            <TabsTrigger value="opname">Input Opname</TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <History className="h-4 w-4" />
                                Riwayat
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="opname" className="mt-0">
                            <Button
                                onClick={handleSaveOpname}
                                disabled={!hasChanges || saving}
                                className="w-full sm:w-auto gap-2"
                            >
                                <Save className="h-4 w-4" />
                                {saving ? 'Menyimpan...' : 'Simpan Opname'}
                            </Button>
                        </TabsContent>
                    </div>
                </div>

                <TabsContent value="opname" className="space-y-6 mt-0">
                    {/* Summary Cards */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        <Card className="rounded-xl">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Produk</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{filteredProducts.length}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-xl">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produk Dihitung</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-blue-600">
                                    {Object.keys(opnameData).filter(id => opnameData[id]?.physicalStock !== undefined && opnameData[id]?.physicalStock !== '').length}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-xl">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selisih Unit</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-orange-600">
                                    {totalDifferences} <span className="text-sm font-medium">unit</span>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-xl col-span-2 lg:col-span-1">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <DollarSign className="h-3 w-3" />
                                    Selisih Nilai
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className={`text-2xl font-bold ${totalDifferenceValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {totalDifferenceValue >= 0 ? '+' : ''}Rp {totalDifferenceValue.toLocaleString()}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Notes */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Catatan Opname</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Catatan umum untuk sesi stock opname ini..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                            />
                        </CardContent>
                    </Card>

                    {/* Search & Sort */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari produk..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Urutkan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Nama A-Z</SelectItem>
                                <SelectItem value="stock-asc">Stok Terendah</SelectItem>
                                <SelectItem value="stock-desc">Stok Tertinggi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block border rounded-xl overflow-hidden bg-white shadow-sm">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-auto">Produk</TableHead>
                                    <TableHead className="text-center w-[120px]">Stok Sistem</TableHead>
                                    <TableHead className="text-center w-[120px]">Stok Fisik</TableHead>
                                    <TableHead className="text-center w-[120px]">Selisih Unit</TableHead>
                                    <TableHead className="text-right w-[140px]">Selisih Nilai</TableHead>
                                    <TableHead className="w-[200px]">Catatan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Tidak ada produk ditemukan
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedProducts.map(product => {
                                        const difference = getDifference(product);
                                        const differenceValue = getDifferenceValue(product);
                                        return (
                                            <TableRow key={product.id}>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{product.name}</div>
                                                        {product.code && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Kode: {product.code}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline">{product.stock || 0}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input
                                                        type="number"
                                                        className="w-24 text-center"
                                                        placeholder="0"
                                                        value={getPhysicalStock(product.id)}
                                                        onChange={(e) => handlePhysicalStockChange(product.id, e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {difference !== null && (
                                                        <div className="flex items-center justify-center gap-2">
                                                            {difference === 0 ? (
                                                                <Badge variant="outline" className="gap-1">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    Sesuai
                                                                </Badge>
                                                            ) : difference > 0 ? (
                                                                <Badge className="bg-green-600 gap-1">
                                                                    +{difference}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="destructive" className="gap-1">
                                                                    {difference}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {differenceValue !== null && (
                                                        <span className={`font-medium ${differenceValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {differenceValue >= 0 ? '+' : ''}Rp {differenceValue.toLocaleString()}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        placeholder="Catatan..."
                                                        className="w-full"
                                                        value={getProductNotes(product.id)}
                                                        onChange={(e) => handleNotesChange(product.id, e.target.value)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-4">
                        {sortedProducts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground bg-white rounded-xl border">
                                Tidak ada produk ditemukan
                            </div>
                        ) : (
                            sortedProducts.map(product => {
                                const difference = getDifference(product);
                                const differenceValue = getDifferenceValue(product);
                                return (
                                    <div key={product.id} className="bg-white rounded-xl border p-4 shadow-sm space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-slate-800">{product.name}</h3>
                                                {product.code && (
                                                    <p className="text-xs text-slate-500">Kode: {product.code}</p>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                                Stok: {product.stock || 0}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pb-2">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Stok Fisik</label>
                                                <Input
                                                    type="number"
                                                    className="w-full h-9 text-center font-bold"
                                                    placeholder="-"
                                                    value={getPhysicalStock(product.id)}
                                                    onChange={(e) => handlePhysicalStockChange(product.id, e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase text-right block">Selisih</label>
                                                <div className="h-9 flex items-center justify-end">
                                                    {difference !== null ? (
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-center gap-1.5">
                                                                {difference === 0 ? (
                                                                    <Badge variant="outline" className="h-6 text-[10px] font-bold">SESUAI</Badge>
                                                                ) : (
                                                                    <Badge variant={difference > 0 ? "default" : "destructive"} className={`h-6 text-[10px] font-bold ${difference > 0 ? 'bg-green-600' : ''}`}>
                                                                        {difference > 0 ? '+' : ''}{difference} UNIT
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {differenceValue !== null && differenceValue !== 0 && (
                                                                <p className={`text-[10px] font-bold mt-1 ${differenceValue > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                    {differenceValue > 0 ? '+' : ''}Rp {differenceValue.toLocaleString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">-</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t">
                                            <Input
                                                placeholder="Berikan catatan..."
                                                className="h-8 text-xs bg-slate-50 border-none focus-visible:ring-1"
                                                value={getProductNotes(product.id)}
                                                onChange={(e) => handleNotesChange(product.id, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div className="flex items-center justify-between w-full">
                                <CardTitle>Riwayat Stock Opname</CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setHistorySortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="gap-2"
                                >
                                    <ArrowUpDown className="h-3 w-3" />
                                    {historySortOrder === 'desc' ? 'Terbaru' : 'Terlama'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingHistory ? (
                                <div className="text-center py-8">Memuat riwayat...</div>
                            ) : opnameHistory.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Belum ada riwayat opname
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {opnameHistory.map((session) => (
                                        <Card key={session.id} className="border">
                                            <CardHeader
                                                className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => toggleSession(session.id)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex gap-3">
                                                        <div className="mt-1">
                                                            {expandedSessions.has(session.id) ? (
                                                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                                            ) : (
                                                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-base">
                                                                {new Date(session.date).toLocaleDateString('id-ID', {
                                                                    day: 'numeric',
                                                                    month: 'long',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </CardTitle>
                                                            {session.notes && (
                                                                <p className="text-sm text-muted-foreground mt-1">{session.notes}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <Badge variant="outline">
                                                            {session.totalProducts} produk
                                                        </Badge>
                                                        {session.totalDifferenceValue !== undefined && (
                                                            <div className={`text-sm font-bold ${session.totalDifferenceValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {session.totalDifferenceValue >= 0 ? '+' : ''}Rp {session.totalDifferenceValue.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            {expandedSessions.has(session.id) && (
                                                <CardContent className="p-0 sm:p-6">
                                                    {/* Desktop Table View */}
                                                    <div className="hidden sm:block">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Produk</TableHead>
                                                                    <TableHead className="text-center">Sistem</TableHead>
                                                                    <TableHead className="text-center">Fisik</TableHead>
                                                                    <TableHead className="text-center">Selisih</TableHead>
                                                                    <TableHead className="text-right">Nilai</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {session.records && session.records.map((record, idx) => (
                                                                    <TableRow key={idx}>
                                                                        <TableCell className="font-medium">{record.productName}</TableCell>
                                                                        <TableCell className="text-center">{record.systemStock}</TableCell>
                                                                        <TableCell className="text-center">{record.physicalStock}</TableCell>
                                                                        <TableCell className="text-center">
                                                                            <Badge variant={record.difference > 0 ? "default" : "destructive"}>
                                                                                {record.difference > 0 ? '+' : ''}{record.difference}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            {record.differenceValue !== undefined && (
                                                                                <span className={record.differenceValue >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                                                    {record.differenceValue >= 0 ? '+' : ''}Rp {record.differenceValue.toLocaleString()}
                                                                                </span>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>

                                                    {/* Mobile Card View for Records */}
                                                    <div className="sm:hidden divide-y">
                                                        {session.records && session.records.map((record, idx) => (
                                                            <div key={idx} className="p-4 space-y-2">
                                                                <div className="flex justify-between items-start">
                                                                    <span className="font-bold text-slate-800 text-sm">{record.productName}</span>
                                                                    <Badge variant={record.difference >= 0 ? "default" : "destructive"} className={record.difference > 0 ? 'bg-green-600' : ''}>
                                                                        {record.difference > 0 ? '+' : ''}{record.difference}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <div className="flex gap-4">
                                                                        <span className="text-slate-500">Sistem: <b className="text-slate-800">{record.systemStock}</b></span>
                                                                        <span className="text-slate-500">Fisik: <b className="text-slate-800">{record.physicalStock}</b></span>
                                                                    </div>
                                                                    {record.differenceValue !== undefined && (
                                                                        <span className={`font-bold ${record.differenceValue >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                            {record.differenceValue >= 0 ? '+' : ''}Rp {record.differenceValue.toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {record.notes && (
                                                                    <p className="text-[10px] text-slate-400 italic bg-slate-50 p-1.5 rounded mt-1">
                                                                        "{record.notes}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default StockOpname;
