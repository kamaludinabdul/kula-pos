import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Wallet, Search, Calendar as CalendarIcon, RefreshCw, AlertCircle, Users, TrendingUp } from 'lucide-react';
import { supabase } from '../../supabase';
import { format, endOfMonth, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useToast } from '../../components/ui/use-toast';
import { InfoCard } from '../../components/ui/info-card';

const PetHotelFeeReport = () => {
    const { activeStoreId, currentStore } = useData();
    const { toast } = useToast();

    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [searchTerm, setSearchTerm] = useState('');
    const [fees, setFees] = useState([]);

    // Config from stores.settings
    const feeConfig = currentStore?.settings?.pet_hotel_fee || {};
    const isFeeEnabled = feeConfig.enabled === true;
    const baseFeePerDay = feeConfig.feePerDay || 0;
    const schedules = feeConfig.schedules || {}; // { "2026-02": { "1": [...], ... } }

    // Get this month's weekly schedule template
    const monthSchedule = schedules[currentMonth] || {};
    const hasSchedule = Object.values(monthSchedule).some(arr => arr && arr.length > 0);

    // --- Fetch existing fees ---
    const fetchFees = useCallback(async () => {
        if (!activeStoreId || !currentMonth || !isFeeEnabled) return;
        setLoading(true);
        try {
            const startDate = `${currentMonth}-01`;
            const endDate = format(endOfMonth(parseISO(startDate)), 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('employee_fees')
                .select('*')
                .eq('store_id', activeStoreId)
                .gte('fee_date', startDate)
                .lte('fee_date', endDate)
                .order('fee_date', { ascending: false });

            if (error) throw error;
            setFees(data || []);
        } catch (error) {
            console.error("Error fetching fees:", error);
            toast({ title: "Gagal memuat fee", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [activeStoreId, currentMonth, isFeeEnabled, toast]);

    useEffect(() => { fetchFees(); }, [fetchFees]);

    // --- AUTO-CALCULATE ENGINE ---
    const handleGenerateFees = async () => {
        if (!activeStoreId || !currentMonth || !isFeeEnabled) return;
        setGenerating(true);

        try {
            const startDate = `${currentMonth}-01`;
            const endDate = format(endOfMonth(parseISO(startDate)), 'yyyy-MM-dd');

            // 1. Fetch rental transactions checked out this month
            const { data: rentals, error: rentError } = await supabase
                .from('transactions')
                .select('id, date, rental_session_id, items, payment_details')
                .eq('store_id', activeStoreId)
                .eq('type', 'rental')
                .gte('date', `${startDate}T00:00:00Z`)
                .lte('date', `${endDate}T23:59:59Z`);

            if (rentError) throw rentError;

            if (!rentals || rentals.length === 0) {
                toast({ title: "Info", description: "Tidak ada transaksi rental di bulan ini." });
                setGenerating(false);
                return;
            }

            // 2. Fetch existing fees to avoid duplicates
            const { data: existingFees, error: extError } = await supabase
                .from('employee_fees')
                .select('transaction_id, fee_date, employee_name')
                .eq('store_id', activeStoreId)
                .gte('fee_date', startDate)
                .lte('fee_date', endDate);

            if (extError) throw extError;

            const processedSet = new Set(
                (existingFees || []).map(f => `${f.transaction_id}_${f.fee_date}_${f.employee_name}`)
            );

            // 3. Calculate fees using MONTHLY schedule template
            const newFeeRecords = [];

            for (const rental of rentals) {
                const startTimeIso = rental.payment_details?.snapshot?.start_time;
                const checkInDate = startTimeIso
                    ? format(parseISO(startTimeIso), 'yyyy-MM-dd')
                    : format(parseISO(rental.date), 'yyyy-MM-dd');
                const checkOutDate = format(parseISO(rental.date), 'yyyy-MM-dd');

                const daysInRental = eachDayOfInterval({
                    start: parseISO(checkInDate),
                    end: parseISO(checkOutDate)
                });

                for (const day of daysInRental) {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dayMonth = format(day, 'yyyy-MM');
                    const dayOfWeek = String(getDay(day)); // 0=Sun, 1=Mon...6=Sat

                    // Lookup the schedule for the month this specific day falls in
                    const dayMonthSchedule = schedules[dayMonth] || {};
                    const shiftsForDay = dayMonthSchedule[dayOfWeek] || [];

                    if (shiftsForDay.length === 0) continue;

                    const feePerPerson = baseFeePerDay / shiftsForDay.length;
                    const isWeekendDay = dayOfWeek === '0' || dayOfWeek === '6';

                    for (const shift of shiftsForDay) {
                        if (!shift.name) continue;

                        const key = `${rental.id}_${dayStr}_${shift.name}`;
                        if (processedSet.has(key)) continue;

                        newFeeRecords.push({
                            store_id: activeStoreId,
                            transaction_id: rental.id,
                            employee_id: '00000000-0000-0000-0000-000000000000',
                            employee_name: shift.name,
                            fee_amount: feePerPerson,
                            fee_date: dayStr,
                            shift_label: shift.shift || 'pagi',
                            is_weekend: isWeekendDay
                        });
                    }
                }
            }

            // 4. Insert
            if (newFeeRecords.length > 0) {
                const { error: insertError } = await supabase.from('employee_fees').insert(newFeeRecords);
                if (insertError) throw insertError;
                toast({ title: "Sukses", description: `${newFeeRecords.length} record fee baru digenerate.` });
                fetchFees();
            } else {
                toast({ title: "Info", description: "Semua fee sudah up-to-date." });
            }
        } catch (error) {
            console.error("Generate error:", error);
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        } finally {
            setGenerating(false);
        }
    };

    // --- Summaries ---
    const summaryByEmployee = useMemo(() => {
        const stats = {};
        fees.forEach(f => {
            const key = f.employee_name;
            if (!stats[key]) stats[key] = { name: key, total_fee: 0, total_days: 0 };
            stats[key].total_fee += Number(f.fee_amount);
            stats[key].total_days += 1;
        });
        return Object.values(stats).sort((a, b) => b.total_fee - a.total_fee);
    }, [fees]);

    const totalFee = summaryByEmployee.reduce((sum, e) => sum + e.total_fee, 0);

    const handleDeleteFee = async (id) => {
        if (!confirm("Hapus record fee ini?")) return;
        try {
            const { error } = await supabase.from('employee_fees').delete().eq('id', id);
            if (error) throw error;
            toast({ title: "Terhapus" });
            setFees(fees.filter(f => f.id !== id));
        } catch (error) {
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        }
    };

    if (!isFeeEnabled) {
        return (
            <div className="p-8 text-center bg-slate-50 border rounded-lg">
                <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold">Fitur Fee Pet Hotel Belum Aktif</h3>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                    Aktifkan di <strong>Pengaturan → Fee Pet Hotel</strong>.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Fee Karyawan Pet Hotel</h2>
                    <p className="text-muted-foreground">Rekap pembagian fee dari transaksi rental bulanan.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} className="w-[180px]" />
                    <Button onClick={handleGenerateFees} disabled={generating || !hasSchedule} className="bg-indigo-600 hover:bg-indigo-700">
                        <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                        Sinkronisasi Fee
                    </Button>
                </div>
            </div>

            {!hasSchedule && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-800">Jadwal bulan {currentMonth} belum diisi.</p>
                        <p className="text-xs text-amber-600 mt-1">Buka Pengaturan → Fee Pet Hotel, navigasi ke bulan ini, dan isi jadwal shift-nya.</p>
                    </div>
                </div>
            )}

            {/* SUMMARY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard
                    title="Total Fee Bulan Ini"
                    value={totalFee}
                    icon={Wallet}
                    variant="primary"
                    isCurrency
                    footer={`${fees.length} record`}
                />
                {summaryByEmployee.map(emp => (
                    <InfoCard
                        key={emp.name}
                        title={emp.name}
                        value={emp.total_fee}
                        icon={Users}
                        variant="default"
                        isCurrency
                        footer={`${emp.total_days} Hari`}
                    />
                ))}
            </div>

            {/* TABLE */}
            <Card className="rounded-xl overflow-hidden border-none shadow-sm">
                <CardHeader className="pb-3 border-b">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Detail Fee</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="text" placeholder="Cari nama..." className="pl-9 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>No. Trx</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Karyawan</TableHead>
                                    <TableHead>Shift</TableHead>
                                    <TableHead>Nominal</TableHead>
                                    <TableHead className="w-[80px]">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell></TableRow>
                                ) : fees.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada fee. Klik <strong>Sinkronisasi Fee</strong>.</TableCell></TableRow>
                                ) : (
                                    fees.filter(f => f.employee_name.toLowerCase().includes(searchTerm.toLowerCase())).map(fee => (
                                        <TableRow key={fee.id}>
                                            <TableCell>
                                                <span className="text-xs font-mono text-slate-500">#{fee.transaction_id || '-'}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-medium text-slate-800">{format(parseISO(fee.fee_date), 'dd MMM yyyy', { locale: localeId })}</span>
                                                {fee.is_weekend && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Weekend</span>}
                                            </TableCell>
                                            <TableCell className="font-medium">{fee.employee_name}</TableCell>
                                            <TableCell className="capitalize">{fee.shift_label}</TableCell>
                                            <TableCell className="font-bold text-green-600">Rp {Number(fee.fee_amount).toLocaleString('id-ID')}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 text-xs" onClick={() => handleDeleteFee(fee.id)}>Hapus</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PetHotelFeeReport;
