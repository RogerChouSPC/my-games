import type { Server, Socket } from 'socket.io';
import type { RoomState, Settings, ServerRoom, ClientView, TeamColor, PlayerInput } from '@/types/game';
import {
  startGame,
  playNumberCard,
  playPlusCard,
  playMinusCard,
  swapDeadCard,
  nextGame,
  declareLastGame,
  finalize,
} from '../lib/game-engine';

const rooms = new Map<string, ServerRoom>();
const playerSocket = new Map<string, string>(); // playerId → socket.id

function makeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function teamsFor(n: number) {
  const order: TeamColor[] = ['red', 'blue', 'green', 'yellow'];
  return order.slice(0, n).map((color) => ({ color, sequencesThisGame: 0, gameWins: 0 }));
}

function viewFor(room: ServerRoom, playerId: string): ClientView {
  // Strip server-only fields (hands of others, the live deck).
  const { hands, _deck, ...rest } = room;
  return { ...rest, myHand: hands[playerId] ?? [], myPlayerId: playerId };
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

export function registerHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('create-room', ({ player, settings }: { player: PlayerInput; settings: Settings }) => {
      let code = makeCode();
      while (rooms.has(code)) code = makeCode();
      const room: ServerRoom = {
        code,
        phase: 'lobby',
        settings,
        players: [{ ...player, team: null, connected: true }],
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
        _deck: [],
      };
      rooms.set(code, room);
      playerSocket.set(player.id, socket.id);
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
        room.players.push({ ...player, team: null, connected: true });
      } else {
        socket.emit('error-msg', 'Game already started');
        return;
      }
      playerSocket.set(player.id, socket.id);
      socket.join(code);
      socket.emit('joined', { code });
      broadcast(io, room);
    });

    socket.on(
      'assign-team',
      ({ code, playerId, team }: { code: string; playerId: string; team: TeamColor | null }) => {
        const room = rooms.get(code);
        if (!room || room.phase !== 'lobby') return;
        const p = room.players.find((p) => p.id === playerId);
        if (p) p.team = team;
        broadcast(io, room);
      }
    );

    socket.on('start-game', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room || room.phase !== 'lobby') return;
      if (room.players.some((p) => p.team === null)) return; // all players must have a team
      Object.assign(room, startGame(room));
      broadcast(io, room);
    });

    const applyAndBroadcast = (code: string, next: ServerRoom) => {
      const room = rooms.get(code);
      if (!room) return;
      let result = next;
      if (result.phase === 'between' && result.isLastGame) {
        result = finalize(result) as ServerRoom;
      }
      Object.assign(room, result);
      broadcast(io, room);
    };

    socket.on(
      'play-number',
      ({ code, playerId, cardId, cellIndex }: { code: string; playerId: string; cardId: string; cellIndex: number }) => {
        const room = rooms.get(code);
        if (!room) return;
        applyAndBroadcast(code, playNumberCard(room, playerId, cardId, cellIndex));
      }
    );

    socket.on(
      'play-plus',
      ({ code, playerId, cardId, cellIndex }: { code: string; playerId: string; cardId: string; cellIndex: number }) => {
        const room = rooms.get(code);
        if (!room) return;
        applyAndBroadcast(code, playPlusCard(room, playerId, cardId, cellIndex));
      }
    );

    socket.on(
      'play-minus',
      ({ code, playerId, cardId, cellIndex }: { code: string; playerId: string; cardId: string; cellIndex: number }) => {
        const room = rooms.get(code);
        if (!room) return;
        applyAndBroadcast(code, playMinusCard(room, playerId, cardId, cellIndex));
      }
    );

    socket.on('swap-dead', ({ code, playerId, cardId }: { code: string; playerId: string; cardId: string }) => {
      const room = rooms.get(code);
      if (!room) return;
      applyAndBroadcast(code, swapDeadCard(room, playerId, cardId));
    });

    socket.on('next-game', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room) return;
      Object.assign(room, nextGame(room, winningTeamColor(room)));
      broadcast(io, room);
    });

    socket.on('declare-last', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room) return;
      Object.assign(room, declareLastGame(room));
      broadcast(io, room);
    });

    socket.on('play-again', ({ code }: { code: string }) => {
      const room = rooms.get(code);
      if (!room) return;
      room.phase = 'lobby';
      room.isLastGame = false;
      room.winners = null;
      room.teams = room.teams.map((t) => ({ ...t, sequencesThisGame: 0, gameWins: 0 }));
      room.board = [];
      room.hands = {};
      room._deck = [];
      broadcast(io, room);
    });

    socket.on('reaction', ({ code, playerId, emoji }: { code: string; playerId: string; emoji: string }) => {
      io.to(code).emit('reaction', { playerId, emoji });
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
