# 🎨 shadcn/ui Migration Guide - Modern POS

## ✅ Apa yang Sudah Selesai

### 1. Setup & Konfigurasi
- ✅ Tailwind CSS installed
- ✅ shadcn/ui configured
- ✅ PostCSS setup
- ✅ Theme variables (light & dark mode ready)

### 2. Komponen UI yang Tersedia
Semua komponen ada di `src/components/ui/`:

- **button.jsx** - Button dengan berbagai variant
- **card.jsx** - Card container dengan header, content, footer
- **input.jsx** - Input field
- **label.jsx** - Label untuk form
- **table.jsx** - Table component
- **badge.jsx** - Badge untuk status
- **tabs.jsx** - Tabs navigation
- **select.jsx** - Dropdown select

### 3. Halaman yang Sudah Direfactor
- ✅ **Login.jsx** - Fully refactored dengan shadcn/ui

---

## 📚 Cara Menggunakan Komponen

### Button Component
```jsx
import { Button } from '../components/ui/button';

// Variants
<Button>Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// With icon
<Button className="gap-2">
  <Plus className="h-4 w-4" />
  Add Item
</Button>
```

### Card Component
```jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Total Penjualan</CardTitle>
    <CardDescription>Hari ini</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">Rp 1,250,000</p>
  </CardContent>
  <CardFooter>
    <p className="text-sm text-muted-foreground">+12% dari kemarin</p>
  </CardFooter>
</Card>
```

### Input & Label
```jsx
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

<div className="space-y-2">
  <Label htmlFor="productName">Nama Produk</Label>
  <Input 
    id="productName"
    type="text"
    placeholder="Masukkan nama produk"
  />
</div>

// With icon
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input className="pl-10" placeholder="Cari produk..." />
</div>
```

### Table Component
```jsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nama</TableHead>
      <TableHead>Harga</TableHead>
      <TableHead>Stok</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {products.map((product) => (
      <TableRow key={product.id}>
        <TableCell>{product.name}</TableCell>
        <TableCell>Rp {product.price.toLocaleString()}</TableCell>
        <TableCell>{product.stock}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Badge Component
```jsx
import { Badge } from '../components/ui/badge';

<Badge>Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Inactive</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
```

### Tabs Component
```jsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

<Tabs defaultValue="all">
  <TabsList>
    <TabsTrigger value="all">Semua</TabsTrigger>
    <TabsTrigger value="active">Aktif</TabsTrigger>
    <TabsTrigger value="inactive">Nonaktif</TabsTrigger>
  </TabsList>
  <TabsContent value="all">
    {/* Content for all */}
  </TabsContent>
  <TabsContent value="active">
    {/* Content for active */}
  </TabsContent>
</Tabs>
```

### Select Component
```jsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

<Select value={category} onValueChange={setCategory}>
  <SelectTrigger>
    <SelectValue placeholder="Pilih kategori" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="food">Makanan</SelectItem>
    <SelectItem value="drink">Minuman</SelectItem>
    <SelectItem value="snack">Snack</SelectItem>
  </SelectContent>
</Select>
```

---

## 🎨 Tailwind Utility Classes

### Layout
```jsx
// Flexbox
<div className="flex items-center justify-between gap-4">

// Grid
<div className="grid grid-cols-3 gap-4">

// Spacing
<div className="p-4">      // padding
<div className="m-4">      // margin
<div className="space-y-4"> // vertical spacing between children
<div className="gap-4">    // gap in flex/grid
```

### Typography
```jsx
<h1 className="text-3xl font-bold">Title</h1>
<p className="text-sm text-muted-foreground">Description</p>
<span className="text-destructive">Error message</span>
```

### Colors (menggunakan theme variables)
```jsx
// Background
className="bg-background"
className="bg-card"
className="bg-primary"
className="bg-destructive"

// Text
className="text-foreground"
className="text-muted-foreground"
className="text-primary"
className="text-destructive"

// Border
className="border border-border"
```

### Borders & Shadows
```jsx
className="rounded-lg"      // border radius
className="border"          // border
className="shadow-md"       // shadow
className="shadow-lg"       // larger shadow
```

---

## 📝 Template untuk Refactoring Halaman

### Template: Dashboard Stats Card
```jsx
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { TrendingUp } from 'lucide-react';

<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">
      Total Revenue
    </CardTitle>
    <TrendingUp className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">Rp 45,231,000</div>
    <p className="text-xs text-muted-foreground">
      +20.1% dari bulan lalu
    </p>
  </CardContent>
</Card>
```

### Template: Form Page
```jsx
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Add Product</CardTitle>
  </CardHeader>
  <CardContent>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Product Name</Label>
        <Input id="name" placeholder="Enter product name" />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="price">Price</Label>
        <Input id="price" type="number" placeholder="0" />
      </div>
      
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="button" variant="outline">Cancel</Button>
      </div>
    </form>
  </CardContent>
</Card>
```

### Template: Data Table Page
```jsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

<div className="space-y-4">
  <div className="flex justify-between items-center">
    <h1 className="text-2xl font-bold">Products</h1>
    <Button>Add Product</Button>
  </div>
  
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Price</TableHead>
        <TableHead>Stock</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>Rp {item.price.toLocaleString()}</TableCell>
          <TableCell>{item.stock}</TableCell>
          <TableCell>
            <Badge variant={item.active ? "success" : "secondary"}>
              {item.active ? "Active" : "Inactive"}
            </Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

---

## 🔧 Utility Function: cn()

Gunakan `cn()` untuk menggabungkan className dengan conditional:

```jsx
import { cn } from '../lib/utils';

<div className={cn(
  "base-class",
  isActive && "active-class",
  isDisabled && "disabled-class",
  customClassName
)}>
```

---

## 🎯 Halaman yang Perlu Direfactor (Prioritas)

### High Priority
1. ✅ **Login.jsx** - DONE
2. **Dashboard.jsx** - Gunakan Card template
3. **Products.jsx** - Gunakan Table template
4. **Settings.jsx** - Gunakan Form template

### Medium Priority
5. **Reports/** - Gunakan Tabs + Table
6. **Staff.jsx** - Gunakan Table
7. **Categories.jsx** - Gunakan Table + Form

### Low Priority (Keep as is)
- **POS.jsx** - Custom layout, biarkan CSS custom
- **Sidebar.jsx** - Sudah bagus, minor Tailwind updates saja

---

## 💡 Tips & Best Practices

1. **Gunakan Tailwind classes** untuk spacing, colors, typography
2. **Gunakan shadcn/ui components** untuk interactive elements
3. **Hapus CSS files** yang sudah tidak terpakai setelah refactor
4. **Konsisten dengan spacing**: gunakan `space-y-4` atau `gap-4`
5. **Gunakan theme colors**: `bg-primary`, `text-muted-foreground`, dll
6. **Responsive design**: tambahkan `md:`, `lg:` prefixes untuk breakpoints

---

## 🚀 Next Steps

1. Refactor Dashboard.jsx menggunakan Card template
2. Refactor Products.jsx menggunakan Table template
3. Refactor Settings.jsx menggunakan Form template
4. Test semua halaman untuk memastikan tidak ada breaking changes
5. Hapus CSS files yang sudah tidak terpakai

---

## 📞 Need Help?

Jika ada pertanyaan atau butuh bantuan refactoring halaman tertentu, tanyakan saja!
Saya bisa memberikan contoh spesifik untuk kasus Anda.
