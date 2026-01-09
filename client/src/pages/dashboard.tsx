import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShiftButton } from "@/components/shift-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import { useCurrency } from "@/hooks/use-currency";
import { apiRequest } from "@/lib/queryClient";
import ReactMarkdown from "react-markdown";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Alert } from "@shared/schema";
import { 
  DollarSign, 
  CreditCard, 
  AlertTriangle, 
  Sparkles, 
  Bot, 
  Users, 
  Package,
  TrendingUp,
  TrendingDown,
  Banknote,
  Smartphone,
  Wallet,
  PiggyBank,
  MessageCircle,
  Send,
  Loader2,
  Maximize2,
  Minimize2,
  Bell,
  AlertCircle,
} from "lucide-react";
import type { DashboardSummary, ProfitLossReport } from "@shared/schema";

interface TopDebtor {
  customerId: string;
  customerName: string;
  outstandingBalance: number;
  creditLimit: number;
  riskLevel: "low" | "high";
  utilizationPercent: number;
}

interface StockWarning {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  daysUntilStockout: number;
  severity: "critical" | "warning" | "low";
}

interface DailySummary {
  date: string;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  creditSales: number;
  transactionCount: number;
  cashTransactions: number;
  creditTransactions: number;
}

interface AIInsights {
  topDebtors: TopDebtor[];
  stockWarnings: StockWarning[];
  dailySummary: DailySummary;
  riskySummary: string;
}

interface GeminiMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Dashboard() {
  const { isOwner, isManager } = useAuth();
  const { t, i18n } = useTranslation();
  const [geminiOpen, setGeminiOpen] = useState(false);
  const [geminiQuestion, setGeminiQuestion] = useState("");
  const [geminiMessages, setGeminiMessages] = useState<GeminiMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when streaming content changes
  useEffect(() => {
    if (streamingContent && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [streamingContent]);

  // Auto-scroll when new message is added
  useEffect(() => {
    if (geminiMessages.length > 0 && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 150);
    }
  }, [geminiMessages.length]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const pnlStartDate = startOfMonth.toISOString().split("T")[0];
  const pnlEndDate = now.toISOString().split("T")[0];

  const { data: analytics, isLoading: analyticsLoading } = useQuery<{
    todaySales: number;
    monthlySales: number;
    totalOrders: number;
    lowStockCount: number;
    totalReceivables: number;
    chartData: { date: string; sales: number }[];
    topProducts: { name: string; quantity: number; revenue: number }[];
  }>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: aiInsights, isLoading: insightsLoading } = useQuery<AIInsights>({
    queryKey: ["/api/ai/insights"],
  });

  const pnlUrl = `/api/reports/pnl?startDate=${pnlStartDate}&endDate=${pnlEndDate}`;
  const { data: pnlReport, isLoading: pnlLoading } = useQuery<ProfitLossReport>({
    queryKey: [pnlUrl],
  });

  // Get today's sales for profit calculation
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySales, isLoading: todaySalesLoading } = useQuery<any[]>({
    queryKey: [`/api/sales?date=${today}`],
  });

  // Get last 7 days of sales for prediction
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const historyStartDate = sevenDaysAgo.toISOString().split('T')[0];
  const { data: historicalSales, isLoading: historicalSalesLoading } = useQuery<any[]>({
    queryKey: [`/api/sales?startDate=${historyStartDate}&endDate=${today}`],
  });

  // Get alerts for admin notifications
  const { data: alertsData, isLoading: alertsLoading } = useQuery<{ alerts: Alert[], unreadCount: number }>({
    queryKey: ['/api/alerts'],
    enabled: isOwner || isManager, // Only fetch for admins
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const [geminiPendingMessage, setGeminiPendingMessage] = useState("");

  const geminiMutation = useMutation({
    mutationFn: async (question: string) => {
      setStreamingContent("");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const response = await fetch("/api/gemini/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
            language: i18n.language // Pass current language to backend
          }),
          signal: controller.signal,
        });
        
        if (!response.ok) {
          throw new Error("Failed to get AI response");
        }

        const contentType = response.headers.get("content-type") || "";

        // Streaming response (Server-Sent Events)
        if (contentType.includes("text/event-stream") && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data || data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setStreamingContent(fullContent);

                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                  }, 50);
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }

          return { response: fullContent };
        }

        // Regular JSON response
        const data = await response.json().catch(() => ({}));
        const responseText =
          typeof (data as any) === "string"
            ? (data as any)
            : ((data as any).answer ?? (data as any).response ?? "");

        return { response: String(responseText ?? "") };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    onMutate: () => {
      setGeminiPendingMessage("Generating a detailed financial summary—it may take up to 60 seconds.");
      setStreamingContent("");
    },
    onSuccess: (data) => {
      setGeminiPendingMessage("");
      setStreamingContent("");
      
      // Handle different response formats
      let content = data.response;
      
      // If response is a stringified JSON array/object, parse and format it
      if (typeof content === 'string') {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            // If it's an array of suggestions, format as bullet points
            content = parsed.map((item, index) => {
              if (typeof item === 'object' && item.suggestion) {
                return `• ${item.suggestion}`;
              } else if (typeof item === 'object' && item.text) {
                return `• ${item.text}`;
              } else if (typeof item === 'string') {
                return `• ${item}`;
              } else {
                return `• ${JSON.stringify(item)}`;
              }
            }).join('\n\n');
          } else if (typeof parsed === 'object' && parsed.suggestions) {
            // If it's an object with suggestions array
            content = parsed.suggestions.map((suggestion: any) => `• ${suggestion}`).join('\n\n');
          } else if (typeof parsed === 'object' && parsed.response) {
            // If it's an object with response field
            content = parsed.response;
          }
        } catch (e) {
          // Not JSON, use as-is
        }
      }
      
      setGeminiMessages((prev) => [...prev, { role: "assistant", content }]);
      // Scroll to bottom after message is added
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 150);
    },
    onError: () => {
      setGeminiPendingMessage("");
      setStreamingContent("");
      setGeminiMessages((prev) => [...prev, { role: "assistant", content: "တုံ့ပြန်မှုမရရှိပါ။ ထပ်စမ်းကြည့်ပါ။" }]);
    },
  });

  // Calculate today's net profit
  const calculateTodayProfit = () => {
    if (!todaySales || todaySales.length === 0) return 0;
    
    let totalRevenue = 0;
    let totalCost = 0;
    
    todaySales.forEach(sale => {
      totalRevenue += sale.total || 0;
      // Calculate cost from purchase price if available
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const purchasePrice = item.purchasePrice || 0;
          const quantity = item.quantity || 1;
          totalCost += purchasePrice * quantity;
        });
      }
    });
    
    return totalRevenue - totalCost;
  };

  // Prepare sales data for AI prediction
  const prepareSalesDataForPrediction = () => {
    if (!historicalSales || historicalSales.length === 0) return null;
    
    // Group sales by product and calculate daily quantities
    const productSales: { [key: string]: { name: string; dailyQuantities: number[]; totalQuantity: number } } = {};
    
    historicalSales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const productId = item.productId || item.id;
          const productName = item.productName || item.name;
          const quantity = item.quantity || 1;
          
          if (!productSales[productId]) {
            productSales[productId] = {
              name: productName,
              dailyQuantities: [],
              totalQuantity: 0
            };
          }
          
          productSales[productId].dailyQuantities.push(quantity);
          productSales[productId].totalQuantity += quantity;
        });
      }
    });
    
    // Get top products by total quantity
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5); // Top 5 products
    
    return topProducts;
  };

  const handleAskGemini = () => {
    if (!geminiQuestion.trim() || geminiMutation.isPending) return;
    
    // Calculate today's profit
    const todayProfit = calculateTodayProfit();
    
    // Prepare sales data for prediction
    const salesData = prepareSalesDataForPrediction();
    
    // Enhanced prompt with business context
    let enhancedQuestion = geminiQuestion;
    
    // Add profit information
    if (todayProfit !== 0) {
      enhancedQuestion += `\n\nToday's Net Profit: $${todayProfit.toFixed(2)}`;
    }
    
    // Add inventory prediction data
    if (salesData && salesData.length > 0) {
      enhancedQuestion += `\n\nRecent Sales Data (Last 7 Days):\n`;
      salesData.forEach(product => {
        const avgDaily = (product.totalQuantity / 7).toFixed(1);
        enhancedQuestion += `- ${product.name}: Sold ${product.totalQuantity} total units (avg ${avgDaily} per day)\n`;
      });
      enhancedQuestion += `\nBased on this data, provide inventory advice for tomorrow. Format as: "You should stock X units of [Product Name] for tomorrow based on recent trends."`;
    } else {
      enhancedQuestion += `\n\nNote: Collecting more sales data for accurate inventory predictions.`;
    }

    // Add shift discrepancy data for risk analysis
    if (alertsData?.alerts && alertsData.alerts.length > 0) {
      const shiftDiscrepancies = alertsData.alerts.filter(alert => alert.type === 'shift_discrepancy');
      if (shiftDiscrepancies.length > 0) {
        enhancedQuestion += `\n\nRecent Shift Discrepancies:\n`;
        shiftDiscrepancies.slice(0, 5).forEach(alert => {
          enhancedQuestion += `- ${alert.staffName}: ${alert.message}\n`;
        });
        enhancedQuestion += `\nConsider these discrepancies in your risk analysis and cash handling recommendations.`;
      }
    }
    
    setGeminiMessages((prev) => [...prev, { role: "user", content: geminiQuestion }]);
    geminiMutation.mutate(enhancedQuestion);
    setGeminiQuestion("");
  };

  // Use dynamic currency formatting from settings
  const { formatCurrency } = useCurrency();

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative min-h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-page-title">
            {t('navigation.dashboard')}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground" data-testid="text-page-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Admin Notifications */}
          {(isOwner || isManager) && (
            <div className="relative">
              <Button variant="outline" size="sm" className="relative">
                <Bell className="w-4 h-4" />
                {alertsData && alertsData.unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0"
                  >
                    {alertsData.unreadCount > 99 ? '99+' : alertsData.unreadCount}
                  </Badge>
                )}
              </Button>
            </div>
          )}
          <ShiftButton />
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card data-testid="card-total-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Sales Today
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-500/10">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {analyticsLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <div className="text-xl md:text-3xl font-bold tabular-nums text-foreground" data-testid="text-total-sales">
                {formatCurrency(analytics?.todaySales ?? 0)}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Revenue for today</p>
          </CardContent>
        </Card>

        <Card data-testid="card-monthly-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Sales This Month
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-500/10">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {analyticsLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <>
                <div className="text-xl md:text-3xl font-bold tabular-nums text-foreground" data-testid="text-monthly-sales">
                  {formatCurrency(analytics?.monthlySales ?? 0)}
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Revenue this month</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-orders">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Orders Today
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-500/10">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {analyticsLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <div className="text-xl md:text-3xl font-bold tabular-nums text-foreground" data-testid="text-total-orders">
                {analytics?.totalOrders ?? 0}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Orders placed today</p>
          </CardContent>
        </Card>

        <Card data-testid="card-low-stock">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Low Stock Alert
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {analyticsLoading ? (
              <Skeleton className="h-7 md:h-9 w-16" />
            ) : (
              <div className="text-xl md:text-3xl font-bold tabular-nums text-foreground" data-testid="text-low-stock-count">
                {analytics?.lowStockCount ?? 0}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Items need restock</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart and Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mt-3">
        <Card data-testid="card-expenses">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Monthly Expenses
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-red-500/10">
              <Wallet className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {pnlLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <div className="text-xl md:text-3xl font-bold tabular-nums text-red-600 dark:text-red-400" data-testid="text-monthly-expenses">
                {formatCurrency(pnlReport?.totalExpenses ?? 0)}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Operating costs</p>
          </CardContent>
        </Card>

        <Card data-testid="card-gross-profit">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Gross Profit
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-500/10">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {pnlLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <div className={`text-xl md:text-3xl font-bold tabular-nums ${(pnlReport?.grossProfit ?? 0) >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600"}`} data-testid="text-gross-profit">
                {formatCurrency(pnlReport?.grossProfit ?? 0)}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">Revenue - COGS</p>
          </CardContent>
        </Card>

        <Card data-testid="card-net-profit" className={pnlReport?.netProfit && pnlReport.netProfit > 0 ? "bg-gradient-to-br from-emerald-500/5 to-transparent" : ""}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Net Profit
            </CardTitle>
            <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg ${(pnlReport?.netProfit ?? 0) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <PiggyBank className={`w-4 h-4 md:w-5 md:h-5 ${(pnlReport?.netProfit ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`} />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {pnlLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <div className={`text-xl md:text-3xl font-bold tabular-nums ${(pnlReport?.netProfit ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`} data-testid="text-net-profit">
                {formatCurrency(pnlReport?.netProfit ?? 0)}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {pnlReport?.netProfitMargin !== undefined && (
                <>
                  {pnlReport.netProfitMargin >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span>{pnlReport.netProfitMargin.toFixed(1)}% margin</span>
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 md:p-4 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Monthly Revenue
            </CardTitle>
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-purple-500/10">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0">
            {pnlLoading ? (
              <Skeleton className="h-7 md:h-9 w-24 md:w-32" />
            ) : (
              <div className="text-xl md:text-3xl font-bold tabular-nums text-purple-600 dark:text-purple-400" data-testid="text-monthly-revenue">
                {formatCurrency(pnlReport?.revenue ?? 0)}
              </div>
            )}
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1">This month total</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            7-Day Sales Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  formatter={(value, name) => [name, formatCurrency(Number(value))].join(': ')}
                />
                <Bar 
                  dataKey="sales" 
                  fill="#8884d8" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500" />
            Top Selling Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {analytics?.topProducts?.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">Quantity: {product.quantity}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Assistant Panel */}
      <Card data-testid="card-ai-assistant" className="bg-gradient-to-r from-indigo-500/5 via-transparent to-emerald-500/5">
        <CardHeader className="p-3 md:p-4 pb-2">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-500" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top 3 Debtors */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="w-4 h-4" />
                Top 3 Debtors
              </div>
              {insightsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : aiInsights?.topDebtors && aiInsights.topDebtors.length > 0 ? (
                <div className="space-y-2">
                  {aiInsights.topDebtors.map((debtor, index) => (
                    <div
                      key={debtor.customerId}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                      data-testid={`debtor-${debtor.customerId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                          <span className="text-sm font-medium truncate">{debtor.customerName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(debtor.outstandingBalance)}
                        </div>
                      </div>
                      <Badge
                        variant={debtor.riskLevel === "high" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {debtor.riskLevel === "high" ? "High Risk" : "Low Risk"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No outstanding debts
                </p>
              )}
            </div>

            {/* Stock Warnings */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="w-4 h-4" />
                Stock Warnings
              </div>
              {insightsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : aiInsights?.stockWarnings && aiInsights.stockWarnings.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {aiInsights.stockWarnings.slice(0, 5).map((warning) => (
                    <div
                      key={warning.productId}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50"
                      data-testid={`stock-warning-${warning.productId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{warning.productName}</span>
                        <span className="text-xs text-muted-foreground">
                          {warning.currentStock} left ({warning.daysUntilStockout === 999 ? "No sales" : `~${warning.daysUntilStockout} days`})
                        </span>
                      </div>
                      <Badge
                        variant={warning.severity === "critical" ? "destructive" : warning.severity === "warning" ? "secondary" : "outline"}
                        className={`text-[10px] ${warning.severity === "warning" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30" : ""}`}
                      >
                        {warning.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  All products well-stocked
                </p>
              )}
            </div>

            {/* Daily Summary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                Daily Summary
              </div>
              {insightsLoading ? (
                <Skeleton className="h-36" />
              ) : aiInsights?.dailySummary ? (
                <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-muted-foreground">Cash</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(aiInsights.dailySummary.cashSales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs text-muted-foreground">Card/Mobile</span>
                    </div>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(aiInsights.dailySummary.cardSales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-500" />
                      <span className="text-xs text-muted-foreground">Credit</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(aiInsights.dailySummary.creditSales)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">Total Transactions</span>
                      <span className="text-sm font-bold">{aiInsights.dailySummary.transactionCount}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No sales today
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floating AI Assistant */}
      <div 
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50"
        data-testid="ai-assistant-floating"
      >
        {isOwner ? (
          <Dialog open={geminiOpen} onOpenChange={setGeminiOpen}>
            <DialogTrigger asChild>
              <button
                className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-2xl shadow-lg p-3 md:p-4 max-w-[200px] md:max-w-[260px] cursor-pointer hover:shadow-xl transition-shadow"
                data-testid="button-open-gemini-chat"
              >
                <div className="flex items-start gap-2 md:gap-3">
                  <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[10px] md:text-xs font-medium opacity-80 mb-0.5 md:mb-1">Gemini CFO</p>
                    <p className="text-xs md:text-sm leading-snug">
                      {insightsLoading ? "Analyzing..." : "စီးပွားရေး အကြံဉာဏ် မေးပါ"}
                    </p>
                  </div>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent 
              className={`${isFullscreen ? 'w-[95vw] h-[95vh] max-w-none' : geminiMutation.isPending || streamingContent ? 'w-[80vw] max-w-5xl' : 'max-w-lg'} max-h-[80vh] flex flex-col transition-all duration-300`}
            >
              <DialogHeader className="flex flex-row items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  {t('virtualCFO.title')}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="h-8 w-8"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </DialogHeader>
              
              {/* Today's Profit Display */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Today's Net Profit</h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(calculateTodayProfit())}
                    </p>
                  </div>
                  <div className="text-blue-500">
                    <TrendingUp className="w-8 h-8" />
                  </div>
                </div>
              </div>
              
              <ScrollArea 
                className={`flex-1 ${isFullscreen ? 'min-h-[calc(95vh-180px)]' : 'min-h-[300px]'} ${isFullscreen ? 'max-h-[calc(95vh-180px)]' : 'max-h-[500px]'} pr-4`}
              >
                <div className="space-y-4" ref={scrollAreaRef}>
                  {geminiMessages.length === 0 && !streamingContent && (
                    <div className="text-center text-muted-foreground py-8">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 text-indigo-500/50" />
                      <p className="text-sm">သင့်စီးပွားရေးအကြောင်း မေးခွန်းများ မေးနိုင်ပါသည်။</p>
                      <p className="text-xs mt-2">ဥပမာ: "ဘယ်ကုန်ကျစရိတ်ကို လျှော့ချသင့်လဲ?"</p>
                    </div>
                  )}
                  {geminiMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      data-testid={`gemini-message-${idx}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-indigo-500 text-white"
                            : "bg-muted"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-p:my-3 prose-ul:my-3 prose-li:my-2 prose-strong:font-semibold">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className={`${isFullscreen ? 'text-base' : 'text-sm'} leading-relaxed my-3`} style={{ lineHeight: '1.8' }}>{children}</p>,
                                ul: ({ children }) => <ul className={`list-disc list-inside my-3 space-y-2 ${isFullscreen ? 'text-base' : 'text-sm'}`} style={{ lineHeight: '1.8' }}>{children}</ul>,
                                ol: ({ children }) => <ol className={`list-decimal list-inside my-3 space-y-2 ${isFullscreen ? 'text-base' : 'text-sm'}`} style={{ lineHeight: '1.8' }}>{children}</ol>,
                                li: ({ children }) => <li className="ml-2" style={{ lineHeight: '1.8' }}>{children}</li>,
                                h1: ({ children }) => <h1 className={`${isFullscreen ? 'text-2xl' : 'text-xl'} font-bold mt-6 mb-3`} style={{ lineHeight: '1.6' }}>{children}</h1>,
                                h2: ({ children }) => <h2 className={`${isFullscreen ? 'text-xl' : 'text-lg'} font-bold mt-5 mb-3`} style={{ lineHeight: '1.6' }}>{children}</h2>,
                                h3: ({ children }) => <h3 className={`${isFullscreen ? 'text-lg' : 'text-base'} font-bold mt-4 mb-2`} style={{ lineHeight: '1.6' }}>{children}</h3>,
                                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {streamingContent && (
                    <div className="flex justify-start">
                      <div className={`bg-muted rounded-lg px-4 py-3 ${isFullscreen ? 'text-base' : 'text-sm'} max-w-[85%]`}>
                        <div className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-p:my-3 prose-ul:my-3 prose-li:my-2 prose-strong:font-semibold">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className={`${isFullscreen ? 'text-base' : 'text-sm'} leading-relaxed my-3`} style={{ lineHeight: '1.8' }}>{String(children)}</p>,
                              ul: ({ children }) => <ul className={`list-disc list-inside my-3 space-y-2 ${isFullscreen ? 'text-base' : 'text-sm'}`} style={{ lineHeight: '1.8' }}>{String(children)}</ul>,
                              ol: ({ children }) => <ol className={`list-decimal list-inside my-3 space-y-2 ${isFullscreen ? 'text-base' : 'text-sm'}`} style={{ lineHeight: '1.8' }}>{String(children)}</ol>,
                              li: ({ children }) => <li className="ml-2" style={{ lineHeight: '1.8' }}>{String(children)}</li>,
                              h1: ({ children }) => <h1 className={`${isFullscreen ? 'text-2xl' : 'text-xl'} font-bold mt-6 mb-3`} style={{ lineHeight: '1.6' }}>{String(children)}</h1>,
                              h2: ({ children }) => <h2 className={`${isFullscreen ? 'text-xl' : 'text-lg'} font-bold mt-5 mb-3`} style={{ lineHeight: '1.6' }}>{String(children)}</h2>,
                              h3: ({ children }) => <h3 className={`${isFullscreen ? 'text-lg' : 'text-base'} font-bold mt-4 mb-2`} style={{ lineHeight: '1.6' }}>{String(children)}</h3>,
                              strong: ({ children }) => <strong className="font-semibold">{String(children)}</strong>,
                              em: ({ children }) => <em className="italic">{String(children)}</em>,
                            }}
                          >
                            {typeof streamingContent === 'string' ? streamingContent : String(streamingContent || '')}
                          </ReactMarkdown>
                        </div>
                        <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-1" />
                      </div>
                    </div>
                  )}
                  {/* Invisible element to scroll to */}
                  <div ref={messagesEndRef} />
                  {geminiMutation.isPending && !streamingContent && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          စဉ်းစားနေပါသည်...
                        </div>
                      </div>
                      {geminiPendingMessage && (
                        <p className="text-xs text-muted-foreground">{geminiPendingMessage}</p>
                      )}
                    </div>
                  )}
                </div>
                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </ScrollArea>
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Input
                  placeholder={t('virtualCFO.placeholder')}
                  value={geminiQuestion}
                  onChange={(e) => setGeminiQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAskGemini();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleAskGemini}
                  disabled={!geminiQuestion.trim() || geminiMutation.isPending}
                  data-testid="button-send-gemini"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-2xl shadow-lg p-3 md:p-4 max-w-[200px] md:max-w-[260px]">
            <div className="flex items-start gap-2 md:gap-3">
              <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] md:text-xs font-medium opacity-80 mb-0.5 md:mb-1">AI Assistant</p>
                <p className="text-xs md:text-sm leading-snug">
                  {insightsLoading ? "Analyzing..." : aiInsights?.riskySummary ?? "All systems healthy."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
