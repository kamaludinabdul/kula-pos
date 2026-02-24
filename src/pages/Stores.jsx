import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Store, MapPin, Phone, MessageCircle, Users, Edit, Crown, Eye, EyeOff, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Switch } from '../components/ui/switch';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { PLANS } from '../utils/plans';


const Stores = () => {
    const { stores, addStore, updateStore, deleteStore, setSelectedStoreId, selectedStoreId, addUser, fetchUsersByStore, plans: contextPlans } = useData();
    const { user } = useAuth();
    const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [managingStore, setManagingStore] = useState(null);
    const [editingStore, setEditingStore] = useState(null);
    const [storeUsers, setStoreUsers] = useState([]);

    // For Super Admin: Group stores by Owner
    const owners = useMemo(() => {
        if (user?.role !== 'super_admin' || !stores) return [];

        const ownerMap = {};
        stores.forEach(store => {
            // Group by ownerId if available, otherwise by email (for new owners)
            const groupId = store.ownerId || store.ownerEmail || store.email || 'unknown_owner';

            if (!ownerMap[groupId]) {
                const plan = store.ownerPlan || 'free';
                const planInfo = contextPlans?.[plan] || PLANS[plan];

                ownerMap[groupId] = {
                    id: store.ownerId,
                    name: store.ownerName || (store.ownerEmail ? 'Pending Signup' : 'Unknown'),
                    email: store.ownerEmail || store.email || '-',
                    plan: plan,
                    planExpiryDate: store.planExpiryDate || store.plan_expiry_date,
                    maxStores: planInfo?.maxStores || 1,
                    stores: [],
                    totalStores: 0,
                    isPending: !store.ownerId
                };
            }
            ownerMap[groupId].stores.push(store);
            ownerMap[groupId].totalStores++;
        });

        return Object.values(ownerMap);
    }, [stores, user, contextPlans]);

    const [viewMode] = useState(user?.role === 'super_admin' ? 'owners' : 'stores');
    const [selectedOwner, setSelectedOwner] = useState(null);

    // Filter stores based on user role or selection
    const visibleStores = useMemo(() => {
        if (!stores) return [];
        if (user?.role === 'super_admin') {
            if (viewMode === 'owners' && selectedOwner) {
                return selectedOwner.stores;
            }
            return stores; // Fallback or "All Stores" view if needed
        }
        if (user?.role === 'owner') {
            return stores.filter(s => s.owner_id === user.id);
        }
        return []; // Staff usually don't see this page except via direct link, handled by PrivateRoute
    }, [stores, user, viewMode, selectedOwner]);

    // Calculate max stores based on the owner's plan (Per-Owner Subscription)
    const maxStoresAllowed = useMemo(() => {
        if (user?.role === 'super_admin') return -1; // Unlimited

        // Use the plan from the User Profile (Owner's Plan)
        const userPlan = user?.plan || 'free';

        if (contextPlans && contextPlans[userPlan]) {
            return contextPlans[userPlan].maxStores || 1;
        }
        return PLANS[userPlan]?.maxStores || 1;
    }, [user, contextPlans]);

    const canAddStore = user?.role === 'super_admin' || visibleStores.length < maxStoresAllowed;


    // Dialog States
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: null });

    const [storeFormData, setStoreFormData] = useState({
        name: '',
        address: '',
        phone: '',
        ownerEmail: '', // New field for Super Admin
        telegramBotToken: '',
        telegramChatId: '',
        plan: 'free',
        duration: 1, // Default 1 month
        enableSalesPerformance: false,
        petCareEnabled: false
    });

    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        role: 'staff'
    });
    const [showPassword, setShowPassword] = useState(false);

    const showAlert = (title, message) => {
        setAlertData({ title, message });
        setIsAlertOpen(true);
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmData({ title, message, onConfirm });
        setIsConfirmOpen(true);
    };

    const handleOpenStoreModal = (store = null) => {
        if (store) {
            setEditingStore(store);
            setStoreFormData({
                name: store.name || '',
                address: store.address || '',
                phone: store.phone || '',
                ownerEmail: store.ownerEmail || store.email || '',
                telegramBotToken: store.telegramBotToken || '',
                telegramChatId: store.telegramChatId || '',
                plan: store.plan || 'free',
                duration: 1, // Reset selection or maybe calculate remaining? For now reset to simple choice
                enableSalesPerformance: store.enableSalesPerformance || false,
                petCareEnabled: store.petCareEnabled || false
            });
        } else {
            setEditingStore(null);
            setStoreFormData({
                name: '',
                address: '',
                phone: '',
                ownerEmail: selectedOwner?.email || '',
                telegramBotToken: '',
                telegramChatId: '',
                plan: 'free',
                duration: 1,
                enableSalesPerformance: false,
                petCareEnabled: false
            });
        }
        setIsStoreModalOpen(true);
    };

    const handleSaveStore = async (e) => {
        e.preventDefault();

        // Map camelCase form fields to snake_case for Supabase
        let planData = {
            name: storeFormData.name,
            address: storeFormData.address,
            phone: storeFormData.phone,
            email: selectedOwner?.email || storeFormData.ownerEmail, // Priority to owner object
            plan: selectedOwner?.plan || storeFormData.plan,
            telegram_bot_token: storeFormData.telegramBotToken,
            telegram_chat_id: storeFormData.telegramChatId,
            enable_sales_performance: storeFormData.enableSalesPerformance || false,
            pet_care_enabled: storeFormData.petCareEnabled || false
        };

        // Calculate Expiry 
        if (selectedOwner) {
            // Inherit from owner
            planData.plan_expiry_date = selectedOwner.planExpiryDate || selectedOwner.plan_expiry_date || null;
        } else if (storeFormData.plan !== 'free') {
            const months = parseInt(storeFormData.duration);
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + months);
            planData.plan_expiry_date = expiryDate.toISOString();
        } else {
            planData.plan_expiry_date = null;
        }

        if (editingStore) {
            const result = await updateStore(editingStore.id, planData);
            if (result.success) {
                setIsStoreModalOpen(false);
            } else {
                showAlert('Failed', 'Failed to update store');
            }
        } else {
            // If Super Admin is viewing a specific owner, assign the store to that owner
            const finalStoreData = { ...planData };
            if (user?.role === 'super_admin' && selectedOwner) {
                finalStoreData.owner_id = selectedOwner.id;
            }

            const result = await addStore(finalStoreData);
            if (result.success) {
                setIsStoreModalOpen(false);
            } else {
                showAlert('Failed', result.error || 'Failed to add store');
            }
        }
    };

    const handleSelectStore = (id) => {
        setSelectedStoreId(id);
        showAlert('Success', `Switched to store view. Go to Dashboard/POS to manage.`);
    };

    const openUserModal = async (store) => {
        setManagingStore(store);
        const users = await fetchUsersByStore(store.id);
        setStoreUsers(users);
        setIsUserModalOpen(true);
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!managingStore) return;

        const result = await addUser({
            ...newUser,
            pin: newUser.password, // Sync for backward compatibility
            store_id: managingStore.id,
            store_name: managingStore.name // Denormalize for easier login check
        });

        if (result.success) {
            // Refresh user list
            const users = await fetchUsersByStore(managingStore.id);
            setStoreUsers(users);
            setNewUser({ name: '', email: '', password: '', role: 'staff' });
            showAlert('Success', 'User added successfully');
        } else {
            showAlert('Failed', result.error || 'Failed to add user');
        }
    };

    const handleDeleteStore = (storeId) => {
        showConfirm(
            'Delete Store',
            'Are you sure? This will delete the store.',
            () => deleteStore(storeId)
        );
    };

    const getPlanBadgeColor = (plan) => {
        switch (plan) {
            case 'pro': return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200';
            case 'enterprise': return 'bg-purple-100 text-purple-700 hover:bg-purple-200';
            default: return 'bg-slate-100 text-slate-700 hover:bg-slate-200';
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Store Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your stores, plans, and staff members
                        {user?.role !== 'super_admin' && maxStoresAllowed > 0 && (
                            <span className="ml-2 text-sm">
                                (Toko: {visibleStores.length}/{maxStoresAllowed})
                            </span>
                        )}
                    </p>
                </div>
                {canAddStore ? (
                    <Button onClick={() => handleOpenStoreModal()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Store
                    </Button>
                ) : (
                    <Button variant="outline" disabled title="Upgrade untuk menambah toko">
                        <Plus className="h-4 w-4 mr-2" />
                        Limit Tercapai
                    </Button>
                )}
            </div>


            {user?.role === 'super_admin' && viewMode === 'owners' && !selectedOwner ? (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Owner Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Plan (Owner)</TableHead>
                                <TableHead className="text-center">Store Usage</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {owners.map(owner => (
                                <TableRow key={owner.id || owner.email}>
                                    <TableCell className="font-medium">{owner.name}</TableCell>
                                    <TableCell>{owner.email}</TableCell>
                                    <TableCell>
                                        <Badge className={getPlanBadgeColor(owner.plan)}>
                                            {owner.plan.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-semibold">{owner.totalStores} / {owner.maxStores}</span>
                                            {owner.totalStores >= owner.maxStores && owner.maxStores !== -1 && (
                                                <Badge variant="destructive" className="text-[10px] py-0 mt-0.5">LIMIT REACHED</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedOwner(owner);
                                            }}
                                        >
                                            <Store className="h-4 w-4 mr-2" />
                                            View Stores
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <>
                    {/* Breadcrumb for Super Admin when viewing specific owner */}
                    {user?.role === 'super_admin' && selectedOwner && (
                        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                            <span
                                className="cursor-pointer hover:text-primary hover:underline"
                                onClick={() => setSelectedOwner(null)}
                            >
                                Owners
                            </span>
                            <ChevronRight className="h-4 w-4" />
                            <span className="font-semibold text-foreground">{selectedOwner.name}</span>
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {visibleStores && visibleStores.map(store => {
                            if (!store) return null;
                            return (
                                <Card key={store.id} className={selectedStoreId === store.id ? 'border-primary ring-1 ring-primary' : ''}>
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Store className="h-6 w-6 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">{store.name}</CardTitle>
                                                    <div className="flex gap-2 mt-1">
                                                        {selectedStoreId === store.id && (
                                                            <Badge variant="success" className="bg-green-100 text-green-700">Active</Badge>
                                                        )}
                                                        {/* Show STORE-level plan badge (inherited or specific) */}
                                                        <Badge className={getPlanBadgeColor(store.plan)}>
                                                            {store.plan ? store.plan.toUpperCase() : 'FREE'}
                                                        </Badge>
                                                    </div>
                                                    {store.plan_expiry_date && store.plan !== 'free' && (
                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                            Exp: {new Date(store.plan_expiry_date).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <MapPin className="h-4 w-4" />
                                                <span>{store.address || 'No Address'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Phone className="h-4 w-4" />
                                                <span>{store.phone || 'No Phone'}</span>
                                            </div>
                                            {store.telegramBotToken && (
                                                <div className="flex items-center gap-2 text-green-600">
                                                    <MessageCircle className="h-4 w-4" />
                                                    <span>Telegram Configured</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                variant={selectedStoreId === store.id ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleSelectStore(store.id)}
                                            >
                                                {selectedStoreId === store.id ? 'Active' : 'Select'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenStoreModal(store)}
                                                title="Edit Store"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openUserModal(store)}
                                                title="Manage Users"
                                            >
                                                <Users className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteStore(store.id)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Add/Edit Store Modal */}
            <Dialog open={isStoreModalOpen} onOpenChange={setIsStoreModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingStore ? 'Edit Store' : 'Add New Store'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveStore} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="storeName">Store Name</Label>
                            <Input
                                id="storeName"
                                type="text"
                                required
                                value={storeFormData.name}
                                onChange={e => setStoreFormData({ ...storeFormData, name: e.target.value })}
                            />
                        </div>
                        {user?.role === 'super_admin' && (!selectedOwner || editingStore) && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="ownerEmail">Owner Email (Register with this email to link)</Label>
                                    <Input
                                        id="ownerEmail"
                                        type="email"
                                        required
                                        value={storeFormData.ownerEmail}
                                        onChange={e => setStoreFormData({ ...storeFormData, ownerEmail: e.target.value })}
                                        placeholder="owner@example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="plan">Subscription Plan</Label>
                                    <Select
                                        value={storeFormData.plan}
                                        onValueChange={(value) => setStoreFormData({ ...storeFormData, plan: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="free">Free (Starter)</SelectItem>
                                            <SelectItem value="pro">Pro</SelectItem>
                                            <SelectItem value="enterprise">Enterprise</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {storeFormData.plan !== 'free' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="duration">Duration</Label>
                                        <Select
                                            value={storeFormData.duration?.toString()}
                                            onValueChange={(value) => setStoreFormData({ ...storeFormData, duration: parseInt(value) })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Duration" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                                    <SelectItem key={month} value={month.toString()}>
                                                        {month} Month{month > 1 ? 's' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                type="text"
                                value={storeFormData.address}
                                onChange={e => setStoreFormData({ ...storeFormData, address: e.target.value })}
                            />
                        </div>

                        {user?.role === 'super_admin' && (
                            <div className={`flex items-center justify-between p-3 rounded-lg border ${storeFormData.plan === 'enterprise' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                                <div>
                                    <Label className={`flex items-center gap-2 ${storeFormData.plan === 'enterprise' ? 'text-amber-900' : 'text-slate-500'}`}>
                                        Aktifkan Fitur Pet Hotel
                                    </Label>
                                    <p className={`text-xs mt-1 ${storeFormData.plan === 'enterprise' ? 'text-amber-700/80' : 'text-slate-400'}`}>
                                        {storeFormData.plan === 'enterprise'
                                            ? 'Mengaktifkan Modul Pet Hotel & Laporan Fee'
                                            : 'Fitur khusus paket Enterprise'}
                                    </p>
                                </div>
                                <Switch
                                    checked={storeFormData.petCareEnabled || false}
                                    onCheckedChange={(checked) => setStoreFormData({ ...storeFormData, petCareEnabled: checked })}
                                    disabled={storeFormData.plan !== 'enterprise'}
                                    className="data-[state=checked]:bg-amber-600"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                type="text"
                                value={storeFormData.phone}
                                onChange={e => setStoreFormData({ ...storeFormData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="telegramBot">Telegram Bot Token (Optional)</Label>
                            <Input
                                id="telegramBot"
                                type="text"
                                value={storeFormData.telegramBotToken}
                                onChange={e => setStoreFormData({ ...storeFormData, telegramBotToken: e.target.value })}
                                placeholder="123456:ABC-..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="telegramChat">Telegram Chat ID (Optional)</Label>
                            <Input
                                id="telegramChat"
                                type="text"
                                value={storeFormData.telegramChatId}
                                onChange={e => setStoreFormData({ ...storeFormData, telegramChatId: e.target.value })}
                                placeholder="-100..."
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsStoreModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">{editingStore ? 'Update Store' : 'Create Store'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Manage Users Modal */}
            <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Manage Users - {managingStore?.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Add New User</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleAddUser} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="userName">Name</Label>
                                            <Input
                                                id="userName"
                                                type="text"
                                                required
                                                value={newUser.name}
                                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                                placeholder="e.g. Kasir 1"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="userEmail">Email (Optional)</Label>
                                            <Input
                                                id="userEmail"
                                                type="email"
                                                value={newUser.email}
                                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                                placeholder="name@email.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="userPassword">Password</Label>
                                            <div className="relative">
                                                <Input
                                                    id="userPassword"
                                                    type={showPassword ? "text" : "password"}
                                                    required
                                                    value={newUser.password}
                                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                                    placeholder="Enter password"
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
                                        <div className="space-y-2">
                                            <Label htmlFor="userRole">Role</Label>
                                            <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                                                <SelectTrigger id="userRole">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="staff">Kasir</SelectItem>
                                                    <SelectItem value="sales">Sales</SelectItem>
                                                    <SelectItem value="admin">Store Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add User
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <div>
                            <h3 className="text-lg font-semibold mb-3">Existing Users</h3>
                            {storeUsers.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No users found for this store.</p>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead>Password</TableHead>
                                                <TableHead>Created At</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {storeUsers.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell className="font-medium">{user.name}</TableCell>
                                                    <TableCell>{user.email || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={(user.role === 'admin' || user.role === 'owner') ? 'default' : user.role === 'sales' ? 'outline' : 'secondary'}>
                                                            {(user.role === 'admin' || user.role === 'owner') ? 'Admin' : user.role === 'sales' ? 'Sales' : 'Kasir'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{user.password || user.pin || '******'}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {new Date(user.created_at || user.createdAt).toLocaleDateString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
        </div>
    );
};

export default Stores;
