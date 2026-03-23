import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { LogIn, LogOut, Settings, Plus, Home, Heart, CreditCard, Banknote, Edit2, Link as LinkIcon, Printer, CheckCircle, Trash2, Coffee, X, Wallet, Bed } from 'lucide-react';
import { InfoCard } from '../components/ui/info-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { printReceiptBrowser } from '../lib/receiptHelper';
import { useShift } from '../context/ShiftContext';
import { useAuth } from '../context/AuthContext';
import { createServiceTransaction, calculateCommissionAmount } from '../lib/createServiceTransaction';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Tunai', icon: <Banknote className="h-4 w-4" /> },
    { value: 'transfer', label: 'Transfer', icon: <CreditCard className="h-4 w-4" /> },
    { value: 'qris', label: 'QRIS', icon: <CreditCard className="h-4 w-4" /> }, // Assuming CreditCard for QRIS icon since Wallet is missing in some lucide sets
];

const PetHotelDashboard = () => {
    const { petRooms, products, fetchAllProducts, fetchPetServices, petServices, pets, customers, petBookings, addPetBooking, updatePetBooking, addPetRoom, updatePetRoom, deletePetRoom, activeStoreId, stores, processSale } = useData();
    const { user, checkPermission } = useAuth();
    const { currentShift } = useShift();

    const [isManageRoomsOpen, setIsManageRoomsOpen] = useState(false);
    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
    const [isEditBookingOpen, setIsEditBookingOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);

    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [roomToDelete, setRoomToDelete] = useState(null);

    // --- ADD-ON STATE ---
    const [isAddOnOpen, setIsAddOnOpen] = useState(false);
    const [addOnBooking, setAddOnBooking] = useState(null);
    const [addOnRoom, setAddOnRoom] = useState(null);
    const [addOnQty, setAddOnQty] = useState(1);
    const [addOnProductId, setAddOnProductId] = useState('');
    // Ensure all products and services are loaded globally for this module
    useEffect(() => {
        const loadProducts = async () => {
            if (activeStoreId) {
                await fetchAllProducts(activeStoreId, false);
                await fetchPetServices();
            }
        };
        loadProducts();
    }, [activeStoreId, fetchAllProducts, fetchPetServices]);

    // Hotel room link: only use products/services with rental pricing types (daily, hourly, minutely)
    // and matching keywords related to hotel/room/stay
    const hotelProducts = [
        ...(products || []),
        ...(petServices || []).map(s => ({ ...s, pricingType: 'fixed' })) // Services are usually fixed, but we keep them if keywords match (or only products if strictly "sewa")
    ].filter(p => {
        const pricingType = p.pricingType || p.pricing_type;
        const isRental = ['hourly', 'minutely', 'daily'].includes(pricingType);
        
        const catName = (p.category || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        const hasKeyword = ['hotel', 'kamar', 'room', 'penginapan'].some(k => 
            catName.includes(k) || name.includes(k)
        );

        // Strict: Must be a rental model AND have a keyword
        // or just rental model if specifically requested "only sewa"
        return isRental && (catName === 'hotel_addon' || hasKeyword);
    }).map(p => ({
        id: p.id,
        value: p.id,
        label: p.name,
        price: p.sellPrice || p.price || 0,
        subLabel: `Rp ${parseInt(p.sellPrice || p.price || 0).toLocaleString()} / ${p.pricingType === 'daily' ? 'Malam' : (p.pricingType === 'hourly' ? 'Jam' : 'Sesi')}`,
        pricingType: p.pricingType || p.pricing_type,
        commissions: p.commissions || p.commission || {},
        doctorFeeType: p.doctorFeeType || p.doctor_fee_type,
        doctorFeeValue: p.doctorFeeValue || p.doctor_fee_value
    }));


    // Stats
    const totalRooms = petRooms.length;
    const occupiedRooms = petRooms.filter(r => r.status === 'occupied').length;
    const availableRooms = totalRooms - occupiedRooms;

    // --- MANAGE ROOMS LOGIC ---
    const [editingRoom, setEditingRoom] = useState(null);
    const [roomFormData, setRoomFormData] = useState({ name: '', linkedServiceId: '' });

    const handleOpenManageRooms = () => {
        setEditingRoom(null);
        setRoomFormData({ name: '', linkedServiceId: '' });
        setIsManageRoomsOpen(true);
    };

    const handleSaveRoom = async () => {
        if (!roomFormData.name || !roomFormData.linkedServiceId) return;

        // Since DB expects snake_case for linkedServiceId, map it here
        const dataToSave = {
            name: roomFormData.name,
            linked_service_id: roomFormData.linkedServiceId,
            status: editingRoom ? editingRoom.status : 'available'
        };

        let result;
        if (editingRoom) {
            result = await updatePetRoom(editingRoom.id, dataToSave);
        } else {
            result = await addPetRoom(dataToSave);
        }

        if (result.success) {
            setEditingRoom(null);
            setRoomFormData({ name: '', linkedServiceId: '' });
        } else {
            setAlertData({ title: 'Gagal', message: 'Gagal menyimpan kamar: ' + result.error });
            setIsAlertOpen(true);
        }
    };

    const handleDeleteRoom = (id) => {
        setRoomToDelete(id);
        setIsDeleteOpen(true);
    };

    const confirmDeleteRoom = async () => {
        if (roomToDelete) {
            await deletePetRoom(roomToDelete);
            setIsDeleteOpen(false);
            setRoomToDelete(null);
        }
    };

    // --- CHECK-IN LOGIC ---
    const [checkInData, setCheckInData] = useState({
        petId: '',
        customerId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: ''
    });

    const [editBookingData, setEditBookingData] = useState({
        id: '',
        startDate: '',
        endDate: '',
        notes: ''
    });

    const handleOpenEditBooking = (room, booking) => {
        setSelectedRoom(room);
        setEditBookingData({
            id: booking.id,
            startDate: booking.startDate,
            endDate: booking.endDate,
            notes: booking.notes || ''
        });
        setIsEditBookingOpen(true);
    };

    const handleUpdateBookingDetails = async () => {
        if (!editBookingData.id || !editBookingData.endDate) return;

        const result = await updatePetBooking(editBookingData.id, {
            startDate: editBookingData.startDate,
            endDate: editBookingData.endDate,
            notes: editBookingData.notes
        });

        if (result.success) {
            setIsEditBookingOpen(false);
        } else {
            setAlertData({ title: 'Gagal', message: 'Gagal memperbarui catatan: ' + result.error });
            setIsAlertOpen(true);
        }
    };

    const handleOpenCheckIn = (room) => {
        setSelectedRoom(room);
        setCheckInData({
            petId: '',
            customerId: '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: '',
            notes: ''
        });
        setIsCheckInOpen(true);
    };

    const handleCheckIn = async () => {
        if (!selectedRoom || !checkInData.petId || !checkInData.startDate || !checkInData.endDate) return;

        // 1. Create Booking record
        const bookingData = {
            petId: checkInData.petId,
            customerId: checkInData.customerId,
            serviceType: 'hotel',
            startDate: checkInData.startDate,
            endDate: checkInData.endDate,
            roomId: selectedRoom.id,
            status: 'confirmed',
            paymentStatus: 'unpaid',
            notes: checkInData.notes,
            serviceId: selectedRoom.linkedServiceId || null
        };

        const result = await addPetBooking(bookingData);
        if (result.success) {
            // 2. Update Room Status
            await updatePetRoom(selectedRoom.id, {
                status: 'occupied',
                current_booking_id: result.data.id
            });
            setIsCheckInOpen(false);
        } else {
            setAlertData({ title: 'Gagal', message: 'Gagal Check-in: ' + result.error });
            setIsAlertOpen(true);
        }
    };

    const handlePetChange = (id) => {
        const pet = pets.find(p => p.id === id);
        setCheckInData(prev => ({ 
            ...prev, 
            petId: id, 
            customerId: pet?.customerId || '' 
        }));
    };

    // --- CHECK-OUT LOGIC ---
    const [checkOutData, setCheckOutData] = useState({ paymentMethod: 'cash', amountPaid: '' });
    const [activeBooking, setActiveBooking] = useState(null);

    const handleOpenCheckOut = (room) => {
        setSelectedRoom(room);
        const booking = petBookings.find(b => b.id === room.currentBookingId);
        setActiveBooking(booking);
        setCheckOutData({ paymentMethod: 'cash', amountPaid: '' });
        setIsCheckOutOpen(true);
    };

    const productForRoom = (room) => room ? hotelProducts.find(p => p.value === room.linkedServiceId) : null;

    // Combine products and petServices for add-on items
    const combinedAddOnOptions = [
        ...products.map(p => ({
            id: p.id,
            name: p.name,
            sellPrice: p.sellPrice || p.price || 0,
            category: p.category,
            source: 'product'
        })),
        ...(petServices || []).map(s => ({
            id: s.id,
            name: s.name,
            sellPrice: s.price || 0,
            category: s.category,
            source: 'service',
            commissions: s.commissions || {},
            doctorFeeType: s.doctorFeeType,
            doctorFeeValue: s.doctorFeeValue
        }))
    ];

    const addOnOptions = combinedAddOnOptions.map(item => ({
        value: item.id,
        label: item.name,
        subLabel: `Rp ${parseInt(item.sellPrice || 0).toLocaleString()} ${item.category ? `• ${typeof item.category === 'string' ? item.category : item.category.name}` : ''}`
    }));

    // --- ADD-ON LOGIC ---
    const handleOpenAddOn = (room) => {
        const booking = petBookings.find(b => b.id === room.currentBookingId);
        setAddOnRoom(room);
        setAddOnBooking(booking);
        setAddOnProductId('');
        setAddOnQty(1);
        setIsAddOnOpen(true);
    };

    const handleAddItem = async () => {
        if (!addOnBooking || !addOnProductId) return;
        const itemObj = combinedAddOnOptions.find(item => item.id === addOnProductId);
        if (!itemObj) return;

        const newItem = {
            id: itemObj.id,
            name: itemObj.name,
            price: Number(itemObj.sellPrice || 0),
            qty: Number(addOnQty) || 1,
            total: Number(itemObj.sellPrice || 0) * (Number(addOnQty) || 1),
            commissions: itemObj.commissions,
            doctorFeeType: itemObj.doctorFeeType,
            doctorFeeValue: itemObj.doctorFeeValue
        };

        const existingItems = addOnBooking.extraItems || [];
        const updated = [...existingItems, newItem];

        await updatePetBooking(addOnBooking.id, { ...addOnBooking, extraItems: updated });
        setAddOnBooking(prev => ({ ...prev, extraItems: updated }));
        setAddOnProductId('');
        setAddOnQty(1);
    };

    const handleRemoveAddOn = async (idx) => {
        if (!addOnBooking) return;
        const updated = (addOnBooking.extraItems || []).filter((_, i) => i !== idx);
        await updatePetBooking(addOnBooking.id, { ...addOnBooking, extraItems: updated });
        setAddOnBooking(prev => ({ ...prev, extraItems: updated }));
    };

    // Billing Calculation (includes extra_items)
    const calculateBill = (booking, room) => {
        if (!booking) return { nights: 0, total: 0 };
        
        const prod = productForRoom(room);
        const pricePerNight = prod ? Number(prod.price) : 0;
        
        const start = new Date(booking.startDate);
        const end = new Date(); // Actual checkout happens NOW
        
        // Calculate nights (minimum 1)
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const nights = Math.max(1, diffDays);
        const roomTotal = nights * pricePerNight;

        // Sum add-on items
        const extraTotal = (booking.extraItems || []).reduce((sum, item) => sum + (item.price * item.qty), 0);

        return {
            days: nights,
            price: pricePerNight,
            roomTotal,
            extraTotal,
            total: roomTotal + extraTotal
        };
    };

    const handleCheckOut = async () => {
        if (!selectedRoom || !activeBooking) return;
        
        const bill = calculateBill(activeBooking, selectedRoom);
        
        // 1. Update Booking
        await updatePetBooking(activeBooking.id, {
            ...activeBooking,
            status: 'completed',
            paymentStatus: 'paid',
            totalPrice: bill.total // Store final price
        });

        // 2. Update Room (Free it up)
        await updatePetRoom(selectedRoom.id, {
            status: 'available',
            current_booking_id: null
        });

        // 3. Print receipt logic here
        const activeStore = stores?.find(s => s.id === activeStoreId);
        const customer = customers.find(c => c.id === activeBooking.customerId);
        
        const receipt = {
            id: activeBooking.id,
            date: new Date().toISOString(),
            cashier: 'Staff',
            customerName: customer?.name || '',
            paymentMethod: checkOutData.paymentMethod,
            amountPaid: checkOutData.paymentMethod === 'cash' ? (Number(checkOutData.amountPaid) || bill.total) : bill.total,
            change: checkOutData.paymentMethod === 'cash' ? Math.max(0, (Number(checkOutData.amountPaid) || bill.total) - bill.total) : 0,
            subtotal: bill.total,
            total: bill.total,
            items: [
                {
                    name: `Hotel - ${selectedRoom.name} (${bill.days} malam)`,
                    qty: bill.days,
                    price: bill.price,
                    unit: 'malam',
                    discount: 0,
                },
                ...(activeBooking.extraItems || []).map(item => ({
                    name: item.name,
                    qty: item.qty,
                    price: item.price,
                    unit: '',
                    discount: 0,
                }))
            ],
            notes: activeBooking.notes || '',
        };

        // --- Start Transaction Logic ---
        const paid = checkOutData.paymentMethod === 'cash' ? (Number(checkOutData.amountPaid) || bill.total) : bill.total;
        const change = checkOutData.paymentMethod === 'cash' ? Math.max(0, paid - bill.total) : 0;

        const roomProduct = productForRoom(selectedRoom);
        
        const transactionItem = {
            id: `hotel-${selectedRoom.id}`,
            name: `Hotel - ${selectedRoom.name} (${bill.days} malam)`,
            price: bill.roomTotal,
            qty: 1,
            unit: 'malam',
            discount: 0,
            total: bill.roomTotal,
            // Map Commissions
            doctorFeeType: roomProduct?.doctorFeeType,
            doctorFeeValue: roomProduct?.doctorFeeValue,
            doctorCommissionAmount: calculateCommissionAmount(bill.roomTotal, 1, roomProduct?.doctorFeeType, roomProduct?.doctorFeeValue),
            groomerCommissionAmount: calculateCommissionAmount(bill.roomTotal, 1, 'fixed', roomProduct?.commissions?.groomerFee), // Grooming / Paramedic set as fixed nominals from UI
            paramedicCommissionAmount: calculateCommissionAmount(bill.roomTotal, 1, 'fixed', roomProduct?.commissions?.paramedicFee),
            cashierCommissionAmount: calculateCommissionAmount(bill.roomTotal, 1, 'fixed', roomProduct?.commissions?.cashierFee)
        };

        // Extra add-on items as separate transaction items
        const extraTxItems = (activeBooking.extraItems || []).map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            unit: '',
            discount: 0,
            total: item.price * item.qty,
            // Map Add-on Commissions
            doctorFeeType: item.doctorFeeType,
            doctorFeeValue: item.doctorFeeValue,
            doctorCommissionAmount: calculateCommissionAmount(item.price, item.qty, item.doctorFeeType, item.doctorFeeValue),
            groomerCommissionAmount: calculateCommissionAmount(item.price, item.qty, 'fixed', item.commissions?.groomerFee),
            paramedicCommissionAmount: calculateCommissionAmount(item.price, item.qty, 'fixed', item.commissions?.paramedicFee),
            cashierCommissionAmount: calculateCommissionAmount(item.price, item.qty, 'fixed', item.commissions?.cashierFee)
        }));

        const txData = createServiceTransaction({
            items: [transactionItem, ...extraTxItems],
            total: bill.total,
            paymentMethod: checkOutData.paymentMethod,
            amountPaid: paid,
            change: change,
            customer: { id: activeBooking.customerId || null, name: pets.find(p => p.id === activeBooking.petId)?.name || 'Umum' },
            store: activeStore,
            user: user,
            shiftId: currentShift?.id,
            notes: `Check-out Kamar: ${selectedRoom.name}. HewanId: ${activeBooking.petId}`
        });

        if (activeStore) {
            const txResult = await processSale(txData);
            if (!txResult.success) {
                console.error("Gagal mencatat transaksi POS", txResult.error);
            }
            printReceiptBrowser(receipt, activeStore);
        }
        // --- End Transaction Logic ---

        setIsCheckOutOpen(false);
    };


    return (
        <div className="p-6 space-y-6 w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <Home className="h-6 w-6 text-indigo-600" />
                        Hotel Hewan (Kamar)
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Kelola check-in, check-out, dan status kamar harian.</p>
                </div>
                {checkPermission('clinic.rooms') && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleOpenManageRooms} className="bg-white hover:bg-slate-50 border-slate-200">
                            <Settings className="h-4 w-4 mr-2" />
                            Kelola Kamar & Tarif
                        </Button>
                    </div>
                )}
            </div>

            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-outfit">
                <InfoCard
                    title="Total Kamar"
                    value={totalRooms}
                    icon={Home}
                    variant="primary"
                    className="border-l-4 border-indigo-500"
                />
                <InfoCard
                    title="Tersedia"
                    value={availableRooms}
                    icon={CheckCircle}
                    variant="success"
                    className="border-l-4 border-emerald-500"
                />
                <InfoCard
                    title="Terisi"
                    value={occupiedRooms}
                    icon={Bed}
                    variant="info"
                    className="border-l-4 border-blue-500"
                />
            </div>

            {/* ROOMS GRID */}
            {petRooms.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <Home className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-lg font-bold text-slate-700">Belum ada kamar</h3>
                    <p className="text-slate-500 mb-4">Silakan atur master kamar dan set tarif terlebih dahulu.</p>
                    {checkPermission('clinic.rooms') && (
                        <Button onClick={() => setIsManageRoomsOpen(true)}>
                            <Settings className="w-4 h-4 mr-2" /> Kelola Kamar
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
                    {petRooms.map(room => {
                        const product = productForRoom(room);
                        const isOccupied = room.status === 'occupied';
                        const booking = isOccupied ? petBookings.find(b => b.id === room.currentBookingId) : null;
                        const pet = booking ? pets.find(p => p.id === booking.petId) : null;
                        
                        return (
                            <Card key={room.id} className={`flex flex-col overflow-hidden transition-all ${isOccupied ? 'border-blue-300 ring-2 ring-blue-100 bg-blue-50/30' : 'hover:border-indigo-300 hover:shadow-md bg-white'}`}>
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                                <Home className={`w-5 h-5 ${isOccupied ? 'text-blue-600 fill-blue-100' : 'text-slate-400'}`} />
                                                {room.name}
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                <LinkIcon className="w-3 h-3" />
                                                {product ? `${product.label} (Rp ${parseInt(product.price || 0).toLocaleString()}/malam)` : 'Belum Atur Tarif'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={isOccupied ? "default" : "outline"} className={isOccupied ? "bg-blue-600" : "text-green-600 border-green-200 bg-green-50"}>
                                                {isOccupied ? "Terisi" : "Tersedia"}
                                            </Badge>
                                            {isOccupied && booking && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                                    onClick={() => handleOpenEditBooking(room, booking)}
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                
                                <CardContent className="flex-1 p-4 pt-2 flex flex-col justify-center">
                                    {isOccupied && booking && pet ? (
                                        <div className="bg-white rounded border border-blue-100 p-3 space-y-2">
                                            <div className="flex items-center gap-2 font-bold text-slate-800">
                                                <Heart className="w-4 h-4 text-pink-500 fill-pink-100" />
                                                {pet.name} <span className="text-xs font-normal text-slate-500">({pet.petType})</span>
                                            </div>
                                            <div className="text-xs space-y-1 text-slate-600">
                                                <div className="flex justify-between">
                                                    <span>In:</span>
                                                    <span className="font-medium text-slate-800">{new Date(booking.startDate).toLocaleDateString('id-ID')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Est. Out:</span>
                                                    <span className="font-medium text-slate-800">{new Date(booking.endDate).toLocaleDateString('id-ID')}</span>
                                                </div>
                                                {booking.notes && (
                                                    <div className="mt-2 pt-2 border-t border-blue-50 text-left">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Catatan:</p>
                                                        <p className="text-[11px] leading-relaxed text-slate-600 italic">"{booking.notes}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-slate-400">
                                            <p className="text-sm">Siap untuk tamu baru</p>
                                        </div>
                                    )}
                                </CardContent>
                                 <CardFooter className="p-3 bg-slate-50/50 border-t gap-2">
                                    {isOccupied ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 h-9 border-amber-200 text-amber-700 hover:bg-amber-50"
                                                onClick={() => handleOpenAddOn(room)}
                                            >
                                                <Coffee className="w-4 h-4 mr-1" /> + Menu
                                            </Button>
                                            <Button className="flex-1 h-9 bg-blue-600 hover:bg-blue-700" size="sm" onClick={() => handleOpenCheckOut(room)}>
                                                <LogOut className="w-4 h-4 mr-1" /> Check-out
                                            </Button>
                                        </>
                                    ) : (
                                        <Button 
                                            variant="outline" 
                                            className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50" 
                                            onClick={() => handleOpenCheckIn(room)}
                                            disabled={!product}
                                        >
                                            <LogIn className="w-4 h-4 mr-2" /> Check-in
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* --- CHECK-IN MODAL --- */}
            <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Check-in Kamar {selectedRoom?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Tamu (Hewan) <span className="text-red-500">*</span></Label>
                            <SearchableSelect
                                options={pets.map(p => {
                                    const customer = customers.find(c => c.id === p.customerId);
                                    return {
                                        value: p.id,
                                        label: p.name,
                                        subLabel: `${p.petType || ''} • ${customer?.name || 'No Owner'}`
                                    };
                                })}
                                value={checkInData.petId}
                                onValueChange={handlePetChange}
                                placeholder="Pilih Hewan"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Check-in <span className="text-red-500">*</span></Label>
                                <Input type="date" value={checkInData.startDate} onChange={e => setCheckInData({...checkInData, startDate: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Rencana Check-out <span className="text-red-500">*</span></Label>
                                <Input type="date" value={checkInData.endDate} onChange={e => setCheckInData({...checkInData, endDate: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Catatan Penitipan</Label>
                            <Input placeholder="Makan khusus, obat, dll..." value={checkInData.notes} onChange={e => setCheckInData({...checkInData, notes: e.target.value})} />
                        </div>
                        
                        {/* Summary Box */}
                        {productForRoom(selectedRoom) && (
                            <div className="bg-indigo-50 p-3 rounded border border-indigo-100 text-sm">
                                <div className="flex justify-between font-medium text-indigo-900">
                                    <span>Tarif Kamar:</span>
                                    <span>Rp {parseInt(productForRoom(selectedRoom).price || 0).toLocaleString()}/malam</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCheckInOpen(false)}>Batal</Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleCheckIn} disabled={!checkInData.petId || !checkInData.endDate}>
                            <LogIn className="w-4 h-4 mr-2" /> Check-in Sekarang
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- CHECK-OUT & BAYAR MODAL --- */}
            <Dialog open={isCheckOutOpen} onOpenChange={setIsCheckOutOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Check-out & Bayar</DialogTitle>
                    </DialogHeader>
                    {activeBooking && selectedRoom && (
                        <div className="space-y-4 py-2">
                            <div className="bg-slate-50 p-4 rounded-lg border space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Kamar:</span>
                                    <span className="font-bold">{selectedRoom.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Hewan:</span>
                                    <span className="font-bold">{pets.find(p => p.id === activeBooking.petId)?.name || '-'}</span>
                                </div>
                                <div className="border-t pt-2 mt-2 flex justify-between">
                                    <span className="text-slate-500">Durasi Inap:</span>
                                    <span className="font-bold">{calculateBill(activeBooking, selectedRoom).days} Malam</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Tarif Kamar:</span>
                                    <span className="font-semibold">Rp {calculateBill(activeBooking, selectedRoom).roomTotal?.toLocaleString()}</span>
                                </div>
                                {(activeBooking.extraItems || []).length > 0 && (
                                    <div className="border-t pt-2 mt-1 space-y-1">
                                        <span className="text-xs text-slate-500 font-semibold uppercase">Add-on / Menu</span>
                                        {(activeBooking.extraItems || []).map((item, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span>{item.qty}x {item.name}</span>
                                                <span>Rp {(item.price * item.qty).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-base pt-1 border-t mt-1">
                                    <span className="font-bold text-slate-800">Total Tagihan:</span>
                                    <span className="font-black text-blue-600">Rp {calculateBill(activeBooking, selectedRoom).total.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label>Metode Pembayaran</Label>
                                <div className="flex gap-2">
                                    {PAYMENT_METHODS.map(({ value, label, icon }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setCheckOutData({...checkOutData, paymentMethod: value})}
                                            className={`flex-1 flex flex-col items-center justify-center gap-1 p-3 rounded-lg border-2 text-xs font-semibold transition-all ${
                                                checkOutData.paymentMethod === value
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                            }`}
                                        >
                                            {icon} {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {checkOutData.paymentMethod === 'cash' && (
                                <div className="space-y-2">
                                    <Label>Uang Diterima (kosongkan = pas)</Label>
                                    <Input 
                                        type="number" 
                                        placeholder={`Min. Rp ${calculateBill(activeBooking, selectedRoom).total.toLocaleString()}`}
                                        value={checkOutData.amountPaid}
                                        onChange={e => setCheckOutData({...checkOutData, amountPaid: e.target.value})}
                                    />
                                    {Number(checkOutData.amountPaid) > calculateBill(activeBooking, selectedRoom).total && (
                                        <div className="text-right text-sm font-bold text-amber-600">
                                            Kembalian: Rp {(Number(checkOutData.amountPaid) - calculateBill(activeBooking, selectedRoom).total).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCheckOutOpen(false)}>Batal</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCheckOut}>
                            <Printer className="w-4 h-4 mr-2" /> Selesaikan & Cetak
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- ADD-ON DIALOG --- */}
            <Dialog open={isAddOnOpen} onOpenChange={setIsAddOnOpen}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Coffee className="h-5 w-5 text-amber-600" />
                            Tambah Menu / Add-on — {addOnRoom?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Add item form */}
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <SearchableSelect 
                                    options={addOnOptions}
                                    value={addOnProductId} 
                                    onValueChange={setAddOnProductId}
                                    placeholder="Pilih produk..."
                                />
                            </div>
                            <Input
                                type="number"
                                min="1"
                                value={addOnQty}
                                onChange={e => setAddOnQty(e.target.value)}
                                className="w-16"
                                placeholder="Qty"
                            />
                            <Button onClick={handleAddItem} disabled={!addOnProductId} className="bg-amber-500 hover:bg-amber-600 text-white shrink-0">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Item list */}
                        {(addOnBooking?.extraItems || []).length > 0 ? (
                            <div className="space-y-1 border rounded-md p-2 max-h-[220px] overflow-y-auto">
                                {(addOnBooking?.extraItems || []).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm p-1.5 hover:bg-slate-50 rounded">
                                        <span>{item.qty}x {item.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">Rp {(item.price * item.qty).toLocaleString()}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveAddOn(idx)}>
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <div className="border-t pt-1 mt-1 flex justify-between text-sm font-bold px-1">
                                    <span>Subtotal Add-on:</span>
                                    <span>Rp {(addOnBooking?.extraItems || []).reduce((s, i) => s + i.price * i.qty, 0).toLocaleString()}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-slate-50/50 text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                                <Coffee className="h-8 w-8 opacity-20" />
                                <span>Belum ada item tambahan untuk pesanan ini</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOnOpen(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditBookingOpen} onOpenChange={setIsEditBookingOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit2 className="h-5 w-5 text-blue-600" />
                            Ubah Detail Penitipan — {selectedRoom?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Tanggal Masuk</Label>
                            <Input 
                                type="date" 
                                value={editBookingData.startDate} 
                                onChange={e => setEditBookingData({...editBookingData, startDate: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Estimasi Keluar</Label>
                            <Input 
                                type="date" 
                                value={editBookingData.endDate} 
                                onChange={e => setEditBookingData({...editBookingData, endDate: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Catatan Penitipan</Label>
                            <Input 
                                placeholder="Contoh: Alergi ayam, Makan 3x sehari..."
                                value={editBookingData.notes}
                                onChange={e => setEditBookingData({...editBookingData, notes: e.target.value})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditBookingOpen(false)}>Batal</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleUpdateBookingDetails}>
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- MANAGE ROOMS MODAL --- */}
            <Dialog open={isManageRoomsOpen} onOpenChange={setIsManageRoomsOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Kelola Kamar Hotel</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                        
                        {/* LEFT: FORM */}
                        <div className="md:col-span-1 space-y-4">
                            <h3 className="font-semibold text-sm text-slate-700 border-b pb-2">
                                {editingRoom ? 'Edit Kamar' : 'Tambah Kamar Baru'}
                            </h3>
                            <div className="space-y-2">
                                <Label>Nama Kamar <span className="text-red-500">*</span></Label>
                                <Input 
                                    placeholder="Contoh: Kucing VIP 01" 
                                    value={roomFormData.name} 
                                    onChange={e => setRoomFormData({...roomFormData, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Link Layanan (Tarif/Malam) <span className="text-red-500">*</span></Label>
                                <SearchableSelect 
                                    options={hotelProducts}
                                    value={roomFormData.linkedServiceId} 
                                    onValueChange={v => setRoomFormData({...roomFormData, linkedServiceId: v})}
                                    placeholder="Pilih Layanan (Tarif)"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                {editingRoom && (
                                    <Button variant="ghost" className="flex-1" onClick={() => { setEditingRoom(null); setRoomFormData({name:'', linkedServiceId:''}) }}>
                                        Batal Edit
                                    </Button>
                                )}
                                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveRoom} disabled={!roomFormData.name || !roomFormData.linkedServiceId}>
                                    {editingRoom ? 'Simpan' : 'Tambah'}
                                </Button>
                            </div>
                        </div>

                        {/* RIGHT: LIST */}
                        <div className="md:col-span-2 space-y-4">
                            <h3 className="font-semibold text-sm text-slate-700 border-b pb-2">
                                Daftar Kamar ({petRooms.length})
                            </h3>
                            <ScrollArea className="h-[400px] pr-4">
                                <div className="space-y-3">
                                    {petRooms.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic text-center py-6">Belum ada data kamar</p>
                                    ) : petRooms.map(room => {
                                        return (
                                            <div key={room.id} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                                <div>
                                                    <p className="font-bold text-slate-800">{room.name}</p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Tarif: {room.linkedServiceId ? (
                                                            <span className="font-medium text-indigo-600">{hotelProducts.find(p => p.value === room.linkedServiceId)?.subLabel || 'Rp 0'} / malam</span>
                                                        ) : (
                                                            <span className="text-red-500">Belum di-link</span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className={room.status === 'occupied' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}>

                                                        {room.status === 'occupied' ? 'Terisi' : 'Kosong'}
                                                    </Badge>
                                                    
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => {
                                                        setEditingRoom(room);
                                                        setRoomFormData({ name: room.name, linkedServiceId: room.linkedServiceId || '' });
                                                    }}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-red-600 hover:bg-red-50" 
                                                        disabled={room.status === 'occupied'}
                                                        onClick={() => handleDeleteRoom(room.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>

                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDeleteRoom}
                title="Hapus Kamar"
                description="Apakah Anda yakin ingin menghapus kamar ini? Tindakan ini tidak dapat dibatalkan."
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

export default PetHotelDashboard;
