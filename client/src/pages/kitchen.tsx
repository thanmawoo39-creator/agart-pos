import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useBusinessMode } from "@/contexts/BusinessModeContext";
import { API_BASE_URL } from "@/lib/api-config";
import type { KitchenTicket, KitchenTicketStatus } from "@shared/schema";

function parseTicketItems(items: string | null | undefined): { newItems: any[]; alreadyOrdered: any[] } {
    if (!items) return { newItems: [], alreadyOrdered: [] };
    try {
        const parsed = JSON.parse(items);
        if (Array.isArray(parsed)) {
            return { newItems: parsed, alreadyOrdered: [] };
        }
        if (parsed && typeof parsed === 'object') {
            const ni = Array.isArray((parsed as any).newItems) ? (parsed as any).newItems : [];
            const ao = Array.isArray((parsed as any).alreadyOrdered) ? (parsed as any).alreadyOrdered : [];
            return { newItems: ni, alreadyOrdered: ao };
        }
        return { newItems: [], alreadyOrdered: [] };
    } catch {
        return { newItems: [], alreadyOrdered: [] };
    }
}

export default function Kitchen() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { businessUnit } = useBusinessMode();
    const businessUnitId = businessUnit;

    const { data: tickets = [], isLoading } = useQuery<KitchenTicket[]>({
        queryKey: [`/api/kitchen-tickets?businessUnitId=${businessUnitId}`],
        enabled: !!businessUnitId,
        queryFn: async () => {
            if (!businessUnitId) return [];
            const res = await fetch(`${API_BASE_URL}/api/kitchen-tickets?businessUnitId=${businessUnitId}`, {
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error || "Failed to fetch kitchen tickets");
            }
            return res.json();
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: KitchenTicketStatus }) => {
            if (!businessUnitId) throw new Error("Business unit not set");
            const res = await fetch(`${API_BASE_URL}/api/kitchen-tickets/${id}/status?businessUnitId=${businessUnitId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to update ticket");
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/kitchen-tickets?businessUnitId=${businessUnitId}`] });
        },
    });

    const sortedTickets = useMemo(() => {
        return [...tickets].sort((a: any, b: any) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [tickets]);

    const statusBadge = (status: KitchenTicketStatus) => {
        switch (status) {
            case "in_preparation":
                return <Badge variant="secondary">In Preparation</Badge>;
            case "ready":
                return <Badge variant="default">Ready</Badge>;
            case "served":
                return <Badge variant="outline">Served</Badge>;
            case "cancelled":
                return <Badge variant="destructive">Cancelled</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl md:text-2xl font-semibold">Kitchen View</h1>
                <div className="text-xs text-muted-foreground">Business Unit: {businessUnitId || "-"}</div>
            </div>

            {isLoading ? (
                <Card>
                    <CardContent className="p-4 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {sortedTickets.map((t) => {
                        const parsed = parseTicketItems(t.items);
                        const items = parsed.newItems;
                        const already = parsed.alreadyOrdered;
                        return (
                            <Card key={t.id}>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base flex items-center justify-between">
                                        <span>Table {t.tableNumber || "-"}</span>
                                        {statusBadge(t.status as KitchenTicketStatus)}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    <div className="text-xs text-muted-foreground">Created: {new Date(t.createdAt).toLocaleString()}</div>

                                    <div className="space-y-1">
                                        {items.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">No items</div>
                                        ) : (
                                            items.map((it: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span className="truncate">{it?.productName || it?.name || "Item"}</span>
                                                    <span className="font-mono">x{Number(it?.quantity) || 0}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {already.length > 0 ? (
                                        <div className="pt-2 border-t text-xs text-muted-foreground">
                                            Already ordered: {already.reduce((s: number, i: any) => s + (Number(i?.quantity) || 0), 0)}
                                        </div>
                                    ) : null}

                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateStatusMutation.mutate({ id: t.id, status: "ready" })}
                                            disabled={updateStatusMutation.isPending}
                                        >
                                            Mark Ready
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateStatusMutation.mutate({ id: t.id, status: "served" })}
                                            disabled={updateStatusMutation.isPending}
                                        >
                                            Mark Served
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                                updateStatusMutation.mutate(
                                                    { id: t.id, status: "cancelled" },
                                                    {
                                                        onSuccess: () => {
                                                            toast({ title: "Ticket Cancelled" });
                                                        },
                                                    }
                                                );
                                            }}
                                            disabled={updateStatusMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {sortedTickets.length === 0 ? (
                        <Card className="lg:col-span-2">
                            <CardContent className="p-8 text-center text-muted-foreground">
                                No kitchen tickets yet.
                            </CardContent>
                        </Card>
                    ) : null}
                </div>
            )}
        </div>
    );
}
