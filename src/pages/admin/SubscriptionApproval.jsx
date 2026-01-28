import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Loader2, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from '../../components/ui/use-toast';

const SubscriptionApproval = () => {
    const { user } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            // Fetch pending subscription invoices
            const { data, error } = await supabase
                .from('subscription_invoices')
                .select(`
                    *,
                    stores:store_id (
                        name,
                        email
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInvoices(data || []);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            toast({
                title: "Gagal memuat data",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleApprove = async (invoice) => {
        if (!confirm(`Setujui langganan ${invoice.stores?.name} untuk paket ${invoice.plan_id.toUpperCase()}?`)) return;

        setProcessingId(invoice.id);
        try {
            const { data, error } = await supabase.rpc('approve_subscription_invoice', {
                p_invoice_id: invoice.id,
                p_admin_id: user.id
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || 'Approval failed');

            toast({
                title: "Berhasil Disetujui",
                description: `Langganan untuk ${invoice.stores?.name} telah aktif.`
            });

            // Refresh list
            fetchInvoices();

        } catch (error) {
            console.error("Approval Error:", error);
            toast({
                title: "Gagal menyetujui",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setProcessingId(null);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    // Helper to view proof
    const viewProof = async (path) => {
        if (!path) return;
        try {
            // Handle legacy full URLs by extracting relative path
            let relativePath = path;
            if (path.startsWith('http')) {
                // Split by bucket name to get relative path
                const parts = path.split('/payment-proofs/');
                if (parts.length > 1) {
                    relativePath = parts[1];
                }
            }

            const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(relativePath, 60); // 60 seconds valid
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error) {
            console.error("Error creating signed URL:", error);
            toast({
                title: "Gagal membuka bukti",
                description: "Pastikan file ada dan Anda memiliki akses.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Approval Langganan</h1>
                <Button variant="outline" onClick={fetchInvoices} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Langganan ({invoices.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {invoices.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Tidak ada permintaan langganan pending.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Tgl Request</TableHead>
                                        <TableHead>Nama Toko</TableHead>
                                        <TableHead>Email Owner</TableHead>
                                        <TableHead>Paket</TableHead>
                                        <TableHead>Total Bayar</TableHead>
                                        <TableHead>Bukti</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell>
                                                <Badge variant={inv.status === 'approved' ? 'success' : inv.status === 'pending' ? 'outline' : 'destructive'}
                                                    className={inv.status === 'approved' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                                                    {inv.status === 'approved' ? 'Aktif' : 'Pending'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {new Date(inv.created_at).toLocaleDateString('id-ID', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </TableCell>
                                            <TableCell className="font-medium">{inv.stores?.name || 'Unknown'}</TableCell>
                                            <TableCell>{inv.stores?.email || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={inv.plan_id === 'enterprise' ? 'default' : 'secondary'}>
                                                    {inv.plan_id.toUpperCase()} ({inv.duration_months} Bln)
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {/* Calculate total with unique code if needed, but DB stores the final amount? 
                                                    Wait, my schema insert logic in CheckoutDialog puts final amount in 'amount' column.
                                                */}
                                                {formatCurrency(inv.amount)}
                                            </TableCell>
                                            <TableCell>
                                                {inv.proof_url ? (
                                                    <Button variant="ghost" size="sm" onClick={() => viewProof(inv.proof_url)}>
                                                        <ExternalLink className="h-4 w-4 mr-1" /> Lihat
                                                    </Button>
                                                ) : (
                                                    <span className="text-muted-foreground italic">No Proof</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {inv.status === 'pending' ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApprove(inv)}
                                                        disabled={processingId === inv.id}
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        {processingId === inv.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="h-4 w-4 mr-1" /> Setujui
                                                            </>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                                                        <CheckCircle className="h-3 w-3" /> Disetujui
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SubscriptionApproval;
