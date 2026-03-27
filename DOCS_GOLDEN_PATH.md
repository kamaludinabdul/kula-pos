# Golden Path: Fetching Large Datasets

## Overview
In Supabase/PostgREST, the default response limit is typically **1000 rows**. Even if you specify `.limit(10000)`, the server may still cap the response at 1000. 

For critical reports like **Penjualan (Transactions)** and **Laba Rugi (Profit & Loss)**, where accurate summaries of thousands of transactions are required, we MUST bypass this limit.

## The Pattern (Chunk Fetching)
Instead of a single `select()` call, use a `while` loop with `.range()`.

### Implementation Example
```javascript
let allRows = [];
let offset = 0;
const LIMIT = 1000;
let keepFetching = true;

while (keepFetching) {
    const { data, error } = await supabase
        .from('table')
        .select('*')
        .range(offset, offset + LIMIT - 1);
        
    if (error) throw error;
    
    if (data && data.length > 0) {
        allRows = allRows.concat(data);
        offset += LIMIT;
        // If we got fewer than 1000, it's the last page
        if (data.length < LIMIT) keepFetching = false;
    } else {
        keepFetching = false;
    }
}
```

## Critical Guardrails
1. **Summary Statistics**: Use **Database RPCs** (Functions) for counts/sums wherever possible. They are not limited by the 1000-row transfer limit and are significantly faster.
2. **Table Logs**: For the detailed table view, always use the chunk fetching pattern above if the data volume is expected to exceed 1000 rows (e.g. monthly reports).
3. **Filtering**: When using client-side chunking, ensure all filters (Status, Method, etc.) are included in the `select()` query to minimize data transfer, OR perform deep filtering in JS if the filter involves complex JSON logic (like `stockType` inside the `items` array).

## Regressions
Any change that replaces the `while` loop with a simple `limit()` or a direct `select()` WITHOUT manual pagination is a **REGRESSION** and will break reports for large stores.
