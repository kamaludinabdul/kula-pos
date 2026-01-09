# Login Tracking & Status - Troubleshooting Guide

## Fitur yang Ditambahkan

### 1. Login History Tracking
- **File**: `src/pages/LoginHistory.jsx`
- **Route**: `/login-history`
- **Collection**: `login_history`

### 2. User Status (Online/Offline)
- **File**: `src/pages/Staff.jsx`
- **Field**: `users.status`, `users.lastLogin`, `users.lastLogout`

## Cara Kerja

### Login Flow:
1. User login via `Login.jsx`
2. `AuthContext.login()` dipanggil
3. Sistem mencatat ke `login_history` collection:
   ```javascript
   {
     userId: "user123",
     userName: "John Doe",
     userRole: "staff",
     storeId: "store456",
     storeName: "Toko ABC",
     loginTime: "2025-11-30T11:27:00.000Z",
     userAgent: "Mozilla/5.0...",
     status: "success"
   }
   ```
4. Update `users` document:
   ```javascript
   {
     status: "online",
     lastLogin: "2025-11-30T11:27:00.000Z"
   }
   ```

### Logout Flow:
1. User klik logout
2. `AuthContext.logout()` dipanggil
3. Update `users` document:
   ```javascript
   {
     status: "offline",
     lastLogout: "2025-11-30T11:27:00.000Z"
   }
   ```
4. Catat logout ke `login_history`:
   ```javascript
   {
     userId: "user123",
     userName: "John Doe",
     loginTime: "2025-11-30T11:30:00.000Z",
     status: "logout"
   }
   ```

## Testing Checklist

### ✅ Test Login History:
1. Login beberapa kali (berhasil dan gagal)
2. Buka menu "Riwayat Login"
3. Pastikan data muncul
4. Test filter: Status, Periode
5. Test search: Nama user, Nama toko

### ✅ Test User Status:
1. Login sebagai staff
2. Buka menu "Staff" (sebagai admin)
3. Pastikan status "Sedang Login" (hijau)
4. Logout staff tersebut
5. Refresh halaman Staff
6. Pastikan status berubah jadi "Logout" (abu-abu)

## Troubleshooting

### Problem: Riwayat Login tidak muncul
**Solusi**:
- Cek console browser untuk error
- Pastikan collection `login_history` ada di Firestore
- Pastikan tidak ada error saat login
- Query sudah disederhanakan (tidak perlu composite index)

### Problem: Status tidak update
**Solusi**:
- Pastikan field `status` ada di user document
- Cek `AuthContext.jsx` - fungsi login/logout sudah update status
- Refresh halaman setelah login/logout
- Cek Firestore Rules - pastikan user bisa update field status

### Problem: "Missing or insufficient permissions"
**Solusi**:
- Update Firestore Rules:
```javascript
// Allow users to update their own status
match /users/{userId} {
  allow update: if request.auth != null && 
                request.resource.data.diff(resource.data).affectedKeys()
                .hasOnly(['status', 'lastLogin', 'lastLogout']);
}

// Allow authenticated users to read login_history
match /login_history/{historyId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
}
```

## Firestore Index (Jika Diperlukan)

Jika masih ada error "requires an index", buat index:

**Collection**: `login_history`
**Fields**:
- `loginTime` (Descending)

Atau klik link yang muncul di error console untuk auto-create index.

## Notes

- Login history menggunakan **client-side filtering** untuk menghindari composite index
- Limit 100 records terakhir untuk performa
- Status update dilakukan via `updateDoc` (tidak perlu re-login)
- Failed login juga dicatat untuk security audit
