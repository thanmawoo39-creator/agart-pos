import { motion } from "framer-motion";
import { useState, useEffect, useRef, type ReactNode } from "react";
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
import { useBusinessMode } from "@/contexts/BusinessModeContext";
import ReactMarkdown from "react-markdown";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Alert } from "@shared/schema";
import { SmsLogViewer } from "@/components/admin/sms-log-viewer";
import { useLocation } from "wouter";
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
  Send,
  Loader2,
  Maximize2,
  Minimize2,
  Bell,
  type LucideIcon,
} from "lucide-react";
import type { ProfitLossReport, Sale, SaleItem } from "@shared/schema";

// Compact Metric Card Component for Mobile-Optimized Dashboard
interface CompactMetricProps {
  title: string;
  value: ReactNode;
  subtitle: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  valueClassName?: string;
  isLoading?: boolean;
  testId?: string;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  cardClassName?: string;
}

function CompactMetric({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBgColor,
  valueClassName = "text-foreground",
  isLoading = false,
  testId,
  onClick,
  onKeyDown,
  cardClassName = "",
}: CompactMetricProps) {
  return (
    <Card
      data-testid={testId}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`h-[88px] md:h-auto overflow-hidden ${onClick ? "cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70" : ""} ${cardClassName}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-1 p-2 md:p-4 pb-0.5 md:pb-2">
        <CardTitle className="text-[9px] md:text-sm font-medium text-muted-foreground truncate">
          {title}
        </CardTitle>
        <div className={`flex items-center justify-center w-5 h-5 md:w-10 md:h-10 rounded-md ${iconBgColor} flex-shrink-0`}>
          <Icon className={`w-3 h-3 md:w-5 md:h-5 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent className="p-2 md:p-4 pt-0">
        {isLoading ? (
          <Skeleton className="h-5 md:h-9 w-16 md:w-32" />
        ) : (
          <div className={`text-sm md:text-3xl font-bold tabular-nums truncate ${valueClassName}`}>
            {value}
          </div>
        )}
        <p className="text-[8px] md:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

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

type SaleItemWithPurchasePrice = SaleItem & {
  purchasePrice?: number | null;
};

type SaleWithPurchasePrice = Omit<Sale, "items"> & {
  items: SaleItemWithPurchasePrice[];
};

export default function Dashboard() {
  const { isOwner, isManager, isCashier, isWaiter, isKitchen } = useAuth();
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [geminiOpen, setGeminiOpen] = useState(false);
  const [geminiQuestion, setGeminiQuestion] = useState("");
  const [geminiMessages, setGeminiMessages] = useState<GeminiMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Redirect waiter and kitchen roles to appropriate pages
  useEffect(() => {
    if (isWaiter) {
      setLocation('/sales');
    } else if (isKitchen) {
      setLocation('/kitchen');
    }
  }, [isWaiter, isKitchen, setLocation]);

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

  const { businessUnit } = useBusinessMode();

  const canViewDashboardMetrics = isOwner || isManager || isCashier;
  const canViewSensitiveFinancials = isOwner || isManager; // Excludes cashiers from seeing profit/expenses

  const { data: analytics, isLoading: analyticsLoading } = useQuery<{
    todaySales: number;
    monthlySales: number;
    totalOrders: number;
    lowStockCount: number;
    totalReceivables: number;
    chartData: { date: string; sales: number }[];
    topProducts: { name: string; quantity: number; revenue: number }[];
  }>({
    queryKey: [`/api/analytics/summary?businessUnitId=${businessUnit}`],
    enabled: !!businessUnit && canViewDashboardMetrics,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: aiInsights, isLoading: insightsLoading } = useQuery<AIInsights>({
    queryKey: ["/api/ai/insights"],
    enabled: canViewDashboardMetrics,
  });

  const pnlUrl = `/api/reports/pnl?startDate=${pnlStartDate}&endDate=${pnlEndDate}`;
  const { data: pnlReport, isLoading: pnlLoading } = useQuery<ProfitLossReport>({
    queryKey: [pnlUrl],
    enabled: canViewDashboardMetrics,
  });

  // Get today's sales for profit calculation
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySales } = useQuery<SaleWithPurchasePrice[]>({
    queryKey: [`/api/sales?date=${today}&businessUnitId=${businessUnit}`],
    enabled: !!businessUnit && canViewDashboardMetrics,
  });

  // Get last 7 days of sales for prediction
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const historyStartDate = sevenDaysAgo.toISOString().split('T')[0];
  const { data: historicalSales } = useQuery<SaleWithPurchasePrice[]>({
    queryKey: [`/api/sales?startDate=${historyStartDate}&endDate=${today}&businessUnitId=${businessUnit}`],
    enabled: !!businessUnit && canViewDashboardMetrics,
  });

  // Get alerts for admin notifications
  const { data: alertsData } = useQuery<{ alerts: Alert[], unreadCount: number }>({
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
        const data: unknown = await response.json().catch(() => ({}));
        let responseText = "";
        if (typeof data === "string") {
          responseText = data;
        } else if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          const answer = obj["answer"];
          const resp = obj["response"];
          if (typeof answer === "string") {
            responseText = answer;
          } else if (typeof resp === "string") {
            responseText = resp;
          }
        }

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
          const parsed: unknown = JSON.parse(content);
          if (Array.isArray(parsed)) {
            // If it's an array of suggestions, format as bullet points
            content = parsed.map((item) => {
              if (typeof item === 'string') return `• ${item}`;
              if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>;
                const suggestion = obj['suggestion'];
                const text = obj['text'];
                if (typeof suggestion === 'string') return `• ${suggestion}`;
                if (typeof text === 'string') return `• ${text}`;
              }
              return `• ${JSON.stringify(item)}`;
            }).join('\n\n');
          } else if (parsed && typeof parsed === 'object') {
            const obj = parsed as Record<string, unknown>;
            const suggestions = obj['suggestions'];
            const response = obj['response'];
            if (Array.isArray(suggestions)) {
              content = suggestions.map((s) => `• ${String(s)}`).join('\n\n');
            } else if (typeof response === 'string') {
              content = response;
            }
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
        sale.items.forEach((item) => {
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
        sale.items.forEach((item) => {
          const productId = item.productId;
          const productName = item.productName;
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
      enhancedQuestion += `\n\nToday's Net Profit: ${formatCurrency(todayProfit)}`;
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
    <div
      ref={containerRef}
      className="w-full max-w-full overflow-x-hidden px-3 py-2 md:p-6 space-y-3 md:space-y-6 relative min-h-screen pb-32 select-none box-border bg-background"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-2xl font-semibold text-foreground truncate" data-testid="text-page-title">
            {t('navigation.dashboard')}
          </h1>
          <p className="text-[9px] md:text-sm text-muted-foreground" data-testid="text-page-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Admin Notifications */}
          {(isOwner || isManager) && (
            <div className="relative">
              <Button variant="outline" size="icon" className="relative h-8 w-8">
                <Bell className="w-4 h-4" />
                {alertsData && alertsData.unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center text-[9px] p-0"
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

      {/* Summary Cards Row - Pixel Perfect 2-Column Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-4">
        {/* Card: Total Sales Today */}
        <CompactMetric
          testId="card-total-sales"
          title={t('dashboard.todaySales')}
          value={formatCurrency(analytics?.todaySales ?? 0)}
          subtitle={t('dashboard.vsYesterday')}
          icon={DollarSign}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-500/10"
          isLoading={analyticsLoading}
        />

        {/* Card: Monthly Sales */}
        <CompactMetric
          testId="card-monthly-sales"
          title={t('dashboard.monthlySales')}
          value={formatCurrency(analytics?.monthlySales ?? 0)}
          subtitle={t('dashboard.thisMonth')}
          icon={DollarSign}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-500/10"
          isLoading={analyticsLoading}
        />

        {/* Card: Total Orders */}
        <CompactMetric
          testId="card-total-orders"
          title={t('dashboard.ordersToday')}
          value={analytics?.totalOrders ?? 0}
          subtitle={t('dashboard.transactions')}
          icon={Users}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-500/10"
          isLoading={analyticsLoading}
        />

        {/* Card: Total Receivables */}
        <CompactMetric
          testId="card-total-receivables"
          title={t('dashboard.receivables')}
          value={formatCurrency(analytics?.totalReceivables ?? 0)}
          subtitle={t('dashboard.outstanding')}
          icon={PiggyBank}
          iconColor="text-amber-500"
          iconBgColor="bg-amber-500/10"
          isLoading={analyticsLoading}
          onClick={() => setLocation('/ledger')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setLocation('/ledger');
            }
          }}
        />

        {/* Card: Low Stock */}
        <CompactMetric
          testId="card-low-stock"
          title={t('dashboard.lowStock')}
          value={analytics?.lowStockCount ?? 0}
          subtitle={t('dashboard.itemsNeedRestock')}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          iconBgColor="bg-amber-500/10"
          isLoading={analyticsLoading}
        />

        {/* Card: Monthly Expenses - Hidden from Cashiers */}
        {canViewSensitiveFinancials && (
          <CompactMetric
            testId="card-expenses"
            title={t('dashboard.monthlyExpenses')}
            value={formatCurrency(pnlReport?.totalExpenses ?? 0)}
            subtitle={t('dashboard.thisMonth')}
            icon={Wallet}
            iconColor="text-red-500"
            iconBgColor="bg-red-500/10"
            valueClassName="text-red-600 dark:text-red-400"
            isLoading={pnlLoading}
          />
        )}

        {/* Card: Gross Profit - Hidden from Cashiers */}
        {canViewSensitiveFinancials && (
          <CompactMetric
            testId="card-gross-profit"
            title="Gross Profit"
            value={formatCurrency(pnlReport?.grossProfit ?? 0)}
            subtitle="Revenue - COGS"
            icon={TrendingUp}
            iconColor="text-blue-500"
            iconBgColor="bg-blue-500/10"
            valueClassName={(pnlReport?.grossProfit ?? 0) >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600"}
            isLoading={pnlLoading}
          />
        )}

        {/* Card: Net Profit - Hidden from Cashiers */}
        {canViewSensitiveFinancials && (
          <Card
            data-testid="card-net-profit"
            className={`h-[88px] md:h-auto overflow-hidden ${pnlReport?.netProfit && pnlReport.netProfit > 0 ? "bg-gradient-to-br from-emerald-500/5 to-transparent" : ""}`}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-1 p-2 md:p-4 pb-0.5 md:pb-2">
              <CardTitle className="text-[9px] md:text-sm font-medium text-muted-foreground truncate">
                Net Profit
              </CardTitle>
              <div className={`flex items-center justify-center w-5 h-5 md:w-10 md:h-10 rounded-md flex-shrink-0 ${(pnlReport?.netProfit ?? 0) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <PiggyBank className={`w-3 h-3 md:w-5 md:h-5 ${(pnlReport?.netProfit ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`} />
              </div>
            </CardHeader>
            <CardContent className="p-2 md:p-4 pt-0">
              {pnlLoading ? (
                <Skeleton className="h-5 md:h-9 w-16 md:w-32" />
              ) : (
                <div className={`text-sm md:text-3xl font-bold tabular-nums truncate ${(pnlReport?.netProfit ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
                  {formatCurrency(pnlReport?.netProfit ?? 0)}
                </div>
              )}
              <p className="text-[8px] md:text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5 truncate">
                {pnlReport?.netProfitMargin !== undefined && (
                  <>
                    {pnlReport.netProfitMargin >= 0 ? (
                      <TrendingUp className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5 text-red-500 flex-shrink-0" />
                    )}
                    <span className="truncate">{pnlReport.netProfitMargin.toFixed(1)}%</span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sales Chart */}
      <Card className="overflow-hidden">
        <CardHeader className="p-2 md:p-4 pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-lg font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" />
            <span className="truncate">{t('dashboard.sevenDaySales')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1 md:p-4 pt-0">
          {analyticsLoading ? (
            <Skeleton className="h-40 md:h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={160} className="md:!h-[250px]">
              <BarChart data={analytics?.chartData || []} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString(i18n.language === 'my' ? 'my-MM' : 'en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value;
                  }}
                />
                <Tooltip
                  formatter={(value, name) => [formatCurrency(Number(value)), t('dashboard.todaySales')]}
                  contentStyle={{ fontSize: 11 }}
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
      <Card className="overflow-hidden">
        <CardHeader className="p-2 md:p-4 pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-lg font-medium flex items-center gap-2">
            <Package className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            <span className="truncate">Top Products</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0">
          {analyticsLoading ? (
            <div className="space-y-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 md:h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {analytics?.topProducts?.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-2 md:p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 md:w-10 md:h-10 bg-emerald-500/10 rounded-md flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm md:text-lg">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs md:text-sm truncate">{product.name}</p>
                      <p className="text-[9px] md:text-xs text-muted-foreground">Qty: {product.quantity}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-bold text-xs md:text-sm">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS Payment Log Viewer - For Admin/Manager only */}
      {(isOwner || isManager) && (
        <SmsLogViewer />
      )}

      {/* AI Assistant Panel */}
      <Card data-testid="card-ai-assistant" className="bg-gradient-to-r from-indigo-500/5 via-transparent to-emerald-500/5 overflow-hidden">
        <CardHeader className="p-2 md:p-4 pb-1 md:pb-2">
          <CardTitle className="text-sm md:text-lg font-medium flex items-center gap-2">
            <Bot className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" />
            <span className="truncate">AI Assistant</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* Top 3 Debtors */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-muted-foreground">
                <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="truncate">Top 3 Debtors</span>
              </div>
              {insightsLoading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 md:h-12" />
                  ))}
                </div>
              ) : aiInsights?.topDebtors && aiInsights.topDebtors.length > 0 ? (
                <div className="space-y-1.5">
                  {aiInsights.topDebtors.map((debtor, index) => (
                    <div
                      key={debtor.customerId}
                      className="flex items-center justify-between gap-1.5 p-1.5 md:p-2 rounded-lg bg-muted/50"
                      data-testid={`debtor-${debtor.customerId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] md:text-xs font-bold text-muted-foreground">#{index + 1}</span>
                          <span className="text-[10px] md:text-sm font-medium truncate">{debtor.customerName}</span>
                        </div>
                        <div className="text-[9px] md:text-xs text-muted-foreground truncate">
                          {formatCurrency(debtor.outstandingBalance)}
                        </div>
                      </div>
                      <Badge
                        variant={debtor.riskLevel === "high" ? "destructive" : "secondary"}
                        className="text-[8px] md:text-[10px] px-1 py-0 h-4 flex-shrink-0"
                      >
                        {debtor.riskLevel === "high" ? "High" : "Low"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] md:text-xs text-muted-foreground py-3 text-center">
                  No outstanding debts
                </p>
              )}
            </div>

            {/* Stock Warnings */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-muted-foreground">
                <Package className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="truncate">Stock Warnings</span>
              </div>
              {insightsLoading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 md:h-12" />
                  ))}
                </div>
              ) : aiInsights?.stockWarnings && aiInsights.stockWarnings.length > 0 ? (
                <div className="space-y-1.5 max-h-36 md:max-h-48 overflow-y-auto">
                  {aiInsights.stockWarnings.slice(0, 5).map((warning) => (
                    <div
                      key={warning.productId}
                      className="flex items-center justify-between gap-1.5 p-1.5 md:p-2 rounded-lg bg-muted/50"
                      data-testid={`stock-warning-${warning.productId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] md:text-sm font-medium truncate block">{warning.productName}</span>
                        <span className="text-[9px] md:text-xs text-muted-foreground truncate block">
                          {warning.currentStock} left ({warning.daysUntilStockout === 999 ? "No sales" : `~${warning.daysUntilStockout}d`})
                        </span>
                      </div>
                      <Badge
                        variant={warning.severity === "critical" ? "destructive" : warning.severity === "warning" ? "secondary" : "outline"}
                        className={`text-[8px] md:text-[10px] px-1 py-0 h-4 flex-shrink-0 ${warning.severity === "warning" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30" : ""}`}
                      >
                        {warning.severity === "critical" ? "Crit" : warning.severity === "warning" ? "Warn" : "Low"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] md:text-xs text-muted-foreground py-3 text-center">
                  All products well-stocked
                </p>
              )}
            </div>

            {/* Daily Summary */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="truncate">Daily Summary</span>
              </div>
              {insightsLoading ? (
                <Skeleton className="h-28 md:h-36" />
              ) : aiInsights?.dailySummary ? (
                <div className="space-y-2 p-2 md:p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />
                      <span className="text-[9px] md:text-xs text-muted-foreground">Cash</span>
                    </div>
                    <span className="text-[10px] md:text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate">
                      {formatCurrency(aiInsights.dailySummary.cashSales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-500" />
                      <span className="text-[9px] md:text-xs text-muted-foreground">Card</span>
                    </div>
                    <span className="text-[10px] md:text-sm font-bold text-indigo-600 dark:text-indigo-400 truncate">
                      {formatCurrency(aiInsights.dailySummary.cardSales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                      <span className="text-[9px] md:text-xs text-muted-foreground">Credit</span>
                    </div>
                    <span className="text-[10px] md:text-sm font-bold text-amber-600 dark:text-amber-400 truncate">
                      {formatCurrency(aiInsights.dailySummary.creditSales)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-1.5 mt-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[9px] md:text-xs font-medium">Transactions</span>
                      <span className="text-[10px] md:text-sm font-bold">{aiInsights.dailySummary.transactionCount}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] md:text-xs text-muted-foreground py-3 text-center">
                  No sales today
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Draggable Floating AI Assistant (Messenger Style) */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragElastic={0.1}
        dragMomentum={false}
        whileDrag={{ scale: 1.05, zIndex: 100 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 touch-none"
        data-testid="ai-assistant-floating"
        style={{ touchAction: 'none' }}
      >
        {isOwner ? (
          <Dialog open={geminiOpen} onOpenChange={setGeminiOpen}>
            <DialogTrigger asChild>
              <button
                className="relative h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-lg cursor-grab active:cursor-grabbing hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center"
                data-testid="button-open-gemini-chat"
              >
                <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-white" />
                {/* Notification Pulse Dot */}
                <span className="absolute top-0 right-0 h-4 w-4 md:h-5 md:w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 md:h-5 md:w-5 bg-emerald-500 border-2 border-white"></span>
                </span>
              </button>
            </DialogTrigger>
            <DialogContent
              className={`${isFullscreen ? 'w-[95vw] h-[95vh] max-w-none' : 'w-[92vw] md:w-[80vw] max-w-lg md:max-w-5xl'} max-h-[85vh] md:max-h-[80vh] flex flex-col transition-all duration-300`}
            >
              <DialogHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" />
                  <span className="truncate">{t('virtualCFO.title')}</span>
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="h-7 w-7 md:h-8 md:w-8"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  )}
                </Button>
              </DialogHeader>

              {/* Today's Profit Display */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-3 md:p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs md:text-sm font-medium text-muted-foreground">{t('dashboard.todayNetProfit')}</h3>
                    <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(calculateTodayProfit())}
                    </p>
                  </div>
                  <div className="text-blue-500">
                    <TrendingUp className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                </div>
              </div>

              <ScrollArea
                className={`flex-1 ${isFullscreen ? 'min-h-[calc(95vh-200px)]' : 'min-h-[200px] md:min-h-[300px]'} ${isFullscreen ? 'max-h-[calc(95vh-200px)]' : 'max-h-[350px] md:max-h-[500px]'} pr-2 md:pr-4`}
              >
                <div className="space-y-3 md:space-y-4" ref={scrollAreaRef}>
                  {geminiMessages.length === 0 && !streamingContent && (
                    <div className="text-center text-muted-foreground py-6 md:py-8">
                      <Sparkles className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 text-indigo-500/50" />
                      <p className="text-xs md:text-sm">သင့်စီးပွားရေးအကြောင်း မေးခွန်းများ မေးနိုင်ပါသည်။</p>
                      <p className="text-[10px] md:text-xs mt-1.5 md:mt-2">ဥပမာ: "ဘယ်ကုန်ကျစရိတ်ကို လျှော့ချသင့်လဲ?"</p>
                    </div>
                  )}
                  {geminiMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      data-testid={`gemini-message-${idx}`}
                    >
                      <div
                        className={`max-w-[90%] md:max-w-[85%] rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-sm ${msg.role === "user"
                          ? "bg-indigo-500 text-white"
                          : "bg-muted"
                          }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-p:my-2 md:prose-p:my-3 prose-ul:my-2 md:prose-ul:my-3 prose-li:my-1 md:prose-li:my-2 prose-strong:font-semibold">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className={`${isFullscreen ? 'text-sm md:text-base' : 'text-xs md:text-sm'} leading-relaxed my-2 md:my-3`} style={{ lineHeight: '1.7' }}>{children}</p>,
                                ul: ({ children }) => <ul className={`list-disc list-inside my-2 md:my-3 space-y-1 md:space-y-2 ${isFullscreen ? 'text-sm md:text-base' : 'text-xs md:text-sm'}`} style={{ lineHeight: '1.7' }}>{children}</ul>,
                                ol: ({ children }) => <ol className={`list-decimal list-inside my-2 md:my-3 space-y-1 md:space-y-2 ${isFullscreen ? 'text-sm md:text-base' : 'text-xs md:text-sm'}`} style={{ lineHeight: '1.7' }}>{children}</ol>,
                                li: ({ children }) => <li className="ml-1 md:ml-2" style={{ lineHeight: '1.7' }}>{children}</li>,
                                h1: ({ children }) => <h1 className={`${isFullscreen ? 'text-xl md:text-2xl' : 'text-base md:text-xl'} font-bold mt-4 md:mt-6 mb-2 md:mb-3`} style={{ lineHeight: '1.5' }}>{children}</h1>,
                                h2: ({ children }) => <h2 className={`${isFullscreen ? 'text-lg md:text-xl' : 'text-sm md:text-lg'} font-bold mt-3 md:mt-5 mb-2 md:mb-3`} style={{ lineHeight: '1.5' }}>{children}</h2>,
                                h3: ({ children }) => <h3 className={`${isFullscreen ? 'text-base md:text-lg' : 'text-xs md:text-base'} font-bold mt-2 md:mt-4 mb-1 md:mb-2`} style={{ lineHeight: '1.5' }}>{children}</h3>,
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
                      <div className={`bg-muted rounded-lg px-3 py-2 md:px-4 md:py-3 ${isFullscreen ? 'text-sm md:text-base' : 'text-xs md:text-sm'} max-w-[90%] md:max-w-[85%]`}>
                        <div className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-p:my-2 md:prose-p:my-3 prose-ul:my-2 md:prose-ul:my-3 prose-li:my-1 md:prose-li:my-2 prose-strong:font-semibold">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className={`${isFullscreen ? 'text-sm md:text-base' : 'text-xs md:text-sm'} leading-relaxed my-2 md:my-3`} style={{ lineHeight: '1.7' }}>{String(children)}</p>,
                              ul: ({ children }) => <ul className={`list-disc list-inside my-2 md:my-3 space-y-1 md:space-y-2 ${isFullscreen ? 'text-sm md:text-base' : 'text-xs md:text-sm'}`} style={{ lineHeight: '1.7' }}>{String(children)}</ul>,
                              ol: ({ children }) => <ol className={`list-decimal list-inside my-2 md:my-3 space-y-1 md:space-y-2 ${isFullscreen ? 'text-sm md:text-base' : 'text-xs md:text-sm'}`} style={{ lineHeight: '1.7' }}>{String(children)}</ol>,
                              li: ({ children }) => <li className="ml-1 md:ml-2" style={{ lineHeight: '1.7' }}>{String(children)}</li>,
                              h1: ({ children }) => <h1 className={`${isFullscreen ? 'text-xl md:text-2xl' : 'text-base md:text-xl'} font-bold mt-4 md:mt-6 mb-2 md:mb-3`} style={{ lineHeight: '1.5' }}>{String(children)}</h1>,
                              h2: ({ children }) => <h2 className={`${isFullscreen ? 'text-lg md:text-xl' : 'text-sm md:text-lg'} font-bold mt-3 md:mt-5 mb-2 md:mb-3`} style={{ lineHeight: '1.5' }}>{String(children)}</h2>,
                              h3: ({ children }) => <h3 className={`${isFullscreen ? 'text-base md:text-lg' : 'text-xs md:text-base'} font-bold mt-2 md:mt-4 mb-1 md:mb-2`} style={{ lineHeight: '1.5' }}>{String(children)}</h3>,
                              strong: ({ children }) => <strong className="font-semibold">{String(children)}</strong>,
                              em: ({ children }) => <em className="italic">{String(children)}</em>,
                            }}
                          >
                            {typeof streamingContent === 'string' ? streamingContent : String(streamingContent || '')}
                          </ReactMarkdown>
                        </div>
                        <span className="inline-block w-1.5 h-3 md:w-2 md:h-4 bg-indigo-500 animate-pulse ml-1" />
                      </div>
                    </div>
                  )}
                  {/* Invisible element to scroll to */}
                  <div ref={messagesEndRef} />
                  {geminiMutation.isPending && !streamingContent && (
                    <div className="flex flex-col gap-1.5 md:gap-2">
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-sm flex items-center gap-1.5 md:gap-2">
                          <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                          <span className="text-[10px] md:text-sm">စဉ်းစားနေပါသည်...</span>
                        </div>
                      </div>
                      {geminiPendingMessage && (
                        <p className="text-[9px] md:text-xs text-muted-foreground">{geminiPendingMessage}</p>
                      )}
                    </div>
                  )}
                </div>
                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
              </ScrollArea>
              <div className="flex gap-1.5 md:gap-2 mt-3 md:mt-4 pt-3 md:pt-4 border-t">
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
                  className="flex-1 text-xs md:text-sm h-9 md:h-10"
                />
                <Button
                  onClick={handleAskGemini}
                  disabled={!geminiQuestion.trim() || geminiMutation.isPending}
                  data-testid="button-send-gemini"
                  size="sm"
                  className="h-9 md:h-10 px-3 md:px-4"
                >
                  <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <div className="relative h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-lg flex items-center justify-center">
            <Bot className="w-6 h-6 md:w-7 md:h-7 text-white" />
            {/* Notification Pulse Dot */}
            {aiInsights?.riskySummary && aiInsights.riskySummary !== "All systems healthy." && (
              <span className="absolute top-0 right-0 h-4 w-4 md:h-5 md:w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 md:h-5 md:w-5 bg-amber-500 border-2 border-white"></span>
              </span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
