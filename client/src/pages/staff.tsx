import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Plus, Pencil, Trash2, Users, Shield, UserCog, User, UserX, UserCheck } from "lucide-react";
import type { Staff, StaffRole, StaffStatus } from "@shared/schema";

type StaffWithoutPin = Omit<Staff, "pin">;

const roleIcons: Record<StaffRole, typeof Shield> = {
  owner: Shield,
  manager: UserCog,
  cashier: User,
};

const roleColors: Record<StaffRole, string> = {
  owner: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  manager: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cashier: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export default function StaffPage() {
  const { isOwner } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffWithoutPin | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    pin: "",
    role: "cashier" as StaffRole,
    barcode: "",
    status: "active" as StaffStatus,
  });

  const { data: staff = [], isLoading } = useQuery<StaffWithoutPin[]>({
    queryKey: ["/api/staff"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", "/api/staff", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create staff member", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      apiRequest("PATCH", `/api/staff/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update staff member", variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/staff/${id}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member suspended" });
    },
    onError: () => {
      toast({ title: "Failed to suspend staff member", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/staff/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member activated" });
    },
    onError: () => {
      toast({ title: "Failed to activate staff member", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member deleted" });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete staff member", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setEditingStaff(null);
    setFormData({ name: "", pin: "", role: "cashier", barcode: "", status: "active" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStaff) {
      const updates: Partial<typeof formData> = {
        name: formData.name,
        role: formData.role,
        barcode: formData.barcode || undefined,
      };
      if (formData.pin) {
        updates.pin = formData.pin;
      }
      updateMutation.mutate({ id: editingStaff.id, data: updates });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (member: StaffWithoutPin) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      pin: "",
      role: member.role,
      barcode: member.barcode || "",
      status: member.status,
    });
    setIsDialogOpen(true);
  };

  const handleToggleStatus = (member: StaffWithoutPin) => {
    if (member.status === "active") {
      suspendMutation.mutate(member.id);
    } else {
      activateMutation.mutate(member.id);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <Shield className="h-12 w-12 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold">Access Denied</h2>
                <p className="text-sm text-muted-foreground">
                  Only owners can manage staff members.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Staff Management</h1>
          <p className="text-sm text-muted-foreground">Manage staff members and their access levels</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-staff">
          <Plus className="mr-2 h-4 w-4" />
          Create New Staff
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Staff Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">No staff members</h3>
                <p className="text-sm text-muted-foreground">
                  Add your first staff member to get started
                </p>
              </div>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Staff
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Name</TableHead>
                    <TableHead className="min-w-[100px]">Role</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[100px]">Barcode</TableHead>
                    <TableHead className="text-right min-w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => {
                    const RoleIcon = roleIcons[member.role];
                    const isSuspended = member.status === "suspended";
                    return (
                      <TableRow key={member.id} data-testid={`row-staff-${member.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium shrink-0">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{member.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleColors[member.role]}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            <span className="capitalize">{member.role}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isSuspended ? (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
                              Suspended
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.barcode ? (
                            <span className="text-sm text-muted-foreground font-mono">
                              {member.barcode}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(member)}
                              data-testid={`button-edit-staff-${member.id}`}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant={isSuspended ? "outline" : "secondary"}
                              onClick={() => handleToggleStatus(member)}
                              disabled={suspendMutation.isPending || activateMutation.isPending}
                              data-testid={`button-toggle-status-${member.id}`}
                            >
                              {isSuspended ? (
                                <>
                                  <UserCheck className="h-4 w-4 mr-1" />
                                  Activate
                                </>
                              ) : (
                                <>
                                  <UserX className="h-4 w-4 mr-1" />
                                  Suspend
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteConfirmId(member.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-staff-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStaff ? "Edit Staff Member" : "Create New Staff"}
            </DialogTitle>
            <DialogDescription>
              {editingStaff
                ? "Update staff member details. Leave PIN empty to keep existing."
                : "Create a new staff member with their role and PIN."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                required
                data-testid="input-staff-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: StaffRole) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger data-testid="select-staff-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner (Full Access)</SelectItem>
                  <SelectItem value="manager">Manager (Limited Admin)</SelectItem>
                  <SelectItem value="cashier">Cashier (Sales Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">
                {editingStaff ? "New PIN (leave empty to keep current)" : "PIN (4 digits)"}
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={formData.pin}
                onChange={(e) =>
                  setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })
                }
                placeholder="4-digit PIN"
                required={!editingStaff}
                data-testid="input-staff-pin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode ID (optional)</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Staff barcode for quick login"
                data-testid="input-staff-barcode"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-staff"
              >
                {editingStaff ? "Update Staff" : "Create Staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this staff member? This action cannot be undone.
              Their name will remain on any past sales records for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
