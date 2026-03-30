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

    const params = new URLSearchParams({ q: trimmedQuery });
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search events, organizers, or hosts..."
        className="flex-grow p-3 rounded-md border border-default focus:outline-none focus:ring-2 focus:ring-accent transition"
      />
      <button type="submit" className="btn-highlighted px-4 py-3 bg-accent rounded-md">
        Search
      </button>
    </form>
  );
}
