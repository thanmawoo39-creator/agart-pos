import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Store, Utensils, MapPin, Phone, CheckCircle, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { useLocation } from 'wouter';

interface BusinessUnit {
  id: string;
  name: string;
  type: 'grocery' | 'restaurant' | 'pharmacy' | 'electronics' | 'clothing' | 'Grocery' | 'Restaurant' | 'Pharmacy' | 'Electronics' | 'Clothing';
  settings?: string;
  isActive: 'true' | 'false';
  createdAt: string;
  updatedAt: string;
}

interface StoreCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const StoreCreationWizard: React.FC<StoreCreationWizardProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [storeType, setStoreType] = useState<'grocery' | 'restaurant'>('grocery');
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    phone: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { setBusinessUnit } = useBusinessMode();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createStoreMutation = useMutation({
    mutationFn: async (newStore: Omit<BusinessUnit, 'id' | 'createdAt' | 'updatedAt'>) => {
      const response = await fetch(`${API_BASE_URL}/api/business-units`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newStore),
      });
      if (!response.ok) throw new Error('Failed to create business unit');
      return response.json();
    },
    onSuccess: async (createdStore) => {
      // Step 4: 'Boom' - Scaffold sample data
      await scaffoldSampleData(createdStore.id, storeType);

      // Show success animation
      setShowSuccess(true);

      // Update header switcher immediately
      queryClient.invalidateQueries({ queryKey: ['/api/business-units'] });

      // Switch to new store context after a delay
      setTimeout(() => {
        setBusinessUnit(createdStore.id);
        toast({
          title: '🎉 Store Created Successfully!',
          description: `${createdStore.name} is ready with sample data.`,
        });
        setLocation('/');
        onClose();
        resetWizard();
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create store: ${error.message}`,
        variant: 'destructive',
      });
      setIsCreating(false);
    },
  });

  const scaffoldSampleData = async (storeId: string, type: 'grocery' | 'restaurant') => {
    try {
      if (type === 'grocery') {
        // Create sample categories for Grocery
        const categories = [
          { name: 'Fruits & Vegetables', businessUnitId: storeId },
          { name: 'Dairy Products', businessUnitId: storeId },
          { name: 'Bakery Items', businessUnitId: storeId },
          { name: 'Beverages', businessUnitId: storeId }
        ];

        for (const category of categories) {
          await fetch(`${API_BASE_URL}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(category)
          });
        }

        // Create sample products for Grocery
        const products = [
          { name: 'Fresh Apples', price: 2.99, stock: 50, category: 'Fruits & Vegetables', businessUnitId: storeId, barcode: '1234567890' },
          { name: 'Milk 1L', price: 3.49, stock: 30, category: 'Dairy Products', businessUnitId: storeId, barcode: '1234567891' },
          { name: 'Bread', price: 2.99, stock: 25, category: 'Bakery Items', businessUnitId: storeId, barcode: '1234567892' },
          { name: 'Orange Juice', price: 4.99, stock: 20, category: 'Beverages', businessUnitId: storeId, barcode: '1234567893' }
        ];

        for (const product of products) {
          await fetch(`${API_BASE_URL}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(product)
          });
        }
      } else {
        // Create sample tables for Restaurant
        const tables = [
          { name: 'Table 1', capacity: 4, status: 'available', businessUnitId: storeId },
          { name: 'Table 2', capacity: 2, status: 'available', businessUnitId: storeId },
          { name: 'Table 3', capacity: 6, status: 'available', businessUnitId: storeId },
          { name: 'Table 4', capacity: 4, status: 'available', businessUnitId: storeId }
        ];

        for (const table of tables) {
          await fetch(`${API_BASE_URL}/api/tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(table)
          });
        }

        // Create sample menu categories for Restaurant
        const categories = [
          { name: 'Appetizers', businessUnitId: storeId },
          { name: 'Main Courses', businessUnitId: storeId },
          { name: 'Desserts', businessUnitId: storeId },
          { name: 'Beverages', businessUnitId: storeId }
        ];

        for (const category of categories) {
          await fetch(`${API_BASE_URL}/api/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(category)
          });
        }

        // Create sample menu items for Restaurant
        const products = [
          { name: 'Caesar Salad', price: 8.99, stock: 100, category: 'Appetizers', businessUnitId: storeId, barcode: '9876543210' },
          { name: 'Grilled Chicken', price: 15.99, stock: 100, category: 'Main Courses', businessUnitId: storeId, barcode: '9876543211' },
          { name: 'Chocolate Cake', price: 6.99, stock: 100, category: 'Desserts', businessUnitId: storeId, barcode: '9876543212' },
          { name: 'Coffee', price: 3.99, stock: 100, category: 'Beverages', businessUnitId: storeId, barcode: '9876543213' }
        ];

        for (const product of products) {
          await fetch(`${API_BASE_URL}/api/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(product)
          });
        }
      }
    } catch (error) {
      console.error('Failed to scaffold sample data:', error);
      // Don't throw error - store creation should still succeed
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setStoreType('grocery');
    setFormData({ name: '', location: '', phone: '' });
    setIsCreating(false);
    setShowSuccess(false);
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateStore = () => {
    setIsCreating(true);
    createStoreMutation.mutate({
      name: formData.name,
      type: storeType,
      settings: JSON.stringify({ location: formData.location, phone: formData.phone }),
      isActive: 'true'
    });
  };

  const progress = (currentStep / 4) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center py-8">
            <div className="mb-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Create Your New Store</h2>
              <p className="text-muted-foreground">Let's set up your business in just a few clicks</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <span>Step 1 of 4</span>
                <ArrowRight className="w-4 h-4" />
                <span>Get Started</span>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="py-8">
            <h2 className="text-2xl font-bold text-center mb-6">Choose Your Store Type</h2>
            <div className="grid grid-cols-2 gap-6">
              <Card
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${storeType === 'grocery' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                onClick={() => setStoreType('grocery')}
              >
                <CardContent className="p-6 text-center">
                  <Store className="w-16 h-16 mx-auto mb-4 text-green-600" />
                  <h3 className="font-semibold text-lg mb-2">Grocery Store</h3>
                  <p className="text-sm text-muted-foreground">Perfect for supermarkets, convenience stores, and food shops</p>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${storeType === 'restaurant' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                onClick={() => setStoreType('restaurant')}
              >
                <CardContent className="p-6 text-center">
                  <Utensils className="w-16 h-16 mx-auto mb-4 text-orange-600" />
                  <h3 className="font-semibold text-lg mb-2">Restaurant</h3>
                  <p className="text-sm text-muted-foreground">Ideal for restaurants, cafes, and food service businesses</p>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="py-8">
            <h2 className="text-2xl font-bold text-center mb-6">Store Information</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="flex items-center gap-2 mb-2">
                  <Store className="w-4 h-4" />
                  Store Name
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Street Grocery"
                  className="text-base"
                />
              </div>

              <div>
                <Label htmlFor="location" className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., 123 Main Street, City"
                  className="text-base"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +1 234 567 8900"
                  className="text-base"
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="text-center py-8">
            {showSuccess ? (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-600">Store Created Successfully!</h2>
                <p className="text-muted-foreground">Your store is ready with sample data</p>
                <div className="animate-pulse">
                  <Sparkles className="w-8 h-8 mx-auto text-primary" />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold mb-2">The "Boom" Factor</h2>
                <p className="text-muted-foreground mb-4">
                  We're now setting up your store with sample {storeType === 'grocery' ? 'products and categories' : 'tables and menu items'}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span>Creating sample data...</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75"></div>
                    <span>Configuring your store...</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150"></div>
                    <span>Almost ready...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return formData.name.trim() !== '' && formData.location.trim() !== '';
      case 4:
        return false; // This step is automatic
      default:
        return false;
    }
  };

  const handleStepAction = () => {
    switch (currentStep) {
      case 3:
        handleCreateStore();
        break;
      default:
        handleNext();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center">
            {currentStep < 4 && `Step ${currentStep} of 4`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          {currentStep < 4 && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Get Started</span>
                <span>Store Type</span>
                <span>Information</span>
                <span>Boom!</span>
              </div>
            </div>
          )}

          {/* Step Content */}
          <div className="min-h-[300px]">
            {renderStepContent()}
          </div>

          {/* Navigation Buttons */}
          {currentStep < 4 && !showSuccess && (
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={currentStep === 1 ? onClose : handlePrevious}
                disabled={isCreating}
              >
                {currentStep === 1 ? 'Cancel' : <><ArrowLeft className="w-4 h-4 mr-2" /> Back</>}
              </Button>

              <Button
                onClick={handleStepAction}
                disabled={!canProceed() || isCreating}
                className="min-w-[100px]"
              >
                {isCreating ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </div>
                ) : currentStep === 3 ? (
                  <>Create Store <ArrowRight className="w-4 h-4 ml-2" /></>
                ) : (
                  <>Next <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoreCreationWizard;
