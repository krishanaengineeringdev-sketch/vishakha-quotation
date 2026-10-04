import { useState, useEffect } from 'react';
import { getPendingSyncCount } from '../db/localDb';

/**
 * Custom hook providing real-time online status and sync activity tracking.
 * Reacts to online/offline browser events and localDb synchronization broadcasts.
 */
export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Initial pending count
    getPendingSyncCount().then((count) => {
      setPendingCount(count);
    }).catch(() => {});

    const handleOnline = () => {
      setIsOnline(true);
      getPendingSyncCount().then((count) => {
        setPendingCount(count);
      }).catch(() => {});
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
      getPendingSyncCount().then((count) => {
        setPendingCount(count);
      }).catch(() => {});
    };

    const handleSyncStatus = (e) => {
      if (e?.detail) {
        setIsSyncing(Boolean(e.detail.isSyncing));
        if (typeof e.detail.pendingCount === 'number') {
          setPendingCount(e.detail.pendingCount);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('vishakha-sync-status', handleSyncStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('vishakha-sync-status', handleSyncStatus);
    };
  }, []);

  return { isOnline, isSyncing, pendingCount };
}
