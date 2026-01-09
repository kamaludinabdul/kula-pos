/* eslint-env node */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kasirpro_db',
    multipleStatements: true
};

async function migrate() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database...');

        // 1. Create stores table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS stores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                address TEXT,
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Stores table checked/created.');

        // 2. Check if we need to migrate existing data (create a default store)
        const [stores] = await connection.query('SELECT * FROM stores LIMIT 1');
        let defaultStoreId;

        if (stores.length === 0) {
            console.log('Creating default store for existing data...');
            const [result] = await connection.query(`
                INSERT INTO stores (name, address, phone) 
                VALUES ('Toko Utama', 'Alamat Default', '08123456789')
            `);
            defaultStoreId = result.insertId;
        } else {
            defaultStoreId = stores[0].id;
        }

        // 3. Add store_id to users
        try {
            await connection.query(`ALTER TABLE users ADD COLUMN store_id INT`);
            await connection.query(`ALTER TABLE users ADD CONSTRAINT fk_users_store FOREIGN KEY (store_id) REFERENCES stores(id)`);
            // Update existing users to default store, except maybe a super admin? 
            // For now, assign all existing to default store.
            await connection.query(`UPDATE users SET store_id = ? WHERE store_id IS NULL`, [defaultStoreId]);
            console.log('Users table migrated.');
        } catch (e) {
            if (!e.message.includes("Duplicate column")) console.log('Users table already has store_id or error:', e.message);
        }

        // 4. Add store_id to categories
        try {
            await connection.query(`ALTER TABLE categories ADD COLUMN store_id INT`);
            await connection.query(`ALTER TABLE categories ADD CONSTRAINT fk_categories_store FOREIGN KEY (store_id) REFERENCES stores(id)`);
            await connection.query(`UPDATE categories SET store_id = ? WHERE store_id IS NULL`, [defaultStoreId]);
            console.log('Categories table migrated.');
        } catch (e) {
            if (!e.message.includes("Duplicate column")) console.log('Categories table already has store_id or error:', e.message);
        }

        // 5. Add store_id to products
        try {
            await connection.query(`ALTER TABLE products ADD COLUMN store_id INT`);
            await connection.query(`ALTER TABLE products ADD CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES stores(id)`);
            await connection.query(`UPDATE products SET store_id = ? WHERE store_id IS NULL`, [defaultStoreId]);
            console.log('Products table migrated.');
        } catch (e) {
            if (!e.message.includes("Duplicate column")) console.log('Products table already has store_id or error:', e.message);
        }

        // 6. Add store_id to transactions (if exists)
        try {
            await connection.query(`ALTER TABLE transactions ADD COLUMN store_id INT`);
            await connection.query(`ALTER TABLE transactions ADD CONSTRAINT fk_transactions_store FOREIGN KEY (store_id) REFERENCES stores(id)`);
            await connection.query(`UPDATE transactions SET store_id = ? WHERE store_id IS NULL`, [defaultStoreId]);
            console.log('Transactions table migrated.');
        } catch (e) {
            if (!e.message.includes("Duplicate column")) console.log('Transactions table already has store_id or error:', e.message);
        }

        // 7. Update users role enum if needed (to include super_admin)
        try {
            await connection.query(`ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'staff') DEFAULT 'staff'`);
            console.log('User roles updated.');
        } catch (e) {
            console.log('User roles update error:', e.message);
        }

        // 8. Create a Super Admin if not exists
        const [superAdmin] = await connection.query("SELECT * FROM users WHERE role = 'super_admin'");
        if (superAdmin.length === 0) {
            await connection.query(`
                INSERT INTO users (name, role, pin, store_id) 
                VALUES ('Super Admin', 'super_admin', '000000', NULL)
            `);
            console.log('Super Admin created (PIN: 000000).');
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) connection.end();
    }
}

migrate();
