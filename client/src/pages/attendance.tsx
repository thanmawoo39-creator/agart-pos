import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { ClipboardList, Shield, Calendar, Clock, User } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";
import type { Attendance, CurrentShift } from "@shared/schema";

export default function AttendancePage() {
  const { isOwner } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date()), "yyyy-MM-dd");
  
  const [startDate, setStartDate] = useState(weekStart);
  const [endDate, setEndDate] = useState(weekEnd);

  const { data: currentShift, isLoading: shiftLoading } = useQuery<CurrentShift>({
    queryKey: ["/api/attendance/current"],
  });

  const { data: attendance = [], isLoading } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance/report", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/attendance/report?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) throw new Error("Failed to fetch attendance");
      return response.json();
    },
  });

  if (!isOwner) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <Shield className="h-12 w-12 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold">Access Denied</h2>
                <p className="text-sm text-muted-foreground">
                  Only owners can view attendance records.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedAttendance = [...attendance].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.clockInTime.localeCompare(a.clockInTime);
  });

  const totalHoursThisWeek = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);
  const uniqueStaff = Array.from(new Set(attendance.map(a => a.staffName)));

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Attendance Records</h1>
        <p className="text-sm text-muted-foreground">Track staff clock-in and clock-out times</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Shift
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {shiftLoading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : currentShift?.isActive ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-lg font-bold">{currentShift.staffName}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Since {format(parseISO(currentShift.clockInTime!), "h:mm a")}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-lg font-medium text-muted-foreground">No active shift</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hours This Period
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHoursThisWeek.toFixed(1)}h</div>
            <p className="text-sm text-muted-foreground">
              {attendance.length} shifts logged
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Staff Worked
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueStaff.length}</div>
            <p className="text-sm text-muted-foreground">unique staff members</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Date Range Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setStartDate(today);
                setEndDate(today);
              }}
              data-testid="button-today"
            >
              Today
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStartDate(weekStart);
                setEndDate(weekEnd);
              }}
              data-testid="button-this-week"
            >
              This Week
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" />
            Attendance Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : sortedAttendance.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">No attendance records</h3>
                <p className="text-sm text-muted-foreground">
                  No staff shifts recorded for this period
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[150px]">Staff</TableHead>
                    <TableHead className="min-w-[100px]">Clock In</TableHead>
                    <TableHead className="min-w-[100px]">Clock Out</TableHead>
                    <TableHead className="min-w-[100px]">Hours</TableHead>
                    <TableHead className="min-w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAttendance.map((record) => {
                    const isActive = record.clockOutTime === null;
                    return (
                      <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                        <TableCell className="font-medium">
                          {format(parseISO(record.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{record.staffName}</TableCell>
                        <TableCell>
                          {format(parseISO(record.clockInTime), "h:mm a")}
                        </TableCell>
                        <TableCell>
                          {record.clockOutTime
                            ? format(parseISO(record.clockOutTime), "h:mm a")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {record.totalHours
                            ? `${record.totalHours.toFixed(2)}h`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                              Working
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Completed
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
