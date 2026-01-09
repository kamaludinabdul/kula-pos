import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Switch } from "./ui/switch";
import { Printer, Minus, Plus, Trash2 } from 'lucide-react';
import { generateBarcodeSVG, LABEL_SIZES, printLabels } from '../utils/barcodeGenerator';

const BarcodeLabelDialog = ({
    isOpen,
    onClose,
    products = [] // Array of products to print labels for
}) => {
    const [labelSize, setLabelSize] = useState('medium');
    const [showPrice, setShowPrice] = useState(true);
    const [labelItems, setLabelItems] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);

    // Initialize label items with quantity 1 for each product
    useEffect(() => {
        if (products.length > 0) {
            setLabelItems(products.map(p => ({
                product: p,
                quantity: 1
            })));
        }
    }, [products]);

    const updateQuantity = (productId, newQty) => {
        if (newQty < 1) return;
        setLabelItems(prev =>
            prev.map(item =>
                item.product.id === productId
                    ? { ...item, quantity: newQty }
                    : item
            )
        );
    };

    const removeProduct = (productId) => {
        setLabelItems(prev => prev.filter(item => item.product.id !== productId));
    };

    const handlePrint = async () => {
        if (labelItems.length === 0) return;

        setIsPrinting(true);
        try {
            await printLabels(labelItems, labelSize, showPrice);
        } catch (error) {
            console.error('Print error:', error);
        } finally {
            setIsPrinting(false);
        }
    };

    const totalLabels = labelItems.reduce((sum, item) => sum + item.quantity, 0);

    // Preview barcode for first product
    const previewProduct = labelItems[0]?.product;
    const previewCode = previewProduct?.code || previewProduct?.barcode || previewProduct?.id || 'SAMPLE';
    const previewBarcode = generateBarcodeSVG(previewCode, {
        height: LABEL_SIZES[labelSize].barcodeHeight,
        fontSize: LABEL_SIZES[labelSize].fontSize
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        Cetak Label Barcode
                    </DialogTitle>
                    <DialogDescription>
                        Pilih ukuran label dan jumlah cetak untuk setiap produk
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4">
                    {/* Left: Product List */}
                    <div className="space-y-3">
                        <Label className="font-semibold">Produk ({labelItems.length})</Label>
                        <ScrollArea className="h-[280px] border rounded-md p-2">
                            {labelItems.length === 0 ? (
                                <p className="text-muted-foreground text-sm text-center py-4">
                                    Tidak ada produk dipilih
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {labelItems.map((item) => (
                                        <div
                                            key={item.product.id}
                                            className="flex items-center gap-2 p-2 border rounded-lg bg-slate-50"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {item.product.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.product.code || item.product.barcode || '-'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                                    disabled={item.quantity <= 1}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                                                    className="w-12 h-7 text-center px-1"
                                                    min={1}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => removeProduct(item.product.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Right: Settings & Preview */}
                    <div className="space-y-4">
                        {/* Size Selection */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Ukuran Label</Label>
                            <RadioGroup value={labelSize} onValueChange={setLabelSize}>
                                {Object.entries(LABEL_SIZES).map(([key, config]) => (
                                    <div key={key} className="flex items-center space-x-2">
                                        <RadioGroupItem value={key} id={key} />
                                        <Label htmlFor={key} className="cursor-pointer">
                                            {config.name} ({config.width}x{config.height}mm)
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        {/* Show Price Toggle */}
                        <div className="flex items-center justify-between">
                            <Label>Tampilkan Harga</Label>
                            <Switch
                                checked={showPrice}
                                onCheckedChange={setShowPrice}
                            />
                        </div>

                        {/* Preview */}
                        <div className="space-y-2">
                            <Label className="font-semibold">Preview</Label>
                            <div
                                className="border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center bg-white"
                                style={{
                                    minHeight: `${LABEL_SIZES[labelSize].height * 2.5}px`
                                }}
                            >
                                {previewProduct ? (
                                    <>
                                        <p
                                            className="font-bold text-center mb-1"
                                            style={{ fontSize: `${LABEL_SIZES[labelSize].fontSize}pt` }}
                                        >
                                            {previewProduct.name.substring(0, LABEL_SIZES[labelSize].nameMaxLength)}
                                        </p>
                                        <div
                                            dangerouslySetInnerHTML={{ __html: previewBarcode || 'No Code' }}
                                            className="max-w-full"
                                        />
                                        {showPrice && (
                                            <p
                                                className="font-bold mt-1"
                                                style={{ fontSize: `${LABEL_SIZES[labelSize].priceSize}pt` }}
                                            >
                                                Rp {previewProduct.price?.toLocaleString() || 0}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-muted-foreground text-sm">No preview</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Total: <span className="font-semibold">{totalLabels} label</span>
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button
                            onClick={handlePrint}
                            disabled={labelItems.length === 0 || isPrinting}
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            {isPrinting ? 'Mencetak...' : 'Cetak'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BarcodeLabelDialog;
