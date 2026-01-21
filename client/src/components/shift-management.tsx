import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, DollarSign, TrendingUp, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useBusinessMode } from '@/contexts/BusinessModeContext';
import { useCurrency } from '@/hooks/use-currency';
import type { Shift } from '@shared/schema';

interface ShiftManagementProps {
  className?: string;
}

export function ShiftManagement({ className }: ShiftManagementProps) {
  const { currentStaff, isOwner, isManager } = useAuth();
  const { businessUnit } = useBusinessMode();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [shiftSummary, setShiftSummary] = useState<any>(null);

  const isWaiter = currentStaff?.role === 'waiter';

  // Query current shift for logged-in user
  const { data: currentShift, isLoading } = useQuery<Shift | null>({
    queryKey: ['/api/shifts/current'],
    refetchInterval: 30000,
  });

  // Query all active shifts for admin overview
  const { data: allShifts } = useQuery<Shift[]>({
    queryKey: ['/api/shifts/history'],
    enabled: isOwner || isManager, // Only fetch for admins
  });

  // Open shift mutation
  const openShiftMutation = useMutation({
    mutationFn: async (data: { staffId: string; staffName: string; openingCash: number; businessUnitId?: string | null }) => {
      const response = await fetch('/api/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to open shift');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/shifts/current'], data);
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/current'] });
      setOpenDialog(false);
      setOpeningCash('');
    },
  });

  // Close shift mutation
  const closeShiftMutation = useMutation({
    mutationFn: async (data: { shiftId: string; actualCash: number }) => {
      const response = await fetch('/api/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close shift');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/shifts/current'], null);
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shifts/history'] });
      setShowCloseModal(false);
      setActualCash('');
      setShiftSummary(data);

      if (!isWaiter) {
        // Show shift summary with discrepancy information
        const discrepancy = data.shiftSummary?.cashDifference || 0;
        if (discrepancy !== 0) {
          alert(`Shift Closed with Discrepancy!\n\nExpected Cash: ${formatCurrency(data.shiftSummary.expectedCash)}\nActual Cash: ${formatCurrency(data.shiftSummary.actualCash)}\nDifference: ${discrepancy > 0 ? '+' : ''}${formatCurrency(discrepancy)}\n\nAn alert has been created for management.`);
        } else {
          alert(`Shift Closed Successfully!\n\nTotal Sales: ${formatCurrency(data.totalSales)}\nCash Sales: ${formatCurrency(data.cashSales)}\nExpected Cash: ${formatCurrency(data.shiftSummary.expectedCash)}\nActual Cash: ${formatCurrency(data.shiftSummary.actualCash)}\nPerfect Balance!`);
        }
      }
    },
  });

  const handleOpenShift = () => {
    if (!currentStaff?.id) return;
    
    // For waiters, auto-open with 0 cash
    if (isWaiter) {
      openShiftMutation.mutate({
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        openingCash: 0,
        businessUnitId: businessUnit,
      });
      return;
    }

    if (!openingCash) return;

    openShiftMutation.mutate({
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      openingCash: parseFloat(openingCash),
      businessUnitId: businessUnit,
    });
  };

  const handleCloseShift = () => {
    if (!currentShift) return;
    
    // For waiters, auto-close with 0 cash
    if (isWaiter) {
      closeShiftMutation.mutate({
        shiftId: currentShift.id,
        actualCash: 0,
      });
      return;
    }

    setShowCloseModal(true);
  };

  const confirmCloseShift = () => {
    if (!actualCash || !currentShift) return;

    closeShiftMutation.mutate({
      shiftId: currentShift.id,
      actualCash: parseFloat(actualCash),
    });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <Button className={className} disabled>Loading...</Button>;
  }

  // Simplified UI for Waiters
  if (isWaiter) {
    return (
      <Button 
        className={`${className} w-full`}
        variant={currentShift ? 'destructive' : 'default'}
        onClick={currentShift ? handleCloseShift : handleOpenShift}
        disabled={openShiftMutation.isPending || closeShiftMutation.isPending}
        style={!currentShift ? { backgroundColor: '#16a34a', color: 'white' } : {}} // Emerald-600 for open
      >
        {openShiftMutation.isPending || closeShiftMutation.isPending ? (
          'Processing...'
        ) : currentShift ? (
          <>
            <Clock className="w-4 h-4 mr-2" />
            Clock Out (End Shift)
          </>
        ) : (
          <>
            <Clock className="w-4 h-4 mr-2" />
            Clock In (Start Shift)
          </>
        )}
      </Button>
    );
  }

  return (
    <Dialog open={openDialog} onOpenChange={setOpenDialog}>
      <DialogTrigger asChild>
        <Button className={className} variant={currentShift ? 'default' : 'outline'}>
          {currentShift ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Shift Open
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              Open Shift
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {(isOwner || isManager) ? 'Shift Overview' : 'Shift Management'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Admin Overview Section */}
          {(isOwner || isManager) && allShifts && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Active Shifts Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {allShifts.filter(shift => shift.status === 'open').length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active shifts currently</p>
                ) : (
                  allShifts.filter(shift => shift.status === 'open').map((shift) => (
                    <div key={shift.id} className="flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-gray-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{shift.staffName}</span>
                          <Badge variant="default" className="bg-green-600">
                            Active
                          </Badge>
                          {shift.staffId === currentStaff?.id && (
                            <Badge variant="outline" className="text-xs">
                              Your Shift
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Started: {formatTime(shift.startTime)} • Opening Cash: {formatCurrency(shift.openingCash)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Sales: {formatCurrency(shift.totalSales)} (Cash: {formatCurrency(shift.cashSales)})
                        </div>
                      </div>
                      <div className="text-right">
                        {shift.staffId === currentStaff?.id ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleCloseShift}
                          >
                            Close Your Shift
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            View Only
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {/* Current User's Shift Status */}
          {currentShift && currentShift.staffId === currentStaff?.id && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Current Shift
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Staff</Label>
                    <p className="font-medium">{currentShift.staffName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Started</Label>
                    <p className="font-medium">{formatTime(currentShift.startTime)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Opening Cash</Label>
                    <p className="font-medium">{formatCurrency(currentShift.openingCash)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant="default" className="bg-green-600">
                      Open
                    </Badge>
                  </div>
                </div>

                {/* Close Shift Form */}
                <div className="space-y-3 pt-3 border-t">
                  <Button
                    onClick={handleCloseShift}
                    disabled={closeShiftMutation.isPending}
                    className="w-full"
                    variant="destructive"
                  >
                    {closeShiftMutation.isPending ? 'Closing...' : 'Close Shift'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Open Shift */}
          {(!currentShift || currentShift.staffId !== currentStaff?.id) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  No Active Shift
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Open a shift to start tracking sales and managing cash transactions.
                </p>

                <div className="space-y-3">
                  <Label htmlFor="openingCash">Opening Cash Amount</Label>
                  <Input
                    id="openingCash"
                    type="number"
                    placeholder="Enter opening cash amount"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    disabled={openShiftMutation.isPending}
                  />
                  <Button
                    onClick={handleOpenShift}
                    disabled={!openingCash || openShiftMutation.isPending}
                    className="w-full"
                  >
                    {openShiftMutation.isPending ? 'Opening...' : 'Open Shift'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Shifts */}
          {allShifts && allShifts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Recent Shifts</h3>
              <div className="space-y-2">
                {allShifts.slice(0, 5).map((shift: Shift) => (
                  <Card key={shift.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{shift.staffName}</span>
                          <Badge variant={shift.status === 'open' ? 'default' : 'secondary'}>
                            {shift.status}
                          </Badge>
                          {shift.staffId === currentStaff?.id && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(shift.startTime)} • {formatTime(shift.startTime)}
                          {shift.endTime && ` - ${formatTime(shift.endTime)}`}
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span>Opening: {formatCurrency(shift.openingCash)}</span>
                          {shift.closingCash && (
                            <span>Closing: {formatCurrency(shift.closingCash)}</span>
                          )}
                          <span>Sales: {formatCurrency(shift.totalSales)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Closing Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Close Shift - Cash Count
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {currentShift && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Shift Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Opening Cash:</span>
                    <span>{formatCurrency(currentShift.openingCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Sales:</span>
                    <span>{formatCurrency(currentShift.cashSales)}</span>
                  </div>
                  <div className="border-t pt-1 mt-1">
                    <div className="flex justify-between font-semibold">
                      <span>Expected Cash:</span>
                      <span>{formatCurrency(currentShift.openingCash + currentShift.cashSales)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="actualCash">Actual Cash in Hand</Label>
              <Input
                id="actualCash"
                type="number"
                placeholder="Enter actual cash amount"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                disabled={closeShiftMutation.isPending}
                step="0.01"
              />
            </div>

            {actualCash && currentShift && (
              <div className={`p-3 rounded-lg border ${parseFloat(actualCash) - (currentShift.openingCash + currentShift.cashSales) === 0
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Discrepancy:</span>
                  <span className={`font-bold ${parseFloat(actualCash) - (currentShift.openingCash + currentShift.cashSales) === 0
                    ? 'text-green-600'
                    : 'text-red-600'
                    }`}>
                    {parseFloat(actualCash) - (currentShift.openingCash + currentShift.cashSales) > 0 ? '+' : ''}
                    {formatCurrency(parseFloat(actualCash) - (currentShift.openingCash + currentShift.cashSales))}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCloseModal(false)}
                disabled={closeShiftMutation.isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmCloseShift}
                disabled={!actualCash || closeShiftMutation.isPending}
                className="flex-1"
                variant="destructive"
              >
                {closeShiftMutation.isPending ? 'Closing...' : 'Confirm Close'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
