import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FeedbackModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string | null;
}

export function FeedbackModal({ open, onOpenChange, orderId }: FeedbackModalProps) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            if (!orderId) return;
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ orderId, rating, comment }),
            });
            if (!res.ok) throw new Error("Failed to submit feedback");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Thank you!", description: "Your feedback has been submitted." });
            setComment("");
            setRating(5);
            onOpenChange(false);
            // Invalidate orders to potentially show "Rated" status if we improved the API
            // For now, it just closes.
        },
        onError: () => {
            toast({ title: "Error", description: "Could not submit feedback. Please try again.", variant: "destructive" });
        },
    });

    const handleSubmit = () => {
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Rate your experience</DialogTitle>
                    <DialogDescription>
                        How was your food? We'd love to hear your thoughts!
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                className="focus:outline-none transition-transform hover:scale-110"
                            >
                                <Star
                                    className={`h-8 w-8 ${star <= rating ? "fill-orange-400 text-orange-400" : "text-slate-300"
                                        }`}
                                />
                            </button>
                        ))}
                    </div>
                    <Textarea
                        placeholder="Write a comment... (optional)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="resize-none"
                        rows={4}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={mutation.isPending} className="bg-orange-600 hover:bg-orange-700">
                        {mutation.isPending ? "Submitting..." : "Submit Review"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
