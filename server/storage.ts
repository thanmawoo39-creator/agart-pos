import type {
  Product,
  Customer,
  Sale,
  CreditLedger,
  CurrentShift,
  SaleItem,
  InsertSale,
  InsertCreditLedger,
  Attendance,
  InsertAttendance,
  InventoryLog,
  InsertInventoryLog,
  Expense,
  InsertExpense,
  AppSettings,
  UpdateAppSettings,
  Alert,
  Shift,
  InsertShift,
  DashboardSummary,
  InsertProduct,
  InsertCustomer,
  Staff,
  InsertStaff,
} from "../shared/types";
import type { EnrichedCreditLedger } from "../shared/schema";
import { 
  products,
  customers,
  sales,
  saleItems,
  staff,
  attendance,
  inventoryLogs,
  expenses,
  creditLedger,
  appSettings,
  alerts,
  shifts,
} from "../shared/schema";
import { db } from "./lib/db";
import { eq, desc, and, gte, lte, sql, sum, count } from "drizzle-orm";
import { hashPin, verifyPin } from './lib/auth';

export interface IStorage {
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | null | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | null | undefined>;
  deleteCustomer(id: string): Promise<boolean>;

  // Sales
  getSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | null | undefined>;
  createSale(sale: InsertSale): Sale;

  // Credit Ledger
  getCreditLedger(): Promise<CreditLedger[]>;
  createCreditLedgerEntry(entry: InsertCreditLedger): Promise<CreditLedger>;

  // Staff
  getStaff(): Promise<Staff[]>;
  getStaffMember(id: string): Promise<Staff | null | undefined>;
  getStaffByPin(pin: string): Promise<Staff | null | undefined>;
  getStaffByBarcode(barcode: string): Promise<Staff | null | undefined>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff | null | undefined>;
  deleteStaff(id: string): Promise<boolean>;
  suspendStaff(id: string): Promise<Staff | null | undefined>;
  activateStaff(id: string): Promise<Staff | null | undefined>;

  // Attendance
  getAttendance(): Promise<Attendance[]>;
  getAttendanceByDate(date: string): Promise<Attendance[]>;
  getAttendanceByStaff(staffId: string): Promise<Attendance[]>;
  getCurrentShift(): Promise<CurrentShift>;
  clockIn(staffId: string, staffName: string, openingCash?: number): Promise<Attendance>;
  clockOut(attendanceId: string): Promise<Attendance | null | undefined>;
  updateAttendance(attendanceId: string, updates: Partial<InsertAttendance>): Promise<Attendance | null | undefined>;
  getAttendanceReport(startDate: string, endDate: string): Promise<Attendance[]>;

  // Shifts
  createShift(shift: InsertShift): Promise<Shift>;
  getShifts(): Promise<Shift[]>;
  updateShift(id: string, updates: Partial<InsertShift>): Promise<Shift | null | undefined>;
  closeShift(shiftId: string, closingCash: number): Promise<Shift | null | undefined>;

  // Inventory
  getInventoryLogs(): Promise<InventoryLog[]>;
  getInventoryLogsByProduct(productId: string): Promise<InventoryLog[]>;
  createInventoryLog(log: InsertInventoryLog): Promise<InventoryLog>;
  adjustStock(productId: string, quantityChange: number, type: 'stock-in' | 'sale' | 'adjustment', staffId?: string, staffName?: string, reason?: string): Promise<{ product: Product; log: InventoryLog } | undefined>;

  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | null | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, updates: Partial<InsertExpense>): Promise<Expense | null | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]>;
  getExpensesByCategory(category: string): Promise<Expense[]>;

  // Dashboard
  getDashboardSummary(): Promise<DashboardSummary>;

  // Analytics
  getAnalyticsSummary(): Promise<{
    todaySales: number;
    monthlySales: number;
    totalOrders: number;
    lowStockCount: number;
    totalReceivables: number;
    chartData: { date: string; sales: number }[];
    topProducts: { name: string; quantity: number; revenue: number }[];
  }>;

  // App Settings
  getAppSettings(): Promise<AppSettings>;
  updateAppSettings(updates: UpdateAppSettings): Promise<AppSettings>;

  // Alerts
  getAlerts(): Promise<Alert[]>;
  markAlertAsRead(id: string): Promise<Alert | null | undefined>;

  // Initialize
  initialize(): Promise<void>;
}

export class POSStorage implements IStorage {
  // Products
  async getProducts(): Promise<Product[]> {
    // Only return active products (soft delete filter)
    return await db.select().from(products).where(eq(products.status, 'active'));
  }

  async getProduct(id: string): Promise<Product | null | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    // Auto-generate barcode if not provided
    const productData = {
      ...product,
      barcode: product.barcode || `P-${Date.now()}`,
      category: product.category || null,
      imageData: product.imageData || null,
      imageUrl: product.imageUrl || null,
      cost: product.cost ?? null,
      status: 'active', // Always create as active
    };

    const [newProduct] = await db.insert(products).values(productData).returning();
    return newProduct;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | null | undefined> {
    const [updated] = await db.update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    // Soft delete: Set status to 'archived' instead of actual deletion
    const [updated] = await db.update(products)
      .set({ status: 'archived' })
      .where(eq(products.id, id))
      .returning();
    return !!updated;
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    // Only return active customers (soft delete filter)
    return await db.select().from(customers).where(eq(customers.status, 'active'));
  }

  async getCustomer(id: string): Promise<Customer | null | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    // Ensure status is set to active for new customers
    const customerData = {
      ...customer,
      status: customer.status || 'active',
    };
    const [newCustomer] = await db.insert(customers).values(customerData).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | null | undefined> {
    const [updated] = await db.update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    // Soft delete: Set status to 'archived' instead of actual deletion
    const [updated] = await db.update(customers)
      .set({ status: 'archived' })
      .where(eq(customers.id, id))
      .returning();
    return !!updated;
  }

  // Sales
  async getSales(): Promise<Sale[]> {
    const salesWithItems = await db.query.sales.findMany({
      with: {
        items: true,
      },
      orderBy: desc(sales.timestamp),
    });
    return salesWithItems.map(sale => ({
      ...sale,
      items: sale.items.map(item => ({ ...item, productId: item.productId, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total })),
      customerId: sale.customerId ?? undefined,
      storeId: sale.storeId ?? undefined,
      createdBy: sale.createdBy ?? undefined,
      paymentSlipUrl: sale.paymentSlipUrl ?? undefined,
    }));
  }

  async getSale(id: string): Promise<Sale | null | undefined> {
    const sale = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      with: {
        items: true,
      },
    });

    if (!sale) return null;

    return {
      ...sale,
      items: sale.items.map(item => ({ ...item, productId: item.productId, productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total })),
      customerId: sale.customerId ?? undefined,
      storeId: sale.storeId ?? undefined,
      createdBy: sale.createdBy ?? undefined,
      paymentSlipUrl: sale.paymentSlipUrl ?? undefined,
    };
  }

  createSale(insertSale: InsertSale): Sale {
    const saleResult = db.transaction((tx) => {
        // 1. Validate Stock & Calculate Totals
        let calculatedTotal = 0;
        const productCache = new Map<string, Product>();

        for (const item of insertSale.items) {
            const product = tx.select().from(products).where(eq(products.id, item.productId)).get();

            if (!product) {
                throw new Error(`Product not found: ID ${item.productId}`);
            }
            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for ${product.name}. Requested: ${item.quantity}, Available: ${product.stock}`);
            }
            productCache.set(item.productId, product);
            calculatedTotal += (item.unitPrice * item.quantity);
        }

        // 2. Create Sale Record (without items)
        const { items, ...saleData } = insertSale;
        const saleToInsert = {
            ...saleData,
            total: calculatedTotal,
            timestamp: new Date().toISOString(),
        };
        const newSale = tx.insert(sales).values(saleToInsert).returning().get();

        // 3. Create Sale Items & Update Stock
        for (const item of items) {
            tx.insert(saleItems).values({
                saleId: newSale.id,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total
            }).run();

            const product = productCache.get(item.productId);
            if (product) {
                tx.update(products)
                    .set({ stock: product.stock - item.quantity })
                    .where(eq(products.id, item.productId))
                    .run();

                tx.insert(inventoryLogs).values({
                    productId: item.productId,
                    productName: product.name,
                    quantityChanged: -item.quantity,
                    previousStock: product.stock,
                    currentStock: product.stock - item.quantity,
                    type: 'sale',
                    timestamp: new Date().toISOString()
                }).run();
            }
        }

        // 4. Handle Credit/Debt
        if (insertSale.paymentMethod === 'credit' && insertSale.customerId) {
            const customer = tx.select().from(customers).where(eq(customers.id, insertSale.customerId)).get();
            if (customer) {
                const newBalance = (customer.currentBalance || 0) + calculatedTotal;

                // Update customer balance
                tx.update(customers)
                    .set({ currentBalance: newBalance })
                    .where(eq(customers.id, customer.id))
                    .run();

                // Create credit ledger entry with all required fields
                tx.insert(creditLedger).values({
                    customerId: customer.id,
                    customerName: customer.name,
                    amount: calculatedTotal,
                    type: 'charge',
                    balanceAfter: newBalance,
                    description: `Sale - ${insertSale.items.length} item(s)`,
                    saleId: newSale.id,
                    voucherImageUrl: insertSale.paymentSlipUrl || null,
                    timestamp: new Date().toISOString(),
                    createdBy: insertSale.createdBy || null,
                }).run();
            }
        }

        return newSale;
    });

    return {
        ...saleResult,
        items: insertSale.items,
        customerId: saleResult.customerId ?? undefined,
        storeId: saleResult.storeId ?? undefined,
        createdBy: saleResult.createdBy ?? undefined,
        paymentSlipUrl: saleResult.paymentSlipUrl ?? undefined,
    };
  }

  // Credit Ledger
  async getCreditLedger(): Promise<CreditLedger[]> {
    const ledgerData = await db.select().from(creditLedger).orderBy(desc(creditLedger.timestamp));
    return ledgerData.map(entry => ({
      ...entry,
      saleId: entry.saleId || undefined,
      voucherImageUrl: entry.voucherImageUrl || undefined,
    }));
  }

  async createCreditLedgerEntry(entry: InsertCreditLedger): Promise<CreditLedger> {
    const [newEntry] = await db.insert(creditLedger).values(entry).returning();
    return {
      ...newEntry,
      saleId: newEntry.saleId || undefined,
      voucherImageUrl: newEntry.voucherImageUrl || undefined,
    };
  }

  // Staff
  async getStaff(): Promise<Staff[]> {
    return await db.select().from(staff);
  }

  async getStaffMember(id: string): Promise<Staff | null | undefined> {
    const [staffMember] = await db.select().from(staff).where(eq(staff.id, id));
    return staffMember;
  }

  async getStaffByPin(pin: string): Promise<Staff | null | undefined> {
    const allStaff = await db.select().from(staff);
    for (const staffMember of allStaff) {
      if (verifyPin(pin, staffMember.pin)) {
        return staffMember;
      }
    }
    return null;
  }

  async getStaffByBarcode(barcode: string): Promise<Staff | null | undefined> {
    const [staffMember] = await db.select().from(staff).where(eq(staff.barcode, barcode));
    return staffMember;
  }

  async createStaff(staffData: InsertStaff): Promise<Staff> {
    const hashedPassword = hashPin(staffData.pin);
    const result = await db.insert(staff).values({
      name: staffData.name,
      pin: hashedPassword,
      role: staffData.role,
      barcode: staffData.barcode || null,
      status: staffData.status || 'active',
    }).returning();
    return result[0] as Staff;
  }

  async updateStaff(id: string, updates: Partial<InsertStaff>): Promise<Staff | null | undefined> {
    const [updated] = await db.update(staff)
      .set(updates)
      .where(eq(staff.id, id))
      .returning();
    return updated;
  }

  async deleteStaff(id: string): Promise<boolean> {
    const result = await db.delete(staff).where(eq(staff.id, id));
    return result.changes > 0;
  }

  async suspendStaff(id: string): Promise<Staff | null | undefined> {
    return await this.updateStaff(id, { status: 'suspended' } as any);
  }

  async activateStaff(id: string): Promise<Staff | null | undefined> {
    return await this.updateStaff(id, { status: 'active' } as any);
  }

  // Attendance
  async getAttendance(): Promise<Attendance[]> {
    return await db.select().from(attendance).orderBy(desc(attendance.date));
  }

  async getAttendanceByDate(date: string): Promise<Attendance[]> {
    return await db.select().from(attendance).where(eq(attendance.date, date));
  }

  async getAttendanceByStaff(staffId: string): Promise<Attendance[]> {
    return await db.select().from(attendance).where(eq(attendance.staffId, staffId));
  }

  async getCurrentShift(): Promise<CurrentShift> {
    const [active] = await db.select().from(attendance).where(eq(attendance.clockOutTime, '')).limit(1);
    if (active) {
      return {
        isActive: true,
        staffId: active.staffId,
        staffName: active.staffName,
        clockInTime: active.clockInTime,
        attendanceId: active.id,
      };
    }
    return {
      isActive: false,
      staffId: null,
      staffName: null,
      clockInTime: null,
      attendanceId: null,
    };
  }

  async clockIn(staffId: string, staffName: string, openingCash: number = 0): Promise<Attendance> {
    const [newAttendance] = await db.insert(attendance).values({
      staffId,
      staffName,
      date: new Date().toISOString().split('T')[0],
      clockInTime: new Date().toISOString(),
      clockOutTime: '',
      totalHours: 0,
      openingCash,
      totalSales: 0,
      cashSales: 0,
      cardSales: 0,
      creditSales: 0,
      mobileSales: 0,
    }).returning();
    return newAttendance;
  }

  async clockOut(attendanceId: string): Promise<Attendance | null | undefined> {
    const attendanceRecord = await this.getAttendanceByStaff(attendanceId);
    if (!attendanceRecord || attendanceRecord.length === 0) return null;
    
    const clockOutTime = new Date().toISOString();
    const clockInTime = attendanceRecord[0].clockInTime;
    const totalHours = clockInTime ? 
      (new Date(clockOutTime).getTime() - new Date(clockInTime).getTime()) / (1000 * 60 * 60) : 0;

    const [updated] = await db.update(attendance)
      .set({ clockOutTime, totalHours })
      .where(eq(attendance.id, attendanceId))
      .returning();
    return updated;
  }

  async updateAttendance(attendanceId: string, updates: Partial<InsertAttendance>): Promise<Attendance | null | undefined> {
    const [updated] = await db.update(attendance)
      .set(updates)
      .where(eq(attendance.id, attendanceId))
      .returning();
    return updated;
  }

  async getAttendanceReport(startDate: string, endDate: string): Promise<Attendance[]> {
    return await db.select()
      .from(attendance)
      .where(and(gte(attendance.date, startDate), lte(attendance.date, endDate)))
      .orderBy(desc(attendance.date));
  }

  // Inventory Logs
  async getInventoryLogs(): Promise<InventoryLog[]> {
    const logsData = await db.select().from(inventoryLogs).orderBy(desc(inventoryLogs.timestamp));
    return logsData.map(log => ({
      ...log,
      staffId: log.staffId || undefined,
      staffName: log.staffName || undefined,
      reason: log.reason || undefined,
    }));
  }

  async getInventoryLogsByProduct(productId: string): Promise<InventoryLog[]> {
    const logsData = await db.select().from(inventoryLogs).where(eq(inventoryLogs.productId, productId));
    return logsData.map(log => ({
      ...log,
      staffId: log.staffId || undefined,
      staffName: log.staffName || undefined,
      reason: log.reason || undefined,
    }));
  }

  async createInventoryLog(log: InsertInventoryLog): Promise<InventoryLog> {
    const [newLog] = await db.insert(inventoryLogs).values(log).returning();
    return {
      ...newLog,
      staffId: newLog.staffId || undefined,
      staffName: newLog.staffName || undefined,
      reason: newLog.reason || undefined,
    };
  }

  async adjustStock(productId: string, quantityChange: number, type: 'stock-in' | 'sale' | 'adjustment', staffId?: string, staffName?: string, reason?: string): Promise<{ product: Product; log: InventoryLog } | undefined> {
    const product = await this.getProduct(productId);
    if (!product) return undefined;

    const previousStock = product.stock || 0;
    const currentStock = previousStock + quantityChange;

    // Update product stock
    await this.updateProduct(productId, { stock: currentStock });

    // Create inventory log
    const log = await this.createInventoryLog({
      productId,
      productName: product.name,
      type,
      quantityChanged: quantityChange,
      previousStock,
      currentStock,
      staffId,
      staffName,
      reason,
      timestamp: new Date().toISOString(),
    });

    return { product: { ...product, stock: currentStock }, log };
  }

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.timestamp));
  }

  async getExpense(id: string): Promise<Expense | null | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const expenseData = {
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      description: expense.description ?? null,
      receiptImageUrl: expense.receiptImageUrl ?? null,
      note: expense.note ?? null,
      timestamp: new Date().toISOString(),
    };
    const [newExpense] = await db.insert(expenses).values(expenseData as any).returning();
    return newExpense;
  }

  async updateExpense(id: string, updates: Partial<InsertExpense>): Promise<Expense | null | undefined> {
    const [updated] = await db.update(expenses)
      .set(updates as any)
      .where(eq(expenses.id, id))
      .returning();
    return updated;
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return result.changes > 0;
  }

  async getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
    return await db.select()
      .from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)))
      .orderBy(desc(expenses.date));
  }

  async getExpensesByCategory(category: string): Promise<Expense[]> {
    return await db.select().from(expenses).where(eq(expenses.category, category as any));
  }

  // Dashboard
  async getDashboardSummary(): Promise<DashboardSummary> {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today).toISOString();

    // Get today's sales and count
    const salesToday = await db.select({ total: sum(sales.total), count: count() })
      .from(sales)
      .where(gte(sales.timestamp, startOfDay));

    // Get total receivables
    const receivables = await db.select({ total: sum(customers.currentBalance) }).from(customers);

    // Get low stock items
    const lowStockItems = await db.select().from(products)
      .where(sql`${products.stock} <= ${products.minStockLevel}`)
      .limit(10);

    const totalSalesToday = Number(salesToday[0]?.total || 0);
    const totalOrdersToday = Number(salesToday[0]?.count || 0);
    const totalReceivables = Number(receivables[0]?.total || 0);
    const lowStockCount = lowStockItems.length;

    // AI insight placeholder
    const aiInsight = "Business is performing well. Consider restocking low inventory items.";

    return {
      todaySales: totalSalesToday,
      totalSalesToday,
      totalOrdersToday,
      totalReceivables,
      lowStockProducts: lowStockCount,
      lowStockCount,
      lowStockItems,
      aiInsight,
    };
  }

  // App Settings
  async getAppSettings(): Promise<AppSettings> {
    const [setting] = await db.select().from(appSettings).limit(1);
    if (setting) {
      return setting as AppSettings;
    }

    // Create default settings if none exist, including the required groqApiKey
    const [newSettings] = await db.insert(appSettings).values({
      groqApiKey: "",
    }).returning();
    return newSettings as AppSettings;
  }

  async updateAppSettings(updates: UpdateAppSettings): Promise<AppSettings> {
    // Ensure settings row exists first
    const existing = await this.getAppSettings();

    // Add updatedAt timestamp
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Update the settings using the correct appSettings table object
    const [updated] = await db.update(appSettings)
      .set(updateData)
      .where(eq(appSettings.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update settings");
    }

    return updated as AppSettings;
  }

  // Alerts
  async getAlerts(): Promise<Alert[]> {
    return await db.select().from(alerts).orderBy(desc(alerts.createdAt));
  }

  async markAlertAsRead(id: string): Promise<Alert | null | undefined> {
    const [updated] = await db.update(alerts)
      .set({ isRead: true })
      .where(eq(alerts.id, id))
      .returning();
    return updated;
  }

  // AI Context Data - Gather comprehensive business insights for AI assistant
  async getAIContextData(): Promise<{
    todaySales: number;
    todayTransactionCount: number;
    lowStockItems: Array<{ name: string; stock: number; minStockLevel: number }>;
    topProducts: Array<{ name: string; totalQuantity: number; revenue: number }>;
    totalCustomers: number;
    creditOwed: number;
    todayExpenses: number;
    totalRevenue: number;
  }> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Today's sales
    const todaySalesData = await db.select({ total: sum(sales.total), count: count() })
      .from(sales)
      .where(gte(sales.timestamp, startOfToday));

    // Low stock items (stock <= minStockLevel)
    const lowStock = await db.select({
      name: products.name,
      stock: products.stock,
      minStockLevel: products.minStockLevel,
    })
      .from(products)
      .where(
        and(
          eq(products.status, 'active'),
          sql`${products.stock} <= ${products.minStockLevel}`
        )
      )
      .limit(10);

    // Top selling products (from sale_items)
    const topProductsData = await db.select({
      name: saleItems.productName,
      totalQuantity: sum(saleItems.quantity),
      revenue: sum(saleItems.total),
    })
      .from(saleItems)
      .groupBy(saleItems.productName)
      .orderBy(desc(sum(saleItems.total)))
      .limit(5);

    // Total customers
    const customerCount = await db.select({ count: count() })
      .from(customers)
      .where(eq(customers.status, 'active'));

    // Total credit owed
    const creditData = await db.select({ total: sum(customers.currentBalance) })
      .from(customers)
      .where(eq(customers.status, 'active'));

    // Today's expenses
    const todayExpensesData = await db.select({ total: sum(expenses.amount) })
      .from(expenses)
      .where(gte(expenses.timestamp, startOfToday));

    // All-time revenue
    const revenueData = await db.select({ total: sum(sales.total) })
      .from(sales);

    return {
      todaySales: Number(todaySalesData[0]?.total || 0),
      todayTransactionCount: Number(todaySalesData[0]?.count || 0),
      lowStockItems: lowStock.map(item => ({
        name: item.name,
        stock: item.stock,
        minStockLevel: item.minStockLevel,
      })),
      topProducts: topProductsData.map(p => ({
        name: p.name,
        totalQuantity: Number(p.totalQuantity || 0),
        revenue: Number(p.revenue || 0),
      })),
      totalCustomers: Number(customerCount[0]?.count || 0),
      creditOwed: Number(creditData[0]?.total || 0),
      todayExpenses: Number(todayExpensesData[0]?.total || 0),
      totalRevenue: Number(revenueData[0]?.total || 0),
    };
  }

  // Analytics Summary
  async getAnalyticsSummary(): Promise<{
    todaySales: number;
    monthlySales: number;
    totalOrders: number;
    lowStockCount: number;
    totalReceivables: number;
    chartData: { date: string; sales: number }[];
    topProducts: { name: string; quantity: number; revenue: number }[];
  }> {
    const today = new Date().toISOString().split('T')[0];
    const startOfToday = new Date(today).toISOString();
    
    // Get current month start
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Today's sales
    const todaySalesData = await db.select({ total: sum(sales.total), count: count() })
      .from(sales)
      .where(gte(sales.timestamp, startOfToday));

    // Monthly sales
    const monthlySalesData = await db.select({ total: sum(sales.total) })
      .from(sales)
      .where(sql`strftime('%Y-%m', ${sales.timestamp}) = ${currentMonth}`);

    // Low stock count
    const lowStockData = await db.select({ count: count() })
      .from(products)
      .where(sql`${products.stock} < ${products.minStockLevel}`);

    // Chart data - last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const chartData = await db.select({
      date: sql`strftime('%Y-%m-%d', ${sales.timestamp})`,
      sales: sum(sales.total)
    })
      .from(sales)
      .where(gte(sales.timestamp, sevenDaysAgo.toISOString()))
      .groupBy(sql`strftime('%Y-%m-%d', ${sales.timestamp})`)
      .orderBy(sql`strftime('%Y-%m-%d', ${sales.timestamp})`);

    // Top products by quantity sold
    const topProductsData = await db.select({
      name: products.name,
      totalQuantity: sum(saleItems.quantity),
      revenue: sum(saleItems.total)
    })
      .from(saleItems)
      .leftJoin(sales, eq(saleItems.saleId, sales.id))
      .leftJoin(products, eq(saleItems.productId, products.id))
      .groupBy(products.name)
      .orderBy(desc(sum(saleItems.quantity)))
      .limit(5);

    // Total receivables (credit owed by customers)
    const receivablesData = await db.select({ total: sum(customers.currentBalance) })
      .from(customers)
      .where(eq(customers.status, 'active'));

    return {
      todaySales: Number(todaySalesData[0]?.total || 0),
      monthlySales: Number(monthlySalesData[0]?.total || 0),
      totalOrders: Number(todaySalesData[0]?.count || 0),
      lowStockCount: Number(lowStockData[0]?.count || 0),
      totalReceivables: Number(receivablesData[0]?.total || 0),
      chartData: chartData.map(item => ({
        date: String(item.date),
        sales: Number(item.sales || 0)
      })),
      topProducts: topProductsData.map(p => ({
        name: p.name || 'Unknown',
        quantity: Number(p.totalQuantity || 0),
        revenue: Number(p.revenue || 0)
      }))
    };
  }

  // Shifts
  async createShift(shift: InsertShift): Promise<Shift> {
    const [newShift] = await db.insert(shifts).values({
      ...shift,
      status: 'open',
      createdAt: new Date().toISOString(),
    }).returning();
    return newShift;
  }

  async getShifts(): Promise<Shift[]> {
    return await db.select().from(shifts).orderBy(desc(shifts.createdAt));
  }

  async updateShift(id: string, updates: Partial<InsertShift>): Promise<Shift | null | undefined> {
    const [updated] = await db.update(shifts)
      .set(updates)
      .where(eq(shifts.id, id))
      .returning();
    return updated;
  }

  async closeShift(shiftId: string, closingCash: number): Promise<Shift | null | undefined> {
    // First get shift to calculate sales data
    const shiftRecordArray = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
    const shiftRecord = shiftRecordArray[0];
    if (!shiftRecord) return null;

    // Calculate sales for this shift period - query separately for each payment method
    const startTime = shiftRecord.startTime;
    const endTime = new Date().toISOString();

    // Get total sales
    const totalSalesData = await db.select({ total: sum(sales.total) })
      .from(sales)
      .where(and(gte(sales.timestamp, startTime), lte(sales.timestamp, endTime)));

    // Get cash sales
    const cashSalesData = await db.select({ total: sum(sales.total) })
      .from(sales)
      .where(and(
        eq(sales.paymentMethod, 'cash'),
        gte(sales.timestamp, startTime),
        lte(sales.timestamp, endTime)
      ));

    // Get card sales
    const cardSalesData = await db.select({ total: sum(sales.total) })
      .from(sales)
      .where(and(
        eq(sales.paymentMethod, 'card'),
        gte(sales.timestamp, startTime),
        lte(sales.timestamp, endTime)
      ));

    // Get credit sales
    const creditSalesData = await db.select({ total: sum(sales.total) })
      .from(sales)
      .where(and(
        eq(sales.paymentMethod, 'credit'),
        gte(sales.timestamp, startTime),
        lte(sales.timestamp, endTime)
      ));

    const [updated] = await db.update(shifts)
      .set({
        status: 'closed',
        endTime,
        closingCash,
        totalSales: Number(totalSalesData[0]?.total || 0),
        cashSales: Number(cashSalesData[0]?.total || 0),
        cardSales: Number(cardSalesData[0]?.total || 0),
        creditSales: Number(creditSalesData[0]?.total || 0),
      })
      .where(eq(shifts.id, shiftId))
      .returning();

    return updated;
  }

  // Initialize with mock data
  async initialize(): Promise<void> {
    // Ensure settings exist
    await this.getAppSettings();
  }
}

export const storage = new POSStorage();