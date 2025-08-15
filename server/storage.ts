import {
  users,
  conversations,
  messages,
  participants,
  type User,
  type UpsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type InsertParticipant,
  type ConversationWithParticipants,
  type MessageWithSender,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, or, ilike, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // User search
  searchUsers(query: string, currentUserId: string): Promise<User[]>;
  
  // Conversation operations
  getUserConversations(userId: string): Promise<ConversationWithParticipants[]>;
  getConversation(conversationId: string): Promise<ConversationWithParticipants | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation>;
  
  // Participant operations
  addParticipant(participant: InsertParticipant): Promise<void>;
  removeParticipant(conversationId: string, userId: string): Promise<void>;
  
  // Message operations
  getMessages(conversationId: string, limit?: number, offset?: number): Promise<MessageWithSender[]>;
  createMessage(message: InsertMessage): Promise<MessageWithSender>;
  
  // Utility
  isUserInConversation(userId: string, conversationId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async searchUsers(query: string, currentUserId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          or(
            ilike(users.firstName, `%${query}%`),
            ilike(users.lastName, `%${query}%`),
            ilike(users.email, `%${query}%`)
          ),
          sql`${users.id} != ${currentUserId}`
        )
      )
      .limit(10);
  }

  async getUserConversations(userId: string): Promise<ConversationWithParticipants[]> {
    const userConversations = await db
      .select({
        conversation: conversations,
        participant: participants,
        user: users,
      })
      .from(participants)
      .innerJoin(conversations, eq(participants.conversationId, conversations.id))
      .innerJoin(users, eq(participants.userId, users.id))
      .where(eq(participants.userId, userId))
      .orderBy(desc(conversations.updatedAt));

    // Get last message for each conversation
    const conversationIds = userConversations.map(c => c.conversation.id);
    let lastMessages: any[] = [];
    
    if (conversationIds.length > 0) {
      lastMessages = await db
        .select({
          conversationId: messages.conversationId,
          message: messages,
          sender: users,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(inArray(messages.conversationId, conversationIds))
        .orderBy(desc(messages.createdAt));
    }

    // Group by conversation and get participants
    const conversationMap = new Map<string, ConversationWithParticipants>();
    
    for (const row of userConversations) {
      const convId = row.conversation.id;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, {
          ...row.conversation,
          participants: [],
        });
      }
    }

    // Get all participants for these conversations
    let allParticipants: any[] = [];
    if (conversationIds.length > 0) {
      allParticipants = await db
        .select({
          participant: participants,
          user: users,
        })
        .from(participants)
        .innerJoin(users, eq(participants.userId, users.id))
        .where(inArray(participants.conversationId, conversationIds));
    }

    // Populate participants
    for (const row of allParticipants) {
      const conv = conversationMap.get(row.participant.conversationId!);
      if (conv) {
        conv.participants.push({
          ...row.participant,
          user: row.user,
        });
      }
    }

    // Add last messages
    const lastMessageMap = new Map<string, typeof lastMessages[0]>();
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.conversationId!)) {
        lastMessageMap.set(msg.conversationId!, msg);
      }
    }

    const result = Array.from(conversationMap.values());
    for (const conv of result) {
      const lastMsg = lastMessageMap.get(conv.id);
      if (lastMsg) {
        conv.lastMessage = {
          ...lastMsg.message,
          sender: lastMsg.sender,
        };
      }
    }

    return result;
  }

  async getConversation(conversationId: string): Promise<ConversationWithParticipants | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));

    if (!conversation) return undefined;

    const participantRows = await db
      .select({
        participant: participants,
        user: users,
      })
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(eq(participants.conversationId, conversationId));

    return {
      ...conversation,
      participants: participantRows.map(row => ({
        ...row.participant,
        user: row.user,
      })),
    };
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation> {
    // Find existing direct conversation between these two users
    const existingConversation = await db
      .select({ conversation: conversations })
      .from(conversations)
      .innerJoin(participants, eq(conversations.id, participants.conversationId))
      .where(
        and(
          eq(conversations.isGroup, false),
          sql`${conversations.id} IN (
            SELECT p1.conversation_id 
            FROM participants p1 
            JOIN participants p2 ON p1.conversation_id = p2.conversation_id 
            WHERE p1.user_id = ${userId1} AND p2.user_id = ${userId2}
          )`
        )
      )
      .limit(1);

    if (existingConversation.length > 0) {
      return existingConversation[0].conversation;
    }

    // Create new direct conversation
    const newConversation = await this.createConversation({
      isGroup: false,
      createdBy: userId1,
    });

    // Add both participants
    await this.addParticipant({
      conversationId: newConversation.id,
      userId: userId1,
    });
    await this.addParticipant({
      conversationId: newConversation.id,
      userId: userId2,
    });

    return newConversation;
  }

  async addParticipant(participant: InsertParticipant): Promise<void> {
    await db.insert(participants).values(participant);
  }

  async removeParticipant(conversationId: string, userId: string): Promise<void> {
    await db
      .delete(participants)
      .where(
        and(
          eq(participants.conversationId, conversationId),
          eq(participants.userId, userId)
        )
      );
  }

  async getMessages(conversationId: string, limit = 50, offset = 0): Promise<MessageWithSender[]> {
    const messageRows = await db
      .select({
        message: messages,
        sender: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    return messageRows.map(row => ({
      ...row.message,
      sender: row.sender,
    })).reverse(); // Reverse to get chronological order
  }

  async createMessage(message: InsertMessage): Promise<MessageWithSender> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();

    const senderQuery = db
      .select()
      .from(users)
      .where(eq(users.id, message.senderId));
    const senderRows = await senderQuery;
    const sender = senderRows[0];

    // Update conversation's updatedAt
    const updateQuery = db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, message.conversationId));
    await updateQuery;

    return {
      ...newMessage,
      sender,
    };
  }

  async isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
    const [participant] = await db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.userId, userId),
          eq(participants.conversationId, conversationId)
        )
      )
      .limit(1);

    return !!participant;
  }
}

export const storage = new DatabaseStorage();
