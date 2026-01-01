import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { User, LogIn, Barcode, KeyRound } from "lucide-react";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LoginModal({ open, onOpenChange, onSuccess }: LoginModalProps) {
  const { login, isLoggedIn, currentStaff, logout } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, barcodeBuffer]);

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

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }

    setIsLoading(true);
    setError("");

    const success = await login(pin);
    setIsLoading(false);

    if (success) {
      setPin("");
      onOpenChange(false);
      onSuccess?.();
    } else {
      setError("Invalid PIN");
    }
  };

  const handleLogout = () => {
    logout();
    setPin("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isLoggedIn ? "Switch User" : "Staff Login"}
          </DialogTitle>
          <DialogDescription>
            {isLoggedIn
              ? `Currently logged in as ${currentStaff?.name}`
              : "Enter your 4-digit PIN or scan your staff barcode"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {isLoggedIn && (
            <div className="flex items-center justify-between rounded-md bg-muted p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {currentStaff?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{currentStaff?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {currentStaff?.role}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                Logout
              </Button>
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Enter PIN
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
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  setPin(value);
                  setError("");
                }}
                className="text-center text-2xl tracking-[0.5em]"
                data-testid="input-pin"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={pin.length !== 4 || isLoading}
              data-testid="button-login"
            >
              <LogIn className="mr-2 h-4 w-4" />
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-4">
            <Barcode className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Scan your staff barcode to login instantly
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
