/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { sendMessage } from '../services/telegram';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';

const ShiftContext = createContext(null);

export const ShiftProvider = ({ children }) => {
    const [currentShift, setCurrentShift] = useState(null);
    const [loading, setLoading] = useState(true);
    const { currentStore, updateStore } = useData();
    const { user } = useAuth();
    const activeStoreId = currentStore?.id;

    useEffect(() => {
        if (!user || !activeStoreId) {
            setLoading(false);
            return;
        }

        const fetchActiveShift = async () => {
            try {
                const { data, error } = await supabase
                    .from('shifts')
                    .select('*')
                    .eq('store_id', activeStoreId)
                    .eq('status', 'active')
                    .order('start_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.error('Error fetching active shift:', error);
                } else {
                    setCurrentShift(data || null);
                }
            } catch (err) {
                console.error('Unexpected error fetching shift:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchActiveShift();

        // Subscribe to changes in shifts table for this store
        const channel = supabase.channel(`shifts-${activeStoreId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shifts',
                filter: `store_id=eq.${activeStoreId}`
            }, (payload) => {
                const { eventType, new: newRow, old: oldRow } = payload;

                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    if (newRow.status === 'active') {
                        setCurrentShift(newRow);
                    } else if (newRow.status === 'closed' && currentShift?.id === newRow.id) {
                        setCurrentShift(null);
                    }
                } else if (eventType === 'DELETE' && currentShift?.id === oldRow.id) {
                    setCurrentShift(null);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, activeStoreId]);

    // --- SHIFT REMINDER LOGIC ---
    useEffect(() => {
        if (!currentStore?.telegramNotifyShiftReminder || !currentStore?.telegramBotToken || !currentStore?.telegramChatId) {
            return;
        }

        const checkReminders = async () => {
            const now = new Date();
            const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            const todayStr = now.toISOString().split('T')[0];

            if (
                !currentShift &&
                currentStore.shiftOpenTime &&
                currentTime >= currentStore.shiftOpenTime &&
                currentStore.lastShiftOpenReminderDate !== todayStr
            ) {
                const msg = `⚠️ <b>PERINGATAN: TOKO BELUM BUKA</b>\n\n⏰ Jam Sekarang: ${currentTime}\n⛔ Jadwal Buka: ${currentStore.shiftOpenTime}\n\nHarap segera buka shift kasir.`;
                await sendMessage(msg, { token: currentStore.telegramBotToken, chatId: currentStore.telegramChatId });
                updateStore(currentStore.id, { lastShiftOpenReminderDate: todayStr });
            }

            if (
                currentShift &&
                currentStore.shiftCloseTime &&
                currentTime >= currentStore.shiftCloseTime &&
                currentStore.lastShiftCloseReminderDate !== todayStr
            ) {
                const msg = `⚠️ <b>PERINGATAN: TOKO BELUM TUTUP</b>\n\n⏰ Jam Sekarang: ${currentTime}\n⛔ Jadwal Tutup: ${currentStore.shiftCloseTime}\n👤 Kasir Aktif: ${currentShift.cashier_name}\n\nHarap segera tutup shift & rekap penjualan.`;
                await sendMessage(msg, { token: currentStore.telegramBotToken, chatId: currentStore.telegramChatId });
                updateStore(currentStore.id, { lastShiftCloseReminderDate: todayStr });
            }
        };

        const interval = setInterval(checkReminders, 60000);
        const timeout = setTimeout(checkReminders, 5000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [currentStore, currentShift, updateStore]);

    const getShiftSummary = async () => {
        if (!currentShift || !activeStoreId) return null;

        try {
            const { data, error } = await supabase.rpc('get_shift_summary', {
                p_store_id: activeStoreId,
                p_shift_id: currentShift.id
            });

            if (error) throw error;

            // Merge with currentShift existing fields (like initial_cash, total_cash_in, etc)
            return {
                ...currentShift,
                ...data,
                // Ensure consistency between snake_case and camelCase for UI components if needed
                totalCashIn: currentShift.total_cash_in || 0,
                totalCashOut: currentShift.total_cash_out || 0
            };

        } catch (error) {
            console.error("Error recalculating shift summary:", error);
            return currentShift;
        }
    };

    const startShift = async (cashierName, initialCash = 0) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const startTime = new Date().toISOString();
            const shiftData = {
                cashier_name: cashierName,
                cashier_id: user?.id,
                store_id: activeStoreId,
                start_time: startTime,
                initial_cash: Number(initialCash),
                status: 'active'
            };

            const { data, error } = await supabase
                .from('shifts')
                .insert(shiftData)
                .select()
                .single();

            if (error) throw error;

            // Telegram Alert
            if (currentStore?.telegramNotifyShift) {
                const msg = `🔓 <b>SHIFT DIBUKA</b>\n\n👤 Kasir: ${cashierName}\n💵 Modal Awal: Rp ${initialCash.toLocaleString()}\n⏰ Waktu: ${new Date(startTime).toLocaleString('id-ID')}`;
                sendMessage(msg, { token: currentStore?.telegramBotToken, chatId: currentStore?.telegramChatId });
            }

            setCurrentShift(data);
            return { success: true, shift: data };
        } catch (error) {
            console.error('Error starting shift:', error);
            return { success: false, error: error.message };
        }
    };

    const addCashMovement = async (type, amount, reason, category = 'General') => {
        if (!currentShift || !activeStoreId) return { success: false, error: 'No active shift' };
        try {
            const movementData = {
                shift_id: currentShift.id,
                store_id: activeStoreId,
                type,
                amount: Number(amount),
                reason,
                category,
                date: new Date().toISOString(),
                cashier: currentShift.cashier_name
            };

            const { error: movementError } = await supabase
                .from('shift_movements')
                .insert(movementData)
                .select()
                .single();

            if (movementError) throw movementError;

            // Update shift totals
            const updateField = type === 'in' ? 'total_cash_in' : 'total_cash_out';
            const newVal = (currentShift[updateField] || 0) + Number(amount);

            const { error: updateError } = await supabase
                .from('shifts')
                .update({ [updateField]: newVal })
                .eq('id', currentShift.id);

            if (updateError) throw updateError;

            return { success: true };
        } catch (error) {
            console.error('Error adding cash movement:', error);
            return { success: false, error: error.message };
        }
    };

    const endShift = async (finalCash = 0, finalNonCash = 0, notes = '') => {
        if (!currentShift || !activeStoreId) return { success: false, error: 'No active shift' };

        try {
            const summary = await getShiftSummary();
            const shiftData = summary || currentShift;

            const endTime = new Date().toISOString();

            const expectedCash = (Number(shiftData.initial_cash) || 0) +
                (Number(shiftData.totalCashSales) || 0) +
                (Number(shiftData.total_cash_in) || 0) -
                (Number(shiftData.total_cash_out) || 0);

            const cashDifference = Number(finalCash) - expectedCash;

            const expectedNonCash = Number(shiftData.totalNonCashSales) || 0;
            const nonCashDifference = Number(finalNonCash) - expectedNonCash;

            const endData = {
                end_time: endTime,
                final_cash: Number(finalCash),
                final_non_cash: Number(finalNonCash),
                expected_cash: expectedCash,
                expected_non_cash: expectedNonCash,
                status: 'closed',
                cash_difference: cashDifference,
                non_cash_difference: nonCashDifference,
                notes: notes
            };

            const { error } = await supabase
                .from('shifts')
                .update(endData)
                .eq('id', currentShift.id);

            if (error) throw error;

            // Telegram Alert
            if (currentStore?.telegramNotifyShift) {
                let msg = `🔒 <b>SHIFT DITUTUP</b>\n\n`;
                msg += `👤 Kasir: ${currentShift.cashier_name}\n`;
                msg += `⏰ Waktu: ${new Date(endTime).toLocaleString('id-ID')}\n`;
                msg += `💵 Total Penjualan: Rp ${shiftData.totalSales.toLocaleString()}\n`;
                msg += `💵 Tunai Diterima: Rp ${shiftData.totalCashSales.toLocaleString()}\n`;
                msg += `💳 Non-Tunai: Rp ${shiftData.totalNonCashSales.toLocaleString()}\n`;
                msg += `📥 Kas Masuk: Rp ${shiftData.total_cash_in?.toLocaleString() || 0}\n`;
                msg += `📤 Total Pengeluaran: Rp ${shiftData.total_cash_out?.toLocaleString() || 0}\n`;
                msg += `--------------------------------\n`;
                msg += `💰 Uang Fisik (Disetor): Rp ${finalCash.toLocaleString()}\n`;
                msg += `💳 Uang Transfer (Cek): Rp ${finalNonCash.toLocaleString()}\n`;
                msg += `📊 Selisih Tunai: ${cashDifference < 0 ? '🔴' : '🟢'} Rp ${cashDifference.toLocaleString()}\n`;
                if (nonCashDifference !== 0) msg += `📊 Selisih Transfer: ${nonCashDifference < 0 ? '🔴' : '🟢'} Rp ${nonCashDifference.toLocaleString()}\n`;
                if (notes) msg += `📝 Catatan: ${notes}\n`;

                sendMessage(msg, { token: currentStore?.telegramBotToken, chatId: currentStore?.telegramChatId });
            }

            setCurrentShift(null);
            return { success: true };
        } catch (error) {
            console.error('Error ending shift:', error);
            return { success: false, error: error.message };
        }
    };

    const terminateShift = async (shiftId, notes = 'Terminated by Admin') => {
        try {
            const endTime = new Date().toISOString();

            const { error } = await supabase
                .from('shifts')
                .update({
                    end_time: endTime,
                    status: 'closed',
                    notes: notes,
                    terminated_by_admin: true
                })
                .eq('id', shiftId);

            if (error) throw error;

            if (currentShift && currentShift.id === shiftId) {
                setCurrentShift(null);
            }

            // Telegram Alert
            if (currentStore?.telegramNotifyShift) {
                const msg = `🛑 <b>SHIFT DIHENTIKAN ADMIN</b>\n\n🆔 Shift ID: #${shiftId.slice(0, 8)}\n📝 Catatan: ${notes}\n⏰ Waktu: ${new Date(endTime).toLocaleString('id-ID')}`;
                sendMessage(msg, { token: currentStore?.telegramBotToken, chatId: currentStore?.telegramChatId });
            }

            return { success: true };
        } catch (error) {
            console.error('Error terminating shift:', error);
            return { success: false, error: error.message };
        }
    };

    const updateShiftStats = async () => {
        // No longer needed as re-calculated on endShift and getShiftSummary
        console.log('Update shift stats no longer required');
    };

    return (
        <ShiftContext.Provider value={{
            currentShift,
            loading,
            startShift,
            endShift,
            terminateShift,
            updateShiftStats,
            addCashMovement,
            getShiftSummary
        }}>
            {children}
        </ShiftContext.Provider>
    );
};

export const useShift = () => useContext(ShiftContext);
