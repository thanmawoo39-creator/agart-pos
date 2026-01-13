import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';
import StoreCreationWizard from '@/components/StoreCreationWizard';

interface BusinessUnit {
  id: string;
  name: string;
  type: 'grocery' | 'restaurant' | 'pharmacy' | 'electronics' | 'clothing' | 'Grocery' | 'Restaurant' | 'Pharmacy' | 'Electronics' | 'Clothing';
  settings?: string;
  isActive: 'true' | 'false';
  createdAt: string;
  updatedAt: string;
}

interface StoreSettings {
  location?: string;
  phone?: string;
  taxId?: string;
  logoUrl?: string;
}

const StoresSettings = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<BusinessUnit | null>(null);
  const [editSettings, setEditSettings] = useState<StoreSettings>({});

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: businessUnits = [], isLoading, refetch } = useQuery<BusinessUnit[]>({
    queryKey: ['/api/business-units'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/business-units`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch business units');
      return response.json();
    }
  });

  const updateStoreMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BusinessUnit> & { id: string }) => {
      const response = await fetch(`${API_BASE_URL}/api/business-units/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update business unit');
      return response.json();
    },
    onSuccess: () => {
      setEditingStore(null);
      setEditSettings({});
      refetch();
      toast({
        title: 'Store Updated',
        description: 'Business unit has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update store: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const deleteStoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/business-units/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete business unit');
      return response.json();
    },
    onSuccess: () => {
      refetch();
      toast({
        title: 'Store Deleted',
        description: 'Business unit has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete store: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (store: BusinessUnit) => {
    setEditingStore(store);
    // Parse existing settings
    try {
      const settings = store.settings ? JSON.parse(store.settings) : {};
      setEditSettings(settings);
    } catch (error) {
      setEditSettings({});
    }
  };

  const handleSaveSettings = () => {
    if (!editingStore) return;

    const updatedSettings = JSON.stringify(editSettings);
    updateStoreMutation.mutate({
      id: editingStore.id,
      settings: updatedSettings,
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this business unit? This action cannot be undone.')) {
      deleteStoreMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Store Management</h1>
        <Button
          onClick={() => setIsWizardOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New Store
        </Button>
      </div>

      {/* Store Creation Wizard */}
      <StoreCreationWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />

      {/* Stores List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {businessUnits.map((store) => (
          <Card key={store.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{store.name}</CardTitle>
                  <Badge variant={store.isActive === 'true' ? 'default' : 'secondary'}>
                    {store.isActive === 'true' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(store)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(store.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Type:</span>
                  <span className="font-medium">{store.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status:</span>
                  <Badge variant={store.isActive === 'true' ? 'default' : 'secondary'}>
                    {store.isActive === 'true' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Display parsed settings */}
                {store.settings && (() => {
                  try {
                    const settings = JSON.parse(store.settings);
                    return (
                      <>
                        {settings.location && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Address:</span>
                            <span className="text-sm text-right max-w-[150px] truncate">{settings.location}</span>
                          </div>
                        )}
                        {settings.phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Phone:</span>
                            <span className="text-sm">{settings.phone}</span>
                          </div>
                        )}
                        {settings.taxId && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Tax ID:</span>
                            <span className="text-sm">{settings.taxId}</span>
                          </div>
                        )}
                        {settings.logoUrl && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Logo:</span>
                            <span className="text-xs text-blue-600 truncate max-w-[100px]">Custom</span>
                          </div>
                        )}
                      </>
                    );
                  } catch (error) {
                    return (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Settings:</span>
                        <span className="text-sm font-mono bg-gray-100 p-1 rounded text-xs">
                          Invalid JSON
                        </span>
                      </div>
                    );
                  }
                })()}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Created:</span>
                  <span className="text-sm">
                    {new Date(store.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Updated:</span>
                  <span className="text-sm">
                    {new Date(store.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Store Settings Dialog */}
      <Dialog open={!!editingStore} onOpenChange={(open) => !open && setEditingStore(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Store Settings - {editingStore?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="location">Store Address</Label>
              <Textarea
                id="location"
                placeholder="Enter store address"
                value={editSettings.location || ''}
                onChange={(e) => setEditSettings(prev => ({ ...prev, location: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="Enter phone number"
                value={editSettings.phone || ''}
                onChange={(e) => setEditSettings(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxId">Tax ID</Label>
              <Input
                id="taxId"
                placeholder="Enter tax ID"
                value={editSettings.taxId || ''}
                onChange={(e) => setEditSettings(prev => ({ ...prev, taxId: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                placeholder="Enter logo URL (optional)"
                value={editSettings.logoUrl || ''}
                onChange={(e) => setEditSettings(prev => ({ ...prev, logoUrl: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStore(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={updateStoreMutation.isPending}>
              {updateStoreMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoresSettings;
