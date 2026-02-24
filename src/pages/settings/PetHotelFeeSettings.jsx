import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Wallet, Users, CalendarDays, Plus, Trash2, Save, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';
import { format, subMonths, addMonths } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const DAYS_OF_WEEK = [
    { value: '1', label: 'Senin' },
    { value: '2', label: 'Selasa' },
    { value: '3', label: 'Rabu' },
    { value: '4', label: 'Kamis' },
    { value: '5', label: 'Jumat' },
    { value: '6', label: 'Sabtu' },
    { value: '0', label: 'Minggu' },
];

const EMPTY_WEEK = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '0': [] };

const PetHotelFeeSettings = () => {
    const { currentStore, updateStoreSettings } = useData();
    const { toast } = useToast();

    const [saving, setSaving] = useState(false);

    // Core config
    const [enabled, setEnabled] = useState(false);
    const [feePerDay, setFeePerDay] = useState(10000);
    const [staffList, setStaffList] = useState([]);
    const [schedules, setSchedules] = useState({}); // { "2026-02": {weeklySchedule}, "2026-03": {weeklySchedule} }

    // UI state
    const [newStaffName, setNewStaffName] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

    useEffect(() => {
        if (currentStore?.settings?.pet_hotel_fee) {
            const c = currentStore.settings.pet_hotel_fee;
            setEnabled(c.enabled || false);
            setFeePerDay(c.feePerDay || 10000);
            setStaffList(c.staffList || []);
            setSchedules(c.schedules || {});
        }
    }, [currentStore]);

    // Current month's schedule
    const currentSchedule = useMemo(() => {
        return schedules[selectedMonth] || { ...EMPTY_WEEK };
    }, [schedules, selectedMonth]);

    const updateCurrentSchedule = (newWeek) => {
        setSchedules(prev => ({ ...prev, [selectedMonth]: newWeek }));
    };

    // --- Save ---
    const handleSave = async () => {
        setSaving(true);
        try {
            await updateStoreSettings({
                pet_hotel_fee: { enabled, feePerDay, staffList, schedules }
            });
            toast({ title: "Tersimpan", description: "Pengaturan Fee Pet Hotel berhasil disimpan." });
        } catch (err) {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    // --- Staff ---
    const handleAddStaff = () => {
        const name = newStaffName.trim();
        if (!name) return;
        if (staffList.includes(name)) {
            toast({ title: "Duplikat", description: "Nama sudah ada.", variant: "destructive" });
            return;
        }
        setStaffList([...staffList, name]);
        setNewStaffName('');
    };

    const handleRemoveStaff = (nameToRemove) => {
        setStaffList(staffList.filter(n => n !== nameToRemove));
    };

    // --- Schedule per Day ---
    const addShift = (dayValue) => {
        const updated = { ...currentSchedule };
        updated[dayValue] = [...(updated[dayValue] || []), { name: '', shift: 'pagi' }];
        updateCurrentSchedule(updated);
    };

    const removeShift = (dayValue, index) => {
        const updated = { ...currentSchedule };
        const arr = [...(updated[dayValue] || [])];
        arr.splice(index, 1);
        updated[dayValue] = arr;
        updateCurrentSchedule(updated);
    };

    const updateShift = (dayValue, index, field, value) => {
        const updated = { ...currentSchedule };
        const arr = [...(updated[dayValue] || [])];
        arr[index] = { ...arr[index], [field]: value };
        updated[dayValue] = arr;
        updateCurrentSchedule(updated);
    };

    // --- Month Navigation ---
    const navigateMonth = (direction) => {
        const current = new Date(selectedMonth + '-01');
        const next = direction === 'prev' ? subMonths(current, 1) : addMonths(current, 1);
        setSelectedMonth(format(next, 'yyyy-MM'));
    };

    const monthLabel = useMemo(() => {
        try {
            return format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: localeId });
        } catch { return selectedMonth; }
    }, [selectedMonth]);

    // --- Copy from previous month ---
    const handleCopyPrevMonth = () => {
        const prev = format(subMonths(new Date(selectedMonth + '-01'), 1), 'yyyy-MM');
        const prevSchedule = schedules[prev];
        if (!prevSchedule || Object.values(prevSchedule).every(arr => arr.length === 0)) {
            toast({ title: "Kosong", description: `Jadwal bulan sebelumnya (${prev}) belum diisi.`, variant: "destructive" });
            return;
        }
        // Deep copy
        const copied = JSON.parse(JSON.stringify(prevSchedule));
        updateCurrentSchedule(copied);
        toast({ title: "Tersalin", description: `Jadwal ${prev} disalin ke ${selectedMonth}.` });
    };

    // --- Copy Monday to Tue-Fri ---
    const handleCopyWeekday = () => {
        const mon = currentSchedule['1'] || [];
        if (mon.length === 0) {
            toast({ title: "Kosong", description: "Senin belum ada shift.", variant: "destructive" });
            return;
        }
        const copied = JSON.parse(JSON.stringify(mon));
        const updated = { ...currentSchedule };
        ['2', '3', '4', '5'].forEach(d => { updated[d] = JSON.parse(JSON.stringify(copied)); });
        updateCurrentSchedule(updated);
        toast({ title: "Tersalin", description: "Jadwal Senin disalin ke Selasa - Jumat." });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Otomasi Fee Pet Hotel</h2>
                <p className="text-muted-foreground">Atur staf, nominal fee, dan jadwal shift bulanan.</p>
            </div>

            {/* CONFIG */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-indigo-600" />Pengaturan Dasar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="enable-fee" className="flex flex-col space-y-1">
                            <span className="text-base font-semibold">Aktifkan Hitung Fee Otomatis</span>
                            <span className="font-normal text-xs text-muted-foreground">Fee dihitung otomatis saat sinkronisasi di halaman Laporan.</span>
                        </Label>
                        <Switch id="enable-fee" checked={enabled} onCheckedChange={setEnabled} />
                    </div>
                    <div className="space-y-2 max-w-sm">
                        <Label>Total Fee Karyawan Per Hari (Rp)</Label>
                        <Input type="number" value={feePerDay} onChange={e => setFeePerDay(parseFloat(e.target.value) || 0)} disabled={!enabled} />
                        <p className="text-[11px] text-muted-foreground">Dibagi rata sesuai jumlah shift per hari.</p>
                    </div>
                </CardContent>
            </Card>

            {enabled && (
                <>
                    {/* STAFF LIST */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-indigo-600" />Daftar Staff Pet Hotel</CardTitle>
                            <CardDescription>Nama karyawan (tidak perlu punya akun login).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2 mb-4 max-w-md">
                                <Input
                                    placeholder="Ketik Nama Staff..."
                                    value={newStaffName}
                                    onChange={e => setNewStaffName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddStaff(); } }}
                                />
                                <Button onClick={handleAddStaff} type="button" variant="secondary">Tambah</Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {staffList.length === 0 && <span className="text-sm text-slate-400 italic">Belum ada staff...</span>}
                                {staffList.map(name => (
                                    <div key={name} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-800 px-3 py-1.5 rounded-full text-sm font-medium">
                                        {name}
                                        <button onClick={() => handleRemoveStaff(name)} className="text-indigo-400 hover:text-red-500 transition-colors ml-1" title="Hapus">
                                            <XIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* MONTHLY SCHEDULE */}
                    <Card>
                        <CardHeader className="border-b">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <CalendarDays className="h-5 w-5 text-indigo-600" />
                                        Jadwal Shift Bulanan
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Set pola mingguan untuk setiap bulan. Anda bisa set beberapa bulan ke depan.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                                    <span className="text-sm font-semibold w-36 text-center capitalize">{monthLabel}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')}><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <Button variant="outline" size="sm" onClick={handleCopyPrevMonth}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy Bulan Lalu</Button>
                                <Button variant="outline" size="sm" onClick={handleCopyWeekday}>Salin Senin → Sel-Jum</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {staffList.length === 0 ? (
                                <div className="text-center p-6 bg-amber-50 rounded-lg text-amber-600 text-sm">
                                    Isi Daftar Staff terlebih dahulu.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {DAYS_OF_WEEK.map(({ value: dayVal, label: dayLabel }) => {
                                        const shifts = currentSchedule[dayVal] || [];
                                        const isWeekend = dayVal === '6' || dayVal === '0';
                                        return (
                                            <div key={dayVal} className={`p-4 rounded-lg border flex flex-col md:flex-row gap-4 items-start ${isWeekend ? 'bg-red-50/30 border-red-100' : 'bg-white'}`}>
                                                <div className="w-24 shrink-0 pt-1.5">
                                                    <span className={`font-semibold ${isWeekend ? 'text-red-700' : 'text-slate-700'}`}>{dayLabel}</span>
                                                    <div className="text-[10px] text-muted-foreground mt-0.5">{shifts.length} shift</div>
                                                </div>
                                                <div className="flex-1 w-full space-y-2">
                                                    {shifts.length === 0 ? (
                                                        <div className="text-xs text-slate-400 py-2 italic">Libur / Belum diisi.</div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {shifts.map((shift, idx) => (
                                                                <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border p-1 rounded-md min-w-[200px]">
                                                                    <Select value={shift.name} onValueChange={val => updateShift(dayVal, idx, 'name', val)}>
                                                                        <SelectTrigger className="h-8 text-xs border-0 bg-transparent flex-1 shadow-none"><SelectValue placeholder="Pilih Staf" /></SelectTrigger>
                                                                        <SelectContent>{staffList.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                                                    </Select>
                                                                    <Select value={shift.shift} onValueChange={val => updateShift(dayVal, idx, 'shift', val)}>
                                                                        <SelectTrigger className="h-8 text-[11px] w-20 border-0 bg-transparent shadow-none text-muted-foreground font-medium"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="pagi">Pagi</SelectItem>
                                                                            <SelectItem value="siang">Siang</SelectItem>
                                                                            <SelectItem value="full">Full</SelectItem>
                                                                            <SelectItem value="malam">Malam</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <button onClick={() => removeShift(dayVal, idx)} className="h-7 w-7 flex items-center justify-center text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button variant="ghost" size="sm" className="shrink-0 h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => addShift(dayVal)}>
                                                    <Plus className="w-3.5 h-3.5 mr-1" />Shift
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            <div className="flex justify-end pt-4 pb-12">
                <Button size="lg" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
                </Button>
            </div>
        </div>
    );
};

const XIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

export default PetHotelFeeSettings;
