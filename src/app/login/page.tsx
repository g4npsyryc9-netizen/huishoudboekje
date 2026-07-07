export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        action="/api/auth/login"
        method="POST"
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <h1 className="text-xl font-semibold text-gray-900">Huishoudboekje</h1>
        {error && (
          <p className="text-sm text-red-600">Onjuist wachtwoord.</p>
        )}
        <input
          type="password"
          name="password"
          placeholder="Wachtwoord"
          required
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
        >
          Inloggen
        </button>
      </form>
    </div>
  );
}
