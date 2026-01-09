export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  imageUrl?: string | null;
  imageData?: string; // base64 encoded image
  category?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  barcode?: string;
  memberId?: string; // Customer member ID (e.g., "C-001")
  currentBalance?: number;
  creditLimit?: number;
  imageUrl?: string;
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
