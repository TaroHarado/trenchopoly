import Link from "next/link";
import Image from "next/image";
import { GamePreviewBoard } from "@/components/GamePreviewBoard";

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, black 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-32 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Image
              src="/logo.png"
              alt="Trenchopoly Logo"
              width={80}
              height={80}
              className="rounded-2xl"
              priority
            />
            <h1 className="text-7xl md:text-8xl font-medium text-black tracking-tight">
              Trenchopoly
            </h1>
          </div>
          <p className="text-2xl text-gray-700 mb-6 font-normal">
            Monopoly-style game for Solana traders
          </p>
          <p className="text-xl text-gray-600 mb-12 max-w-xl mx-auto font-normal">
            When the market is trash, just play a game instead.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/lobby"
              className="btn-primary"
            >
              Play now
            </Link>
            <Link
              href="/lobby"
              className="btn-secondary"
            >
              View games
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-gray-200 py-24 relative z-10">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              title="Free and paid games"
              description="Play for fun or compete for SOL prizes"
            />
            <FeatureCard
              title="Win SOL"
              description="Winner takes all in paid games"
            />
            <FeatureCard
              title="Custom tiles and cards"
              description="Collect and use unique items"
            />
            <FeatureCard
              title="Loot boxes"
              description="Open cases to get rare items"
            />
            <FeatureCard
              title="Trade on marketplace"
              description="Buy and sell items for SOL"
            />
            <FeatureCard
              title="Play from anywhere"
              description="Fully online, real-time gameplay"
            />
          </div>
        </div>
      </section>

      {/* Game Preview */}
      <section className="border-t border-gray-200 py-24 bg-gray-50/50 relative z-10">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-medium text-center mb-12 text-black">
              Game Preview
            </h2>
            <GamePreviewBoard />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 relative z-10">
        <div className="container mx-auto px-6">
          <div className="text-center text-gray-500 text-sm">
            <p>© 2025Trenchopoly. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="card p-8">
      <h3 className="text-xl font-semibold mb-3 text-black">
        {title}
      </h3>
      <p className="text-gray-600 text-base">{description}</p>
    </div>
  );
}
