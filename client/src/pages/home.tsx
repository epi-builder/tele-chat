import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium">Connecting to TeleChat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      <div className="flex h-full">
        {/* Mobile sidebar overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          w-80 bg-white border-r border-gray-200 flex flex-col
          lg:relative lg:translate-x-0
          ${isSidebarOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden lg:flex'}
        `}>
          <ChatSidebar 
            user={user}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
            onCloseSidebar={() => setIsSidebarOpen(false)}
          />
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          {selectedConversationId ? (
            <ChatArea 
              conversationId={selectedConversationId}
              onOpenSidebar={() => setIsSidebarOpen(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden mb-4"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5 mr-2" />
                  Open Chats
                </Button>
                <div className="text-gray-500 text-lg">
                  Select a conversation to start messaging
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
