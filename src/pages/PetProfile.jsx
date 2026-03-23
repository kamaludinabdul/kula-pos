import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
    Dog, 
    Calendar, 
    Stethoscope, 
    ChevronLeft, 
    User, 
    Phone, 
    Weight, 
    Dna, 
    CalendarDays,
    ArrowUpRight,
    Clock,
    FileText,
    History as HistoryIcon,
    Plus,
    Activity,
    Edit,
    ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../lib/utils';

const PetProfile = () => {
    const { id: petId } = useParams();
    const navigate = useNavigate();
    const { pets, customers, medicalRecords, petBookings, petDailyLogs } = useData();

    const pet = useMemo(() => pets.find(p => p.id === petId), [pets, petId]);
    const customer = useMemo(() => customers.find(c => c.id === pet?.customerId), [customers, pet]);
    
    const records = useMemo(() => 
        medicalRecords.filter(r => r.petId === petId).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [medicalRecords, petId]);

    const bookings = useMemo(() => 
        petBookings.filter(b => b.petId === petId).sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
    [petBookings, petId]);

    const dailyLogs = useMemo(() => 
        petDailyLogs.filter(l => l.petId === petId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [petDailyLogs, petId]);

    if (!pet) {
        return (
            <div className="p-8 flex flex-col items-center justify-center space-y-4">
                <Dog className="h-16 w-16 text-slate-200" />
                <p className="text-slate-500 font-bold">Hewan tidak ditemukan</p>
                <Button onClick={() => navigate('/pets')}>Kembali ke Daftar</Button>
            </div>
        );
    }

    const birthDateStr = pet.birth_date ? format(new Date(pet.birth_date), 'dd MMM yyyy', { locale: id }) : '-';

    return (
        <div className="p-4 space-y-6 max-w-7xl mx-auto">
            {/* Nav Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/pets')} className="text-slate-500 hover:text-slate-900">
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Daftar Hewan
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate('/medical-records')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Buat Rekam Medis
                    </Button>
                    <Button size="sm" onClick={() => navigate('/pet-bookings')}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Atur Booking
                    </Button>
                </div>
            </div>

            {/* Profile Header Card */}
            <Card className="border-none shadow-sm overflow-hidden bg-white">
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600" />
                <CardContent className="px-6 pb-6 -mt-12">
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <div className="h-32 w-32 rounded-3xl bg-white p-1.5 shadow-xl">
                            <div className="h-full w-full rounded-2xl bg-slate-100 flex items-center justify-center">
                                <Dog className="h-16 w-16 text-blue-500 opacity-60" />
                            </div>
                        </div>
                        <div className="flex-1 pb-1">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-black text-slate-900 font-outfit">{pet.name}</h1>
                                <Badge className="bg-blue-50 text-blue-600 border-none px-3 font-bold uppercase tracking-widest text-[10px]">
                                    # {pet.rmNumber || 'RM-XXXX'}
                                </Badge>
                                {pet.isNeutered && (
                                    <Badge className="bg-emerald-50 text-emerald-600 border-none px-3 font-bold text-[10px]">Steril</Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4 mt-2 text-slate-500">
                                <div className="flex items-center gap-1.5 text-sm font-bold">
                                    <Dna className="h-4 w-4 text-blue-400" />
                                    {pet.petType} • {pet.breed || 'Mix Breed'}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm font-bold">
                                    <User className="h-4 w-4 text-slate-400" />
                                    {pet.customerName || 'Tanpa Pemilik'}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm font-bold">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    {customer?.phone || '-'}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left: Info Grid */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-none shadow-sm h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Informasi Dasar</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4" /> Lahir
                                </span>
                                <span className="font-extrabold text-slate-800">{birthDateStr}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold flex items-center gap-2">
                                    <Weight className="h-4 w-4" /> Berat
                                </span>
                                <span className="font-extrabold text-slate-800">{pet.weight} kg</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-bold flex items-center gap-2">
                                    <Activity className="h-4 w-4" /> Vaksin
                                </span>
                                <Badge className={cn("text-[10px] font-bold border-none", pet.isVaccinated ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                                    {pet.isVaccinated ? 'Sudah' : 'Belum'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm h-fit bg-slate-900 text-white">
                        <CardHeader className="pb-3 border-b border-white/10">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-white/40">Catatan Khusus</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <p className="text-sm italic leading-relaxed text-white/80">
                                {pet.specialNeeds || 'Tidak ada catatan khusus untuk hewan ini.'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Tabs Column */}
                <div className="lg:col-span-3">
                    <Tabs defaultValue="medical" className="w-full">
                        <TabsList className="bg-white p-1 h-12 shadow-sm rounded-xl mb-6">
                            <TabsTrigger value="medical" className="flex-1 rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                                <Stethoscope className="h-4 w-4 mr-2" />
                                Rekam Medis ({records.length})
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex-1 rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                                <HistoryIcon className="h-4 w-4 mr-2" />
                                Kunjungan ({bookings.length})
                            </TabsTrigger>
                            <TabsTrigger value="daily" className="flex-1 rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
                                <Activity className="h-4 w-4 mr-2" />
                                Log Harian ({dailyLogs.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="medical" className="mt-0 space-y-4">
                            {records.length === 0 ? (
                                <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100 italic text-slate-400">
                                    Belum ada rekam medis.
                                </div>
                            ) : (
                                records.map(record => (
                                    <Card key={record.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                                        <CardContent className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-rose-50 rounded-xl">
                                                        <FileText className="h-5 w-5 text-rose-500" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-800">{record.diagnosis || 'Pemeriksaan Rutin'}</h4>
                                                        <p className="text-xs font-bold text-slate-400">
                                                            {format(new Date(record.date), 'eeee, dd MMM yyyy', { locale: id })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => navigate('/medical-records')} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Detail <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                            <div className="pl-[52px] space-y-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tindakan & Terapi</span>
                                                    <p className="text-sm text-slate-600 leading-relaxed">{record.treatment || '-'}</p>
                                                </div>
                                                {record.prescriptions?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 pt-2">
                                                        {record.prescriptions.map((p, i) => (
                                                            <Badge key={i} variant="outline" className="text-[10px] h-5 bg-slate-50 border-slate-200">
                                                                {p.product_name} x{p.quantity}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                                    <User className="h-3 w-3" /> Dr. {record.doctorName || '-'}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="mt-0">
                            <Card className="border-none shadow-sm overflow-hidden">
                                <CardContent className="p-0">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Layanan</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {bookings.map(booking => (
                                                <tr key={booking.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-800">{format(new Date(booking.startDate), 'dd MMM yyyy', { locale: id })}</span>
                                                            <span className="text-[10px] text-slate-400 font-medium italic">{booking.serviceType}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 border-none px-3">
                                                            {booking.serviceType === 'hotel' ? 'Pet Hotel' : (booking.serviceName || 'Grooming')}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <Badge className={cn("text-[10px] font-bold border-none capitalize", 
                                                            booking.status === 'confirmed' ? "bg-emerald-50 text-emerald-600" :
                                                            booking.status === 'pending' ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {booking.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => navigate('/pet-bookings')} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <ArrowUpRight className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="daily" className="mt-0">
                            {dailyLogs.length === 0 ? (
                                <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100 italic text-slate-400">
                                    Belum ada log harian.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {dailyLogs.map(log => (
                                        <Card key={log.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                                            <CardContent className="p-5">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-bold text-[10px]">
                                                            {format(new Date(log.created_at), 'dd MMM HH:mm')}
                                                        </Badge>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">by {log.staffName}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-50 mb-3">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Makan</span>
                                                        <span className="text-xs font-black text-slate-700 capitalize">{log.eating}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center border-x border-slate-50">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Mood</span>
                                                        <span className="text-xs font-black text-slate-700 capitalize">{log.mood}</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Bathroom</span>
                                                        <span className="text-xs font-black text-slate-700 capitalize">{log.bathroom}</span>
                                                    </div>
                                                </div>
                                                {log.notes && (
                                                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg border-l-2 border-slate-200">
                                                        "{log.notes}"
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default PetProfile;
