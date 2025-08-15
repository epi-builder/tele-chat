import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(userId: string, conversationId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (!userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Authenticate with the server
        ws.send(JSON.stringify({
          type: 'auth',
          userId,
        }));
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000;
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received WebSocket message:", message);
          handleMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [userId]);

  const handleMessage = (message: WebSocketMessage) => {
    console.log("Handling WebSocket message:", message);
    switch (message.type) {
      case 'new_message':
        // Invalidate messages query for the conversation
        if (message.conversationId) {
          console.log("Invalidating queries for conversation:", message.conversationId);
          queryClient.invalidateQueries({ 
            queryKey: [`/api/conversations/${message.conversationId}/messages`] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ["/api/conversations"] 
          });
        }
        window.dispatchEvent(new CustomEvent('new_message', { detail: message }));
        break;
      case 'typing':
        // Handle typing indicators
        window.dispatchEvent(new CustomEvent('user_typing', { detail: message }));
        break;
      default:
        console.log("Unknown message type:", message.type);
    }
  };

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not connected");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [userId, connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    disconnect,
  };
}
