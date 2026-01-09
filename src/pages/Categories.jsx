import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Edit2, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';

const Categories = () => {
    const { categories, products, addCategory, updateCategory, deleteCategory } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const handleOpenModal = (category = null) => {
        if (category) {
            setEditingCategory(category);
            const catName = typeof category.name === 'object' && category.name?.name ? category.name.name : category.name;
            setFormData({ name: catName });
        } else {
            setEditingCategory(null);
            setFormData({ name: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const inputName = formData.name.trim();
        if (!inputName) return;

        // Check for duplicates
        const duplicate = categories.find(c => {
            const cName = typeof c.name === 'object' && c.name?.name ? c.name.name : c.name;
            return cName.toLowerCase() === inputName.toLowerCase() &&
                (!editingCategory || c.id !== editingCategory.id);
        });

        if (duplicate) {
            setAlertData({
                title: "Gagal Menyimpan",
                message: `Kategori dengan nama "${inputName}" sudah ada. Silakan gunakan nama lain.`
            });
            setIsAlertOpen(true);
            return;
        }

        if (editingCategory) {
            await updateCategory(editingCategory.id, inputName);
        } else {
            await addCategory(inputName);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (category) => {
        setCategoryToDelete(category);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (categoryToDelete) {
            await deleteCategory(categoryToDelete.id);
            setCategoryToDelete(null);
        }
    };

    // Get product count for each category
    const getProductCount = React.useCallback((categoryName) => {
        const nameToCheck = typeof categoryName === 'object' && categoryName?.name ? categoryName.name : categoryName;
        return products.filter(p => {
            // Handle product category being array or single value, and potentially objects
            if (Array.isArray(p.category)) {
                return p.category.some(c => {
                    const cName = typeof c === 'object' && c?.name ? c.name : c;
                    return cName === nameToCheck;
                });
            }
            const pCatName = typeof p.category === 'object' && p.category?.name ? p.category.name : p.category;
            return pCatName === nameToCheck;
        }).length;
    }, [products]);



    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedCategories = React.useMemo(() => {
        let sortableItems = [...categories];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                if (sortConfig.key === 'name') {
                    aValue = typeof a.name === 'object' && a.name?.name ? a.name.name : a.name;
                    bValue = typeof b.name === 'object' && b.name?.name ? b.name.name : b.name;
                    aValue = aValue.toString().toLowerCase();
                    bValue = bValue.toString().toLowerCase();
                } else if (sortConfig.key === 'count') {
                    aValue = getProductCount(a.name);
                    bValue = getProductCount(b.name);
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
    }, [categories, sortConfig, getProductCount]); // Added getProductCount dependency

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCategories = sortedCategories.slice(indexOfFirstItem, indexOfLastItem);

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground/50" />;
        if (sortConfig.direction === 'asc') return <ArrowUp className="h-4 w-4 ml-1" />;
        return <ArrowDown className="h-4 w-4 ml-1" />;
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Kategori</h1>
                    <p className="text-muted-foreground">Kelola kategori produk</p>
                </div>
                <div className="flex gap-2">
                    {/* <Button variant="outline" onClick={handleCleanupDuplicates} className="text-orange-600 border-orange-200 hover:bg-orange-50">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Bersihkan Duplikat
                    </Button> */}
                    <Button onClick={() => handleOpenModal()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Kategori
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center">
                                    Nama Kategori
                                    {getSortIcon('name')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleSort('count')}
                            >
                                <div className="flex items-center">
                                    Jumlah Produk
                                    {getSortIcon('count')}
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentCategories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    Tidak ada kategori ditemukan
                                </TableCell>
                            </TableRow>
                        ) : (
                            currentCategories.map((category) => (
                                <TableRow key={category.id}>
                                    <TableCell className="font-medium">
                                        {typeof category.name === 'object' && category.name?.name ? category.name.name : category.name}
                                    </TableCell>
                                    <TableCell>{getProductCount(category.name)} produk</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(category)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(category)}
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

            <Pagination
                currentPage={currentPage}
                totalItems={sortedCategories.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
            />

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Kategori</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                title="Hapus Kategori"
                description={`Apakah Anda yakin ingin menghapus kategori "${categoryToDelete?.name}"? Tindakan ini tidak dapat dibatalkan.`}
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

export default Categories;
