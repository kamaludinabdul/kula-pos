import React, { useState, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Plus, Search, Edit, Trash2, User, Mail, Phone, MapPin, Edit2, History, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import CustomerTransactionHistory from '../components/CustomerTransactionHistory';

const Customers = () => {
    const { customers, transactions, addCustomer, updateCustomer, deleteCustomer } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm))
    );

    // Helper to get raw last transaction date for sorting
    const getLastTrxDateRaw = useCallback((customerId) => {
        if (!transactions || transactions.length === 0) return 0;
        const customerTrx = transactions.filter(t => t.customerId === customerId);
        if (customerTrx.length === 0) return 0;
        // Find max date
        return Math.max(...customerTrx.map(t => new Date(t.date).getTime()));
    }, [transactions]);

    // Helper to get display string
    const getLastTrxDate = (customerId) => {
        const rawDate = getLastTrxDateRaw(customerId);
        if (rawDate === 0) return '-';
        return new Date(rawDate).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    // Helper to format registered date
    const getRegisteredDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedCustomers = React.useMemo(() => {
        let sortableItems = [...filteredCustomers];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                if (sortConfig.key === 'name') {
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                } else if (sortConfig.key === 'registered') {
                    aValue = new Date(a.createdAt || 0).getTime();
                    bValue = new Date(b.createdAt || 0).getTime();
                } else if (sortConfig.key === 'lastTrx') {
                    aValue = getLastTrxDateRaw(a.id);
                    bValue = getLastTrxDateRaw(b.id);
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredCustomers, sortConfig, getLastTrxDateRaw]);

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCustomers = sortedCustomers.slice(indexOfFirstItem, indexOfLastItem);

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground/50" />;
        if (sortConfig.direction === 'asc') return <ArrowUp className="h-4 w-4 ml-1" />;
        return <ArrowDown className="h-4 w-4 ml-1" />;
    };

    const handleOpenModal = (customer = null) => {
        if (customer) {
            setEditingCustomer(customer);
            setFormData({
                name: customer.name,
                phone: customer.phone || '',
                email: customer.email || '',
                address: customer.address || ''
            });
        } else {
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', email: '', address: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let result;
        if (editingCustomer) {
            result = await updateCustomer(editingCustomer.id, formData);
        } else {
            result = await addCustomer(formData);
        }

        if (result.success) {
            setIsModalOpen(false);
        } else {
            setAlertData({ title: 'Gagal', message: result.error || 'Terjadi kesalahan' });
            setIsAlertOpen(true);
        }
    };

    const handleDelete = (customer) => {
        setCustomerToDelete(customer);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (customerToDelete) {
            await deleteCustomer(customerToDelete.id);
            setCustomerToDelete(null);
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pelanggan</h1>
                    <p className="text-muted-foreground">Kelola database pelanggan Anda</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Pelanggan
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari pelanggan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead
                                    className="w-[250px] cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center">
                                        Nama
                                        {getSortIcon('name')}
                                    </div>
                                </TableHead>
                                <TableHead>Kontak</TableHead>
                                <TableHead>Alamat</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort('registered')}
                                >
                                    <div className="flex items-center">
                                        Tanggal Daftar
                                        {getSortIcon('registered')}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort('lastTrx')}
                                >
                                    <div className="flex items-center">
                                        Transaksi Terakhir
                                        {getSortIcon('lastTrx')}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Tidak ada pelanggan ditemukan
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentCustomers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{customer.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col space-y-1 text-sm">
                                                {customer.phone && (
                                                    <div className="flex items-center text-muted-foreground">
                                                        <Phone className="mr-2 h-3 w-3" />
                                                        {customer.phone}
                                                    </div>
                                                )}
                                                {customer.email && (
                                                    <div className="flex items-center text-muted-foreground">
                                                        <Mail className="mr-2 h-3 w-3" />
                                                        {customer.email}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-[200px] truncate text-muted-foreground">
                                                {customer.address || '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getRegisteredDate(customer.createdAt)}
                                        </TableCell>
                                        <TableCell>
                                            {getLastTrxDate(customer.id)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setSelectedCustomer(customer);
                                                        setIsHistoryOpen(true);
                                                    }}
                                                    title="Riwayat Transaksi"
                                                >
                                                    <History className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenModal(customer)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(customer)}
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
                totalItems={sortedCustomers.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">No. HP <span className="text-red-500">*</span></Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                required
                                placeholder="08xxxxxxxxxx"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Alamat</Label>
                            <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit">Simpan</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Hapus Pelanggan"
                description={`Apakah Anda yakin ingin menghapus pelanggan "${customerToDelete?.name}" ? Tindakan ini tidak dapat dibatalkan.`}
                confirmText="Hapus"
                variant="destructive"
            />

            <CustomerTransactionHistory
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                customer={selectedCustomer}
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

export default Customers;
