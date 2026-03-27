import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Clock } from 'lucide-react';

const RentalDurationDialog = ({ isOpen, onClose, product, onConfirm }) => {
    // Determine the unit from the product, defaulting to 'Jam' if missing
    // Remove leading slash if it exists (e.g. "/Menit" -> "Menit")
    const unitLabel = product?.unit ? product.unit.replace(/^\//, '').trim() : 'Jam';
    const isMinute = unitLabel.toLowerCase() === 'menit';
    const isDay = unitLabel.toLowerCase() === 'hari';

    const defaultDuration = isMinute ? '30' : '1';
    
    const [duration, setDuration] = useState(defaultDuration);

    // Reset duration to sensible baseline when dialog opens for a product
    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line
            setDuration(defaultDuration);
        }
    }, [isOpen, product?.id, defaultDuration]);

    const handleConfirm = () => {
        const val = parseFloat(duration);
        if (val > 0) {
            onConfirm(product, val);
            onClose();
        }
    };

    let presets = [0.5, 1, 1.5, 2, 3, 4, 5];
    if (isMinute) {
        presets = [15, 30, 45, 60, 90, 120];
    } else if (isDay) {
        presets = [1, 2, 3, 4, 5, 7, 30];
    }

    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600" />
                        Sewa {product.name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Pilih durasi sewa untuk produk ini
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Pilih Durasi (Paket)</Label>
                        <div className="flex flex-wrap gap-2">
                            {presets.map(hr => (
                                <Button
                                    key={hr}
                                    variant={duration == hr ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setDuration(hr.toString())}
                                    className="h-8"
                                >
                                    {hr} {unitLabel}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Atau Input Manual ({unitLabel})</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                placeholder={`Contoh: ${isMinute ? '30' : '2.5'}`}
                                className="text-lg font-bold text-center"
                                autoFocus
                            />
                            <span className="font-medium">{unitLabel}</span>
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                            Total: Rp {(parseFloat(duration || 0) * product.price).toLocaleString('id-ID')}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Batal</Button>
                    <Button onClick={handleConfirm} disabled={!duration || parseFloat(duration) <= 0}>
                        Masuk Keranjang
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RentalDurationDialog;
