import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, Search, Plus, X } from "lucide-react";
import { format } from "date-fns";
import type { User, ConversationWithParticipants } from "@shared/schema";
import NewChatDialog from "./NewChatDialog";

interface ChatSidebarProps {
  user: User;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCloseSidebar: () => void;
}

export default function ChatSidebar({ 
  user, 
  selectedConversationId, 
  onSelectConversation,
  onCloseSidebar 
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery<ConversationWithParticipants[]>({
    queryKey: ["/api/conversations"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      window.location.href = "/api/logout";
    },
  });

  const getConversationName = (conversation: ConversationWithParticipants) => {
    if (conversation.isGroup) {
      return conversation.name || "Unnamed Group";
    } else {
      // For direct conversations, show the other user's name
      const otherUser = conversation.participants.find(p => p.userId !== user.id)?.user;
      return otherUser ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || otherUser.email : "Unknown User";
    }
  };

  const getConversationAvatar = (conversation: ConversationWithParticipants) => {
    if (conversation.isGroup) {
      return null; // Will show initials
    } else {
      const otherUser = conversation.participants.find(p => p.userId !== user.id)?.user;
      return otherUser?.profileImageUrl;
    }
  };

  const getAvatarFallback = (conversation: ConversationWithParticipants) => {
    if (conversation.isGroup) {
      const name = conversation.name || "Group";
      return name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
    } else {
      const otherUser = conversation.participants.find(p => p.userId !== user.id)?.user;
      if (otherUser) {
        return `${otherUser.firstName?.[0] || ''}${otherUser.lastName?.[0] || ''}` || otherUser.email?.[0]?.toUpperCase() || 'U';
      }
      return 'U';
    }
  };

  const formatLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return format(date, 'h:mm a');
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return format(date, 'EEEE');
    } else {
      return format(date, 'MM/dd/yy');
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    const name = getConversationName(conversation).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleNewChatCreated = (conversationId: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    onSelectConversation(conversationId);
    setIsNewChatOpen(false);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 bg-blue-600 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="bg-white/20 text-white">
                  {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` || user.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">
                  {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                </div>
                <div className="text-xs text-white/70">
                  @{user.email?.split('@')[0] || 'user'}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={handleLogout}
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 lg:hidden"
                onClick={onCloseSidebar}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search messages or users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20"
            />
            <Search className="absolute right-3 top-3 w-4 h-4 text-white/60" />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors p-4 ${
                  selectedConversationId === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={getConversationAvatar(conversation) || undefined} />
                      <AvatarFallback className={conversation.isGroup ? "bg-green-500 text-white" : "bg-blue-100 text-blue-600"}>
                        {getAvatarFallback(conversation)}
                      </AvatarFallback>
                    </Avatar>
                    {!conversation.isGroup && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900 truncate">
                        {getConversationName(conversation)}
                      </div>
                      {conversation.lastMessage && (
                        <div className="text-xs text-gray-500">
                          {formatLastMessageTime(conversation.lastMessage.createdAt!)}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {conversation.lastMessage ? (
                        <>
                          {conversation.isGroup && (
                            <span className="font-medium">
                              {conversation.lastMessage.sender.firstName || conversation.lastMessage.sender.email}:{' '}
                            </span>
                          )}
                          {conversation.lastMessage.content}
                        </>
                      ) : (
                        <span className="italic">No messages yet</span>
                      )}
                    </div>
                  </div>
                  {conversation.unreadCount && conversation.unreadCount > 0 && (
                    <Badge variant="default" className="bg-blue-600">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-t border-gray-200">
          <Button 
            onClick={() => setIsNewChatOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

      <NewChatDialog
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onChatCreated={handleNewChatCreated}
        currentUser={user}
      />
    </>
  );
}
