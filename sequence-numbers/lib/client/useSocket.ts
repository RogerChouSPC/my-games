'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientView, PlayerInput } from '@/types/game';

const ID_KEY = 'sn_playerId';
const NAME_KEY = 'sn_name';
const ICON_KEY = 'sn_icon';

export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = 'pl_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getSavedProfile(): { name: string; icon: number } | null {
  if (typeof window === 'undefined') return null;
  const name = localStorage.getItem(NAME_KEY);
  const icon = localStorage.getItem(ICON_KEY);
  if (name && icon) return { name, icon: Number(icon) };
  return null;
}

export function saveProfile(name: string, icon: number): void {
  localStorage.setItem(NAME_KEY, name);
  localStorage.setItem(ICON_KEY, String(icon));
}

export function getPlayerInput(): PlayerInput {
  const profile = getSavedProfile();
  return { id: getPlayerId(), name: profile?.name ?? '', icon: profile?.icon ?? 1 };
}

export interface ReactionEvent {
  playerId: string;
  emoji: string;
  key: number;
}

export function useSocket() {
  const ref = useRef<Socket | null>(null);
  const [view, setView] = useState<ClientView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reaction, setReaction] = useState<ReactionEvent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io({ transports: ['websocket', 'polling'] });
    ref.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('state', (v: ClientView) => setView(v));
    s.on('error-msg', (m: string) => setError(m));
    s.on('reaction', (r: { playerId: string; emoji: string }) =>
      setReaction({ ...r, key: Date.now() + Math.random() })
    );
    return () => {
      s.close();
    };
  }, []);

  const emit = useCallback((event: string, payload: unknown) => {
    ref.current?.emit(event, payload);
  }, []);

  const onJoined = useCallback((cb: (code: string) => void) => {
    ref.current?.on('joined', ({ code }: { code: string }) => cb(code));
  }, []);

  return { view, error, reaction, connected, emit, onJoined, clearError: () => setError(null) };
}
