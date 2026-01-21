import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Download, Smartphone } from 'lucide-react';

export function LunchMenuInstallBanner() {
    const [showBanner, setShowBanner] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);

    useEffect(() => {
        // Check if already installed
        const isInstalled = (window as any).isPWAInstalled?.();
        if (isInstalled) {
            return;
        }

        // Check if banner was previously dismissed
        const dismissed = localStorage.getItem('lunch-menu-install-dismissed');
        if (dismissed) {
            return;
        }

        // Listen for install prompt ready
        const handleInstallReady = () => {
            setShowBanner(true);
        };

        window.addEventListener('pwaInstallReady', handleInstallReady);

        // Check if prompt is already available
        if ((window as any).pwaInstallReady) {
            setShowBanner(true);
        }

        return () => {
            window.removeEventListener('pwaInstallReady', handleInstallReady);
        };
    }, []);

    const handleInstall = async () => {
        setIsInstalling(true);
        try {
            const result = await (window as any).installPWA?.();
            if (result?.success) {
                setShowBanner(false);
            }
        } catch (error) {
            console.error('Install failed:', error);
        } finally {
            setIsInstalling(false);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('lunch-menu-install-dismissed', 'true');
    };

    if (!showBanner) {
        return null;
    }

    return (
        <Card className="fixed bottom-4 left-4 right-4 z-50 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-2xl border-none md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-5">
            <div className="p-4">
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="flex items-start gap-3 mb-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Smartphone className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Install ChawChaw App</h3>
                        <p className="text-sm text-white/90 mt-1">
                            Add to your home screen for quick access to our lunch menu!
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={handleInstall}
                        disabled={isInstalling}
                        className="flex-1 bg-white text-orange-600 hover:bg-orange-50"
                    >
                        {isInstalling ? (
                            <>Installing...</>
                        ) : (
                            <>
                                <Download className="h-4 w-4 mr-2" />
                                Install App
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleDismiss}
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                    >
                        Not Now
                    </Button>
                </div>
            </div>
        </Card>
    );
}
