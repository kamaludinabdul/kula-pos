import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "../components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { useData } from '../context/DataContext';
import { supabase } from '../supabase';
import { Layers, AlertTriangle, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

const BatchDetailDialog = ({ isOpen, onClose, product }) => {
    const { fetchActiveBatches, createInitialBatch } = useData();
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [tempDate, setTempDate] = useState('');
    const [savingId, setSavingId] = useState(null);

    useEffect(() => {
        const loadBatches = async () => {
            if (isOpen && product) {
                setLoading(true);
                try {
                    const data = await fetchActiveBatches(product.id);
                    setBatches(data || []);
                } catch (error) {
                    console.error("Failed to load batches:", error);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadBatches();
    }, [isOpen, product, fetchActiveBatches]);

    // Check if an expired date is within 30 days
    const isNearlyExpired = (dateString, isAlreadyExpired) => {
        if (!dateString) return false;

        const expiry = new Date(dateString);
        if (isNaN(expiry)) return false;

        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        if (isAlreadyExpired) {
            return false;
        }

        return expiry <= thirtyDaysFromNow;
    };

    const isExpired = (dateString) => {
        if (!dateString) return false;
        const expiry = new Date(dateString);
        if (isNaN(expiry)) return false;

        const now = new Date();
        now.setHours(0, 0, 0, 0); // Need to compare exact days
        return expiry < now;
    };

    const handleEdit = (batch) => {
        setEditingId(batch.id);
        setTempDate(batch.expired_date || '');
    };

    const handleCancel = () => {
        setEditingId(null);
        setTempDate('');
    };

    const handleSaveDate = async (batchId) => {
        if (!tempDate) return;

        setSavingId(batchId);
        try {
            const { error } = await supabase
                .from('batches')
                .update({ expired_date: tempDate })
                .eq('id', batchId);

            if (error) throw error;

            // Refresh local state
            setBatches(prev => prev.map(b =>
                b.id === batchId ? { ...b, expired_date: tempDate } : b
            ));
            setEditingId(null);
        } catch (error) {
            console.error("Gagal update tanggal kedaluwarsa:", error);
            alert("Gagal menyimpan perubahan.");
        } finally {
            setSavingId(null);
        }
    };

    const handleCreateInitial = async () => {
        if (!tempDate || !product) return;

        setSavingId('initial');
        try {
            const result = await createInitialBatch(
                product.id,
                product.stock,
                product.buyPrice || product.buy_price || 0,
                tempDate
            );

            if (result.success) {
                // Refresh batches
                const data = await fetchActiveBatches(product.id);
                setBatches(data || []);
                setEditingId(null);
                setTempDate('');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error("Gagal membuat batch awal:", error);
            alert("Gagal menyimpan data kedaluwarsa.");
        } finally {
            setSavingId(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Detail Batch & Kedaluwarsa: {product?.name}
                    </DialogTitle>
                    <DialogDescription>
                        Daftar stok yang masih tersedia berdasarkan tanggal masuk (FIFO).
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto mt-4 min-h-[300px]">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading...</div>
                    ) : batches.length === 0 ? (
                        <div className="text-center py-10 px-6 border-2 border-dashed rounded-xl bg-slate-50/50">
                            <div className="bg-white p-3 rounded-full w-fit mx-auto shadow-sm border border-slate-100 mb-4">
                                <AlertTriangle className="h-6 w-6 text-orange-500" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-1">Data Kedaluwarsa Belum Diatur</h3>
                            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                                Produk ini memiliki stok <strong>{product?.stock || 0} unit</strong> namun belum terdaftar di sistem pelacakan kedaluwarsa.
                            </p>

                            {product?.stock > 0 && (
                                <div className="bg-white border border-slate-200 rounded-lg p-4 max-w-sm mx-auto shadow-sm">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 text-left">Set Tanggal Kedaluwarsa</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="date"
                                            value={tempDate}
                                            onChange={(e) => setTempDate(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button
                                            onClick={handleCreateInitial}
                                            disabled={!tempDate || savingId === 'initial'}
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            {savingId === 'initial' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 text-left italic">
                                        * Ini akan mendaftarkan seluruh stok saat ini ke tanggal tersebut.
                                    </p>
                                </div>
                            )}

                            {(!product?.stock || product.stock <= 0) && (
                                <p className="text-xs text-slate-400 italic">Tambah stok baru untuk mulai melacak kedaluwarsa.</p>
                            )}
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead>Tgl Masuk</TableHead>
                                        <TableHead className="text-right">Sisa Stok (Batch)</TableHead>
                                        <TableHead className="text-right">Harga Beli</TableHead>
                                        <TableHead>Expired Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-[80px] text-center">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {batches.map((batch) => {
                                        const expired = isExpired(batch.expired_date);
                                        const nearExpire = isNearlyExpired(batch.expired_date, expired);

                                        return (
                                            <TableRow key={batch.id}>
                                                <TableCell className="text-sm">
                                                    <div className="font-medium">
                                                        {new Date(batch.date).toLocaleDateString('id-ID')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-indigo-600">
                                                    {batch.current_qty}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    Rp {parseFloat(batch.buy_price || 0).toLocaleString('id-ID')}
                                                </TableCell>
                                                <TableCell className="text-sm font-medium">
                                                    {editingId === batch.id ? (
                                                        <Input
                                                            type="date"
                                                            value={tempDate}
                                                            onChange={(e) => setTempDate(e.target.value)}
                                                            className="h-8 w-32 text-xs"
                                                            autoFocus
                                                        />
                                                    ) : batch.expired_date ? (
                                                        new Date(batch.expired_date).toLocaleDateString('id-ID')
                                                    ) : (
                                                        <span className="text-slate-400 italic">Tidak ada</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {expired ? (
                                                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                                            <AlertTriangle className="h-3 w-3" /> Kedaluwarsa!
                                                        </Badge>
                                                    ) : nearExpire ? (
                                                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200 flex items-center gap-1 w-fit">
                                                            <AlertTriangle className="h-3 w-3" /> Hampir Expired
                                                        </Badge>
                                                    ) : batch.expired_date ? (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">
                                                            Aman
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-400">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {editingId === batch.id ? (
                                                        <div className="flex items-center gap-1 justify-center">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                onClick={() => handleSaveDate(batch.id)}
                                                                disabled={savingId === batch.id}
                                                            >
                                                                {savingId === batch.id ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <Check className="h-3 w-3" />
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                                                onClick={handleCancel}
                                                                disabled={savingId === batch.id}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                            onClick={() => handleEdit(batch)}
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BatchDetailDialog;
