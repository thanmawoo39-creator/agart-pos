import { z } from "zod";

export const insertConversationSchema = z.object({
  title: z.string().min(1),
});

export const insertMessageSchema = z.object({
  conversationId: z.number().int(),
  role: z.string(),
  content: z.string(),
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

