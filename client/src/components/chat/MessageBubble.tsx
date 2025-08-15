import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Check, CheckCheck } from "lucide-react";
import type { MessageWithSender } from "@shared/schema";

interface MessageBubbleProps {
  message: MessageWithSender;
  isOwnMessage: boolean;
  showAvatar?: boolean;
}

export default function MessageBubble({ message, isOwnMessage, showAvatar }: MessageBubbleProps) {
  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  const getSenderName = () => {
    return `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || 
           message.sender.email?.split('@')[0] || 'Unknown';
  };

  const getAvatarFallback = () => {
    return `${message.sender.firstName?.[0] || ''}${message.sender.lastName?.[0] || ''}` || 
           message.sender.email?.[0]?.toUpperCase() || 'U';
  };

  if (isOwnMessage) {
    return (
      <div className="flex items-start space-x-2 flex-row-reverse">
        <div className="max-w-xs lg:max-w-md">
          <div className="bg-blue-600 p-3 rounded-2xl rounded-tr-md shadow-sm">
            <p className="text-white break-words">{message.content}</p>
          </div>
          <div className="flex items-center space-x-2 mt-1 mr-2 justify-end">
            <span className="text-xs text-gray-500">
              {formatTime(message.createdAt?.toString() || '')}
            </span>
            <CheckCheck className="w-3 h-3 text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-2">
      {showAvatar && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={message.sender.profileImageUrl || undefined} />
          <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
            {getAvatarFallback()}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="max-w-xs lg:max-w-md">
        {showAvatar && (
          <div className="text-xs text-gray-600 mb-1 ml-2">
            {getSenderName()}
          </div>
        )}
        <div className="bg-white p-3 rounded-2xl rounded-tl-md shadow-sm">
          <p className="text-gray-900 break-words">{message.content}</p>
        </div>
        <div className="flex items-center space-x-2 mt-1 ml-2">
          <span className="text-xs text-gray-500">
            {formatTime(message.createdAt?.toString() || '')}
          </span>
        </div>
      </div>
    </div>
  );
}
