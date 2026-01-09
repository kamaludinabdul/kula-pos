import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../supabase';
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
    const { products, currentStore, refreshData } = useData();
    const activeStoreId = currentStore?.id;
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
            const { data, error } = await supabase
                .from('stock_opname_sessions')
                .select('*')
                .order('created_at', { ascending: historySortOrder === 'desc' })
                .limit(20);

            if (error) throw error;
            setOpnameHistory(data || []);
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

            const { data: result, error } = await supabase.rpc('process_opname_session', {
                p_store_id: activeStoreId,
                p_notes: notes || '',
                p_records: opnameRecords
            });

            if (error) throw error;
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
        <div className="p-4 space-y-6">
            <Tabs defaultValue="opname" className="w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Stock Opname</h1>
                        <p className="text-muted-foreground">Penghitungan fisik stok vs sistem</p>
                    </div>
                    <TabsList>
                        <TabsTrigger value="opname">Input Opname</TabsTrigger>
                        <TabsTrigger value="history">
                            <History className="h-4 w-4 mr-2" />
                            Riwayat
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="opname" className="space-y-6">
                    <div className="flex justify-end">
                        <Button
                            onClick={handleSaveOpname}
                            disabled={!hasChanges || saving}
                            className="gap-2"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? 'Menyimpan...' : 'Simpan Opname'}
                        </Button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Total Produk</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{filteredProducts.length}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Produk Dihitung</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                    {Object.keys(opnameData).filter(id => opnameData[id]?.physicalStock !== undefined && opnameData[id]?.physicalStock !== '').length}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Selisih Unit</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">
                                    {totalDifferences} unit
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    Selisih Nilai
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
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
                    <div className="flex gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari produk..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Urutkan" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Nama A-Z</SelectItem>
                                <SelectItem value="stock-asc">Stok Terendah</SelectItem>
                                <SelectItem value="stock-desc">Stok Tertinggi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Products Table */}
                    <Card>
                        <CardContent className="p-0">
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
                        </CardContent>
                    </Card>
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
                                                <CardContent>
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
