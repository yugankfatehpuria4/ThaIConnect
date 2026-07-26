'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let socketInstance: Socket | null = null;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    // The httpOnly session cookie can't reach the cross-origin socket, so we
    // exchange it (via the same-origin /api proxy) for a short-lived ticket and
    // authenticate the handshake with that. The server derives identity from
    // the ticket and auto-joins the user's own room — the client no longer
    // tells the server which room to join.
    async function fetchTicket(): Promise<string | null> {
      try {
        const res = await fetch('/api/auth/socket-ticket', { credentials: 'include' });
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data?.ticket === 'string' ? data.ticket : null;
      } catch {
        return null;
      }
    }

    (async () => {
      const ticket = await fetchTicket();
      if (cancelled || !ticket) return; // not signed in → no socket

      const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';
      const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io';

      socketInstance = io(backendUrl, {
        path: socketPath,
        transports: ['polling', 'websocket'],
        withCredentials: true,
        auth: { token: ticket },
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 800,
        reconnectionDelayMax: 4000,
        timeout: 10000,
      });

      socketInstance.on('connect', () => {
        setSocket(socketInstance);
        setIsConnected(true);
      });

      socketInstance.on('disconnect', () => setIsConnected(false));

      socketInstance.on('connect_error', async () => {
        // Most likely the 60s ticket expired — mint a fresh one for the retry.
        const fresh = await fetchTicket();
        if (fresh && socketInstance) {
          socketInstance.auth = { token: fresh };
        }
      });

      // Keep a fresh ticket ready ahead of the 60s expiry so reconnects succeed.
      refreshTimer = setInterval(async () => {
        const fresh = await fetchTicket();
        if (fresh && socketInstance) socketInstance.auth = { token: fresh };
      }, 45000);
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
