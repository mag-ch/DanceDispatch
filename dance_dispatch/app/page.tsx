// File: src/app/page.tsx

import Link from "next/link";
import { Suspense } from "react";
import { getEvents } from "@/lib/utils"; 
import { EventCard } from "./components/EventCard"; // You will create this too

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Hero Section */}
      <section className="py-24 text-center bg-white shadow-sm">
        <h1 className="text-4xl font-bold mb-4">
          Discover events, organizers, and hosts near you.
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Search, explore, and learn more about the people behind the events.
        </p>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <SearchBar />
        </div>
      </section>

      {/* Trending Events */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-6">Trending Events</h2>

        <Suspense fallback={<p>Loading events...</p>}>
          <TrendingEvents />
        </Suspense>
      </section>

      {/* Value Props */}
      <section className="bg-white py-20 shadow-inner">
        <div className="container mx-auto px-6 grid md:grid-cols-3 gap-8 text-center">
          <ValueProp
            title="Discover Events Quickly"
            text="Browse trending events or search for something specific."
          />
          <ValueProp
            title="See Who’s Behind the Event"
            text="Learn more about organizers and hosts with detailed profiles."
          />
          <ValueProp
            title="Personalized Feed Coming Soon"
            text="Your future home for events tailored to your interests."
          />
        </div>
      </section>

      {/* Navigation Cards */}
      <section className="container mx-auto px-6 py-20">
        <h2 className="text-2xl font-semibold mb-8 text-center">
          Explore More
        </h2>

        <div className="grid md:grid-cols-4 gap-6">
          <NavCard title="Browse All Events" href="/feed" />
          <NavCard title="Search" href="/search" />
          <NavCard title="Organizers" href="/organizers" />
          <NavCard title="Hosts" href="/hosts" />
        </div>
      </section>
    </main>
  );
}

/* -------------------------------------------
   Trending Events Server Component
------------------------------------------- */
async function TrendingEvents() {
  const events = await getEvents(); // CSV or API

  if (!events.length) {
    return <p>No events available.</p>;
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {events.map((event: any) => (
        <EventCard key={event.ID} event={event} />
      ))}
    </div>
  );
}

/* -------------------------------------------
   SearchBar Component
------------------------------------------- */
function SearchBar() {
  return (
    <form action="/search" method="get" className="flex gap-2">
      <input
        type="text"
        name="query"
        placeholder="Search events, organizers, or hosts..."
        className="flex-grow p-3 rounded-md border border-gray-300"
      />
      <button
        type="submit"
        className="px-4 py-3 bg-black text-white rounded-md hover:bg-gray-800"
      >
        Search
      </button>
    </form>
  );
}

/* -------------------------------------------
   ValueProp Component
------------------------------------------- */
function ValueProp({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-4">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{text}</p>
    </div>
  );
}

/* -------------------------------------------
   Navigation Card Component
------------------------------------------- */
function NavCard({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-center"
    >
      <h3 className="text-lg font-semibold">{title}</h3>
    </Link>
  );
}

// import Image from "next/image";

// export default function Home() {
//   return (
//     <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
//       <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
//         <Image
//           className="dark:invert"
//           src="/next.svg"
//           alt="Next.js logo"
//           width={100}
//           height={20}
//           priority
//         />
//         <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
//           <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
//             To get started, edit the page.tsx file.
//           </h1>
//           <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
//             Looking for a starting point or more instructions? Head over to{" "}
//             <a
//               href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//               className="font-medium text-zinc-950 dark:text-zinc-50"
//             >
//               Templates
//             </a>{" "}
//             or the{" "}
//             <a
//               href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//               className="font-medium text-zinc-950 dark:text-zinc-50"
//             >
//               Learning
//             </a>{" "}
//             center.
//           </p>
//         </div>
//         <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
//           <a
//             className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
//             href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             <Image
//               className="dark:invert"
//               src="/vercel.svg"
//               alt="Vercel logomark"
//               width={16}
//               height={16}
//             />
//             Deploy Now
//           </a>
//           <a
//             className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
//             href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             Documentation
//           </a>
//         </div>
//       </main>
//     </div>
//   );
// }
