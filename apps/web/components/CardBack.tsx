"use client";

const ASPECT = 246.62 / 158.74;

export function CardBack({ width = 60 }: { width?: number }) {
  const height = width * ASPECT;
  return (
    <div
      className="card-back"
      style={{
        width,
        height,
        borderRadius: width * 0.08,
        background: "linear-gradient(135deg, #1b3a6b 0%, #234b8a 50%, #16305c 100%)",
        border: "2px solid var(--gold)",
        boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--gold-bright)",
        fontSize: width * 0.5,
      }}
    >
      ⚜
    </div>
  );
}

/** A fanned stack of card backs for an opponent's hand. */
export function CardFan({ count, width = 44 }: { count: number; width?: number }) {
  const shown = Math.min(count, 5);
  const overlap = width * 0.55;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex" }}>
        {Array.from({ length: shown }, (_, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : -overlap }}>
            <CardBack width={width} />
          </div>
        ))}
      </div>
      {count > shown && (
        <span style={{ marginLeft: 6, color: "var(--cream)", fontSize: 13 }}>+{count - shown}</span>
      )}
    </div>
  );
}
