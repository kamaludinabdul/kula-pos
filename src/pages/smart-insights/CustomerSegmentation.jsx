import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader2, Users, Star, UserX, UserPlus, MessageCircle, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { ScrollArea } from '../../components/ui/scroll-area';
import { MessageSquare, ExternalLink, Check, Copy } from 'lucide-react';

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

    // Broadcast State
    const [broadcastOpen, setBroadcastOpen] = useState(false);
    const [selectedSegment, setSelectedSegment] = useState(null); // { name: 'Champions', data: [] }
    const [message, setMessage] = useState('');
    const [greetingType, setGreetingType] = useState('formal'); // formal, casual, personal, custom
    const [clickedCustomers, setClickedCustomers] = useState({}); // { id: true }
    const [customGreetingText, setCustomGreetingText] = useState('');
    const [includeName, setIncludeName] = useState(true);

    const analyzeCustomers = React.useCallback(async () => {
        if (!currentStore?.id || customers.length === 0) return;
        setLoading(true);

        try {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const { data: txList, error } = await supabase
                .from('transactions')
                .select('customer_id,date,total')
                .eq('store_id', currentStore.id)
                .gte('date', sixMonthsAgo.toISOString());

            if (error) throw error;
            const customerStats = {};

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
                    return;
                }

                const daysSinceLast = Math.floor((now - stat.lastDate) / (1000 * 60 * 60 * 24));
                const frequency = stat.count;
                const monetary = stat.total;

                const customerData = { ...cust, ...stat, daysSinceLast };

                if (daysSinceLast > 90) {
                    tempSegments.lost.push(customerData);
                } else if (daysSinceLast > 60) {
                    tempSegments.atRisk.push(customerData);
                } else if (frequency > 5 && monetary > 1000000) {
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

    // Broadcast Handlers
    const openBroadcast = (segmentName, segmentData) => {
        if (segmentData.length === 0) return;
        setSelectedSegment({ name: segmentName, data: segmentData });
        setBroadcastOpen(true);
        setClickedCustomers({});
        // Default message based on segment
        if (segmentName === 'At Risk') {
            setMessage("Kami merindukanmu! Ada promo spesial diskon 10% kalau belanja minggu ini. Yuk mampir lagi!");
        } else if (segmentName === 'Champions') {
            setMessage("Terima kasih sudah jadi pelanggan setia kami! Ini ada voucher khusus buat Kakak.");
        } else {
            setMessage("Halo, ada produk baru nih di toko kami. Cek yuk!");
        }
    };

    const getGreeting = (name) => {
        const hours = new Date().getHours();
        let timeGreeting = "Pagi";
        if (hours >= 10 && hours < 15) timeGreeting = "Siang";
        else if (hours >= 15 && hours < 18) timeGreeting = "Sore";
        else if (hours >= 18) timeGreeting = "Malam";

        if (greetingType === 'formal') return `Selamat ${timeGreeting},`;
        if (greetingType === 'casual') return `Halo Pelanggan Setia,`;
        if (greetingType === 'personal') return `Halo Kak ${name || 'Pelanggan'},`;
        if (greetingType === 'custom') return `${customGreetingText}${includeName ? ' ' + (name || '') : ''},`;
        return "";
    };

    const handleSendWA = (customer) => {
        const greeting = getGreeting(customer.name);
        const fullMessage = `${greeting}\n\n${message}`;
        const encoded = encodeURIComponent(fullMessage);

        let phone = customer.phone;
        if (!phone) return;

        // Format phone (08 -> 628)
        phone = phone.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.substring(1);
        if (phone.startsWith('8')) phone = '62' + phone;

        window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');

        setClickedCustomers(prev => ({ ...prev, [customer.id]: true }));
    };

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

            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                <InfoCard
                    title="Champions"
                    value={segments.champions.length}
                    icon={Star}
                    variant="purple"
                    description="Klik untuk Broadcast"
                    className="cursor-pointer hover:ring-2 hover:ring-purple-200 transition-all hover:-translate-y-1"
                    onClick={() => openBroadcast('Champions', segments.champions)}
                />
                <InfoCard
                    title="Loyal"
                    value={segments.loyal.length}
                    icon={Users}
                    variant="info"
                    description="Klik untuk Broadcast"
                    className="cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all hover:-translate-y-1"
                    onClick={() => openBroadcast('Loyal', segments.loyal)}
                />
                <InfoCard
                    title="New"
                    value={segments.new.length}
                    icon={UserPlus}
                    variant="success"
                    description="Klik untuk Broadcast"
                    className="cursor-pointer hover:ring-2 hover:ring-emerald-200 transition-all hover:-translate-y-1"
                    onClick={() => openBroadcast('New', segments.new)}
                />
                <InfoCard
                    title="At Risk"
                    value={segments.atRisk.length}
                    icon={UserX}
                    variant="warning"
                    description="Klik untuk Broadcast"
                    className="cursor-pointer hover:ring-2 hover:ring-orange-200 transition-all hover:-translate-y-1"
                    onClick={() => openBroadcast('At Risk', segments.atRisk)}
                />
                <InfoCard
                    title="Lost"
                    value={segments.lost.length}
                    icon={UserX}
                    variant="danger"
                    description="Klik untuk Broadcast"
                    className="cursor-pointer hover:ring-2 hover:ring-red-200 transition-all hover:-translate-y-1"
                    onClick={() => openBroadcast('Lost', segments.lost)}
                />
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
                        renderCustomerTable(segments.atRisk)
                    )}
                </CardContent>
            </Card>

            {/* Broadcast Dialog */}
            <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Broadcast WA - {selectedSegment?.name}</DialogTitle>
                        <DialogDescription>
                            Kirim pesan ke {selectedSegment?.data.length} pelanggan di segmen ini.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 px-1">
                        <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="space-y-2">
                                <Label>Pilih Sapaan (Bagian Awal Pesan)</Label>
                                <RadioGroup defaultValue="formal" value={greetingType} onValueChange={setGreetingType} className="flex flex-wrap gap-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="formal" id="r1" />
                                        <Label htmlFor="r1">Formal</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="casual" id="r2" />
                                        <Label htmlFor="r2">Umum</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="personal" id="r3" />
                                        <Label htmlFor="r3">Personal</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="custom" id="r4" />
                                        <Label htmlFor="r4">Custom</Label>
                                    </div>
                                </RadioGroup>

                                {greetingType === 'custom' && (
                                    <div className="mt-2 space-y-2">
                                        <Input
                                            placeholder="Contoh: Hai Pwstizen"
                                            value={customGreetingText}
                                            onChange={(e) => setCustomGreetingText(e.target.value)}
                                            className="bg-white"
                                        />
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="includeName"
                                                checked={includeName}
                                                onCheckedChange={setIncludeName}
                                            />
                                            <Label htmlFor="includeName" className="text-sm font-normal cursor-pointer">
                                                Sertakan Nama Pelanggan (misal: Hai Pwstizen Budi,)
                                            </Label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Isi Pesan</Label>
                                <Textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="min-h-[100px] bg-white"
                                    placeholder="Tulis pesan promosi Anda di sini..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    Preview: {getGreeting("Budi")} {message}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Daftar Penerima ({selectedSegment?.data.length})</Label>
                            <div className="border rounded-lg divide-y">
                                {selectedSegment?.data.map((customer, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm flex items-center gap-2">
                                                {customer.name}
                                                {clickedCustomers[customer.id] && <Check className="h-3 w-3 text-green-500" />}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{customer.phone}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant={clickedCustomers[customer.id] ? "outline" : "default"}
                                            className={clickedCustomers[customer.id] ? "text-green-600 border-green-200 bg-green-50" : "bg-green-600 hover:bg-green-700"}
                                            onClick={() => handleSendWA(customer)}
                                        >
                                            {clickedCustomers[customer.id] ? (
                                                <>Opened <ExternalLink className="ml-2 h-3 w-3" /></>
                                            ) : (
                                                <>Kirim WA <MessageSquare className="ml-2 h-3 w-3" /></>
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CustomerSegmentation;
