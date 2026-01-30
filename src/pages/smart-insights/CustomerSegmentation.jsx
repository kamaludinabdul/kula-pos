import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader2, Users, Star, UserX, UserPlus, MessageCircle, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const CustomerSegmentation = () => {
    const { currentStore, customers } = useData();
    const [loading, setLoading] = useState(false);
    const [segments, setSegments] = useState({
        champions: [],
        loyal: [],
        atRisk: [],
        lost: [],
        new: []
    });

    const analyzeCustomers = React.useCallback(async () => {
        if (!currentStore?.id || customers.length === 0) return;
        setLoading(true);

        try {
            // Fetch ALL transactions? Too heavy. 
            // Better: If we have 'lastVisit', 'totalSpend' in customer doc, use that.
            // Assuming customer docs are updated. If not, we might need to agg from transactions (heavy).
            // Let's assume for MVP we fetch transactions but optimize/limit or rely on customer metadata if available.
            // Checking DataContext customers... usually minimal data.
            // Fallback: Fetch transactions for ALL time might be too much.
            // Strategy: Fetch last 6 months transactions, agg by customerId.

            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const { data: txList, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('store_id', currentStore.id)
                .gte('date', sixMonthsAgo.toISOString());

            if (error) throw error;
            const customerStats = {}; // customerId -> { lastDate, count, total }

            (txList || []).forEach(t => {
                if (!t.customer_id || t.customer_id === 'guest') return;

                if (!customerStats[t.customer_id]) {
                    customerStats[t.customer_id] = {
                        lastDate: new Date(t.date),
                        count: 0,
                        total: 0
                    };
                }

                const stat = customerStats[t.customer_id];
                stat.count += 1;
                stat.total += (t.total || 0);
                if (new Date(t.date) > stat.lastDate) {
                    stat.lastDate = new Date(t.date);
                }
            });

            // RFM Logic
            const now = new Date();
            const tempSegments = { champions: [], loyal: [], atRisk: [], lost: [], new: [] };

            customers.forEach(cust => {
                const stat = customerStats[cust.id];
                if (!stat) {
                    // No transactions in last 6 months? -> Lost or Brand New (never bought)
                    // For simplicity, ignore or put in 'Lost'
                    return;
                }

                const daysSinceLast = Math.floor((now - stat.lastDate) / (1000 * 60 * 60 * 24));
                const frequency = stat.count;
                const monetary = stat.total;

                // Scoring (Simplified Rules)
                // Champions: Recent (<30 days), Frequent (>5), High Spender (> avg)
                // Loyal: Recent (<60 days), Frequent (>3)
                // New: Recent (<30 days), Low Freq (1-2)
                // At Risk: Not Recent (60-90 days), Was Frequent
                // Lost: Not Recent (>90 days)

                const customerData = { ...cust, ...stat, daysSinceLast };

                if (daysSinceLast > 90) {
                    tempSegments.lost.push(customerData);
                } else if (daysSinceLast > 60) {
                    tempSegments.atRisk.push(customerData);
                } else if (frequency > 5 && monetary > 1000000) { // Thresholds should be dynamic, but fixed for MVP
                    tempSegments.champions.push(customerData);
                } else if (frequency >= 3) {
                    tempSegments.loyal.push(customerData);
                } else {
                    tempSegments.new.push(customerData);
                }
            });

            setSegments(tempSegments);

        } catch (error) {
            console.error("Error analyzing segments:", error);
        } finally {
            setLoading(false);
        }
    }, [currentStore, customers]);

    useEffect(() => {
        analyzeCustomers();

    }, [analyzeCustomers]);

    const renderCustomerTable = (list) => (
        <div className="border rounded-md mt-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nama Pelanggan</TableHead>
                        <TableHead>Terakhir Belanja</TableHead>
                        <TableHead>Total Belanja (6 Bln)</TableHead>
                        <TableHead className="text-right">Frekuensi</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {list.slice(0, 10).map((c) => (
                        <TableRow key={c.id}>
                            <TableCell className="font-medium">
                                <div>{c.name}</div>
                                <div className="text-xs text-muted-foreground">{c.phone || '-'}</div>
                            </TableCell>
                            <TableCell>
                                {c.daysSinceLast} hari lalu
                            </TableCell>
                            <TableCell>
                                Rp {c.total.toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="text-right">
                                {c.count}x
                            </TableCell>
                            <TableCell className="text-right">
                                <Button size="sm" variant="outline" className="gap-2" onClick={() => window.open(`https://wa.me/${c.phone?.replace(/^0/, '62')}`, '_blank')}>
                                    <MessageCircle className="h-3 w-3" />
                                    Chat WA
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {list.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                Tidak ada pelanggan di segmen ini.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            {list.length > 10 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-slate-50">
                    Menampilkan 10 dari {list.length} pelanggan
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Segmentasi Pelanggan</h1>
                    <p className="text-muted-foreground">
                        Kelompokkan pelanggan berdasarkan perilaku belanja (RFM) untuk pemasaran yang lebih efektif.
                    </p>
                </div>
                <Button variant="outline" onClick={analyzeCustomers} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Analisis
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
                <div className="grid gap-4 md:grid-cols-5">
                    <InfoCard
                        title="Champions"
                        value={segments.champions.length}
                        icon={Star}
                        variant="purple"
                        description="Pelanggan terbaik"
                    />
                    <InfoCard
                        title="Loyal"
                        value={segments.loyal.length}
                        icon={Users}
                        variant="info"
                        description="Rutin belanja"
                    />
                    <InfoCard
                        title="New"
                        value={segments.new.length}
                        icon={UserPlus}
                        variant="success"
                        description="Baru bergabung"
                    />
                    <InfoCard
                        title="At Risk"
                        value={segments.atRisk.length}
                        icon={UserX}
                        variant="warning"
                        description="Mulai jarang"
                    />
                    <InfoCard
                        title="Lost"
                        value={segments.lost.length}
                        icon={UserX}
                        variant="danger"
                        description="Hampir hilang"
                    />
                </div>
            </div>

            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Daftar Pelanggan: At Risk (Perlu Perhatian)</CardTitle>
                    <CardDescription>
                        Mereka yang dulunya sering belanja tapi sudah 2-3 bulan tidak datang.
                        Sapa mereka dengan promo khusus!
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        renderCustomerTable(segments.atRisk, 'atRisk')
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CustomerSegmentation;
