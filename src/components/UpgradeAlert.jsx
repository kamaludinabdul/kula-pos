import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Crown, CheckCircle2 } from 'lucide-react';

const UpgradeAlert = ({ isOpen, onClose, title, description, benefits = [] }) => {
    const navigate = useNavigate();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                        <Crown className="w-6 h-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-xl">{title || "Upgrade ke Pro"}</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        {description || "Anda telah mencapai batas paket Free. Upgrade sekarang untuk menikmati fitur tanpa batas!"}
                    </DialogDescription>
                </DialogHeader>

                {benefits.length > 0 && (
                    <div className="py-4 space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">Keuntungan Pro:</p>
                        {benefits.map((benefit, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span>{benefit}</span>
                            </div>
                        ))}
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-col gap-2 mt-4">
                    <Button
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                        onClick={() => {
                            onClose();
                            navigate('/settings/subscription');
                        }}
                    >
                        Lihat Paket Langganan
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={onClose}>
                        Nanti Saja
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UpgradeAlert;
