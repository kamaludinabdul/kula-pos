import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Shield, User, Circle, History, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabase';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import UpgradeAlert from '../components/UpgradeAlert';
import Pagination from '../components/Pagination';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';

const Staff = () => {
    const { user, updateStaffPassword } = useAuth();
    const { activeStoreId, stores, addUser } = useData();
    const [staffList, setStaffList] = useState([]);
    const [activeShifts, setActiveShifts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStaff, setCurrentStaff] = useState({ name: '', email: '', role: 'staff', pin: '', photo: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
    const [upgradeDebugInfo, setUpgradeDebugInfo] = useState(null);

    // Dialog States
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: null });

    // History State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [staffHistory, setStaffHistory] = useState([]);
    const [selectedStaffName, setSelectedStaffName] = useState('');
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const historyItemsPerPage = 5;
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!activeStoreId) {
            setStaffList([]);
            return;
        }

        const fetchInitialData = async () => {
            const { data: users } = await supabase.from('profiles').select('*').eq('store_id', activeStoreId);
            if (users) {
                // Profiles just need id, name, email, role, etc. which are usually already mostly camelCase except for snake case cols like store_id
                // But let's map standard ones if needed or keep as is if we don't access snake_case specifically
                // Looking at usage: staff.name, staff.email, staff.role. These are fine.
                // But let's map store_id just in case.
                setStaffList(users.map(u => ({ ...u, storeId: u.store_id, petCareAccess: u.pet_care_access })));
            }

            const { data: shifts } = await supabase.from('shifts').select('*').eq('store_id', activeStoreId).eq('status', 'active');
            if (shifts) {
                setActiveShifts(shifts.map(s => ({
                    ...s,
                    startTime: s.start_time,
                    initialCash: s.initial_cash,
                    cashierName: s.cashier_name,
                    storeId: s.store_id
                })));
            }
        };

        fetchInitialData();

        const usersChannel = supabase.channel('staff-users')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles',
                filter: `store_id=eq.${activeStoreId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const mappedProfile = {
                        ...payload.new,
                        storeId: payload.new.store_id,
                        petCareAccess: payload.new.pet_care_access
                    };
                    setStaffList(prev => {
                        const idx = prev.findIndex(u => u.id === payload.new.id);
                        if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = mappedProfile;
                            return next;
                        }
                        return [...prev, mappedProfile];
                    });
                } else if (payload.eventType === 'DELETE') {
                    setStaffList(prev => prev.filter(u => u.id !== payload.old.id));
                }
            })
            .subscribe();

        const shiftsChannel = supabase.channel('staff-active-shifts')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shifts',
                filter: `store_id=eq.${activeStoreId}`
            }, (payload) => {
                const { eventType, new: newShift, old: oldShift } = payload;
                if ((eventType === 'INSERT' || eventType === 'UPDATE') && newShift.status === 'active') {
                    const mappedShift = {
                        ...newShift,
                        startTime: newShift.start_time,
                        initialCash: newShift.initial_cash,
                        cashierName: newShift.cashier_name,
                        storeId: newShift.store_id
                    };
                    setActiveShifts(prev => {
                        const idx = prev.findIndex(s => s.id === newShift.id);
                        if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = mappedShift;
                            return next;
                        }
                        return [...prev, mappedShift];
                    });
                } else {
                    // If DELETE or status changed to closed
                    const shiftId = eventType === 'DELETE' ? oldShift.id : newShift.id;
                    setActiveShifts(prev => prev.filter(s => s.id !== shiftId));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(usersChannel);
            supabase.removeChannel(shiftsChannel);
        };
    }, [activeStoreId]);

    const showAlert = (title, message) => {
        setAlertData({ title, message });
        setIsAlertOpen(true);
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmData({ title, message, onConfirm });
        setIsConfirmOpen(true);
    };

    const getStaffStatus = (staff) => {
        // Use the status field from user document (online/offline)
        // Fallback to checking active shifts if status field doesn't exist
        if (staff.status) {
            return staff.status === 'online' ? 'login' : 'logout';
        }
        const isActive = activeShifts.some(shift => (shift.cashierId || shift.cashier_id) === staff.id);
        return isActive ? 'login' : 'logout';
    };

    const handleAddStaff = () => {
        setCurrentStaff({ name: '', email: '', role: 'staff', password: '', photo: '', petCareAccess: false });
        setIsEditing(false);
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleEditStaff = (staff) => {
        // If staff has pin but no password (legacy), use pin as password
        const staffData = {
            ...staff,
            password: staff.password || staff.pin || '',
            petCareAccess: staff.petCareAccess || false
        };

        // Clean up email for display (if dummy)
        if (staffData.email && staffData.email.endsWith('@kula.id')) {
            staffData.email = staffData.email.split('@')[0];
        }

        setCurrentStaff(staffData);
        setIsEditing(true);
        setShowPassword(false);
        setIsModalOpen(true);
    };

    const handleDeleteStaff = (id) => {
        showConfirm(
            'Hapus Staff',
            'Apakah Anda yakin ingin menghapus staff ini?',
            async () => {
                try {
                    await supabase.from('profiles').delete().eq('id', id);
                } catch (error) {
                    console.error("Error deleting staff:", error);
                    showAlert("Gagal", "Gagal menghapus staff.");
                }
            }
        );
    };

    const handleViewHistory = async (staff) => {
        setSelectedStaffName(staff.name);
        setIsHistoryModalOpen(true);
        setIsLoadingHistory(true);
        setStaffHistory([]);
        setHistoryPage(1);

        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('user_id', staff.id)
                .eq('store_id', activeStoreId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setStaffHistory(data || []);
        } catch (error) {
            console.error("Error fetching login history:", error);
            showAlert("Gagal", "Gagal mengambil riwayat login: " + error.message);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentStaff(prev => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeStoreId) {
            showAlert("Error", "Terjadi kesalahan: Tidak ada toko yang aktif.");
            return;
        }

        try {
            // Auto-generate email from username if needed
            let finalEmail = currentStaff.email ? currentStaff.email.trim() : '';
            if (finalEmail && !finalEmail.includes('@')) {
                finalEmail = `${finalEmail.toLowerCase().replace(/\s+/g, '')}@kula.id`;
            }

            if (isEditing) {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        name: currentStaff.name,
                        email: finalEmail || '',
                        role: currentStaff.role,
                        password: currentStaff.password,
                        pin: currentStaff.password,
                        photo: currentStaff.photo || '',
                        pet_care_access: currentStaff.petCareAccess || false
                    })
                    .eq('id', currentStaff.id);

                if (error) throw error;

                // Update Real Password...
                if (currentStaff.password && currentStaff.password.length >= 6) {
                    const pwdResult = await updateStaffPassword(currentStaff.id, currentStaff.password);
                    if (!pwdResult.success) {
                        showAlert("Peringatan", "Data tersimpan TAPI password gagal diubah: " + pwdResult.message);
                        return;
                    }
                }
            } else {
                // Find store name for denormalization if needed
                const currentStore = stores.find(s => s.id === activeStoreId);

                const result = await addUser({
                    name: currentStaff.name,
                    email: finalEmail,
                    role: currentStaff.role,
                    password: currentStaff.password,
                    pin: currentStaff.password, // Keep pin synced for backward compatibility
                    photo: currentStaff.photo || '',
                    pet_care_access: currentStaff.petCareAccess || false,
                    store_id: activeStoreId,
                    store_name: currentStore ? currentStore.name : ''
                });

                if (!result.success) {
                    if (result.isLimitError) {
                        setUpgradeDebugInfo(result.debugInfo);
                        setIsModalOpen(false); // Close the form modal
                        setShowUpgradeAlert(true); // Show upgrade alert
                    } else {
                        showAlert("Gagal", result.error || "Gagal menambahkan staff.");
                    }
                    return;
                }
            }
            setIsModalOpen(false);
            showAlert(
                "Berhasil",
                isEditing ? "Data staff berhasil diperbarui!" : "Staff baru berhasil ditambahkan!"
            );
        } catch (error) {
            console.error("Error saving staff:", error);
            showAlert("Gagal", "Gagal menyimpan data staff.");
        }
    };

    // Pagination Logic for History
    const indexOfLastHistory = historyPage * historyItemsPerPage;
    const indexOfFirstHistory = indexOfLastHistory - historyItemsPerPage;
    const currentHistory = staffHistory.slice(indexOfFirstHistory, indexOfLastHistory);

    return (
        <div className="p-4 space-y-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Manajemen Staff</h1>
                    <p className="text-muted-foreground mt-1">Kelola akses dan karyawan toko Anda.</p>
                </div>
                <Button onClick={handleAddStaff}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Staff
                </Button>
            </header>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Foto</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada staff di toko ini.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                staffList.map((staff) => {
                                    const status = getStaffStatus(staff);
                                    return (
                                        <TableRow key={staff.id}>
                                            <TableCell>
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                                                    {staff.photo ? (
                                                        <img src={staff.photo} alt={staff.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-primary">
                                                            {staff.name ? staff.name.charAt(0).toUpperCase() : '?'}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{staff.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        ID: {staff.email && staff.email.endsWith('@kula.id') ? staff.email.split('@')[0] : staff.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={(staff.role === 'admin' || staff.role === 'owner') ? 'default' : staff.role === 'sales' ? 'outline' : 'secondary'}>
                                                    {(staff.role === 'admin' || staff.role === 'owner') ? 'Administrator' : staff.role === 'sales' ? 'Sales' : 'Kasir'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Circle className={`h-3 w-3 fill-current ${status === 'login' ? 'text-green-500' : 'text-gray-300'}`} />
                                                    <span className={status === 'login' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                                        {status === 'login' ? 'Sedang Login' : 'Logout'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleViewHistory(staff)} title="Riwayat Login">
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                    {((staff.role !== 'admin' && staff.role !== 'owner') || user?.role === 'super_admin' || user?.role === 'owner') && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditStaff(staff)}>
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {((staff.role !== 'admin' && staff.role !== 'owner') || user?.role === 'super_admin' || (user?.role === 'owner' && staff.role !== 'owner')) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteStaff(staff.id)}
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
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

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Staff' : 'Tambah Staff Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="staffName">Nama Lengkap</Label>
                            <Input
                                id="staffName"
                                type="text"
                                value={currentStaff.name}
                                onChange={(e) => setCurrentStaff({ ...currentStaff, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffEmail">Username / Email (Login ID)</Label>
                            <Input
                                id="staffEmail"
                                type="text"
                                value={currentStaff.email || ''}
                                onChange={(e) => setCurrentStaff({ ...currentStaff, email: e.target.value })}
                                placeholder="Contoh: 'kasir1' atau 'kasir1@email.com'"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffPhoto">Foto Profil</Label>
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border">
                                    {currentStaff.photo ? (
                                        <img src={currentStaff.photo} alt="Preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-8 w-8 text-muted-foreground" />
                                    )}
                                </div>
                                <Input
                                    id="staffPhoto"
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffRole">Role / Peran</Label>
                            <Select
                                value={currentStaff.role}
                                onValueChange={(value) => setCurrentStaff({ ...currentStaff, role: value })}
                            >
                                <SelectTrigger id="staffRole">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="staff">Kasir</SelectItem>
                                    <SelectItem value="sales">Sales</SelectItem>
                                    <SelectItem value="admin">Administrator</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffPassword">Password</Label>
                            <div className="relative">
                                <Input
                                    id="staffPassword"
                                    type={showPassword ? "text" : "password"}
                                    value={currentStaff.password}
                                    onChange={(e) => setCurrentStaff({ ...currentStaff, password: e.target.value })}
                                    required
                                    placeholder="Masukkan password"
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="petCareAccess"
                                checked={currentStaff.petCareAccess}
                                onChange={(e) => setCurrentStaff({ ...currentStaff, petCareAccess: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="petCareAccess" className="font-medium cursor-pointer">
                                Berikan Akses ke Aplikasi Pet Care
                            </Label>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit">Simpan</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog >

            <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Riwayat Login - {selectedStaffName}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {isLoadingHistory ? (
                            <div className="text-center py-8 text-muted-foreground">Memuat riwayat...</div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Waktu</TableHead>
                                            <TableHead>Aktivitas</TableHead>
                                            <TableHead>Device</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentHistory.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    Belum ada riwayat login.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentHistory.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell>
                                                        <div>
                                                            <div>{new Date(log.created_at).toLocaleDateString('id-ID')}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {new Date(log.created_at).toLocaleTimeString('id-ID')}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={
                                                            log.status === 'success' ? 'default' :
                                                                log.status === 'logout' ? 'secondary' :
                                                                    'destructive'
                                                        }>
                                                            {log.status === 'success' ? 'Login Berhasil' :
                                                                log.status === 'logout' ? 'Logout' :
                                                                    'Login Gagal'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                        {log.userAgent ? log.userAgent.split(' ').slice(0, 3).join(' ') : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                <Pagination
                                    currentPage={historyPage}
                                    totalItems={staffHistory.length}
                                    itemsPerPage={historyItemsPerPage}
                                    onPageChange={setHistoryPage}
                                />
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <UpgradeAlert
                isOpen={showUpgradeAlert}
                onClose={() => setShowUpgradeAlert(false)}
                title="Batas Staff Tercapai"
                description={
                    upgradeDebugInfo
                        ? `Plan: ${upgradeDebugInfo.plan} | Limit: ${upgradeDebugInfo.limit} | Terpakai: ${upgradeDebugInfo.currentCount}. Upgrade untuk menambah slot.`
                        : "DEBUG: SYSTEM ERROR - PLAN NOT DETECTED. (Code Updated)"
                }
                benefits={[
                    "Hingga 5 Staff / Kasir",
                    "Produk Tanpa Batas",
                    "Laporan Keuangan Lengkap",
                    "Manajemen Stok Lanjutan"
                ]}
            />

            <AlertDialog
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertData.title}
                message={alertData.message}
            />

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title={confirmData.title}
                message={confirmData.message}
                onConfirm={confirmData.onConfirm}
            />
        </div >
    );
};

export default Staff;
