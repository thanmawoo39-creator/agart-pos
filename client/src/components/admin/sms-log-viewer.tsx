/**
 * SMS Log Viewer Component
 * Displays all incoming SMS for admin/cashier debugging
 * Supports real-time updates via Socket.IO
 */
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/hooks/use-currency';
import { io } from 'socket.io-client';
import {
    RefreshCcw,
    MessageSquare,
    CheckCircle,
    AlertCircle,
    XCircle,
    Loader2,
    Smartphone,
} from 'lucide-react';

interface SmsLog {
    id: string;
    sender: string | null;
    messageContent: string | null;
    extractedAmount: number | null;
    status: 'received' | 'matched' | 'unmatched' | 'failed';
    matchedOrderId: string | null;
    createdAt: string;
}

export function SmsLogViewer() {
    const queryClient = useQueryClient();
    const { formatCurrency } = useCurrency();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set());

    // Fetch SMS logs
    const { data: logs = [], isLoading, refetch } = useQuery<SmsLog[]>({
        queryKey: ['/api/admin/sms-logs'],
        refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

    // Socket.IO integration for real-time updates
    useEffect(() => {
        const socket = io({
            path: '/socket.io',
            transports: ['websocket', 'polling'],
        });

        socket.on('new_sms_log', (newLog: SmsLog) => {
            console.log('[SMS-VIEWER] Received new SMS log:', newLog);

            // Play notification beep for new payment
            try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.value = 800; // Hz
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            } catch (e) {
                console.log('[SMS-VIEWER] Could not play notification sound');
            }

            // Add to new log IDs for highlight effect
            setNewLogIds(prev => new Set(prev).add(newLog.id));

            // Prepend to cache
            queryClient.setQueryData<SmsLog[]>(['/api/admin/sms-logs'], (old) => {
                if (!old) return [newLog];
                // Avoid duplicates
                if (old.some(log => log.id === newLog.id)) return old;
                return [newLog, ...old].slice(0, 50);
            });

            // Remove highlight after 3 seconds
            setTimeout(() => {
                setNewLogIds(prev => {
                    const next = new Set(prev);
                    next.delete(newLog.id);
                    return next;
                });
            }, 3000);
        });

        return () => {
            socket.disconnect();
        };
    }, [queryClient]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    const getStatusBadge = (status: SmsLog['status']) => {
        switch (status) {
            case 'matched':
                return (
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                    </Badge>
                );
            case 'unmatched':
                return (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Pending
                    </Badge>
                );
            case 'failed':
                return (
                    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        <XCircle className="w-3 h-3 mr-1" />
                        Parse Error
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Received
                    </Badge>
                );
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        });
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            return 'Today';
        }
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="p-3 md:p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm md:text-lg font-medium flex items-center gap-2">
                    <Smartphone className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                    <span>SMS Payment Logs</span>
                    {logs.length > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                            {logs.length}
                        </Badge>
                    )}
                </CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="h-8"
                >
                    <RefreshCcw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-4 space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No SMS logs yet</p>
                        <p className="text-xs mt-1">SMS payments will appear here in real-time</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[400px]">
                        <div className="divide-y divide-border">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className={`p-3 md:p-4 hover:bg-muted/50 transition-colors ${newLogIds.has(log.id)
                                        ? 'bg-green-50 dark:bg-green-950/20 animate-pulse'
                                        : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            {/* Header Row */}
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDate(log.createdAt)} {formatTime(log.createdAt)}
                                                </span>
                                                {getStatusBadge(log.status)}
                                            </div>

                                            {/* Sender */}
                                            <div className="text-sm font-medium truncate">
                                                From: {log.sender || 'Unknown'}
                                            </div>

                                            {/* Message Preview */}
                                            <div className="text-xs text-muted-foreground truncate mt-1">
                                                {log.messageContent?.substring(0, 80) || 'No message content'}
                                                {log.messageContent && log.messageContent.length > 80 && '...'}
                                            </div>
                                        </div>

                                        {/* Amount */}
                                        <div className="text-right flex-shrink-0">
                                            {log.extractedAmount !== null ? (
                                                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                                    {formatCurrency(log.extractedAmount)}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    No amount
                                                </div>
                                            )}
                                            {log.matchedOrderId && (
                                                <div className="text-[10px] text-blue-600 dark:text-blue-400 truncate max-w-[80px]">
                                                    Order: {log.matchedOrderId.slice(0, 8)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
