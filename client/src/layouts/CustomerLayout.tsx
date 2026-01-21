
import { PropsWithChildren } from "react";
import { Link } from "wouter";
import { User, LogOut, ShoppingCart, ShoppingBag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function CustomerLayout({ children }: PropsWithChildren) {
    // REPLACEMENT: Fetch customer profile directly instead of using Staff AuthContext
    // This allows the layout to work outside the protected Admin wrappers
    const { data: customer } = useQuery({
        queryKey: ['/api/customer/profile'],
        retry: false,
        queryFn: async () => {
            // Include credentials to ensure session cookie is sent
            const res = await fetch('/api/customer/profile', {
                // optional for same-origin but good practice if strict modes on
            });
            if (!res.ok) return null;
            return res.json();
        }
    });

    const { toast } = useToast();

    const handleLogout = async () => {
        try {
            await fetch('/api/customer/logout', { method: 'POST' });
            window.location.href = '/lunch-menu';
        } catch (e) {
            console.error('Logout failed:', e);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Public Header - Matching Lunch Menu Style */}
            <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-orange-200 dark:border-slate-800 shadow-sm">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/lunch-menu">
                                <div className="cursor-pointer">
                                    <h1 className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                        ChawChaw Restaurant
                                    </h1>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Customer Portal
                                    </p>
                                </div>
                            </Link>
                        </div>

                        <div className="flex items-center gap-3">
                            <ThemeToggle />

                            <Link href="/lunch-menu">
                                <Button variant="ghost" size="sm" className="gap-2">
                                    <ShoppingCart className="h-4 w-4" />
                                    <span className="hidden sm:inline">Order Now</span>
                                </Button>
                            </Link>

                            {/* User Menu */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="flex bg-orange-50 text-orange-700 border-orange-200 gap-2 px-3">
                                        <User className="h-4 w-4" />
                                        {/* Display name if available, else 'My Account' */}
                                        <span className="hidden md:inline">{customer?.name || 'My Account'}</span>
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{customer?.name || 'Customer'}</p>
                                            <p className="text-xs leading-none text-muted-foreground">Logged in</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => window.location.href = `/my-profile`}>
                                        <User className="mr-2 h-4 w-4" />
                                        <span>My Profile</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => window.location.href = `/my-orders`}>
                                        <ShoppingBag className="mr-2 h-4 w-4" />
                                        <span>My Orders</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleLogout}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Log out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    );
}
