import fs from 'fs';
import path from 'path';
import type { Server, Socket } from 'socket.io';
import type { RoomState, Settings, ServerRoom, ClientView, TeamColor, PlayerInput } from '@/types/game';
import {
  startGame,
  playNumberCard,
  playPlusCard,
  playMinusCard,
  swapDeadCard,
  discardCard,
  freezeCard,
  stealCard,
  shieldCard,
  rerollCard,
  bombCard,
  autoMove,
  nextGame,
  nextRound,
  declareLastGame,
  endGame,
} from '../lib/game-engine';
import { applySettingsUpdate } from '../lib/settings';

const rooms = new Map<string, ServerRoom>();
const playerSocket = new Map<string, string>(); // playerId → socket.id
const lastReactionAt = new Map<string, number>(); // playerId → last emoji time (anti-spam)
const REACTION_COOLDOWN_MS = 3000; // one emoji per player per 3s

// Pick a random image/gif from public/<folder>. Returns a URL path, or null if the folder
// is empty/missing (the client then shows a built-in fallback animation).
const IMG_RE = /\.(gif|png|jpe?g|webp|avif)$/i;
function randomGif(folder: string): string | null {
  try {
    const dir = path.join(process.cwd(), 'public', folder);
    const files = fs.readdirSync(dir).filter((f) => IMG_RE.test(f));
    if (files.length === 0) return null;
    const pick = files[Math.floor(Math.random() * files.length)];
    return `/${folder}/${encodeURIComponent(pick)}`;
  } catch {
    return null;
  }
}

function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const COLORS: TeamColor[] = ['red', 'blue', 'green', 'yellow'];

function teamsFor(n: number) {
  return COLORS.slice(0, n).map((color) => ({ color, sequencesThisGame: 0, gameWins: 0 }));
}

function sideName(c: TeamColor): string {
  return `${c.charAt(0).toUpperCase()}${c.slice(1)} Side`;
}

function viewFor(room: ServerRoom, playerId: string): ClientView {
  // Strip server-only fields (other players' hands, the live deck).
  const { hands, _deck, ...rest } = room;
  // In self-test the host plays every side, so show the active seat's hand.
  const handOwner =
    room.settings.mode === 'selftest' && playerId === room.hostId && room.phase === 'playing'
      ? room.turnOrder[room.currentTurn]
      : playerId;
  // Card counts only (no card faces) so a Steal can show face-down cards to pick from.
  const handCounts: Record<string, number> = {};
  for (const [pid, h] of Object.entries(hands)) handCounts[pid] = h.length;
  // Hide shields on chips not owned by the viewer's team — opponents can't see them.
  // In self-test the host plays every side, so they see all shields.
  const viewerTeam = room.players.find((p) => p.id === playerId)?.team ?? null;
  const seeAll = room.settings.mode === 'selftest' && playerId === room.hostId;
  const board = seeAll
    ? rest.board
    : rest.board.map((c) => (c.shielded && c.owner !== viewerTeam ? { ...c, shielded: false } : c));
  return { ...rest, board, myHand: hands[handOwner] ?? [], myPlayerId: playerId, handCounts };
}

function broadcast(io: Server, room: ServerRoom): void {
  for (const p of room.players) {
    const sid = playerSocket.get(p.id);
    if (sid) io.to(sid).emit('state', viewFor(room, p.id));
  }
}

function winningTeamColor(room: ServerRoom): TeamColor | null {
  const top = [...room.teams].sort((a, b) => b.gameWins - a.gameWins)[0];
  return top ? top.color : null;
}

const turnTimers = new Map<string, ReturnType<typeof setTimeout>>(); // code → active turn timer

// Apply a new room state, broadcast it, (re)arm the per-turn timer, and fire any
// transient celebration. Used by both socket handlers and the auto-resolve timer.
function commitRoom(io: Server, code: string, next: ServerRoom): void {
  const room = rooms.get(code);
  if (!room) return;
  const superGained = next.superCount > room.superCount; // a full line was just formed
  const justWon = !room.roundWinner && !!next.roundWinner; // a team just won
  let result = next;
  if (justWon) result = { ...result, roundWinnerGif: randomGif('winner') };
  Object.assign(room, result);
  armTurnTimer(io, code); // stamps room.turnEndsAt before we broadcast
  broadcast(io, room);
  if (superGained) io.to(code).emit('super-sequence', { gif: randomGif('super-sequence') });
}

// (Re)start the current player's move timer. On expiry, the server auto-plays a
// random legal move for them. No-op (and clears) when the timer setting is off.
function armTurnTimer(io: Server, code: string): void {
  const existing = turnTimers.get(code);
  if (existing) {
    clearTimeout(existing);
    turnTimers.delete(code);
  }
  const room = rooms.get(code);
  if (!room) return;
  const live = room.phase === 'playing' && room.settings.timerEnabled && !room.roundWinner && !room.roundTie;
  if (!live) {
    room.turnEndsAt = null;
    return;
  }
  const seconds = Math.max(10, Math.min(120, room.settings.timerSeconds || 30));
  room.turnEndsAt = Date.now() + seconds * 1000;
  const timer = setTimeout(() => {
    turnTimers.delete(code);
    const r = rooms.get(code);
    if (!r || r.phase !== 'playing' || r.roundWinner || r.roundTie || !r.settings.timerEnabled) return;
    const current = r.turnOrder[r.currentTurn];
    if (!current) return;
    commitRoom(io, code, autoMove(r, current));
  }, seconds * 1000);
  turnTimers.set(code, timer);
}

export function registerHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('create-room', ({ player, settings }: { player: PlayerInput; settings: Settings }) => {
      let code = makeCode();
      while (rooms.has(code)) code = makeCode();
      // In solo, the creator is the first side (red). Teams/self-test start unassigned.
      const hostTeam: TeamColor | null = settings.mode === 'solo' ? 'red' : null;
      const room: ServerRoom = {
        code,
        phase: 'lobby',
        settings,
        players: [{ ...player, team: hostTeam, connected: true }],
        teams: teamsFor(settings.teamCount),
        board: [],
        hands: {},
        deckCount: 0,
        turnOrder: [],
        currentTurn: 0,
        lastMove: null,
        hostId: player.id,
        isLastGame: false,
        winners: null,
        roundWinner: null,
        roundWinnerGif: null,
        roundTie: false,
        superCount: 0,
        frozenPlayerIds: [],
        _deck: [],
      };
      rooms.set(code, room);
      playerSocket.set(player.id, socket.id);
      socket.data.playerId = player.id; // bind identity to this connection (anti-spoofing)
      socket.data.roomCode = code;
      socket.join(code);
      socket.emit('joined', { code });
      broadcast(io, room);
    });

    socket.on('join-room', ({ code, player }: { code: string; player: PlayerInput }) => {
      const room = rooms.get(code);
      if (!room) {
        socket.emit('error-msg', 'Room not found');
        return;
      }
      const existing = room.players.find((p) => p.id === player.id);
      if (existing) {
        existing.connected = true;
        existing.name = player.name || existing.name;
        existing.icon = player.icon || existing.icon;
      } else if (room.phase === 'lobby') {
        if (room.settings.mode === 'selftest') {
          socket.emit('error-msg', 'This is a self-test room (single player)');
          return;
        }
        if (room.settings.mode === 'solo') {
          // Each player gets their own colour; cap players at the number of sides.
          const used = new Set(room.players.map((p) => p.team).filter(Boolean));
          const free = COLORS.slice(0, room.settings.teamCount).find((c) => !used.has(c));
          if (!free) {
            socket.emit('error-msg', 'Room is full');
            return;
          }
          room.players.push({ ...player, team: free, connected: true });
        } else {
          room.players.push({ ...player, team: null, connected: true });
        }
      } else {
        socket.emit('error-msg', 'Game already started');
        return;
      }
      playerSocket.set(player.id, socket.id);
      socket.data.playerId = player.id; // bind identity to this connection (anti-spoofing)
      socket.data.roomCode = code;
      socket.join(code);
      socket.emit('joined', { code });
      broadcast(io, room);
    });

    // The trusted actor for any action is the id bound to THIS socket, never the payload.
    const actorId = (): string | undefined => socket.data.playerId;
    const isHost = (room: ServerRoom): boolean => room.hostId === socket.data.playerId;

    // Who a move applies to: normally yourself; in self-test the host drives the active seat.
    const resolveActor = (room: ServerRoom): string | undefined => {
      const me = actorId();
      if (!me) return undefined;
      if (room.settings.mode === 'selftest') {
        return room.hostId === me ? room.turnOrder[room.currentTurn] : undefined;
      }
      return me;
    };

    socket.on('assign-team', ({ code, playerId, team }: { code: string; playerId: string; team: TeamColor | null }) => {
      const room = rooms.get(code);
      if (!room || room.phase !== 'lobby') return;
      const me = actorId();
      if (!me) return;
      // You may set your own team; only the host may move another player.
      if (playerId !== me && !isHost(room)) return;
      const p = room.players.find((p) => p.id === playerId);
      if (p) p.team = team;
      broadcast(io, room);
    });

    socket.on('update-settings', ({ code, settings }: { code: string; settings: Partial<Settings> }) => {
      const room = rooms.get(code);
      if (!room || room.phase !== 'lobby' || !isHost(room)) return; // host-only, lobby-only
      room.settings = applySettingsUpdate(room.settings, settings ?? {});
      broadcast(io, room);
    });

    socket.on('start-game', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || room.phase !== 'lobby') return;
      if (!isHost(room)) return; // host only

      if (room.settings.mode === 'selftest') {
        // Build one synthetic seat per side; the host controls them all.
        const sideColors = COLORS.slice(0, room.settings.teamCount);
        const host = room.players.find((p) => p.id === room.hostId)!;
        const seats = sideColors.map((color, i) => ({
          id: `seat-${color}`,
          name: sideName(color),
          icon: ((host.icon + i) % 26) + 1,
          team: color,
          connected: true,
          isSeat: true,
        }));
        // Keep the host as a non-playing controller; seats are the players in turn order.
        room.players = [{ ...host, team: null, isSeat: false }, ...seats];
        Object.assign(room, startGame(room));
        armTurnTimer(io, code);
        broadcast(io, room);
        return;
      }

      // teams / solo: every player must have a side, and need at least two sides in play.
      if (room.players.some((p) => p.team === null)) return;
      const sidesInPlay = new Set(room.players.map((p) => p.team));
      if (sidesInPlay.size < 2) return;
      // Teams mode: every configured team must have at least one player.
      if (room.settings.mode === 'teams' && sidesInPlay.size < room.settings.teamCount) return;
      Object.assign(room, startGame(room));
      armTurnTimer(io, code);
      broadcast(io, room);
    });

    const applyAndBroadcast = (code: string, next: ServerRoom) => commitRoom(io, code, next);

    socket.on(
      'play-number',
      ({ code, cardId, cellIndex }: { code: string; cardId: string; cellIndex: number }) => {
        const room = rooms.get(code);
        if (!room) return;
        const actor = resolveActor(room);
        if (!actor) return;
        applyAndBroadcast(code, playNumberCard(room, actor, cardId, cellIndex));
      }
    );

    socket.on(
      'play-plus',
      ({ code, cardId, cellIndex }: { code: string; cardId: string; cellIndex: number }) => {
        const room = rooms.get(code);
        if (!room) return;
        const actor = resolveActor(room);
        if (!actor) return;
        applyAndBroadcast(code, playPlusCard(room, actor, cardId, cellIndex));
      }
    );

    socket.on(
      'play-minus',
      ({ code, cardId, cellIndex }: { code: string; cardId: string; cellIndex: number }) => {
        const room = rooms.get(code);
        if (!room) return;
        const actor = resolveActor(room);
        if (!actor) return;
        const byName = room.players.find((p) => p.id === actor)?.name ?? 'Someone';
        const next = playMinusCard(room, actor, cardId, cellIndex);
        const shieldBroke = room.board.some((c, i) => c.shielded && next.board[i] && !next.board[i].shielded);
        applyAndBroadcast(code, next);
        if (shieldBroke) io.to(code).emit('card-effect', { kind: 'shieldblock', byName });
      }
    );

    socket.on('swap-dead', ({ code, cardId }: { code: string; cardId: string }) => {
      const room = rooms.get(code);
      if (!room) return;
      const actor = resolveActor(room);
      if (!actor) return;
      applyAndBroadcast(code, swapDeadCard(room, actor, cardId));
    });

    socket.on('discard-card', ({ code, cardId }: { code: string; cardId: string }) => {
      const room = rooms.get(code);
      if (!room) return;
      const actor = resolveActor(room);
      if (!actor) return;
      applyAndBroadcast(code, discardCard(room, actor, cardId));
    });

    socket.on(
      'play-freeze',
      ({ code, cardId, targetId }: { code: string; cardId: string; targetId: string }) => {
        const room = rooms.get(code);
        if (!room) return;
        const actor = resolveActor(room);
        if (!actor) return;
        // Detect success by card consumption — the freeze may resolve (and the target
        // be skipped/thawed) within the same update, so checking frozenPlayerIds after
        // the fact can miss it.
        const hadCard = (room.hands[actor] ?? []).some((c) => c.id === cardId);
        const byName = room.players.find((p) => p.id === actor)?.name ?? 'Someone';
        const targetName = room.players.find((p) => p.id === targetId)?.name ?? 'A player';
        const next = freezeCard(room, actor, cardId, targetId);
        const succeeded = hadCard && !(next.hands[actor] ?? []).some((c) => c.id === cardId);
        applyAndBroadcast(code, next);
        if (succeeded) {
          io.to(code).emit('card-effect', { kind: 'freeze', byName, targetName });
        }
      }
    );

    // Shared driver for the cell-targeted / no-target special cards. Fires the themed
    // card-effect overlay only when the card was actually consumed (a valid play).
    const playSpecial = (
      code: string,
      cardId: string,
      kind: 'steal' | 'shield' | 'bomb' | 'reroll',
      run: (room: ServerRoom, actor: string) => ServerRoom
    ) => {
      const room = rooms.get(code);
      if (!room) return;
      const actor = resolveActor(room);
      if (!actor) return;
      const had = (room.hands[actor] ?? []).some((c) => c.id === cardId);
      const byName = room.players.find((p) => p.id === actor)?.name ?? 'Someone';
      const next = run(room, actor);
      const ok = had && !(next.hands[actor] ?? []).some((c) => c.id === cardId);
      // A Bomb that hits a hidden shield breaks it → show the BLOCKED animation instead.
      const shieldBroke = room.board.some((c, i) => c.shielded && next.board[i] && !next.board[i].shielded);
      applyAndBroadcast(code, next);
      if (ok) io.to(code).emit('card-effect', { kind: shieldBroke ? 'shieldblock' : kind, byName });
    };

    socket.on(
      'play-steal',
      ({ code, cardId, targetPlayerId, cardIndex }: { code: string; cardId: string; targetPlayerId: string; cardIndex: number }) =>
        playSpecial(code, cardId, 'steal', (room, actor) =>
          stealCard(room, actor, cardId, targetPlayerId, cardIndex)
        )
    );
    socket.on(
      'play-shield',
      ({ code, cardId, cellIndices }: { code: string; cardId: string; cellIndices: number[] }) =>
        playSpecial(code, cardId, 'shield', (room, actor) =>
          shieldCard(room, actor, cardId, cellIndices ?? [])
        )
    );
    socket.on('play-bomb', ({ code, cardId, cellIndex }: { code: string; cardId: string; cellIndex: number }) =>
      playSpecial(code, cardId, 'bomb', (room, actor) => bombCard(room, actor, cardId, cellIndex))
    );
    socket.on(
      'play-reroll',
      ({ code, cardId, swapCardId }: { code: string; cardId: string; swapCardId: string }) =>
        playSpecial(code, cardId, 'reroll', (room, actor) => rerollCard(room, actor, cardId, swapCardId))
    );

    // Host leaves the frozen winning board: go to the score screen (or final champion screen).
    socket.on('next-round', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || !isHost(room)) return; // host only
      Object.assign(room, nextRound(room));
      armTurnTimer(io, code); // leaving 'playing' clears the timer
      broadcast(io, room);
    });

    socket.on('next-game', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || !isHost(room)) return; // host only
      Object.assign(room, nextGame(room, winningTeamColor(room)));
      armTurnTimer(io, code); // a fresh game re-arms the timer
      broadcast(io, room);
    });

    socket.on('declare-last', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || !isHost(room)) return; // host only
      Object.assign(room, declareLastGame(room));
      broadcast(io, room);
    });

    socket.on('end-game', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || !isHost(room)) return; // host only
      Object.assign(room, endGame(room));
      armTurnTimer(io, code); // clears the timer (game over)
      broadcast(io, room);
    });

    socket.on('play-again', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || !isHost(room)) return; // host only
      room.phase = 'lobby';
      room.isLastGame = false;
      room.winners = null;
      room.roundWinner = null;
      room.roundWinnerGif = null;
      room.roundTie = false;
      room.superCount = 0;
      room.frozenPlayerIds = [];
      room.teams = room.teams.map((t) => ({ ...t, sequencesThisGame: 0, gameWins: 0 }));
      room.board = [];
      room.hands = {};
      room._deck = [];
      room.turnOrder = [];
      room.currentTurn = 0;
      room.turnEndsAt = null;
      room.players = room.players.filter((p) => !p.isSeat); // drop self-test seats
      armTurnTimer(io, code); // back to lobby — no timer
      broadcast(io, room);
    });

    socket.on('reaction', ({ code, emoji }: { code: string; emoji: string }) => {
      const me = actorId();
      if (!me || typeof emoji !== 'string') return;
      const now = Date.now();
      if (now - (lastReactionAt.get(me) ?? 0) < REACTION_COOLDOWN_MS) return; // anti-spam
      lastReactionAt.set(me, now);
      io.to(code).emit('reaction', { playerId: me, emoji });
    });

    socket.on('disconnect', () => {
      for (const room of rooms.values()) {
        const p = room.players.find((pl) => playerSocket.get(pl.id) === socket.id);
        if (p) {
          p.connected = false;
          broadcast(io, room);
        }
      }
    });
  });
}
