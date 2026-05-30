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
import FloatingReactions from '@/components/FloatingReactions';
import SuperSequence from '@/components/SuperSequence';
import CardEffect from '@/components/CardEffect';
import StealPicker from '@/components/StealPicker';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  yellow: '#ffca28',
};
const TEAM_EMOJI: Record<string, string> = {
  red: '🔴',
  blue: '🔵',
  green: '🟢',
  yellow: '🟡',
};

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { view, error, reaction, superEvent, cardEffect, connected, emit } = useSocket();

  const [profile, setProfile] = useState<{ name: string; icon: number } | null>(null);
  const [joined, setJoined] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [editing, setEditing] = useState(false); // editing your character in the lobby
  const [stealTarget, setStealTarget] = useState<string | null>(null); // opponent chosen for Steal
  const [shieldPicks, setShieldPicks] = useState<number[]>([]); // chips chosen for a Shield (up to 2)

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

  // On a win/tie, show the celebration popup for ~3s, then auto-hide it to reveal
  // the highlighted board underneath. The host taps Next when ready (no auto-advance).
  const [winPopup, setWinPopup] = useState(false);
  const winState = view?.roundWinner ?? (view?.roundTie ? 'tie' : null);
  useEffect(() => {
    if (!winState) {
      setWinPopup(false);
      return;
    }
    setWinPopup(true);
    const t = setTimeout(() => setWinPopup(false), 3000);
    return () => clearTimeout(t);
  }, [winState]);

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
      <>
        {editing && (
          <CharacterPicker
            initialName={profile?.name}
            initialIcon={profile?.icon}
            onConfirm={(name, ic) => {
              saveProfile(name, ic);
              setProfile({ name, icon: ic });
              // Re-join with the new profile so the server updates everyone's view.
              emit('join-room', { code, player: { id: myId, name, icon: ic } });
              setEditing(false);
            }}
          />
        )}
        <Lobby
          view={view}
          onAssign={(team: TeamColor) => emit('assign-team', { code, playerId: myId, team })}
          onStart={() => emit('start-game', { code })}
          onUpdateSettings={(patch) => emit('update-settings', { code, settings: patch })}
          onExit={() => router.push('/')}
          onEditCharacter={() => setEditing(true)}
        />
      </>
    );
  }

  const requestEnd = () => setConfirmEnd(true);
  const endConfirm = confirmEnd ? (
    <EndConfirm
      onCancel={() => setConfirmEnd(false)}
      onConfirm={() => {
        emit('end-game', { code });
        setConfirmEnd(false);
      }}
    />
  ) : null;

  // ---- Between games ----
  if (view.phase === 'between') {
    return (
      <>
        {endConfirm}
        <BetweenGames
          view={view}
          onNextGame={() => emit('next-game', { code })}
          onLastGame={() => {
            emit('declare-last', { code });
            emit('next-game', { code });
          }}
          onEnd={requestEnd}
        />
      </>
    );
  }

  // ---- Final winner ----
  if (view.phase === 'final') {
    return <FinalWinner view={view} onPlayAgain={() => emit('play-again', { code })} />;
  }

  // ---- Playing ----
  const selfTest = view.settings.mode === 'selftest';
  const activePlayerId = view.turnOrder[view.currentTurn] ?? null;
  const activePlayer = view.players.find((p) => p.id === activePlayerId) ?? null;
  // In self-test the host drives whichever seat's turn it is, so they can always act.
  const myTurn = selfTest ? view.myPlayerId === view.hostId : activePlayerId === myId;
  const myTeam = view.players.find((p) => p.id === myId)?.team ?? null;
  // The team a move counts for: the active seat in self-test, otherwise my own team.
  const actingTeam = selfTest ? (activePlayer?.team ?? null) : myTeam;
  const selectedCard = view.myHand.find((c) => c.id === selectedCardId) ?? null;
  const frozen = view.roundWinner !== null || view.roundTie; // game paused (win or tie)

  // Which cells could the selected card target? Shown even when it's NOT your turn,
  // so waiting players can preview their options (they just can't place yet).
  const previewTeam = myTurn ? actingTeam : myTeam; // preview against your own team's view
  const targetable = new Set<number>();
  if (selectedCard && !frozen) {
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
        if (c.owner !== null && c.owner !== previewTeam && !c.inSequence && !c.shielded)
          targetable.add(c.index);
      });
    } else if (selectedCard.kind === 'shield') {
      view.board.forEach((c) => {
        if (c.owner === previewTeam && !c.shielded && !shieldPicks.includes(c.index))
          targetable.add(c.index);
      });
    } else if (selectedCard.kind === 'bomb') {
      view.board.forEach((c) => {
        if (c.value !== 'FREE') targetable.add(c.index); // any cell anchors the 2×2
      });
    }
  }

  // Can the acting player make any move at all? If not (and it's their turn), they
  // must discard a card to draw a new one.
  const emptyPlayable = view.board.some((c) => c.owner === null && c.value !== 'FREE');
  const removableOpp = view.board.some(
    (c) => c.owner !== null && c.owner !== actingTeam && !c.inSequence && !c.shielded
  );
  // Opponents the acting player could freeze (used for highlighting + the stuck check).
  const eligibleFreezeTargets = new Set<string>();
  if (myTurn && !frozen) {
    for (const pid of view.turnOrder) {
      if (pid === activePlayerId) continue; // not yourself
      const t = view.players.find((p) => p.id === pid);
      if (!t) continue;
      if (actingTeam && t.team && actingTeam === t.team) continue; // not teammates
      if (view.frozenPlayerIds.includes(pid)) continue; // not already frozen
      eligibleFreezeTargets.add(pid);
    }
  }
  const hasFreezeTarget = eligibleFreezeTargets.size > 0;
  // Opponents you can steal a card from (they must hold at least one card).
  const eligibleStealTargets = new Set<string>();
  if (myTurn && !frozen) {
    for (const pid of view.turnOrder) {
      if (pid === activePlayerId) continue;
      const t = view.players.find((p) => p.id === pid);
      if (!t) continue;
      if (actingTeam && t.team && actingTeam === t.team) continue;
      if ((view.handCounts[pid] ?? 0) < 2) continue; // can't steal someone's last card
      eligibleStealTargets.add(pid);
    }
  }
  const ownUnshielded = view.board.some((c) => c.owner === actingTeam && !c.shielded);
  const anyChip = view.board.some((c) => c.owner !== null);
  const cardHasMove = (card: (typeof view.myHand)[number]) => {
    if (card.kind === 'plus') return emptyPlayable;
    if (card.kind === 'minus') return removableOpp;
    if (card.kind === 'steal') return eligibleStealTargets.size > 0;
    if (card.kind === 'shield') return ownUnshielded;
    if (card.kind === 'bomb') return anyChip;
    if (card.kind === 'reroll') return view.myHand.length > 1;
    if (card.kind === 'freeze') return hasFreezeTarget;
    return view.board.some((c) => c.owner === null && c.value === card.target);
  };
  const canMove = view.myHand.some(cardHasMove);
  const discardMode = myTurn && !frozen && view.myHand.length > 0 && !canMove;

  const CELL_EVENT: Record<string, string> = {
    number: 'play-number',
    plus: 'play-plus',
    minus: 'play-minus',
    bomb: 'play-bomb',
  };
  const handlePick = (cellIndex: number) => {
    if (!selectedCard || !myTurn || frozen) return; // can preview, but only place on your turn
    // Shield: pick up to 2 of your own chips, then apply.
    if (selectedCard.kind === 'shield') {
      const picks = shieldPicks.includes(cellIndex) ? shieldPicks : [...shieldPicks, cellIndex];
      const ownUnshielded = view.board.filter((c) => c.owner === actingTeam && !c.shielded).length;
      const maxPicks = Math.min(2, ownUnshielded);
      if (picks.length >= maxPicks) {
        emit('play-shield', { code, cardId: selectedCard.id, cellIndices: picks });
        setShieldPicks([]);
        setSelectedCardId(null);
      } else {
        setShieldPicks(picks);
      }
      return;
    }
    const evt = CELL_EVENT[selectedCard.kind];
    if (!evt) return; // freeze/steal (player-target) and reroll (no target) don't place on a cell
    emit(evt, { code, cardId: selectedCard.id, cellIndex });
    setSelectedCardId(null);
  };

  const isHost = view.myPlayerId === view.hostId;
  const winnerTeam = view.teams.find((t) => t.color === view.roundWinner) ?? null;
  const winnerPlayers = view.players.filter((p) => p.team === view.roundWinner && !p.isSeat);

  const badgeTeam = myTeam ?? (selfTest ? activePlayer?.team ?? null : null);

  return (
    <div className="game-wrap">
      {endConfirm}
      <FloatingReactions reaction={reaction} />
      <SuperSequence event={superEvent} />
      <CardEffect event={cardEffect} />

      {badgeTeam && (
        <div className="team-badge">
          <span className={`mini-chip ${badgeTeam}`} />
          <span className="lbl" style={{ color: TEAM_HEX[badgeTeam] }}>
            {selfTest ? `Now: ${badgeTeam} Team` : `${badgeTeam} Team`}
          </span>
        </div>
      )}

      {/* Celebration popup: shows for ~3s on a win/tie, then auto-hides. */}
      {frozen && winPopup && (
        <div className="win-overlay">
          <div className="win-card">
            {view.roundTie ? (
              <>
                <div className="gif-fallback">🤝</div>
                <div className="win-title" style={{ color: '#ffd700' }}>
                  It&apos;s a tie — no points this game
                </div>
              </>
            ) : (
              <>
                {view.roundWinnerGif ? (
                  <img src={view.roundWinnerGif} alt="Winner!" className="gif-img" />
                ) : (
                  <div className="gif-fallback">🏆🎉🏆</div>
                )}
                <div className="win-title" style={{ color: TEAM_HEX[view.roundWinner ?? 'red'] }}>
                  {TEAM_EMOJI[view.roundWinner ?? 'red']}{' '}
                  {selfTest
                    ? winnerTeam?.color
                    : winnerPlayers.map((p) => p.name).join(' & ') || view.roundWinner}{' '}
                  wins this game!
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* After the popup, a slim banner keeps the board (with its glowing winning
          line) in view while the host decides when to continue. */}
      {frozen && !winPopup && (
        <div className="win-banner">
          <span
            className="win-banner-text"
            style={{ color: view.roundTie ? '#ffd700' : TEAM_HEX[view.roundWinner ?? 'red'] }}
          >
            {view.roundTie ? (
              <>🤝 Tie — no points</>
            ) : (
              <>
                {TEAM_EMOJI[view.roundWinner ?? 'red']}{' '}
                {selfTest
                  ? winnerTeam?.color
                  : winnerPlayers.map((p) => p.name).join(' & ') || view.roundWinner}{' '}
                wins!
              </>
            )}
          </span>
          {isHost ? (
            <button className="primary-btn" onClick={() => emit('next-round', { code })}>
              Next ▶
            </button>
          ) : (
            <span className="waiting-note" style={{ margin: 0 }}>
              Waiting for the host…
            </span>
          )}
        </div>
      )}

      <TopBar
        teams={view.teams}
        sequencesToWin={view.settings.sequencesToWin}
        activePlayer={activePlayer}
        myTurn={myTurn}
        selfTest={selfTest}
        onEndGame={isHost ? requestEnd : undefined}
      />
      <PlayerStrip
        players={view.players}
        activePlayerId={activePlayerId}
        frozenIds={view.frozenPlayerIds}
        targetPlayers={
          selectedCard?.kind === 'freeze'
            ? eligibleFreezeTargets
            : selectedCard?.kind === 'steal'
              ? eligibleStealTargets
              : undefined
        }
        onTargetPlayer={(pid) => {
          if (selectedCard?.kind === 'freeze') {
            emit('play-freeze', { code, cardId: selectedCard.id, targetId: pid });
            setSelectedCardId(null);
          } else if (selectedCard?.kind === 'steal') {
            setStealTarget(pid); // open the blind card-pick
          }
        }}
      />

      {stealTarget && selectedCard?.kind === 'steal' && (
        <StealPicker
          targetName={view.players.find((p) => p.id === stealTarget)?.name ?? 'Opponent'}
          count={view.handCounts[stealTarget] ?? 0}
          onPick={(index) => {
            emit('play-steal', {
              code,
              cardId: selectedCard.id,
              targetPlayerId: stealTarget,
              cardIndex: index,
            });
            setStealTarget(null);
            setSelectedCardId(null);
          }}
          onCancel={() => setStealTarget(null)}
        />
      )}
      <Board
        cells={view.board}
        size={view.settings.boardSize}
        targetable={targetable}
        lastMoveIndex={view.lastMove?.index ?? null}
        pendingShield={selectedCard?.kind === 'shield' ? shieldPicks : undefined}
        onPick={handlePick}
      />
      <EmojiPanel onReact={(emoji) => emit('reaction', { code, emoji })} />
      <HandCards
        hand={view.myHand}
        board={view.board}
        selectedCardId={selectedCardId}
        myTurn={myTurn}
        teamColor={actingTeam}
        discardMode={discardMode}
        onSelect={(id) => {
          setShieldPicks([]);
          setSelectedCardId((cur) => (cur === id ? null : id));
        }}
        onSwapDead={(id) => {
          emit('swap-dead', { code, cardId: id });
          setSelectedCardId(null);
        }}
        onDiscard={(id) => {
          emit('discard-card', { code, cardId: id });
          setSelectedCardId(null);
        }}
        onReroll={(id, swapId) => {
          emit('play-reroll', { code, cardId: id, swapCardId: swapId });
          setSelectedCardId(null);
        }}
      />
    </div>
  );
}

function EndConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 340, textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>⏹️</div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>End the game?</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
          This ends the session for everyone and jumps to the final results. You can&apos;t undo it.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary-btn"
            style={{ background: 'linear-gradient(135deg, #ef5350, #b71c1c)' }}
            onClick={onConfirm}
          >
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}
