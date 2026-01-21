import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useCurrency } from "@/hooks/use-currency";
import { Plus, Trash2, Edit2, Lock, DollarSign, TrendingUp, Lightbulb, Calendar, Filter, Camera, X, Upload, Eye } from "lucide-react";
import type { Expense, ExpenseCategory, InsertExpense } from "@shared/schema";
import { format } from "date-fns";

const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Rent", "Electricity", "Fuel", "Internet", "Taxes", "Other"];

const categoryColors: Record<ExpenseCategory, string> = {
  Rent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Electricity: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  Fuel: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  Internet: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Taxes: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Other: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
};

interface ExpenseInsightData {
  totalExpensesThisMonth: number;
  totalExpensesLastMonth: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  insights: Array<{ type: "warning" | "info" | "success"; message: string; category?: ExpenseCategory }>;
  estimatedNetProfit: number;
  expenseToSalesRatio: number;
}

type ReceiptAnalysis = {
  category?: ExpenseCategory;
  estimatedAmount?: number | null;
  summary?: string | null;
  warnings?: string[];
  isValid?: boolean;
  error?: string;
};

export default function Expenses() {
  const { toast } = useToast();
  const { session, isOwner } = useAuth();
  const { formatCurrency } = useCurrency();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const [formData, setFormData] = useState({
    category: "Other" as ExpenseCategory,
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    note: "",
  });
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null); // Base64 image data
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraPreviewTimeoutRef = useRef<number | null>(null);

  const isLoggedIn = !!session;
  const canManageExpenses = isOwner;

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
    enabled: canManageExpenses,
  });

  const { data: insights } = useQuery<ExpenseInsightData>({
    queryKey: ["/api/ai/expense-insights"],
    enabled: canManageExpenses,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<InsertExpense, "timestamp"> & { receiptImageUrl?: string }) => {
      const res = await apiRequest("POST", "/api/expenses", {
        ...data,
      });
      return (await res.json()) as Expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/expense-insights"] });
      toast({ title: "Expense added successfully" });
    },
    onError: (error: unknown) => {
      const err = error as Error;
      toast({
        title: "Failed to add expense",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Expense> }) =>
      apiRequest("PATCH", `/api/expenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/expense-insights"] });
      toast({ title: "Expense updated successfully" });
      closeEditModal();
    },
    onError: (error: unknown) => {
      const err = error as Error;
      toast({
        title: "Failed to update expense",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/expense-insights"] });
      toast({ title: "Expense deleted successfully" });
      setDeleteConfirmOpen(false);
      setSelectedExpense(null);
    },
    onError: (error: unknown) => {
      const err = error as Error;
      toast({
        title: "Failed to delete expense",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const analyzeReceiptMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const base64 = imageData.split(',')[1];
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', blob, `receipt-${Date.now()}.jpg`);

      const res = await fetch('/api/ai/analyze-expense', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        // Try to get error response, handle both JSON and HTML
        const contentType = res.headers.get('content-type');
        let errorData;

        if (contentType && contentType.includes('application/json')) {
          errorData = await res.json().catch(() => ({ message: 'An unknown error occurred' }));
        } else {
          // If HTML error page, create a more helpful error
          const text = await res.text().catch(() => 'Server returned an error');
          errorData = {
            error: 'Server returned an HTML error page instead of JSON',
            details: text.substring(0, 200) // Truncate long HTML responses
          };
        }

        throw new Error(errorData.error || errorData.message || 'Failed to analyze receipt');
      }

      const responseText = await res.text();
      let analysisResult: unknown;

      try {
        analysisResult = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        console.error('Response text:', responseText);
        throw new Error('Invalid response format from server');
      }

      return analysisResult as ReceiptAnalysis;
    },
  });

  const resetForm = () => {
    setFormData({
      category: "Other",
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      note: "",
    });
    setReceiptImage(null);
    setReceiptFileName(null);
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = "";
    }
  };

  const handleReceiptFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setReceiptFileName(file.name);

      // Convert file to Base64 for preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setReceiptImage(base64String);

        toast({
          title: "Receipt Uploaded",
          description: "You can now fill in the expense details manually or try AI analysis.",
        });
      };
      reader.onerror = () => {
        toast({
          title: "Error reading image",
          description: "Failed to read the selected image file.",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptImage(null);
    setReceiptFileName(null);
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = "";
    }
  };

  const uploadReceiptImage = async (): Promise<string | null> => {
    if (!receiptImage) return null;

    try {
      setIsUploadingReceipt(true);
      console.log('Starting receipt image upload...');

      // Convert base64 to blob
      const response = await fetch(receiptImage);
      const blob = await response.blob();

      // Create FormData
      const formData = new FormData();
      formData.append('image', blob, receiptFileName || 'receipt.jpg');

      // Upload to server
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed:', errorText);
        throw new Error(`Failed to upload receipt image: ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      console.log('Upload successful:', uploadData);

      // Return the full URL
      const fullUrl = uploadData.url.startsWith('http')
        ? uploadData.url
        : `${window.location.origin}${uploadData.url}`;

      return fullUrl;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast({
        title: "Failed to upload receipt",
        description: error instanceof Error ? error.message : "An error occurred while uploading the receipt.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    resetForm();
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedExpense(null);
    resetForm();
  };

  const openEditModal = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      date: expense.date,
      description: expense.description || "",
      note: expense.note || "",
    });
    setEditModalOpen(true);
  };

  const handleSubmitAdd = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    const imageForAi = receiptImage;

    let receiptImageUrl: string | undefined = undefined;
    if (receiptImage) {
      const uploaded = await uploadReceiptImage();
      if (!uploaded) {
        return;
      }
      receiptImageUrl = uploaded;
    }

    let created: Expense;
    try {
      created = await createMutation.mutateAsync({
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description || undefined,
        note: formData.note || undefined,
        receiptImageUrl,
      });
    } catch {
      return;
    }

    closeAddModal();

    if (imageForAi) {
      void analyzeReceiptMutation
        .mutateAsync(imageForAi)
        .then((analysis) => {
          const suggestedCategory = analysis?.category ?? null;
          const suggestedAmount = typeof analysis?.estimatedAmount === 'number' ? analysis.estimatedAmount : null;
          const summary = analysis?.summary ?? null;

          if (!suggestedCategory && !suggestedAmount && !summary) {
            return;
          }

          toast({
            title: "AI Suggestions Available",
            description: `Saved expense ${created.id}. Category: ${suggestedCategory ?? '-'}, Amount: ${suggestedAmount ?? '-'}${summary ? `, Summary: ${summary}` : ''}`,
          });
        })
        .catch((err: unknown) => {
          const e = err as Error;
          console.error('AI Analysis failed:', err);
          toast({
            title: "AI Analysis Unavailable",
            description: "Expense was saved. You can keep entering expenses manually; the receipt is preserved.",
            variant: "default",
          });
        });
    }
  };

  const handleSubmitEdit = () => {
    if (!selectedExpense) return;
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    updateMutation.mutate({
      id: selectedExpense.id,
      data: {
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: formData.date,
        note: formData.note || undefined,
      },
    });
  };

  const filteredExpenses = expenses.filter((expense) => {
    if (categoryFilter !== "all" && expense.category !== categoryFilter) return false;
    if (dateFilter && !expense.date.startsWith(dateFilter)) return false;
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const applyAiSuggestionsToForm = (analysis: ReceiptAnalysis) => {
    const suggestedCategory = analysis?.category;
    const suggestedAmount = typeof analysis?.estimatedAmount === 'number' ? analysis.estimatedAmount : undefined;
    const suggestedSummary = typeof analysis?.summary === 'string' ? analysis.summary : undefined;

    setFormData((prev) => {
      const next = { ...prev };

      if (suggestedCategory && prev.category === "Other") {
        next.category = suggestedCategory;
      }

      if (typeof suggestedAmount === 'number' && (!prev.amount || Number(prev.amount) <= 0)) {
        next.amount = String(suggestedAmount);
      }

      if (suggestedSummary && !prev.note) {
        next.note = `AI Summary: ${suggestedSummary}`;
      }

      return next;
    });
  };

  const handleTakePhotoClick = async () => {
    console.log('Camera: Starting camera initialization');

    // Check if mediaDevices is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Camera: mediaDevices not supported', {
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!navigator.mediaDevices?.getUserMedia
      });
      setCameraError("Camera access is not supported by your browser. Please use a modern browser like Chrome, Firefox, or Safari.");
      setIsCameraOpen(true);
      return;
    }

    // Check for secure context
    if (!window.isSecureContext) {
      console.error('Camera: Not in secure context', {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isSecure: window.isSecureContext
      });
      setCameraError("Camera access requires a secure connection (HTTPS). The app is currently running on an insecure connection. Please upload an image from your gallery instead.");
      setIsCameraOpen(true);
      return;
    }

    console.log('Camera: Secure context confirmed, requesting camera access');

    try {
      // Try to get camera access with environment (rear) camera first
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      console.log('Camera: Requesting with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('Camera: Stream obtained successfully', {
        active: stream.active,
        tracks: stream.getTracks().length
      });

      setCameraStream(stream);

      // Set video source after a small delay to ensure the stream is ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => {
            console.error('Camera: Video play failed:', err);
            setCameraError("Failed to start camera preview. Please try uploading from gallery.");
          });
          console.log('Camera: Video source set');
        }
      }, 100);

      // Watchdog: if preview stays black/doesn't start, show fallback
      if (cameraPreviewTimeoutRef.current) {
        window.clearTimeout(cameraPreviewTimeoutRef.current);
      }
      cameraPreviewTimeoutRef.current = window.setTimeout(() => {
        const v = videoRef.current;
        const hasFrames = !!v && v.videoWidth > 0 && v.videoHeight > 0;
        const canPlay = !!v && v.readyState >= 2;

        if (!hasFrames || !canPlay) {
          console.warn('Camera: Preview watchdog triggered - switching to upload fallback', {
            readyState: v?.readyState,
            videoWidth: v?.videoWidth,
            videoHeight: v?.videoHeight,
          });
          setCameraError("Camera preview failed to load. Please upload an image instead.");
        }
      }, 2500);

      setCameraError(null);
    } catch (err) {
      console.error("Camera: Error accessing camera:", err);

      if (err instanceof Error) {
        console.log('Camera: Error details:', {
          name: err.name,
          message: err.message,
          constraint: (typeof (err as unknown as { constraint?: unknown })?.constraint === 'string'
            ? (err as unknown as { constraint?: string }).constraint
            : undefined),
          toString: err.toString()
        });

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError("Camera permission was denied. Please allow camera access in your browser settings or upload an image from your gallery.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError("No camera device found. Please ensure your device has a camera or upload an image from your gallery.");
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraError("Camera is already in use by another application. Please close the other app or upload an image from your gallery.");
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          // Try again with simpler constraints
          console.log('Camera: Retrying with basic constraints');
          try {
            const basicStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setCameraStream(basicStream);
            setTimeout(() => {
              if (videoRef.current) {
                videoRef.current.srcObject = basicStream;
                videoRef.current.play().catch(err => {
                  console.error('Camera: Video play failed on retry:', err);
                  setCameraError("Failed to start camera preview. Please try uploading from gallery.");
                });
              }
            }, 100);

            if (cameraPreviewTimeoutRef.current) {
              window.clearTimeout(cameraPreviewTimeoutRef.current);
            }
            cameraPreviewTimeoutRef.current = window.setTimeout(() => {
              const v = videoRef.current;
              const hasFrames = !!v && v.videoWidth > 0 && v.videoHeight > 0;
              const canPlay = !!v && v.readyState >= 2;
              if (!hasFrames || !canPlay) {
                console.warn('Camera: Preview watchdog triggered after retry - switching to upload fallback', {
                  readyState: v?.readyState,
                  videoWidth: v?.videoWidth,
                  videoHeight: v?.videoHeight,
                });
                setCameraError("Camera preview failed to load. Please upload an image instead.");
              }
            }, 2500);

            setCameraError(null);
            return;
          } catch (retryErr) {
            console.error('Camera: Retry failed', retryErr);
            setCameraError("Camera requirements not met. Please upload an image from your gallery.");
          }
        } else {
          setCameraError(`Camera error: ${err.message}. Please upload an image from your gallery.`);
        }
      } else {
        console.error('Camera: Unknown error type', err);
        setCameraError("Unknown camera error occurred. Please upload an image from your gallery.");
      }
    }
    setIsCameraOpen(true);
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setReceiptImage(dataUrl);
        setReceiptFileName(`receipt-${Date.now()}.jpg`);
        handleCameraModalClose();

        toast({
          title: "Receipt Captured",
          description: "You can now fill in the expense details manually or try AI analysis.",
        });
      }
    }
  };

  const handleCameraModalClose = () => {
    console.log('Camera: Closing modal');
    if (cameraPreviewTimeoutRef.current) {
      window.clearTimeout(cameraPreviewTimeoutRef.current);
      cameraPreviewTimeoutRef.current = null;
    }
    if (cameraStream) {
      console.log('Camera: Stopping tracks');
      cameraStream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera: Track stopped:', track.kind, track.label);
      });
    }
    setIsCameraOpen(false);
    setCameraStream(null);
    setCameraError(null);
  };

  const handleGalleryUpload = () => {
    console.log('Camera: Opening gallery upload');
    handleCameraModalClose();
    // Trigger the hidden file input
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.click();
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 p-4">
        <Lock className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Login Required</h2>
        <p className="text-muted-foreground text-center">Please login to access expense management.</p>
      </div>
    );
  }

  if (!canManageExpenses) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 p-4">
        <Lock className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-center">Only owners can manage expenses.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track and manage business expenses</p>
        </div>
        <Button onClick={() => setAddModalOpen(true)} data-testid="button-add-expense">
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-monthly-expenses">
              {formatCurrency(Number(insights?.totalExpensesThisMonth) || 0)}
            </div>
            {insights && insights.totalExpensesLastMonth > 0 && (
              <p className="text-xs text-muted-foreground">
                {insights.totalExpensesThisMonth > insights.totalExpensesLastMonth ? (
                  <span className="text-red-500">
                    +{(((insights.totalExpensesThisMonth - insights.totalExpensesLastMonth) / insights.totalExpensesLastMonth) * 100).toFixed(0)}% vs last month
                  </span>
                ) : (
                  <span className="text-green-500">
                    {(((insights.totalExpensesThisMonth - insights.totalExpensesLastMonth) / insights.totalExpensesLastMonth) * 100).toFixed(0)}% vs last month
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Est. Net Profit</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(insights?.estimatedNetProfit || 0) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-net-profit">
              {formatCurrency(Number(insights?.estimatedNetProfit) || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Expense ratio: {(insights?.expenseToSalesRatio || 0).toFixed(1)}% of sales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">AI CFO Insights</CardTitle>
            <Lightbulb className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="max-h-24 overflow-y-auto">
            {insights?.insights && insights.insights.length > 0 ? (
              <div className="space-y-1">
                {insights.insights.slice(0, 2).map((insight, idx) => (
                  <p key={idx} className={`text-xs ${insight.type === "warning" ? "text-amber-600 dark:text-amber-400" :
                    insight.type === "success" ? "text-green-600 dark:text-green-400" :
                      "text-muted-foreground"
                    }`} data-testid={`text-insight-${idx}`}>
                    {insight.message}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No insights available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <CardTitle className="text-base">Expense Records</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32" data-testid="select-category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="month"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-40"
                data-testid="input-date-filter"
              />
            </div>
            {(categoryFilter !== "all" || dateFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCategoryFilter("all"); setDateFilter(""); }}
                data-testid="button-clear-filters"
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No expenses found. Add your first expense.
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                        <TableCell className="font-medium">
                          {format(new Date(expense.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={categoryColors[expense.category]}>
                            {expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(expense.amount) || 0)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {expense.note || "-"}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const receiptUrl = expense.receiptImageUrl;

                            return receiptUrl ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(receiptUrl, '_blank')}
                                className="flex items-center gap-2 hover:bg-blue-50"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(expense)}
                              data-testid={`button-edit-${expense.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedExpense(expense); setDeleteConfirmOpen(true); }}
                              data-testid={`button-delete-${expense.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between items-center mt-4 text-sm">
                <span className="text-muted-foreground">{filteredExpenses.length} expense(s)</span>
                <span className="font-semibold">Total: {formatCurrency(Number(totalFiltered) || 0)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Camera Modal */}
      <Dialog open={isCameraOpen} onOpenChange={handleCameraModalClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Take Receipt Photo</DialogTitle>
            <DialogDescription>
              {cameraError
                ? "Camera access failed. You can upload an image from your gallery instead."
                : "Position the receipt within the frame and click capture."}
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-4">
            {cameraError ? (
              <div className="space-y-4">
                <div className="p-4 text-center text-red-500 bg-red-50 rounded-md border border-red-200">
                  <Camera className="w-12 h-12 mx-auto mb-2 text-red-400" />
                  <p className="font-semibold">Camera Access Failed</p>
                  <p className="text-sm mt-1">{cameraError}</p>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Alternative: Choose an image from your device gallery</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto rounded-md bg-black"
                  style={{ minHeight: '300px' }}
                  onLoadedMetadata={() => {
                    console.log('Camera: Video metadata loaded');
                    if (cameraPreviewTimeoutRef.current) {
                      window.clearTimeout(cameraPreviewTimeoutRef.current);
                      cameraPreviewTimeoutRef.current = null;
                    }
                    // Ensure video plays after metadata is loaded
                    if (videoRef.current) {
                      videoRef.current.play().catch(err => {
                        console.error('Camera: Auto-play failed:', err);
                      });
                    }
                  }}
                  onCanPlay={() => {
                    console.log('Camera: Video can play');
                    if (cameraPreviewTimeoutRef.current) {
                      window.clearTimeout(cameraPreviewTimeoutRef.current);
                      cameraPreviewTimeoutRef.current = null;
                    }
                  }}
                  onError={(e) => {
                    console.error('Camera: Video error:', e);
                    setCameraError("Failed to load camera preview. Please try uploading from gallery.");
                  }}
                />

                <div className="text-center text-xs text-muted-foreground">
                  <p>Make sure the receipt is clearly visible and well-lit</p>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCameraModalClose}>Cancel</Button>
            {cameraError ? (
              <Button onClick={handleGalleryUpload} className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Choose from Gallery
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleGalleryUpload} className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Choose from Gallery
                </Button>
                <Button onClick={handleCapture} disabled={!!cameraError} className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Capture Photo
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a new business expense</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto p-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData((prev) => ({ ...prev, category: val as ExpenseCategory }))}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                data-testid="input-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                data-testid="input-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="e.g., Monthly utility bill"
                data-testid="input-note"
              />
            </div>

            {/* Receipt Photo Section */}
            <div className="space-y-2">
              <Label>Receipt Photo (optional)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTakePhotoClick}
                  disabled={isUploadingReceipt}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Receipt Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => receiptFileInputRef.current?.click()}
                  disabled={isUploadingReceipt}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose from Gallery
                </Button>
                <input
                  type="file"
                  ref={receiptFileInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleReceiptFileChange}
                  multiple={false}
                />
              </div>

              {/* Receipt Preview */}
              {receiptImage && (
                <div className="mt-3 p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Receipt Preview</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveReceipt}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {receiptFileName && (
                    <p className="text-xs text-muted-foreground mb-2">{receiptFileName}</p>
                  )}
                  <div className="relative w-full rounded-md overflow-hidden border">
                    <img
                      src={receiptImage}
                      alt="Receipt preview"
                      className="w-full h-auto max-h-48 object-contain"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Image will be uploaded when you save the expense.
                  </p>
                  {receiptImage && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void analyzeReceiptMutation
                            .mutateAsync(receiptImage)
                            .then((analysis) => {
                              applyAiSuggestionsToForm(analysis);
                              toast({
                                title: "AI Suggestions Applied",
                                description: "Filled any empty fields. You can still edit everything manually.",
                              });
                            })
                            .catch((err: unknown) => {
                              console.error('AI Analysis failed:', err);
                              toast({
                                title: "AI Analysis Unavailable",
                                description: "You can enter the expense details manually. Your receipt image is preserved.",
                                variant: "default",
                              });
                            });
                        }}
                        disabled={analyzeReceiptMutation.isPending}
                        className="text-xs"
                      >
                        <Lightbulb className="w-3 h-3 mr-1" />
                        {analyzeReceiptMutation.isPending ? "Analyzing..." : "Analyze with AI"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAddModal} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAdd}
              disabled={createMutation.isPending || isUploadingReceipt}
              data-testid="button-save-expense"
            >
              {isUploadingReceipt ? "Uploading..." : createMutation.isPending ? "Saving..." : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto p-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData((prev) => ({ ...prev, category: val as ExpenseCategory }))}>
                <SelectTrigger data-testid="select-edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                data-testid="input-edit-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                data-testid="input-edit-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Note (optional)</Label>
              <Textarea
                id="edit-note"
                value={formData.note}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                data-testid="input-edit-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending} data-testid="button-update-expense">
              {updateMutation.isPending ? "Updating..." : "Update Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedExpense && deleteMutation.mutate(selectedExpense.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
