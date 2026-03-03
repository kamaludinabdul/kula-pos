const SUPABASE_URL = "https://jsylclofqbqdutccsrxb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTcxMTYsImV4cCI6MjA4MzQ3MzExNn0.D36mKeJ-jBaJXKQ5f0uLCHY3H31t8nB2NMRQfWrjfF8";

async function run() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?type=eq.rental&select=id,date,payment_details,items,rental_session_id&order=date.desc&limit=10`, {
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
        }
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
