'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { playArrivalChime, playMessageChime, playApprovalChime } from '@/lib/livechat-audio';

const SUPABASE_URL = 'https://nyoegrnemmravwqdcqnp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2Vncm5lbW1yYXZ3cWRjcW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0MzEzMywiZXhwIjoyMTAzNDE5MTMzfQ.Q44BHkMZ_j1HfPLiPkxHNtC5wwEvS72AYOsvjaqQ49Q';
const REALTIME_CHANNEL = 'teals-live-crm-stream';

interface LiveChatAlertContextValue {
  unreadMessagesCount: number;
  hasLiveVisitor: boolean;
  hasPendingApproval: boolean;
  clearBadges: () => void;
}

const LiveChatAlertContext = createContext<LiveChatAlertContextValue>({
  unreadMessagesCount: 0,
  hasLiveVisitor: false,
  hasPendingApproval: false,
  clearBadges: () => {},
});

export function LiveChatAlertProvider({ children }: { children: ReactNode }) {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [hasLiveVisitor, setHasLiveVisitor] = useState<boolean>(false);
  const [hasPendingApproval, setHasPendingApproval] = useState<boolean>(false);

  const clearBadges = useCallback(() => {
    setUnreadMessagesCount(0);
    setHasLiveVisitor(false);
    setHasPendingApproval(false);
  }, []);

  // Check if current user is currently viewing the livechat page
  const isViewingLiveChat = () => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.startsWith('/livechat');
  };

  useEffect(() => {
    const knownVisitorsRef = new Set<string>();
    const knownMsgIdsRef = new Set<string>();
    let isInitialLoaded = false;

    // Fast 2.5s polling loop to guarantee 100% arrival detection even if WebSockets are suspended
    const pollSync = async () => {
      try {
        const res = await fetch('https://teals-livechat-saas.vercel.app/api/sync?property=all');
        if (!res.ok) return;
        const data = await res.json();

        const visitors: Array<{ id?: string; visitor_token?: string; ip_address?: string; property_slug?: string }> = Array.isArray(data.visitors) ? data.visitors : [];
        if (!isInitialLoaded) {
          visitors.forEach(v => {
            const key = v.id || v.visitor_token || v.ip_address;
            if (key) knownVisitorsRef.add(key);
          });
          const convs: any[] = Array.isArray(data.conversations) ? data.conversations : [];
          convs.forEach(c => {
            (c.messages || []).forEach((m: any) => {
              if (m.id) knownMsgIdsRef.add(m.id);
            });
          });
          isInitialLoaded = true;
          if (visitors.length > 0) setHasLiveVisitor(true);
          return;
        }

        // Detect new visitors
        let newVisitorDetected = false;
        visitors.forEach(v => {
          const key = v.id || v.visitor_token || v.ip_address;
          if (key && !knownVisitorsRef.has(key)) {
            knownVisitorsRef.add(key);
            newVisitorDetected = true;
          }
        });

        if (newVisitorDetected) {
          setHasLiveVisitor(true);
          playArrivalChime();
        }

        // Detect new incoming messages
        const convs: any[] = Array.isArray(data.conversations) ? data.conversations : [];
        let newMsgDetected = false;
        convs.forEach(c => {
          (c.messages || []).forEach((m: any) => {
            if (m.id && !knownMsgIdsRef.has(m.id)) {
              knownMsgIdsRef.add(m.id);
              if (m.sender_type === 'visitor') {
                newMsgDetected = true;
              }
            }
          });
        });

        if (newMsgDetected) {
          playMessageChime();
        }
      } catch {}
    };

    pollSync();
    const pollInterval = setInterval(pollSync, 2500);

    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 50 } }
    });

    const channel = client.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } }
    });

    channel
      // 🟢 1. VISITOR ARRIVAL / IP DETECTED (Green chime & green badge)
      .on('broadcast', { event: 'visitor_arrival' }, (payload: any) => {
        const raw = payload?.payload || payload;
        const prop = raw?.propertySlug || 'Website';
        const cleanProp = prop.replace(/-/g, ' ').toUpperCase();
        const sid = raw?.session?.id || raw?.sessionId || raw?.id || '';

        setHasLiveVisitor(true);

        if (!isViewingLiveChat()) {
          playArrivalChime();
          toast.success(`🟢 Live Visitor Detected: Active on ${cleanProp}`, {
            description: 'A new visitor is actively browsing your site.',
            action: {
              label: 'Open LiveChat',
              onClick: () => {
                window.location.href = '/livechat';
              }
            }
          });
        }
      })

      // 🔴 2. VISITOR MESSAGE ARRIVED (Red message pop chime & red count badge)
      .on('broadcast', { event: 'chat_message' }, (payload: any) => {
        const raw = payload?.payload || payload;
        const msg = raw?.message;
        const isHandoff = raw?.isHandoffRequested;

        if (isHandoff) {
          setHasPendingApproval(true);
          if (!isViewingLiveChat()) {
            playApprovalChime();
            toast.warning('🟡 Live Support Requested: Visitor asking for human agent', {
              action: {
                label: 'Claim Chat',
                onClick: () => {
                  window.location.href = '/livechat';
                }
              }
            });
          }
        } else if (msg && msg.sender_type === 'visitor') {
          if (!isViewingLiveChat()) {
            playMessageChime();
            setUnreadMessagesCount((prev) => prev + 1);
            const sender = msg.sender_name || 'Visitor';
            const snippet = (msg.content || '').length > 45 ? (msg.content || '').substring(0, 45) + '...' : msg.content;
            toast.info(`🔴 ${sender}: ${snippet}`, {
              description: 'New incoming customer message.',
              action: {
                label: 'Reply Now',
                onClick: () => {
                  window.location.href = '/livechat';
                }
              }
            });
          }
        }
      })

      // 🟡 3. AGENT APPROVAL REQUEST (Yellow chime & yellow badge)
      .on('broadcast', { event: 'agent_approval_request' }, (payload: any) => {
        const raw = payload?.payload || payload;
        const name = raw?.name || raw?.email || 'New Agent';
        setHasPendingApproval(true);
        playApprovalChime();

        if (!isViewingLiveChat()) {
          toast.warning(`🟡 Agent Approval: ${name} submitted registration`, {
            description: 'Admin approval required in CRM dashboard.',
            action: {
              label: 'Review',
              onClick: () => {
                window.location.href = '/admin';
              }
            }
          });
        }
      })

      // 🧹 4. SYSTEM RESET (Clear all badges)
      .on('broadcast', { event: 'system_reset' }, () => {
        clearBadges();
      })
      .on('broadcast', { event: 'stats_reset' }, () => {
        clearBadges();
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      client.removeChannel(channel);
    };
  }, [clearBadges]);

  // If user is currently on /livechat, automatically clear badges
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleRouteChange = () => {
        if (window.location.pathname.startsWith('/livechat')) {
          clearBadges();
        }
      };
      handleRouteChange();
      window.addEventListener('popstate', handleRouteChange);
      return () => window.removeEventListener('popstate', handleRouteChange);
    }
  }, [clearBadges]);

  return (
    <LiveChatAlertContext.Provider
      value={{
        unreadMessagesCount,
        hasLiveVisitor,
        hasPendingApproval,
        clearBadges,
      }}
    >
      {children}
    </LiveChatAlertContext.Provider>
  );
}

export function useLiveChatAlert() {
  return useContext(LiveChatAlertContext);
}
