import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, Edit, Trash2, Scissors, Stethoscope, Gem, Package } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import PetServiceFormDialog from '../components/PetServiceFormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import Pagination from '../components/Pagination';

const PetServices = () => {
    const { checkPermission } = useAuth();
    const { petServices, addPetService, updatePetService, deletePetService } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [serviceToDelete, setServiceToDelete] = useState(null);
    const [editingService, setEditingService] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Filter services based on name
    const filteredServices = petServices.filter(service => 
        service.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredServices.slice(indexOfFirstItem, indexOfLastItem);

    const handleOpenModal = (service = null) => {
        setEditingService(service);
        setIsModalOpen(true);
    };

    const handleDelete = (service) => {
        setServiceToDelete(service);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (serviceToDelete) {
            const result = await deletePetService(serviceToDelete.id);
            if (!result.success) {
                setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan saat menghapus data' });
                setIsAlertOpen(true);
            }
            setIsDeleteOpen(false);
            setServiceToDelete(null);
        }
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'grooming': return <Scissors className="h-4 w-4" />;
            case 'medical': return <Stethoscope className="h-4 w-4" />;
            case 'hotel_addon': return <Gem className="h-4 w-4" />;
            default: return <Package className="h-4 w-4" />;
        }
    };

    const getCategoryLabel = (category) => {
        switch (category) {
            case 'grooming': return 'Grooming';
            case 'medical': return 'Medis';
            case 'hotel_addon': return 'Pet Hotel';
            default: return 'Lainnya';
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Katalog Layanan (Pet Care)</h1>
                    <p className="text-muted-foreground">Kelola jenis layanan grooming, medis, dan tambahan lainnya</p>
                </div>
                {checkPermission('clinic.services') && (
                    <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Layanan
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama layanan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kategori</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nama Layanan</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Durasi</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Harga</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Tidak ada layanan ditemukan
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentItems.map((service) => (
                                    <TableRow key={service.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-slate-600">
                                                {getCategoryIcon(service.category)}
                                                <span className="text-sm font-medium">{getCategoryLabel(service.category)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-bold text-slate-800">{service.name}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-slate-500">{service.duration || '-'} Menit</span>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            Rp {(service.price || 0).toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {service.isActive ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">Aktif</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 border-slate-200">Non-Aktif</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenModal(service)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(service)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Pagination
                currentPage={currentPage}
                totalItems={filteredServices.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            <PetServiceFormDialog
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (data) => {
                    let result;
                    if (editingService) {
                        result = await updatePetService(editingService.id, data);
                    } else {
                        result = await addPetService(data);
                    }

                    if (!result.success) {
                        setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan' });
                        setIsAlertOpen(true);
                        throw new Error(result.error);
                    }
                }}
                initialData={editingService}
            />

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Layanan"
                description={`Apakah Anda yakin ingin menghapus layanan "${serviceToDelete?.name}"?`}
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

export default PetServices;
