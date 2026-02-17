import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const SalesForecast = () => {
    const { currentStore } = useData();
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState([]);
    const [prediction, setPrediction] = useState({ nextWeekTotal: 0, trend: 'stable' });

    const fetchAndForecast = async () => {
        if (!currentStore?.id) return;
        setLoading(true);
        try {
            // 1. Setup Date Range (Last 45 days to TODAY)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const startDate = new Date(today);
            startDate.setDate(today.getDate() - 45);

            // Fetch transactions
            const { data: txList, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('store_id', currentStore.id)
                .gte('date', startDate.toISOString())
                .order('date', { ascending: true });

            if (error) throw error;

            // 2. Aggregate Sales by Date (Use Local Date to match user's day)
            const dailyMap = {};
            (txList || []).forEach(data => {
                if (data.status === 'void' || data.status === 'refunded' || data.status === 'cancelled') return;
                // Use en-CA for YYYY-MM-DD format in local time
                const dateKey = new Date(data.date).toLocaleDateString('en-CA');
                dailyMap[dateKey] = (dailyMap[dateKey] || 0) + (data.total || 0);
            });

            // 3. Generate Continuous Timeline (Fill Gaps with 0)
            const historicalData = [];
            // Iterate from startDate up to TODAY
            for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                // Use en-CA to match the key format
                const dateStr = d.toLocaleDateString('en-CA');
                historicalData.push({
                    date: dateStr,
                    total: dailyMap[dateStr] || 0
                });
            }

            // 4. Calculate Historical Forecast & Error (Backtesting)
            const finalChart = [];
            let totalError = 0;
            let errorCount = 0;

            for (let i = 0; i < historicalData.length; i++) {
                const current = historicalData[i];
                let historicalPrediction = null;

                // 7-day Simple Moving Average
                if (i >= 7) {
                    const window = historicalData.slice(i - 7, i);
                    const avg = window.reduce((sum, d) => sum + d.total, 0) / 7;
                    historicalPrediction = Math.round(avg);

                    // Error Calculation (MAPE) - Only if actual > 0
                    if (current.total > 0) {
                        const error = Math.abs(current.total - historicalPrediction) / current.total;
                        totalError += error;
                        errorCount++;
                    }
                }

                finalChart.push({
                    date: current.date,
                    displayDate: new Date(current.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                    actual: current.total,
                    predicted: historicalPrediction,
                    fullHash: current.date + 'act'
                });
            }

            // 5. Generate Future Forecast (Next 7 Days starting form Tomorrow)
            // Use last 7 days of KNOWN data (up to today) for the first prediction
            const windowSize = 7;
            // Get last 7 days of actuals/zeros
            let lastDaysValues = historicalData.slice(-windowSize).map(d => d.total);
            // If we don't have enough data yet, pad with 0
            while (lastDaysValues.length < windowSize) lastDaysValues.unshift(0);

            let currentAvg = lastDaysValues.reduce((a, b) => a + b, 0) / windowSize;

            // Connect lines: Set "predicted" for Today to match "actual" (visual continuity)
            if (finalChart.length > 0) {
                const lastPoint = finalChart[finalChart.length - 1]; // This is Today
                lastPoint.predicted = lastPoint.predicted || lastPoint.actual; // Ensure it has a value
            }

            for (let i = 1; i <= 7; i++) {
                const nextDate = new Date(today);
                nextDate.setDate(today.getDate() + i);
                // Use en-CA for local date string
                const nextDateStr = nextDate.toLocaleDateString('en-CA');
                const nextVal = Math.round(currentAvg);

                finalChart.push({
                    date: nextDateStr,
                    displayDate: new Date(nextDateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                    actual: null,
                    predicted: nextVal,
                    fullHash: nextDateStr + 'pred'
                });

                // Update sliding window
                lastDaysValues.shift();
                lastDaysValues.push(nextVal);
                currentAvg = lastDaysValues.reduce((a, b) => a + b, 0) / windowSize;
            }

            setChartData(finalChart);

            // 6. Calculate Summaries
            const futureData = finalChart.filter(d => d.actual === null);
            const totalPred = futureData.reduce((acc, cur) => acc + cur.predicted, 0);

            // Trend: Compare next 7 days sum vs last 7 days sum
            let pastTotal = 0;
            if (historicalData.length >= 7) {
                pastTotal = historicalData.slice(-7).reduce((a, b) => a + b.total, 0);
            }

            const accuracy = errorCount > 0 ? Math.max(0, 100 - (totalError / errorCount * 100)) : 0;

            setPrediction({
                nextWeekTotal: totalPred,
                trend: totalPred >= pastTotal ? 'up' : 'down',
                accuracy: Math.round(accuracy)
            });

        } catch (error) {
            console.error("Error forecasting:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAndForecast();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStore?.id]);

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Prediksi Omset</h1>
                <p className="text-muted-foreground">
                    Perkiraan penjualan 7 hari ke depan berdasarkan tren data historis.
                </p>
            </div>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Prediksi Omset 7 Hari Kedepan</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            Rp {prediction.nextWeekTotal.toLocaleString('id-ID')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Berdasarkan tren penjualan {chartData.filter(d => d.actual !== null).length} hari terakhir
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Akurasi Prediksi</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {prediction.accuracy}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tingkat kecocokan data historis vs prediksi
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tren</CardTitle>
                        {prediction.trend === 'up' ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">
                            {prediction.trend === 'up' ? 'Meningkat' : 'Menurun'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Dibandingkan 7 hari terakhir
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Grafik Forecast vs Aktual</CardTitle>
                    <CardDescription>
                        Bandingkan data <span className="text-indigo-500 font-bold">aktual (ungu)</span> dengan
                        <span className="text-orange-500 font-bold"> prediksi (oranye)</span> untuk memvalidasi akurasi AI.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="displayDate" />
                                <YAxis
                                    tickFormatter={(val) =>
                                        new Intl.NumberFormat('id-ID', { notation: "compact" }).format(val)
                                    }
                                />
                                <CartesianGrid strokeDasharray="3 3" />
                                <Tooltip
                                    formatter={(value, name) => [
                                        `Rp ${value.toLocaleString('id-ID')}`,
                                        name
                                    ]}
                                    labelFormatter={(label) => `Tanggal: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#8884d8"
                                    fillOpacity={0.6}
                                    fill="url(#colorValue)"
                                    name="Aktual"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="predicted"
                                    stroke="#f97316"
                                    fillOpacity={0.4}
                                    fill="url(#colorPred)"
                                    name="Prediksi"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SalesForecast;
