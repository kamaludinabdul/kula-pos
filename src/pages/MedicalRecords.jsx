import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Edit, Edit2, Trash2, FileText, Search, Printer, Dog, Calendar, Stethoscope, User, ChevronRight, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import Pagination from '../components/Pagination';
import MedicalRecordFormDialog from '../components/MedicalRecordFormDialog';
import PetHealthCertificate from '../components/PetHealthCertificate';
import MedicalRecordPrint from '../components/MedicalRecordPrint';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import { format, parseISO } from 'date-fns';

const MedicalRecords = () => {
    const { checkPermission } = useAuth();
    const { medicalRecords, pets, customers, addMedicalRecord, updateMedicalRecord, deleteMedicalRecord, currentStore } = useData();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCertOpen, setIsCertOpen] = useState(false);
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [editingRecord, setEditingRecord] = useState(null);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    // Filter logic
    const filteredRecords = medicalRecords.filter(record => {
        const pet = pets.find(p => p.id === record.petId);
        const customer = customers.find(c => c.id === record.customerId);
        const matchesSearch = 
            (pet?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (record.diagnosis || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (record.doctorName || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
    });

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentRecords = filteredRecords.slice(indexOfFirstItem, indexOfLastItem);

    const handleOpenModal = (record = null) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    };

    const handleDelete = (record) => {
        setRecordToDelete(record);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (recordToDelete) {
            const result = await deleteMedicalRecord(recordToDelete.id);
            if (!result.success) {
                setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan saat menghapus data' });
                setIsAlertOpen(true);
            }
            setIsDeleteOpen(false);
            setRecordToDelete(null);
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Rekam Medis Elektronik (EMR)</h1>
                    <p className="text-muted-foreground">Catatan medis dan riwayat kesehatan hewan peliharaan</p>
                </div>
                {checkPermission('clinic.medical_records.create') && (
                    <Button onClick={() => handleOpenModal()} className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Buat Rekam Medis
                    </Button>
                )}
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-2 rounded-xl border">
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700">{filteredRecords.length} Total Records</span>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari hewan, pemilik, diagnosa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>
            </div>

            <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {/* Desktop View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tanggal & Dokter</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hewan & Pemilik</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Diagnosa & Tindakan</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Layanan & Obat</TableHead>
                                <TableHead className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentRecords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                        Tidak ada rekam medis yang ditemukan
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentRecords.map((record) => {
                                    const pet = pets.find(p => p.id === record.petId);
                                    const customer = customers.find(c => c.id === record.customerId);

                                    return (
                                        <TableRow key={record.id} className="group">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                        <Calendar className="h-3.5 w-3.5 text-blue-500" />
                                                        <span>{new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                                                        <Stethoscope className="h-3 w-3" />
                                                        <span>Dr. {record.doctorName || '-'}</span>
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
                                                <div className="flex flex-col max-w-[250px]">
                                                    <span className="text-xs font-bold text-slate-800 line-clamp-1">
                                                        {record.diagnosis || 'Tanpa Diagnosa'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                                                        {record.treatment || record.symptoms || '-'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {(record.services || []).length > 0 && (
                                                        <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-100">
                                                            {record.services.length} Jasa
                                                        </Badge>
                                                    )}
                                                    {(record.prescriptions || []).length > 0 && (
                                                        <Badge variant="outline" className="text-[9px] bg-red-50 text-red-700 border-red-100">
                                                            {record.prescriptions.length} Obat
                                                        </Badge>
                                                    )}
                                                    {!record.services?.length && !record.prescriptions?.length && (
                                                        <span className="text-[10px] text-slate-300">-</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-emerald-600" 
                                                        title="Cetak Sertifikat"
                                                        onClick={() => {
                                                            setSelectedRecord(record);
                                                            setIsCertOpen(true);
                                                        }}
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-slate-600" 
                                                        title="Cetak EMR"
                                                        onClick={() => {
                                                            setSelectedRecord(record);
                                                            setIsPrintOpen(true);
                                                        }}
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-amber-600" 
                                                        title="Bawa ke Kasir"
                                                        onClick={() => navigate(`/pos?recordId=${record.id}`)}
                                                    >
                                                        <ShoppingCart className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleOpenModal(record)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(record)}>
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
                    </div>

                    {/* Mobile View */}
                    <div className="lg:hidden p-4 flex flex-col gap-4">
                        {filteredRecords.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border rounded-lg">
                                Tidak ada data rekam medis
                            </div>
                        ) : (
                            filteredRecords.map(record => (
                                <div key={record.id} className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-slate-800">{format(parseISO(record.date), 'dd MMM yyyy')}</div>
                                            <div className="text-xs text-slate-500">{format(parseISO(record.date), 'HH:mm')}</div>
                                        </div>
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                            {record.type === 'treatment' ? 'Perawatan' : 
                                             record.type === 'vaccine' ? 'Vaksinasi' : 'Kunjungan'}
                                        </Badge>
                                    </div>
                                    <div className="pt-2 border-t">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                                                <Dog className="h-3 w-3 text-slate-500" />
                                            </div>
                                            <span className="font-medium text-sm text-slate-700">
                                                {pets.find(p => p.id === record.petId)?.name || 'Unknown Pet'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                                            <span className="font-medium">Diagnosa: </span>
                                            {record.diagnosis || '-'}
                                        </p>
                                    </div>
                                    <div className="pt-3 border-t mt-3 flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(record)} className="h-8 w-8 text-blue-600 border border-transparent bg-blue-50">
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => { setRecordToDelete(record); setIsDeleteOpen(true); }} className="h-8 w-8 text-red-600 border border-transparent bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <Pagination
                currentPage={currentPage}
                totalItems={filteredRecords.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            <MedicalRecordFormDialog
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (data) => {
                    let result;
                    if (editingRecord) {
                        result = await updateMedicalRecord(editingRecord.id, data);
                    } else {
                        result = await addMedicalRecord(data);
                    }

                    if (!result.success) {
                        setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan' });
                        setIsAlertOpen(true);
                        throw new Error(result.error);
                    }
                }}
                initialData={editingRecord}
            />

            <PetHealthCertificate 
                isOpen={isCertOpen}
                onClose={() => setIsCertOpen(false)}
                record={selectedRecord}
                pet={pets.find(p => p.id === selectedRecord?.petId)}
                customer={customers.find(c => c.id === selectedRecord?.customerId)}
            />

            <MedicalRecordPrint
                isOpen={isPrintOpen}
                onClose={() => setIsPrintOpen(false)}
                record={selectedRecord}
                pet={pets.find(p => p.id === selectedRecord?.petId)}
                customer={customers.find(c => c.id === selectedRecord?.customerId)}
                store={currentStore}
            />

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Rekam Medis"
                description={`Apakah Anda yakin ingin menghapus rekam medis ini? Tindakan ini tidak dapat dibatalkan.`}
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

export default MedicalRecords;
