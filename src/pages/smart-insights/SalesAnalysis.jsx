
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { TrendingUp, TrendingDown, Minus, BrainCircuit, AlertCircle, CheckCircle2, History } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getSalesPerformanceAnalysis } from '../../utils/ai';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const SalesAnalysis = () => {
    const { user } = useAuth();
    const { currentStore } = useData();
    const [loading, setLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);
    const [currentYearData, setCurrentYearData] = useState([]);
    const [lastYearData, setLastYearData] = useState([]);
    const [aiInsight, setAiInsight] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [analysisMode, setAnalysisMode] = useState('yearly'); // 'yearly' | 'monthly'
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

    const lastYear = selectedYear - 1;

    // Attempt to load from database when filters change
    useEffect(() => {
        const fetchInsight = async () => {
            if (!currentStore?.id) return;

            setAiInsight(''); // Reset visually
            const periodMonth = analysisMode === 'monthly' ? selectedMonth : -1;

            try {
                const { supabase } = await import('../../supabase');
                const { data } = await supabase
                    .from('ai_insights')
                    .select('insight_text')
                    .eq('store_id', currentStore.id)
                    .eq('period_type', analysisMode)
                    .eq('period_year', selectedYear)
                    .eq('period_month', periodMonth)
                    .maybeSingle();

                if (data && data.insight_text) {
                    setAiInsight(data.insight_text);
                }
            } catch (err) {
                console.error("Error fetching AI insight from DB:", err);
            }
        };

        fetchInsight();
    }, [currentStore?.id, selectedYear, selectedMonth, analysisMode]);

    useEffect(() => {
        const fetchComparisonData = async () => {
            if (!currentStore?.id) return;
            setLoading(true);
            try {
                const { safeSupabaseRpc } = await import('../../utils/supabaseHelper');

                // Fetch Current Year
                const currentRes = await safeSupabaseRpc({
                    rpcName: 'get_dashboard_monthly_summary',
                    params: { p_store_id: currentStore.id, p_year: selectedYear }
                });

                // Fetch Last Year
                const lastRes = await safeSupabaseRpc({
                    rpcName: 'get_dashboard_monthly_summary',
                    params: { p_store_id: currentStore.id, p_year: lastYear }
                });

                if (currentRes) setCurrentYearData(currentRes);
                if (lastRes) setLastYearData(lastRes);

            } catch (error) {
                console.error("SalesAnalysis: Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchComparisonData();
    }, [currentStore?.id, selectedYear, lastYear]);

    const stats = useMemo(() => {
        const calculateGrowth = (curr, prev) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        if (analysisMode === 'yearly') {
            const calculateTotal = (data, key) => data.reduce((sum, m) => sum + (Number(m[key]) || 0), 0);
            const currRev = calculateTotal(currentYearData, 'totalRevenue');
            const lastRev = calculateTotal(lastYearData, 'totalRevenue');
            const currProfit = calculateTotal(currentYearData, 'totalNetProfit');
            const lastProfit = calculateTotal(lastYearData, 'totalNetProfit');
            const currOps = calculateTotal(currentYearData, 'totalOpEx');
            const lastOps = calculateTotal(lastYearData, 'totalOpEx');

            return {
                revenue: { val: currRev, growth: calculateGrowth(currRev, lastRev) },
                profit: { val: currProfit, growth: calculateGrowth(currProfit, lastProfit) },
                opex: { val: currOps, growth: calculateGrowth(currOps, lastOps) }
            };
        } else {
            // Monthly Mode
            const currMonthData = currentYearData.find(m => m.monthIndex === selectedMonth) || {};
            const prevMonthData = selectedMonth === 0
                ? lastYearData.find(m => m.monthIndex === 11) || {}
                : currentYearData.find(m => m.monthIndex === selectedMonth - 1) || {};

            const currRev = Number(currMonthData.totalRevenue) || 0;
            const prevRev = Number(prevMonthData.totalRevenue) || 0;
            const currProfit = Number(currMonthData.totalNetProfit) || 0;
            const prevProfit = Number(prevMonthData.totalNetProfit) || 0;
            const currOps = Number(currMonthData.totalOpEx) || 0;
            const prevOps = Number(prevMonthData.totalOpEx) || 0;

            return {
                revenue: { val: currRev, growth: calculateGrowth(currRev, prevRev) },
                profit: { val: currProfit, growth: calculateGrowth(currProfit, prevProfit) },
                opex: { val: currOps, growth: calculateGrowth(currOps, prevOps) }
            };
        }
    }, [currentYearData, lastYearData, analysisMode, selectedMonth]);

    const chartData = useMemo(() => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

        if (analysisMode === 'yearly') {
            return monthNames.map((name, i) => ({
                name,
                current: currentYearData.find(m => m.monthIndex === i)?.totalRevenue || 0,
                last: lastYearData.find(m => m.monthIndex === i)?.totalRevenue || 0
            }));
        } else {
            // Monthly Mode
            // For a simple MoM chart we could perhaps show daily data, but our RPC currently 
            // only returns monthly aggregates (get_dashboard_monthly_summary).
            // So we will just show a bar/line chart of the current month vs previous month vs same month last year.
            const currMonthData = currentYearData.find(m => m.monthIndex === selectedMonth) || {};
            const prevMonthData = selectedMonth === 0
                ? lastYearData.find(m => m.monthIndex === 11) || {}
                : currentYearData.find(m => m.monthIndex === selectedMonth - 1) || {};
            const sameMonthLastYearData = lastYearData.find(m => m.monthIndex === selectedMonth) || {};

            return [
                {
                    name: `Bulan Sama (${lastYear})`,
                    revenue: sameMonthLastYearData.totalRevenue || 0
                },
                {
                    name: `Bulan Sebelumnya`,
                    revenue: prevMonthData.totalRevenue || 0
                },
                {
                    name: `Bulan Ini (${selectedYear})`,
                    revenue: currMonthData.totalRevenue || 0
                }
            ];
        }
    }, [currentYearData, lastYearData, analysisMode, selectedMonth, selectedYear, lastYear]);

    const handleGenerateAI = async () => {
        setAiLoading(true);
        try {
            let dataToSend = {};
            let isMonthly = analysisMode === 'monthly';

            if (isMonthly) {
                const currMonthData = currentYearData.find(m => m.monthIndex === selectedMonth) || {};
                const prevMonthData = selectedMonth === 0
                    ? lastYearData.find(m => m.monthIndex === 11) || {}
                    : currentYearData.find(m => m.monthIndex === selectedMonth - 1) || {};
                const sameMonthLastYearData = lastYearData.find(m => m.monthIndex === selectedMonth) || {};

                dataToSend = {
                    currentYear: currMonthData,
                    lastYear: { "Bulan Sebelumnya (MoM)": prevMonthData, "Bulan Sama Tahun Lalu (YoY)": sameMonthLastYearData }
                };
            } else {
                dataToSend = {
                    currentYear: currentYearData,
                    lastYear: lastYearData
                };
            }

            const insight = await getSalesPerformanceAnalysis(dataToSend, isMonthly, user?.settings?.gemini_api_key);

            // Save to Database
            if (currentStore?.id && insight) {
                try {
                    const { supabase } = await import('../../supabase');
                    await supabase.from('ai_insights').upsert({
                        store_id: currentStore.id,
                        period_type: analysisMode,
                        period_year: selectedYear,
                        period_month: isMonthly ? selectedMonth : -1,
                        insight_text: insight,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'store_id, period_type, period_year, period_month' });
                } catch (dbErr) {
                    console.error("Failed to save AI insight to DB:", dbErr);
                }
            }

            setAiInsight(insight);
        } catch (err) {
            console.error("SalesAnalysis AI Error:", err);
            setAiInsight("Gagal memanggil AI. Periksa koneksi Anda.");
        } finally {
            setAiLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Menganalisis data lintas tahun...</div>;

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Performa & Analisis AI</h3>
                    <p className="text-sm text-slate-500">
                        {analysisMode === 'yearly' ? 'Bandingkan performa tahun ini dengan tahun sebelumnya.' : 'Bandingkan performa bulan ini dengan bulan sebelumnya.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={analysisMode} onValueChange={(v) => { setAnalysisMode(v); }}>
                        <SelectTrigger className="w-[120px] bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yearly">Tahunan</SelectItem>
                            <SelectItem value="monthly">Bulanan</SelectItem>
                        </SelectContent>
                    </Select>

                    {analysisMode === 'monthly' && (
                        <Select value={selectedMonth.toString()} onValueChange={(v) => { setSelectedMonth(Number(v)); }}>
                            <SelectTrigger className="w-[140px] bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                                    <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Select value={selectedYear.toString()} onValueChange={(v) => { setSelectedYear(Number(v)); }}>
                        <SelectTrigger className="w-[100px] bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[2024, 2025, 2026].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Growth Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GrowthCard title="Total Omset" value={stats.revenue.val} growth={stats.revenue.growth} />
                <GrowthCard title="Laba Bersih" value={stats.profit.val} growth={stats.profit.growth} />
                <GrowthCard title="Biaya Operasional" value={stats.opex.val} growth={stats.opex.growth} inverse color="rose" />
            </div>

            {/* Chart Comparison */}
            <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <History className="w-4 h-4" /> {analysisMode === 'yearly' ? 'Perbandingan Omset (Tahun Ini vs Lalu)' : 'Perbandingan Omset Bulanan (MoM & YoY)'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            {analysisMode === 'yearly' ? (
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} tick={{ fill: '#64748b' }} />
                                    <Tooltip />
                                    <Legend verticalAlign="top" height={36} />
                                    <Line type="monotone" dataKey="current" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} name={`Tahun ${selectedYear}`} />
                                    <Line type="monotone" dataKey="last" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 3 }} name={`Tahun ${lastYear}`} />
                                </LineChart>
                            ) : (
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} tick={{ fill: '#64748b' }} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} dot={{ r: 6 }} name={`Total Omset`} />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* AI Analysis Section */}
            <Card className="border-2 border-indigo-50 bg-indigo-50/30 overflow-hidden">
                <CardContent className="p-0">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-600 rounded-lg text-white">
                                    <BrainCircuit className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">Business Insight AI</h4>
                                    <p className="text-xs text-slate-500">Analisis anomali, pola transaksi, dan saran strategis.</p>
                                </div>
                            </div>
                            {!aiInsight && !aiLoading && (
                                <button
                                    onClick={handleGenerateAI}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-sm"
                                >
                                    Analisis Sekarang
                                </button>
                            )}
                        </div>

                        {aiLoading ? (
                            <div className="flex flex-col items-center py-10 gap-3">
                                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm font-medium text-slate-600">AI sedang mempelajari pola bisnis Anda...</p>
                            </div>
                        ) : aiInsight ? (
                            <div className="prose prose-slate prose-sm max-w-none">
                                <div className="text-slate-700 bg-white p-6 rounded-xl border border-indigo-100 shadow-sm leading-relaxed text-sm">
                                    {renderMarkdown(aiInsight)}
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={() => setAiInsight('')}
                                        className="text-xs text-indigo-600 font-bold hover:underline"
                                    >
                                        Ulangi Analisis
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-white/50 rounded-xl border border-dashed border-indigo-200">
                                <p className="text-sm text-slate-500 px-4">
                                    Klik tombol untuk memulai analisis mendalam mengenai keamanan bisnis,
                                    kejanggalan data, dan saran peningkatan profit.
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const GrowthCard = ({ title, value, growth, inverse = false }) => {
    const isGrowthPositive = growth > 0;
    const isGood = inverse ? !isGrowthPositive : isGrowthPositive;

    return (
        <Card className="border-none shadow-sm">
            <CardContent className="p-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
                <div className="flex items-end justify-between">
                    <div>
                        <h4 className="text-2xl font-black text-slate-800">
                            Rp {value.toLocaleString('id-ID')}
                        </h4>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full ${growth === 0 ? 'bg-slate-100 text-slate-600' :
                        isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                        {growth === 0 ? <Minus className="w-3 h-3" /> :
                            isGrowthPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(growth).toFixed(1)}%
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// --- Lightweight Markdown Parser ---
// Handles headers (###), bold (**text**), and bullet lists (-)
const renderMarkdown = (text) => {
    if (!text) return null;

    const parseInline = (line, lineIdx) => {
        // Split by ** to find bold parts
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return React.createElement('strong', { key: `bold-${lineIdx}-${i}`, className: 'font-bold text-slate-900' }, part.slice(2, -2));
            }
            // Parse remaining inline elements if needed, for now just text
            return part;
        });
    };

    const lines = text.split('\n');
    let inList = false;
    let listItems = [];
    const elements = [];

    const flushList = () => {
        if (inList && listItems.length > 0) {
            elements.push(React.createElement('ul', { key: `list-${elements.length}`, className: 'list-disc pl-5 mb-3 space-y-1' }, [...listItems]));
            listItems = [];
            inList = false;
        }
    };

    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // Empty lines
        if (trimmed === '') {
            flushList();
            elements.push(React.createElement('div', { key: i, className: 'h-2' }));
            return;
        }

        // Headers
        if (trimmed.startsWith('### ')) {
            flushList();
            elements.push(React.createElement('h3', { key: i, className: 'text-base font-bold text-slate-800 mt-5 mb-2' }, parseInline(trimmed.substring(4), i)));
            return;
        }
        if (trimmed.startsWith('#### ')) {
            flushList();
            elements.push(React.createElement('h4', { key: i, className: 'text-sm font-bold text-slate-800 mt-4 mb-1' }, parseInline(trimmed.substring(5), i)));
            return;
        }

        // List items
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            inList = true;
            listItems.push(React.createElement('li', { key: i, className: 'text-slate-700' }, parseInline(trimmed.substring(2), i)));
            return;
        }

        // If it's not a list item but we were in a list, flush it
        flushList();

        // Regular text
        // If the line starts with a number like "1. " or "2. " (Ordered lists)
        if (/^\d+\.\s/.test(trimmed)) {
            elements.push(React.createElement('div', { key: i, className: 'pl-2 mb-2' }, parseInline(trimmed, i)));
        } else {
            elements.push(React.createElement('p', { key: i, className: 'mb-2' }, parseInline(trimmed, i)));
        }
    });

    flushList(); // Final flush in case the text ends with a list

    return elements;
};

export default SalesAnalysis;
