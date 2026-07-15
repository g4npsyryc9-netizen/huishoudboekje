"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Next.js redacts the real message of any error thrown from a Server
  // Component/Server Action in production builds (security measure, not a
  // bug) — so error.message here is generally a generic English notice, not
  // the Dutch guard/validation text the action actually threw. Show our own
  // Dutch fallback instead of that redacted text.
  const message = error.message?.includes("Server Components render")
    ? "Er ging iets mis bij het opslaan. Probeer het opnieuw."
    : error.message || "Er ging iets mis. Probeer het opnieuw.";

  return (
    <div className="mx-auto max-w-md space-y-4 rounded border bg-white p-6 text-center">
      <p className="text-red-600">{message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}
