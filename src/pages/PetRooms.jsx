import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Plus, Edit, Trash2, Home, Bed, Search, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import PetRoomFormDialog from '../components/PetRoomFormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';

const PetRooms = () => {
    const { checkPermission } = useAuth();
    const { petRooms, addPetRoom, updatePetRoom, deletePetRoom } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [roomToDelete, setRoomToDelete] = useState(null);
    const [editingRoom, setEditingRoom] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    const handleOpenModal = (room = null) => {
        setEditingRoom(room);
        setIsModalOpen(true);
    };

    const handleDelete = (room) => {
        if (room.status === 'occupied') {
            setAlertData({ 
                title: 'Opps!', 
                message: 'Kamar yang sedang terisi tidak dapat dihapus. Selesaikan booking terlebih dahulu.' 
            });
            setIsAlertOpen(true);
            return;
        }
        setRoomToDelete(room);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (roomToDelete) {
            const result = await deletePetRoom(roomToDelete.id);
            if (!result.success) {
                setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan saat menghapus data' });
                setIsAlertOpen(true);
            }
            setIsDeleteOpen(false);
            setRoomToDelete(null);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'available':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">Tersedia</Badge>;
            case 'occupied':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">Terisi</Badge>;
            case 'maintenance':
                return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">Perawatan</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manajemen Kamar (Pet Hotel)</h1>
                    <p className="text-muted-foreground">Kelola fasilitas penginapan untuk hewan peliharaan</p>
                </div>
                {checkPermission('clinic.rooms') && (
                    <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Kamar
                    </Button>
                )}
            </div>

            {petRooms.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Home className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-medium">Belum ada kamar</h3>
                        <p className="text-sm text-muted-foreground mb-4">Mulai tambahkan kamar hotel pertama Anda.</p>
                        <Button onClick={() => handleOpenModal()} variant="outline">
                            Tambah Kamar Sekarang
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {petRooms.map((room) => (
                        <Card key={room.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardHeader className="p-4 flex flex-row items-start justify-between space-y-0">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <CardTitle className="text-lg">{room.name}</CardTitle>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-bold uppercase tracking-wider">
                                            {room.type}
                                        </span>
                                    </div>
                                    <CardDescription className="text-xs">
                                        Kapasitas: {room.capacity} Hewan
                                    </CardDescription>
                                </div>
                                {getStatusBadge(room.status)}
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-xs text-muted-foreground">Rp</span>
                                    <span className="text-xl font-bold">
                                        {(room.price || 0).toLocaleString('id-ID')}
                                    </span>
                                    <span className="text-xs text-muted-foreground">/ malam</span>
                                </div>

                                <div className="flex justify-end gap-2 border-t pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={() => handleOpenModal(room)}
                                    >
                                        <Edit className="h-3.5 w-3.5 mr-1" />
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => handleDelete(room)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        Hapus
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <PetRoomFormDialog
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (data) => {
                    let result;
                    if (editingRoom) {
                        result = await updatePetRoom(editingRoom.id, data);
                    } else {
                        result = await addPetRoom(data);
                    }

                    if (!result.success) {
                        setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan' });
                        setIsAlertOpen(true);
                        throw new Error(result.error);
                    }
                }}
                initialData={editingRoom}
            />

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Kamar"
                description={`Apakah Anda yakin ingin menghapus kamar "${roomToDelete?.name}"?`}
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

export default PetRooms;
