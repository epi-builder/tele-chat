import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { User } from "@shared/schema";

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (conversationId: string) => void;
  currentUser: User;
}

export default function NewChatDialog({ isOpen, onClose, onChatCreated, currentUser }: NewChatDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: searchResults = [], isLoading: isSearching } = useQuery<User[]>({
    queryKey: ["/api/users/search", { q: searchQuery }],
    enabled: searchQuery.length > 0,
    queryFn: () => fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`).then(res => res.json()),
  });

  const createDirectChatMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest('POST', '/api/conversations/direct', { userId });
      return response.json();
    },
    onSuccess: (conversation) => {
      onChatCreated(conversation.id);
      resetForm();
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
        description: "Failed to create chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createGroupChatMutation = useMutation({
    mutationFn: async ({ name, participantIds }: { name: string; participantIds: string[] }) => {
      const response = await apiRequest('POST', '/api/conversations/group', { 
        name, 
        participantIds 
      });
      return response.json();
    },
    onSuccess: (conversation) => {
      onChatCreated(conversation.id);
      resetForm();
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
        description: "Failed to create group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSearchQuery("");
    setGroupName("");
    setSelectedUsers([]);
    onClose();
  };

  const handleDirectChat = (userId: string) => {
    createDirectChatMutation.mutate(userId);
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please enter a group name and select at least one user.",
        variant: "destructive",
      });
      return;
    }

    createGroupChatMutation.mutate({
      name: groupName.trim(),
      participantIds: selectedUsers,
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getUserName = (user: User) => {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
  };

  const getAvatarFallback = (user: User) => {
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` || user.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>
            Start a new conversation or create a group chat
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct" className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4" />
              <span>Direct Message</span>
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Group Chat</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Input
                  id="search"
                  placeholder="Type a name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {isSearching ? (
                <div className="text-center py-4 text-gray-500">Searching...</div>
              ) : searchResults.length === 0 && searchQuery ? (
                <div className="text-center py-4 text-gray-500">No users found</div>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => handleDirectChat(user.id)}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {getAvatarFallback(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{getUserName(user)}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="Enter group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="groupSearch">Add Members</Label>
              <div className="relative">
                <Input
                  id="groupSearch"
                  placeholder="Search users to add..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
              </div>
            </div>

            {selectedUsers.length > 0 && (
              <div className="text-sm text-gray-600">
                {selectedUsers.length} member{selectedUsers.length === 1 ? '' : 's'} selected
              </div>
            )}

            <div className="max-h-48 overflow-y-auto space-y-2">
              {isSearching ? (
                <div className="text-center py-4 text-gray-500">Searching...</div>
              ) : searchResults.length === 0 && searchQuery ? (
                <div className="text-center py-4 text-gray-500">No users found</div>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                    />
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                        {getAvatarFallback(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{getUserName(user)}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0 || createGroupChatMutation.isPending}
              className="w-full"
            >
              {createGroupChatMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
