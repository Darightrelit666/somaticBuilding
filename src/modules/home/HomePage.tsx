import React from "react";
import { Link } from "react-router";
import homeHero from "../../assets/home-hero.png";

export function HomePage() {
  return (
    <div className="min-h-screen bg-[#07090d] text-white">
      <div className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${homeHero})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/90" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-300">Physical OS</p>
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">
              Build your physical system
            </h1>
            <p className="text-sm text-zinc-300">
              Modular training. RPG progression.
            </p>
          </div>
          <Link
            to="/training"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-white/10 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_25px_rgba(255,255,255,0.15)] backdrop-blur transition hover:bg-white/20"
          >
            Start Training
          </Link>
        </div>
      </div>
    </div>
  );
}
