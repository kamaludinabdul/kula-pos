/**
 * Utility to send messages to Telegram via Bot API.
 * Uses VITE_TELEGRAM_BOT_TOKEN and VITE_TELEGRAM_CHAT_ID from .env.
 */

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

/**
 * Sends a message to the configured Telegram chat.
 * @param {string} text - The message text (Markdown supported).
 * @returns {Promise<boolean>} Success status.
 */
export const sendTelegramMessage = async (text) => {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.warn("Telegram config missing (Token or Chat ID).");
        return false;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text,
                parse_mode: 'Markdown',
            }),
        });

        const data = await response.json();
        return data.ok;
    } catch (error) {
        console.error("Failed to send Telegram message:", error);
        return false;
    }
};
