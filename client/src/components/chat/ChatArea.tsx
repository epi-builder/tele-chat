import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Menu, Search, MoreVertical, Paperclip, Send, Settings, LogOut, Users, MessageSquare, Info } from "lucide-react";
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: conversationData } = useQuery<ConversationWithParticipants[]>({
    queryKey: ["/api/conversations"],
  });

  const conversation = conversationData?.find(c => c.id === conversationId);

  const { data: messages = [], isLoading: messagesLoading, error: messagesError } = useQuery<MessageWithSender[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
    enabled: !!conversationId,
  });

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
      const otherUser = conversation.participants?.find(p => p.userId !== user?.id)?.user;
      if (!otherUser) return "Loading...";
      return `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || otherUser.email || "Unknown User";
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

  if (!conversation && conversationData) {
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-600">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>채팅방 설정</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>참가자 관리</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center space-x-2 text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4" />
                <span>나가기</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Chat Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>채팅방 설정</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Chat Name Section */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">채팅방 이름</h3>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">{getConversationName()}</p>
              </div>
            </div>

            {/* Participants Section */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">참가자</h3>
              <div className="space-y-2">
                {conversation?.participants?.map((participant) => (
                  <div key={participant.userId} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={participant.user.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                        {`${participant.user.firstName?.[0] || ''}${participant.user.lastName?.[0] || ''}` || 
                         participant.user.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {`${participant.user.firstName || ''} ${participant.user.lastName || ''}`.trim() || 
                         participant.user.email || 'Unknown User'}
                        {participant.userId === user?.id && ' (나)'}
                      </p>
                      <p className="text-xs text-gray-500">
                        @{participant.user.email?.split('@')[0] || 'user'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Info */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">채팅방 정보</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>채팅방 유형:</span>
                  <span>{conversation?.isGroup ? '그룹 채팅' : '개인 채팅'}</span>
                </div>
                <div className="flex justify-between">
                  <span>참가자 수:</span>
                  <span>{conversation?.participants?.length || 0}명</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => {
                  // 참가자 관리 기능 추가 예정
                  toast({
                    title: "준비 중",
                    description: "참가자 관리 기능은 준비 중입니다.",
                  });
                }}
              >
                <Users className="w-4 h-4 mr-2" />
                참가자 관리
              </Button>
              <Button 
                variant="destructive" 
                className="w-full justify-start"
                onClick={() => {
                  // 나가기 기능 추가 예정
                  toast({
                    title: "준비 중",
                    description: "채팅방 나가기 기능은 준비 중입니다.",
                  });
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                채팅방 나가기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
