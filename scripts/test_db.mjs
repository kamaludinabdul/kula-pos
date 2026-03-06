import { Client } from 'pg';

async function verify() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Tiga1234%21%21%21@db.jsylclofqbqdutccsrxb.supabase.co:5432/postgres'
    });

    try {
        await client.connect();
        console.log("Connected to DB!");

        // Find a valid store and product
        const { rows } = await client.query('SELECT store_id, id FROM products LIMIT 1');
        if (rows.length === 0) {
            console.log("No products found.");
            return;
        }

        const { store_id, id } = rows[0];
        console.log(`Using store ${store_id} and product ${id}`);

        // Try to adjust_stock
        console.log("Testing adjust_stock...");
        try {
            const res = await client.query(`SELECT public.adjust_stock($1, $2, $3, $4, $5)`,
                [store_id, id, 1, 'in', 'Test DB Connect']);
            console.log("adjust_stock result:", res.rows);
        } catch (e) {
            console.error("adjust_stock ERROR:", e);
        }

        // Try add_stock_batch
        console.log("Testing add_stock_batch...");
        try {
            const res = await client.query(`SELECT public.add_stock_batch($1, $2, $3, $4, $5, $6)`,
                [store_id, id, 1, 1000, new Date().toISOString().split('T')[0], 'Test Batch DB Query']);
            console.log("add_stock_batch result:", res.rows);
        } catch (e) {
            console.error("add_stock_batch ERROR:", e);
        }

    } catch (e) {
        console.error("Connection error:", e);
    } finally {
        await client.end();
    }
}

verify();
