'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const hasWarnedTransportFallback = useRef(false);

  useEffect(() => {
    // Determine backend URL (usually port 5002 locally)
    const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';
    const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io';
    
    const socketInstance = io(backendUrl, {
      path: socketPath,
      transports: ['polling', 'websocket'],
      tryAllTransports: true,
      upgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
      timeout: 10000,
      withCredentials: false,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      hasWarnedTransportFallback.current = false;
      console.log('🔗 Live Socket.IO attached:', socketInstance.id);
      
      // Auto-join personal room based on stored User ID if logged in
      const localUserStr = localStorage.getItem('user');
      if (localUserStr) {
        try {
          const u = JSON.parse(localUserStr);
          const roomId = u?._id || u?.id;
          if (roomId) {
            socketInstance.emit('join', roomId);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        // Fallback for mocked non-auth testing
        socketInstance.emit('join', '000000000000000000000000');
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      const message = error?.message || 'Unknown socket connection error';
      if (message.toLowerCase().includes('websocket')) {
        if (!hasWarnedTransportFallback.current) {
          console.warn('Socket transport fallback: websocket unavailable, using polling.');
          hasWarnedTransportFallback.current = true;
        }
        return;
      }
      console.warn('Socket connection issue:', message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
