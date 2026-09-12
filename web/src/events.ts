import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AppConfig,
  AuthStateView,
  BotView,
  MessageEvent,
  AppStateView,
  WishlistItem,
} from "./types";

export const EVENT_APP_STATE = "app://app-state";
export const EVENT_AUTH = "app://auth-updated";
export const EVENT_BOTS = "app://bots-updated";
export const EVENT_WISHLIST = "app://wishlist-updated";
export const EVENT_CONFIG = "app://config-updated";
export const EVENT_MESSAGE = "app://message";

export type EventHandlers = {
  onAppState: (payload: AppStateView) => void;
  onAuth: (payload: AuthStateView) => void;
  onBots: (payload: BotView[]) => void;
  onWishlist: (payload: WishlistItem[]) => void;
  onConfig: (payload: AppConfig) => void;
  onMessage: (payload: MessageEvent) => void;
};

export async function subscribeToAppEvents(handlers: EventHandlers): Promise<UnlistenFn> {
  const unlisteners = await Promise.all([
    listen<AppStateView>(EVENT_APP_STATE, (event) => handlers.onAppState(event.payload)),
    listen<AuthStateView>(EVENT_AUTH, (event) => handlers.onAuth(event.payload)),
    listen<BotView[]>(EVENT_BOTS, (event) => handlers.onBots(event.payload)),
    listen<WishlistItem[]>(EVENT_WISHLIST, (event) => handlers.onWishlist(event.payload)),
    listen<AppConfig>(EVENT_CONFIG, (event) => handlers.onConfig(event.payload)),
    listen<MessageEvent>(EVENT_MESSAGE, (event) => handlers.onMessage(event.payload)),
  ]);

  return () => {
    for (const unlisten of unlisteners) {
      void unlisten();
    }
  };
}
