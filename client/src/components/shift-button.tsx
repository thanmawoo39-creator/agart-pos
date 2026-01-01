import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogIn, LogOut, Delete } from "lucide-react";
import type { CurrentShift } from "@shared/schema";
import { format } from "date-fns";

export function ShiftButton() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [pin, setPin] = useState("");

  const { data: shift, isLoading } = useQuery<CurrentShift>({
    queryKey: ["/api/attendance/current"],
    refetchInterval: 30000,
  });

  const clockInMutation = useMutation({
    mutationFn: (pin: string) => apiRequest("POST", "/api/attendance/clock-in", { pin }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/current"] });
      toast({ title: `${data.staffName} clocked in successfully` });
      setIsOpen(false);
      setPin("");
    },
    onError: (error: any) => {
      toast({
        title: "Clock in failed",
        description: error.message || "Invalid PIN or error",
        variant: "destructive",
      });
      setPin("");
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: (pin: string) => apiRequest("POST", "/api/attendance/clock-out", { pin }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/current"] });
      toast({
        title: "Clocked out successfully",
        description: `Total hours: ${data.totalHours?.toFixed(2) || 0}`,
      });
      setIsOpen(false);
      setPin("");
    },
    onError: (error: any) => {
      toast({
        title: "Clock out failed",
        description: error.message || "Invalid PIN or error",
        variant: "destructive",
      });
      setPin("");
    },
  });

  const handleNumPad = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  const handleSubmit = () => {
    if (pin.length !== 4) {
      toast({ title: "Please enter a 4-digit PIN", variant: "destructive" });
      return;
    }

    if (shift?.isActive) {
      clockOutMutation.mutate(pin);
    } else {
      clockInMutation.mutate(pin);
    }
  };

  const isWorking = shift?.isActive;
  const isPending = clockInMutation.isPending || clockOutMutation.isPending;

  return (
    <>
      <Button
        variant={isWorking ? "default" : "outline"}
        size="lg"
        onClick={() => setIsOpen(true)}
        className={`gap-2 min-w-[140px] ${
          isWorking
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "bg-slate-100 dark:bg-slate-800 text-muted-foreground"
        }`}
        data-testid="button-shift"
      >
        <Clock className="h-5 w-5" />
        {isLoading ? (
          "Loading..."
        ) : isWorking ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            On Shift
          </span>
        ) : (
          "Start Shift"
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {isWorking ? "Clock Out" : "Clock In"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {isWorking ? (
                <div className="mt-2">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1">
                    {shift.staffName} working since{" "}
                    {format(new Date(shift.clockInTime!), "h:mm a")}
                  </Badge>
                </div>
              ) : (
                "Enter your 4-digit PIN"
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-4">
            <div className="flex gap-3 justify-center">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                    pin[i]
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
                      : "border-muted bg-muted/30"
                  }`}
                  data-testid={`pin-digit-${i}`}
                >
                  {pin[i] ? "*" : ""}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <Button
                  key={digit}
                  variant="outline"
                  size="lg"
                  className="w-16 h-16 text-2xl font-semibold"
                  onClick={() => handleNumPad(String(digit))}
                  disabled={isPending}
                  data-testid={`button-numpad-${digit}`}
                >
                  {digit}
                </Button>
              ))}
              <Button
                variant="outline"
                size="lg"
                className="w-16 h-16 text-lg"
                onClick={handleClear}
                disabled={isPending}
                data-testid="button-numpad-clear"
              >
                CLR
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-16 h-16 text-2xl font-semibold"
                onClick={() => handleNumPad("0")}
                disabled={isPending}
                data-testid="button-numpad-0"
              >
                0
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-16 h-16"
                onClick={handleDelete}
                disabled={isPending}
                data-testid="button-numpad-delete"
              >
                <Delete className="h-6 w-6" />
              </Button>
            </div>

            <Button
              size="lg"
              className={`w-full gap-2 text-lg h-14 ${
                isWorking
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
              onClick={handleSubmit}
              disabled={pin.length !== 4 || isPending}
              data-testid="button-submit-shift"
            >
              {isPending ? (
                "Processing..."
              ) : isWorking ? (
                <>
                  <LogOut className="h-5 w-5" />
                  Clock Out
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  Clock In
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
