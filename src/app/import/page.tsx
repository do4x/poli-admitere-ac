import { ImportClient } from "./ImportClient";

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Import probleme
        </h1>
        <p className="mt-1 text-sm text-muted">
          Trage un fișier JSON pentru a previzualiza înainte de a scrie.
        </p>
      </div>
      <ImportClient />
    </div>
  );
}
