import Link from "next/link";

export default function AuthPrompt() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to DanceDispatch</h1>
        <p className="text-lg text-gray-600 mb-8">Sign in to discover events and save your favorites.</p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/login" className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800">
            Sign In
          </Link>
          <Link href="/auth/signup" className="px-6 py-3 bg-gray-200 text-gray-900 rounded-md hover:bg-gray-300">
            Sign Up
          </Link>
        </div>
      </div>
    </main>
  );
}