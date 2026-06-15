'use client';
import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import type { TeamColor } from '@/types/game';
import {
  useSocket,
  getPlayerId,
  getSavedProfile,
  saveProfile,
  saveLastRoom,
  clearLastRoom,
} from '@/lib/client/useSocket';
import { play, isMuted, setMuted, unlockAudio, type SoundName } from '@/lib/client/sounds';
import HowToPlay from '@/components/HowToPlay';
import CharacterPicker from '@/components/CharacterPicker';
import Lobby from '@/components/Lobby';
import Board from '@/components/Board';
import TopBar from '@/components/TopBar';
import PlayerStrip from '@/components/PlayerStrip';
import RecentPlays from '@/components/RecentPlays';
import EmojiPanel from '@/components/EmojiPanel';
import HandCards from '@/components/HandCards';
import BetweenGames from '@/components/BetweenGames';
import FinalWinner from '@/components/FinalWinner';
import FloatingReactions from '@/components/FloatingReactions';
import SuperSequence from '@/components/SuperSequence';
import CardEffect from '@/components/CardEffect';
import StealPicker from '@/components/StealPicker';
import TargetPicker from '@/components/TargetPicker';
import RerollPicker from '@/components/RerollPicker';

const TEAM_HEX: Record<string, string> = {
  red: '#ef5350',
  blue: '#42a5f5',
  green: '#66bb6a',
  purple: '#ab47bc',
};
const TEAM_EMOJI: Record<string, string> = {
  red: '🔴',
  blue: '🔵',
  green: '🟢',
  purple: '🟣',
};

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const {
    view,
    error,
    nameTaken,
    reaction,
    superEvent,
    cardEffect,
    playerLeft,
    connected,
    emit,
    clearNameTaken,
  } = useSocket();

  const [profile, setProfile] = useState<{ name: string; icon: number } | null>(null);
  const [joined, setJoined] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [editing, setEditing] = useState(false); // editing your character in the lobby
  const [stealTarget, setStealTarget] = useState<string | null>(null); // opponent chosen for Steal
  const [shieldPicks, setShieldPicks] = useState<number[]>([]); // chips chosen for a Shield (up to 2)
  const [hintKey, setHintKey] = useState(0); // bump to flash a "not your turn yet" toast
  const [armedCell, setArmedCell] = useState<number | null>(null); // Bomb/Minus awaiting its confirm tap
  const [muted, setMutedState] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [turnFlash, setTurnFlash] = useState(false); // "Your/Name's Turn" banner shown on each turn change
  const [turnFlashKey, setTurnFlashKey] = useState(0); // bump to restart the banner animation
  const [turnFlashTeam, setTurnFlashTeam] = useState<TeamColor | null>(null); // active player's team (banner colour)
  const [turnFlashLabel, setTurnFlashLabel] = useState('Your Turn'); // "Your Turn" or "Roger's Turn"
  const [shakeKey, setShakeKey] = useState(0); // bump to shake the board (Bomb)
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectedNote, setReconnectedNote] = useState(false);
  const [wrongPick, setWrongPick] = useState<number | null>(null); // hard-mode wrong-tap shake
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false); // Back pressed — really leave?
  const [leftNote, setLeftNote] = useState<string | null>(null); // "X left the game" banner
  const [showPlayed, setShowPlayed] = useState(false); // the "played cards" tab is hidden by default

  // Load the saved mute preference and unlock audio on the first tap (mobile rule).
  useEffect(() => {
    setMutedState(isMuted());
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

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

  // Network blip handling: show a banner while the socket is down, and re-register
  // with the server when it comes back (a fresh socket id must be re-bound to the
  // player, or the server would stop sending us state updates).
  useEffect(() => {
    if (!joined) return;
    if (!connected) {
      setReconnecting(true);
      return;
    }
    if (reconnecting && profile) {
      emit('join-room', {
        code,
        player: { id: getPlayerId(), name: profile.name, icon: profile.icon },
      });
      setReconnecting(false);
      setReconnectedNote(true);
      const t = setTimeout(() => setReconnectedNote(false), 2000);
      return () => clearTimeout(t);
    }
  }, [connected, joined, reconnecting, profile, code, emit]);

  // Sounds + board shake for power-card effects (every card-effect kind has a sound).
  useEffect(() => {
    if (!cardEffect) return;
    play(cardEffect.kind as SoundName);
    if (cardEffect.kind === 'bomb') setShakeKey((k) => k + 1);
  }, [cardEffect]);

  useEffect(() => {
    if (superEvent) play('super');
  }, [superEvent]);

  // Chip placement / removal sounds, driven by the shared lastMove marker.
  const prevMoveRef = useRef<string>('init');
  useEffect(() => {
    const lmv = view?.lastMove;
    const sig = lmv ? `${lmv.kind}:${lmv.index}:${lmv.playerId}` : 'none';
    if (prevMoveRef.current !== 'init' && sig !== prevMoveRef.current && lmv) {
      if (lmv.kind === 'place') play('place');
      else if (lmv.kind === 'remove') play('remove');
      // bomb sound comes with its card-effect overlay
    }
    prevMoveRef.current = sig;
  }, [view?.lastMove]);

  // Turn banner: on every turn change show "Your Turn" (yours) or "Roger's Turn"
  // (someone else's), in that player's team colour. Only YOUR turn also dings.
  const turnPlayerId = view?.phase === 'playing' ? view.turnOrder[view.currentTurn] ?? null : null;
  useEffect(() => {
    if (!turnPlayerId) return;
    const tp = view?.players.find((p) => p.id === turnPlayerId) ?? null;
    const isMe = turnPlayerId === getPlayerId();
    setTurnFlashTeam(tp?.team ?? null);
    setTurnFlashLabel(isMe ? 'Your Turn' : `${tp?.name ?? 'Player'}'s Turn`);
    if (isMe) play('turn');
    setTurnFlashKey((k) => k + 1);
    setTurnFlash(true);
    const t = setTimeout(() => setTurnFlash(false), 2200);
    return () => clearTimeout(t);
  }, [turnPlayerId]);

  // Victory chime when a team wins the game.
  const prevWinRef = useRef(false);
  useEffect(() => {
    const won = !!view?.roundWinner;
    if (won && !prevWinRef.current) play('win');
    prevWinRef.current = won;
  }, [view?.roundWinner]);

  // Promotion fanfare: play when new cells lock into a Line Win (tank tier).
  const prevSeqCountRef = useRef(0);
  useEffect(() => {
    const seqCount = view?.board.filter((c) => c.inSequence && !c.superSequence).length ?? 0;
    if (seqCount > prevSeqCountRef.current) play('upgrade');
    prevSeqCountRef.current = seqCount;
  }, [view?.board]);

  // Picking a different card disarms any pending Bomb/Minus confirmation.
  useEffect(() => {
    setArmedCell(null);
  }, [selectedCardId]);

  // Remember this game so "Back to game" can return here; forget it once it's over
  // (or the room doesn't exist anymore).
  useEffect(() => {
    if (!view) return;
    if (view.phase === 'final') clearLastRoom();
    else saveLastRoom(code);
  }, [view, code]);
  useEffect(() => {
    if (error === 'Room not found') clearLastRoom();
  }, [error]);

  // Mobile Back-button guard: ask before leaving an active game. A sentinel history
  // entry absorbs the Back press; we show our own confirm instead.
  useEffect(() => {
    if (!joined) return;
    window.history.pushState({ nwGuard: true }, '');
    const onPop = () => {
      setShowLeaveConfirm(true);
      window.history.pushState({ nwGuard: true }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [joined]);

  // Leaving keeps the room remembered — the home screen's "Back to game" button
  // works until the game actually ends (phase 'final' clears it).
  const confirmLeave = () => {
    emit('leave-room', { code });
    router.push('/');
  };

  // Transient "X left the game" banner.
  useEffect(() => {
    if (!playerLeft) return;
    setLeftNote(playerLeft.name);
    const t = setTimeout(() => setLeftNote(null), 3000);
    return () => clearTimeout(t);
  }, [playerLeft]);

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
    const t = setTimeout(() => setWinPopup(false), 3800);
    return () => clearTimeout(t);
  }, [winState]);

  // Briefly flash a hint when someone taps the board before it's their turn.
  useEffect(() => {
    if (hintKey === 0) return;
    const t = setTimeout(() => setHintKey(0), 2200);
    return () => clearTimeout(t);
  }, [hintKey]);

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

  // A join was rejected because the name is already used in this room — re-prompt.
  if (nameTaken) {
    return (
      <CharacterPicker
        initialName={profile?.name}
        initialIcon={profile?.icon}
        errorMsg={`The name "${nameTaken}" is already taken in this room. Please choose another.`}
        onConfirm={(name, icon) => {
          saveProfile(name, icon);
          setProfile({ name, icon });
          clearNameTaken();
          emit('join-room', { code, player: { id: getPlayerId(), name, icon } });
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
          onExit={confirmLeave}
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
  // Turn queue: the player up now is first, then the rest in turn order (wrapping).
  // When a turn passes the list rotates, so everyone slides toward the front.
  const turnQueue =
    view.turnOrder.length > 0
      ? view.turnOrder
          .map((_, i) => view.turnOrder[(view.currentTurn + i) % view.turnOrder.length])
          .map((id) => view.players.find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => !!p)
      : [];
  // In self-test the host drives whichever seat's turn it is, so they can always act.
  const myTurn = selfTest ? view.myPlayerId === view.hostId : activePlayerId === myId;
  const myTeam = view.players.find((p) => p.id === myId)?.team ?? null;
  // The team a move counts for: the active seat in self-test, otherwise my own team.
  const actingTeam = selfTest ? (activePlayer?.team ?? null) : myTeam;
  const selectedCard = view.myHand.find((c) => c.id === selectedCardId) ?? null;
  const frozen = view.roundWinner !== null || view.roundTie; // game paused (win or tie)

  // Hard mode: number cards don't reveal their cells; the player must find them.
  const hideAnswers = view.settings.showAnswerLocations === false;
  const numberCardHidden = hideAnswers && selectedCard?.kind === 'number';

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
        if (c.owner !== null && c.owner !== previewTeam && !c.shielded) targetable.add(c.index);
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
    if (frozen || !selectedCard) return;
    if (!myTurn) {
      // Waiting player tapped a previewed cell — tell them why nothing happened.
      setHintKey((k) => k + 1);
      return;
    }
    if (numberCardHidden && !targetable.has(cellIndex)) {
      // Wrong circle (or an occupied/FREE cell) — shake it and buzz.
      setWrongPick(cellIndex);
      play('wrong');
      setTimeout(() => setWrongPick(null), 450);
      return;
    }
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
    // Destructive cards arm on the first tap (showing exactly what would be hit)
    // and only fire on a second tap of the same spot — no accidental bombs.
    if (selectedCard.kind === 'minus' || selectedCard.kind === 'bomb') {
      if (armedCell !== cellIndex) {
        setArmedCell(cellIndex);
        return;
      }
      setArmedCell(null);
    }
    emit(evt, { code, cardId: selectedCard.id, cellIndex });
    setSelectedCardId(null);
  };

  const isHost = view.myPlayerId === view.hostId;
  const winnerTeam = view.teams.find((t) => t.color === view.roundWinner) ?? null;
  const winnerPlayers = view.players.filter((p) => p.team === view.roundWinner && !p.isSeat);
  // The player who placed the winning chip — featured in the round-win banner.
  const winChipPlayer = view.players.find((p) => p.id === view.roundWinnerPlayerId) ?? null;
  const charIcon = (n: number) => `/icons/char_${String(n).padStart(2, '0')}.png`;

  // Latest move markers: a black ring around a newly-placed chip, or red corner
  // brackets on the square(s) a Minus/Bomb just cleared.
  const lm = view.lastMove;
  const lastPlaceIndex = lm && lm.kind === 'place' ? lm.index : null;
  const removalCells = new Set<number>();
  if (lm && lm.kind === 'remove') removalCells.add(lm.index);
  if (lm && lm.kind === 'bomb') {
    const s = view.settings.boardSize;
    const r = Math.floor(lm.index / s);
    const c = lm.index % s;
    for (const [rr, cc] of [
      [r, c],
      [r, c + 1],
      [r + 1, c],
      [r + 1, c + 1],
    ]) {
      if (rr >= 0 && rr < s && cc >= 0 && cc < s) removalCells.add(rr * s + cc);
    }
  }

  // Red preview of exactly what a pending (armed, unconfirmed) Bomb/Minus would hit.
  // Mirrors the engine's clamping: a bomb anchor is pulled in so the 2×2 always fits.
  const dangerPreview = new Set<number>();
  if (armedCell !== null && selectedCard) {
    if (selectedCard.kind === 'minus') dangerPreview.add(armedCell);
    if (selectedCard.kind === 'bomb') {
      const s = view.settings.boardSize;
      const r = Math.min(Math.floor(armedCell / s), s - 2);
      const c = Math.min(armedCell % s, s - 2);
      for (const [rr, cc] of [
        [r, c],
        [r, c + 1],
        [r + 1, c],
        [r + 1, c + 1],
      ])
        dangerPreview.add(rr * s + cc);
    }
  }
  const armedHint =
    armedCell !== null && selectedCard
      ? selectedCard.kind === 'bomb'
        ? '💣 Tap the red area again to CONFIRM the blast — tap the card to cancel'
        : '🎯 Tap the red chip again to CONFIRM the snipe — tap the card to cancel'
      : null;

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <div className="game-wrap">
      {endConfirm}
      <FloatingReactions reaction={reaction} />
      <SuperSequence event={superEvent} />
      <CardEffect event={cardEffect} />
      <HowToPlay open={showHelp} onClose={() => setShowHelp(false)} />

      {turnFlash && (
        <div className="turn-flash" key={turnFlashKey}>
          <span
            className="turn-flash-text"
            style={{ '--turn-color': TEAM_HEX[turnFlashTeam ?? 'purple'] ?? '#ffd54f' } as React.CSSProperties}
          >
            ⚔️ {turnFlashLabel}
          </span>
        </div>
      )}

      {reconnecting && <div className="reconnect-banner">📡 Reconnecting…</div>}
      {leftNote && <div className="reconnect-banner">🚪 {leftNote} left the game</div>}

      {showLeaveConfirm && (
        <div className="overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 34, marginBottom: 6 }}>🚪</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Leave the battle?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              While you&apos;re away your turns are auto-played after 5 seconds. You can come back
              any time with the &quot;Back to game&quot; button on the home screen.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="ghost-btn" onClick={() => setShowLeaveConfirm(false)}>
                ⚔️ Stay
              </button>
              <button className="primary-btn" onClick={confirmLeave}>
                🚪 Leave game
              </button>
            </div>
          </div>
        </div>
      )}
      {reconnectedNote && <div className="reconnect-banner ok">✓ Reconnected</div>}

      {hintKey > 0 && (
        <div className="turn-hint-toast" key={hintKey}>
          ⏳ Not your turn yet — waiting for {activePlayer?.name ?? 'the other player'}
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
              <div
                className="winner-spotlight"
                style={{ ['--ring' as string]: TEAM_HEX[view.roundWinner ?? 'red'] }}
              >
                <span className="winner-rays" />
                <span className="winner-confetti">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <i key={i} style={{ ['--i' as string]: i } as React.CSSProperties} />
                  ))}
                </span>
                <span className="winner-medal">
                  {winChipPlayer ? (
                    <img src={charIcon(winChipPlayer.icon)} alt={winChipPlayer.name} />
                  ) : (
                    <span className="winner-medal-fallback">🏆</span>
                  )}
                  <span className="winner-star">★</span>
                </span>
                <div className="win-title" style={{ color: TEAM_HEX[view.roundWinner ?? 'red'] }}>
                  🏆 {winChipPlayer?.name ?? winnerTeam?.color ?? view.roundWinner} wins the round!
                </div>
                <div className="winner-sub">
                  Placed the winning chip — starts first next game!
                </div>
              </div>
              {view.roundWinnerGif && (
                <img src={view.roundWinnerGif} alt="celebration" className="gif-img win-gif" />
              )}
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
                {winChipPlayer?.name ?? winnerTeam?.color ?? view.roundWinner} wins the round!
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
        turnEndsAt={view.turnEndsAt}
        onEndGame={isHost ? requestEnd : undefined}
        muted={muted}
        onToggleMute={toggleMute}
        onHelp={() => setShowHelp(true)}
        leftSlot={
          <PlayerStrip
            players={turnQueue}
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
        }
        playedSlot={
          <div className="played-wrap">
            <button
              className={`icon-btn played-btn${showPlayed ? ' on' : ''}`}
              onClick={() => setShowPlayed((v) => !v)}
              title={showPlayed ? 'Hide played cards' : 'Show played cards'}
            >
              🃏
            </button>
            {showPlayed && (
              <div className="played-panel">
                <RecentPlays plays={view.recentPlays} players={view.players} />
              </div>
            )}
          </div>
        }
      />

      {/* Step 1: pick which opponent to Steal from / Freeze (popup list). */}
      {selectedCard &&
        (selectedCard.kind === 'steal' || selectedCard.kind === 'freeze') &&
        myTurn &&
        !frozen &&
        !stealTarget && (
          <TargetPicker
            mode={selectedCard.kind as 'steal' | 'freeze'}
            players={view.players.filter((p) =>
              (selectedCard.kind === 'freeze' ? eligibleFreezeTargets : eligibleStealTargets).has(p.id)
            )}
            handCounts={view.handCounts}
            onPick={(pid) => {
              if (selectedCard.kind === 'freeze') {
                emit('play-freeze', { code, cardId: selectedCard.id, targetId: pid });
                setSelectedCardId(null);
              } else {
                setStealTarget(pid); // advance to the blind card-pick
              }
            }}
            onCancel={() => {
              setStealTarget(null);
              setSelectedCardId(null);
            }}
          />
        )}

      {/* Reroll: popup to choose which other card to trade in. */}
      {selectedCard?.kind === 'reroll' && myTurn && !frozen && view.myHand.length > 1 && (
        <RerollPicker
          hand={view.myHand}
          rerollCardId={selectedCard.id}
          onPick={(swapId) => {
            emit('play-reroll', { code, cardId: selectedCard.id, swapCardId: swapId });
            setSelectedCardId(null);
          }}
          onCancel={() => setSelectedCardId(null)}
        />
      )}

      {/* Step 2 (Steal only): blindly pick one of that opponent's cards. */}
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
          onCancel={() => {
            setStealTarget(null);
            setSelectedCardId(null);
          }}
        />
      )}
      <Board
        cells={view.board}
        size={view.settings.boardSize}
        boardTheme={view.settings.boardTheme}
        targetable={numberCardHidden ? new Set<number>() : targetable}
        lastMoveIndex={lastPlaceIndex}
        removalCells={removalCells}
        dangerPreview={dangerPreview}
        shakeKey={shakeKey}
        pendingShield={selectedCard?.kind === 'shield' ? shieldPicks : undefined}
        revealNumbers={selectedCard?.kind === 'minus' || selectedCard?.kind === 'bomb'}
        allowAnyPick={numberCardHidden && myTurn && !frozen}
        wrongPick={wrongPick}
        keepBrightTeam={selectedCard?.kind === 'plus' ? actingTeam : null}
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
        armedHint={armedHint}
        hideAnswers={hideAnswers}
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
            style={{ background: 'linear-gradient(135deg, #ef5350, #b71c1c)', color: '#fff' }}
            onClick={onConfirm}
          >
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}
