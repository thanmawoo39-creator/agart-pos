import { useState, useCallback, useRef, useEffect } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
import { API_BASE_URL } from "@/lib/api-config";
import { useBusinessMode } from "@/contexts/BusinessModeContext";
import { useCurrency } from "@/hooks/use-currency";
import {
  Users,
  Search,
  Plus,
  User,
  CreditCard,
  AlertTriangle,
  Eye,
  Banknote,
  Phone,
  Mail,
} from "lucide-react";
import type { Customer, CreditLedger } from "@shared/schema";

const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  barcode: z.string().optional(),
  imageUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  creditLimit: z.coerce.number().min(0, "Credit limit must be positive"),
  dueDate: z.string().optional().or(z.literal("")),
  monthlyClosingDay: z
    .union([z.coerce.number().int().min(1).max(31), z.literal("")])
    .optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

const repaymentFormSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
});
type RepaymentFormValues = z.infer<typeof repaymentFormSchema>;

export default function Customers() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { businessUnit } = useBusinessMode();
  const businessUnitId = businessUnit;
  const [scanInput, setScanInput] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [repaymentCustomer, setRepaymentCustomer] = useState<Customer | null>(null);
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', businessUnitId],
    enabled: !!businessUnitId,
    queryFn: async () => {
      if (!businessUnitId) return [];
      const response = await fetch(`${API_BASE_URL}/api/customers?businessUnitId=${businessUnitId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
  });

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      barcode: "",
      imageUrl: "",
      creditLimit: 0,
      dueDate: "",
      monthlyClosingDay: "",
    },
  });

  const imageUrl = form.watch('imageUrl');

  // Camera refs/state for customer photo (reused from Inventory flow)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  // Image upload state
  const [tempImageData, setTempImageData] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const captureCustomerPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const compress = async (c: HTMLCanvasElement, maxWidth = 1024, quality = 0.8) => {
      const width = c.width;
      const height = c.height;
      let targetWidth = width;
      let targetHeight = height;
      if (width > maxWidth) {
        targetWidth = maxWidth;
        targetHeight = Math.round((maxWidth / width) * height);
      }
      const tmp = document.createElement('canvas');
      tmp.width = targetWidth;
      tmp.height = targetHeight;
      const tctx = tmp.getContext('2d');
      if (!tctx) return null;
      tctx.drawImage(c, 0, 0, targetWidth, targetHeight);
      return await new Promise<Blob | null>((resolve) => tmp.toBlob((b) => resolve(b), 'image/jpeg', quality));
    };

    const blob = await compress(canvas);
    if (!blob) {
      stopCamera();
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read compressed image'));
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    // Store image temporarily - will upload when saving
    setTempImageData(dataUrl);
    toast({
      title: "Photo Captured",
      description: "Image will be uploaded when you save the customer",
    });
    stopCamera();
  };

  const startCamera = () => {
    setCameraError(null);
    setCameraModalOpen(true);
  };

  const stopCamera = () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (e) { }
    streamRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.pause(); videoRef.current.srcObject = null; } catch (e) { }
    }
    setCameraModalOpen(false);
  };

  const uploadCustomerImage = async (): Promise<string | null> => {
    if (!tempImageData) return null;

    try {
      setIsUploadingImage(true);
      console.log('Starting customer image upload...');

      // Convert base64 to blob
      const response = await fetch(tempImageData);
      const blob = await response.blob();

      // Create form data
      const formData = new FormData();
      formData.append('image', blob, 'customer-photo.jpg');

      // Upload to server
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload failed:', errorText);
        throw new Error(`Failed to upload customer image: ${errorText}`);
      }

      const uploadData = await uploadResponse.json();
      console.log('Upload successful:', uploadData);

      // Return the full URL
      const fullUrl = uploadData.url.startsWith('http')
        ? uploadData.url
        : `${window.location.origin}${uploadData.url}`;

      return fullUrl;
    } catch (error) {
      console.error('Error uploading customer image:', error);
      toast({
        title: "Failed to upload image",
        description: error instanceof Error ? error.message : "An error occurred while uploading the image.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Start camera when modal opens; attach stream to video element and play
  useEffect(() => {
    let mounted = true;
    if (!cameraModalOpen) return;

    const start = async () => {
      setCameraError(null);
      try {
        const constraints: MediaStreamConstraints = selectedDeviceId ? { video: { deviceId: { exact: selectedDeviceId } }, audio: false } : { video: { facingMode: 'environment' }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);
        if (!mounted) {
          try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { }
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          try {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            await videoRef.current.play();
          } catch (e) {
            const err = e as Error;
            console.error('Error playing customer video:', e);
            setCameraError(err?.message || 'Could not play camera stream');
          }
        }
      } catch (err: unknown) {
        const e = err as Error;
        console.error('Could not access camera in Customers modal:', e?.name || e);
        setCameraError(e?.message || 'Failed to access camera');
      }
    };

    start();

    (async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const cams = list.filter((d) => d.kind === 'videoinput');
        setDevices(cams);
        if (cams.length > 0 && !selectedDeviceId) setSelectedDeviceId(cams[0].deviceId);
      } catch (e) {
        console.warn('Failed to enumerate devices in customer modal', e);
      }
    })();

    return () => {
      mounted = false;
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch (e) { }
      streamRef.current = null;
      if (videoRef.current) {
        try { videoRef.current.pause(); videoRef.current.srcObject = null; } catch (e) { }
      }
    };
  }, [cameraModalOpen, selectedDeviceId]);

  const createCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormValues) => {
      // Upload image first if there's a temporary image
      let imageUrl = data.imageUrl;
      if (tempImageData) {
        const uploadedUrl = await uploadCustomerImage();
        if (!uploadedUrl) {
          throw new Error("Failed to upload customer image");
        }
        imageUrl = uploadedUrl;
      }

      return apiRequest("POST", "/api/customers", {
        ...data,
        email: data.email || undefined,
        imageUrl: imageUrl || undefined,
        currentBalance: 0,
        loyaltyPoints: 0,
        riskTag: "low",
        businessUnitId: businessUnitId || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Customer Added",
        description: "New customer has been created successfully",
      });
      form.reset();
      setTempImageData(null);
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['customers', businessUnitId] });
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
            description: `${customer.name} - Balance: ${formatCurrency(Number(customer.currentBalance) || 0)}`,
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
    [toast, formatCurrency]
  );

  const filteredCustomers = Array.isArray(customers)
    ? customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    )
    : [];

  // Edit / Delete / Suspend handlers
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    form.reset({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      barcode: c.barcode || "",
      imageUrl: c.imageUrl || "",
      creditLimit: c.creditLimit || 0,
      dueDate: c.dueDate ?? "",
      monthlyClosingDay: c.monthlyClosingDay ?? "",
    });
    setIsAddDialogOpen(true);
  };

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/customers/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', businessUnitId] }),
  });

  const confirmDelete = (id: string) => {
    setCustomerToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormValues }) => {
      let imageUrl = data.imageUrl;
      if (tempImageData) {
        const uploadedUrl = await uploadCustomerImage();
        if (!uploadedUrl) {
          throw new Error("Failed to upload customer image");
        }
        imageUrl = uploadedUrl;
      }

      return apiRequest('PATCH', `/api/customers/${id}`, {
        ...data,
        email: data.email || undefined,
        imageUrl: imageUrl || undefined,
        businessUnitId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', businessUnitId] });
      setIsAddDialogOpen(false);
      setEditingCustomer(null);
      form.reset();
      setTempImageData(null);
    },
  });

  const repayDebtMutation = useMutation({

    mutationFn: async ({ customerId, amount }: { customerId: string; amount: number }) => {

      return apiRequest('POST', `/api/customers/${customerId}/repay`, {

        amount,

        businessUnitId,

        description: "Debt Repayment",

      });

    },
    onSuccess: (_, variables) => {
      toast({
        title: "Repayment Successful",
        description: `Payment of ${formatCurrency(variables.amount)} has been recorded.`,
      });
      queryClient.invalidateQueries({ queryKey: ['customers', businessUnitId] });
      queryClient.invalidateQueries({
        queryKey: [`/api/customers/${variables.customerId}/ledger?businessUnitId=${businessUnitId}`],
      });
      setRepaymentCustomer(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Repayment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingCustomer(null); // Clear edit state on close
        }}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingCustomer(null);
                form.reset({
                  name: "",
                  phone: "",
                  email: "",
                  barcode: "",
                  imageUrl: "",
                  creditLimit: 0,
                  dueDate: "",
                  monthlyClosingDay: "",
                });
              }}
              data-testid="button-add-customer"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <>
              <DialogHeader>
                <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => {
                    if (editingCustomer) {
                      updateCustomerMutation.mutate({ id: editingCustomer.id, data });
                    } else {
                      createCustomerMutation.mutate(data);
                    }
                  })}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
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
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/image.png" {...field} data-testid="input-customer-image-url" />
                        </FormControl>
                        <FormMessage />
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <Button type="button" onClick={() => startCamera()} data-testid="button-take-photo" disabled={isUploadingImage}>
                              Take Photo
                            </Button>
                            {(tempImageData || field.value) && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setTempImageData(null);
                                  form.setValue('imageUrl', '', { shouldValidate: true, shouldDirty: true });
                                }}
                              >
                                Remove Photo
                              </Button>
                            )}
                          </div>
                          {(tempImageData || field.value) && (
                            <div className="mt-2">
                              <img src={tempImageData || field.value} alt="preview" className="max-h-40 object-contain border" />
                              {tempImageData && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Image will be uploaded when you save the customer.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Limit</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="500" {...field} data-testid="input-customer-credit-limit" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="monthlyClosingDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Closing Day</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={31} placeholder="25" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-1 md:col-span-2 sticky bottom-0 bg-white/80 backdrop-blur-sm py-3 flex gap-2 justify-end border-t">
                    <Button
                      type="submit"
                      className="flex-1 md:flex-none"
                      disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending || isUploadingImage}
                      data-testid="button-submit-customer"
                    >
                      {isUploadingImage
                        ? "Uploading Image..."
                        : (editingCustomer
                          ? (updateCustomerMutation.isPending ? "Updating..." : "Update Customer")
                          : (createCustomerMutation.isPending ? "Adding..." : "Add Customer")
                        )
                      }
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { form.reset(); setTempImageData(null); setIsAddDialogOpen(false); }}>Cancel</Button>
                  </div>
                </form>
              </Form>
            </>
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
                    <TableHead className="pl-4">Image</TableHead>
                    <TableHead>Customer</TableHead>
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
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`} onClick={() => setProfileCustomer(customer)} className="cursor-pointer">
                        <TableCell className="pl-4">
                          {customer.imageUrl ? (
                            <img src={customer.imageUrl} alt={customer.name} className="w-10 h-10 object-cover rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone || customer.email || "-"}</p>
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
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRepaymentCustomer(customer)}
                              disabled={customer.currentBalance <= 0}
                              data-testid={`button-repay-${customer.id}`}
                            >
                              <Banknote className="w-4 h-4 mr-1" />
                              Repay
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(customer)} data-testid={`button-edit-${customer.id}`}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => confirmDelete(customer.id)} data-testid={`button-delete-${customer.id}`}>
                              Delete
                            </Button>
                          </div>
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

      {/* Repayment Dialog */}
      <Dialog open={!!repaymentCustomer} onOpenChange={(isOpen) => !isOpen && setRepaymentCustomer(null)}>
        <RepaymentDialogContent
          customer={repaymentCustomer}
          onClose={() => setRepaymentCustomer(null)}
          onSubmit={(values) => {
            if (repaymentCustomer) {
              repayDebtMutation.mutate({
                customerId: repaymentCustomer.id,
                amount: values.amount,
              });
            }
          }}
          isSubmitting={repayDebtMutation.isPending}
          formatCurrency={formatCurrency}
        />
      </Dialog>

      {/* Profile Sheet */}
      <Sheet open={!!profileCustomer} onOpenChange={(isOpen) => !isOpen && setProfileCustomer(null)}>
        <CustomerProfileSheetContent
          customer={profileCustomer}
          formatCurrency={formatCurrency}
          onClose={() => setProfileCustomer(null)}
        />
      </Sheet>

      <Dialog open={cameraModalOpen} onOpenChange={(open) => { if (!open) stopCamera(); setCameraModalOpen(open); }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto grid gap-4">
          <DialogHeader>
            <DialogTitle>Take Customer Photo</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">Position the customer and capture a clear photo.</div>
          {cameraError && (
            <div className="text-sm text-destructive mt-2">{cameraError}</div>
          )}
          <div className="mt-2 grid gap-3">
            <div className="flex items-center gap-2 mb-2">
              {devices.length > 0 && (
                <div className="w-48">
                  <Select onValueChange={(v) => setSelectedDeviceId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((d) => (
                        <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <video ref={videoRef} className="w-full max-h-60 object-contain bg-black" playsInline muted />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { stopCamera(); }}>Stop</Button>
              <Button type="button" onClick={captureCustomerPhoto} data-testid="button-capture-customer">Capture</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer and all their transaction history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (customerToDelete) {
                  deleteCustomerMutation.mutate(customerToDelete);
                }
                setDeleteConfirmOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper component for the Repayment Dialog content
function RepaymentDialogContent({
  customer,
  onClose,
  onSubmit,
  isSubmitting,
  formatCurrency,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSubmit: (values: RepaymentFormValues) => void;
  isSubmitting: boolean;
  formatCurrency: (amount: number) => string;
}) {
  const repaymentForm = useForm<RepaymentFormValues>({
    resolver: zodResolver(repaymentFormSchema),
    defaultValues: { amount: 0 },
  });

  useEffect(() => {
    if (customer) {
      repaymentForm.reset({ amount: customer.currentBalance });
    }
  }, [customer, repaymentForm]);

  if (!customer) return null;

  const handleSubmit = (values: RepaymentFormValues) => {
    if (values.amount > customer.currentBalance) {
      repaymentForm.setError("amount", {
        type: "manual",
        message: "Repayment cannot exceed the current balance.",
      });
      return;
    }
    onSubmit(values);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Record Repayment for {customer.name}</DialogTitle>
      </DialogHeader>
      <div className="text-sm text-muted-foreground">
        Current Balance:{" "}
        <span className="font-bold text-amber-600">
          {formatCurrency(customer.currentBalance)}
        </span>
      </div>
      <Form {...repaymentForm}>
        <form onSubmit={repaymentForm.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={repaymentForm.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repayment Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Payment"}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}

function CustomerProfileSheetContent({
  customer,
  onClose,
  formatCurrency,
}: {
  customer: Customer | null;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
}) {
  if (!customer) return null;

  const { businessUnit } = useBusinessMode();
  const businessUnitId = businessUnit;

  const { data: ledgerEntries, isLoading: ledgerLoading } = useQuery<CreditLedger[]>({
    queryKey: [`/api/customers/${customer.id}/ledger?businessUnitId=${businessUnitId}`],
    enabled: !!customer.id && !!businessUnitId,
  });

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Customer Profile</SheetTitle>
        <SheetDescription>
          Viewing details and transaction history for {customer.name}.
        </SheetDescription>
      </SheetHeader>
      <div className="py-6 space-y-4">
        {/* Customer Info */}
        <div className="flex items-start gap-4">
          {customer.imageUrl ? (
            <img src={customer.imageUrl} alt={customer.name} className="w-20 h-20 object-cover rounded-lg border" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
              <User className="w-10 h-10 text-muted-foreground" />
            </div>
          )}
          <div className="space-y-1">
            <h3 className="text-xl font-semibold">{customer.name}</h3>
            {customer.phone && <p className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="w-4 h-4" /> {customer.phone}</p>}
            {customer.email && <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="w-4 h-4" /> {customer.email}</p>}
            {customer.barcode && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {customer.barcode}
                </Badge>
              </p>
            )}
          </div>
        </div>

        {/* Balance Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${customer.currentBalance > 0 ? "text-amber-600" : "text-foreground"}`}>
              {formatCurrency(customer.currentBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Credit Limit: {formatCurrency(customer.creditLimit)}
            </p>
          </CardContent>
        </Card>

        {/* Transaction Summary */}
        {ledgerEntries && ledgerEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Transaction Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Buying</p>
                <p className="text-lg font-bold text-amber-600">
                  {formatCurrency(ledgerEntries.filter(e => e.type === "sale").reduce((sum, e) => sum + e.amount, 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Repayment</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(ledgerEntries.filter(e => e.type === "repayment").reduce((sum, e) => sum + e.amount, 0))}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ledger History */}
        <div>
          <h4 className="font-medium mb-2">Transaction History</h4>
          <Card>
            <CardContent className="p-0">
              {ledgerLoading ? (
                <div className="p-4 text-center">Loading history...</div>
              ) : ledgerEntries && ledgerEntries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries.map((entry) => {
                      const isCharge = entry.type === "sale";
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs">{formatDate(entry.timestamp)}</TableCell>
                          <TableCell>
                            <Badge variant={isCharge ? "outline" : "default"}>
                              {isCharge ? "Sale" : "Repayment"}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${isCharge ? "text-amber-600" : "text-emerald-600"}`}>
                            {formatCurrency(entry.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No transactions found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <SheetFooter>
        <Button onClick={onClose} variant="outline">Close</Button>
      </SheetFooter>
    </SheetContent>
  );
}