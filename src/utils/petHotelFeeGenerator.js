import { parseISO, format, eachDayOfInterval, getDay } from 'date-fns';

/**
 * Automatically generates staff fees for a single Pet Hotel / Rental transaction.
 * Should be called right after the transaction is successfully saved to the database.
 */
export const generateFeeForTransaction = async (transaction, currentStore, supabase) => {
    try {
        // 1. Validations
        if (!currentStore || !transaction) return { success: false, message: 'Missing store or transaction data' };
        
        const feeConfig = currentStore?.settings?.pet_hotel_fee || {};
        if (feeConfig.enabled !== true) return { success: false, message: 'Fee feature disabled' };
        if (transaction.type !== 'rental' || transaction.voided_at) return { success: false, message: 'Not a valid rental transaction' };

        const baseFeePerDay = feeConfig.feePerDay || 0;
        const schedules = feeConfig.schedules || {};

        // 2. Existing Fee Check (to prevent duplicates if somehow called twice)
        const { data: existingFees } = await supabase
            .from('employee_fees')
            .select('id')
            .eq('transaction_id', String(transaction.id))
            .limit(1);

        if (existingFees && existingFees.length > 0) {
            return { success: false, message: 'Fees already exist for this transaction' };
        }

        // 3. Extract dates & qty
        const startTimeIso = transaction.payment_details?.snapshot?.start_time || transaction.date;
        const checkInDate = format(parseISO(startTimeIso), 'yyyy-MM-dd');
        const checkOutDate = format(parseISO(transaction.date), 'yyyy-MM-dd');

        // Extract hotel item to find QTY (days paid)
        const hotelItem = (transaction.items || []).find(item =>
            item.category === 'Hotel' ||
            item.name?.toLowerCase().includes('hotel') ||
            item.category === 'Kamar' ||
            item.name?.toLowerCase().includes('sewa')
        );
        
        let totalDaysPaid = 1;

        if (hotelItem) {
            if (hotelItem.qty > 1) totalDaysPaid = hotelItem.qty;
            else if (hotelItem.quantity > 1) totalDaysPaid = hotelItem.quantity;
            else {
                const match = hotelItem.name?.match(/\((\d+)\s+Hari\)/i);
                if (match) {
                    totalDaysPaid = parseInt(match[1], 10);
                }
            }
        }

        const totalBudget = totalDaysPaid * baseFeePerDay;

        const daysInRental = eachDayOfInterval({
            start: parseISO(checkInDate),
            end: parseISO(checkOutDate)
        });

        const SHIFT_ORDER = { pagi: 0, sore: 1, malam: 2, full: 3 };
        let checkInShiftRank = 0; 
        if (startTimeIso) {
            const checkInHour = new Date(startTimeIso).getHours();
            if (checkInHour >= 18) {
                checkInShiftRank = SHIFT_ORDER.malam;
            } else if (checkInHour >= 12) {
                checkInShiftRank = SHIFT_ORDER.sore;
            } else {
                checkInShiftRank = SHIFT_ORDER.pagi;
            }
        }

        const validShiftSlots = [];
        let totalDurationWeights = 0;

        for (const day of daysInRental) {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayMonth = format(day, 'yyyy-MM');
            const dayOfWeek = String(getDay(day));
            const isCheckInDay = dayStr === checkInDate;

            const dayMonthSchedule = schedules[dayMonth] || {};
            const isOldFormat = Object.keys(dayMonthSchedule).some(k => !isNaN(k) && k.length === 1);
            let shiftsForDay = [];

            if (isOldFormat) {
                shiftsForDay = dayMonthSchedule[dayOfWeek] || [];
            } else {
                const overrides = dayMonthSchedule.overrides || {};
                const template = dayMonthSchedule.template || {};
                shiftsForDay = overrides[dayStr] || template[dayOfWeek] || [];
            }

            const isWeekendDay = dayOfWeek === '0' || dayOfWeek === '6';

            for (const shift of shiftsForDay) {
                if (!shift.name) continue;

                const shiftTypeStr = (shift.shift || 'pagi').toLowerCase();

                if (isCheckInDay) {
                    let shiftRank = 0;
                    if (shiftTypeStr.includes('malam')) shiftRank = SHIFT_ORDER.malam;
                    else if (shiftTypeStr.includes('sore')) shiftRank = SHIFT_ORDER.sore;
                    else if (shiftTypeStr.includes('full')) shiftRank = SHIFT_ORDER.full;
                    else shiftRank = SHIFT_ORDER.pagi;

                    if (shiftRank < checkInShiftRank && shiftRank !== SHIFT_ORDER.full) {
                        continue;
                    }
                }

                let weight = 0.5;
                if (shiftTypeStr.includes('full')) weight = 1.0;

                validShiftSlots.push({
                    employeeName: shift.name,
                    shiftLabel: `${format(day, 'dd/MM')} - ${shift.shift}`,
                    feeDate: dayStr,
                    isWeekend: isWeekendDay,
                    weight: weight
                });

                totalDurationWeights += weight;
            }
        }

        if (validShiftSlots.length === 0 || totalDurationWeights === 0) {
            return { success: false, message: 'No valid shifts found in schedule for this rental period' };
        }

        const feePerWeightUnit = totalBudget / totalDurationWeights;
        const newFeeRecords = [];

        for (const slot of validShiftSlots) {
            const finalFee = feePerWeightUnit * slot.weight;

            newFeeRecords.push({
                store_id: currentStore.id,
                transaction_id: String(transaction.id),
                employee_name: slot.employeeName,
                fee_amount: finalFee,
                fee_date: slot.feeDate,
                shift_label: slot.shiftLabel,
                is_weekend: slot.isWeekend,
                created_at: new Date().toISOString()
            });
        }

        if (newFeeRecords.length > 0) {
            const { error: insertError } = await supabase
                .from('employee_fees')
                .insert(newFeeRecords);

            if (insertError) throw insertError;
        }

        return { success: true, count: newFeeRecords.length };

    } catch (err) {
        console.error("Error auto-generating pet hotel fee:", err);
        return { success: false, error: err.message };
    }
};
