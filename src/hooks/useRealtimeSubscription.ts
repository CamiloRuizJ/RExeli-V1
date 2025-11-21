/**
 * Real-time Supabase Subscription Hook
 * Provides real-time updates for database changes using Supabase Realtime
 * Replaces polling for better performance and instant updates
 */

import { useEffect, useRef, useCallback } from 'react';
import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

interface RealtimeSubscriptionOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  schema?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onChange?: (payload: any) => void;
}

let supabaseClient: SupabaseClient | null = null;
let configPromise: Promise<{ url: string; anonKey: string }> | null = null;

/**
 * Fetch Supabase configuration from the server
 */
async function getSupabaseConfig(): Promise<{ url: string; anonKey: string }> {
  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    try {
      const response = await fetch('/api/config/supabase');

      if (!response.ok) {
        throw new Error('Failed to fetch Supabase configuration');
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Invalid Supabase configuration response');
      }

      return result.data;
    } catch (error) {
      configPromise = null;
      throw error;
    }
  })();

  return configPromise;
}

/**
 * Get or create Supabase client with Realtime enabled
 */
async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey } = await getSupabaseConfig();

  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: false
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  });

  return supabaseClient;
}

/**
 * Hook for subscribing to real-time database changes
 *
 * @example
 * // Subscribe to new documents for current user
 * useRealtimeSubscription({
 *   table: 'user_documents',
 *   event: 'INSERT',
 *   filter: `user_id=eq.${userId}`,
 *   onInsert: (payload) => {
 *     setDocuments(prev => [payload.new, ...prev]);
 *   }
 * });
 *
 * @example
 * // Subscribe to credit changes
 * useRealtimeSubscription({
 *   table: 'users',
 *   event: 'UPDATE',
 *   filter: `id=eq.${userId}`,
 *   onUpdate: (payload) => {
 *     setCredits(payload.new.credits);
 *   }
 * });
 */
export function useRealtimeSubscription({
  table,
  event = '*',
  filter,
  schema = 'public',
  onInsert,
  onUpdate,
  onDelete,
  onChange
}: RealtimeSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);

  // Stable callback refs
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
    onChangeRef.current = onChange;
  }, [onInsert, onUpdate, onDelete, onChange]);

  const subscribe = useCallback(async () => {
    try {
      const client = await getSupabaseClient();
      clientRef.current = client;

      // Create unique channel name
      const channelName = `${table}_${filter || 'all'}_${Date.now()}`;

      const channel = client.channel(channelName);

      // Set up postgres changes listener
      const changesConfig: any = {
        event,
        schema,
        table
      };

      if (filter) {
        changesConfig.filter = filter;
      }

      channel.on('postgres_changes', changesConfig, (payload) => {
        console.log(`[Realtime] ${payload.eventType} on ${table}:`, payload);

        // Call the appropriate callback
        if (payload.eventType === 'INSERT' && onInsertRef.current) {
          onInsertRef.current(payload);
        } else if (payload.eventType === 'UPDATE' && onUpdateRef.current) {
          onUpdateRef.current(payload);
        } else if (payload.eventType === 'DELETE' && onDeleteRef.current) {
          onDeleteRef.current(payload);
        }

        // Always call onChange if provided
        if (onChangeRef.current) {
          onChangeRef.current(payload);
        }
      });

      // Subscribe to the channel
      channel.subscribe((status) => {
        console.log(`[Realtime] Subscription status for ${table}:`, status);

        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Successfully subscribed to ${table}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] Error subscribing to ${table}`);
        } else if (status === 'TIMED_OUT') {
          console.error(`[Realtime] Subscription timed out for ${table}`);
        }
      });

      channelRef.current = channel;
    } catch (error) {
      console.error('[Realtime] Subscription error:', error);
    }
  }, [table, event, filter, schema]);

  const unsubscribe = useCallback(async () => {
    if (channelRef.current && clientRef.current) {
      console.log(`[Realtime] Unsubscribing from ${table}`);
      await clientRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [table]);

  useEffect(() => {
    subscribe();

    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe]);

  return { subscribe, unsubscribe };
}

/**
 * Hook for subscribing to multiple real-time changes at once
 * Useful for dashboards that need to listen to multiple tables
 */
export function useMultipleRealtimeSubscriptions(
  subscriptions: RealtimeSubscriptionOptions[]
) {
  useEffect(() => {
    const channels: RealtimeChannel[] = [];
    let client: SupabaseClient | null = null;

    const setupSubscriptions = async () => {
      try {
        client = await getSupabaseClient();

        for (const sub of subscriptions) {
          const channelName = `${sub.table}_${sub.filter || 'all'}_${Date.now()}`;
          const channel = client.channel(channelName);

          const changesConfig: any = {
            event: sub.event || '*',
            schema: sub.schema || 'public',
            table: sub.table
          };

          if (sub.filter) {
            changesConfig.filter = sub.filter;
          }

          channel.on('postgres_changes', changesConfig, (payload) => {
            console.log(`[Realtime Multi] ${payload.eventType} on ${sub.table}:`, payload);

            if (payload.eventType === 'INSERT' && sub.onInsert) {
              sub.onInsert(payload);
            } else if (payload.eventType === 'UPDATE' && sub.onUpdate) {
              sub.onUpdate(payload);
            } else if (payload.eventType === 'DELETE' && sub.onDelete) {
              sub.onDelete(payload);
            }

            if (sub.onChange) {
              sub.onChange(payload);
            }
          });

          channel.subscribe((status) => {
            console.log(`[Realtime Multi] ${sub.table} status:`, status);
          });

          channels.push(channel);
        }
      } catch (error) {
        console.error('[Realtime Multi] Setup error:', error);
      }
    };

    setupSubscriptions();

    return () => {
      if (client && channels.length > 0) {
        console.log('[Realtime Multi] Cleaning up subscriptions');
        channels.forEach(channel => client!.removeChannel(channel));
      }
    };
  }, [subscriptions]);
}
