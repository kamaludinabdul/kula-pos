import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShoppingBag,
    ShoppingCart,
    Plus,
    Calendar,
    DollarSign,
    Weight,
    Package,
    Trash2,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Upload,
    Download,
    TrendingUp,

    TrendingDown,
    Crown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';
import { useData } from '../context/DataContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { checkPlanAccess } from '../utils/plans';
import { getRecommendationReasoning, getAutoBudgetRecommendation } from '../utils/ai';

const ShoppingRecommendations = () => {
    const navigate = useNavigate();
    const { activeStoreId, products, categories, currentStore, fetchAllProducts } = useData();
    const [recommendations, setRecommendations] = useState([]);

    // Unified Config State
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [configMode, setConfigMode] = useState(null); // 'ai' or 'excel'
    const [budget, setBudget] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);

    const [loading, setLoading] = useState(false);
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState(null); // 'kasir_pintar' or null

    // Dialog States
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    // Auto-Budgeting State
    const [isAutoBudgeting, setIsAutoBudgeting] = useState(false);
    const [aiBudgetReason, setAiBudgetReason] = useState(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: null });

    // Excel Upload State
    const [pendingExcelData, setPendingExcelData] = useState(null);
    // Excel Upload State


    const showAlert = (title, message) => {
        setAlertData({ title, message });
        setIsAlertOpen(true);
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmData({ title, message, onConfirm });
        setIsConfirmOpen(true);
    };



    const fetchRecommendations = useCallback(async () => {
        if (!activeStoreId) {
            console.log("No active store ID, skipping fetch.");
            return;
        }

        console.log("Fetching recommendations for Store ID:", activeStoreId);

        try {
            const { data, error } = await supabase
                .from('shopping_recommendations')
                .select('*')
                .eq('store_id', activeStoreId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log("Fetched recommendations count:", data.length);
            setRecommendations(data || []);
        } catch (error) {
            console.error("Error fetching recommendations:", error);
            showAlert("Error", "Gagal mengambil data rekomendasi: " + error.message);
        }
    }, [activeStoreId]);

    useEffect(() => {
        if (activeStoreId) {
            fetchRecommendations();
            // Products are not loaded by default (Phase 2 removed from DataContext).
            // We must explicitly fetch them for the recommendation engine.
            if (products.length === 0) {
                fetchAllProducts(activeStoreId);
            }
        }
    }, [activeStoreId, fetchRecommendations, fetchAllProducts, products.length]);

    const handleOpenConfig = (mode) => {
        setConfigMode(mode);
        // Default values
        setBudget('5.000.000');
        setSelectedCategories([]); // Empty means ALL
        setAiBudgetReason(null);
        setIsConfigModalOpen(true);
    };

    const handleAutoBudget = async () => {
        setIsAutoBudgeting(true);
        try {
            // 1. Fetch transactions from last 30 days
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);

            const { data: recentTransactions, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('store_id', activeStoreId)
                .gte('date', startDate.toISOString())
                .eq('status', 'completed')
                .order('date', { ascending: false });

            if (error) throw error;

            if (!recentTransactions || recentTransactions.length === 0) {
                showAlert("Info", "Data transaksi 30 hari terakhir belum cukup untuk dianalisis AI.");
                setIsAutoBudgeting(false);
                return;
            }

            // 2. Aggregate Revenue and calculate average margin
            let recentRevenue = 0;
            let totalCost = 0;
            const productStats = {};

            recentTransactions.forEach(t => {
                recentRevenue += t.total;
                if (t.items) {
                    t.items.forEach(item => {
                        const product = products.find(p => p.id === item.id);
                        if (product) {
                            const cost = parseInt(product.buyPrice) || 0;
                            totalCost += cost * item.qty;

                            // Count for Top Products
                            if (!productStats[product.id]) {
                                productStats[product.id] = { name: product.name, qty: 0 };
                            }
                            productStats[product.id].qty += item.qty;
                        }
                    });
                }
            });

            const grossProfit = recentRevenue - totalCost;
            let averageMargin = 0;
            if (recentRevenue > 0) {
                averageMargin = ((grossProfit / recentRevenue) * 100).toFixed(1);
            }

            // Top 10 selling products
            const topProducts = Object.values(productStats)
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 10);

            // 3. Call AI
            const aiResponse = await getAutoBudgetRecommendation({
                recentRevenue,
                averageMargin,
                topProducts: topProducts.map(p => p.name)
            }, currentStore.settings?.geminiApiKey);

            if (aiResponse && aiResponse.recommendedBudget > 0) {
                const formatted = aiResponse.recommendedBudget.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                setBudget(formatted);
                setAiBudgetReason(aiResponse.reason);
            } else {
                showAlert("Oops", aiResponse?.reason || "Gagal mendapatkan rekomendasi budget dari AI.");
            }

        } catch (error) {
            console.error("Error auto-budgeting:", error);
            showAlert("Error", "Gagal menghitung AI Auto-Budgeting.");
        } finally {
            setIsAutoBudgeting(false);
        }
    };

    const handleConfirmConfig = () => {
        if (configMode === 'ai') {
            generateRecommendation();
        } else if (configMode === 'excel') {
            processExcelRecommendation();
        }
    };

    const toggleCategory = (catName) => {
        setSelectedCategories(prev => {
            if (prev.includes(catName)) {
                return prev.filter(c => c !== catName);
            } else {
                return [...prev, catName];
            }
        });
    };

    const isCategoryMatch = (product) => {
        if (selectedCategories.length === 0) return true;

        let pCats = [];
        if (Array.isArray(product.category)) {
            pCats = product.category;
        } else if (product.category) {
            pCats = [product.category];
        }

        // Normalize names
        const pCatNames = pCats.map(c => (typeof c === 'object' && c?.name) ? c.name : c);

        // Return true if intersection
        return pCatNames.some(name => selectedCategories.includes(name));
    };

    const generateRecommendation = async () => {
        const rawBudget = Number(budget.replace(/[.,]/g, ''));
        if (!budget || isNaN(rawBudget) || rawBudget <= 0) {
            showAlert("Invalid Input", "Masukkan budget yang valid.");
            return;
        }

        setLoading(true);
        try {
            // 1. Fetch transactions from last 90 days
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 90);

            // Time periods for Trend Analysis
            const recentStartDate = new Date();
            recentStartDate.setDate(recentStartDate.getDate() - 30); // Last 30 days

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('store_id', activeStoreId)
                .gte('date', startDate.toISOString())
                .order('date', { ascending: false });

            if (error) throw error;

            if (!transactions || transactions.length === 0) {
                showAlert("Info", "Tidak ada transaksi dalam 90 hari terakhir untuk dianalisis.");
                setLoading(false);
                return;
            }

            // 2. Aggregate sales velocity & Trend Analysis
            const productStats = {};

            transactions.forEach(t => {
                const tDate = new Date(t.date);
                const isRecent = tDate >= recentStartDate;

                if (t.items) {
                    t.items.forEach(item => {
                        if (!productStats[item.id]) {
                            productStats[item.id] = {
                                totalQty: 0,
                                recentQty: 0,
                                previousQty: 0,
                                lastSale: t.date
                            };
                        }

                        productStats[item.id].totalQty += item.qty;

                        if (isRecent) {
                            productStats[item.id].recentQty += item.qty;
                        } else {
                            productStats[item.id].previousQty += item.qty;
                        }

                        if (tDate > new Date(productStats[item.id].lastSale)) {
                            productStats[item.id].lastSale = t.date;
                        }
                    });
                }
            });

            // 3. Score products with AI Trend Logic
            const scoredProducts = products
                .filter(p => isCategoryMatch(p)) // Apply Category Filter
                .map(p => {
                    const stats = productStats[p.id] || { totalQty: 0, recentQty: 0, previousQty: 0 };

                    // Calculate Daily Rates
                    const recentDailyRate = stats.recentQty / 30;
                    const previousDailyRate = stats.previousQty / 60; // Remaining 60 days of the 90 day window

                    let trendScore = 1.0; // Neutral
                    let trendLabel = 'Stable';
                    let reasoning = 'Permintaan stabil';

                    // Avoid division by zero and noise for very low volume items
                    if (previousDailyRate > 0.1) {
                        const growth = (recentDailyRate - previousDailyRate) / previousDailyRate;

                        if (growth > 0.2) { // > 20% growth
                            trendScore = 1.2; // Boost stock by 20%
                            trendLabel = 'Trending Up';
                            reasoning = `Tren naik ${(growth * 100).toFixed(0)}% 30 hari terakhir`;
                        } else if (growth < -0.2) { // < 20% drop
                            trendScore = 0.8; // Reduce stock by 20%
                            trendLabel = 'Trending Down';
                            reasoning = `Tren turun ${Math.abs(growth * 100).toFixed(0)}%`;
                        }
                    } else if (recentDailyRate > 0.2 && previousDailyRate <= 0.1) {
                        // New popular item
                        trendScore = 1.3;
                        trendLabel = 'New Hit';
                        reasoning = 'Produk mulai populer';
                    }

                    return {
                        ...p,
                        velocity: stats.totalQty,
                        recentRate: recentDailyRate,
                        trendScore,
                        trendLabel,
                        reasoning,
                        score: stats.totalQty * trendScore // Weighted score
                    };
                }).sort((a, b) => b.score - a.score);

            // 4. Build Shopping List based on Budget
            let remainingBudget = rawBudget;
            const shoppingList = [];
            let totalWeightAcc = 0;
            let totalItemsAcc = 0;

            console.log("BUDGET:", rawBudget);
            console.log("Scored Products Count:", scoredProducts.length);
            if (scoredProducts.length > 0) {
                console.log("Top Scored Product Sample:", scoredProducts[0]);
            }

            for (const product of scoredProducts) {
                if (remainingBudget <= 0) break;

                const cost = Number(product.buyPrice) || (Number(product.sellPrice) * 0.7) || 0;
                console.log(`Checking ${product.name} | Cost: ${cost} | Remaining: ${remainingBudget}`);

                if (cost > 0 && cost <= remainingBudget) {
                    let qtyToBuy = 10; // Default fallback (Base Units)

                    // Smart Quantity Calculation (Base Units)
                    if (product.recentRate > 0) {
                        // Base: Aim for 14 days of stock based on RECENT velocity
                        let baseQty = Math.ceil(product.recentRate * 14);

                        // Apply AI Trend Adjustment
                        qtyToBuy = Math.ceil(baseQty * product.trendScore);
                    }

                    // --- Satuan PO Logic ---
                    let displayQty = qtyToBuy;
                    let displayUnit = product.unit || 'Pcs';
                    let displayPrice = cost;
                    let isPO = false;

                    if (product.purchaseUnit && product.conversionToUnit && Number(product.conversionToUnit) > 1) {
                        const conversion = Number(product.conversionToUnit);
                        // Convert needed base qty to PO units (Round UP to ensure enough stock)
                        const poQtyNeeded = Math.ceil(qtyToBuy / conversion);

                        // Recalculate cost for PO Unit
                        const poCost = cost * conversion;

                        // Check if we can afford at least 1 PO Unit
                        if (poCost <= remainingBudget) {
                            displayQty = poQtyNeeded;
                            displayUnit = product.purchaseUnit;
                            displayPrice = poCost;
                            isPO = true;

                            // Budget Constraint Check for PO Units
                            if (displayPrice * displayQty > remainingBudget) {
                                displayQty = Math.floor(remainingBudget / displayPrice);
                            }
                        } else {
                            // Cannot afford even 1 PO Unit, fallback to Pcs logic?
                            // Or just skip? Let's fallback to max Pcs we can buy
                            displayQty = Math.floor(remainingBudget / cost);
                            // Keep displayUnit as base unit (Pcs)
                            // displayPrice is already base cost
                        }
                    } else {
                        // Standard Base Unit Logic
                        if (displayPrice * displayQty > remainingBudget) {
                            displayQty = Math.floor(remainingBudget / displayPrice);
                        }
                    }

                    if (displayQty > 0) {
                        const totalCost = displayPrice * displayQty;
                        // Weight calculation needs careful handling. 
                        // product.weight is usually per Base Unit.
                        const weightPerBaseUnit = Number(product.weight) || 0;
                        let itemTotalWeight = 0;

                        if (isPO) {
                            // Total Weight = Weight per Pcs * Conversion * Qty PO
                            itemTotalWeight = weightPerBaseUnit * Number(product.conversionToUnit) * displayQty;
                        } else {
                            itemTotalWeight = weightPerBaseUnit * displayQty;
                        }

                        shoppingList.push({
                            id: product.id,
                            name: product.name,
                            buyPrice: displayPrice,
                            qty: displayQty,
                            unit: displayUnit,
                            isPO: isPO,
                            conversion: Number(product.conversionToUnit) || 1,
                            purchaseUnit: product.purchaseUnit || null,
                            total: totalCost,
                            weight: itemTotalWeight,
                            reasoning: product.reasoning,
                            trend: product.trendLabel
                        });

                        remainingBudget -= totalCost;
                        totalWeightAcc += itemTotalWeight;
                        totalItemsAcc += displayQty;
                    } else {
                        console.log(`Skipped ${product.name} because displayQty = ${displayQty}`);
                    }
                } else {
                    console.log(`Skipped ${product.name} because cost (${cost}) > budget (${remainingBudget}) or cost is 0`);
                }
            }

            if (shoppingList.length === 0) {
                const validPrices = scoredProducts
                    .map(p => Number(p.buyPrice) || (Number(p.sellPrice) * 0.7) || 0)
                    .filter(price => price > 0);

                const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

                if (minPrice > 0 && rawBudget < minPrice) {
                    showAlert("Budget Kurang", `Budget Rp ${rawBudget.toLocaleString()} terlalu kecil. Minimal Rp ${minPrice.toLocaleString()} untuk membeli 1 unit barang terlaris.`);
                } else {
                    showAlert("Info", "Tidak ada produk yang cocok untuk dibeli dengan budget ini. Coba cek apakah harga beli produk sudah diatur.");
                }
                setLoading(false);
                return;
            }

            // 5. Optional: Fetch AI Gemini Reasoning before saving
            if (import.meta.env.VITE_GEMINI_API_KEY || currentStore.settings?.geminiApiKey) {
                try {
                    const aiReasoning = await getRecommendationReasoning({
                        budget: rawBudget,
                        items: shoppingList.slice(0, 10) // Limit to top 10 to save tokens
                    }, currentStore.settings?.geminiApiKey);

                    // Update shoppingList with AI reasons
                    shoppingList.forEach(item => {
                        if (aiReasoning[item.id]) {
                            item.aiReason = aiReasoning[item.id];
                        }
                    });
                } catch (aiErr) {
                    console.error("AI reasoning failed:", aiErr);
                }
            }

            // 6. Save Recommendation
            const newRecommendation = {
                store_id: activeStoreId,
                created_at: new Date().toISOString(),
                budget: rawBudget,
                total_spent: rawBudget - remainingBudget,
                total_items: totalItemsAcc,
                total_weight: totalWeightAcc,
                items: shoppingList,
                source: 'ai_smart_restock' // Mark source
            };

            const { error: insertError } = await supabase
                .from('shopping_recommendations')
                .insert([newRecommendation]);

            if (insertError) throw insertError;

            setIsConfigModalOpen(false);
            setBudget('');
            fetchRecommendations();

        } catch (error) {
            console.error("Error generating recommendation:", error);
            showAlert("Error", `Gagal memproses rekomendasi: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Helper to find header row
                const findHeaderRow = (sheet) => {
                    const range = XLSX.utils.decode_range(sheet['!ref']);
                    for (let R = range.s.r; R <= Math.min(range.e.r, 10); ++R) {
                        // Look for typical header keywords in this row
                        for (let C = range.s.c; C <= range.e.c; ++C) {
                            const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
                            if (cell && cell.v) {
                                const val = cell.v.toString().toLowerCase();
                                if (val.includes('nama') || val.includes('kode') || val.includes('product')) {
                                    return R;
                                }
                            }
                        }
                    }
                    return 0; // Default to 0 if not found
                };

                // Determine header row
                let headerRow = 0;
                if (selectedPlatform === 'kasir_pintar') {
                    // User confirmed: Data starts reading from row 2 (index 1)
                    // Headers are on row 2 (index 1)
                    headerRow = 1;
                } else {
                    // Auto-detect for generic
                    headerRow = findHeaderRow(ws);
                }

                console.log("Using Header Row Index:", headerRow);
                const rawData = XLSX.utils.sheet_to_json(ws, { range: headerRow });

                if (rawData.length === 0) {
                    showAlert("Error", "File Excel kosong atau format tidak sesuai.");
                    return;
                }

                // Normalize keys to lowercase and trim whitespace
                const data = rawData.map(row => {
                    const newRow = {};
                    Object.keys(row).forEach(key => {
                        newRow[key.trim().toLowerCase()] = row[key];
                    });
                    return newRow;
                });

                console.log("Excel Columns Found (Normalized):", Object.keys(data[0]));

                // Store data and open budget modal
                setPendingExcelData(data);
                handleOpenConfig('excel');
            } catch (error) {
                console.error("Error processing Excel:", error);
                showAlert("Error", "Gagal memproses file Excel.");
            } finally {
                e.target.value = null; // Reset input
            }
        };
        reader.readAsBinaryString(file);
    };

    const processExcelRecommendation = async () => {
        const rawBudget = Number(budget.replace(/[.,]/g, ''));
        if (isNaN(rawBudget) || rawBudget <= 0) {
            showAlert("Invalid Input", "Budget tidak valid.");
            return;
        }

        setLoading(true);
        setIsConfigModalOpen(false);

        try {
            const data = pendingExcelData;
            const productStats = {};
            let matchCount = 0;

            data.forEach((row) => {
                let name, qty;

                if (selectedPlatform === 'kasir_pintar') {
                    // Normalized keys: 'nama', 'jumlah barang'
                    name = row['nama'];
                    qty = Number(row['jumlah barang'] || 0);
                } else {
                    // Generic Fuzzy Matching on normalized keys
                    const keys = Object.keys(row);

                    const nameKey = keys.find(k => k.includes('nama') || k.includes('product') || k.includes('name'));
                    const qtyKey = keys.find(k => k.includes('qty') || k.includes('quantity') || k.includes('jumlah'));

                    name = nameKey ? row[nameKey] : null;
                    qty = qtyKey ? Number(row[qtyKey] || 0) : 0;
                }

                if (name && qty > 0) {
                    const cleanName = name.toString().trim().toLowerCase();
                    // First find product by name
                    const product = products.find(p => p.name.trim().toLowerCase() === cleanName);

                    // Then check if it matches category filter
                    if (product && isCategoryMatch(product)) {
                        matchCount++;
                        if (!productStats[product.id]) {
                            productStats[product.id] = { qty: 0 };
                        }
                        productStats[product.id].qty += qty;
                    }
                }
            });

            console.log(`Total matched products: ${matchCount}`);

            if (matchCount === 0) {
                const foundColumns = Object.keys(data[0]).join(", ");
                showAlert("Info", `Tidak ada produk yang cocok. \n\nKolom yang ditemukan di Excel: ${foundColumns}\n\nPastikan format header sesuai (Nama, Jumlah Barang) dan nama produk sama persis dengan database.`);
                setLoading(false);
                return;
            }

            // Score products based on Excel velocity
            const scoredProducts = products.map(p => {
                const stats = productStats[p.id] || { qty: 0 };
                return {
                    ...p,
                    velocity: stats.qty,
                    score: stats.qty
                };
            }).sort((a, b) => b.score - a.score);

            // Build Shopping List
            let remainingBudget = rawBudget;
            const shoppingList = [];
            let totalWeight = 0;
            let totalItems = 0;

            // Pass 1: Base Allocation (14 Days Stock)
            for (const product of scoredProducts) {
                if (remainingBudget <= 0) break;
                if (product.score === 0) continue; // Skip items not in Excel

                const cost = Number(product.buyPrice) || (Number(product.sellPrice) * 0.7) || 0;

                if (cost > 0 && cost <= remainingBudget) {
                    let qtyToBuy = 10;
                    if (product.velocity > 0) {
                        const dailyRate = product.velocity / 30;
                        qtyToBuy = Math.ceil(dailyRate * 14); // Target 14 days
                    }

                    // --- Satuan PO Logic ---
                    let displayQty = qtyToBuy;
                    let displayUnit = product.unit || 'Pcs';
                    let displayPrice = cost;
                    let isPO = false;

                    if (product.purchaseUnit && product.conversionToUnit && Number(product.conversionToUnit) > 1) {
                        const conversion = Number(product.conversionToUnit);
                        const poQtyNeeded = Math.ceil(qtyToBuy / conversion);
                        const poCost = cost * conversion;

                        if (poCost <= remainingBudget) {
                            displayQty = poQtyNeeded;
                            displayUnit = product.purchaseUnit;
                            displayPrice = poCost;
                            isPO = true;

                            if (displayPrice * displayQty > remainingBudget) {
                                displayQty = Math.floor(remainingBudget / displayPrice);
                            }
                        } else {
                            displayQty = Math.floor(remainingBudget / cost);
                        }
                    } else {
                        if (displayPrice * displayQty > remainingBudget) {
                            displayQty = Math.floor(remainingBudget / displayPrice);
                        }
                    }

                    if (displayQty > 0) {
                        const totalCost = displayPrice * displayQty;
                        const weightPerBaseUnit = Number(product.weight) || 0;
                        let itemTotalWeight = 0;

                        if (isPO) {
                            itemTotalWeight = weightPerBaseUnit * Number(product.conversionToUnit) * displayQty;
                        } else {
                            itemTotalWeight = weightPerBaseUnit * displayQty;
                        }

                        shoppingList.push({
                            id: product.id,
                            name: product.name,
                            buyPrice: displayPrice,
                            qty: displayQty,
                            unit: displayUnit,
                            isPO: isPO,
                            conversion: Number(product.conversionToUnit) || 1,
                            purchaseUnit: product.purchaseUnit || null,
                            total: totalCost,
                            weight: itemTotalWeight,
                            unitWeight: weightPerBaseUnit,
                            velocity: product.velocity
                        });

                        remainingBudget -= totalCost;
                        totalWeight += itemTotalWeight;
                        totalItems += displayQty;
                    }
                }
            }

            // Pass 2: Maximize Budget
            if (remainingBudget > 0 && shoppingList.length > 0) {
                // Strategy A: Increase stock to 30 days for everyone
                for (const item of shoppingList) {
                    if (remainingBudget < item.buyPrice) continue;

                    const dailyRate = item.velocity > 0 ? item.velocity / 30 : 0;
                    if (dailyRate === 0) continue;

                    const currentDays = item.qty / dailyRate;
                    const targetDays = 30; // Bump to 30 days

                    if (currentDays < targetDays) {
                        const needed = Math.ceil((targetDays - currentDays) * dailyRate);
                        let add = needed;

                        if (add * item.buyPrice > remainingBudget) {
                            add = Math.floor(remainingBudget / item.buyPrice);
                        }

                        if (add > 0) {
                            item.qty += add;
                            const addedCost = add * item.buyPrice;
                            item.total += addedCost;
                            item.weight += (item.unitWeight * add);

                            remainingBudget -= addedCost;
                            totalWeight += (item.unitWeight * add);
                            totalItems += add;
                        }
                    }
                }

                // Strategy B: Dump remaining budget into Top 3 High Velocity Items
                if (remainingBudget > 0) {
                    const topItems = [...shoppingList].sort((a, b) => b.velocity - a.velocity).slice(0, 3);

                    for (const item of topItems) {
                        if (remainingBudget < item.buyPrice) continue;

                        const add = Math.floor(remainingBudget / item.buyPrice);

                        if (add > 0) {
                            item.qty += add;
                            const addedCost = add * item.buyPrice;
                            item.total += addedCost;
                            item.weight += (item.unitWeight * add);

                            remainingBudget -= addedCost;
                            totalWeight += (item.unitWeight * add);
                            totalItems += add;
                        }
                    }
                }
            }

            if (shoppingList.length === 0) {
                showAlert("Info", "Tidak ada produk yang cocok dari data Excel. Pastikan nama produk sesuai dengan database.");
                setLoading(false);
                return;
            }

            // Save Recommendation
            const newRecommendation = {
                store_id: activeStoreId,
                created_at: new Date().toISOString(),
                budget: rawBudget,
                total_spent: rawBudget - remainingBudget,
                total_items: totalItems,
                total_weight: totalWeight,
                items: shoppingList,
                source: selectedPlatform === 'kasir_pintar' ? 'excel_kasir_pintar' : 'excel_upload'
            };

            const { error: insertError } = await supabase
                .from('shopping_recommendations')
                .insert([newRecommendation]);

            if (insertError) throw insertError;

            showAlert("Success", "Rekomendasi berhasil dibuat dari file Excel!");

            // Refresh list
            await fetchRecommendations();

        } catch (error) {
            console.error("Error processing Excel:", error);
            showAlert("Error", "Gagal memproses file Excel.");
        } finally {
            setLoading(false);
            setSelectedPlatform(null); // Reset platform
        }
    };

    const handleDelete = (id) => {
        showConfirm(
            'Hapus Rekomendasi',
            'Hapus rekomendasi ini?',
            async () => {
                try {
                    const { error } = await supabase
                        .from('shopping_recommendations')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                    fetchRecommendations();
                } catch (error) {
                    console.error("Error deleting:", error);
                    showAlert("Error", "Gagal menghapus rekomendasi.");
                }
            }
        );
    };

    const handleDownloadTemplate = (type) => {
        let ws, wb;
        if (type === 'kasir_pintar') {
            // Kasir Pintar Format: Headers on Row 2
            const headers = ['No', 'Kode', 'Nama', 'Jumlah Transaksi', 'Keuntungan', 'Pendapatan', 'Jumlah Barang'];
            // Row 1 is usually title or empty, Row 2 is headers
            const data = [
                ['Laporan Penjualan per Barang'], // Row 1
                headers, // Row 2
                ['1', 'K001', 'Contoh Produk A', '10', '5000', '50000', '5'] // Sample Data
            ];
            ws = XLSX.utils.aoa_to_sheet(data);
            wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template Kasir Pintar");
            XLSX.writeFile(wb, "Template_Kasir_Pintar.xlsx");
        } else {
            // Standard Format
            const headers = ['Nama Produk', 'Qty'];
            const data = [
                headers,
                ['Contoh Produk A', '10'],
                ['Contoh Produk B', '5']
            ];
            ws = XLSX.utils.aoa_to_sheet(data);
            wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template Standar");
            XLSX.writeFile(wb, "Template_Standar.xlsx");
        }
    };

    const toggleExpand = (id) => {
        setExpandedCardId(expandedCardId === id ? null : id);
    };

    // ... existing state ...

    // Plan Restriction Check
    const currentPlan = currentStore?.plan || 'free';
    const isAllowed = checkPlanAccess(currentPlan, 'features.shopping_recommendations');

    if (!isAllowed) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
                <div className="bg-yellow-100 p-6 rounded-full mb-6">
                    <Crown className="h-16 w-16 text-yellow-600" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Fitur Premium</h1>
                <p className="text-muted-foreground max-w-md mb-8">
                    Fitur Rekomendasi Belanja Cerdas (AI) hanya tersedia untuk paket <span className="font-semibold text-primary">Enterprise</span>.
                </p>
                <Button className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all" onClick={() => window.location.href = '/settings/subscription'}>
                    Upgrade Sekarang
                </Button>
            </div>
        );
    }

    const handleCreatePO = (rec) => {
        // Prepare items for PO Form
        const poItems = rec.items.map(item => {
            const conversion = item.conversion || 1;
            const isPO = item.isPO;

            // Calculate Base Price (Per Pcs)
            let basePrice = item.buyPrice;
            if (isPO && conversion > 1) {
                basePrice = item.buyPrice / conversion;
            }

            return {
                productId: item.id,
                productName: item.name,
                qty: item.qty, // PO Qty
                qtyBase: item.qty * conversion,
                buyPrice: basePrice,
                subtotal: item.total
            };
        });

        navigate('/purchase-orders/new', {
            state: {
                recommendedItems: poItems,
                notes: `Dibuat dari Rekomendasi Belanja (Budget: Rp ${rec.budget.toLocaleString('id-ID')})`
            }
        });
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                        <Sparkles className="h-8 w-8 text-yellow-500" />
                        Rekomendasi Belanja
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm md:text-base">
                        Dapatkan rekomendasi belanja cerdas berbasis riwayat transaksi Anda.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild className="w-full lg:w-auto">
                            <Button variant="outline" className="border-dashed w-full lg:w-auto">
                                <Download className="h-4 w-4 mr-2" />
                                Template
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadTemplate('standard')}>
                                Template Standar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadTemplate('kasir_pintar')}>
                                Template Kasir Pintar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <input
                        type="file"
                        id="excel-upload"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleExcelUpload}
                    />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild className="w-full lg:w-auto">
                            <Button variant="outline" disabled={loading} className="w-full lg:w-auto">
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Excel
                                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                                setSelectedPlatform(null);
                                document.getElementById('excel-upload').click();
                            }}>
                                Format Standar (Nama, Qty)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                                setSelectedPlatform('kasir_pintar');
                                document.getElementById('excel-upload').click();
                            }}>
                                Kasir Pintar (Laporan Barang)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button onClick={() => handleOpenConfig('ai')} className="w-full lg:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
                        <Plus className="h-4 w-4 mr-2" />
                        <span className="whitespace-nowrap">Buat Rekomendasi Baru</span>
                    </Button>
                </div>
            </header>

            <div className="space-y-6">
                {recommendations.length === 0 ? (
                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-lg font-medium">Belum ada rekomendasi</h3>
                            <p className="text-muted-foreground max-w-sm mt-2">
                                Klik tombol "Buat Rekomendasi Baru" untuk membiarkan AI menganalisis kebutuhan stok Anda.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    recommendations.map((rec) => (
                        <Card key={rec.id} className="overflow-hidden border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="bg-gray-50/50 p-4 pb-2">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-base font-semibold">
                                                Rekomendasi Belanja
                                            </CardTitle>
                                            <Badge variant="secondary" className="text-xs font-normal">
                                                {new Date(rec.created_at).toLocaleDateString('id-ID', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </Badge>
                                            {rec.source === 'excel_upload' || rec.source === 'excel_kasir_pintar' ? (
                                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                    Excel
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                    AI Analysis
                                                </Badge>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs mt-1">
                                            {new Date(rec.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        </CardDescription>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            className="h-8 gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 border shadow-sm"
                                            onClick={() => handleCreatePO(rec)}
                                        >
                                            <ShoppingCart className="h-3.5 w-3.5" />
                                            Buat PO
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleExpand(rec.id)}>
                                            {expandedCardId === rec.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(rec.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="p-0 border-t">
                                {/* Compact Summary Grid - Always Visible */}
                                <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border-b cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleExpand(rec.id)}>
                                    <div className="bg-purple-50 p-2 rounded border border-purple-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-purple-600 uppercase font-semibold tracking-wider">Budget</span>
                                        <span className="text-sm font-bold text-purple-700">Rp {rec.budget.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="bg-blue-50 p-2 rounded border border-blue-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-blue-600 uppercase font-semibold tracking-wider">Total Item</span>
                                        <span className="text-sm font-bold text-blue-700">{rec.total_items}</span>
                                    </div>
                                    <div className="bg-green-50 p-2 rounded border border-green-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-green-600 uppercase font-semibold tracking-wider">Total Belanja</span>
                                        <span className="text-sm font-bold text-green-700">Rp {rec.total_spent.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="bg-orange-50 p-2 rounded border border-orange-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] text-orange-600 uppercase font-semibold tracking-wider">Total Berat</span>
                                        <span className="text-sm font-bold text-orange-700">{(rec.total_weight / 1000).toFixed(2)} Kg</span>
                                    </div>
                                </div>

                                {expandedCardId === rec.id && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="py-2 text-xs w-[30%]">Nama Barang</TableHead>
                                                    <TableHead className="py-2 text-xs w-[25%]">AI Insight</TableHead>
                                                    <TableHead className="py-2 text-xs text-right">Harga</TableHead>
                                                    <TableHead className="py-2 text-xs text-center">Qty</TableHead>
                                                    <TableHead className="py-2 text-xs text-right">Subtotal</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {rec.items.map((item, idx) => (
                                                    <TableRow key={idx} className="hover:bg-slate-50/50">
                                                        <TableCell className="py-2 text-xs font-medium">{item.name}</TableCell>
                                                        <TableCell className="py-2 text-xs">
                                                            {item.trend === 'Trending Up' && (
                                                                <div className="flex flex-col text-green-600">
                                                                    <div className="flex items-center gap-1">
                                                                        <TrendingUp className="h-4 w-4" />
                                                                        <span className="text-xs">{item.reasoning}</span>
                                                                    </div>
                                                                    {item.aiReason && (
                                                                        <div className="flex items-center gap-1 mt-1 text-primary">
                                                                            <Sparkles className="h-4 w-4 fill-primary animate-pulse" />
                                                                            <span className="text-xs italic font-semibold">{item.aiReason}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {item.trend === 'Trending Down' && (
                                                                <div className="flex flex-col text-red-500">
                                                                    <div className="flex items-center gap-1">
                                                                        <TrendingDown className="h-4 w-4" />
                                                                        <span className="text-xs">{item.reasoning}</span>
                                                                    </div>
                                                                    {item.aiReason && (
                                                                        <div className="flex items-center gap-1 mt-1 text-primary">
                                                                            <Sparkles className="h-4 w-4 fill-primary animate-pulse" />
                                                                            <span className="text-xs italic font-semibold">{item.aiReason}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {item.trend === 'New Hit' && (
                                                                <div className="flex flex-col text-blue-600">
                                                                    <div className="flex items-center gap-1">
                                                                        <TrendingUp className="h-3 w-3" />
                                                                        <span className="text-[10px]">{item.reasoning}</span>
                                                                    </div>
                                                                    {item.aiReason && (
                                                                        <div className="flex items-center gap-1 mt-1 text-primary">
                                                                            <Sparkles className="h-3 w-3 fill-primary animate-pulse" />
                                                                            <span className="text-xs italic font-semibold">{item.aiReason}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {!item.trend && item.aiReason && (
                                                                <div className="flex items-center gap-1 text-primary">
                                                                    <Sparkles className="h-4 w-4 fill-primary animate-pulse" />
                                                                    <span className="text-xs italic font-semibold">{item.aiReason}</span>
                                                                </div>
                                                            )}
                                                            {!item.trend && !item.aiReason && <span className="text-xs text-muted-foreground">-</span>}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs text-right">
                                                            <div>Rp {item.buyPrice.toLocaleString('id-ID')}</div>
                                                            <div className="text-[10px] text-muted-foreground">per {item.unit || 'Pcs'}</div>
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs text-center font-medium">
                                                            <div>{item.qty} {item.unit || 'Pcs'}</div>
                                                            {item.conversion > 1 && (
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    {item.isPO
                                                                        ? `(Isi ${item.conversion})`
                                                                        : `(Setara ${(item.qty / item.conversion).toFixed(1)} ${item.purchaseUnit || 'Satuan'})`
                                                                    }
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-xs text-right font-medium">Rp {item.total.toLocaleString('id-ID')}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Create Modal */}
            <AlertDialog
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertData.title}
                message={alertData.message}
            />

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title={confirmData.title}
                message={confirmData.message}
                onConfirm={confirmData.onConfirm}
            />

            <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
                <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-6 text-left">
                        <DialogTitle className="flex items-center gap-2">
                            {configMode === 'excel' ? <Upload className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                            {configMode === 'excel' ? 'Konfigurasi Rekomendasi (Excel)' : 'Konfigurasi Rekomendasi (AI)'}
                        </DialogTitle>
                        <DialogDescription>
                            Tentukan budget dan filter kategori untuk analisis yang optimal.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4 px-6 overflow-y-auto flex-1 text-left">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Total Budget Belanja (Rp)</Label>
                                {configMode === 'ai' && checkPlanAccess(currentStore?.owner?.plan, 'enterprise') && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100"
                                        onClick={handleAutoBudget}
                                        disabled={isAutoBudgeting}
                                    >
                                        {isAutoBudgeting ? (
                                            <Sparkles className="h-3 w-3 mr-1.5 animate-spin" />
                                        ) : (
                                            <Sparkles className="h-3 w-3 mr-1.5" />
                                        )}
                                        Hitung AI Budget Pintar
                                    </Button>
                                )}
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-500">Rp</span>
                                <Input
                                    value={budget}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        const formatted = val.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                                        setBudget(formatted);
                                        setAiBudgetReason(null); // Clear reason on manual edit
                                    }}
                                    placeholder="Contoh: 5.000.000"
                                    className="pl-10 font-bold text-lg h-12"
                                />
                            </div>

                            {configMode === 'ai' && !checkPlanAccess(currentStore?.owner?.plan, 'enterprise') && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Crown size={12} className="text-amber-500" />
                                    Upgrade ke Enterprise untuk Rekomendasi AI Auto-Budgeting.
                                </p>
                            )}

                            {aiBudgetReason && (
                                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex items-start gap-2 mt-2 animate-in fade-in zoom-in-95">
                                    <Sparkles className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                                    <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                                        "{aiBudgetReason}"
                                    </p>
                                </div>
                            )}

                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <Label>Filter Kategori (Opsional)</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-muted-foreground"
                                    onClick={() => setSelectedCategories([])}
                                >
                                    Reset
                                </Button>
                            </div>

                            <div className="border rounded-md p-3 h-48 overflow-y-auto space-y-2 bg-slate-50">
                                {categories.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-4">Belum ada kategori.</p>
                                ) : (
                                    categories.map((cat) => {
                                        // Defensive check: cat.name might be an object due to legacy data
                                        const catName = (typeof cat.name === 'object' && cat.name?.name) ? cat.name.name : cat.name;

                                        return (
                                            <div key={cat.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`cat-${cat.id}`}
                                                    checked={selectedCategories.includes(catName)}
                                                    onCheckedChange={() => toggleCategory(catName)}
                                                />
                                                <Label
                                                    htmlFor={`cat-${cat.id}`}
                                                    className="text-sm font-normal cursor-pointer flex-1"
                                                >
                                                    {catName}
                                                </Label>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                {selectedCategories.length === 0
                                    ? "Semua kategori akan dianalisis."
                                    : `Hanya menganalisis ${selectedCategories.length} kategori terpilih.`
                                }
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="px-6 pb-6 flex flex-col sm:flex-row-reverse gap-2">
                        <Button
                            onClick={handleConfirmConfig}
                            disabled={!budget || loading}
                            className="w-full sm:w-auto"
                        >
                            {loading ? (
                                <>
                                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                                    Memproses...
                                </>
                            ) : 'Proses Rekomendasi'}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setIsConfigModalOpen(false)}
                            className="w-full sm:w-auto"
                        >
                            Batal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ShoppingRecommendations;
