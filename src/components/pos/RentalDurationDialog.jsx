import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Clock } from 'lucide-react';

const RentalDurationDialog = ({ isOpen, onClose, product, onConfirm }) => {
    const [duration, setDuration] = useState('1');



    const handleConfirm = () => {
        const val = parseFloat(duration);
        if (val > 0) {
            onConfirm(product, val);
            onClose();
        }
    };

    const presets = [0.5, 1, 1.5, 2, 3, 4, 5];

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
                                    {hr} Jam
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Atau Input Manual (Jam)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                placeholder="Contoh: 2.5"
                                className="text-lg font-bold text-center"
                                autoFocus
                            />
                            <span className="font-medium">Jam</span>
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
