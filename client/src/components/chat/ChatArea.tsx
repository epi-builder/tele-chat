import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu, Search, Info, Paperclip, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ConversationWithParticipants, MessageWithSender } from "@shared/schema";
import MessageBubble from "./MessageBubble";

interface ChatAreaProps {
  conversationId: string;
  onOpenSidebar: () => void;
}

export default function ChatArea({ conversationId, onOpenSidebar }: ChatAreaProps) {
  const [messageContent, setMessageContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: conversation } = useQuery<ConversationWithParticipants>({
    queryKey: ["/api/conversations", conversationId],
  });

  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useQuery<MessageWithSender[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
    enabled: !!conversationId,
  });

  // Debug logging
  useEffect(() => {
    console.log("ChatArea - conversationId:", conversationId);
    console.log("ChatArea - conversation:", conversation);
    console.log("ChatArea - messages:", messages);
    console.log("ChatArea - messagesLoading:", messagesLoading);
    console.log("ChatArea - messagesError:", messagesError);
    console.log("ChatArea - messages.length:", messages?.length);
    console.log("ChatArea - Should show loading:", messagesLoading);
    console.log("ChatArea - Should show empty:", !messagesLoading && (!messages || messages.length === 0));
    console.log("ChatArea - Should show messages:", !messagesLoading && messages && messages.length > 0);
  }, [conversationId, conversation, messages, messagesLoading, messagesError]);

  const { sendMessage: sendWebSocketMessage, isConnected } = useWebSocket(user?.id || '', conversationId);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest('POST', `/api/conversations/${conversationId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setMessageContent("");
      adjustTextareaHeight();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [messageContent]);

  // Handle typing indicators
  useEffect(() => {
    let typingTimeout: NodeJS.Timeout | undefined;

    if (messageContent && isConnected) {
      if (!isTyping) {
        setIsTyping(true);
        sendWebSocketMessage({
          type: 'typing',
          conversationId,
          isTyping: true,
        });
      }

      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        sendWebSocketMessage({
          type: 'typing',
          conversationId,
          isTyping: false,
        });
      }, 1000);
    }

    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [messageContent, conversationId, isConnected, isTyping, sendWebSocketMessage]);

  const handleSendMessage = () => {
    const trimmedContent = messageContent.trim();
    if (!trimmedContent) return;

    sendMessageMutation.mutate(trimmedContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getConversationName = () => {
    if (!conversation) return "Loading...";
    
    if (conversation.isGroup) {
      return conversation.name || "Unnamed Group";
    } else {
      if (!conversation.participants) return "Loading...";
      const otherUser = conversation.participants.find(p => p.userId !== user?.id)?.user;
      return otherUser ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || otherUser.email : "Unknown User";
    }
  };

  const getConversationAvatar = () => {
    if (!conversation || !conversation.participants) return null;
    
    if (conversation.isGroup) {
      return null;
    } else {
      const otherUser = conversation.participants.find(p => p.userId !== user?.id)?.user;
      return otherUser?.profileImageUrl;
    }
  };

  const getAvatarFallback = () => {
    if (!conversation || !conversation.participants) return 'L';
    
    if (conversation.isGroup) {
      const name = conversation.name || "Group";
      return name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
    } else {
      const otherUser = conversation.participants.find(p => p.userId !== user?.id)?.user;
      if (otherUser) {
        return `${otherUser.firstName?.[0] || ''}${otherUser.lastName?.[0] || ''}` || otherUser.email?.[0]?.toUpperCase() || 'U';
      }
      return 'U';
    }
  };

  if (!conversation && !messagesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Conversation not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onOpenSidebar}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </Button>
          <Avatar className="w-10 h-10">
            <AvatarImage src={getConversationAvatar() || undefined} />
            <AvatarFallback className={conversation?.isGroup ? "bg-green-500 text-white" : "bg-blue-100 text-blue-600"}>
              {getAvatarFallback()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-gray-900">{getConversationName()}</div>
            <div className="text-sm text-green-500">
              {conversation?.isGroup ? `${conversation.participants.length} members` : "online"}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="text-gray-600">
            <Search className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-600">
            <Info className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-yellow-800 bg-yellow-50 border border-yellow-200 px-4 py-3 rounded-lg inline-flex items-center">
                <Info className="w-4 h-4 mr-2" />
                <span className="text-sm">Messages are end-to-end encrypted</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.senderId === user?.id}
                showAvatar={conversation?.isGroup || false}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end space-x-3">
          <Button variant="ghost" size="icon" className="text-gray-600 mb-2">
            <Paperclip className="w-5 h-5" />
          </Button>
          <div className="flex-1 bg-gray-50 rounded-2xl p-3 min-h-[44px] max-h-32">
            <Textarea
              ref={textareaRef}
              placeholder="Type a message..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-0 p-0"
              rows={1}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!messageContent.trim() || sendMessageMutation.isPending}
            size="icon"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full mb-2"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
