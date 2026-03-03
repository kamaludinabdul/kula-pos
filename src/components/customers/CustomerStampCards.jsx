import React, { useEffect, useState } from 'react';
import { useData } from '../../context/DataContext';
import { Loader2, Ticket, Gift, Settings2 } from 'lucide-react';
import { Button } from '../ui/button';
import AlertDialog from '../AlertDialog';
import StampAdjustmentDialog from './StampAdjustmentDialog';

const CustomerStampCards = ({ customerId, customerName }) => {
    const { fetchCustomerStamps, redeemStampCard } = useData();
    const [stamps, setStamps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [redeemingId, setRedeemingId] = useState(null);
    const [alertData, setAlertData] = useState({ open: false, title: '', message: '' });

    // For manual adjustment
    const [adjustmentDialog, setAdjustmentDialog] = useState({ open: false, stampId: null, ruleName: '', currentStamps: 0, targetStamps: 10, ruleId: null });

    const loadStamps = React.useCallback(() => {
        if (customerId) {
            setLoading(true);
            fetchCustomerStamps(customerId)
                .then(data => setStamps(data))
                .finally(() => setLoading(false));
        }
    }, [customerId, fetchCustomerStamps]);

    useEffect(() => {
        loadStamps();
    }, [loadStamps]);

    const handleRedeem = async (stampId, rule) => {
        setRedeemingId(stampId);
        try {
            // Pass 0 for points because stamps do not award points anymore
            const result = await redeemStampCard(stampId, customerId, rule.stamp_target, 0);
            if (result.success) {
                setAlertData({
                    open: true,
                    title: 'Berhasil!',
                    message: `Stamp ditukar! Silakan berikan hadiah/kado langsung ke pelanggan.`
                });
                loadStamps(); // Refresh data
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            setAlertData({ open: true, title: 'Gagal', message: error.message || 'Gagal menukar stamp.' });
        } finally {
            setRedeemingId(null);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400" /></div>;
    }

    if (!stamps || stamps.length === 0) {
        return (
            <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <Ticket className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Belum ada kartu stamp yang aktif</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {stamps.map(stamp => {
                const rule = stamp.loyalty_product_rules;
                if (!rule) return null;

                const target = rule.stamp_target || 10;
                const current = stamp.current_stamps || 0;
                const percentage = Math.min(100, Math.round((current / target) * 100));
                const canRedeem = current >= target;

                return (
                    <div key={stamp.id} className={`border rounded-lg p-4 shadow-sm relative overflow-hidden ${canRedeem ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
                        {stamp.completed_count > 0 && (
                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] px-2 py-0.5 font-bold rounded-bl-lg z-10">
                                Diselesaikan {stamp.completed_count}x
                            </div>
                        )}
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <div>
                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Ticket className={`w-4 h-4 ${canRedeem ? 'text-amber-500' : 'text-emerald-500'}`} />
                                    {rule.name || 'Stamp Card'}
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-1">Hadiah Fisik / Tercapai Pada {target} Cap</p>
                            </div>

                            <div className="flex gap-2">
                                {canRedeem ? (
                                    <Button
                                        size="sm"
                                        className="bg-amber-500 hover:bg-amber-600 h-8 text-xs px-3"
                                        onClick={() => handleRedeem(stamp.id, rule)}
                                        disabled={redeemingId === stamp.id}
                                    >
                                        {redeemingId === stamp.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                        ) : (
                                            <Gift className="w-3 h-3 mr-1" />
                                        )}
                                        Tukar Stamp
                                    </Button>
                                ) : (
                                    <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-1.5 rounded-md border flex items-center">
                                        {current} / {target}
                                    </span>
                                )}

                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setAdjustmentDialog({
                                        open: true, stampId: stamp.id, ruleName: rule.name, currentStamps: current, targetStamps: target, ruleId: rule.id
                                    })}
                                    title="Sesuaikan Jumlah Stamp"
                                >
                                    <Settings2 className="w-4 h-4 text-slate-500" />
                                </Button>
                            </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="w-full bg-slate-100 rounded-full h-3 mt-3 overflow-hidden border border-slate-200 relative z-10">
                            <div
                                className={`${canRedeem ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'} h-full rounded-full transition-all duration-500 ease-out`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>

                        {/* Visual Dots */}
                        <div className="flex justify-between mt-2 px-1 relative z-10">
                            {Array.from({ length: Math.min(target, 20) }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full ${i < current ? (canRedeem ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'}`}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            <AlertDialog
                isOpen={alertData.open}
                onClose={() => setAlertData({ ...alertData, open: false })}
                title={alertData.title}
                message={alertData.message}
            />

            {adjustmentDialog.open && (
                <StampAdjustmentDialog
                    open={adjustmentDialog.open}
                    onOpenChange={(val) => setAdjustmentDialog({ ...adjustmentDialog, open: val })}
                    customer={{ id: customerId, name: customerName || 'Pelanggan' }}
                    stampData={adjustmentDialog}
                    onSuccess={loadStamps}
                />
            )}
        </div>
    );
};

export default CustomerStampCards;
