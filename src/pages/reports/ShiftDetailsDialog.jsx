import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { supabase } from '../../supabase';
import { ArrowUpRight, ArrowDownLeft, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';

const ShiftDetailsDialog = ({ isOpen, onClose, shift }) => {
    const [movements, setMovements] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { cancelTransaction } = useData();

    // Cancel Dialog State
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [transactionToCancel, setTransactionToCancel] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);



    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Cash Movements
            const { data: movList, error: movError } = await supabase
                .from('shift_movements')
                .select('*')
                .eq('shift_id', shift.id)
                .order('date', { ascending: false });

            if (movError) throw movError;
            setMovements(movList || []);

            // Fetch Transactions (Sales)
            const { data: transList, error: transError } = await supabase
                .from('transactions')
                .select('*')
                .eq('shift_id', shift.id)
                .order('date', { ascending: false });

            if (transError) throw transError;
            setTransactions(transList || []);

        } catch (error) {
            console.error("Error fetching shift details:", error);
        } finally {
            setLoading(false);
        }
    }, [shift]);

    useEffect(() => {
        if (isOpen && shift) {
            fetchDetails();
        }
    }, [isOpen, shift, fetchDetails]);

    const handleCancelClick = (transaction) => {
        setTransactionToCancel(transaction);
        setCancelReason('');
        setIsCancelDialogOpen(true);
    };

    const confirmCancel = async () => {
        if (!transactionToCancel || !cancelReason.trim()) return;

        setIsCancelling(true);
        const result = await cancelTransaction(transactionToCancel.id, cancelReason);
        setIsCancelling(false);

        if (result.success) {
            setIsCancelDialogOpen(false);
            setTransactionToCancel(null);
            fetchDetails(); // Refresh list
        } else {
            alert("Gagal membatalkan transaksi: " + result.error);
        }
    };

    if (!shift) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detail Shift: {shift.cashier_name}</DialogTitle>
                        <div className="text-sm text-muted-foreground">
                            {new Date(shift.start_time).toLocaleString('id-ID')} - {shift.end_time ? new Date(shift.end_time).toLocaleString('id-ID') : 'Sekarang'}
                        </div>
                    </DialogHeader>

                    <Tabs defaultValue="movements" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="movements">Arus Kas (Expense/Income)</TabsTrigger>
                            <TabsTrigger value="transactions">Riwayat Penjualan</TabsTrigger>
                        </TabsList>

                        <TabsContent value="movements" className="space-y-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Waktu</TableHead>
                                            <TableHead>Tipe</TableHead>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead>Keterangan</TableHead>
                                            <TableHead className="text-right">Jumlah</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow><TableCell colSpan={5} className="text-center">Memuat...</TableCell></TableRow>
                                        ) : movements.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Tidak ada data arus kas tambahan.</TableCell></TableRow>
                                        ) : (
                                            movements.map(m => (
                                                <TableRow key={m.id}>
                                                    <TableCell className="text-xs">{new Date(m.date).toLocaleTimeString('id-ID')}</TableCell>
                                                    <TableCell>
                                                        {m.type === 'in' ? (
                                                            <span className="flex items-center text-green-600 text-xs font-medium bg-green-50 px-2 py-1 rounded-full w-fit">
                                                                <ArrowDownLeft className="w-3 h-3 mr-1" /> Masuk
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center text-red-600 text-xs font-medium bg-red-50 px-2 py-1 rounded-full w-fit">
                                                                <ArrowUpRight className="w-3 h-3 mr-1" /> Keluar
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{m.category}</TableCell>
                                                    <TableCell>{m.reason}</TableCell>
                                                    <TableCell className={`text-right font-medium ${m.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {m.type === 'in' ? '+' : '-'} Rp {m.amount.toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="transactions" className="space-y-4">
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Waktu</TableHead>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Metode</TableHead>
                                            <TableHead className="text-right">Diskon</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">Status</TableHead>
                                            {(user?.role === 'owner' || user?.role === 'super_admin' || user?.role === 'admin') && (
                                                <TableHead className="text-center">Aksi</TableHead>
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow><TableCell colSpan={7} className="text-center">Memuat...</TableCell></TableRow>
                                        ) : transactions.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Tidak ada transaksi penjualan.</TableCell></TableRow>
                                        ) : (
                                            transactions.map(t => (
                                                <TableRow key={t.id} className={t.status === 'cancelled' ? 'bg-muted/50' : ''}>
                                                    <TableCell className="text-xs">{new Date(t.date).toLocaleTimeString('id-ID')}</TableCell>
                                                    <TableCell className="font-mono text-xs">#{t.id.slice(-6)}</TableCell>
                                                    <TableCell className="capitalize text-xs">{t.payment_method}</TableCell>
                                                    <TableCell className="text-right text-xs text-red-500">
                                                        {t.discount > 0 ? `-Rp ${t.discount.toLocaleString()}` : '-'}
                                                    </TableCell>
                                                    <TableCell className={`text-right ${t.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>
                                                        Rp {t.total.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {t.status === 'cancelled' ? (
                                                            <span className="text-xs text-destructive font-medium">Dibatalkan</span>
                                                        ) : (
                                                            <span className="text-xs text-green-600 font-medium">Sukses</span>
                                                        )}
                                                    </TableCell>
                                                    {(user?.role === 'owner' || user?.role === 'super_admin' || (user?.role === 'admin' && user?.permissions?.includes('transactions.void'))) && (
                                                        <TableCell className="text-center">
                                                            {t.status !== 'cancelled' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCancelClick(t);
                                                                    }}
                                                                    title="Batalkan Transaksi"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button onClick={onClose}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Batalkan Transaksi
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Apakah Anda yakin ingin membatalkan transaksi <strong>#{transactionToCancel?.id.slice(-6)}</strong>?
                            <br />
                            Stok produk akan dikembalikan dan transaksi akan ditandai sebagai batal.
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="cancelReason">Alasan Pembatalan <span className="text-destructive">*</span></Label>
                            <Input
                                id="cancelReason"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Contoh: Salah input barang, Pelanggan batal beli"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)} disabled={isCancelling}>Batal</Button>
                        <Button variant="destructive" onClick={confirmCancel} disabled={!cancelReason.trim() || isCancelling}>
                            {isCancelling ? 'Memproses...' : 'Ya, Batalkan Transaksi'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ShiftDetailsDialog;
