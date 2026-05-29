'use client';

const EMOJIS = ['😂', '😢', '😮', '🔥', '👏', '😤', '🎉'];

export default function EmojiPanel({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="emoji-panel">
      {EMOJIS.map((e) => (
        <button key={e} className="emoji-btn" onClick={() => onReact(e)}>
          {e}
        </button>
      ))}
    </div>
  );
}
