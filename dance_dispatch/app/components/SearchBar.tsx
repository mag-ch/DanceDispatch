"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      router.push("/search");
      return;
    }

    const params = new URLSearchParams({ query: trimmedQuery });
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-16 overflow-hidden rounded-[1.6rem] border border-white/15 bg-[#08070d]/80 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <input
        type="text"
        name="query"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search parties, venues, and DJs by name..."
        className="min-w-0 flex-grow bg-transparent px-4 text-base text-white placeholder:text-white/55 focus:outline-none sm:text-lg"
      />
     <button type="submit" className="btn-highlighted shrink-0 rounded-[1.2rem] px-5 py-3 text-sm font-bold text-black sm:px-8 sm:text-base">
        Search
      </button>
    </form>
  );
}
