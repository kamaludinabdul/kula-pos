// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || '';

/**
 * Send a transaction report to Telegram
 * @param {Object} transaction - Transaction data
 * @param {Object} config - Telegram config { token, chatId }
 * @returns {Promise<boolean>} - Success status
 */
export const sendTransactionToTelegram = async (transaction, config = {}, store = null) => {
    // Use config if provided, otherwise fallback to env vars (for backward compatibility)
    const token = config.token || TELEGRAM_BOT_TOKEN;
    const chatId = config.chatId || TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('Telegram credentials not configured');
        return false;
    }

    try {
        const message = formatTransactionMessage(transaction, store);
        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json();

        if (data.ok) {
            console.log('Transaction sent to Telegram successfully');
            return true;
        } else {
            console.error('Failed to send to Telegram:', data);
            return false;
        }
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return false;
    }
};

/**
 * Format transaction data into a readable Telegram message
 * @param {Object} transaction - Transaction data
 * @param {Object} store - Store data with taxRate
 * @returns {string} - Formatted message
 */
const formatTransactionMessage = (transaction, store = null) => {
    const date = new Date(transaction.date);
    const formattedDate = date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    });

    let message = `🧾 <b>TRANSAKSI BARU</b>\n\n`;
    message += `📅 <b>Tanggal:</b> ${formattedDate}\n`;
    message += `🕐 <b>Waktu:</b> ${formattedTime}\n`;
    message += `👤 <b>Kasir:</b> ${transaction.cashier}\n`;
    message += `🆔 <b>ID:</b> #${transaction.id.slice(0, 8)}\n`;
    message += `💳 <b>Metode:</b> ${transaction.paymentMethod}\n\n`;

    message += `📦 <b>Items:</b>\n`;
    transaction.items.forEach((item, index) => {
        message += `${index + 1}. ${item.name}\n`;
        message += `   ${item.qty} x Rp ${item.price.toLocaleString()} = Rp ${item.total.toLocaleString()}\n`;
    });

    message += `\n💰 <b>Ringkasan:</b>\n`;
    message += `Subtotal: Rp ${transaction.subtotal.toLocaleString()}\n`;
    message += `Pajak (${store?.taxRate || 0}%): Rp ${transaction.tax.toLocaleString()}\n`;
    message += `<b>TOTAL: Rp ${transaction.total.toLocaleString()}</b>\n`;

    return message;
};

/**
 * Send a generic message to Telegram
 * @param {string} message - The message text (HTML supported)
 * @param {Object} config - Telegram config { token, chatId }
 * @returns {Promise<boolean>} - Success status
 */
export const sendMessage = async (message, config = {}) => {
    const token = config.token || TELEGRAM_BOT_TOKEN;
    const chatId = config.chatId || TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn('Telegram credentials not configured');
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json();
        return data.ok;
    } catch (error) {
        console.error('Error sending message to Telegram:', error);
        return false;
    }
};

/**
 * Send a low stock alert to Telegram
 * @param {Array} lowStockItems - Array of items with low stock { name, stock, minStock }
 * @param {Object} config - Telegram config { token, chatId }
 * @returns {Promise<boolean>} - Success status
 */
export const sendLowStockAlert = async (lowStockItems, config = {}) => {
    if (!lowStockItems || lowStockItems.length === 0) return false;

    let message = `⚠️ <b>PERINGATAN STOK MENIPIS</b>\n\n`;
    message += `Berikut adalah produk dengan stok di bawah batas minimum:\n\n`;

    lowStockItems.forEach((item, index) => {
        message += `${index + 1}. <b>${item.name}</b>\n`;
        message += `   Sisa Stok: <b>${item.stock}</b> (Min: ${item.minStock || 5})\n`;
    });

    message += `\nSegera lakukan restock!`;

    return sendMessage(message, config);
};

export default {
    sendTransactionToTelegram,
    sendMessage,
    sendLowStockAlert
};
