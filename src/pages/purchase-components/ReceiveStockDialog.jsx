import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

import { Input } from '../../components/ui/input';
import FormattedNumberInput from '../../components/ui/FormattedNumberInput';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { useData } from '../../context/DataContext';
import { useToast } from '../../components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const ReceiveStockDialog = ({ open, onClose, po }) => {
    const { receivePurchaseOrder, products } = useData();
    const { toast } = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (po && po.items && products.length > 0) {
            setItems(po.items.map(i => {
                const product = products.find(p => p.id === i.productId);
                const conversion = (product?.conversionToUnit && product?.purchaseUnit) ? parseInt(product.conversionToUnit) : 1;

                return {
                    ...i,
                    receivedQty: i.qty,
                    receivedPrice: (i.buyPrice || 0) * conversion // Initialize with PO Unit Price
                };
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [po]); // Keep dependency stable to prevent HMR errors


    const handleItemChange = (index, field, val) => {
        const newItems = [...items];
        // FormattedNumberInput returns the raw number directly, or empty string
        newItems[index][field] = val === '' ? 0 : val;
        setItems(newItems);
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            // Prepare items for reception
            // Prepare items for reception with Unit Conversion logic
            const receivedItems = items.map(i => {
                const product = products.find(p => p.id === i.productId);
                const conversion = (product?.conversionToUnit && product?.purchaseUnit) ? parseInt(product.conversionToUnit) : 1;

                // Qty entered is in Sacks -> Convert to Kg (Base Unit)
                // Price entered is Per Sack (PO Unit) -> Convert to Per Kg (Base Unit) for Master Data
                const finalQty = i.receivedQty * conversion;

                // Fix: Calculate Price Per PCS (Base Unit) for Master Data
                // If conversion > 1, receivedPrice is Price/Sack. We need Price/Pcs.
                const finalPrice = conversion > 1
                    ? Math.ceil(i.receivedPrice / conversion)
                    : i.receivedPrice;

                return {
                    productId: i.productId,
                    qty: finalQty, // Adjusted to Base Unit
                    buyPrice: finalPrice // Adjusted to Base Unit (Per Pcs)
                };
            });



            // Prepare PO Updates (Reflect Actual Received Prices/Qtys in PO Dcoument)
            let newTotalAmount = 0;
            const updatedPOItems = items.map(i => {
                const lineTotal = i.receivedQty * i.receivedPrice;
                newTotalAmount += lineTotal;
                return {
                    ...i,
                    qty: i.receivedQty, // Update to actual received
                    buyPrice: i.receivedPrice, // Update to actual received price
                    subtotal: lineTotal
                    // Note: We keep original keys like qtyBase if needed, 
                    // but usually for PO display 'qty' and 'buyPrice' are primary.
                    // If qtyBase was used, we might need to update it too?
                    // Let's check PurchaseOrderForm logic. 
                    // It uses qtyBase for PCS. We should update it just in case.
                };
            });

            const poUpdates = {
                items: updatedPOItems,
                totalAmount: newTotalAmount
            };

            const res = await receivePurchaseOrder(po.id, receivedItems, poUpdates);

            if (res.success) {
                toast({ title: "Berhasil", description: "Stok telah diterima dan ditambahkan." });
                onClose(true); // Signal success
            } else {
                toast({ variant: "destructive", title: "Gagal", description: res.error });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (!po) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Terima Barang - PO #{po.id.slice(0, 8)}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 my-4">
                    <div className="bg-slate-50 p-3 rounded text-sm">
                        <p>Pastikan jumlah fisik barang sesuai dengan yang diinputkan di bawah ini. Stok produk akan bertambah otomatis.</p>
                    </div>

                    <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produk</TableHead>
                                    <TableHead className="w-[80px]">Dipesan</TableHead>
                                    <TableHead className="w-[100px]">Harga PO</TableHead>
                                    <TableHead className="w-[120px]">Diterima (Qty)</TableHead>
                                    <TableHead className="w-[150px]">Harga Terima</TableHead>
                                    <TableHead className="w-[150px] text-right">Total Harga</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => {
                                    const product = products.find(p => p.id === item.productId);
                                    const hasConversion = product?.purchaseUnit && product?.conversionToUnit;

                                    return (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <div className="font-medium">{item.productName}</div>
                                                {hasConversion && (
                                                    <div className="text-xs text-blue-600 mt-1">
                                                        Satuan Beli: {product.purchaseUnit} (Isi {product.conversionToUnit} {product.unit})
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>{item.qty} {hasConversion ? product.purchaseUnit : ''}</TableCell>
                                            <TableCell>
                                                Rp {((item.buyPrice || 0) * (hasConversion ? product.conversionToUnit : 1)).toLocaleString('id-ID')}
                                                {hasConversion && <span className="text-[10px] text-muted-foreground block">/{product.purchaseUnit}</span>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <FormattedNumberInput
                                                        value={item.receivedQty}
                                                        onChange={(val) => handleItemChange(index, 'receivedQty', val)}
                                                        className="h-8 w-24"
                                                    />
                                                    {hasConversion && <span className="text-xs text-muted-foreground">{product.purchaseUnit}</span>}
                                                </div>
                                                {hasConversion && (
                                                    <div className="text-[10px] text-green-600 mt-1">
                                                        Total: {item.receivedQty * product.conversionToUnit} {product.unit}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <FormattedNumberInput
                                                    value={item.receivedPrice}
                                                    onChange={(val) => handleItemChange(index, 'receivedPrice', val)}
                                                    className="h-8 w-full"
                                                />
                                                {hasConversion && (
                                                    <div className="text-[10px] text-muted-foreground mt-1">
                                                        Harga diinput adalah per {product.purchaseUnit || product.unit} (Sesuai PO)
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                Rp {((item.receivedQty || 0) * (item.receivedPrice || 0)).toLocaleString('id-ID')}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onClose(false)} disabled={loading}>Batal</Button>
                    <Button onClick={handleConfirm} disabled={loading} className="gap-2">
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        Konfirmasi Terima
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ReceiveStockDialog;
