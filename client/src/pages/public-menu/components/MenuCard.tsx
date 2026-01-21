import { motion } from "framer-motion";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store } from "lucide-react";

interface MenuItem {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    imageData?: string;
    category?: string;
    stock: number;
}

interface MenuCardProps {
    item: MenuItem;
    quantity: number;
    onAdd: () => void;
    onRemove: () => void;
    formatCurrency: (amount: number) => string;
}

export function MenuCard({ item, quantity, onAdd, onRemove, formatCurrency }: MenuCardProps) {
    const getImage = (item: MenuItem) => item.imageData || item.imageUrl;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700 flex flex-col h-full"
        >
            {/* Image Container - Aspect Ratio 4:3 */}
            <div className="aspect-[4/3] relative bg-slate-100 dark:bg-slate-700 overflow-hidden">
                {getImage(item) ? (
                    <img
                        src={getImage(item)!}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Store className="h-12 w-12" />
                    </div>
                )}

                {/* Stock Badge */}
                {item.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                        <Badge variant="destructive" className="text-sm font-bold px-3 py-1">Sold Out</Badge>
                    </div>
                )}

                {/* Low Stock Warning */}
                {item.stock > 0 && item.stock <= 5 && (
                    <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                            Only {item.stock} left
                        </Badge>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 line-clamp-2 mb-1">
                        {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1">
                        {item.category || "General"}
                    </p>
                </div>

                <div className="mt-4 flex items-end justify-between">
                    <span className="text-lg font-bold text-primary">
                        {formatCurrency(item.price)}
                    </span>

                    {/* Add/Quantity Controls */}
                    {item.stock > 0 ? (
                        quantity > 0 ? (
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-700 rounded-full p-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-full hover:bg-white dark:hover:bg-slate-600 shadow-sm"
                                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                >
                                    <Minus className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                                </Button>
                                <span className="font-bold text-sm min-w-[1rem] text-center">{quantity}</span>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-full hover:bg-white dark:hover:bg-slate-600 shadow-sm"
                                    onClick={(e) => { e.stopPropagation(); onAdd(); }}
                                >
                                    <Plus className="h-4 w-4 text-primary" />
                                </Button>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                className="rounded-full px-4 h-9 bg-orange-100 hover:bg-orange-200 text-orange-700 border-none shadow-none"
                                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                        )
                    ) : (
                        <Button size="sm" disabled variant="outline" className="rounded-full opacity-50">
                            Unavailable
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
