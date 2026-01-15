import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Search, Plus, Edit, Trash2, Phone, Mail, MapPin, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import { useToast } from '../components/ui/use-toast';

const Suppliers = () => {
    const { checkPermission } = useAuth();
    const { suppliers, addSupplier, updateSupplier, deleteSupplier, purchaseOrders } = useData();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');

    // Date Filters
    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [selectedYear, setSelectedYear] = useState(currentYear.toString());

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        notes: ''
    });
    const [deleteId, setDeleteId] = useState(null);

    const filteredSuppliers = suppliers.filter(supplier =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.contactPerson && supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const calculateTotalSpend = (supplierId) => {
        if (!purchaseOrders) return 0;
        return purchaseOrders
            .filter(po => {
                if (po.supplierId !== supplierId || po.status !== 'received') return false;

                const poDate = new Date(po.date || po.createdAt);
                const poMonth = poDate.getMonth() + 1; // 0-indexed
                const poYear = poDate.getFullYear();

                if (selectedMonth !== 'all' && poMonth !== parseInt(selectedMonth)) return false;
                if (selectedYear !== 'all' && poYear !== parseInt(selectedYear)) return false;

                return true;
            })
            .reduce((total, po) => total + (po.totalAmount || 0), 0);
    };

    const handleOpenDialog = (supplier = null) => {
        if (supplier) {
            setFormData({
                name: supplier.name,
                contactPerson: supplier.contactPerson || '',
                phone: supplier.phone || '',
                email: supplier.email || '',
                address: supplier.address || '',
                notes: supplier.notes || ''
            });
            setEditingSupplier(supplier);
        } else {
            setFormData({
                name: '',
                contactPerson: '',
                phone: '',
                email: '',
                address: '',
                notes: ''
            });
            setEditingSupplier(null);
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSupplier) {
                await updateSupplier(editingSupplier.id, formData);
                toast({ title: "Sukses", description: "Supplier berhasil diperbarui" });
            } else {
                await addSupplier(formData);
                toast({ title: "Sukses", description: "Supplier berhasil ditambahkan" });
            }
            setIsDialogOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal", description: error.message });
        }
    };

    const handleDelete = async () => {
        if (deleteId) {
            const res = await deleteSupplier(deleteId);
            if (res.success) {
                toast({ title: "Terhapus", description: "Supplier berhasil dihapus" });
            } else {
                toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus supplier" });
            }
            setDeleteId(null);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Supplier</h1>
                {checkPermission('suppliers.create') && (
                    <Button onClick={() => handleOpenDialog()} className="gap-2">
                        <Plus className="h-4 w-4" /> Tambah Supplier
                    </Button>
                )}
            </div>

            <div className="flex gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari supplier..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Bulan" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                            <SelectItem value="all">Semua Bulan</SelectItem>
                            {Array.from({ length: 12 }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                    {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Tahun" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Tahun</SelectItem>
                            {Array.from({ length: 5 }, (_, i) => (
                                <SelectItem key={currentYear - i} value={(currentYear - i).toString()}>
                                    {currentYear - i}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nama Supplier</TableHead>
                            <TableHead>Alamat</TableHead>
                            <TableHead>Kontak</TableHead>
                            <TableHead className="text-right">Total Belanja</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSuppliers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    Belum ada supplier ditemukan.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSuppliers.map((supplier) => (
                                <TableRow key={supplier.id}>
                                    <TableCell className="font-medium">
                                        <div>{supplier.name}</div>
                                        {supplier.contactPerson && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                <User className="h-3 w-3" /> {supplier.contactPerson}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[300px]">
                                        {supplier.address ? (
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                                                <span className="truncate block" title={supplier.address}>{supplier.address}</span>
                                            </div>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm space-y-1">
                                            {supplier.phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                                    <span>{supplier.phone}</span>
                                                </div>
                                            )}
                                            {supplier.email && (
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                                    <span className="truncate max-w-[150px]" title={supplier.email}>{supplier.email}</span>
                                                </div>
                                            )}
                                            {!supplier.phone && !supplier.email && '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        Rp {calculateTotalSpend(supplier.id).toLocaleString('id-ID')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1 justify-end">
                                            {checkPermission('suppliers.update') && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleOpenDialog(supplier)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {checkPermission('suppliers.delete') && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setDeleteId(supplier.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Tambah Supplier Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Nama Supplier <span className="text-red-500">*</span></label>
                            <Input
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="PT. Distributor..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Contact Person</label>
                                <Input
                                    value={formData.contactPerson}
                                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                                    placeholder="Nama CP"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">No. Telepon</label>
                                <Input
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="081..."
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="email@example.com"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Alamat</label>
                            <Textarea
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Alamat lengkap supplier"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Catatan</label>
                            <Textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Catatan tambahan..."
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                            <Button type="submit">Simpan</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Supplier?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Pastikan supplier ini tidak terikat dengan data stok aktif.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Suppliers;
