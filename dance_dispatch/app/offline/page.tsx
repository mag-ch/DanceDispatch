import Link from "next/link";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-bg text-text px-6 py-20 flex items-center justify-center">
      <section className="max-w-md w-full text-center card p-8">
        <h1 className="text-3xl font-bold mb-3">You are offline</h1>
        <p className="text-muted mb-6">
          DanceDispatch cannot reach the network right now. You can retry or go back home.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-highlighted rounded-md px-5 py-2.5 text-sm font-semibold">
            Go Home
          </Link>
          <Link
            href="/"
            className="rounded-md px-5 py-2.5 text-sm font-semibold border border-default hover-bg-accent-soft"
          >
            Retry
          </Link>
        </div>
      </section>
    </main>
  );
}
