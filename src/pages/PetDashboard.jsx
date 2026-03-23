import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Calendar, Users, Activity, Plus, FileText, ClipboardList, Briefcase, Scissors, Stethoscope, AlertCircle, Syringe, Hotel, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import CalendarView from '../components/CalendarView';
import { isToday, parseISO, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { cn } from '../lib/utils';
import { InfoCard } from '../components/ui/info-card';

const PetDashboard = () => {
    const { 
        pets, 
        petBookings, 
        petRooms, 
        medicalRecords
    } = useData();
    const navigate = useNavigate();

    // Statistics logic
    const stats = useMemo(() => {
        const todayBookings = petBookings.filter(b => isToday(parseISO(b.startDate)));
        const activeHotelGuests = petBookings.filter(b => b.status === 'confirmed' && b.serviceType === 'hotel');
        const availableRooms = petRooms.filter(r => r.status === 'available');
        const todayVisits = medicalRecords.filter(r => isToday(parseISO(r.date))).length;
        
        // Vaccination Reminders (Next 14 days)
        const today = startOfDay(new Date());
        const twoWeeksFromNow = addDays(today, 14);
        const upComingVaccines = medicalRecords
            .filter(r => r.nextVisit && isAfter(parseISO(r.nextVisit), today) && isBefore(parseISO(r.nextVisit), twoWeeksFromNow))
            .sort((a, b) => parseISO(a.nextVisit).getTime() - parseISO(b.nextVisit).getTime());

        // Staff Performance (Count of sessions)
        const staffStats = {};
        medicalRecords.forEach(r => {
            if (r.doctorName) {
                staffStats[r.doctorName] = (staffStats[r.doctorName] || 0) + 1;
            }
        });
        petBookings.forEach(b => {
            if (b.status === 'completed' && b.staffName) {
                staffStats[b.staffName] = (staffStats[b.staffName] || 0) + 1;
            }
        });
        const staffPerformance = Object.entries(staffStats)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
        
        return {
            totalPets: pets.length,
            todayBookings: todayBookings.length,
            activeGuests: activeHotelGuests.length,
            availableRooms: availableRooms.length,
            recentRecords: medicalRecords.slice(0, 5),
            upComingVaccines: upComingVaccines.slice(0, 3),
            staffPerformance,
            todayVisits
        };
    }, [pets, petBookings, petRooms, medicalRecords]);

    // Data for Calendar - need to map pet names and service names
    const calendarBookings = useMemo(() => {
        return petBookings.map(b => {
            const pet = pets.find(p => p.id === b.petId);
            return {
                ...b,
                petName: pet?.name || 'Unknown',
                serviceName: b.serviceType === 'hotel' ? 'Pet Hotel' : (b.serviceName || b.serviceType)
            };
        });
    }, [petBookings, pets]);

    const quickActions = [
        { label: 'Booking Baru', icon: Plus, path: '/pet-bookings', color: 'bg-blue-600' },
        { label: 'Tambah Hewan', icon: Users, path: '/pets', color: 'bg-emerald-600' },
        { label: 'Rekam Medis', icon: FileText, path: '/medical-records', color: 'bg-rose-600' },
        { label: 'Kelola Kamar', icon: Hotel, path: '/pet-rooms', color: 'bg-amber-600' },
    ];

    return (
        <div className="p-4 space-y-6 bg-slate-50/30 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-outfit">Pet Care Dashboard</h1>
                    <p className="text-slate-500 text-sm">Overview operasional pet shop & klinik.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => navigate('/pet-bookings')} className="flex-1 sm:flex-none">
                        <Calendar className="h-4 w-4 mr-2" />
                        Semua Booking
                    </Button>
                    <Button size="sm" onClick={() => navigate('/pet-bookings')} className="flex-1 sm:flex-none">
                        <Plus className="h-4 w-4 mr-2" />
                        Booking Baru
                    </Button>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-outfit">
                <InfoCard
                    title="Total Hewan"
                    value={stats.totalPets}
                    icon={Users}
                    variant="info"
                    className="border-l-4 border-blue-500"
                />

                <InfoCard
                    title="Booking Hari Ini"
                    value={stats.todayBookings}
                    icon={Calendar}
                    variant="warning"
                    className="border-l-4 border-amber-500"
                    description="Hari Ini"
                />

                <InfoCard
                    title="Kunjungan Hari Ini"
                    value={stats.todayVisits}
                    icon={ClipboardList}
                    variant="info"
                    className="border-l-4 border-blue-500"
                    description="Hari Ini"
                />

                <InfoCard
                    title="Tamu Menginap"
                    value={stats.activeGuests}
                    icon={Hotel}
                    variant="success"
                    className="border-l-4 border-emerald-500"
                    description="Aktif"
                />

                <InfoCard
                    title="Kamar Kosong"
                    value={stats.availableRooms}
                    icon={Hotel}
                    variant="danger"
                    className="border-l-4 border-rose-500"
                    description="Tersedia"
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Main Calendar Section */}
                <div className="xl:col-span-2 flex flex-col h-[700px]">
                    <CalendarView 
                        bookings={calendarBookings} 
                        onSelectBooking={() => navigate('/pet-bookings')}
                    />
                </div>

                {/* Sidebar Section */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <Card className="border-none shadow-sm border-l-4 border-slate-400">
                        <CardHeader className="pb-3 border-b border-slate-50">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Aksi Cepat</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 grid grid-cols-2 gap-3">
                            {quickActions.map(action => (
                                <Button 
                                    key={action.label}
                                    variant="outline" 
                                    className="h-auto py-4 flex flex-col gap-2 bg-white hover:bg-slate-50 border-slate-100 shadow-sm transition-all hover:-translate-y-0.5"
                                    onClick={() => navigate(action.path)}
                                >
                                    <div className={cn("p-2 rounded-lg text-white", action.color)}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">{action.label}</span>
                                </Button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Vaccination Reminders */}
                    <Card className="border-none shadow-sm bg-indigo-900 text-white overflow-hidden border-l-4 border-indigo-400">
                        <CardHeader className="pb-3 border-white/10">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-2">
                                <Syringe className="h-4 w-4" />
                                Pengingat Vaksin
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {stats.upComingVaccines.length === 0 ? (
                                <div className="p-6 text-center text-indigo-300/50">
                                    <p className="text-xs italic">Tidak ada jadwal vaksin terdekat.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {stats.upComingVaccines.map(rec => {
                                        const pet = pets.find(p => p.id === rec.petId);
                                        return (
                                            <div key={rec.id} className="p-4 hover:bg-white/5 transition-colors">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="text-sm font-bold">{pet?.name || 'Pasien'}</h4>
                                                        <p className="text-[10px] text-indigo-300 mt-0.5">Vaksin/Kontrol Rutin</p>
                                                    </div>
                                                    <Badge className="bg-indigo-500/30 text-white border-indigo-400/30">
                                                        {new Date(rec.nextVisit).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Staff Performance Preview */}
                    <Card className="border-none shadow-sm border-l-4 border-amber-400">
                        <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-amber-500" />
                                Performa Staff
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {stats.staffPerformance.length === 0 ? (
                                <p className="text-xs text-center text-slate-400 py-4">Belum ada data performa.</p>
                            ) : (
                                stats.staffPerformance.map((s, idx) => (
                                    <div key={s.name} className="flex flex-col gap-1.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-slate-700">{s.name}</span>
                                            <span className="font-black text-blue-600">{s.count} Sesi</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className={cn(
                                                    "h-full rounded-full",
                                                    idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-emerald-500" : "bg-slate-400"
                                                )} 
                                                style={{ width: `${(s.count / stats.staffPerformance[0].count) * 100}%` }} 
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Medical Records */}
                    <Card className="border-none shadow-sm border-l-4 border-blue-400">
                        <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Rekam Medis Terbaru</CardTitle>
                            <Link to="/medical-records" className="text-xs font-bold text-blue-600 hover:underline">Lihat Semua</Link>
                        </CardHeader>
                        <CardContent className="p-0">
                            {stats.recentRecords.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs">Belum ada rekam medis.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {stats.recentRecords.map(record => {
                                        const pet = pets.find(p => p.id === record.petId);
                                        return (
                                            <div key={record.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate('/medical-records')}>
                                                <div className="p-2 bg-rose-50 rounded-lg shrink-0">
                                                    <Stethoscope className="h-4 w-4 text-rose-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-bold text-slate-800 truncate">{pet?.name || 'Unknown'}</h4>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            {new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{record.diagnosis || 'Pemeriksaan rutin'}</p>
                                                    <div className="flex items-center gap-1 mt-2">
                                                        <Badge variant="outline" className="text-[10px] h-4 py-0 border-slate-200">
                                                            Dr. {record.doctorName?.split(' ')[0] || '-'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default PetDashboard;
