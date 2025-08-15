import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertParticipantSchema,
} from "@shared/schema";
import { z } from "zod";

// WebSocket connection tracking
const wsConnections = new Map<string, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User search
  app.get('/api/users/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }
      
      const userId = req.user.claims.sub;
      const users = await storage.searchUsers(q, userId);
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Get user's conversations
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get specific conversation
  app.get('/api/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Check if user is participant
      const isParticipant = await storage.isUserInConversation(userId, id);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // Create or get direct conversation
  app.post('/api/conversations/direct', isAuthenticated, async (req: any, res) => {
    try {
      const { userId: otherUserId } = req.body;
      if (!otherUserId) {
        return res.status(400).json({ message: "userId is required" });
      }
      
      const currentUserId = req.user.claims.sub;
      const conversation = await storage.getOrCreateDirectConversation(currentUserId, otherUserId);
      res.json(conversation);
    } catch (error) {
      console.error("Error creating direct conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Create group conversation
  app.post('/api/conversations/group', isAuthenticated, async (req: any, res) => {
    try {
      const schema = insertConversationSchema.extend({
        participantIds: z.array(z.string()),
      });
      const { name, participantIds } = schema.parse(req.body);
      
      const currentUserId = req.user.claims.sub;
      
      const conversation = await storage.createConversation({
        name,
        isGroup: true,
        createdBy: currentUserId,
      });
      
      // Add creator as participant
      await storage.addParticipant({
        conversationId: conversation.id,
        userId: currentUserId,
      });
      
      // Add other participants
      for (const participantId of participantIds) {
        await storage.addParticipant({
          conversationId: conversation.id,
          userId: participantId,
        });
      }
      
      res.json(conversation);
    } catch (error) {
      console.error("Error creating group conversation:", error);
      res.status(500).json({ message: "Failed to create group conversation" });
    }
  });

  // Get messages for a conversation
  app.get('/api/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;
      const userId = req.user.claims.sub;
      
      // Check if user is participant
      const isParticipant = await storage.isUserInConversation(userId, id);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const messages = await storage.getMessages(
        id, 
        limit ? parseInt(limit as string) : undefined,
        offset ? parseInt(offset as string) : undefined
      );
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send a message
  app.post('/api/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Check if user is participant
      const isParticipant = await storage.isUserInConversation(userId, id);
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { content } = insertMessageSchema.parse({
        ...req.body,
        conversationId: id,
        senderId: userId,
      });
      
      const message = await storage.createMessage({
        conversationId: id,
        senderId: userId,
        content,
      });
      
      // Broadcast message to all participants via WebSocket
      const conversation = await storage.getConversation(id);
      if (conversation) {
        const participantIds = conversation.participants.map(p => p.userId);
        console.log(`Broadcasting message to participants:`, participantIds);
        for (const participantId of participantIds) {
          const ws = wsConnections.get(participantId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            console.log(`Sending WebSocket message to user ${participantId}`);
            ws.send(JSON.stringify({
              type: 'new_message',
              message,
              conversationId: id,
            }));
          } else {
            console.log(`User ${participantId} not connected or WebSocket closed`);
          }
        }
      }
      
      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let userId: string | null = null;

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          userId = message.userId;
          if (userId) {
            wsConnections.set(userId, ws);
            console.log(`User ${userId} connected via WebSocket`);
          }
        }
        
        if (message.type === 'typing' && userId) {
          // Broadcast typing indicator to other participants
          const { conversationId, isTyping } = message;
          storage.getConversation(conversationId).then(conversation => {
            if (conversation) {
              const participantIds = conversation.participants
                .map(p => p.userId)
                .filter(id => id !== userId);
              
              for (const participantId of participantIds) {
                const participantWs = wsConnections.get(participantId);
                if (participantWs && participantWs.readyState === WebSocket.OPEN) {
                  participantWs.send(JSON.stringify({
                    type: 'typing',
                    conversationId,
                    userId,
                    isTyping,
                  }));
                }
              }
            }
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        wsConnections.delete(userId);
        console.log(`User ${userId} disconnected from WebSocket`);
      }
    });
  });

  return httpServer;
}
