import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error("Please provide POSTGRES_URL or DATABASE_URL in the .env file.");
    process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString });

async function run() {
    try {
        await client.connect();
        const sql = fs.readFileSync('redeem_stamp.sql', 'utf8');
        await client.query(sql);
        console.log("SQL executed successfully!");
    } catch(err) {
        console.error("SQL Error", err);
    } finally {
        await client.end();
    }
}
run();
