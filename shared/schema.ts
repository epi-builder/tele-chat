import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  preferredLanguage: varchar("preferred_language").default("ko"),
  autoTranslate: boolean("auto_translate").default(false),
  translateToLanguage: varchar("translate_to_language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conversations table (for both 1:1 and group chats)
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name"), // null for 1:1 chats, set for group chats
  isGroup: boolean("is_group").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Participants table (many-to-many relationship between users and conversations)
export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  userId: varchar("user_id").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id),
  senderId: varchar("sender_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  participations: many(participants),
  sentMessages: many(messages),
  createdConversations: many(conversations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  creator: one(users, {
    fields: [conversations.createdBy],
    references: [users.id],
  }),
  participants: many(participants),
  messages: many(messages),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [participants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [participants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

// Schemas
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  joinedAt: true,
});

export const updateUserSettingsSchema = z.object({
  preferredLanguage: z.string().optional(),
  autoTranslate: z.boolean().optional(),
  translateToLanguage: z.string().optional(),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;

// Extended types for API responses
export type ConversationWithParticipants = Conversation & {
  participants: (Participant & { user: User })[];
  lastMessage?: Message & { sender: User };
  unreadCount?: number;
};

export type MessageWithSender = Message & {
  sender: User;
};
