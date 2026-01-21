import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingCartProps {
    count: number;
    total: string;
    onClick: () => void;
}

export function FloatingCart({ count, total, onClick }: FloatingCartProps) {
    return (
        <AnimatePresence>
            {count > 0 && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed bottom-4 left-4 right-4 z-50"
                >
                    <Button
                        className="w-full h-14 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-xl rounded-xl flex items-center justify-between px-6 border-0"
                        onClick={onClick}
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full">
                                <ShoppingCart className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-bold text-lg">{count} items</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="opacity-80 text-sm">Total</span>
                            <span className="font-bold text-xl">{total}</span>
                        </div>
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
