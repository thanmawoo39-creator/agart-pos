import { useState } from "react";
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
import { Plus, Trash2, Edit2, Lock, DollarSign, TrendingUp, Lightbulb, Calendar, Filter } from "lucide-react";
import type { Expense, ExpenseCategory } from "@shared/schema";
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

export default function Expenses() {
  const { toast } = useToast();
  const { session, isOwner } = useAuth();
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
    note: "",
  });

  const isLoggedIn = !!session;
  const canManageExpenses = isOwner;

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: insights } = useQuery<ExpenseInsightData>({
    queryKey: ["/api/ai/expense-insights"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { category: ExpenseCategory; amount: number; date: string; note?: string; staffId?: string; staffName?: string }) =>
      apiRequest("POST", "/api/expenses", {
        ...data,
        timestamp: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/expense-insights"] });
      toast({ title: "Expense added successfully" });
      closeAddModal();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add expense",
        description: error.message,
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
    onError: (error: any) => {
      toast({
        title: "Failed to update expense",
        description: error.message,
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
    onError: (error: any) => {
      toast({
        title: "Failed to delete expense",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      category: "Other",
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      note: "",
    });
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
      note: expense.note || "",
    });
    setEditModalOpen(true);
  };

  const handleSubmitAdd = () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      category: formData.category,
      amount: parseFloat(formData.amount),
      date: formData.date,
      note: formData.note || undefined,
      staffId: session?.staff.id,
      staffName: session?.staff.name,
    });
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
              ${(insights?.totalExpensesThisMonth || 0).toFixed(2)}
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
              ${(insights?.estimatedNetProfit || 0).toFixed(2)}
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
                  <p key={idx} className={`text-xs ${
                    insight.type === "warning" ? "text-amber-600 dark:text-amber-400" :
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
                      <TableHead>Added By</TableHead>
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
                          ${expense.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {expense.note || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {expense.staffName || "-"}
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
                <span className="font-semibold">Total: ${totalFiltered.toFixed(2)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
            <DialogDescription>Record a new business expense</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              <Label htmlFor="amount">Amount ($)</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAddModal} data-testid="button-cancel-add">
              Cancel
            </Button>
            <Button onClick={handleSubmitAdd} disabled={createMutation.isPending} data-testid="button-save-expense">
              {createMutation.isPending ? "Saving..." : "Save Expense"}
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
          <div className="space-y-4 py-4">
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
              <Label htmlFor="edit-amount">Amount ($)</Label>
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
