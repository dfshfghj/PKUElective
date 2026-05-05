import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AppConfig,
  AuthStateView,
  BotView,
  Course,
  MessageEvent,
  SnapshotView,
  WishlistItem,
} from "./types";

export const EVENT_SNAPSHOT = "app://snapshot";
export const EVENT_AUTH = "app://auth-updated";
export const EVENT_BOTS = "app://bots-updated";
export const EVENT_COURSES = "app://courses-updated";
export const EVENT_WISHLIST = "app://wishlist-updated";
export const EVENT_CONFIG = "app://config-updated";
export const EVENT_MESSAGE = "app://message";

export type EventHandlers = {
  onSnapshot: (payload: SnapshotView) => void;
  onAuth: (payload: AuthStateView) => void;
  onBots: (payload: BotView[]) => void;
  onCourses: (payload: Course[]) => void;
  onWishlist: (payload: WishlistItem[]) => void;
  onConfig: (payload: AppConfig) => void;
  onMessage: (payload: MessageEvent) => void;
};

export async function subscribeToAppEvents(handlers: EventHandlers): Promise<UnlistenFn> {
  const unlisteners = await Promise.all([
    listen<SnapshotView>(EVENT_SNAPSHOT, (event) => handlers.onSnapshot(event.payload)),
    listen<AuthStateView>(EVENT_AUTH, (event) => handlers.onAuth(event.payload)),
    listen<BotView[]>(EVENT_BOTS, (event) => handlers.onBots(event.payload)),
    listen<Course[]>(EVENT_COURSES, (event) => handlers.onCourses(event.payload)),
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
