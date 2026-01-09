import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { CloudRain, Sun, Cloud, MapPin, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const SalesForecast = () => {
    const { activeStoreId, currentStore } = useData();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [forecastData, setForecastData] = useState([]);
    const [weatherForecast, setWeatherForecast] = useState([]);
    const [insights, setInsights] = useState([]);

    useEffect(() => {
        const fetchDataAndForecast = async () => {
            if (!activeStoreId || !currentStore || !currentStore.latitude || !currentStore.longitude) {
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // 1. Fetch Historical Sales (Last 90 Days - needed for 60 days backtest + 30 days rolling avg)
                const today = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 90);

                const { data: transactionsData, error: txError } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('store_id', activeStoreId)
                    .gte('date', startDate.toISOString())
                    .lte('date', today.toISOString())
                    .order('date', { ascending: true });

                if (txError) throw txError;

                const transactions = (transactionsData || []).map(tx => ({
                    ...tx,
                    date: new Date(tx.date)
                }));

                // Aggregate Daily Sales
                const dailySales = {};
                // Initialize last 90 days with 0
                for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().split('T')[0];
                    dailySales[dateStr] = 0;
                }

                transactions.forEach(tx => {
                    const dateStr = tx.date.toISOString().split('T')[0];
                    if (dailySales[dateStr] !== undefined) {
                        dailySales[dateStr] += (tx.total || 0);
                    }
                });

                const allDates = Object.keys(dailySales).sort();

                // Helper to get avg sales for previous 30 days relative to a specific date
                const getAvgSalesBefore = (targetDateStr) => {
                    const targetIdx = allDates.indexOf(targetDateStr);
                    if (targetIdx < 30) return 0; // Not enough data for a 30-day average

                    let sum = 0;
                    for (let i = targetIdx - 30; i < targetIdx; i++) {
                        sum += dailySales[allDates[i]];
                    }
                    return sum / 30;
                };

                // 2. Fetch Historical Weather (Last 60 Days) for Backtesting
                const historyStartDate = new Date();
                historyStartDate.setDate(historyStartDate.getDate() - 60);
                const historyEndDate = new Date();
                historyEndDate.setDate(historyEndDate.getDate() - 1); // Until yesterday

                const historyUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${currentStore.latitude}&longitude=${currentStore.longitude}&start_date=${historyStartDate.toISOString().split('T')[0]}&end_date=${historyEndDate.toISOString().split('T')[0]}&daily=temperature_2m_max,precipitation_sum,weather_code&timezone=auto`;

                const historyRes = await fetch(historyUrl);
                const historyJson = await historyRes.json();

                let historicalWeatherMap = {};
                if (historyJson.daily) {
                    historyJson.daily.time.forEach((time, i) => {
                        historicalWeatherMap[time] = {
                            tempMax: historyJson.daily.temperature_2m_max[i],
                            rain: historyJson.daily.precipitation_sum[i],
                            code: historyJson.daily.weather_code[i]
                        };
                    });
                }

                // 3. Fetch Future Weather Forecast (Next 14 Days)
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${currentStore.latitude}&longitude=${currentStore.longitude}&daily=temperature_2m_max,precipitation_sum,weather_code&timezone=auto&forecast_days=14`;
                const weatherRes = await fetch(weatherUrl);
                const weatherJson = await weatherRes.json();

                if (!weatherJson.daily) {
                    throw new Error("Gagal mengambil data cuaca.");
                }

                const weatherDaily = weatherJson.daily;
                const next14DaysWeather = weatherDaily.time.map((time, index) => ({
                    date: time,
                    tempMax: weatherDaily.temperature_2m_max[index],
                    rain: weatherDaily.precipitation_sum[index],
                    code: weatherDaily.weather_code[index]
                }));

                setWeatherForecast(next14DaysWeather);

                // 4. Build Combined Data for Chart
                // We want to show the last 60 days (Actual vs Predicted) + Next 14 days (Predicted only)

                const chartData = [];

                // A. Backtesting (Last 60 Days)
                const backtestStartDate = new Date();
                backtestStartDate.setDate(backtestStartDate.getDate() - 60);

                for (let d = new Date(backtestStartDate); d < today; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toISOString().split('T')[0];
                    const actual = dailySales[dateStr];
                    const baseAvg = getAvgSalesBefore(dateStr);
                    const weather = historicalWeatherMap[dateStr];

                    let predicted = baseAvg;
                    let weatherImpact = 1.0;

                    if (weather) {
                        if (weather.rain > 5) weatherImpact = 0.8;
                        else if (weather.tempMax > 32) weatherImpact = 1.1;
                        else if (weather.code <= 3) weatherImpact = 1.05;

                        const dayOfWeek = new Date(dateStr).getDay();
                        if (dayOfWeek === 0 || dayOfWeek === 6) weatherImpact *= 1.2;
                    }

                    predicted *= weatherImpact;

                    chartData.push({
                        date: dateStr,
                        actualSales: actual,
                        predictedSales: Math.round(predicted),
                        type: 'historical'
                    });
                }

                // B. Future Forecast (Next 14 Days)
                // Base avg for future is the avg of the MOST RECENT 30 days (ending yesterday)
                const currentBaseAvg = getAvgSalesBefore(today.toISOString().split('T')[0]);

                next14DaysWeather.forEach(w => {
                    let predicted = currentBaseAvg;
                    let weatherImpact = 1.0;

                    if (w.rain > 5) weatherImpact = 0.8;
                    else if (w.tempMax > 32) weatherImpact = 1.1;
                    else if (w.code <= 3) weatherImpact = 1.05;

                    const dayOfWeek = new Date(w.date).getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) weatherImpact *= 1.2;

                    predicted *= weatherImpact;

                    chartData.push({
                        date: w.date,
                        actualSales: null, // No actual data for future
                        predictedSales: Math.round(predicted),
                        type: 'forecast',
                        weather: w
                    });
                });

                setForecastData(chartData);

                // Generate Insights
                const newInsights = [];
                const rainyDays = next14DaysWeather.filter(w => w.rain > 5).length;
                if (rainyDays > 3) {
                    newInsights.push({
                        type: 'warning',
                        message: `Terdeteksi ${rainyDays} hari hujan dalam 2 minggu ke depan. Pertimbangkan stok payung atau layanan pesan antar.`
                    });
                }

                const hotDays = next14DaysWeather.filter(w => w.tempMax > 33).length;
                if (hotDays > 3) {
                    newInsights.push({
                        type: 'opportunity',
                        message: `Cuaca panas terdeteksi (${hotDays} hari > 33°C). Tingkatkan stok minuman dingin.`
                    });
                }

                const totalForecastSales = chartData.filter(d => d.type === 'forecast').reduce((sum, p) => sum + p.predictedSales, 0);
                newInsights.push({
                    type: 'info',
                    message: `Estimasi total penjualan 14 hari ke depan: Rp ${totalForecastSales.toLocaleString('id-ID')}`
                });

                setInsights(newInsights);

            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (activeStoreId && currentStore) {
            fetchDataAndForecast();
        }
    }, [activeStoreId, currentStore]);

    const getWeatherIcon = (code) => {
        if (code <= 3) return <Sun className="h-6 w-6 text-yellow-500" />;
        if (code >= 51 && code <= 67) return <CloudRain className="h-6 w-6 text-blue-500" />;
        if (code >= 95) return <AlertTriangle className="h-6 w-6 text-red-500" />;
        return <Cloud className="h-6 w-6 text-gray-500" />;
    };

    if (loading) {
        return <div className="p-8 text-center">Memuat data forecasting...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    }

    if (!currentStore?.latitude || !currentStore?.longitude) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                <MapPin className="h-16 w-16 text-muted-foreground opacity-50" />
                <h2 className="text-2xl font-bold">Lokasi Toko Belum Diatur</h2>
                <p className="text-muted-foreground max-w-md">
                    Untuk menggunakan fitur peramalan penjualan berbasis cuaca, mohon atur lokasi (Latitude & Longitude) toko Anda terlebih dahulu di menu Pengaturan.
                </p>
                <Link to="/settings/profile">
                    <Button>
                        Atur Lokasi Toko
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <TrendingUp className="h-8 w-8 text-blue-600" />
                    Peramalan Penjualan (Forecasting)
                </h1>
                <p className="text-muted-foreground mt-1">
                    Prediksi penjualan 14 hari ke depan berdasarkan data historis dan prakiraan cuaca.
                </p>
            </header>

            {/* Insights Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {insights.map((insight, idx) => (
                    <Alert key={idx} className={`${insight.type === 'warning' ? 'border-orange-200 bg-orange-50' : insight.type === 'opportunity' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                        {insight.type === 'warning' ? <CloudRain className="h-4 w-4" /> : insight.type === 'opportunity' ? <Sun className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                        <AlertTitle className="capitalize">{insight.type === 'opportunity' ? 'Peluang' : insight.type === 'warning' ? 'Perhatian' : 'Info'}</AlertTitle>
                        <AlertDescription>
                            {insight.message}
                        </AlertDescription>
                    </Alert>
                ))}
            </div>

            {/* Main Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Analisis Akurasi & Prediksi Penjualan</CardTitle>
                    <CardDescription>
                        Bandingkan data penjualan aktual dengan hasil prediksi AI (Backtesting) untuk melihat akurasi, serta estimasi penjualan ke depan.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str) => {
                                    const d = new Date(str);
                                    return `${d.getDate()}/${d.getMonth() + 1}`;
                                }}
                                minTickGap={30}
                            />
                            <YAxis tickFormatter={(val) => `Rp ${(val / 1000).toFixed(0)}k`} />
                            <Tooltip
                                labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white p-3 border rounded shadow-lg text-sm">
                                                <p className="font-bold mb-2">{new Date(label).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                                {payload.map((entry, index) => (
                                                    <div key={index} className="flex items-center gap-2 mb-1">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                                        <span className="capitalize">{entry.name}:</span>
                                                        <span className="font-mono font-bold">Rp {entry.value.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                                {payload.length === 2 && (
                                                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                                                        Selisih: Rp {Math.abs(payload[0].value - payload[1].value).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="actualSales"
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorActual)"
                                name="Aktual"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="predictedSales"
                                stroke="#8b5cf6"
                                fillOpacity={0.6}
                                fill="url(#colorPredicted)"
                                name="Prediksi (AI)"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Weather Forecast Cards */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Prakiraan Cuaca & Dampak
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {weatherForecast.slice(0, 7).map((day, idx) => (
                        <Card key={idx} className="text-center hover:shadow-md transition-shadow">
                            <CardContent className="p-4 flex flex-col items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                    {new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })}
                                </span>
                                {getWeatherIcon(day.code)}
                                <div className="text-sm font-bold">
                                    {day.tempMax}°C
                                </div>
                                {day.rain > 0 && (
                                    <div className="text-xs text-blue-600 flex items-center gap-1">
                                        <CloudRain className="h-3 w-3" />
                                        {day.rain}mm
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SalesForecast;
