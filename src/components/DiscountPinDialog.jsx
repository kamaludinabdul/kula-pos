import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Lock } from 'lucide-react';

const DiscountPinDialog = ({ isOpen, onClose, onConfirm, expectedPin, title = "Otorisasi Diskon", description = "Masukkan PIN Otorisasi untuk menerapkan diskon ini." }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (pin === expectedPin) {
            onConfirm();
            setPin('');
            setError('');
            onClose();
        } else {
            setError('PIN salah. Silakan coba lagi.');
            setPin('');
        }
    };

    const handleClose = () => {
        setPin('');
        setError('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-orange-500" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="Masukkan PIN"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="text-center text-lg tracking-widest"
                            autoFocus
                        />
                        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Batal
                        </Button>
                        <Button type="submit">
                            Konfirmasi
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default DiscountPinDialog;
