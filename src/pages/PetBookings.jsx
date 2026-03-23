import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, Edit, Trash2, Calendar, Clock, Scissors, Home, Stethoscope, ChevronRight, Heart, XCircle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import Pagination from '../components/Pagination';
import PetBookingFormDialog from '../components/PetBookingFormDialog';
import MedicalRecordFormDialog from '../components/MedicalRecordFormDialog';
import PetDailyLogModal from '../components/PetDailyLogModal';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import BookingPaymentDialog from '../components/BookingPaymentDialog';

const PetBookings = () => {
    const { checkPermission } = useAuth();
    const navigate = useNavigate();
    const { petBookings, pets, customers, petRooms, petServices, addPetBooking, updatePetBooking, deletePetBooking } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDailyLogOpen, setIsDailyLogOpen] = useState(false);
    const [bookingToDelete, setBookingToDelete] = useState(null);
    const [editingBooking, setEditingBooking] = useState(null);
    const [bookingForLog, setBookingForLog] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    // Filter logic
    const filteredBookings = petBookings.filter(booking => {
        const pet = pets.find(p => p.id === booking.petId);
        const customer = customers.find(c => c.id === booking.customerId);
        const matchesSearch = 
            (pet?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (booking.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesTab = activeTab === 'all' || booking.status === activeTab;
        
        return matchesSearch && matchesTab;
    });

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentBookings = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);

    const handleOpenModal = (booking = null) => {
        setEditingBooking(booking);
        setIsModalOpen(true);
    };

    const handleDelete = (booking) => {
        setBookingToDelete(booking);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (bookingToDelete) {
            const result = await deletePetBooking(bookingToDelete.id);
            if (!result.success) {
                setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan saat menghapus data' });
                setIsAlertOpen(true);
            }
            setIsDeleteOpen(false);
            setBookingToDelete(null);
        }
    };

    const getServiceIcon = (type) => {
        switch (type) {
            case 'grooming': return <Scissors className="h-4 w-4 text-blue-500" />;
            case 'hotel': return <Home className="h-4 w-4 text-amber-500" />;
            case 'medical': return <Stethoscope className="h-4 w-4 text-red-500" />;
            default: return <Calendar className="h-4 w-4" />;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'pending': return <Badge variant="outline" className="text-slate-500 border-slate-200">Menunggu</Badge>;
            case 'confirmed': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">Dikonfirmasi</Badge>;
            case 'completed': return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">Selesai</Badge>;
            case 'cancelled': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none">Dibatalkan</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const changeStatus = async (booking, newStatus) => {
        const result = await updatePetBooking(booking.id, { ...booking, status: newStatus });
        console.log("Status change attempt:", { id: booking.id, newStatus, result });
        if (!result.success) {
            setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan saat update status' });
            setIsAlertOpen(true);
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Booking Management</h1>
                    <p className="text-muted-foreground">Jadwalkan dan pantau reservasi layanan hewan peliharaan</p>
                </div>
                {checkPermission('clinic.bookings') && (
                    <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Buat Booking Baru
                    </Button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-0 mb-2">
                <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                    {[
                        { key: 'all', label: 'Semua' },
                        { key: 'pending', label: 'Menunggu' },
                        { key: 'confirmed', label: 'Dikonfirmasi' },
                        { key: 'completed', label: 'Selesai' },
                        { key: 'cancelled', label: 'Dibatalkan' }
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex-1 md:flex-none ${
                                activeTab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari hewan, pemilik..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>
            </div>

            <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Waktu & Jenis</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hewan & Pemilik</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detail Layanan</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Biaya</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentBookings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        Tidak ada booking yang ditemukan
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentBookings.map((booking) => {
                                    const pet = pets.find(p => p.id === booking.petId);
                                    const customer = customers.find(c => c.id === booking.customerId);
                                    const room = petRooms.find(r => r.id === booking.roomId);
                                    const service = petServices.find(s => s.id === booking.serviceId);

                                    return (
                                        <TableRow key={booking.id} className="group">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                        {getServiceIcon(booking.serviceType)}
                                                        <span className="capitalize">{booking.serviceType}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(booking.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                        {booking.serviceType !== 'hotel' && <> • <Clock className="h-3 w-3" /> {booking.startTime}</>}
                                                        {booking.serviceType === 'hotel' && booking.endDate && (
                                                            <>
                                                                <ChevronRight className="h-3 w-3" />
                                                                {new Date(booking.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-blue-600">{pet?.name || 'Unknown Pet'}</span>
                                                    <span className="text-xs text-slate-500">{customer?.name || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col max-w-[200px]">
                                                    <span className="text-sm font-medium">
                                    {booking.serviceType === 'hotel' 
                                        ? `Kamar: ${room?.name || 'Belum dipilih'}` 
                                        : (service?.name || 
                                            <span className="text-slate-400 italic">Layanan belum dipilih</span>
                                        )
                                    }
                                </span>
                                                    {booking.notes && <span className="text-[10px] text-amber-600 truncate italic mt-1">"{booking.notes}"</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-slate-800">
                                                Rp {(booking.totalPrice || 0).toLocaleString('id-ID')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {getStatusBadge(booking.status)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    {booking.status === 'pending' && (
                                                        <>
                                                            <Button variant="ghost" size="sm" className="h-8 px-2 text-blue-600" title="Konfirmasi" onClick={() => changeStatus(booking, 'confirmed')}>
                                                                Konfirmasi
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" title="Batalkan" onClick={() => changeStatus(booking, 'cancelled')}>
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    
                                                    {booking.status === 'confirmed' && (
                                                        <>
                                                            {/* Selesaikan → opens payment dialog */}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-emerald-600 font-semibold"
                                                                title="Bawa ke Kasir"
                                                                onClick={() => {
                                                                    navigate(`/pos?bookingId=${booking.id}`);
                                                                }}
                                                            >
                                                                Bawa ke Kasir
                                                            </Button>

                                                            {booking.serviceType === 'hotel' && (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-pink-500" title="Log Harian" onClick={() => {
                                                                    setBookingForLog({
                                                                        ...booking,
                                                                        petName: pet?.name,
                                                                        roomName: room?.name,
                                                                        customerPhone: customer?.phone
                                                                    });
                                                                    setIsDailyLogOpen(true);
                                                                }}>
                                                                    <Heart className="h-4 w-4" />
                                                                </Button>
                                                            )}

                                                            {booking.serviceType === 'medical' && (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600" title="Rekam Medis" onClick={() => navigate('/medical-records')}>
                                                                    <FileText className="h-4 w-4" />
                                                                </Button>
                                                            )}

                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" title="Edit Booking" onClick={() => handleOpenModal(booking)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>

                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" title="Batalkan" onClick={() => changeStatus(booking, 'cancelled')}>
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}

                                                    {booking.status === 'completed' && (
                                                        <Badge variant="outline" className="text-green-600 border-green-200">Selesai</Badge>
                                                    )}

                                                    {booking.status === 'cancelled' && (
                                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600" onClick={() => changeStatus(booking, 'pending')}>Aktifkan Lagi</Button>
                                                    )}

                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Hapus Permanen" onClick={() => handleDelete(booking)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Pagination
                currentPage={currentPage}
                totalItems={filteredBookings.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            <PetBookingFormDialog
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (data) => {
                    let result;
                    if (editingBooking) {
                        result = await updatePetBooking(editingBooking.id, data);
                    } else {
                        result = await addPetBooking(data);
                    }

                    if (!result.success) {
                        setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan' });
                        setIsAlertOpen(true);
                        throw new Error(result.error);
                    }
                }}
                initialData={editingBooking}
            />

            <PetDailyLogModal 
                isOpen={isDailyLogOpen}
                onClose={() => setIsDailyLogOpen(false)}
                booking={bookingForLog}
            />

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Batalkan/Hapus Booking"
                description={`Apakah Anda yakin ingin menghapus booking ini? Tindakan ini dapat mempengaruhi status kamar.`}
                confirmText="Hapus"
                variant="destructive"
            />

            <AlertDialog
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertData.title}
                message={alertData.message}
            />
        </div>
    );
};

export default PetBookings;
