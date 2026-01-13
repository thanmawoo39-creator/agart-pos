export interface Product {
  id: string;
  name: string;
  price: number;
  cost?: number | null | undefined;
  stock: number;
  minStockLevel: number;
  unit: string;
  barcode?: string | null | undefined;
  imageUrl?: string | null;
  imageData?: string | undefined;
  category?: string | null;
  status?: string | undefined;
  businessUnitId?: string | null | undefined;
  createdAt?: string;
  updatedAt?: string;
}

// Cart item interface matching shared schema
export interface CartItem {
  id: string;
  productId: Product['id'];
  productName: Product['name'];
  quantity: number;
  unitPrice: Product['price'];
  total: number;
  name: Product['name'];
  price: Product['price'];
  product: Product;
  imageData?: string | undefined;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  barcode?: string | null;
  memberId?: string | null; // Customer member ID (e.g., "C-001")
  currentBalance?: number;
  creditLimit?: number;
  imageUrl?: string | null;
  status?: string;
  loyaltyPoints?: number;
  riskTag?: 'low' | 'high';
}

export interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  customerId?: string;
  createdAt: string;
  paymentSlipUrl?: string;
}
