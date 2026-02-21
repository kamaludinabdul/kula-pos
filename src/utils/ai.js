import { GoogleGenerativeAI } from "@google/generative-ai";

const ENV_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Helper to get the correct GenerativeAI instance.
 * @param {string} customKey - API Key provided from user settings.
 * @returns {GoogleGenerativeAI|null}
 */
const getGenAIInstance = (customKey) => {
    const key = customKey && customKey.trim() !== '' ? customKey : ENV_API_KEY;
    if (!key) return null;
    return new GoogleGenerativeAI(key);
};

/**
 * Generates AI-based insights for sales forecasting.
 * @param {Object} data - Sales and weather data to analyze.
 * @param {string} [customApiKey] - Custom Gemini API key.
 * @returns {Promise<string>} AI insight text.
 */
export const getSalesForecastInsights = async (data, customApiKey = null) => {
    const genAI = getGenAIInstance(customApiKey);
    if (!genAI) return "API Key Gemini belum diatur. Silakan atur di Pengaturan Umum > Konfigurasi AI.";

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Anda adalah pakar analis bisnis ritel (Retail Business Analyst) untuk aplikasi POS Kula POS.
            Analisis data berikut dan berikan 3-5 poin wawasan (insights) yang ringkas dan tajam untuk membantu pemilik toko meningkatkan omset.

            Data Historis (30 hari terakhir):
            ${JSON.stringify(data.historical, null, 2)}

            Prediksi Omset (7 hari ke depan):
            ${JSON.stringify(data.forecast, null, 2)}

            Prakiraan Cuaca (7 hari ke depan):
            ${JSON.stringify(data.weather, null, 2)}

            Format Jawaban:
            - Gunakan Bahasa Indonesia yang profesional tapi santai.
            - Fokus pada peluang (Growth) dan pencegahan kerugian (Anti-Boncos).
            - Jangan terlalu panjang, langsung ke poin utama.
            - Singgung hubungan antara omset dan cuaca jika relevan.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Forecast Error:", error);
        return "Gagal mendapatkan wawasan AI. Pastikan koneksi dan API Key Anda valid.";
    }
};

/**
 * Generates AI-based reasoning for shopping recommendations.
 * @param {Object} productData - Product performance and budget data.
 * @param {string} [customApiKey] - Custom Gemini API key.
 * @returns {Promise<Object>} Map of ProductID -> AI Reasoning.
 */
export const getRecommendationReasoning = async (productData, customApiKey = null) => {
    const genAI = getGenAIInstance(customApiKey);
    if (!genAI) return {};

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Sebagai asisten pengadaan stok (Smart Restock Assistant), berikan alasan logis (max 10 kata) kenapa produk ini harus dibeli.
            Fokus pada Profit Margin, Tren Kecepatan Penjualan, dan Pencegahan Stok Mati (Dead Stock).

            Budget Toko: Rp ${productData.budget.toLocaleString()}
            Daftar Produk Kandidat:
            ${JSON.stringify(productData.items, null, 2)}

            Berikan jawaban dalam format JSON:
            { "product_id": "Alasan singkat kenapa harus stok barang ini" }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Basic JSON extraction in case AI adds markdown
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (error) {
        console.error("Gemini Recommendation Error:", error);
        return {};
    }
};
/**
 * Generates AI-based bundling suggestions.
 * @param {Array} pairs - Statistical pairs from Market Basket analysis.
 * @param {string} [customApiKey] - Custom Gemini API key.
 * @returns {Promise<Array>} Enhanced bundles with names and marketing tips.
 */
export const getSmartBundlingSuggestions = async (pairs, customApiKey = null) => {
    const genAI = getGenAIInstance(customApiKey);
    if (!genAI) return [];

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Sebagai pakar marketing ritel, buatkan strategi bundling (paket promo) berdasarkan data korelasi produk berikut:
            ${JSON.stringify(pairs.slice(0, 10), null, 2)}

            Untuk setiap pasangan, berikan:
            1. Nama Paket yang Menarik (Catchy).
            2. Tip Marketing singkat (max 15 kata).
            3. Alasan kenapa ini bundling yang bagus.

            Berikan jawaban dalam format JSON:
            [
              { "itemA": "id", "itemB": "id", "name": "Paket Sarapan", "tip": "Pajang di dekat kasir", "reason": "Korelasi tinggi di pagi hari" }
            ]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
        console.error("Gemini Bundling Error:", error);
        return [];
    }
};

/**
 * Detects anomalies in transaction patterns.
 * @param {Array} transactions - Recent transactions to analyze.
 * @param {string} [customApiKey] - Custom Gemini API key.
 * @returns {Promise<Array>} List of suspicious transaction IDs with reasons.
 */
export const getAnomalyDetectionInsights = async (transactions, customApiKey = null) => {
    const genAI = getGenAIInstance(customApiKey);
    if (!genAI) return [];

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analisis data transaksi berikut untuk mendeteksi potensi kecurangan atau anomali (Fraud Detection).
            Cari pola seperti: pengembalian uang (void) berlebih, transaksi nilai tinggi di jam ganjil, atau diskon yang tidak wajar.

            Data Transaksi:
            ${JSON.stringify(transactions.slice(0, 50), null, 2)}

            Berikan jawaban dalam format JSON:
            [
              { "transactionId": "id", "type": "warning|critical", "reason": "Alasan singkat" }
            ]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
        console.error("Gemini Anomaly Error:", error);
        return [];
    }
};

/**
 * Provides pricing insights for a product.
 * @param {Object} product - Product data.
 * @param {string} [customApiKey] - Custom Gemini API key.
 * @returns {Promise<string>} AI Pricing advice.
 */
export const getPricingInsights = async (product, customApiKey = null) => {
    const genAI = getGenAIInstance(customApiKey);
    if (!genAI) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Berikan saran harga jual optimal untuk produk ini:
            - Nama: ${product.name}
            - Harga Beli: ${product.buyPrice}
            - Harga Jual Saat Ini: ${product.sellPrice}
            - Margin: ${((product.sellPrice - product.buyPrice) / product.sellPrice * 100).toFixed(2)}%

            Berikan saran apakah harga bisa dinaikkan atau harus diturunkan untuk meningkatkan volume/untung. Max 15 kata.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Pricing Error:", error);
        return null;
    }
};

/**
 * Calculates optimal auto-budgeting for weekly restocks.
 * @param {Object} data - Contains top products, recent revenue, and margin info.
 * @param {string} [customApiKey] - Custom Gemini API key.
 * @returns {Promise<Object>} Object containing recommended budget and AI reasoning.
 */
export const getAutoBudgetRecommendation = async (data, customApiKey = null) => {
    const genAI = getGenAIInstance(customApiKey);
    if (!genAI) return { recommendedBudget: 0, reason: "API Key belum diatur." };

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Anda adalah Financial Advisor untuk toko retail.
            Hitung rekomendasi modal belanja mingguan (Auto-Budgeting) yang optimal berdasarkan data ini:

            Pendapatan 7 Hari Terakhir: Rp ${data.recentRevenue.toLocaleString()}
            Margin Rata-rata Toko: ${data.averageMargin}%
            Penjualan Top Produk:
            ${JSON.stringify(data.topProducts, null, 2)}

            Berdasarkan kecepatan putar barang (velocity) dan margin, berapakah modal belanja (budget) yang masuk akal disiapkan minggu ini untuk restock barang-barang tersebut agar profit maksimal namun cashflow tetap sehat? Anggap budget harus bisa menutupi harga beli produk terlaris.

            Format output harus JSON persis seperti ini:
            {
              "recommendedBudget": 5000000, 
              "reason": "Penjelasan singkat max 2 kalimat mengapa angka ini optimal berdasarkan perputaran dan margin."
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/{\s*"recommendedBudget"[\s\S]*}/);

        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { recommendedBudget: 0, reason: "Gagal memproses rekomendasi AI." };
    } catch (error) {
        console.error("Gemini Auto-Budgeting Error:", error);
        return { recommendedBudget: 0, reason: "Terjadi kesalahan saat memanggil AI." };
    }
};

/**
 * Generates an AI-powered daily closing report for Telegram.
 * @param {Object} data - Daily summary data (sales, count, popular items, etc.)
 * @param {string} [customApiKey] - Custom Gemini API key.
 * @returns {Promise<string>} Formatted Telegram message string.
 */
export const generateTelegramClosingReport = async (data, customApiKey = null) => {
    const genAI = getGenAIInstance(customApiKey);
    if (!genAI) {
        return `📊 *Laporan Harian (Tanpa Rekomendasi AI)*
        
Hari: ${data.date}
Total Penjualan: Rp ${data.totalSales.toLocaleString()}
Total Transaksi: ${data.count}

_AI Key belum disetel._`;
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Buatkan Laporan Harian (Tutup Buku) untuk dikirim ke Telegram Owner toko.
            Formatnya harus menggunakan Markdown ringan (bold: *, italic: _).
            Gunakan gaya bahasa profesional namun ramah dan memotivasi.
            
            Data hari ini:
            - Tanggal: ${data.date}
            - Total Pendapatan: Rp ${data.totalSales.toLocaleString()}
            - Jumlah Transaksi: ${data.count}
            ${data.topItems ? `- Produk Terlaris:\n${data.topItems.map(i => `  • ${i.name} (${i.qty})`).join('\\n')}` : ''}
            
            Struktur pesan:
            1. Emoji pembuka & Salam
            2. Ringkasan Angka (Pendapatan & Transaksi)
            3. *Insight AI Singkat* (Pesan motivasi atau analisis singkat 1-2 kalimat)
            
            Jangan gunakan tag code block (\`\`\`). Pastikan langsung berupa teks pesan siap kirim.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Gemini Telegram Report Error:", error);
        return `📊 *Laporan Harian (Error AI)*
        
Hari: ${data.date}
Total Penjualan: Rp ${data.totalSales.toLocaleString()}
Total Transaksi: ${data.count}

_Gagal menghasilkan insight AI._`;
    }
};
