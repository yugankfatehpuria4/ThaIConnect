'use client';

import { useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useNotifications } from '@/context/NotificationContext';

// Turns real-time socket events into entries in the notification bell. Each user
// only receives events targeted at their own room, so listening to both is safe:
// patients get 'sos-accepted', donors get 'sos-alert'. Renders nothing.
export default function NotificationBridge() {
  const { socket } = useSocket();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!socket) return;

    const onAccepted = (data: { donorName?: string }) => {
      addNotification(`${data?.donorName || 'A donor'} accepted your SOS request`);
    };
    const onAlert = (data: { bloodGroup?: string; hospital?: string }) => {
      addNotification(`Urgent: ${data?.bloodGroup || 'blood'} needed${data?.hospital ? ` at ${data.hospital}` : ''}`);
    };

    socket.on('sos-accepted', onAccepted);
    socket.on('sos-alert', onAlert);
    return () => {
      socket.off('sos-accepted', onAccepted);
      socket.off('sos-alert', onAlert);
    };
  }, [socket, addNotification]);

  return null;
}
