/* eslint-env node */
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Database Connection
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kasirpro_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test Connection
db.getConnection()
    .then(conn => {
        console.log("Connected to MySQL Database!");
        conn.release();
    })
    .catch(err => {
        console.error("Error connecting to database:", err);
    });

// --- HELPERS ---
const getStoreId = (req) => {
    // Try to get storeId from query, body, or headers
    const id = req.query.storeId || req.body.storeId || req.headers['x-store-id'];
    return id ? parseInt(id) : null;
};

// --- ROUTES ---

// 1. LOGIN
app.post('/api/login', async (req, res) => {
    const { pin } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE pin = ?', [pin]);
        if (rows.length > 0) {
            const user = rows[0];
            // Fetch store details if user is assigned to a store
            let store = null;
            if (user.store_id) {
                const [storeRows] = await db.query('SELECT * FROM stores WHERE id = ?', [user.store_id]);
                if (storeRows.length > 0) store = storeRows[0];
            }
            res.json({ success: true, user, store });
        } else {
            res.status(401).json({ success: false, message: 'Invalid PIN' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. STORE MANAGEMENT (Super Admin)
app.get('/api/stores', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM stores');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/stores', async (req, res) => {
    const { name, address, phone } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO stores (name, address, phone) VALUES (?, ?, ?)',
            [name, address, phone]
        );
        res.status(201).json({ id: result.insertId, message: 'Store created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/stores/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM stores WHERE id = ?', [req.params.id]);
        res.json({ message: 'Store deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. USER MANAGEMENT (For a specific store)
app.get('/api/users', async (req, res) => {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: 'Store ID required' });

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE store_id = ?', [storeId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { name, role, pin, storeId } = req.body;
    if (!storeId) return res.status(400).json({ error: 'Store ID required' });

    try {
        const [result] = await db.query(
            'INSERT INTO users (name, role, pin, store_id) VALUES (?, ?, ?, ?)',
            [name, role, pin, storeId]
        );
        res.status(201).json({ id: result.insertId, message: 'User created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. PRODUCTS (Scoped by Store)
app.get('/api/products', async (req, res) => {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: 'Store ID required' });

    try {
        const [rows] = await db.query(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.store_id = ?
        `, [storeId]);

        const products = rows.map(p => ({
            id: p.id,
            name: p.name,
            code: p.code,
            category: p.category_name,
            categoryId: p.category_id,
            price: parseFloat(p.sell_price),
            sellPrice: parseFloat(p.sell_price),
            buyPrice: parseFloat(p.buy_price),
            stock: p.stock,
            minStock: p.min_stock,
            discount: parseFloat(p.discount),
            image: p.image_url,
            type: p.type
        }));
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, code, category, buyPrice, sellPrice, stock, minStock, type, discount, image, storeId } = req.body;
    if (!storeId) return res.status(400).json({ error: 'Store ID required' });

    try {
        // Find category ID within the SAME store
        const [catRows] = await db.query('SELECT id FROM categories WHERE name = ? AND store_id = ?', [category, storeId]);
        let categoryId = catRows.length > 0 ? catRows[0].id : null;

        // If category doesn't exist in this store, create it? 
        // Or maybe fail? For now, let's assume it must exist or we create it.
        // Let's create it if missing for better UX in this simple app
        if (!categoryId && category) {
            const [newCat] = await db.query('INSERT INTO categories (name, store_id) VALUES (?, ?)', [category, storeId]);
            categoryId = newCat.insertId;
        }

        const [result] = await db.query(
            `INSERT INTO products (name, code, category_id, buy_price, sell_price, stock, min_stock, type, discount, image_url, store_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, code, categoryId, buyPrice, sellPrice, stock, minStock, type, discount, image, storeId]
        );
        res.status(201).json({ id: result.insertId, message: 'Product created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. CATEGORIES (Scoped by Store)
app.get('/api/categories', async (req, res) => {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: 'Store ID required' });

    try {
        const [rows] = await db.query('SELECT * FROM categories WHERE store_id = ?', [storeId]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name, storeId } = req.body;
    if (!storeId) return res.status(400).json({ error: 'Store ID required' });

    try {
        const [result] = await db.query('INSERT INTO categories (name, store_id) VALUES (?, ?)', [name, storeId]);
        res.status(201).json({ id: result.insertId, name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    // Ideally check store ownership here too
    try {
        await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. TRANSACTIONS (Scoped by Store)
// Note: The original code didn't have transaction endpoints, but the user asked for "every store have each transaction".
// I should add transaction recording.

app.post('/api/transactions', async (req, res) => {
    const { storeId, userId, items, total, paymentMethod } = req.body;
    if (!storeId) return res.status(400).json({ error: 'Store ID required' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create Transaction Record
        const [transResult] = await connection.query(
            'INSERT INTO transactions (store_id, user_id, total_amount, payment_method) VALUES (?, ?, ?, ?)',
            [storeId, userId, total, paymentMethod]
        );
        const transactionId = transResult.insertId;

        // 2. Update Stock (Optional, but good for POS)
        // Assuming items is array of { id, qty }
        for (const item of items) {
            await connection.query(
                'UPDATE products SET stock = stock - ? WHERE id = ? AND store_id = ?',
                [item.qty, item.id, storeId]
            );
        }

        await connection.commit();
        res.status(201).json({ id: transactionId, message: 'Transaction recorded' });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
