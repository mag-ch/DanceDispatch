import Link from "next/link";

export default function MissionPage() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <section className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-6">What is our Mission?</h1>
        <div className="rounded-xl border border-default bg-surface p-6 space-y-5">
          <p className="text-base leading-7 text-text/90">
            On the surface, DanceDispatch helps people discover events, venues and DJs in local underground music scenes.
          </p>
          <p className="text-base leading-7 text-text/90">
            However, it goes much deeper than that.
          </p>

          <div className="pt-2">
            <h2 className="text-xl font-semibold mb-3">The Decline of Club Culture</h2>
            <p className="text-base leading-7 text-text/90">
              The decline of club culture, spurred by soaring rent, declining liquor sales, and commercialization, has left many dancers and underground music enthusiasts yearning for the vibrant nightlife ecosystem that once was.
              In New York, Mayor Rudy Giuliani's "Quality of Life" campaign in the late 1990s led to the closure of many iconic clubs, and similar trends have been observed in other cities worldwide. The loss of these cultural hubs has fragmented communities and destroyed the "homes" of clubheads from the era.
            </p>
          </div>
          <div className="pt-2">
            <h2 className="text-xl font-semibold mb-3">The Rise of House Dance</h2>
            <p className="text-base leading-7 text-text/90">
                At the same time, seemingly contrarily, "house dance" as a style has experienced a meteoric rise in the global street dance scene, with communities and battle scenes arising all across Asia and Europe. This is large in part due to the codification of house dance styles and techniques, spread around the world by pioneering New York crews like Elite Force, Dance Fusion, and Mop Top Universal.
                This has created a paradoxical situation, where a club-born style of dance is thriving outside of the very environment that birthed it.
                While exposure for house dance is a wonderful thing, DanceDispatch's mission is to bring house dance back to the place it originated, and to help rebuild the nightlife ecosystem that has been lost. Not just in New York, but in cities all over the world.
            </p>
            
          </div>
          <div className="pt-2">
            <p className="text-base leading-7 text-text/90 font-bold">
                Dancers are told that they need a teacher to show them steps in a mirrored studio. The truth is, true house dance is learned in the club, where dancers are free to express themselves and develop their own style. DanceDispatch aims to help dancers find these spaces, and to help underground music thrive in spaces where dancers need it.
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
