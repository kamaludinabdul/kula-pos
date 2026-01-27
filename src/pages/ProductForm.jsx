import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import FormattedNumberInput from '../components/ui/FormattedNumberInput';
import { ArrowLeft, Upload, Save, X, Plus, Image as ImageIcon, ScanBarcode, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { supabase } from '../supabase';
import { compressImage } from '../utils/imageCompressor';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import AlertDialog from '../components/AlertDialog';
import { Checkbox } from '../components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '../components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import BarcodeScannerDialog from '../components/pos/BarcodeScannerDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';


const PRODUCT_TYPES = ['Default', 'Addon', 'Multisatuan', 'Varian', 'IMEI', 'Paket', 'Bahan Baku'];

const ProductForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { categories, products, addProduct, updateProduct, addCategory, activeStoreId } = useData();
    const isEditMode = !!id;

    const [formData, setFormData] = useState({
        type: 'Default',
        name: '',
        code: '',
        category: [], // Changed to array for multiple categories
        buyPrice: '',
        sellPrice: '',
        stockType: 'Barang',
        stock: '',
        minStock: '',
        weight: '',
        discount: 0,
        discountType: 'percent',
        shelf: '',
        image: null,
        // Unit Conversion
        unit: 'Pcs', // Base Stock Unit
        purchaseUnit: '', // e.g. Sak, Karton
        conversionToUnit: '', // e.g. 24 (1 Karton = 24 Pcs)
        pricingType: location.state?.pricingType || 'fixed', // 'fixed' | 'hourly'
        isUnlimited: location.state?.pricingType === 'hourly' ? true : false,
        // Bundling / Paket
        isBundlingEnabled: false,
        isWholesale: false, // New Wholesale Flag
        overtime_hourly_penalty: 0,
        overtime_trigger_hours: 1,
        pricingTiers: [] // [{ duration: 3, price: 10000 }]
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '', onConfirm: null });
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Category Dialog State
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Price Recommendation Logic
    const [priceRecommendation, setPriceRecommendation] = useState(null);

    useEffect(() => {
        if (formData.buyPrice && !isNaN(formData.buyPrice)) {
            const buyPrice = Number(formData.buyPrice);
            const margin = 0.30; // 30% Margin
            const withMargin = buyPrice * (1 + margin);
            // Round up to nearest 500
            const rounded = Math.ceil(withMargin / 500) * 500;

            setPriceRecommendation(rounded);
        } else {
            setPriceRecommendation(null);
        }
    }, [formData.buyPrice]);

    const applyRecommendation = () => {
        if (priceRecommendation) {
            setFormData(prev => ({ ...prev, sellPrice: priceRecommendation }));
        }
    };



    useEffect(() => {
        const loadProductData = async () => {
            if (!isEditMode) return;

            // 1. Try to find in global context first
            let product = products.find(p => String(p.id) === String(id));

            // 2. If not found, fetch from API
            if (!product) {
                try {
                    const { data, error } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (error) throw error;
                    if (data) {
                        // Resolve category name from ID using global categories context
                        let categoryNames = [];
                        if (data.category_id && categories.length > 0) {
                            const foundCat = categories.find(c => c.id === data.category_id);
                            if (foundCat) {
                                // handles both object with name property or simple string if context varies
                                const name = typeof foundCat.name === 'object' && foundCat.name?.name ? foundCat.name.name : foundCat.name;
                                categoryNames = [name];
                            }
                        }

                        // Normalize fetched data (snake_case) to match context structure (camelCase/mixed)
                        product = {
                            ...data,
                            category: categoryNames, // Set the resolved category name array
                            buyPrice: data.buy_price,
                            sellPrice: data.sell_price,
                            minStock: data.min_stock,
                            discountType: data.discount_type,
                            stockType: data.stock_type, // Assuming DB has stock_type
                            purchaseUnit: data.purchase_unit,
                            conversionToUnit: data.conversion_to_unit || data.conversion_to_unit,
                            pricingType: data.pricing_type,
                            isUnlimited: data.is_unlimited,
                            isBundlingEnabled: data.is_bundling_enabled,
                            isWholesale: data.is_wholesale || false,
                            overtime_hourly_penalty: data.overtime_hourly_penalty || 0,
                            overtime_trigger_hours: data.overtime_trigger_hours || 0,
                            pricingTiers: data.pricing_tiers || []
                        };
                    }
                } catch (err) {
                    console.error("Error fetching product:", err);
                    showAlert('Error', 'Gagal memuat data produk.');
                }
            }

            // 3. Populate Form
            if (product) {
                setFormData({
                    type: product.type || 'Default',
                    name: product.name || '',
                    code: product.code || product.barcode || '', // Handle both code/barcode
                    category: Array.isArray(product.category)
                        ? product.category.map(c => (typeof c === 'object' && c?.name) ? c.name : c)
                        : (product.category ? [(typeof product.category === 'object' && product.category?.name) ? product.category.name : product.category] : []),
                    buyPrice: product.buyPrice || product.buy_price || '',
                    sellPrice: product.sellPrice || product.sell_price || product.price || '',
                    stockType: product.stockType || product.stock_type || 'Barang',
                    stock: product.isUnlimited ? '' : (product.stock !== undefined ? product.stock : ''),
                    minStock: product.minStock || product.min_stock || '',
                    weight: product.weight || '',
                    discount: product.discount || 0,
                    discountType: product.discountType || product.discount_type || 'percent',
                    shelf: product.shelf || product.rack_location || '', // Handle shelf/rack_location
                    image: product.image || null,
                    unit: product.unit || 'Pcs',
                    purchaseUnit: product.purchaseUnit || product.purchase_unit || '',
                    conversionToUnit: product.conversionToUnit || product.conversion_to_unit || '',
                    pricingType: product.pricingType || product.pricing_type || 'fixed',
                    isUnlimited: product.isUnlimited || product.is_unlimited || false,
                    isBundlingEnabled: product.isBundlingEnabled || product.is_bundling_enabled || false,
                    isWholesale: product.isWholesale || product.is_wholesale || false,
                    overtime_hourly_penalty: product.overtime_hourly_penalty || product.overtime_hourly_penalty || 0,
                    overtime_trigger_hours: product.overtime_trigger_hours || product.overtime_trigger_hours || 0,
                    pricingTiers: product.pricingTiers || product.pricing_tiers || []
                });
            }
        };

        loadProductData();
    }, [isEditMode, id, products, categories]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Compress image before setting to state
                // Maximize compression: 600px width, 0.5 quality
                const compressedBase64 = await compressImage(file, 600, 0.5);
                setFormData(prev => ({ ...prev, image: compressedBase64 }));
            } catch (error) {
                console.error("Image compression failed:", error);
                // Fallback to original if compression fails (though rare)
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => ({ ...prev, image: reader.result }));
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const showAlert = (title, message, onConfirm = null) => {
        setAlertData({ title, message, onConfirm });
        setIsAlertOpen(true);
    };

    const handleBarcodeScan = (code) => {
        setFormData(prev => ({ ...prev, code: code }));
        setIsScannerOpen(false);
        // Beep sound is handled in BarcodeScannerDialog
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;

        try {
            const result = await addCategory({ name: newCategoryName });
            if (result.success) {
                setNewCategoryName('');
                setIsCategoryDialogOpen(false);
                // Auto select the new category
                setFormData(prev => ({
                    ...prev,
                    category: [...prev.category, newCategoryName]
                }));
            } else {
                showAlert('Gagal', 'Gagal menambahkan kategori.');
            }
        } catch (error) {
            console.error("Error adding category:", error);
            showAlert('Error', 'Terjadi kesalahan saat menambahkan kategori.');
        }
    };

    const handleSubmit = async (e, action) => {
        e.preventDefault();
        // Validation
        if (!formData.name || !formData.sellPrice) {
            showAlert('Validasi Gagal', 'Nama dan Harga Jual wajib diisi!');
            return;
        }

        // Check for duplicate SKU
        if (formData.code) {
            const duplicateProduct = products.find(p =>
                p.code &&
                p.code.toLowerCase() === formData.code.toLowerCase() &&
                (!isEditMode || p.id !== id)
            );

            if (duplicateProduct) {
                showAlert('Validasi Gagal', `Kode Produk (SKU) "${formData.code}" sudah digunakan oleh produk "${duplicateProduct.name}".`);
                return;
            }
        }

        // Validate Purchase Unit
        if (formData.purchaseUnit && (!formData.conversionToUnit || Number(formData.conversionToUnit) <= 0)) {
            showAlert('Validasi Gagal', 'Jika Satuan Beli diisi, Isi per Satuan Beli wajib diisi!');
            return;
        }

        setIsSubmitting(true);

        // --- Handle Image Upload to Supabase Storage ---
        let finalImageUrl = formData.image;

        // If image is a new Base64 string (from handleImageUpload)
        if (formData.image && formData.image.startsWith('data:')) {
            try {
                // Convert Base64 to Blob
                const base64Response = await fetch(formData.image);
                const blob = await base64Response.blob();

                const fileExt = blob.type.split('/')[1] || 'jpg';
                const fileName = `${activeStoreId}/${Date.now()}.${fileExt}`;
                const filePath = fileName;

                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(filePath, blob, {
                        contentType: blob.type,
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(filePath);

                finalImageUrl = publicUrl;
            } catch (error) {
                console.error("Storage upload failed, falling back to Base64:", error);
                // We'll keep the Base64 as fallback if storage fails
            }
        }

        const productData = {
            ...formData,
            image: finalImageUrl,
            buyPrice: Number(formData.buyPrice),
            sellPrice: Number(formData.sellPrice),

            minStock: Number(formData.minStock),
            weight: Number(formData.weight),
            discount: Number(formData.discount),

            price: Number(formData.sellPrice), // Legacy support
            unit: formData.pricingType === 'hourly' ? 'Jam' : (formData.pricingType === 'daily' ? 'Hari' : formData.unit),
            purchaseUnit: formData.purchaseUnit,
            conversionToUnit: formData.conversionToUnit ? Number(formData.conversionToUnit) : null,
            pricingType: formData.pricingType,
            isUnlimited: formData.isUnlimited,
            stock: formData.isUnlimited ? 999999 : Number(formData.stock),
            isBundlingEnabled: formData.isBundlingEnabled,
            isWholesale: formData.isWholesale,
            overtime_hourly_penalty: Number(formData.overtime_hourly_penalty || 0),
            overtime_trigger_hours: Number(formData.overtime_trigger_hours || 0),
            pricingTiers: formData.pricingTiers.map(t => ({ duration: Number(t.duration), price: Number(t.price) })).filter(t => t.duration > 0 && t.price >= 0)
        };

        try {
            if (isEditMode) {
                const result = await updateProduct(id, productData);
                if (result.success) {
                    showAlert('Sukses', 'Produk berhasil diperbarui!', () => navigate('/products'));
                } else {
                    showAlert('Gagal', 'Gagal memperbarui produk.');
                }
            } else {
                const result = await addProduct(productData);
                if (result.success) {
                    if (action === 'save') {
                        navigate('/products');
                    } else {
                        // Reset form for "Save & Add New"
                        setFormData({
                            type: 'Default',
                            name: '',
                            code: '',
                            category: [],
                            buyPrice: '',
                            sellPrice: '',
                            stockType: 'Barang',
                            stock: '',
                            minStock: '',
                            weight: '',
                            discount: 0,
                            discountType: 'percent',
                            shelf: '',
                            image: null
                        });
                        showAlert('Sukses', 'Produk berhasil disimpan. Silakan tambah produk baru.');
                    }
                } else {
                    showAlert('Gagal', result.error || 'Gagal menambahkan produk.');
                }
            }
        } catch (error) {
            console.error("Error saving product:", error);
            showAlert('Error', "Terjadi kesalahan saat menyimpan produk.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 space-y-6 w-full mx-auto pb-24">
            <header className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate('/products')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">{isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'}</h1>
                    <p className="text-muted-foreground mt-1">
                        {isEditMode ? 'Perbarui informasi produk.' : 'Lengkapi informasi produk di bawah ini.'}
                    </p>
                </div>
            </header>

            <form onSubmit={(e) => handleSubmit(e, 'save')} className="space-y-6">
                {/* Product Type Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Tipe Produk</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {PRODUCT_TYPES.map(type => (
                                <Button
                                    key={type}
                                    type="button"
                                    variant={formData.type === type ? "default" : "outline"}
                                    onClick={() => setFormData(prev => ({ ...prev, type }))}
                                    className="h-9"
                                >
                                    {type}
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column - Image */}
                    <div className="md:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Foto Produk</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[250px] cursor-pointer hover:bg-muted/50 transition-colors relative overflow-hidden"
                                    onClick={() => document.getElementById('file-upload').click()}
                                >
                                    {formData.image ? (
                                        <img
                                            src={formData.image}
                                            alt="Preview"
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="text-center space-y-2 text-muted-foreground">
                                            <div className="bg-muted p-4 rounded-full inline-flex">
                                                <Upload className="h-8 w-8" />
                                            </div>
                                            <p className="font-medium">Klik untuk upload foto</p>
                                            <p className="text-xs">Format: JPG, PNG (Max 2MB)</p>
                                        </div>
                                    )}
                                    <input
                                        id="file-upload"
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={handleImageUpload}
                                    />
                                    {formData.image && (
                                        <div className="absolute bottom-2 right-2">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFormData(prev => ({ ...prev, image: null }));
                                                }}
                                            >
                                                Hapus
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - Form Fields */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Main Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Informasi Dasar</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label htmlFor="name">Nama Produk <span className="text-destructive">*</span></Label>
                                        </div>
                                        <Input
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Contoh: Kopi Susu"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label htmlFor="code">Kode Produk (SKU)</Label>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                id="code"
                                                name="code"
                                                value={formData.code}
                                                onChange={handleChange}
                                                placeholder="Contoh: KP-001"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setIsScannerOpen(true)}
                                                title="Scan Barcode"
                                            >
                                                <ScanBarcode className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label>Kategori</Label>
                                        </div>
                                        <div className="flex gap-2">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="flex-1 justify-between">
                                                        {formData.category.length > 0
                                                            ? `${formData.category.length} Kategori Terpilih`
                                                            : "Pilih Kategori"}
                                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="w-56 max-h-60 overflow-y-auto">
                                                    {categories.map(cat => {
                                                        const catName = typeof cat.name === 'object' && cat.name?.name ? cat.name.name : cat.name;
                                                        return (
                                                            <div key={cat.id} className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded cursor-pointer" onClick={(e) => {
                                                                e.preventDefault();
                                                                const currentCats = formData.category;
                                                                const isSelected = currentCats.includes(catName);
                                                                let newCats;
                                                                if (isSelected) {
                                                                    newCats = currentCats.filter(c => c !== catName);
                                                                } else {
                                                                    newCats = [...currentCats, catName];
                                                                }
                                                                setFormData(prev => ({ ...prev, category: newCats }));
                                                            }}>
                                                                <Checkbox
                                                                    checked={formData.category.includes(catName)}
                                                                    onCheckedChange={() => { }} // Handled by parent div click
                                                                />
                                                                <span className="text-sm">{catName}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setIsCategoryDialogOpen(true)}
                                                title="Tambah Kategori Baru"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {formData.category.map((cat, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-xs">
                                                    {typeof cat === 'object' && cat?.name ? cat.name : cat}
                                                    <button
                                                        type="button"
                                                        className="ml-1 hover:text-destructive"
                                                        onClick={() => setFormData(prev => ({ ...prev, category: prev.category.filter((_, i) => i !== idx) }))}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label htmlFor="stockType">Jenis Stok</Label>
                                        </div>
                                        <Select
                                            value={formData.stockType}
                                            onValueChange={(val) => handleSelectChange('stockType', val)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Jenis" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Barang">Barang (Fisik)</SelectItem>
                                                <SelectItem value="Jasa">Jasa (Non-Fisik)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Pricing & Stock */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Harga & Stok</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label htmlFor="pricingType">Model Harga</Label>
                                        </div>
                                        <Select
                                            value={formData.pricingType || 'fixed'}
                                            onValueChange={(val) => {
                                                setFormData(prev => {
                                                    let newUnit = prev.unit;
                                                    if (val === 'hourly') newUnit = 'Jam';
                                                    if (val === 'daily') newUnit = 'Hari';
                                                    return { ...prev, pricingType: val, unit: newUnit };
                                                });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Model" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fixed">Harga Tetap (Jual Putus)</SelectItem>
                                                <SelectItem value="hourly">Rental / Durasi (Per Jam)</SelectItem>
                                                <SelectItem value="daily">Rental / Durasi (Per Hari)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {formData.pricingType !== 'hourly' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center h-6">
                                                <Label htmlFor="buyPrice">Harga Beli</Label>
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">Rp</span>
                                                <Input
                                                    id="buyPrice"
                                                    name="buyPrice"
                                                    type="number"
                                                    className="pl-9"
                                                    value={formData.buyPrice}
                                                    onChange={handleChange}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label htmlFor="sellPrice">Harga Jual {formData.pricingType === 'hourly' ? '(Per Jam)' : (formData.pricingType === 'daily' ? '(Per Hari)' : '')} <span className="text-destructive">*</span></Label>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">Rp</span>
                                            <Input
                                                id="sellPrice"
                                                name="sellPrice"
                                                type="number"
                                                className="pl-9"
                                                value={formData.sellPrice}
                                                onChange={handleChange}
                                                placeholder="0"
                                                required
                                            />
                                        </div>
                                        {priceRecommendation && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                💡 Rekomendasi:
                                                <button
                                                    type="button"
                                                    onClick={applyRecommendation}
                                                    className="font-medium text-indigo-600 hover:underline"
                                                >
                                                    Rp {priceRecommendation.toLocaleString('id-ID')}
                                                </button>
                                                (Margin 30% + Pembulatan)
                                            </p>
                                        )}
                                    </div>

                                    {/* Discount Section - Match Pricing Layout */}
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="discount">Diskon</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex gap-2">
                                                <Input
                                                    id="discount"
                                                    name="discount"
                                                    type="number"
                                                    value={formData.discount}
                                                    onChange={handleChange}
                                                    placeholder="0"
                                                    className="flex-1"
                                                />
                                                <Select
                                                    value={formData.discountType || 'percent'}
                                                    onValueChange={(val) => handleSelectChange('discountType', val)}
                                                >
                                                    <SelectTrigger className="w-[85px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="percent">%</SelectItem>
                                                        <SelectItem value="fixed">Rp</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Final Price Preview */}
                                            <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 flex flex-col justify-center h-[40px]">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-green-700 font-medium uppercase tracking-wider">Harga Akhir</span>
                                                    <span className="text-sm font-bold text-green-800">
                                                        Rp {(() => {
                                                            const price = Number(formData.sellPrice) || 0;
                                                            const disc = Number(formData.discount) || 0;
                                                            let final = price;
                                                            if ((formData.discountType || 'percent') === 'percent') {
                                                                final = price - (price * disc / 100);
                                                            } else {
                                                                final = price - disc;
                                                            }
                                                            return Math.max(0, final).toLocaleString('id-ID');
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bundling / Paket Section */}
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <Label className="text-base font-semibold">Harga Bundling / Grosir</Label>
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                {formData.pricingType === 'hourly' || formData.pricingType === 'daily'
                                                    ? `Harga khusus untuk durasi tertentu (misal: 3 ${formData.pricingType === 'daily' ? 'Hari' : 'Jam'} = Rp 100rb).`
                                                    : 'Harga khusus untuk jumlah tertentu. Pilih strategi "Eceran" untuk diskon bertahap, atau "Grosir" untuk harga pukul rata.'
                                                }
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2 shrink-0">
                                            <Checkbox
                                                id="isBundlingEnabled"
                                                checked={formData.isBundlingEnabled}
                                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isBundlingEnabled: checked }))}
                                            />
                                            <label htmlFor="isBundlingEnabled" className="text-sm font-medium cursor-pointer whitespace-nowrap">
                                                Aktifkan Paket
                                            </label>
                                        </div>
                                    </div>

                                    {/* Strategy Selector (Available for ALL current product types) */}
                                    {formData.isBundlingEnabled && (
                                        <div className="flex gap-4 p-3 bg-slate-50 border rounded-md">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    id="strategyBundle"
                                                    name="pricingStrategy"
                                                    checked={!formData.isWholesale}
                                                    onChange={() => setFormData(prev => ({ ...prev, isWholesale: false }))}
                                                    className="w-4 h-4 text-indigo-600 cursor-pointer"
                                                />
                                                <Label htmlFor="strategyBundle" className="cursor-pointer">
                                                    Mode Paket (Bundling)
                                                    <span className="block text-xs text-muted-foreground font-normal">
                                                        Beli 3 = Rp 10rb (Total)
                                                    </span>
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    id="strategyWholesale"
                                                    name="pricingStrategy"
                                                    checked={formData.isWholesale}
                                                    onChange={() => setFormData(prev => ({ ...prev, isWholesale: true }))}
                                                    className="w-4 h-4 text-green-600 cursor-pointer"
                                                />
                                                <Label htmlFor="strategyWholesale" className="cursor-pointer">
                                                    Mode Grosir (Bertingkat)
                                                    <span className="block text-xs text-muted-foreground font-normal">
                                                        Beli &ge;3 = Rp 3000/pcs
                                                    </span>
                                                </Label>
                                            </div>
                                        </div>
                                    )}

                                    {formData.isBundlingEnabled && (
                                        <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-indigo-700">Daftar Paket {formData.pricingType === 'hourly' ? 'Durasi' : 'Qty'}</Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-indigo-600 border-indigo-200 bg-white hover:bg-indigo-100"
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            pricingTiers: [...prev.pricingTiers, { duration: '', price: '' }]
                                                        }));
                                                    }}
                                                >
                                                    <Plus className="w-3 h-3 mr-2" />
                                                    Tambah Paket
                                                </Button>
                                            </div>

                                            {formData.pricingTiers.length === 0 ? (
                                                <div className="text-center py-6 text-muted-foreground text-sm bg-white rounded border border-dashed">
                                                    Belum ada paket. Klik "Tambah Paket" untuk memulai.
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {formData.pricingTiers.map((tier, idx) => (
                                                        <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded-md border">
                                                            <div className="flex-1">
                                                                <Label className="text-xs text-muted-foreground mb-1 block">
                                                                    {formData.isWholesale
                                                                        ? 'Minimal Qty (Mulai Dari)'
                                                                        : (formData.pricingType === 'hourly' ? 'Durasi (Jam)' : (formData.pricingType === 'daily' ? 'Durasi (Hari)' : 'Jumlah (Qty)'))}
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={tier.duration}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setFormData(prev => {
                                                                            const newTiers = [...prev.pricingTiers];
                                                                            newTiers[idx].duration = val;
                                                                            return { ...prev, pricingTiers: newTiers };
                                                                        });
                                                                    }}
                                                                    placeholder={formData.pricingType === 'hourly' ? '3' : (formData.pricingType === 'daily' ? '1' : '5')}
                                                                    className="h-9"
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <Label className="text-xs text-muted-foreground mb-1 block">
                                                                    {formData.isWholesale ? 'Harga Satuan (Grosir)' : 'Harga Paket (Total)'}
                                                                </Label>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">Rp</span>
                                                                    <Input
                                                                        type="number"
                                                                        value={tier.price}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setFormData(prev => {
                                                                                const newTiers = [...prev.pricingTiers];
                                                                                newTiers[idx].price = val;
                                                                                return { ...prev, pricingTiers: newTiers };
                                                                            });
                                                                        }}
                                                                        placeholder={formData.isWholesale ? "37000" : "10000"}
                                                                        className="h-9 pl-8"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 shrink-0 mt-5"
                                                                onClick={() => {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        pricingTiers: prev.pricingTiers.filter((_, i) => i !== idx)
                                                                    }));
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between h-6">
                                            <Label htmlFor="stock" className="flex items-center">
                                                Stok Saat Ini
                                                {isEditMode && (
                                                    <span className="ml-2 text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded border border-border">
                                                        Read-only
                                                    </span>
                                                )}
                                            </Label>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="isUnlimited"
                                                    checked={formData.isUnlimited}
                                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isUnlimited: checked }))}
                                                />
                                                <Label
                                                    htmlFor="isUnlimited"
                                                    className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    Unlimited
                                                </Label>
                                            </div>
                                        </div>
                                        <Input
                                            id="stock"
                                            name="stock"
                                            type="number"
                                            value={formData.isUnlimited ? '' : formData.stock}
                                            onChange={handleChange}
                                            placeholder={formData.isUnlimited ? "∞ (Tak Terbatas)" : "0"}
                                            disabled={isEditMode || formData.isUnlimited}
                                            className={isEditMode || formData.isUnlimited ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
                                        />
                                        {isEditMode && (
                                            <p className="text-xs text-muted-foreground">
                                                💡 Untuk update stok, gunakan menu{' '}
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/stock-management')}
                                                    className="text-indigo-600 hover:underline font-medium"
                                                >
                                                    Stock Management
                                                </button>
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label htmlFor="minStock">Minimum Stok (Alert)</Label>
                                        </div>
                                        <Input
                                            id="minStock"
                                            name="minStock"
                                            type="number"
                                            value={formData.minStock}
                                            onChange={handleChange}
                                            placeholder="5"
                                        />
                                    </div>
                                </div>

                                {/* Unit Conversion Section Integrated */}
                                <div className="pt-6 mt-2 border-t space-y-4">
                                    <h3 className="text-base font-semibold">Satuan & Konversi</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center h-6">
                                                <Label htmlFor="unit">Satuan Stok (Dasar)</Label>
                                            </div>
                                            <Input
                                                id="unit"
                                                name="unit"
                                                value={formData.unit}
                                                onChange={handleChange}
                                                placeholder="Pcs, Kg, Liter..."
                                            />
                                            <p className="text-xs text-muted-foreground">Satuan untuk stok & penjualan.</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-lg space-y-4 border">
                                        <div>
                                            <Label className="text-sm font-semibold">Konversi Pembelian (Opsional)</Label>
                                            <p className="text-xs text-muted-foreground">Isi jika Anda membeli dalam satuan besar (Sack, Dus) tapi menjual eceran.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <div className="flex items-center h-6">
                                                    <Label htmlFor="purchaseUnit">Satuan Beli (PO)</Label>
                                                </div>
                                                <Input
                                                    id="purchaseUnit"
                                                    name="purchaseUnit"
                                                    value={formData.purchaseUnit}
                                                    onChange={handleChange}
                                                    placeholder="Contoh: Sak, Dus, Karton"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center h-6">
                                                    <Label htmlFor="conversionToUnit">Isi per Satuan Beli</Label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        id="conversionToUnit"
                                                        name="conversionToUnit"
                                                        type="number"
                                                        value={formData.conversionToUnit}
                                                        onChange={handleChange}
                                                        placeholder="Contoh: 24"
                                                    />
                                                    <span className="text-sm font-medium bg-white px-2 py-1 rounded border">{formData.unit || 'Unit'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {formData.purchaseUnit && formData.conversionToUnit && (
                                            <div className="text-sm bg-blue-100 text-blue-800 p-2 rounded flex items-center justify-center font-medium border border-blue-200">
                                                1 {formData.purchaseUnit} = {formData.conversionToUnit} {formData.unit}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Additional Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Detail Lainnya</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label htmlFor="weight">Berat (Gram)</Label>
                                        </div>
                                        <Input
                                            id="weight"
                                            name="weight"
                                            type="number"
                                            value={formData.weight}
                                            onChange={handleChange}
                                            placeholder="0"
                                        />
                                    </div>
                                    {/* Discount moved to Pricing Section */}
                                    <div className="space-y-2">
                                        <div className="flex items-center h-6">
                                            <Label htmlFor="shelf">Letak Rak</Label>
                                        </div>
                                        <Input
                                            id="shelf"
                                            name="shelf"
                                            value={formData.shelf}
                                            onChange={handleChange}
                                            placeholder="A-01"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>


                </div>

                {/* Sticky Footer Actions */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex justify-end gap-4 z-10 md:pl-64">
                    <Button type="button" variant="outline" onClick={() => navigate('/products')} disabled={isSubmitting}>
                        <X className="h-4 w-4 mr-2" />
                        Batal
                    </Button>
                    {!isEditMode && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={(e) => handleSubmit(e, 'save-new')}
                            disabled={isSubmitting}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Simpan & Tambah Baru
                        </Button>
                    )}
                    <Button type="submit" disabled={isSubmitting}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSubmitting ? 'Menyimpan...' : (isEditMode ? 'Perbarui Produk' : 'Simpan Produk')}
                    </Button>
                </div>
            </form>

            <AlertDialog
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertData.title}
                message={alertData.message}
                onConfirm={alertData.onConfirm}
            />

            <BarcodeScannerDialog
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
            />

            {/* New Category Dialog */}
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tambah Kategori Baru</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="newCategory">Nama Kategori</Label>
                            <Input
                                id="newCategory"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Contoh: Minuman"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleAddCategory}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProductForm;
