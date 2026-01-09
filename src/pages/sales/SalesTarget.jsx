import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Plus, Edit2, Trash2, Filter, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';
import AlertDialog from '../../components/AlertDialog';

const MONTHS = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
];

const SalesTarget = () => {
    const { salesTargets, categories, fetchUsersByStore, activeStoreId, addSalesTarget, updateSalesTarget, deleteSalesTarget } = useData();
    const [users, setUsers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTarget, setEditingTarget] = useState(null);

    // Filter State
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const [formData, setFormData] = useState({
        userId: '',
        userName: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        categoryId: 'all',
        categoryName: 'Semua Kategori',
        targetQty: ''
    });
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [targetToDelete, setTargetToDelete] = useState(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    useEffect(() => {
        const loadUsers = async () => {
            if (activeStoreId) {
                const storeUsers = await fetchUsersByStore(activeStoreId);
                setUsers(storeUsers);
            }
        };
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStoreId]);

    const handleOpenModal = (target = null) => {
        if (target) {
            setEditingTarget(target);
            setFormData({
                userId: target.userId,
                userName: target.userName,
                month: target.month,
                year: target.year,
                categoryId: target.categoryId,
                categoryName: target.categoryName,
                targetQty: target.targetQty
            });
        } else {
            setEditingTarget(null);
            setFormData({
                userId: '',
                userName: '',
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                categoryId: 'all',
                categoryName: 'Semua Kategori',
                targetQty: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check for duplicates
        const duplicate = salesTargets.find(t =>
            t.userId === formData.userId &&
            t.month === parseInt(formData.month) &&
            t.year === parseInt(formData.year) &&
            t.categoryId === formData.categoryId &&
            (!editingTarget || t.id !== editingTarget.id) // Exclude current target if editing
        );

        if (duplicate) {
            setAlertData({
                title: "Duplikasi Target",
                message: `Target untuk staff ini pada kategori "${formData.categoryName}" di bulan/tahun tersebut sudah ada. Silakan edit target yang sudah ada atau pilih kategori lain.`
            });
            setIsAlertOpen(true);
            return;
        }

        // Find names
        const selectedUser = users.find(u => u.id === formData.userId);
        const selectedCategory = formData.categoryId === 'all'
            ? { name: 'Semua Kategori' }
            : categories.find(c => c.id === formData.categoryId);

        let catName = selectedCategory?.name || 'Unknown';
        if (typeof catName === 'object' && catName?.name) {
            catName = catName.name;
        }

        const dataToSave = {
            ...formData,
            userName: selectedUser?.name || 'Unknown',
            categoryName: catName,
            targetQty: parseInt(formData.targetQty)
        };

        if (editingTarget) {
            await updateSalesTarget(editingTarget.id, dataToSave);
        } else {
            await addSalesTarget(dataToSave);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (target) => {
        setTargetToDelete(target);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (targetToDelete) {
            await deleteSalesTarget(targetToDelete.id);
            setTargetToDelete(null);
        }
    };

    // Filtered Targets
    const filteredTargets = salesTargets.filter(target => {
        return target.month === parseInt(filterMonth) && target.year === parseInt(filterYear);
    });

    // Sorting Logic
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTargets = useMemo(() => {
        let sortableItems = [...filteredTargets];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                if (sortConfig.key === 'staff') {
                    aValue = (a.userName || '').toLowerCase();
                    bValue = (b.userName || '').toLowerCase();
                } else if (sortConfig.key === 'period') {
                    aValue = a.year * 100 + a.month;
                    bValue = b.year * 100 + b.month;
                } else if (sortConfig.key === 'category') {
                    const getCatName = (name) => (typeof name === 'object' && name?.name ? name.name : name);
                    aValue = String(getCatName(a.categoryName)).toLowerCase();
                    bValue = String(getCatName(b.categoryName)).toLowerCase();
                } else if (sortConfig.key === 'target') {
                    aValue = parseInt(a.targetQty) || 0;
                    bValue = parseInt(b.targetQty) || 0;
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
    }, [filteredTargets, sortConfig]);

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground/50" />;
        if (sortConfig.direction === 'asc') return <ArrowUp className="h-4 w-4 ml-1" />;
        return <ArrowDown className="h-4 w-4 ml-1" />;
    };

    // Generate Year Options
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Target Penjualan</h1>
                    <p className="text-muted-foreground">Kelola target penjualan untuk staff</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Target
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-card p-4 rounded-lg border shadow-sm">
                <div className="space-y-1">
                    <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(parseInt(v))}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Pilih Bulan" />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTHS.map((month) => (
                                <SelectItem key={month.value} value={String(month.value)}>
                                    {month.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(parseInt(v))}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Pilih Tahun" />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('staff')}
                            >
                                <div className="flex items-center">
                                    Staff
                                    {getSortIcon('staff')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('period')}
                            >
                                <div className="flex items-center">
                                    Periode
                                    {getSortIcon('period')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('category')}
                            >
                                <div className="flex items-center">
                                    Kategori
                                    {getSortIcon('category')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('target')}
                            >
                                <div className="flex items-center">
                                    Target (Qty)
                                    {getSortIcon('target')}
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedTargets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    Belum ada target penjualan untuk periode ini.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedTargets.map((target) => (
                                <TableRow key={target.id}>
                                    <TableCell className="font-medium">{target.userName}</TableCell>
                                    <TableCell>{MONTHS.find(m => m.value === parseInt(target.month))?.label} {target.year}</TableCell>
                                    <TableCell>{typeof target.categoryName === 'object' && target.categoryName?.name ? target.categoryName.name : target.categoryName}</TableCell>
                                    <TableCell>{target.targetQty}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(target)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(target)}
                                                className="text-destructive hover:text-destructive"
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
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTarget ? 'Edit Target' : 'Tambah Target Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="userId">Staff</Label>
                            <Select
                                value={formData.userId}
                                onValueChange={(val) => setFormData({ ...formData, userId: val })}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Staff" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
                                        <SelectItem key={user.id} value={user.id}>{user.name} ({user.role})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="month">Bulan</Label>
                                <Select
                                    value={formData.month.toString()}
                                    onValueChange={(val) => setFormData({ ...formData, month: parseInt(val) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map(m => (
                                            <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year">Tahun</Label>
                                <Input
                                    type="number"
                                    value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoryId">Kategori</Label>
                            <Select
                                value={formData.categoryId}
                                onValueChange={(val) => setFormData({ ...formData, categoryId: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Kategori</SelectItem>
                                    {categories.map(cat => {
                                        const catName = typeof cat.name === 'object' && cat.name?.name ? cat.name.name : cat.name;
                                        return (
                                            <SelectItem key={cat.id} value={cat.id}>{catName}</SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="targetQty">Target Penjualan (Qty)</Label>
                            <Input
                                type="number"
                                value={formData.targetQty}
                                onChange={(e) => setFormData({ ...formData, targetQty: e.target.value })}
                                placeholder="Contoh: 12"
                                required
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
                title="Hapus Target"
                description="Apakah Anda yakin ingin menghapus target ini?"
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

export default SalesTarget;
