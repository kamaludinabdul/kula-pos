import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { getSmartBundlingSuggestions } from '../../utils/ai';
import { hasFeatureAccess } from '../../utils/plans';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Sparkles, TrendingUp, Lock, ShoppingBag, Lightbulb, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MarketBasketAnalysis = () => {
    const { currentStore, products } = useData();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [bundles, setBundles] = useState([]);
    const [analyzedCount, setAnalyzedCount] = useState(0);
    const [aiBundles, setAiBundles] = useState({}); // key -> { name, tip, reason }

    const userPlan = currentStore?.owner?.plan || 'free';
    const hasAiAccess = hasFeatureAccess(userPlan, 'features.ai_bundling');
    const hasApiKey = Boolean(currentStore?.settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY);

    // AI Logic: Simple Association Rule Mining
    const analyzeBundles = React.useCallback(async () => {
        if (!currentStore?.id) return;
        setLoading(true);
        try {
            // Fetch last 300 completed transactions for speed
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('store_id', currentStore.id)
                .eq('status', 'completed')
                .order('date', { ascending: false })
                .limit(300);

            if (error) throw error;
            setAnalyzedCount(transactions?.length || 0);

            // Frequency Counting
            const pairCounts = {}; // "idA|idB" -> count

            transactions.forEach(t => {
                if (!t.items || t.items.length < 2) return;

                // Getting unique product IDs in this transaction to avoid self-pairs if item scanned twice
                const uniqueItems = [...new Set(t.items.map(i => i.id || i.productId))];

                for (let i = 0; i < uniqueItems.length; i++) {
                    for (let j = i + 1; j < uniqueItems.length; j++) {
                        const idA = uniqueItems[i];
                        const idB = uniqueItems[j];

                        // Sort IDs to ensure A|B is same as B|A
                        const key = [idA, idB].sort().join('|');
                        pairCounts[key] = (pairCounts[key] || 0) + 1;
                    }
                }
            });

            // Convert to Array & Enrich with Product Names
            const results = Object.entries(pairCounts)
                .map(([key, count]) => {
                    const [idA, idB] = key.split('|');
                    const productA = products.find(p => p.id === idA);
                    const productB = products.find(p => p.id === idB);

                    if (!productA || !productB) return null;

                    return {
                        id: key,
                        productA,
                        productB,
                        count,
                        score: count // Simple frequency score
                    };
                })
                .filter(Boolean)
                .sort((a, b) => b.count - a.count)
                .slice(0, 10); // Top 10 Bundles

            setBundles(results);

            // 4. Fetch AI Suggestions (Enterprise Only)
            if (hasAiAccess && import.meta.env.VITE_GEMINI_API_KEY && results.length > 0) {
                try {
                    const suggestions = await getSmartBundlingSuggestions(results.map(r => ({
                        itemA: r.productA.name,
                        itemB: r.productB.name,
                        id: r.id
                    })), currentStore.settings?.geminiApiKey);

                    const aiMap = {};
                    suggestions.forEach(s => {
                        aiMap[s.id] = s;
                    });
                    setAiBundles(aiMap);
                } catch (aiErr) {
                    console.error("AI Bundling failed:", aiErr);
                }
            }

        } catch (error) {
            console.error("Error analyzing bundles:", error);
        } finally {
            setLoading(false);
        }
    }, [currentStore, products, hasAiAccess]);

    useEffect(() => {
        analyzeBundles();

    }, [analyzeBundles]);

    return (
        <div className="space-y-6 p-6">
            {!hasAiAccess && (
                <Alert className="bg-indigo-50 border-indigo-100">
                    <Lock className="h-4 w-4 text-indigo-600" />
                    <AlertTitle className="text-indigo-900 font-bold">Fitur Enterprise</AlertTitle>
                    <AlertDescription className="text-indigo-700 text-xs">
                        Upgrade ke **Enterprise** untuk mendapatkan saran nama paket (bundling) dan tip marketing otomatis dari AI Gemini.
                        <Button variant="link" size="sm" className="h-auto p-0 ml-1 font-bold text-indigo-600" onClick={() => window.location.href = '/settings/plan'}>Upgrade Sekarang</Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bundling Pintar</h1>
                    <p className="text-muted-foreground">
                        Analisis keranjang belanja untuk menemukan peluang paket produk (bundling).
                    </p>
                </div>
                <Button variant="outline" onClick={analyzeBundles} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Analisis
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <InfoCard
                    title="Transaksi Dianalisis"
                    value={analyzedCount}
                    icon={ShoppingBag}
                    description="Transaksi terakhir"
                    variant="primary"
                />
                <InfoCard
                    title="Peluang Bundling"
                    value={bundles.length}
                    icon={Lightbulb}
                    description="Kombinasi potensial"
                    variant="warning"
                />
            </div>

            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Rekomendasi Paket Bundling (Top 10)</CardTitle>
                    <CardDescription>
                        Produk-produk ini sering dibeli bersamaan oleh pelanggan Anda.
                        Cobalah jual sebagai paket dengan sedikit diskon untuk meningkatkan omset.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : bundles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Belum cukup data untuk menemukan pola bundling.
                        </div>
                    ) : hasAiAccess && !hasApiKey ? (
                        <div className="py-8 text-center space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-50 text-orange-600">
                                <ShieldAlert className="h-8 w-8" />
                            </div>
                            <div className="max-w-xs mx-auto space-y-2">
                                <h3 className="font-bold text-lg">API Key Belum Diatur</h3>
                                <p className="text-sm text-slate-500">
                                    Silakan atur Gemini API Key Anda di Pengaturan Umum untuk mendapatkan rekomendasi AI.
                                </p>
                                <Button className="mt-4 bg-orange-600 hover:bg-orange-700" onClick={() => navigate('/settings')}>
                                    Buka Pengaturan
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Produk A</TableHead>
                                        <TableHead></TableHead>
                                        <TableHead>Produk B</TableHead>
                                        <TableHead className="text-right">Frekuensi</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bundles.map((bundle) => (
                                        <TableRow key={bundle.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {bundle.productA.image && (
                                                        <img src={bundle.productA.image} alt="" className="h-8 w-8 rounded object-cover" />
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span>{bundle.productA.name}</span>
                                                        {hasAiAccess && aiBundles[bundle.id] && (
                                                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md w-fit italic mt-1">
                                                                {aiBundles[bundle.id].name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {bundle.productB.image && (
                                                        <img src={bundle.productB.image} alt="" className="h-8 w-8 rounded object-cover" />
                                                    )}
                                                    {bundle.productB.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <Badge variant="secondary">
                                                        {bundle.count}x Bersamaan
                                                    </Badge>
                                                    {hasAiAccess && aiBundles[bundle.id] && (
                                                        <div className="text-[10px] text-slate-500 italic flex items-center gap-1">
                                                            <Sparkles size={10} className="text-purple-500" />
                                                            {aiBundles[bundle.id].tip}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2"
                                                    onClick={() => window.location.href = `/promotions/new?type=bundle&items=${bundle.productA.id},${bundle.productB.id}`}
                                                >
                                                    <Tag className="h-3 w-3" />
                                                    Buat Promo
                                                </Button>
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

export default MarketBasketAnalysis;
