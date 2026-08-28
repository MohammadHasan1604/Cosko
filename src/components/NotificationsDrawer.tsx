'use client';
import React from 'react';
import { useApp } from '@/context/AppContext';
import Icon from '@/components/ui/AppIcon';

export default function NotificationsDrawer() {
  const { notificationsOpen, setNotificationsOpen, notifications, markNotificationRead, markAllNotificationsRead, branding } = useApp();

  if (!notificationsOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-xs fade-in">
      <div className="w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-2xl slide-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="BellIcon" size={20} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-2xs bg-danger text-white px-2 py-0.5 rounded-full font-semibold">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-2xs font-semibold text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setNotificationsOpen(false)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markNotificationRead(n.id)}
              className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                n.read ? 'bg-card border-border' : 'bg-primary/5 border-primary/20 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    n.type === 'warning'
                      ? 'bg-warning/10 text-warning'
                      : n.type === 'success'
                      ? 'bg-success/10 text-success'
                      : n.type === 'danger'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-info/10 text-info'
                  }`}
                >
                  <Icon
                    name={
                      n.type === 'warning'
                        ? 'ExclamationTriangleIcon'
                        : n.type === 'success'
                        ? 'CheckCircleIcon'
                        : n.type === 'danger'
                        ? 'XCircleIcon'
                        : 'InformationCircleIcon'
                    }
                    size={16}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{n.title}</p>
                    <span className="text-2xs text-muted-foreground flex-shrink-0">{n.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{n.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 text-center">
          <p className="text-2xs text-muted-foreground">{branding.appName} Real-Time Event Dispatcher</p>
        </div>
      </div>
    </div>
  );
}
