import React from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Columns, Crown, Repeat, Eye, ShieldCheck, MoveUpRight } from "lucide-react";
import homeHero from "../../assets/home-hero.png";

const philosophyItems = [
  {
    title: "Structure",
    copy: "Your body is a system",
    icon: Columns,
  },
  {
    title: "Control",
    copy: "Mastery is precision",
    icon: Crown,
  },
  {
    title: "Consistency",
    copy: "Repetition builds identity",
    icon: Repeat,
  },
];

const systemOverview = [
  {
    title: "Movement",
    copy: "Express strength through deliberate motion.",
    icon: MoveUpRight,
  },
  {
    title: "Awareness",
    copy: "Refine technique with grounded attention.",
    icon: Eye,
  },
  {
    title: "Discipline",
    copy: "Follow the system. Let it shape you.",
    icon: ShieldCheck,
  },
];

export function SomaticArchitectLandingPage() {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-zinc-100">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={homeHero}
            alt=""
            className="h-full w-full object-contain object-top md:object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/80 to-black/95" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="space-y-6"
          >
            <p className="text-xs uppercase tracking-[0.4em] text-[#c9b37d]">
              Somatic Architect
            </p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Become Your Own Architect
            </h1>
            <div className="flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.4em] text-[#c9b37d]/80">
              <span className="h-px w-10 bg-[#c9b37d]/30" />
              Biological Optimization
              <span className="h-px w-10 bg-[#c9b37d]/30" />
            </div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-300">
              Train. Refine. Repeat.
            </p>
            <Link
              to="/training"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-[#c9b37d]/50 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#c9b37d] transition hover:bg-[#c9b37d]/10"
            >
              Start Training
            </Link>
          </motion.div>
        </div>
      </div>

      <main className="mx-auto flex max-w-6xl flex-col gap-20 px-6 py-20">
        <section className="grid gap-6 md:grid-cols-3">
          {philosophyItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6 }}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-6"
              >
                <Icon className="h-5 w-5 text-[#c9b37d]" />
                <h3 className="mt-4 font-serif text-xl text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{item.copy}</p>
              </motion.div>
            );
          })}
        </section>

        <section className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          >
            <p className="text-xs uppercase tracking-[0.35em] text-[#c9b37d]">
              Today's Practice
            </p>
            <p className="mt-4 font-serif text-2xl text-white">
              You showed up. That's the first victory.
            </p>
            <Link
              to="/training"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-[#c9b37d] px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#0f0f0f] transition hover:bg-[#dcc78f]"
            >
              Continue Training
            </Link>
          </motion.div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {systemOverview.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6 }}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-6"
              >
                <Icon className="h-5 w-5 text-[#c9b37d]" />
                <h3 className="mt-4 font-serif text-xl text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{item.copy}</p>
              </motion.div>
            );
          })}
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at top, rgba(201,179,125,0.15), transparent 70%)",
            }}
          />
          <motion.blockquote
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative font-serif text-2xl text-white md:text-3xl"
          >
            "The body remembers what the mind forgets."
          </motion.blockquote>
        </section>
      </main>
    </div>
  );
}
