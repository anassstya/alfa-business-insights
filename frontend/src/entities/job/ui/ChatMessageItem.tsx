import { VisuallyHidden } from "@/shared";
import { isPendingChatMessage } from "../model/chat";
import type { ChatMessage as ChatMessageData } from "../model/types";
import { ChatBubble } from "./ChatMessageItem.styled";

/** Сообщение сессии чата (ChatMessage) */
const ChatMessageItem = ({ message }: { message: ChatMessageData }) => (
  <ChatBubble $author={message.role} $pending={isPendingChatMessage(message)}>
    <VisuallyHidden>{message.role === 'user' ? 'Вы: ' : 'Ассистент: '}</VisuallyHidden>
    {message.content}
  </ChatBubble>
)

export { ChatMessageItem };
