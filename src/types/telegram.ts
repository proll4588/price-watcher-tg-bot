import { Message } from "telegraf/typings/core/types/typegram";

// Тип для текстового сообщения
export interface TextMessage extends Message.TextMessage {
  text: string;
}

// Тип для callback query
export interface CallbackQuery {
  id: string;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    language_code?: string;
  };
  message?: Message;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
}

// Тип для inline keyboard
export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: {
    url: string;
  };
  login_url?: {
    url: string;
    forward_text?: string;
    bot_username?: string;
    request_write_access?: boolean;
  };
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  callback_game?: {};
  pay?: boolean;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

// Тип для опций отправки сообщения
export interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: InlineKeyboardMarkup;
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
}
