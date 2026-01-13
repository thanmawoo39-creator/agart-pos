import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent } from '@/components/ui/card';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { Store, Utensils, Pill, Shirt, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api-config';

const StoreSwitcher = () => {
  const { businessUnit, setBusinessUnit } = useBusinessMode();

  const { data: businessUnits = [] } = useQuery<any[]>({
    queryKey: ['/api/business-units'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/business-units`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch business units');
      return res.json();
    },
  });

  const getStoreConfig = (type: string) => {
    const normalized = typeof type === 'string' ? type.toLowerCase() : '';
    switch (normalized) {
      case 'grocery':
        return {
          icon: Store,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'restaurant':
        return {
          icon: Utensils,
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 dark:hover:bg-orange-900',
          borderColor: 'border-orange-200 dark:border-orange-800'
        };
      case 'pharmacy':
        return {
          icon: Pill,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900',
          borderColor: 'border-blue-200 dark:border-blue-800'
        };
      case 'electronics':
        return {
          icon: Zap,
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900',
          borderColor: 'border-purple-200 dark:border-purple-800'
        };
      case 'clothing':
        return {
          icon: Shirt,
          color: 'text-pink-600 dark:text-pink-400',
          bgColor: 'bg-pink-50 dark:bg-pink-950 hover:bg-pink-100 dark:hover:bg-pink-900',
          borderColor: 'border-pink-200 dark:border-pink-800'
        };
      default:
        return {
          icon: Store,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900',
          borderColor: 'border-gray-200 dark:border-gray-800'
        };
    }
  };

  const currentStore = businessUnits.find((u) => u.id === businessUnit) || businessUnits[0];
  const currentConfig = currentStore ? getStoreConfig(currentStore.type) : null;

  return (
    <Card className="border-2 shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Current Store Display */}
          <div className="flex items-center gap-3">
            {currentStore && currentConfig && (
              <>
                <div className={`p-2 rounded-lg ${currentConfig.bgColor} ${currentConfig.borderColor} border-2`}>
                  <currentConfig.icon className={`w-5 h-5 ${currentConfig.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg leading-tight">{currentStore.name}</h3>
                  <p className="text-sm text-muted-foreground">Current Store</p>
                </div>
              </>
            )}
          </div>

          {/* Store Toggle Group */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Switch Store</p>
            <ToggleGroup
              type="single"
              value={businessUnit || ''}
              onValueChange={(value: string | undefined) => value && setBusinessUnit(value)}
              className="flex flex-col gap-1"
              variant="outline"
            >
              {businessUnits.map((unit) => {
                const cfg = getStoreConfig(unit.type);
                const Icon = cfg.icon;
                const isActive = businessUnit === unit.id;
                return (
                  <ToggleGroupItem
                    key={unit.id}
                    value={unit.id}
                    className={cn(
                      "justify-start gap-3 h-12 px-3 transition-all duration-200",
                      // Premium active state (consistent across stores)
                      "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary",
                      "data-[state=on]:ring-2 data-[state=on]:ring-primary/40 data-[state=on]:ring-offset-2",
                      "data-[state=on]:shadow-lg data-[state=on]:shadow-primary/30 data-[state=on]:scale-[1.02]",
                      // Inactive/hover keeps store-specific tint
                      cn(cfg.bgColor, cfg.borderColor, "border-2 border-transparent"),
                      "hover:" + cfg.bgColor,
                      "hover:border-transparent"
                    )}
                  >
                    <Icon
                      className={cn("w-4 h-4", isActive ? "text-primary-foreground" : cfg.color)}
                      strokeWidth={isActive ? 2.75 : 2}
                    />
                    <span className={cn("font-medium", isActive ? "text-primary-foreground font-semibold" : cfg.color)}>
                      {unit.name}
                    </span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StoreSwitcher;
