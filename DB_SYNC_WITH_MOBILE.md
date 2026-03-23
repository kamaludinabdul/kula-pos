# 🔐 Web-Mobile Database Sync - Documentation

**CRITICAL**: The web and mobile apps share a SINGLE Supabase database.

## Shared Database Configuration

```
Production:   cuoayarlytvayhgyjuqb.supabase.co
  ├─ Web (v0.25.3)
  └─ Mobile (v0.1)

Staging:      jsylclofqbqdutccsrxb.supabase.co
  ├─ Web (Staging)
  └─ Mobile Dev
```

## When Updating RPC Functions

**MANDATORY CHECKS** before deploying:

1. ✅ Check mobile version for same function
2. ✅ Compare parameter signatures
3. ✅ Ensure all parameters have defaults or both versions provide them
4. ✅ Test in BOTH apps before production

## Critical Shared Functions

| Function | Risk | Notes |
|----------|------|-------|
| `process_sale()` | 🔴 HIGH | Both apps depend - requires coordination |
| `log_audit_action()` | 🟢 LOW | New feature, safe |
| `get_expiry_report()` | 🟢 LOW | Read-only |
| `check_staff_conflict()` | 🟢 LOW | Read-only |

## Recent Compatibility Fixes

### ✅ process_sale() - FIXED
- **Issue**: Mobile had `p_stamp_updates` parameter, web didn't
- **Solution**: Added `p_stamp_updates JSONB DEFAULT '[]'::jsonb` with default
- **Also**: Added DEFAULTs to `p_amount_paid` and `p_change` (web was missing)

### ✅ get_my_store_id() - ADDED
- **Status**: New function, no compatibility issues
- **Used by**: RLS policies for audit_logs, pet_daily_logs, stock_write_offs

## Deployment Guidelines

1. **Test staging first** with both web & mobile apps
2. **Verify parameter compatibility** before production
3. **Monitor both apps** after migration
4. **Have rollback plan** (keep _legacy versions of functions)

## For Mobile Developers

See `/mobile-repo/DB_SYNC_SKILL.md` for:
- Full compatibility checklist
- Parameter comparison matrix
- Safe vs unsafe change patterns
- How to coordinate with web team

## For Web Developers

Key principle: **Any new RPC parameter must have a DEFAULT value** so mobile app doesn't break if it doesn't pass that parameter.

Example:
```sql
-- ✅ SAFE
p_new_field TEXT DEFAULT 'fallback_value'

-- ❌ NOT SAFE
p_new_field TEXT  -- Mobile will crash!
```

---

**Contact**: Check mobile repo's DB_SYNC_SKILL.md before modifying any function used by both apps.
