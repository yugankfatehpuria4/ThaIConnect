'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

export type AppNotification = {
  id: number;
  title: string;
  time: number; // epoch ms
  read: boolean;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (title: string) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAllRead: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

// Session-scoped, fed by real socket events (see NotificationBridge). Replaces
// the previously hard-coded notification list. A persistent, cross-session
// notification center would need a backend collection — a post-launch feature.
export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = useCallback((title: string) => {
    setNotifications((prev) => [
      { id: Date.now() + Math.random(), title, time: Date.now(), read: false },
      ...prev,
    ].slice(0, 30));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
};
