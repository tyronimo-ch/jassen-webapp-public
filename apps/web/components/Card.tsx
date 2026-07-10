"use client";
import type { Card as CardType } from "@jassen/game-engine";

const ASPECT = 246.62 / 158.74;

interface CardProps {
  card: CardType;
  width?: number;
  onClick?: () => void;
  highlight?: boolean;
  dimmed?: boolean;
}

export default function Card({ card, width = 90, onClick, highlight, dimmed }: CardProps) {
  const height = width * ASPECT;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="card"
      style={{
        width,
        height,
        cursor: onClick ? "pointer" : "default",
        opacity: dimmed ? 0.4 : 1,
        background: "#fbfaf5",
        borderRadius: width * 0.08,
        padding: width * 0.04,
        border: "1px solid rgba(0,0,0,0.15)",
        boxShadow: highlight
          ? "0 0 0 3px var(--gold-bright), 0 6px 14px rgba(0,0,0,0.45)"
          : "0 4px 10px rgba(0,0,0,0.4)",
        transform: highlight ? "translateY(-10px)" : "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/cards/${card.suit}/${card.rank}.svg`}
        alt={`${card.rank} of ${card.suit}`}
        width="100%"
        height="100%"
        draggable={false}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </button>
  );
}
