'use client';

// Three-step "How to play" modal for first-time players. Shown automatically once
// per device on the home screen, and reachable any time from a "?" button.
const STEPS = [
  {
    icon: '🏆',
    title: 'Make a line to win',
    text: 'Drop your squads on the battlefield. Get enough in a row — across, down, or diagonal — and they upgrade to TANKS (a Line Win). Fill a whole row and they become FIGHTER JETS — that counts as 2 Line Wins! FREE BASE corners count for every team.',
  },
  {
    icon: '🃏',
    title: 'Number cards deploy squads',
    text: 'Each card shows a math equation. Tap a card, then tap the matching glowing circle on the board to deploy your squad there. (Hard mode hides the circles — solve it yourself!)',
  },
  {
    icon: '💣',
    title: 'Action cards shake things up',
    text: '💣 Bomb blasts a 2×2 patch · 🎯 Snipe shoots an enemy chip · 🧊 Freeze skips a turn · 🗡️ Steal grabs a card · 🛡️ Shield secretly protects your chips · 🔀 Reroll trades cards · 🪂 Airdrop lands anywhere.',
  },
];

export default function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal howto-modal" onClick={(e) => e.stopPropagation()}>
        <div className="howto-title">⚔️ How to play</div>
        {STEPS.map((s, i) => (
          <div className="howto-step" key={i}>
            <div className="howto-icon">{s.icon}</div>
            <div>
              <div className="howto-step-title">
                {i + 1}. {s.title}
              </div>
              <div className="howto-step-text">{s.text}</div>
            </div>
          </div>
        ))}
        <button className="primary-btn" style={{ marginTop: 16 }} onClick={onClose}>
          Got it — let&apos;s battle!
        </button>
      </div>
    </div>
  );
}
