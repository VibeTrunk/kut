"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#020617", color: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: "20px" }}>
          <section style={{ maxWidth: "560px" }}>
            <p style={{ color: "#fbbf24", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>KUT</p>
            <h1>Something went wrong</h1>
            <p>Please retry this page. If the problem continues, contact an administrator.</p>
            <button onClick={reset} style={{ background: "#fbbf24", border: 0, borderRadius: "12px", cursor: "pointer", fontWeight: 800, padding: "12px 16px" }} type="button">Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
