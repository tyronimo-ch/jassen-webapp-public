"use client";
import type { GameMode } from "@jassen/game-engine";

const RULES: Record<GameMode, { title: string; lines: string[] }> = {
  schieber: {
    title: "Schieber",
    lines: [
      "4 Spieler in 2 Teams (Sitze gegenüber spielen zusammen). Jeder erhält 9 Karten.",
      "In der ersten Runde beginnt, wer die Rosen 10 hat; danach rückt der Beginner weiter.",
      "Die Vorderhand wählt den Trumpf (eine Farbe, Obenabe oder Undenufe) oder schiebt einmal zum Partner.",
      "Trumpf-Werte: Under (Buur) = 20, Nell (9) = 14, Ass = 11, 10 = 10, König = 4, Ober = 3.",
      "Trumpf darf jederzeit gespielt werden, auch wenn du die angespielte Farbe hättest.",
      "Multiplikator: Rosen/Eichel ×1, Schelle/Schilten ×2, Obenabe/Undenufe ×3.",
      "Wyss: vor deiner ersten Karte auf «Wysse» drücken. Nur das Team mit dem höchsten Wyss erhält die Punkte; ohne Knopfdruck zählt es nicht.",
      "Boni: Stöck (König + Ober im Trumpf) +20, letzter Stich +5, Match (alle 9 Stiche) +100.",
      "Coiffeur (optional): zusätzliche Spiele. Slalom = jeder Stich abwechselnd Obenabe/Undenufe (×4). Guschti = die ersten 5 Stiche in eine Richtung, dann umgekehrt (×5). Gezählt wird nach der Startrichtung.",
      "Ziel: als Team die einstellbare Zielpunktzahl erreichen (Standard 2500).",
    ],
  },
  differenzler: {
    title: "Differenzler",
    lines: [
      "4 Spieler, jeder für sich. Jeder erhält 9 Karten.",
      "Der Trumpf wird jede Runde zufällig bestimmt. Klassisch: nur die 4 Farben. Gestört: zusätzlich Obenabe und Undenufe.",
      "Vor dem Ausspielen sagt jeder eine Punktzahl an (0–157), die er zu machen glaubt.",
      "Am Ende zählt die Differenz zwischen Ansage und erreichten Punkten als Minuspunkte.",
      "Punkte im Stapel: 152 Kartenpunkte + 5 für den letzten Stich = 157.",
      "Die Anzahl Runden ist einstellbar (3, 6, 9 oder 12). Danach gewinnt, wer die wenigsten Minuspunkte hat.",
    ],
  },
  custom: {
    title: "Fuck Your Neighbour",
    lines: [
      "2–6 Spieler, jeder für sich. Die Kartenzahl steigt und fällt. Das Spiel startet mit einer Karte",
      "Reihum sagt jeder an, wie viele Stiche er machen will.",
      "Die Summe aller Ansagen darf nicht der Anzahl Karten entsprechen, der letzte Spieler ist eingeschränkt.",
      "Punkte: genau getroffen = 10 + Ansage. Daneben = −1 pro Stich Abweichung.",
      "In der 1-Karten-Runde siehst du deine eigene Karte nicht, aber die aller anderen. Beim Ausspielen liegt sie offen.",
      "Klassisch: Die 8 ist die höchste Karte, danach folgt die normale Reihenfolge (A, K, O, U, 10, 9, 7, 6). Bei gleichem Wert entscheidet die Farbe: Rosen > Eichel > Schelle > Schilten. Kein Farbzwang.",
      "Stechen: Es gilt die normale Rangfolge der Karten (das Ass ist die höchste Karte). Haben mehrere Spieler den gleichen höchsten Wert gelegt, kommt es zum Stechen. Die beteiligten Spieler legen dafür eine weitere Karte ab, die Karten werden erst aufgedeckt wenn alle beteiligten Spieler eine Karte ausgewählt haben. Wer nun höchsten Wert hat, gewinnt den gesamten Stich (den ursprünglichen Stich plus alle Karten aus den Stechrunden). Die unbeteiligten Spieler werfen in dieser Runde lediglich eine beliebige Karte ab. Sind keine Karten mehr zum Stechen übrig (letzter Stich oder erneuter Gleichstand beim Stechen), heben sich die gleich hohen Karten auf, und die zweithöchste Karte gewinnt den Stich.",
      "Härte: Farbe schlägt Wert: Die Kartenfarbe ist wichtiger als die Zahl. Jede höhere Farbe schlägt alle Karten einer niedrigeren Farbe (z. B. Schillte 6 schlägt Schellen Ass). Farben-Reihenfolge Schilte > Schelle > Eichel > Rosen. Innerhalb der Farbe: Normale Rangordnung (Ass am höchsten, 6 am tiefsten).",
    ],
  },
  pandur: {
    title: "Pandur",
    lines: [
      "Das Grundprinzip: Streng nach Abmachung - Der Pandur wird konsequent nach vereinbarten Regeln gespielt, wobei Fehler (wie falsches Weisen oder Ausspielen) sofort zum Verlust des Spiels führen. Gespielt wird mit 24 Karten (6er, 7er und 8er werden entfernt). Ein Einzelspieler (Spielübernehmer) tritt gegen das gegnerische Team an. Zu dritt spielen alle aktiv mit (ohne passiven Kartengeber). Ziel ist es, eine feste Anzahl an Schreibpunkten (z. B. 15, 17 oder 21) zu erreichen.",
      "Karten verteilen und Steigern: Der Geber teilt den drei Spielern je 8 Karten aus (zweimal 4 Karten). Danach wird gesteigert. Vorhand beginnt mit einem Punktegebot, das er glaubt, mit Karten- und Weispunkten zusammen zu erreichen. Das Mindestgebot beträgt 100 Punkte. Jedes folgende Gebot muss mindestens 10 Punkte höher sein und darf jede beliebige Zahl sein (z.B. 101, 144). Wer einmal passt, scheidet aus. Der Höchstbietende wird Spielübernehmer.",
      "Besondere Gebote und Rangfolge: Neben normalen Zahlengeboten gibt es Spezialansagen mit fester Rangfolge. Höher als 200 Punkte sind «Misère ohne» (ohne Trumpf, kein Stich erlaubt) und «Misère mit» (ausgespielte Karte bestimmt Trumpf, kein Stich erlaubt). Noch höher sind «Pandur ohne» (Obenabe, alle Stiche machen) und «Pandur mit» (ausgespielte Farbe bestimmt Trumpf, alle Stiche machen). Ein angesagter «Pandur mit» kann sofort ausgespielt werden und nicht mehr überboten werden.",
      "Weisregeln beim Pandur: Es gelten die normalen Weisregeln, jedoch mit einer strengen Besonderheit. Weist der Spielübernehmer gar nicht, dürfen auch die Gegner keinen Weis deklarieren. Meldet der Spielübernehmer einen Weis und haben beide Gegner ebenfalls einen, zählt nur der jeweils höchste Weis der Gegner. Der zweite Gegner darf seinen tieferen oder gleich hohen Weis nicht mehr deklarieren, andernfalls verliert sein Team das Spiel.",
      "Punktewertung und Spielende: Erreicht der Spielübernehmer sein Gebot, erhält er feste Schreibpunkte (z. B. 2 Punkte bei 100-140, 4 Punkte bei Misère/200, 6 Punkte bei Pandur/300). Verfehlt er sein Gebot, «erben» die Gegner diese Schreibpunkte. Wichtig: Die Zielpunktzahl kann man nur überschreiten und das Spiel gewinnen, wenn man das Spiel in dieser Runde selbst als Spielübernehmer angesagt und gewonnen hat. Durch Erben kann man nicht gewinnen.",
    ],
  },
  bieter: {
    title: "Bieter",
    lines: [
      "Das Grundprinzip: Einer gegen Zwei - Ziel des Einzelspielers (Meistbietender / «König»): Er muss die von ihm selbst gebotene Punktzahl (z. B. 650 Punkte) erreichen. Ziel der Gegenpartei (Die zwei «Bauern»): Sie spielen als Team zusammen und müssen insgesamt 1'000 Punkte erreichen. Gewinner: Wer sein jeweiliges Ziel zuerst erreicht, gewinnt das gesamte Spiel.",
      "Karten verteilen und das Bietverfahren (Erste Runde): Das Spiel beginnt mit einer Besonderheit beim Austeilen und einem Biet-Prozess. Karten verteilen: Jeder der 3 Spieler erhält 10 Karten. Die restlichen 6 Karten werden auf den Tisch gelegt: 3 verdeckt, 3 offen. Das Bieten: Der Spieler rechts vom Kartengeber beginnt. Das Mindeststartgebot beträgt standardmässig 500 Punkte. Es wird reihum im Uhrzeigersinn geboten. Jedes neue Gebot muss mindestens 10 Punkte höher sein. Wer nicht mehr mitbieten will, steigt aus. Wichtig: Wer einmal aussteigt, darf in dieser Runde nicht wieder einsteigen. Der Meistbietende («König»): Das Bieten läuft so lange, bis zwei Spieler ausgestiegen sind. Der verbleibende Spieler ist der Meistbietende. (Bietet niemand, wird neu gegeben).",
      "Kartentausch des Meistbietenden: Der König nimmt die 6 Karten vom Tisch auf (hält kurzzeitig 16 Karten) und legt anschliessend 6 beliebige Karten verdeckt ab, sodass er wieder 10 Karten hält. Diese abgelegten Karten dürfen den Gegnern nicht gezeigt werden und zählen am Ende als seine Spielpunkte. Danach bestimmt er den Trumpf und spielt die erste Karte aus.",
      "Ab der 2. Runde (Bodentrumpf): Es wird nicht mehr geboten. Der Stapel wird abgehoben und die unterste Karte offen gezeigt. Ihre Farbe bestimmt den Trumpf für diese Runde (Ass bedeutet Obeabe, 6 bedeutet Undeufe). Die aufgedeckte Karte gehört dem Geber.",
      "Das «Mitkommen»: Vor dem allerersten Stich der Folgerunden muss die Gegenpartei den König fragen, ob er mitspielt. Spielt er mit, wird die Runde normal ausgetragen. Passt er wegen schlechter Karten, erhält die Gegenpartei kampflos 157 Punkte (oder 257 je nach Abmachung) sowie eventuelle Stöckpunkte gutgeschrieben, während der König leer ausgeht.",
    ],
  },
};

export default function RulesOverlay({ mode, onClose }: { mode: GameMode; onClose: () => void }) {
  const r = RULES[mode];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{ maxWidth: 540, maxHeight: "82vh", overflowY: "auto" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Regeln — {r.title}</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: "4px 12px" }}
          >
            Schliessen
          </button>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10, lineHeight: 1.5 }}>
          {r.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
