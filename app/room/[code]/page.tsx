'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import type { TeamColor } from '@/types/game';
import {
  useSocket,
  getPlayerId,
  getSavedProfile,
  saveProfile,
} from '@/lib/client/useSocket';
import CharacterPicker from '@/components/CharacterPicker';
import Lobby from '@/components/Lobby';
import Board from '@/components/Board';
import TopBar from '@/components/TopBar';
import PlayerStrip from '@/components/PlayerStrip';
import EmojiPanel from '@/components/EmojiPanel';
import HandCards from '@/components/HandCards';
import BetweenGames from '@/components/BetweenGames';
import FinalWinner from '@/components/FinalWinner';

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { view, error, reaction, connected, emit } = useSocket();

  const [profile, setProfile] = useState<{ name: string; icon: number } | null>(null);
  const [joined, setJoined] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Resolve identity first; show picker if missing.
  useEffect(() => {
    setProfile(getSavedProfile());
  }, []);

  // Join the room once connected and identity is known.
  useEffect(() => {
    if (connected && profile && !joined) {
      emit('join-room', {
        code,
        player: { id: getPlayerId(), name: profile.name, icon: profile.icon },
      });
      setJoined(true);
    }
  }, [connected, profile, joined, code, emit]);

  if (!profile) {
    return (
      <CharacterPicker
        onConfirm={(name, icon) => {
          saveProfile(name, icon);
          setProfile({ name, icon });
        }}
      />
    );
  }

  if (error) {
    return (
      <main className="center-screen">
        <div className="error-banner">{error}</div>
        <button className="ghost-btn" style={{ maxWidth: 200 }} onClick={() => router.push('/')}>
          ← Back to Home
        </button>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="center-screen">
        <div className="logo-sub">Connecting to room {code}…</div>
      </main>
    );
  }

  const myId = getPlayerId();

  // ---- Lobby ----
  if (view.phase === 'lobby') {
    return (
      <Lobby
        view={view}
        onAssign={(team: TeamColor) => emit('assign-team', { code, playerId: myId, team })}
        onStart={() => emit('start-game', { code })}
      />
    );
  }

  // ---- Between games ----
  if (view.phase === 'between') {
    return (
      <BetweenGames
        view={view}
        onNextGame={() => emit('next-game', { code })}
        onLastGame={() => {
          emit('declare-last', { code });
          emit('next-game', { code });
        }}
      />
    );
  }

  // ---- Final winner ----
  if (view.phase === 'final') {
    return <FinalWinner view={view} onPlayAgain={() => emit('play-again', { code })} />;
  }

  // ---- Playing ----
  const activePlayerId = view.turnOrder[view.currentTurn] ?? null;
  const activePlayer = view.players.find((p) => p.id === activePlayerId) ?? null;
  const myTurn = activePlayerId === myId;
  const myTeam = view.players.find((p) => p.id === myId)?.team ?? null;
  const selectedCard = view.myHand.find((c) => c.id === selectedCardId) ?? null;

  // Which cells can the selected card legally target?
  const targetable = new Set<number>();
  if (myTurn && selectedCard) {
    if (selectedCard.kind === 'number') {
      view.board.forEach((c) => {
        if (c.owner === null && c.value === selectedCard.target) targetable.add(c.index);
      });
    } else if (selectedCard.kind === 'plus') {
      view.board.forEach((c) => {
        if (c.owner === null && c.value !== 'FREE') targetable.add(c.index);
      });
    } else if (selectedCard.kind === 'minus') {
      view.board.forEach((c) => {
        if (c.owner !== null && c.owner !== myTeam && !c.inSequence) targetable.add(c.index);
      });
    }
  }

  const handlePick = (cellIndex: number) => {
    if (!selectedCard || !myTurn) return;
    const evt =
      selectedCard.kind === 'number'
        ? 'play-number'
        : selectedCard.kind === 'plus'
          ? 'play-plus'
          : 'play-minus';
    emit(evt, { code, playerId: myId, cardId: selectedCard.id, cellIndex });
    setSelectedCardId(null);
  };

  return (
    <div className="game-wrap">
      <TopBar
        teams={view.teams}
        sequencesToWin={view.settings.sequencesToWin}
        activePlayer={activePlayer}
        myTurn={myTurn}
      />
      <PlayerStrip players={view.players} activePlayerId={activePlayerId} reaction={reaction} />
      <Board
        cells={view.board}
        size={view.settings.boardSize}
        targetable={targetable}
        lastMoveIndex={view.lastMove?.index ?? null}
        onPick={handlePick}
      />
      <EmojiPanel onReact={(emoji) => emit('reaction', { code, playerId: myId, emoji })} />
      <HandCards
        hand={view.myHand}
        board={view.board}
        selectedCardId={selectedCardId}
        myTurn={myTurn}
        onSelect={(id) => setSelectedCardId((cur) => (cur === id ? null : id))}
        onSwapDead={(id) => {
          emit('swap-dead', { code, playerId: myId, cardId: id });
          setSelectedCardId(null);
        }}
      />
    </div>
  );
}
