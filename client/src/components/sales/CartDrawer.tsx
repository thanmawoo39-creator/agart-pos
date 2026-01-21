import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CartDrawerProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}

export function CartDrawer({ open, onClose, children, className }: CartDrawerProps) {
    // Prevent body scroll when drawer is open
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

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/50 z-[60] md:hidden"
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.5 }}
                        onDragEnd={(_, info) => {
                            // Close if dragged down more than 150px
                            if (info.offset.y > 150) {
                                onClose();
                            }
                        }}
                        className={cn(
                            "fixed bottom-0 left-0 right-0 z-[70] md:hidden",
                            "bg-background rounded-t-2xl shadow-2xl",
                            "max-h-[85vh] overflow-hidden",
                            "flex flex-col",
                            className
                        )}
                    >
                        {/* Drag Handle */}
                        <div className="flex items-center justify-center py-3 border-b">
                            <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
                        </div>

                        {/* Close Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="absolute top-2 right-2 z-10 h-8 w-8"
                        >
                            <X className="h-5 w-5" />
                        </Button>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
