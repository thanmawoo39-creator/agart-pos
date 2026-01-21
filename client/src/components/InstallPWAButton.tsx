import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Check, Smartphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Extend Window interface for PWA functions
declare global {
  interface Window {
    deferredPrompt: BeforeInstallPromptEvent | null;
    pwaInstallReady: boolean;
    installPWA: () => Promise<{ success: boolean; outcome?: string; reason?: string }>;
    isPWAInstalled: () => boolean;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPWAButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'banner';
  showWhenInstalled?: boolean;
}

/**
 * InstallPWAButton - Shows an install button when PWA install is available
 *
 * Usage:
 * <InstallPWAButton /> - Default button style
 * <InstallPWAButton variant="banner" /> - Full-width banner style
 * <InstallPWAButton variant="outline" /> - Outline button
 */
export function InstallPWAButton({
  className,
  variant = 'default',
  showWhenInstalled = false,
}: InstallPWAButtonProps) {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    // Check if already installed
    if (typeof window !== 'undefined' && window.isPWAInstalled?.()) {
      setIsInstalled(true);
      return;
    }

    // Check if install prompt is ready
    if (typeof window !== 'undefined' && window.pwaInstallReady) {
      setCanInstall(true);
    }

    // Listen for install prompt ready event
    const handleInstallReady = () => {
      console.log('[InstallPWAButton] Install prompt is ready');
      setCanInstall(true);
    };

    // Listen for app installed event
    const handleInstalled = () => {
      console.log('[InstallPWAButton] App was installed');
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('pwaInstallReady', handleInstallReady);
    window.addEventListener('pwaInstalled', handleInstalled);

    return () => {
      window.removeEventListener('pwaInstallReady', handleInstallReady);
      window.removeEventListener('pwaInstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!window.installPWA) {
      console.error('[InstallPWAButton] installPWA function not available');
      return;
    }

    setIsInstalling(true);
    try {
      const result = await window.installPWA();
      console.log('[InstallPWAButton] Install result:', result);
      if (result.success) {
        setIsInstalled(true);
        setCanInstall(false);
      }
    } catch (error) {
      console.error('[InstallPWAButton] Install error:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  // Don't show if installed (unless showWhenInstalled is true)
  if (isInstalled && !showWhenInstalled) {
    return null;
  }

  // Don't show if can't install
  if (!canInstall && !isInstalled) {
    return null;
  }

  // Banner variant - full width dismissible banner
  if (variant === 'banner') {
    if (!showBanner || isInstalled) return null;

    return (
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-40 p-4 bg-primary text-primary-foreground",
        "md:bottom-4 md:left-4 md:right-auto md:max-w-sm md:rounded-lg md:shadow-lg",
        "animate-in slide-in-from-bottom duration-300",
        className
      )}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-white/20 rounded-lg">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Install Agart POS</h3>
            <p className="text-xs opacity-90 mt-0.5">
              Add to your home screen for quick access and offline use
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleInstall}
                disabled={isInstalling}
                size="sm"
                className="bg-white text-primary hover:bg-white/90 h-9"
              >
                {isInstalling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full mr-2" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Install App
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowBanner(false)}
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/20 h-9"
              >
                Not now
              </Button>
            </div>
          </div>
          <Button
            onClick={() => setShowBanner(false)}
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-8 w-8 text-white/60 hover:text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Installed state
  if (isInstalled) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn("gap-2", className)}
      >
        <Check className="w-4 h-4 text-green-500" />
        App Installed
      </Button>
    );
  }

  // Default/outline/ghost button variants
  return (
    <Button
      onClick={handleInstall}
      disabled={isInstalling}
      variant={variant === 'default' ? 'default' : variant}
      className={cn("gap-2 min-h-[44px]", className)}
    >
      {isInstalling ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
          Installing...
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          Install App
        </>
      )}
    </Button>
  );
}

/**
 * usePWAInstall - Hook for custom PWA install UI
 *
 * Usage:
 * const { canInstall, isInstalled, install } = usePWAInstall();
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already installed
    if (window.isPWAInstalled?.()) {
      setIsInstalled(true);
      return;
    }

    // Check if install prompt is ready
    if (window.pwaInstallReady) {
      setCanInstall(true);
    }

    const handleInstallReady = () => setCanInstall(true);
    const handleInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('pwaInstallReady', handleInstallReady);
    window.addEventListener('pwaInstalled', handleInstalled);

    return () => {
      window.removeEventListener('pwaInstallReady', handleInstallReady);
      window.removeEventListener('pwaInstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!window.installPWA) return { success: false, reason: 'not-available' };
    return window.installPWA();
  };

  return { canInstall, isInstalled, install };
}

export default InstallPWAButton;
