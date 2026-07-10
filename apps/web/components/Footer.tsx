"use client";

import { useState, type ReactNode } from "react";
import pkg from "../package.json";

// Pull content from Environment Variables (prefixed for Next.js client-side tracking)
const DEVELOPER_NAME = process.env.NEXT_PUBLIC_DEVELOPER_NAME || "Open Source Contributor";
const DATENSCHUTZ_TEXT = process.env.NEXT_PUBLIC_DATENSCHUTZ_TEXT || "";
const SONSTIGES_TEXT = process.env.NEXT_PUBLIC_SONSTIGES_TEXT || "";

// Credit Text (Safe for Public Repo)
const CREDITS_TEXT = `Die in dieser Webapp verwendeten Jasskarten-Grafiken basieren auf dem Open-Source-Projekt von Diego Steiner. 

• Projekt-Link: <a href="https://github.com/diegosteiner/ch_jasskarten_svg" target="_blank">https://github.com/diegosteiner/ch_jasskarten_svg</a>
• Urheber: Diego Steiner
• Lizenz: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

Vielen Dank an den Urheber für das Bereitstellen der Jasskarten`;

// License Text (Safe for Public Repo)
const LICENSE_TEXT = `Rechtliche Hinweise & Lizenzierung

Diese Webapp nutzt ein duales Lizenzmodell:

• Anwendungs-Code: Die Software und der Quellcode dieser App sind Open Source und unter der GNU General Public License v3 (GPLv3) lizenziert.
• Karten: Die in dieser Anwendung gezeigten Karten sind urheberrechtlich geschützt und stehen unter der Lizenz Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)(genaue Urheber- und Quellenangaben sind unter Credits einsehbar).

Wichtiger Hinweis: Diese Anwendung ist streng nicht-kommerziell. Jede kommerzielle Nutzung, Werbung oder Monetarisierung dieser App in ihrer aktuellen Form (inklusive der Karten) ist untersagt.`;

// Helper function to render HTML links inside string constants safely
function renderWithLinks(text: string): ReactNode[] {
  const anchor = /<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = anchor.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <a
        key={key++}
        href={m[1]}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--gold-bright)" }}
      >
        {m[2]}
      </a>
    );
    last = anchor.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Shared style for the footer's text-link buttons.
const linkButtonStyle = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  cursor: "pointer",
  color: "var(--gold-bright)",
  textDecoration: "underline",
} as const;

// Modal overlay layout template
function InfoOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--felt-dark, #12351f)",
          border: "1px solid var(--gold-bright)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 640,
          maxHeight: "80vh",
          overflow: "auto",
          margin: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: "inherit", fontSize: 20, cursor: "pointer" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Main Footer component
export default function Footer() {
  const [showLicense, setShowLicense] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showDatenschutz, setShowDatenschutz] = useState(false);
  const [showSonstiges, setShowSonstiges] = useState(false);

  return (
    <>
      <footer
        style={{
          position: "fixed",
          bottom: 10,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 12,
          opacity: 0.6,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div>Jassen - Webapp by {DEVELOPER_NAME} | Version: {pkg.displayVersion ?? `v${pkg.version}`}</div>
        <div>
          <button
            type="button"
            onClick={() => setShowCredits(true)}
            style={linkButtonStyle}
          >
            Credits
          </button>
          {" | "}
          <button
            type="button"
            onClick={() => setShowLicense(true)}
            style={linkButtonStyle}
          >
            Lizenz
          </button>
          
          {/* Only render the Datenschutz button if text exists in .env */}
          {DATENSCHUTZ_TEXT && (
            <>
              {" | "}
              <button
                type="button"
                onClick={() => setShowDatenschutz(true)}
                style={linkButtonStyle}
              >
                Datenschutz
              </button>
            </>
          )}
          
          {/* Only render the Sonstiges button if text exists in .env */}
          {SONSTIGES_TEXT && (
            <>
              {" | "}
              <button
                type="button"
                onClick={() => setShowSonstiges(true)}
                style={linkButtonStyle}
              >
                Sonstiges
              </button>
            </>
          )}
        </div>
      </footer>

      {showCredits && (
        <InfoOverlay title="Credits" onClose={() => setShowCredits(false)}>
          <h3 style={{ margin: "0 0 6px" }}>Karten-Design:</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0, fontFamily: "inherit" }}>
            {renderWithLinks(CREDITS_TEXT)}
          </pre>
        </InfoOverlay>
      )}

      {showLicense && (
        <InfoOverlay title="Lizenz" onClose={() => setShowLicense(false)}>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0, fontFamily: "inherit" }}>
            {LICENSE_TEXT}
          </pre>
        </InfoOverlay>
      )}

      {showDatenschutz && DATENSCHUTZ_TEXT && (
        <InfoOverlay title="Datenschutz" onClose={() => setShowDatenschutz(false)}>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0, fontFamily: "inherit" }}>
            {DATENSCHUTZ_TEXT}
          </pre>
        </InfoOverlay>
      )}

      {showSonstiges && SONSTIGES_TEXT && (
        <InfoOverlay title="Sonstiges" onClose={() => setShowSonstiges(false)}>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0, fontFamily: "inherit" }}>
            {SONSTIGES_TEXT}
          </pre>
        </InfoOverlay>
      )}
    </>
  );
}