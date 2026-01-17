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
            // Fetch last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 45); // Fetch a bit more for buffer

            const { data: txList, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('store_id', currentStore.id)
                .gte('date', thirtyDaysAgo.toISOString())
                .order('date', { ascending: true });

            if (error) throw error;

            const dailyMap = {};

            // Aggregate Daily Sales (excluding voided/refunded transactions)
            (txList || []).forEach(data => {
                // Skip voided and refunded transactions
                if (data.status === 'void' || data.status === 'refunded' || data.status === 'cancelled') return;

                const d = new Date(data.date);
                const key = d.toISOString().split('T')[0];
                dailyMap[key] = (dailyMap[key] || 0) + (data.total || 0);
            });

            // Convert to Array & Sort
            const historicalData = Object.entries(dailyMap)
                .map(([date, total]) => ({ date, total }))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            // -- Improved Forecast Logic (Backtesting + Future) --
            const finalChart = [];
            let totalError = 0;
            let errorCount = 0;

            // Requirement: At least 7 days of data recommended for 7-day moving average
            if (historicalData.length > 0) {
                for (let i = 0; i < historicalData.length; i++) {
                    const current = historicalData[i];
                    let historicalPrediction = null;

                    // Calculate 7-day moving average prediction for THIS day
                    // based on previous 7 days.
                    if (i >= 7) {
                        const window = historicalData.slice(i - 7, i);
                        const avg = window.reduce((sum, d) => sum + d.total, 0) / 7;
                        historicalPrediction = Math.round(avg);

                        // Calculate Accuracy Metric (Absolute Percentage Error)
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

                // Generate Future Forecast
                const windowSize = Math.min(historicalData.length, 7);
                let lastDaysValues = historicalData.slice(-windowSize).map(d => d.total);
                let currentAvg = lastDaysValues.reduce((a, b) => a + b, 0) / windowSize;

                // Add Connection Point (Last historical point starts the future line)
                if (finalChart.length > 0) {
                    finalChart[finalChart.length - 1].predicted = finalChart[finalChart.length - 1].actual;
                }

                for (let i = 1; i <= 7; i++) {
                    const lastDate = new Date(finalChart[finalChart.length - 1].date);
                    lastDate.setDate(lastDate.getDate() + 1);
                    const nextDateStr = lastDate.toISOString().split('T')[0];
                    const nextVal = Math.round(currentAvg);

                    finalChart.push({
                        date: nextDateStr,
                        displayDate: new Date(nextDateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                        actual: null,
                        predicted: nextVal,
                        fullHash: nextDateStr + 'pred'
                    });

                    // Sliding window update for multi-step forecast
                    lastDaysValues.shift();
                    lastDaysValues.push(nextVal);
                    currentAvg = lastDaysValues.reduce((a, b) => a + b, 0) / windowSize;
                }
            }

            setChartData(finalChart);

            const futureData = finalChart.filter(d => d.actual === null);
            const totalPred = futureData.reduce((acc, cur) => acc + cur.predicted, 0);

            // Calculate trend
            let pastTotal = 0;
            if (historicalData.length >= 7) {
                pastTotal = historicalData.slice(-7).reduce((a, b) => a + b.total, 0);
            }

            // Accuracy calculation
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

            <div className="grid gap-4 md:grid-cols-3">
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
