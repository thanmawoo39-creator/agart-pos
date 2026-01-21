
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context"; // Actually we might need a separate context or reuse this if generic
// Assuming useAuth handles staff primarily. For customer, we used session cookies.
// Ideally useAuth should be aware of 'role: customer'.
// If not, we fetch profile directly here.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogOut, Trash2, User, ShoppingBag, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";

export default function CustomerProfile() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch Profile
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['/api/customer/profile'],
    retry: false,
    queryFn: async () => {
      const res = await fetch('/api/customer/profile');
      if (!res.ok) throw new Error('Not logged in');
      return res.json();
    }
  });

  // Fetch Orders
  const { data: orders } = useQuery({
    queryKey: ['/api/customer/orders'],
    enabled: !!profile,
    queryFn: async () => {
      const res = await fetch('/api/customer/orders');
      if (!res.ok) throw new Error('Failed to fetch orders');
      return res.json();
    }
  });

  // Logout Mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/customer/logout', { method: 'POST' });
    },
    onSuccess: () => {
      setLocation('/lunch-menu'); // Redirect to menu
    }
  });

  // Delete Account Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/customer/account', { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({ title: 'Account Deleted', description: 'Your data has been anonymized. Goodbye!' });
      setLocation('/lunch-menu');
    }
  });

  // Update Profile Mutation
  const updateMutation = useMutation({
    mutationFn: async (name: string) => {
      await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer/profile'] });
      toast({ title: 'Updated', description: 'Profile updated successfully' });
    }
  });

  const [editName, setEditName] = useState('');

  // Protect Route
  if (error) {
    setLocation('/lunch-menu'); // or login
    return null;
  }

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800">My Account</h1>
        <Button variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sidebar / Profile Card */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-2">
                <User className="h-10 w-10 text-orange-600" />
              </div>
              <CardTitle>{profile?.name}</CardTitle>
              <CardDescription>{profile?.phone}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <div className="flex gap-2">
                  <Input
                    defaultValue={profile?.name}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your Name"
                  />
                  <Button size="sm" onClick={() => updateMutation.mutate(editName || profile.name)}>Save</Button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Member Since</h4>
                <p className="text-sm">{new Date(profile?.joinedAt).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-100">
            <CardHeader>
              <CardTitle className="text-red-600 text-lg">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will anonymize your personal data and remove your access to this account.
                      Past order records will be kept for financial reporting.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-red-600 hover:bg-red-700">
                      Yes, Delete My Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>

        {/* Main Content / Orders */}
        <div className="md:col-span-2">
          <Tabs defaultValue="orders">
            <TabsList className="w-full">
              <TabsTrigger value="orders" className="flex-1">Order History</TabsTrigger>
              {/* <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger> */}
            </TabsList>

            <TabsContent value="orders" className="mt-4">
              {orders?.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <ShoppingBag className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                  <h3 className="text-lg font-medium text-slate-600">No orders yet</h3>
                  <Button variant="ghost" onClick={() => setLocation('/lunch-menu')}>Start Ordering</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders?.map((order: any) => (
                    <Card key={order.id} className="overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
                        <div className="text-sm font-medium text-slate-600">
                          {new Date(order.timestamp).toLocaleDateString()} at {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded-full uppercase
                                        ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'}`}>
                          {order.status}
                        </div>
                      </div>
                      <CardContent className="p-4 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Items</p>
                          <div className="text-sm font-medium">
                            {/* Order items not joined here for MVP simplicity, assume summary or fetch detail? 
                                                Actually route returns sales record. We usually don't join items in list view unless queried.
                                                Let's just show Total for now.
                                            */}
                            Order #{order.id.slice(0, 8)}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total</p>
                          <div className="text-lg font-bold text-orange-600">
                            {order.total.toLocaleString()} ฿
                          </div>
                        </div>
                        {order.deliveryAddress && (
                          <div className="col-span-2 text-xs text-slate-500 border-t pt-2 mt-1">
                            <MapPin className="inline h-3 w-3 mr-1" />
                            {order.deliveryAddress}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
