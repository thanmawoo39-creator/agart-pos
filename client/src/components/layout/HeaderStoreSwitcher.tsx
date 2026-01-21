import React, { useState, useEffect } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { useAuth } from '@/lib/auth-context';
import { Store, Utensils, Pill, Shirt, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api-config';

interface BusinessUnit {
  id: string;
  name: string;
  type: 'grocery' | 'restaurant' | 'pharmacy' | 'electronics' | 'clothing' | 'Grocery' | 'Restaurant' | 'Pharmacy' | 'Electronics' | 'Clothing';
  settings?: string;
  isActive: 'true' | 'false';
  createdAt: string;
  updatedAt: string;
}

const HeaderStoreSwitcher = () => {
  const { businessUnit, setBusinessUnit } = useBusinessMode();
  const { isOwner, isManager } = useAuth();

  // Only show store switcher to owners and managers
  if (!isOwner && !isManager) {
    return null;
  }

  // Fetch business units from API
  const { data: businessUnits = [], isLoading } = useQuery<BusinessUnit[]>({
    queryKey: ['/api/business-units'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/business-units`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch business units');
      return response.json();
    }
  });

  // Find current business unit with fallback logic
  const activeStore = businessUnits.find(unit => unit.id === businessUnit) || businessUnits[0];

  // Get icon and color based on business unit type
  const getStoreConfig = (type: string) => {
    const normalized = typeof type === 'string' ? type.toLowerCase() : '';
    switch (normalized) {
      case 'grocery':
        return {
          icon: Store,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900',
          borderColor: 'border-green-200 dark:border-green-800',
          headerGlow: 'shadow-green-500/20'
        };
      case 'restaurant':
        return {
          icon: Utensils,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 dark:hover:bg-orange-900',
          borderColor: 'border-orange-200 dark:border-orange-800',
          headerGlow: 'shadow-orange-500/20'
        };
      case 'pharmacy':
        return {
          icon: Pill,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900',
          borderColor: 'border-blue-200 dark:border-blue-800',
          headerGlow: 'shadow-blue-500/20'
        };
      case 'electronics':
        return {
          icon: Zap,
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900',
          borderColor: 'border-purple-200 dark:border-purple-800',
          headerGlow: 'shadow-purple-500/20'
        };
      case 'clothing':
        return {
          icon: Shirt,
          color: 'text-pink-600 dark:text-pink-400',
          bgColor: 'bg-pink-50 dark:bg-pink-950 hover:bg-pink-100 dark:hover:bg-pink-900',
          borderColor: 'border-pink-200 dark:border-pink-800',
          headerGlow: 'shadow-pink-500/20'
        };
      default:
        return {
          icon: Store,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900',
          borderColor: 'border-gray-200 dark:border-gray-800',
          headerGlow: 'shadow-gray-500/20'
        };
    }
  };

  // Apply visual sync to header
  React.useEffect(() => {
    const header = document.querySelector('header');
    if (header && activeStore) {
      const config = getStoreConfig(activeStore.type);
      // Remove all store-specific classes
      header.classList.remove('shadow-green-500/20', 'shadow-orange-500/20', 'shadow-blue-500/20', 'shadow-purple-500/20', 'shadow-pink-500/20', 'shadow-gray-500/20');
      // Add current store's glow effect
      header.classList.add(config.headerGlow);
    }
  }, [businessUnit, businessUnits]);

  // Auto-select first store if no store is selected or current ID is invalid
  React.useEffect(() => {
    if (businessUnits.length > 0) {
      const currentStore = businessUnits.find(unit => unit.id === businessUnit);
      if (!currentStore || !businessUnit) {
        // Fallback to first active store, or first store if no active ones
        const fallbackStore = businessUnits.find(unit => unit.isActive === 'true') || businessUnits[0];
        console.log('Auto-selecting fallback store:', fallbackStore.name);
        setBusinessUnit(fallbackStore.id);
      }
    }
  }, [businessUnit, businessUnits, setBusinessUnit]);

  // Auto-trigger store creation if no stores exist
  React.useEffect(() => {
    if (!isLoading && businessUnits.length === 0) {
      console.log('No stores found, user should create a store');
      // Could trigger a modal or redirect to settings
    }
  }, [isLoading, businessUnits]);

  if (isLoading) {
    return <div className="animate-pulse">Loading stores...</div>;
  }

  if (businessUnits.length === 0) {
    return <div className="text-sm text-gray-500">No stores available</div>;
  }

  return (
    <div className="flex items-center gap-1">
      <ToggleGroup
        type="single"
        value={businessUnit || ''}
        onValueChange={(value) => value && setBusinessUnit(value)}
        className="flex gap-1 h-9"
      >
        {businessUnits.map((unit) => {
          const config = getStoreConfig(unit.type);
          const Icon = config.icon;
          const isActive = businessUnit === unit.id;
          return (
            <ToggleGroupItem
              key={unit.id}
              value={unit.id}
              className={cn(
                'flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-2 text-xs md:text-sm font-medium rounded-lg border-2 transition-all duration-300 cursor-pointer h-8 md:h-9',
                'hover:scale-[1.02] active:scale-[0.98]',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/40 ring-offset-1 shadow-lg shadow-primary/30'
                  : cn(config.bgColor, 'border-transparent opacity-70 hover:opacity-100')
              )}
            >
              <Icon
                className={cn('h-3.5 w-3.5 md:h-[18px] md:w-[18px] transition-all', isActive ? 'text-primary-foreground' : config.color)}
                strokeWidth={isActive ? 2.75 : 2}
              />
              <span className={cn(
                'transition-all truncate max-w-[80px] md:max-w-none',
                isActive ? 'text-primary-foreground font-semibold' : cn(config.color, 'font-medium')
              )}>
                {unit.name}
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
};

export default HeaderStoreSwitcher;
