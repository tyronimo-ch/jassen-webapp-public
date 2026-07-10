"use client";
import type { Card as CardType } from "@jassen/game-engine";
import { sortHand } from "@/lib/sortHand";
import Card from "./Card";

interface HandProps {
  hand: CardType[];
  legal: CardType[];
  myTurn: boolean;
  cardW: number;
  onPlay: (card: CardType) => void;
}

function isLegal(legal: CardType[], card: CardType): boolean {
  return legal.some((c) => c.suit === card.suit && c.rank === card.rank);
}

export default function Hand({ hand, legal, myTurn, cardW, onPlay }: HandProps) {
  const sorted = sortHand(hand);
  const overlap = sorted.length * cardW > 640 ? -cardW * 0.35 : 6;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      {sorted.map((card, i) => {
        const legalNow = myTurn && isLegal(legal, card);
        return (
          <div key={`${card.suit}-${card.rank}`} style={{ marginLeft: i === 0 ? 0 : overlap }}>
            <Card
              card={card}
              width={cardW}
              highlight={legalNow}
              dimmed={myTurn && !legalNow}
              onClick={legalNow ? () => onPlay(card) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
