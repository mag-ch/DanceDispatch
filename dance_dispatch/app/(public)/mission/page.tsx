import Link from "next/link";

export default function MissionPage() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <section className="container mx-auto px-4 py-8 max-w-3xl ">
        <div className="mb-6 relative overflow-hidden rounded-xl border border-cyan-400/35 bg-gradient-to-br from-cyan-50 via-surface to-amber-50 p-6 shadow-[0_18px_50px_rgba(8,145,178,0.18)] dark:from-cyan-500/10 dark:via-surface dark:to-amber-500/10 p-6 space-y-5">

          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl"
          />


        <h1 className="text-4xl font-bold mb-6">What is our Mission?</h1>
          <p className="text-base leading-6 font-bold text-cyan-700 dark:text-cyan-300">
            To dispatch dancers to the club and bring house dance back to its roots in the culture!
          </p>
          <p className="text-base leading-7 text-text/90">
            This is not an events aggregator. 
          </p>
          <p className="text-base leading-7 text-text/90">
            This is a hub for dancers and clubheads to share information and discover events (think Beli, but for parties!) 
          </p>

          <p className="text-base leading-7 text-text/90">
            This is a platform for DIY parties to reach the audience that will appreciate them. 
          </p>

          <p className="text-base leading-7 text-text/90">
            This is a tool for underground communities to flourish, independent of ticketing platforms, commercial venues, and social media algorithms.
          </p>

           <div className="pt-2">
            <p className="text-base leading-7 text-text/90 font-bold">
                Dancers are told that they need a teacher to show them steps in a mirrored studio. The truth is, true house dance is learned in the club, where dancers are free to express themselves and develop their own style. DanceDispatch aims to help dancers find these spaces, and to help underground music thrive in spaces where dancers need it.
            </p>
        </div>

           </div>
        <div className="relative overflow-hidden rounded-xl border border-cyan-400/35 bg-gradient-to-br from-cyan-50 via-surface to-amber-50 p-6 shadow-[0_18px_50px_rgba(8,145,178,0.18)] dark:from-cyan-500/10 dark:via-surface dark:to-amber-500/10 p-6 space-y-5">

        <h1 className="text-4xl font-bold py-6 mb-2">What is our Vision?</h1>
            <p className="text-base leading-7  font-bold text-cyan-700 dark:text-cyan-300">
            For every house community to have access to clubs and parties - either in their city or a nearby accessible metropolitan area.
            </p>
          <div className="pt-2">
            <h2 className="text-xl font-semibold mb-3">The Decline of Club Culture</h2>
            <p className="text-base leading-7 text-text/90">
              Mayor Rudy Giuliani's "Quality of Life" campaign in late 1990s NYC led to the closure of many iconic clubs, fragmenting communities and leaving dancers without a "home." 
              Social media and commercialization has eroded genuine underground music and culture.
              Gentrification, soaring rent, and declining liquor sales has made it harder for venues to keep their doors open.
            </p>
          </div>
          <div className="pt-2">
            <h2 className="text-xl font-semibold mb-3">The Rise of House Dance</h2>
            <p className="text-base leading-7 text-text/90">
                At the same time, seemingly contrarily, "house dance" as a style has risen meteorically in the global street dance scene, with battles held all across Asia and Europe. This is large in part due to the codification and exportation of house dance in the 1990s.
                This has created a paradoxical situation, where a club-born style of dance is thriving outside of the very environment that birthed it.
                While exposure for house dance is a wonderful thing, DanceDispatch's mission is to bring house dance back to the place it originated, and to help rebuild the nightlife ecosystem that has been lost. Not just in New York, but in cities all over the world.
            </p>
            
          </div>
         
        <div className="pt-2">
            
             <p className="text-base leading-7 text-text/90">
             If this mission resonates with you, please consider supporting us by submitting events, sharing our platform, or donating to help us continue our work. Contact us via Instagram DM @dancedipat.ch!
            </p>
        </div>

          {/* <div className="pt-2">
            <h2 className="text-xl font-semibold mb-3">Contact</h2>
            <ul className="space-y-2 text-text/90">
              <li>Email: hello@dancedispatch.com</li>
              <li>Instagram: @dancedispat.ch</li>
            </ul>
          </div> */}

          <div className="pt-2">
            <Link href="/" className="text-sm font-semibold text-accent hover:underline">
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
