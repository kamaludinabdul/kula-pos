import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { supabase } from '../supabase';
import { Calendar, ShoppingBag, CreditCard } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useData } from '../context/DataContext';

const CustomerTransactionHistory = ({ isOpen, onClose, customer }) => {
    const { processDebtPayment } = useData();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        totalTransactions: 0,
        totalSpent: 0,
        totalPoints: 0
    });

    const [isPayDebtOpen, setIsPayDebtOpen] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const { data: txList, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('customer_id', customer.id)
                .order('date', { ascending: false });

            if (error) throw error;
            setTransactions(txList || []);

            // Calculate stats
            const totalSpent = (txList || []).reduce((sum, tx) => sum + (tx.total || 0), 0);
            const totalPoints = (txList || []).reduce((sum, tx) => sum + (tx.points_earned || 0), 0);

            setStats({
                totalTransactions: (txList || []).length,
                totalSpent,
                totalPoints
            });

        } catch (error) {
            console.error("Error fetching customer transactions:", error);
        } finally {
            setLoading(false);
        }
    }, [customer]);

    useEffect(() => {
        if (isOpen && customer) {
            fetchTransactions();
        }
    }, [isOpen, customer, fetchTransactions]);

    const handlePayDebt = async () => {
        if (!payAmount || isNaN(payAmount) || Number(payAmount) <= 0) return;

        const result = await processDebtPayment(customer.id, Number(payAmount), paymentMethod);
        if (result.success) {
            setIsPayDebtOpen(false);
            setPayAmount('');
            fetchTransactions(); // Refresh transactions
            // Ideally refresh customer data too, but that happens via context
        } else {
            alert(`Gagal memproses pembayaran: ${result.error}`);
        }
    };

    if (!customer) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto" aria-describedby="transaction-history-description">
                <DialogHeader>
                    <div className="flex justify-between items-center pr-8">
                        <DialogTitle>Riwayat Transaksi: {customer.name}</DialogTitle>
                        {customer.debt > 0 && (
                            <Button size="sm" variant="destructive" onClick={() => setIsPayDebtOpen(true)}>
                                Bayar Hutang (Rp {customer.debt.toLocaleString()})
                            </Button>
                        )}
                    </div>
                    <DialogDescription id="transaction-history-description">
                        Menampilkan riwayat transaksi untuk {customer.name}.
                    </DialogDescription>
                </DialogHeader>

                {/* Stats Summary */}
                <div className="grid grid-cols-4 gap-4 py-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-sm text-blue-600 font-medium">Total Transaksi</div>
                        <div className="text-2xl font-bold text-blue-700">{stats.totalTransactions}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-sm text-green-600 font-medium">Total Belanja</div>
                        <div className="text-2xl font-bold text-green-700">Rp {stats.totalSpent.toLocaleString()}</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-sm text-purple-600 font-medium">Total Poin</div>
                        <div className="text-2xl font-bold text-purple-700">{stats.totalPoints}</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                        <div className="text-sm text-red-600 font-medium">Hutang</div>
                        <div className="text-2xl font-bold text-red-700">Rp {(customer.debt || 0).toLocaleString()}</div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>ID Transaksi</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Metode</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Poin</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        Memuat data...
                                    </TableCell>
                                </TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Belum ada transaksi
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <div>{new Date(tx.date).toLocaleDateString('id-ID')}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(tx.date).toLocaleTimeString('id-ID')}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            #{tx.id}
                                        </TableCell>
                                        <TableCell>
                                            {tx.type === 'debt_payment' ? (
                                                <span className="text-sm italic text-muted-foreground">Pembayaran Hutang</span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">
                                                        {tx.items?.length || 0} item(s)
                                                    </span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                <CreditCard className="h-3 w-3 mr-1" />
                                                {tx.payment_method}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            Rp {tx.total?.toLocaleString() || 0}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {tx.points_earned ? (
                                                <Badge variant="secondary">
                                                    +{tx.points_earned} pts
                                                </Badge>
                                            ) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pay Debt Dialog */}
                <Dialog open={isPayDebtOpen} onOpenChange={setIsPayDebtOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Bayar Hutang</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Sisa Hutang</label>
                                <div className="text-xl font-bold text-red-600">
                                    Rp {(customer.debt || 0).toLocaleString()}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Jumlah Pembayaran</label>
                                <Input
                                    type="number"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    placeholder="Masukkan jumlah"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Metode Pembayaran</label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">Tunai</SelectItem>
                                        <SelectItem value="qris">QRIS</SelectItem>
                                        <SelectItem value="transfer">Transfer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsPayDebtOpen(false)}>Batal</Button>
                            <Button onClick={handlePayDebt} disabled={!payAmount || Number(payAmount) <= 0}>
                                Bayar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    );
};

export default CustomerTransactionHistory;
