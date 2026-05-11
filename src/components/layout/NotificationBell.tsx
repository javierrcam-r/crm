'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead, type AppNotification } from '@/lib/services/notificationsDb';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const TYPE_ICONS: Record<string, string> = {
  actividad: '📋',
  evento: '🎯',
  sistema: '🔔',
};

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    const count = await getUnreadCount();
    setUnreadCount(count);
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const data = await getMyNotifications(50);
    setNotifications(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, [loadCount]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read) {
      await markAsRead(n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    let url = n.reference_url;
    if (n.type === 'actividad' && n.reference_id && (!url || url === '/calendario')) {
      url = `/actividades/${n.reference_id}`;
    }
    if (url) {
      router.push(url);
      setOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications(prev => prev.map(x => ({ ...x, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 shadow-md hover:shadow-lg active:scale-95 transition-all"
        aria-label="Notificaciones"
      >
        <Bell className={cn('h-5 w-5', unreadCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400')} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[380px] max-h-[70vh] bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-dark-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Notificaciones</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors flex items-center gap-1"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Leer todas</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-600 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[calc(70vh-56px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Bell className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-dark-700">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors flex gap-3',
                      !n.read && 'bg-indigo-50/50 dark:bg-indigo-900/10'
                    )}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm line-clamp-1', !n.read ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300')}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {n.created_by_name && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{n.created_by_name}</span>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
