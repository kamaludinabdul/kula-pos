import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Search, Plus, Filter, FileText, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

import ReceiveStockDialog from './purchase-components/ReceiveStockDialog';
import Pagination from '../components/Pagination';
import { supabase } from '../supabase';
import { ArrowUpDown } from 'lucide-react';

const PurchaseOrders = () => {
    // Remove global purchaseOrders from useData, we fetch locally
    const { purchaseOrders: _globalPOs, currentStore } = useData();
    const navigate = useNavigate();

    // -- Local Data State (Pagination) --
    const [poList, setPoList] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [isLoading, setIsLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);

    // -- Filters & Sort --
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // Dialog State
    const [isReceiveOpen, setIsReceiveOpen] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);

    // -- Data Fetching Logic --
    const fetchPOs = async (page = 1) => {
        if (!currentStore?.id) return;

        setIsLoading(true);
        try {
            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            let query = supabase
                .from('purchase_orders')
                .select('*', { count: 'exact' })
                .eq('store_id', currentStore.id);

            if (searchTerm) {
                // If it looks like a UUID or part of it, try to match ID, otherwise name
                if (searchTerm.length > 4) {
                    query = query.or(`supplier_name.ilike.%${searchTerm}%,id.textSearch.%${searchTerm}%`);
                } else {
                    query = query.ilike('supplier_name', `%${searchTerm}%`);
                }
            }

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            // Map sort keys
            let sortKey = sortConfig.key;
            if (sortKey === 'supplierName') sortKey = 'supplier_name';
            if (sortKey === 'totalAmount') sortKey = 'total_amount';

            const { data, error, count } = await query
                .order(sortKey, { ascending: sortConfig.direction === 'asc' })
                .range(from, to);

            if (error) throw error;

            setPoList(data || []);
            if (count !== null) setTotalItems(count);
        } catch (error) {
            console.error("Error fetching POs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
        // Effect will trigger fetch because sortConfig changes? 
        // No, fetchPOs is not in dependency array of a generic effect.
        // We need to trigger it manually or add to effect.
        // To be safe and simple:
        // We can add sortConfig to the main useEffect dependency or call fetchPOs here.
        // Let's add it to the dependency array of the existing useEffect.
    };

    // Fetch Data
    useEffect(() => {
        fetchPOs(currentPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStore, statusFilter, itemsPerPage, sortConfig, searchTerm]);

    const handlePageChange = (page) => {
        setCurrentPage(page);
        fetchPOs(page);
    };

    const handleItemsPerPageChange = (val) => {
        setItemsPerPage(val);
        setCurrentPage(1);
    };

    const handleReceiveClick = (po, e) => {
        e.stopPropagation();
        setSelectedPO(po);
        setIsReceiveOpen(true);
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'draft': return 'neutral-subtle';
            case 'ordered': return 'info-subtle';
            case 'received': return 'success-subtle';
            case 'cancelled': return 'error-subtle';
            default: return 'neutral-subtle';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'draft': return 'Draft';
            case 'ordered': return 'Dipesan';
            case 'received': return 'Diterima';
            case 'cancelled': return 'Dibatalkan';
            default: return status;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
                <Button onClick={() => navigate('/purchase-orders/new')} className="gap-2">
                    <Plus className="h-4 w-4" /> Buat PO Baru
                </Button>
            </div>

            {/* Metrics Cards could go here */}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari No. PO atau Supplier..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="ordered">Dipesan</SelectItem>
                            <SelectItem value="received">Diterima</SelectItem>
                            <SelectItem value="cancelled">Dibatalkan</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* List */}
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('id')}>
                                    <div className="flex items-center gap-1">No. PO <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('date')}>
                                    <div className="flex items-center gap-1">Tanggal <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('supplierName')}>
                                    <div className="flex items-center gap-1">Supplier <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th className="text-right p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('totalAmount')}>
                                    <div className="flex items-center justify-end gap-1">Total <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th className="text-center p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:bg-slate-100/50 transition-colors" onClick={() => handleSort('status')}>
                                    <div className="flex items-center justify-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
                                </th>
                                <th className="text-right p-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {poList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-12 text-slate-400 font-medium italic">
                                        {isLoading ? "Memuat data..." : "Tidak ada data purchase order."}
                                    </td>
                                </tr>
                            ) : (
                                poList.map((po) => (
                                    <tr key={po.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                                        <td className="p-4 font-mono text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">#{po.id.slice(0, 8).toUpperCase()}</td>
                                        <td className="p-4 font-medium text-slate-600">{format(new Date(po.date || po.created_at), 'dd MMM yyyy', { locale: idLocale })}</td>
                                        <td className="p-4 font-bold text-slate-900">{po.supplier_name}</td>
                                        <td className="p-4 text-right font-extrabold text-slate-900">
                                            Rp {parseInt(po.total_amount || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="p-4 text-center">
                                            <Badge variant={getStatusVariant(po.status)} className="border-none font-bold text-[10px] uppercase px-2 py-0.5">
                                                {getStatusLabel(po.status)}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {po.status === 'ordered' && (
                                                    <Button variant="outline" size="sm" className="h-8 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 rounded-lg font-bold text-xs" onClick={(e) => handleReceiveClick(po, e)}>
                                                        Terima
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="h-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/purchase-orders/${po.id}`);
                                                }}>
                                                    Detail
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 gap-4">
                {poList.length === 0 ? (
                    <div className="text-center p-12 bg-white rounded-2xl border border-dashed text-slate-400 font-medium italic">
                        {isLoading ? "Memuat data..." : "Tidak ada data purchase order."}
                    </div>
                ) : (
                    poList.map((po) => (
                        <div
                            key={po.id}
                            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3 relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
                            onClick={() => navigate(`/purchase-orders/${po.id}`)}
                        >
                            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${po.status === 'received' ? 'bg-emerald-500' : (po.status === 'ordered' ? 'bg-blue-500' : (po.status === 'cancelled' ? 'bg-red-500' : 'bg-slate-300'))}`} />
                            <div className="flex justify-between items-start pl-2">
                                <div className="space-y-1 min-w-0">
                                    <p className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        #{po.id.slice(0, 8).toUpperCase()}
                                    </p>
                                    <h3 className="font-extrabold text-slate-900 leading-tight truncate">
                                        {po.supplier_name}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        {format(new Date(po.date || po.created_at), 'dd MMM yyyy', { locale: idLocale })}
                                    </p>
                                </div>
                                <Badge variant={getStatusVariant(po.status)} className="border-none font-bold text-[9px] uppercase px-2 py-0.5 tracking-tighter">
                                    {getStatusLabel(po.status)}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-50 pl-2">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                                    <p className="text-base font-black text-indigo-600">
                                        Rp {parseInt(po.total_amount || 0).toLocaleString('id-ID')}
                                    </p>
                                </div>
                                <div className="space-y-0.5 text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update Terakhir</p>
                                    <p className="text-xs font-bold text-slate-600">
                                        {format(new Date(po.updated_at || po.created_at), 'HH:mm', { locale: idLocale })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end pt-1 gap-2 pl-2">
                                {po.status === 'ordered' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9 px-4 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm"
                                        onClick={(e) => handleReceiveClick(po, e)}
                                    >
                                        Terima
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-4 rounded-xl text-slate-400 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-widest"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/purchase-orders/${po.id}`);
                                    }}
                                >
                                    Detail
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ReceiveStockDialog
                open={isReceiveOpen}
                onClose={() => { setIsReceiveOpen(false); setSelectedPO(null); }}
                po={selectedPO}
            />

            <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
            />
        </div>
    );
};

export default PurchaseOrders;
