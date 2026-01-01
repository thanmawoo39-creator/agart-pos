import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  Search,
  Plus,
  User,
  CreditCard,
  AlertTriangle,
  Eye,
} from "lucide-react";
import type { Customer } from "@shared/schema";

const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  barcode: z.string().optional(),
  creditLimit: z.coerce.number().min(0, "Credit limit must be positive"),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

export default function Customers() {
  const { toast } = useToast();
  const [scanInput, setScanInput] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      barcode: "",
      creditLimit: 0,
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormValues) => {
      return apiRequest("POST", "/api/customers", {
        ...data,
        email: data.email || undefined,
        currentBalance: 0,
        loyaltyPoints: 0,
        riskTag: "low",
      });
    },
    onSuccess: () => {
      toast({
        title: "Customer Added",
        description: "New customer has been created successfully",
      });
      form.reset();
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!barcode.trim()) return;
      try {
        const response = await fetch(`/api/scan/customer/${encodeURIComponent(barcode)}`);
        if (response.ok) {
          const customer: Customer = await response.json();
          toast({
            title: "Customer Found",
            description: `${customer.name} - Balance: $${customer.currentBalance.toFixed(2)}`,
          });
        } else {
          toast({
            title: "Customer Not Found",
            description: `No customer found with barcode: ${barcode}`,
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Scan Error",
          description: "Failed to scan customer",
          variant: "destructive",
        });
      }
      setScanInput("");
    },
    [toast]
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const filteredCustomers = customers?.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.barcode?.includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Customers
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Manage customer accounts and credit
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-customer">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => createCustomerMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer name" {...field} data-testid="input-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 555-0123" {...field} data-testid="input-customer-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@example.com" type="email" {...field} data-testid="input-customer-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode / ID</FormLabel>
                      <FormControl>
                        <Input placeholder="CUST001" {...field} data-testid="input-customer-barcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Limit ($)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="500" {...field} data-testid="input-customer-credit-limit" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createCustomerMutation.isPending}
                  data-testid="button-submit-customer"
                >
                  {createCustomerMutation.isPending ? "Adding..." : "Add Customer"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Scan Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Scan customer barcode..."
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleScan(scanInput);
            }}
            className="pl-10"
            data-testid="input-customer-scan"
          />
        </div>
        <Button onClick={() => handleScan(scanInput)} data-testid="button-scan-customer">
          Scan
        </Button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name, phone, or barcode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search-customers"
        />
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader className="p-3 md:p-4">
          <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Customer Directory ({filteredCustomers?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredCustomers && filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Customer</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const isHighRisk = customer.riskTag === "high" || 
                      (customer.creditLimit > 0 && customer.currentBalance > customer.creditLimit * 0.8);
                    return (
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10">
                              <User className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{customer.name}</p>
                              <p className="text-xs text-muted-foreground">{customer.phone || customer.email || "-"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.barcode ? (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {customer.barcode}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold tabular-nums ${customer.currentBalance > 0 ? "text-amber-600" : "text-foreground"}`}>
                            {formatCurrency(customer.currentBalance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatCurrency(customer.creditLimit)}
                        </TableCell>
                        <TableCell>
                          {isHighRisk ? (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              High
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Low</Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <Link href={`/customers/${customer.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-view-${customer.id}`}>
                              <Eye className="w-4 h-4 mr-1" />
                              Profile
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No Customers Yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Add customers to manage their accounts and credit.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Customer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
