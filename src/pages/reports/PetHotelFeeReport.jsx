import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Wallet, Search, Calendar as CalendarIcon, RefreshCw, AlertCircle, Users, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
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
    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroup = (trxId) => {
        setExpandedGroups(prev => ({ ...prev, [trxId]: !prev[trxId] }));
    };

    const groupedFees = useMemo(() => {
        const groups = {};
        const filtered = fees.filter(f =>
            f.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.transaction_id && String(f.transaction_id).includes(searchTerm))
        );

        filtered.forEach(fee => {
            const key = fee.transaction_id || fee.id;
            if (!groups[key]) {
                groups[key] = {
                    transaction_id: fee.transaction_id,
                    fee_date: fee.fee_date,
                    total_fee: 0,
                    records: []
                };
            }
            groups[key].records.push(fee);
            groups[key].total_fee += Number(fee.fee_amount);
        });
        return Object.values(groups).sort((a, b) => new Date(b.fee_date) - new Date(a.fee_date));
    }, [fees, searchTerm]);

    // Config from stores.settings
    const feeConfig = currentStore?.settings?.pet_hotel_fee || {};
    const isFeeEnabled = feeConfig.enabled === true;
    const baseFeePerDay = feeConfig.feePerDay || 0;
    const schedules = feeConfig.schedules || {}; // { "2026-02": { "1": [...], ... } }

    // Get this month's weekly schedule template
    const monthSchedule = schedules[currentMonth] || {};

    // Support both old flat format (key '0'-'6') and new format ({template, overrides})
    const isOldFormat = Object.keys(monthSchedule).some(k => !isNaN(k) && k.length === 1);
    const hasSchedule = isOldFormat
        ? Object.values(monthSchedule).some(arr => arr && arr.length > 0)
        : (Object.values(monthSchedule.template || {}).some(arr => arr && arr.length > 0) ||
            Object.keys(monthSchedule.overrides || {}).length > 0);

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
                .is('voided_at', null)
                .gte('date', `${startDate}T00:00:00Z`)
                .lte('date', `${endDate}T23:59:59Z`);

            if (rentError) throw rentError;

            // 1.5 AUTO-CLEANUP: Fetch voided transactions and delete their fees
            const { data: voidedTxs } = await supabase
                .from('transactions')
                .select('id')
                .eq('store_id', activeStoreId)
                .not('voided_at', 'is', null)
                .gte('date', `${startDate}T00:00:00Z`)
                .lte('date', `${endDate}T23:59:59Z`);

            if (voidedTxs && voidedTxs.length > 0) {
                const voidedIds = voidedTxs.map(v => String(v.id));
                const { error: cleanupError } = await supabase
                    .from('employee_fees')
                    .delete()
                    .in('transaction_id', voidedIds)
                    .eq('store_id', activeStoreId);
                
                if (cleanupError) console.error("Error cleaning up voided fees:", cleanupError);
            }

            if (!rentals || rentals.length === 0) {
                toast({ title: "Info", description: "Tidak ada transaksi rental di bulan ini." });
                setGenerating(false);
                return;
            }

            // 2. Fetch existing fees to avoid duplicates
            const { data: existingFees, error: extError } = await supabase
                .from('employee_fees')
                .select('transaction_id, fee_date, employee_name, shift_label')
                .eq('store_id', activeStoreId)
                .gte('fee_date', startDate)
                .lte('fee_date', endDate);

            if (extError) throw extError;

            const processedSet = new Set(
                (existingFees || []).map(f => `${f.transaction_id}_${f.employee_name}_${f.shift_label}`)
            );

            // 3. Calculate fees using MONTHLY schedule template
            const newFeeRecords = [];

            for (const rental of rentals) {
                const startTimeIso = rental.payment_details?.snapshot?.start_time;
                const checkInDate = startTimeIso
                    ? format(parseISO(startTimeIso), 'yyyy-MM-dd')
                    : format(parseISO(rental.date), 'yyyy-MM-dd');
                const checkOutDate = format(parseISO(rental.date), 'yyyy-MM-dd');

                // Find total days paid from items (Hotel category)
                const hotelItem = (rental.items || []).find(item =>
                    item.category === 'Hotel' ||
                    item.name?.toLowerCase().includes('hotel') ||
                    item.category === 'Kamar' ||
                    item.name?.toLowerCase().includes('sewa')
                );
                
                let totalDaysPaid = 1;

                if (hotelItem) {
                    // Cek kuantitas eksplisit
                    if (hotelItem.qty > 1) totalDaysPaid = hotelItem.qty;
                    else if (hotelItem.quantity > 1) totalDaysPaid = hotelItem.quantity;
                    // Ekstrak dari format nama rental POS misal: "Sewa VIP Room (3 Hari)"
                    else {
                        const match = hotelItem.name?.match(/\((\d+)\s+Hari\)/i);
                        if (match) {
                            totalDaysPaid = parseInt(match[1], 10);
                        }
                    }
                }

                // Jangan gunakan calendar days difference karena hewan bisa nginap 3 hari tapi customer didiskon bayar 1 hari
                const totalBudget = totalDaysPaid * baseFeePerDay;

                // ALL calendar days are processed (including check-out day's pagi shift
                // because staff still feeds & checks the pet that morning)
                const daysInRental = eachDayOfInterval({
                    start: parseISO(checkInDate),
                    end: parseISO(checkOutDate)
                });

                // Determine which shift the pet arrived at, based on check-in hour.
                // Shift order: pagi (morning) < sore (afternoon) < malam/full (evening/all-day)
                // On check-in day: skip shifts that are EARLIER than the arrival shift.
                const SHIFT_ORDER = { pagi: 0, sore: 1, malam: 2, full: 3 };
                let checkInShiftRank = 0; // default: pagi (include all)
                if (startTimeIso) {
                    const checkInHour = new Date(startTimeIso).getHours();
                    if (checkInHour >= 18) {
                        checkInShiftRank = SHIFT_ORDER.malam;
                    } else if (checkInHour >= 12) {
                        checkInShiftRank = SHIFT_ORDER.sore;
                    } else {
                        checkInShiftRank = SHIFT_ORDER.pagi;
                    }
                }

                // Pass 1: Collect all valid shifts and calculate total weight
                // Pagi/Sore/Malam = 0.5 Day value. Full = 1.0 Day value.
                const validShiftSlots = [];
                let totalDurationWeights = 0;

                for (const day of daysInRental) {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dayMonth = format(day, 'yyyy-MM');
                    const dayOfWeek = String(getDay(day));
                    const isCheckInDay = dayStr === checkInDate;

                    const dayMonthSchedule = schedules[dayMonth] || {};
                    const isOldFormat = Object.keys(dayMonthSchedule).some(k => !isNaN(k) && k.length === 1);
                    let shiftsForDay = [];

                    if (isOldFormat) {
                        shiftsForDay = dayMonthSchedule[dayOfWeek] || [];
                    } else {
                        const overrides = dayMonthSchedule.overrides || {};
                        const template = dayMonthSchedule.template || {};
                        shiftsForDay = overrides[dayStr] || template[dayOfWeek] || [];
                    }

                    const isWeekendDay = dayOfWeek === '0' || dayOfWeek === '6';
                    let currentDayWeightAccumulated = 0; // NEW: Cap daily weight to 1.0 (max 2 shifts)

                    for (const shift of shiftsForDay) {
                        if (!shift.name) continue;

                        const shiftTypeStr = (shift.shift || 'pagi').toLowerCase();

                        // On check-in day: skip shifts that started before the pet arrived
                        if (isCheckInDay) {
                            // Also need to handle 'full' in SHIFT_ORDER rank check
                            let shiftRank = 0;
                            if (shiftTypeStr.includes('malam')) shiftRank = SHIFT_ORDER.malam;
                            else if (shiftTypeStr.includes('sore') || shiftTypeStr.includes('siang')) shiftRank = SHIFT_ORDER.sore;
                            else if (shiftTypeStr.includes('full')) shiftRank = SHIFT_ORDER.full;
                            else shiftRank = SHIFT_ORDER.pagi;

                            if (shiftRank < checkInShiftRank) continue;
                        }

                        // Enforce MAX 1.0 weight per day (2 shifts max)
                        if (currentDayWeightAccumulated >= 1.0) continue;

                        const requestedWeight = shiftTypeStr.includes('full') ? 1.0 : 0.5;
                        const grantedWeight = Math.min(requestedWeight, 1.0 - currentDayWeightAccumulated);

                        if (grantedWeight > 0) {
                            validShiftSlots.push({
                                employeeName: shift.name,
                                label: `${format(day, 'dd/MM')} - ${shift.shift || 'pagi'}`,
                                isWeekend: isWeekendDay,
                                weight: grantedWeight
                            });
                            
                            totalDurationWeights += grantedWeight;
                            currentDayWeightAccumulated += grantedWeight;
                        }
                    }
                }

                if (validShiftSlots.length === 0 || totalDurationWeights === 0) continue;

                // Pass 2: Calculate fee per weight point.
                // e.g. Budget 50k / 5.0 weights = 10k per 1.0 weight (Full). 5k per 0.5 weight (Pagi/Sore).
                const feePerWeight = totalBudget / totalDurationWeights;

                for (const slot of validShiftSlots) {
                    const feePerSlot = feePerWeight * slot.weight;
                    const key = `${rental.id}_${slot.employeeName}_${slot.label}`;
                    if (processedSet.has(key)) continue;

                    newFeeRecords.push({
                        store_id: activeStoreId,
                        transaction_id: rental.id,
                        employee_id: '00000000-0000-0000-0000-000000000000',
                        employee_name: slot.employeeName,
                        fee_amount: feePerSlot,
                        fee_date: checkOutDate,
                        shift_label: slot.label,
                        is_weekend: slot.isWeekend
                    });
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

    const handleDeleteGroup = async (trxId, records) => {
        if (!confirm(`Hapus semua (${records.length}) record fee untuk Trx #${trxId}?`)) return;
        try {
            const recordIds = records.map(r => r.id);
            const { error } = await supabase.from('employee_fees').delete().in('id', recordIds);
            if (error) throw error;
            toast({ title: "Terhapus", description: "Fee group berhasil dihapus" });
            setFees(fees.filter(f => !recordIds.includes(f.id)));
        } catch (error) {
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        }
    };

    if (!isFeeEnabled) {
        return (
            <div className="p-4 text-center bg-slate-50 border rounded-lg">
                <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold">Fitur Fee Pet Hotel Belum Aktif</h3>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                    Aktifkan di <strong>Pengaturan → Fee Pet Hotel</strong>.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Fee Karyawan Pet Hotel</h1>
                    <p className="text-muted-foreground">Rekap pembagian fee dari transaksi rental bulanan.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)} className="w-[180px] h-9" />
                    <Button size="sm" onClick={handleGenerateFees} disabled={generating || !hasSchedule} className="bg-indigo-600 hover:bg-indigo-700">
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
                                    <TableHead className="w-[40px]"></TableHead>
                                    <TableHead>No. Trx</TableHead>
                                    <TableHead>Tgl Pembayaran</TableHead>
                                    <TableHead>Karyawan (Penerima Fee)</TableHead>
                                    <TableHead>Total Nominal</TableHead>
                                    <TableHead className="w-[100px]">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell></TableRow>
                                ) : fees.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Belum ada fee. Klik <strong>Sinkronisasi Fee</strong>.</TableCell></TableRow>
                                ) : groupedFees.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Pencarian tidak ditemukan.</TableCell></TableRow>
                                ) : (
                                    groupedFees.map(group => {
                                        const groupId = group.transaction_id || group.records[0].id;
                                        return (
                                            <React.Fragment key={groupId}>
                                                <TableRow className="bg-slate-50/50 hover:bg-slate-50 border-b cursor-pointer" onClick={() => toggleGroup(groupId)}>
                                                    <TableCell>
                                                        {expandedGroups[groupId] ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-bold text-slate-800">#{group.transaction_id || '-'}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-medium text-slate-700">{format(parseISO(group.fee_date), 'dd MMM yyyy', { locale: localeId })}</span>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-slate-600">
                                                        {group.records.length} Record Komisi
                                                    </TableCell>
                                                    <TableCell className="font-bold text-green-700">Rp {Number(group.total_fee).toLocaleString('id-ID')}</TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(groupId, group.records); }}>Hapus TRX</Button>
                                                    </TableCell>
                                                </TableRow>
                                                {expandedGroups[groupId] && group.records.map(fee => (
                                                    <TableRow key={fee.id} className="bg-white border-b border-l-4 border-l-indigo-200">
                                                        <TableCell></TableCell>
                                                        <TableCell></TableCell>
                                                        <TableCell></TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-slate-800">{fee.employee_name}</span>
                                                                <span className="text-xs text-slate-500 capitalize">{fee.shift_label} {fee.is_weekend ? '(Weekend)' : ''}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-green-600 font-medium">Rp {Number(fee.fee_amount).toLocaleString('id-ID')}</TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50 h-6 text-[10px]" onClick={() => handleDeleteFee(fee.id)}>Hapus Item</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })
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
