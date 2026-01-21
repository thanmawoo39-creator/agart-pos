import React, { useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Store, ShoppingCart, Package, FileText, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';

interface MobileWrapperProps {
  children: ReactNode;
  cartContent?: ReactNode;
  showCart?: boolean;
  cartItemCount?: number;
  cartTotal?: number;
}

/**
 * MobileWrapper - Responsive layout component for POS system
 *
 * Mobile (< md): Single column with collapsible bottom sheet for cart
 * Tablet (>= md): Two-column layout (60% main / 40% cart)
 */
export function MobileWrapper({
  children,
  cartContent,
  showCart = false,
  cartItemCount = 0,
  cartTotal = 0,
}: MobileWrapperProps) {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Close cart sheet when switching to tablet view
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsCartOpen(false);
        setIsFullScreen(false);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Prevent body scroll when cart is open on mobile
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen]);

  const { formatCurrency } = useCurrency();
  const formatPrice = (price: number) => formatCurrency(price);

  return (
    <div className="flex flex-col h-full">
      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* Primary Content - Full width on mobile, 60% on tablet+ */}
        <div className={cn(
          "flex-1 overflow-auto",
          "pb-safe", // Safe area for bottom
          showCart && "md:w-[60%] md:flex-none"
        )}>
          {/* Add bottom padding on mobile when cart button is visible */}
          <div className={cn(
            showCart && cartItemCount > 0 && "pb-20 md:pb-0"
          )}>
            {children}
          </div>
        </div>

        {/* Cart Panel - Hidden on mobile, visible on tablet+ */}
        {showCart && (
          <div className="hidden md:flex md:w-[40%] md:flex-none md:border-l md:border-border md:bg-background md:overflow-auto">
            {cartContent}
          </div>
        )}
      </div>

      {/* Mobile Cart Bottom Sheet */}
      {showCart && (
        <>
          {/* Floating Cart Button - Mobile Only */}
          {cartItemCount > 0 && !isCartOpen && (
            <div className="fixed bottom-0 left-0 right-0 md:hidden z-40 pb-safe">
              <div className="bg-background border-t border-border shadow-lg">
                <Button
                  onClick={() => setIsCartOpen(true)}
                  className="w-full h-16 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-between px-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ShoppingCart className="w-6 h-6" />
                      <span className="absolute -top-2 -right-2 bg-white text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {cartItemCount}
                      </span>
                    </div>
                    <span className="font-semibold">View Cart</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{formatPrice(cartTotal)}</span>
                    <ChevronUp className="w-5 h-5" />
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* Cart Bottom Sheet Overlay */}
          {isCartOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
              onClick={() => {
                setIsCartOpen(false);
                setIsFullScreen(false);
              }}
            />
          )}

          {/* Cart Bottom Sheet Content */}
          <div
            className={cn(
              "fixed left-0 right-0 bg-background z-50 md:hidden transition-all duration-300 ease-out rounded-t-2xl shadow-2xl",
              isCartOpen ? "bottom-0" : "-bottom-full",
              isFullScreen ? "top-0 rounded-none" : "top-[15%]"
            )}
          >
            {/* Sheet Handle */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div
                className="flex-1 flex justify-center cursor-grab"
                onClick={() => setIsFullScreen(!isFullScreen)}
              >
                <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsFullScreen(false);
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Cart Content */}
            <div className="overflow-auto h-full pb-safe">
              {cartContent}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * BottomNavigation - Mobile navigation bar
 * Shows on mobile, hidden on tablet+
 */
export function BottomNavigation() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: '/', icon: Store, label: 'Store' },
    { path: '/sales', icon: ShoppingCart, label: 'Sales' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/api/docs', icon: FileText, label: 'Docs', external: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden z-30 bg-background border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;

          if (item.external) {
            return (
              <a
                key={item.path}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full min-h-[48px] transition-colors",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </a>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-h-[48px] transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-1", isActive && "text-primary")} />
              <span className={cn(
                "text-xs font-medium",
                isActive && "text-primary"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * ResponsiveModal - 95% height on mobile, centered popup on tablet+
 * Used for payment verification and other important modals
 */
interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** When true, modal takes 95% of screen height on mobile */
  fullHeight?: boolean;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  children,
  className,
  fullHeight = true,
}: ResponsiveModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal Content */}
      <div
        className={cn(
          "fixed z-50 bg-background overflow-hidden flex flex-col",
          "animate-in slide-in-from-bottom duration-300",
          // Mobile: 95% height from bottom with rounded top corners
          fullHeight
            ? "inset-x-0 bottom-0 top-[5%] rounded-t-2xl"
            : "inset-x-2 bottom-2 top-[10%] rounded-2xl",
          // Tablet+: Centered popup with max dimensions
          "md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
          "md:w-full md:max-w-lg md:h-auto md:max-h-[85vh] md:rounded-xl md:shadow-2xl",
          className
        )}
      >
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b bg-background">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 min-h-[48px] min-w-[48px] -mr-2"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-auto p-4 pb-safe scroll-touch">
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * SafeAreaView - Wrapper that adds safe area insets
 */
interface SafeAreaViewProps {
  children: ReactNode;
  className?: string;
}

export function SafeAreaView({ children, className }: SafeAreaViewProps) {
  return (
    <div className={cn("pt-safe pb-safe pl-safe pr-safe", className)}>
      {children}
    </div>
  );
}

/**
 * TouchButton - Touch-friendly button with minimum 48px hit target
 */
interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: ReactNode;
}

export function TouchButton({
  variant = 'default',
  size = 'default',
  className,
  children,
  ...props
}: TouchButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn(
        "min-h-[48px] min-w-[48px]",
        size === 'lg' && "h-14",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export default MobileWrapper;
