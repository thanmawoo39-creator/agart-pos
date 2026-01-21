import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { User, LogIn, Barcode, KeyRound, Lock, ChevronLeft } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  required?: boolean;
}

export function LoginModal({ open, onOpenChange, onSuccess, required = false }: LoginModalProps) {
  const { login, isLoggedIn, currentStaff, logout } = useAuth();
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch staff list for selection
  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/auth/staff-list"],
    queryFn: async () => {
      const res = await fetch("/api/auth/staff-list", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
    select: (data) => data.filter((staff) => ['owner', 'manager', 'cashier', 'waiter', 'kitchen'].includes(staff.role)),
  });

  // Check if selected role requires password
  const requiresPassword = selectedStaff && (selectedStaff.role === 'owner' || selectedStaff.role === 'manager');

  const handleOpenChange = (newOpen: boolean) => {
    if (required && !isLoggedIn && !newOpen) {
      return;
    }
    if (!newOpen) {
      setSelectedStaff(null);
      setPin("");
      setPassword("");
      setError("");
    }
    onOpenChange(newOpen);
  };

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open, selectedStaff]);

  useEffect(() => {
    if (!open || selectedStaff) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "Enter" && barcodeBuffer.length > 0) {
        handleBarcodeLogin(barcodeBuffer);
        setBarcodeBuffer("");
        return;
      }

      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        setBarcodeBuffer((prev) => prev + e.key);
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
        barcodeTimeoutRef.current = setTimeout(() => {
          setBarcodeBuffer("");
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [open, barcodeBuffer, selectedStaff]);

  const handleBarcodeLogin = async (barcode: string) => {
    if (barcode.length < 3) return;
    setIsLoading(true);
    setError("");
    const success = await login(undefined, barcode);
    setIsLoading(false);
    if (success) {
      onOpenChange(false);
      onSuccess?.();
    } else {
      setError("Invalid staff barcode");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedStaff) {
      // Direct PIN login (no staff selected)
      if (pin.length !== 4) {
        setError("PIN must be 4 digits");
        return;
      }
      setIsLoading(true);
      const success = await login(pin);
      setIsLoading(false);
      if (success) {
        setPin("");
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError("Invalid PIN");
      }
      return;
    }

    // Staff selected - check auth method
    if (requiresPassword) {
      if (!password) {
        setError("Password is required");
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ staffId: selectedStaff.id, password }),
        });
        const data = await res.json();

        console.log("🔐 Login Response:", res.status, data);

        if (res.ok && data.staff) {
          console.log("✅ Login successful for:", data.staff.name);

          // CRITICAL: Save session to localStorage so auth-context picks it up on reload
          const sessionData = {
            staff: data.staff,
            loginTime: data.loginTime || new Date().toISOString(),
          };
          localStorage.setItem("staffSession", JSON.stringify(sessionData));
          console.log("💾 Session saved to localStorage");

          // Also set business unit if available
          if (data.staff.businessUnitId) {
            localStorage.setItem("activeBusinessUnitId", data.staff.businessUnitId);
          }

          setPassword("");
          setSelectedStaff(null);
          onOpenChange(false);
          onSuccess?.();

          // Redirect based on role
          if (data.staff.role === 'customer') {
            window.location.href = "/lunch-menu";
          } else {
            // Force hard redirect to home for staff
            window.location.href = "/";
          }
        } else {
          setIsLoading(false);
          setError(data.error || "Invalid password");
        }
      } catch (err) {
        console.error("Login error:", err);
        setIsLoading(false);
        setError("Login failed - network error");
      }
    } else {
      // PIN login for selected staff
      if (pin.length !== 4) {
        setError("PIN must be 4 digits");
        return;
      }
      setIsLoading(true);
      const success = await login(pin);
      setIsLoading(false);
      if (success) {
        setPin("");
        setSelectedStaff(null);
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError("Invalid PIN");
      }
    }
  };

  const handleLogout = () => {
    logout();
    setPin("");
    setPassword("");
    setSelectedStaff(null);
    setError("");
  };

  const handleBack = () => {
    setSelectedStaff(null);
    setPin("");
    setPassword("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]" onEscapeKeyDown={(e) => {
        if (required && !isLoggedIn) e.preventDefault();
      }} onPointerDownOutside={(e) => {
        if (required && !isLoggedIn) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isLoggedIn ? "Switch User" : selectedStaff ? `Login as ${selectedStaff.name}` : "Staff Login"}
          </DialogTitle>
          <DialogDescription>
            {isLoggedIn
              ? `Currently logged in as ${currentStaff?.name}`
              : selectedStaff
                ? requiresPassword ? "Enter your password" : "Enter your 4-digit PIN"
                : "Select your account or scan barcode"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isLoggedIn && (
            <div className="flex items-center justify-between rounded-md bg-muted p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {currentStaff?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{currentStaff?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentStaff?.role}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
            </div>
          )}

          {!selectedStaff ? (
            <>
              {/* Staff Selection Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {staffList
                  .filter(s => ['owner', 'manager', 'cashier', 'waiter', 'kitchen'].includes(s.role))
                  .map((s) => (
                    <Button
                      key={s.id}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-1"
                      onClick={() => setSelectedStaff(s)}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate max-w-full">{s.name}</span>
                      <span className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                        {(s.role === 'owner' || s.role === 'manager') && <Lock className="h-3 w-3" />}
                        {s.role}
                      </span>
                    </Button>
                  ))}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or enter PIN directly</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="4-digit PIN"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  className="text-center text-xl tracking-[0.5em]"
                />
                {error && <p className="text-sm text-destructive text-center">{error}</p>}
                <Button type="submit" className="w-full" disabled={pin.length !== 4 || isLoading}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {isLoading ? "Logging in..." : "Login with PIN"}
                </Button>
              </form>

              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-3">
                <Barcode className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground text-center">Scan barcode to login</p>
              </div>
            </>
          ) : (
            /* Staff is selected - show appropriate auth input */
            <form onSubmit={handleSubmit} className="space-y-4">
              <Button type="button" variant="ghost" size="sm" onClick={handleBack} className="mb-2">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>

              <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  {selectedStaff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{selectedStaff.name}</p>
                  <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                    {requiresPassword && <Lock className="h-3 w-3" />}
                    {selectedStaff.role}
                  </p>
                </div>
              </div>

              {requiresPassword ? (
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Password
                  </Label>
                  <Input
                    ref={inputRef}
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="pin" className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" /> PIN
                  </Label>
                  <Input
                    ref={inputRef}
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="4-digit PIN"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                    className="text-center text-2xl tracking-[0.5em]"
                    autoFocus
                  />
                </div>
              )}

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || (requiresPassword ? !password : pin.length !== 4)}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
