'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import {
  playArrivalSound,
  playMessageSound,
  startWaitingForHumanBeep,
  stopWaitingForHumanBeep,
  createWorkerInterval,
  flashTabTitle,
  stopTabTitleFlash,
  showBackgroundNotification,
  requestNotificationPermission,
} from '@/lib/livechat-audio';
import { isAdminEmail } from '@/lib/crm-data';
import { supabase as crmDb } from '@/lib/supabase';

const SUPABASE_URL = 'https://nyoegrnemmravwqdcqnp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b2Vncm5lbW1yYXZ3cWRjcW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0MzEzMywiZXhwIjoyMTAzNDE5MTMzfQ.Q44BHkMZ_j1HfPLiPkxHNtC5wwEvS72AYOsvjaqQ49Q';
const REALTIME_CHANNEL = 'teals-live-crm-stream';
const VAPID_PUBLIC_KEY = 'BDTKuV_i82zNSjdvc7nbNWFCKdNWXMS9MJzfyicFf92CU125xnYAY8eAsn_gCvZHsR6bgYxNcXhXRtLTjhfa9Ks';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function syncWebPushSubscription(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if ('Notification' in window && Notification.permission !== 'granted') {
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
    }

    const rawSession =
      window.sessionStorage.getItem('teals-crm-session') ||
      window.localStorage.getItem('teals-crm-session');
    const u = rawSession ? JSON.parse(rawSession) : {};
    const email = (u?.email || '').toLowerCase().trim();
    const isAdm =
      u?.role === 'admin' ||
      isAdminEmail(email) ||
      [
        'garryamelia6265@gmail.com',
        'tzafar04@gmail.com',
        'annusraees@gmail.com',
        'jennifer.cisternino2027@gmail.com',
      ].includes(email);

    await fetch('https://teals-livechat-saas.vercel.app/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        email,
        role: isAdm ? 'admin' : u?.role || 'agent',
        assigned_websites: Array.isArray(u?.assigned_websites) ? u.assigned_websites : [],
      }),
    });
  } catch (err) {
    // Non-blocking if browser blocks push
  }
}

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

const globalKnownVisitorTokens = new Set<string>();

export function LiveChatAlertProvider({ children }: { children: ReactNode }) {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [hasLiveVisitor, setHasLiveVisitor] = useState<boolean>(false);
  const [hasPendingApproval, setHasPendingApproval] = useState<boolean>(false);
  const [activeToasts, setActiveToasts] = useState<Array<{
    id: string;
    type: 'visitor' | 'message' | 'handoff';
    title: string;
    description: string;
    actionUrl: string;
  }>>([]);

  const addSideToast = useCallback((toastData: {
    id: string;
    type: 'visitor' | 'message' | 'handoff';
    title: string;
    description: string;
    actionUrl?: string;
  }) => {
    setActiveToasts((prev) => {
      const filtered = prev.filter((t) => t.id !== toastData.id);
      return [{ ...toastData, actionUrl: toastData.actionUrl || '/livechat' }, ...filtered].slice(0, 4);
    });
    setTimeout(() => {
      setActiveToasts((prev) => prev.filter((t) => t.id !== toastData.id));
    }, 7000);
  }, []);

  const clearBadges = useCallback(() => {
    setUnreadMessagesCount(0);
    setHasLiveVisitor(false);
    stopTabTitleFlash();
  }, []);

  useEffect(() => {
    // Request desktop notification permission and sync Web Push subscription on mount
    requestNotificationPermission()
      .then(() => syncWebPushSubscription())
      .catch(() => {});

    const handleUserGesturePushSync = () => {
      syncWebPushSubscription().catch(() => {});
    };
    window.addEventListener('click', handleUserGesturePushSync, { once: true, passive: true });

    const knownVisitorTokens = new Set<string>();
    const knownMsgIdsRef = new Set<string>();
    const recentAlertsMap = new Map<string, number>();
    let isInitialLoaded = false;
    const activeLockedConvsRef = new Set<string>();

    const normalizeVisitorToken = (raw: any): string => {
      if (!raw) return '';
      let str = String(raw).trim();
      str = str.replace(/^[sv]_+/, '');
      if (str.includes('___')) {
        str = str.split('___').pop() || str;
      }
      return str.trim();
    };

    const getNormalizedVisitorKey = (item: any): string => {
      if (!item) return '';
      const rawToken =
        item.visitor_token ||
        item.visitorToken ||
        item.session?.visitor_token ||
        item.sessionId ||
        item.session?.id ||
        item.id ||
        item.ip_address ||
        item.session?.ip_address ||
        '';
      const cleanToken = normalizeVisitorToken(rawToken);
      const prop = (item.property_slug || item.propertySlug || item.session?.property_slug || item.session?.propertySlug || 'website').toLowerCase().trim();
      return `${prop}___${cleanToken}`;
    };

    const getNormalizedMsgKey = (msg: any): string => {
      if (!msg) return '';
      if (msg.id) return `id_${String(msg.id)}`;
      const sender = String(msg.sender_name || msg.sender_type || '');
      const content = String(msg.content || '').trim().slice(0, 80);
      const conv = String(msg.conversation_id || msg.conversationId || '');
      return `ck_${conv}_${sender}_${content}`;
    };

    let lastGlobalVisitorNoticeTime = 0;
    let lastPermissionCheckTime = 0;
    const recentVisitorAlertMap = new Map<string, number>();

    const normalizeWebsiteSlug = (raw?: string | null): string => {
      if (!raw) return '';
      const str = raw.toLowerCase().trim();
      if (str.includes('solutions') || str.includes('amz-solutions') || str.includes('amzsolutions')) return 'amz-solutions-hub';
      if (str.includes('innovators') || str.includes('amz-innovators') || str.includes('amzinnovators')) return 'amz-innovators';
      if (str.includes('breeze') || str.includes('authors-breeze') || str.includes('authorsbreeze')) return 'authors-breeze';
      if (str.includes('pro-book') || str.includes('probook') || str.includes('publishing')) return 'pro-book-publishing';
      if (str.includes('writers') || str.includes('amz-writers') || str.includes('amzwriters')) return 'amz-writers-hub';
      if (str.includes('patch') || str.includes('promos') || str.includes('patchandpromos')) return 'patch-and-promos';
      return str;
    };

    const refreshAgentAssignedWebsites = async () => {
      try {
        const rawSession = window.sessionStorage.getItem("teals-crm-session") || window.localStorage.getItem("teals-crm-session");
        if (!rawSession) return;
        const u = JSON.parse(rawSession);
        const myEmail = (u?.email || '').toLowerCase().trim();
        if (!myEmail) return;

        const { data: prof } = await crmDb.from("profiles").select("avatar_url, role").eq("email", myEmail).maybeSingle();
        if (prof?.avatar_url) {
          try {
            const parsed = JSON.parse(prof.avatar_url);
            if (Array.isArray(parsed.assigned_websites)) {
              const currentList = Array.isArray(u.assigned_websites) ? u.assigned_websites : [];
              if (JSON.stringify(currentList) !== JSON.stringify(parsed.assigned_websites)) {
                u.assigned_websites = parsed.assigned_websites;
                window.sessionStorage.setItem("teals-crm-session", JSON.stringify(u));
                window.localStorage.setItem("teals-crm-session", JSON.stringify(u));
                syncWebPushSubscription().catch(() => {});
              }
            }
          } catch {}
        }
      } catch {}
    };

    // Proactively fetch latest assigned_websites from CRM Supabase on mount
    refreshAgentAssignedWebsites();

    const isPropertyAllowedForCurrentUser = (propertySlug?: string): boolean => {
      if (!propertySlug) return false;
      try {
        const raw = window.sessionStorage.getItem("teals-crm-session") || window.localStorage.getItem("teals-crm-session");
        if (!raw) return false;
        const u = JSON.parse(raw);
        const email = (u?.email || '').toLowerCase().trim();
        const isAdm = u?.role === 'admin' || isAdminEmail(email) || ["garryamelia6265@gmail.com", "tzafar04@gmail.com", "annusraees@gmail.com", "jennifer.cisternino2027@gmail.com"].includes(email);
        if (isAdm) return true; // Admins hear all 5 websites without needing to select any website

        const assigned: string[] = Array.isArray(u?.assigned_websites) ? u.assigned_websites : [];
        // Working agent with 0 websites assigned -> No beep, no sound, no notifications!
        if (assigned.length === 0) return false;

        const incomingSlug = normalizeWebsiteSlug(propertySlug);
        const normalizedAssigned = assigned.map(normalizeWebsiteSlug);
        if (normalizedAssigned.includes(incomingSlug)) return true;
        if (assigned.some(a => a.toLowerCase().trim() === propertySlug.toLowerCase().trim())) return true;
        return false;
      } catch {
        return false;
      }
    };

    // Centralized Single-Alert Handler for Visitor Arrival (Strictly 1 toast, 1 silent Windows popup & 1 beep per visitor session)
    const triggerVisitorAlert = (visitor: any) => {
      const token = getNormalizedVisitorKey(visitor);
      if (!token || token === '___' || token.endsWith('___')) return;

      const rawProp = visitor?.property_slug || visitor?.propertySlug || visitor?.session?.property_slug || 'website';
      if (!isPropertyAllowedForCurrentUser(rawProp)) {
        return; // Filtered: Agent not assigned to this website
      }

      const now = Date.now();
      const propName = String(rawProp).replace(/-/g, ' ').toUpperCase();

      // Debounce: Never trigger duplicate alerts for the same visitor token/session within 15 seconds
      const lastTokenAlert = recentVisitorAlertMap.get(token) || 0;
      if (now - lastTokenAlert < 15000) {
        return;
      }

      // Global Throttle: Never trigger 2 arrival chimes within 3 seconds of each other
      if (now - lastGlobalVisitorNoticeTime < 3000) {
        return;
      }

      recentVisitorAlertMap.set(token, now);
      lastGlobalVisitorNoticeTime = now;

      setHasLiveVisitor(true);
      playArrivalSound();
      flashTabTitle('👤 (1) New Visitor!');

      const loc = [visitor?.city || visitor?.session?.city, visitor?.country || visitor?.session?.country].filter(Boolean).join(', ');
      const flag = visitor?.flag || visitor?.session?.flag || '';

      // 1. Silent Windows Desktop Notification (Single banner popup)
      showBackgroundNotification(
        `👤 New Visitor: ${propName}`,
        loc ? `${flag ? flag + ' ' : ''}Visitor active from ${loc}.` : `A new visitor is actively browsing ${propName}.`,
        '/favicon.ico',
        `visitor_arrival_${token}`,
        false,
        '/livechat?view=monitoring'
      );

      // 2. Single In-App Side Toast Popup
      addSideToast({
        id: `toast_${token}_${now}`,
        type: 'visitor',
        title: `🟢 Live Visitor: ${propName}`,
        description: loc ? `${flag ? flag + ' ' : ''}Visitor active from ${loc}.` : 'A new visitor is actively browsing your site.',
        actionUrl: '/livechat?view=monitoring',
      });
    };

    // Centralized Single-Alert Handler for Incoming Message (Strictly 1 toast, 1 silent Windows popup & 1 beep)
    const triggerMessageAlert = (msg: any, propSlug?: string) => {
      if (!msg || msg.sender_type !== 'visitor') return;

      const rawProp = propSlug || msg.property_slug || msg.propertySlug || msg.website_slug || '';
      if (rawProp && !isPropertyAllowedForCurrentUser(rawProp)) {
        return; // Filtered: Agent not assigned to this website
      }

      const msgKey = getNormalizedMsgKey(msg);
      if (!msgKey) return;

      const now = Date.now();
      const alertKey = `msg_${msgKey}`;

      if (knownMsgIdsRef.has(msgKey) || (msg.id && knownMsgIdsRef.has(String(msg.id)))) return;
      try {
        const lastSeen = localStorage.getItem(`teals_seen_${alertKey}`);
        if (lastSeen && now - Number(lastSeen) < 1800000) {
          knownMsgIdsRef.add(msgKey);
          if (msg.id) knownMsgIdsRef.add(String(msg.id));
          return;
        }
        localStorage.setItem(`teals_seen_${alertKey}`, String(now));
      } catch {}

      if (msg.id) knownMsgIdsRef.add(String(msg.id));
      knownMsgIdsRef.add(msgKey);

      setUnreadMessagesCount((prev) => prev + 1);
      playMessageSound();
      flashTabTitle('💬 (1) New Message!');

      const sender = msg.sender_name || 'Visitor';
      const rawContent = msg.content || '';
      const snippet = rawContent.length > 50 ? rawContent.substring(0, 50) + '...' : rawContent || 'Sent a new message.';

      // 1. Silent Windows Desktop Notification (ZERO OS sound)
      showBackgroundNotification(
        `💬 ${sender}`,
        snippet,
        '/favicon.ico',
        alertKey,
        false,
        '/livechat?view=chats'
      );

      // 2. Single In-App Side Toast Popup
      addSideToast({
        id: alertKey,
        type: 'message',
        title: `💬 ${sender}`,
        description: snippet,
        actionUrl: '/livechat?view=chats',
      });
    };

    // Centralized Single-Alert Handler for Human Agent Requested
    const triggerHandoffAlert = (cId: string, propSlug?: string) => {
      if (propSlug && !isPropertyAllowedForCurrentUser(propSlug)) {
        return; // Filtered
      }

      const validId = cId || 'handoff';
      activeLockedConvsRef.add(validId);
      setHasPendingApproval(true);

      const now = Date.now();
      const alertKey = `handoff_${validId}`;
      const lastAlertTime = recentAlertsMap.get(alertKey) || 0;

      // Start continuous ringer
      startWaitingForHumanBeep(validId);

      if (now - lastAlertTime < 30000) return;
      recentAlertsMap.set(alertKey, now);

      flashTabTitle('🚨 (1) Live Agent Requested!');

      // 1. Silent Windows Desktop Notification (ZERO OS sound)
      showBackgroundNotification(
        '🚨 Live Agent Requested!',
        'A customer is waiting to speak with a human support agent.',
        '/favicon.ico',
        alertKey,
        false,
        '/livechat?view=chats'
      );

      // 2. Single In-App Side Toast Popup
      addSideToast({
        id: alertKey,
        type: 'handoff',
        title: '🚨 Live Agent Requested!',
        description: 'Visitor is asking to speak with a human support agent.',
        actionUrl: '/livechat?view=chats',
      });
    };

    // Fast polling loop to detect visitor arrival and messages
    const pollSync = async () => {
      try {
        const res = await fetch('https://teals-livechat-saas.vercel.app/api/sync?property=all');
        if (!res.ok) return;
        const data = await res.json();

        const visitors: Array<any> = Array.isArray(data.visitors) ? data.visitors : [];
        const convs: any[] = Array.isArray(data.conversations) ? data.conversations : [];
        const now = Date.now();

        // Periodically refresh agent assigned websites so admin changes apply live without refresh
        if (now - lastPermissionCheckTime > 10000) {
          lastPermissionCheckTime = now;
          refreshAgentAssignedWebsites();
        }

    // Initial load seed - store existing IDs so we don't alert old history
    if (!isInitialLoaded) {
      visitors.forEach((v) => {
        const token = getNormalizedVisitorKey(v);
        if (token && token !== '___') {
          globalKnownVisitorTokens.add(token);
          try { localStorage.setItem(`teals_notif_seen_${token}`, String(now)); } catch {}
        }
      });
      convs.forEach((c) => {
        (c.messages || []).forEach((m: any) => {
          const mk = getNormalizedMsgKey(m);
          if (mk) {
            knownMsgIdsRef.add(mk);
            try { localStorage.setItem(`teals_seen_msg_${mk}`, String(now)); } catch {}
          }
          if (m.id) {
            knownMsgIdsRef.add(String(m.id));
            try { localStorage.setItem(`teals_seen_msg_id_${String(m.id)}`, String(now)); } catch {}
          }
        });
        const isRecentConv = (now - new Date(c.updated_at || c.created_at || 0).getTime()) < 90000;
        if (
          isRecentConv &&
          (c.status === 'pending_agent' || c.status === 'locked' || (c.mode === 'human' && !c.assigned_agent_id && !c.assigned_agent_name) || (c.agent_requested && !c.assigned_agent_id)) &&
          c.status !== 'closed'
        ) {
          const propSlug = c.property_slug || c.propertySlug || '';
          if (isPropertyAllowedForCurrentUser(propSlug)) {
            if (c.id) activeLockedConvsRef.add(c.id);
          }
        }
      });
      isInitialLoaded = true;
      if (visitors.some(v => v.is_online && isPropertyAllowedForCurrentUser(v.property_slug || v.propertySlug || v.session?.property_slug))) setHasLiveVisitor(true);
      if (activeLockedConvsRef.size > 0) {
        setHasPendingApproval(true);
        const firstId = Array.from(activeLockedConvsRef)[0];
        startWaitingForHumanBeep(firstId);
      } else {
        stopWaitingForHumanBeep();
      }
      return;
    }

    // Sync online state and detect any new visitor arrival from any country globally
    const hasOnline = visitors.some(v => v.is_online && isPropertyAllowedForCurrentUser(v.property_slug || v.propertySlug || v.session?.property_slug));
    setHasLiveVisitor(hasOnline);

    visitors.forEach((v) => {
      if (v.is_online) {
        const token = getNormalizedVisitorKey(v);
        if (token && token !== '___' && !globalKnownVisitorTokens.has(token)) {
          globalKnownVisitorTokens.add(token);
          triggerVisitorAlert(v);
        }
      }
    });

    // Detect new incoming visitor messages
    convs.forEach((c) => {
      const propSlug = c.property_slug || c.propertySlug || '';
      (c.messages || []).forEach((m: any) => {
        if (m.sender_type === 'visitor') {
          const mk = getNormalizedMsgKey(m);
          const hasSeen = knownMsgIdsRef.has(mk) || (m.id && knownMsgIdsRef.has(String(m.id)));
          if (!hasSeen) {
            triggerMessageAlert(m, propSlug);
          }
        }
      });
    });

        // Track locked conversations waiting for human agent (only recent within 90s)
        const unassignedLockedConvs = convs.filter((c: any) => {
          const propSlug = c.property_slug || c.propertySlug || '';
          if (propSlug && !isPropertyAllowedForCurrentUser(propSlug)) return false;
          const isRecent = (now - new Date(c.updated_at || c.created_at || 0).getTime()) < 90000;
          return (
            isRecent &&
            (c.status === 'pending_agent' || c.status === 'locked' || (c.mode === 'human' && !c.assigned_agent_id && !c.assigned_agent_name) || (c.agent_requested && !c.assigned_agent_id)) &&
            c.status !== 'closed'
          );
        });

        activeLockedConvsRef.clear();
        unassignedLockedConvs.forEach((c: any) => {
          if (c.id) activeLockedConvsRef.add(c.id);
        });

        if (activeLockedConvsRef.size > 0) {
          setHasPendingApproval(true);
          const firstLockedId = Array.from(activeLockedConvsRef)[0];
          startWaitingForHumanBeep(firstLockedId || 'locked_chat');
        } else {
          stopWaitingForHumanBeep();
          setHasPendingApproval(false);
        }
      } catch {}
    };

    pollSync();
    const stopWorkerPoll = createWorkerInterval(pollSync, 2000);

    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 50 } },
    });

    const channel = client.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true } },
    });

    channel
      // 🟢 1. VISITOR ARRIVAL EVENT
      .on('broadcast', { event: 'visitor_arrival' }, (payload: any) => {
        const raw = payload?.payload || payload;
        const session = raw?.session || {};
        const visitorData = {
          ...raw,
          ...session,
          property_slug: raw?.propertySlug || raw?.property_slug || session?.propertySlug || session?.property_slug || 'Website',
        };
        triggerVisitorAlert(visitorData);
      })

      // 🔴 2. CHAT MESSAGE EVENT
      .on('broadcast', { event: 'chat_message' }, (payload: any) => {
        const raw = payload?.payload || payload;
        const msg = raw?.message;
        const isHandoff = raw?.isHandoffRequested;
        const propSlug = raw?.propertySlug || raw?.property_slug || raw?.conversation?.property_slug || '';

        if (isHandoff) {
          const cId = raw?.conversationId || raw?.conversation?.id || 'handoff';
          triggerHandoffAlert(cId, propSlug);
        } else if (msg && msg.sender_type === 'visitor') {
          triggerMessageAlert(msg, propSlug);
        }
      })

      // 🔐 2a. AGENT PERMISSIONS UPDATED
      .on('broadcast', { event: 'agent_permissions_updated' }, (payload: any) => {
        try {
          const raw = payload?.payload || payload;
          const targetEmail = (raw?.email || '').toLowerCase().trim();
          const rawSession = window.sessionStorage.getItem("teals-crm-session") || window.localStorage.getItem("teals-crm-session");
          if (rawSession) {
            const u = JSON.parse(rawSession);
            if ((u?.email || '').toLowerCase().trim() === targetEmail) {
              const newAssigned = Array.isArray(raw?.assigned_websites) ? raw.assigned_websites : [];
              u.assigned_websites = newAssigned;
              window.sessionStorage.setItem("teals-crm-session", JSON.stringify(u));
              window.localStorage.setItem("teals-crm-session", JSON.stringify(u));
              syncWebPushSubscription().catch(() => {});

              const isUserAdmin = u?.role === 'admin' || isAdminEmail(targetEmail);
              if (!isUserAdmin && newAssigned.length === 0) {
                stopWaitingForHumanBeep();
                setHasPendingApproval(false);
                setHasLiveVisitor(false);
              }
            }
          }
        } catch {}
      })

      // 🟢 2b. CHAT CLAIMED
      .on('broadcast', { event: 'chat_claimed' }, (payload: any) => {
        const raw = payload?.payload || payload;
        const cId = raw?.conversationId || raw?.conversation?.id;
        if (cId) {
          activeLockedConvsRef.delete(cId);
          stopWaitingForHumanBeep(cId);
        }
        if (activeLockedConvsRef.size === 0) {
          stopWaitingForHumanBeep();
          setHasPendingApproval(false);
        }
      })

      // 🟢 2c. AGENT PERMISSIONS UPDATED (Instant sync when Admin assigns website)
      .on('broadcast', { event: 'agent_permissions_updated' }, (payload: any) => {
        const raw = payload?.payload || payload;
        const targetEmail = (raw?.email || '').toLowerCase().trim();
        const rawSession = window.sessionStorage.getItem("teals-crm-session") || window.localStorage.getItem("teals-crm-session");
        if (rawSession && targetEmail) {
          try {
            const u = JSON.parse(rawSession);
            if ((u?.email || '').toLowerCase().trim() === targetEmail && Array.isArray(raw?.assigned_websites)) {
              u.assigned_websites = raw.assigned_websites;
              window.sessionStorage.setItem("teals-crm-session", JSON.stringify(u));
              window.localStorage.setItem("teals-crm-session", JSON.stringify(u));
              syncWebPushSubscription().catch(() => {});
            }
          } catch {}
        }
      })

      // 🧹 3. SYSTEM RESET
      .on('broadcast', { event: 'system_reset' }, () => {
        knownVisitorTokens.clear();
        knownMsgIdsRef.clear();
        activeLockedConvsRef.clear();
        stopWaitingForHumanBeep();
        clearBadges();
        if (typeof window !== 'undefined') {
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('teals_seen_') || k.startsWith('teals_notif_')) {
                localStorage.removeItem(k);
              }
            });
          } catch {}
        }
      })
      .on('broadcast', { event: 'stats_reset' }, () => {
        knownVisitorTokens.clear();
        knownMsgIdsRef.clear();
        activeLockedConvsRef.clear();
        stopWaitingForHumanBeep();
        clearBadges();
        if (typeof window !== 'undefined') {
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('teals_seen_') || k.startsWith('teals_notif_')) {
                localStorage.removeItem(k);
              }
            });
          } catch {}
        }
      })
      .subscribe();

    return () => {
      stopWaitingForHumanBeep();
      stopWorkerPoll();
      client.removeChannel(channel);
    };
  }, [clearBadges]);

  const contextValue = React.useMemo<LiveChatAlertContextValue>(
    () => ({
      unreadMessagesCount,
      hasLiveVisitor,
      hasPendingApproval,
      clearBadges,
    }),
    [unreadMessagesCount, hasLiveVisitor, hasPendingApproval, clearBadges]
  );

  return (
    <LiveChatAlertContext.Provider value={contextValue}>
      {children}

      {/* Floating In-App Side Toast Notifications (Top-Right of screen) */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '380px',
          width: 'calc(100vw - 40px)',
          pointerEvents: 'none',
        }}
      >
        {activeToasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              borderRadius: '16px',
              padding: '16px 18px',
              backgroundColor: t.type === 'visitor' ? '#041d13' : t.type === 'handoff' ? '#271004' : '#091326',
              border: `1.5px solid ${t.type === 'visitor' ? '#10b981' : t.type === 'handoff' ? '#f59e0b' : '#3b82f6'}`,
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px rgba(16, 185, 129, 0.2)',
              color: '#ffffff',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.02em' }}>
                {t.title}
              </span>
              <button
                type="button"
                onClick={() => setActiveToasts((prev) => prev.filter((x) => x.id !== t.id))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '10px' }}>
              {t.description}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={t.actionUrl}
                onClick={(e) => {
                  e.preventDefault();
                  window.focus();
                  if (window.location.pathname + window.location.search !== t.actionUrl) {
                    window.location.href = t.actionUrl;
                  }
                  setActiveToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: t.type === 'visitor' ? '#059669' : t.type === 'handoff' ? '#d97706' : '#2563eb',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                {t.type === 'visitor' ? 'View Live Visitor →' : 'Open LiveChat →'}
              </a>
            </div>
          </div>
        ))}
      </div>
    </LiveChatAlertContext.Provider>
  );
}

export function useLiveChatAlert() {
  return useContext(LiveChatAlertContext);
}
