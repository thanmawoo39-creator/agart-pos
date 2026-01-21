import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloatingCartButtonProps {
    cartCount: number;
    onClick: () => void;
    className?: string;
}

export function FloatingCartButton({ cartCount, onClick, className }: FloatingCartButtonProps) {
    // Don't show if cart is empty or on desktop
    if (cartCount === 0) return null;

    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className={cn(
                "fixed bottom-6 right-6 z-50 md:hidden",
                className
            )}
        >
            <Button
                onClick={onClick}
                size="icon"
                className="h-16 w-16 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground relative"
                aria-label="Open cart"
            >
                <ShoppingCart className="h-7 w-7" />

                {/* Cart Count Badge */}
                <motion.div
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -top-2 -right-2"
                >
                    <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold text-sm px-2.5 py-1 rounded-full shadow-lg min-w-[28px] h-7 flex items-center justify-center">
                        {cartCount}
                    </Badge>
                </motion.div>
            </Button>
        </motion.div>
    );
}
