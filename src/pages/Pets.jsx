import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, Edit, Trash2, User, Phone, Info } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import PetFormDialog from '../components/PetFormDialog';

const Pets = () => {
    const { checkPermission } = useAuth();
    const { pets, customers, addPet, updatePet, deletePet } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [petToDelete, setPetToDelete] = useState(null);
    const [editingPet, setEditingPet] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    // Filter pets based on name or owner name
    const filteredPets = pets.filter(pet => {
        const owner = customers.find(c => c.id === pet.customerId);
        return pet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (owner && owner.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
               (pet.rmNumber && pet.rmNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPets = filteredPets.slice(indexOfFirstItem, indexOfLastItem);

    const handleOpenModal = (pet = null) => {
        setEditingPet(pet);
        setIsModalOpen(true);
    };

    const handleDelete = (pet) => {
        setPetToDelete(pet);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (petToDelete) {
            const result = await deletePet(petToDelete.id);
            if (!result.success) {
                setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan saat menghapus data' });
                setIsAlertOpen(true);
            }
            setIsDeleteOpen(false);
            setPetToDelete(null);
        }
    };

    const getOwnerName = (customerId) => {
        const owner = customers.find(c => c.id === customerId);
        return owner ? owner.name : 'Tanpa Pemilik';
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Data Hewan (Pet Registry)</h1>
                    <p className="text-muted-foreground">Kelola database hewan peliharaan customer Anda</p>
                </div>
                {checkPermission('clinic.pets.create') && (
                    <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto mt-4 sm:mt-0">
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Pet Baru
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama hewan, pemilik, atau no RM..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <Card className="rounded-2xl border-none shadow-sm overflow-hidden hidden lg:block">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="w-[100px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">RM</TableHead>
                                <TableHead className="w-[200px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nama Hewan</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jenis / Breed</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Steril</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Vaksin</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pemilik</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Keterangan</TableHead>
                                <TableHead className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentPets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Tidak ada data hewan
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentPets.map((pet) => (
                                    <TableRow key={pet.id}>
                                        <TableCell className="font-mono text-xs text-blue-600 font-bold">
                                            {pet.rmNumber || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <Link to={`/pet-profile/${pet.id}`} className="font-bold text-blue-600 hover:underline">
                                                    {pet.name}
                                                </Link>
                                                <span className="text-xs text-muted-foreground">{pet.gender}, {pet.petAge || '?'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{pet.petType}</span>
                                                <span className="text-xs text-muted-foreground">{pet.breed || '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {pet.isNeutered ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">Ya</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">Tidak</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {pet.isVaccinated ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-100">Lengkap</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">Belum</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700">{getOwnerName(pet.customerId)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {pet.specialNeeds ? (
                                                <div className="flex items-center gap-1.5 text-amber-600 text-xs bg-amber-50 px-2 py-1 rounded border border-amber-100 max-w-[200px]">
                                                    <Info className="h-3 w-3 shrink-0" />
                                                    <span className="truncate">{pet.specialNeeds}</span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenModal(pet)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(pet)}
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

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
                {currentPets.map((pet) => (
                    <div key={pet.id} className="bg-white rounded-xl border p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <Link to={`/pet-profile/${pet.id}`} className="font-bold text-blue-600 hover:underline block">
                                    {pet.name}
                                </Link>
                                <p className="text-xs text-blue-600 font-bold">{pet.rmNumber}</p>
                            </div>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(pet)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(pet)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Jenis</p>
                                <p>{pet.petType} ({pet.breed || '-'})</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Pemilik</p>
                                <p>{getOwnerName(pet.customerId)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
                                <div className="flex gap-2 mt-1">
                                    {pet.isNeutered && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase">Steril</span>}
                                    {pet.isVaccinated && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-50 text-green-600 border border-green-100 uppercase">Vaksin</span>}
                                    {!pet.isNeutered && !pet.isVaccinated && <span className="text-slate-400">-</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={filteredPets.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            <PetFormDialog
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (data) => {
                    let result;
                    if (editingPet) {
                        result = await updatePet(editingPet.id, data);
                    } else {
                        result = await addPet(data);
                    }

                    if (!result.success) {
                        setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan' });
                        setIsAlertOpen(true);
                        throw new Error(result.error);
                    }
                }}
                initialData={editingPet}
            />

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Data Hewan"
                description={`Apakah Anda yakin ingin menghapus data hewan "${petToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
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

export default Pets;
