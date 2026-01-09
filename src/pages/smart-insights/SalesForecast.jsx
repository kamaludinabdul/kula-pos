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

            // -- Simple Moving Average (SMA) Forecast Logic --
            const filledData = [...historicalData];
            const futureData = [];

            // Requirement: At least 1 day of data to predict
            if (historicalData.length > 0) {
                // Determine window size based on available data (max 7)
                const windowSize = Math.min(historicalData.length, 7);
                let lastDaysValues = historicalData.slice(-windowSize).map(d => d.total);

                // Calculate initial average
                let currentAvg = lastDaysValues.reduce((a, b) => a + b, 0) / windowSize;

                // Add "Connection Point" - Last actual data point is also the start of prediction line
                // This prevents a gap in the chart

                for (let i = 1; i <= 7; i++) {
                    const lastDate = new Date(filledData[filledData.length - 1].date);
                    lastDate.setDate(lastDate.getDate() + 1);
                    const nextDateStr = lastDate.toISOString().split('T')[0];

                    // Naive forecast with slight variance to look realistic (MVP)
                    // If we just use flat avg, it looks broken. Let's add tiny random noise or trend
                    const nextVal = Math.round(currentAvg);

                    const futurePoint = {
                        date: nextDateStr,
                        predicted: nextVal,
                        isPrediction: true
                    };

                    futureData.push(futurePoint);
                    filledData.push(futurePoint); // Add to filled for next iteration date calculation

                    // Sliding window update
                    lastDaysValues.shift();
                    lastDaysValues.push(nextVal);
                    currentAvg = lastDaysValues.reduce((a, b) => a + b, 0) / windowSize;
                }
            }

            // Combine for Chart with DISTINCT keys for Actual vs Predicted
            const finalChart = [];

            // 1. Add Historical Data (actual = value, predicted = null)
            historicalData.forEach(d => {
                finalChart.push({
                    date: d.date,
                    displayDate: new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                    actual: d.total,
                    predicted: null, // No prediction overlay on past
                    fullHash: d.date + 'act'
                });
            });

            // 2. Add Connection Point (Optional: If we want overlap at the seam)
            // Ideally re-add the last actual point as the first predicted point for continuity
            if (historicalData.length > 0 && futureData.length > 0) {
                const lastH = historicalData[historicalData.length - 1];
                // Modify the last entry in finalChart to ALSO have a start for prediction?
                // Or add a new entry with same date? No, Recharts handles same-category unique key poorly sometimes.
                // Better: The last historical point should have 'predicted' = actual value to start the line
                finalChart[finalChart.length - 1].predicted = lastH.total;
            }

            // 3. Add Future Data (actual = null, predicted = value)
            futureData.forEach(d => {
                finalChart.push({
                    date: d.date,
                    displayDate: new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                    actual: null,
                    predicted: d.predicted,
                    fullHash: d.date + 'pred'
                });
            });

            setChartData(finalChart);

            const totalPred = futureData.reduce((acc, cur) => acc + cur.predicted, 0);

            // Calculate trend safely
            let pastTotal = 0;
            if (historicalData.length > 0) {
                const window = Math.min(historicalData.length, 7);
                pastTotal = historicalData.slice(-window).reduce((a, b) => a + b.total, 0);
                // Normalize to 7 days if less data
                if (window < 7) {
                    pastTotal = (pastTotal / window) * 7;
                }
            }

            setPrediction({
                nextWeekTotal: totalPred,
                trend: totalPred >= pastTotal ? 'up' : 'down'
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

            <div className="grid gap-4 md:grid-cols-2">
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
                    <CardTitle>Grafik Forecast Penjualan</CardTitle>
                    <CardDescription>
                        Area <span className="text-indigo-500 font-bold">ungu</span> adalah data aktual,
                        Area <span className="text-orange-500 font-bold">oranye</span> adalah prediksi AI.
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
                                        name === 'actual' ? 'Aktual' : 'Prediksi'
                                    ]}
                                    labelFormatter={(label) => `Tanggal: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="actual"
                                    stroke="#8884d8"
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                    name="actual"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="predicted"
                                    stroke="#f97316"
                                    fillOpacity={1}
                                    fill="url(#colorPred)"
                                    name="predicted"
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
