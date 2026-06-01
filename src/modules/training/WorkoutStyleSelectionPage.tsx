import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { ArrowRight, ChevronRight, Play } from "lucide-react";
import { ImageWithFallback } from "../../shared/components/figma/ImageWithFallback";

const styleBlocks = [
  {
    style: "Strength & Conditioning",
    blocks: ["Warmup", "Activation", "Power", "Strength", "Accessory", "Conditioning", "Cooldown"],
    imageUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
    accent: "from-emerald-400/70 to-emerald-600/30"
  },
  {
    style: "Bodybuilding",
    blocks: ["Warmup", "Compound", "Secondary", "Isolation", "Pump", "Cooldown"],
    imageUrl:
      "https://images.unsplash.com/photo-1517838277536-f5f99be5018a?auto=format&fit=crop&w=1200&q=80",
    accent: "from-amber-400/70 to-orange-600/30"
  },
  {
    style: "CrossFit",
    blocks: ["Warmup", "Skill", "Strength", "WOD", "Cooldown"],
    imageUrl:
      "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=1200&q=80",
    accent: "from-sky-400/70 to-blue-600/30"
  },
  {
    style: "Functional",
    blocks: ["Warmup", "Movement Prep", "Strength", "Circuit", "Finisher", "Cooldown"],
    imageUrl:
      "https://images.unsplash.com/photo-1517964603305-11c0f6f66012?auto=format&fit=crop&w=1200&q=80",
    accent: "from-lime-400/70 to-emerald-600/30"
  },
  {
    style: "Mobility / Yoga",
    blocks: ["Breathing", "Mobility", "Flow", "Stretch", "Relax"],
    imageUrl:
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
    accent: "from-violet-400/70 to-fuchsia-600/30"
  },
  {
    style: "Athletic",
    blocks: ["Warmup", "Speed", "Agility", "Power", "Strength", "Conditioning", "Cooldown"],
    imageUrl:
      "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80",
    accent: "from-cyan-400/70 to-sky-600/30"
  },
  {
    style: "Rehab",
    blocks: ["Assessment", "Activation", "Corrective", "Strength", "Mobility"],
    imageUrl:
      "https://images.unsplash.com/photo-1526758097130-bab247274f58?auto=format&fit=crop&w=1200&q=80",
    accent: "from-rose-400/70 to-red-600/30"
  }
];

export function WorkoutStyleSelectionPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(styleBlocks[0].style);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInteracting = useRef(false);
  const duplicatedStyles = [...styleBlocks, ...styleBlocks, ...styleBlocks];

  const handleSelect = (style: string, blocks: string[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "workoutStyleSelection",
      JSON.stringify({ style, blocks })
    );
    navigate("/workout-builder");
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let animationId: number;
    const scrollSpeed = 0.6;
    const animateScroll = () => {
      if (!isInteracting.current && el) {
        el.scrollLeft += scrollSpeed;
        if (el.scrollLeft >= el.scrollWidth / 3) {
          el.scrollLeft -= el.scrollWidth / 3;
        }
      }
      animationId = requestAnimationFrame(animateScroll);
    };
    animationId = requestAnimationFrame(animateScroll);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(34,197,94,0.18),_transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute right-[-120px] top-[20%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,_rgba(56,189,248,0.16),_transparent_70%)] blur-3xl" />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
          <header className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Link
                to="/"
                className="text-lg font-black uppercase tracking-[0.2em] text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                Somatic Building
              </Link>
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Training Style
              </span>
            </div>
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Physical OS</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              Choose Training Style
            </h1>
            <p className="text-sm text-zinc-400">
              Pick a style to load its default block structure.
            </p>
          </header>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#07090d] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#07090d] to-transparent" />
            <div
              ref={scrollRef}
              className="flex gap-6 overflow-x-auto pb-6 pt-2 scrollbar-hide"
              onMouseEnter={() => (isInteracting.current = true)}
              onMouseLeave={() => (isInteracting.current = false)}
              onTouchStart={() => (isInteracting.current = true)}
              onTouchEnd={() => (isInteracting.current = false)}
            >
              {duplicatedStyles.map((item, idx) => (
                <motion.button
                  key={`${item.style}-${idx}`}
                  whileHover={{ y: -10, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelected(item.style)}
                  className={`relative h-[460px] w-[300px] flex-shrink-0 overflow-hidden rounded-3xl border transition ${
                    selected === item.style
                      ? "border-emerald-400/70 shadow-[0_25px_60px_rgba(16,185,129,0.25)]"
                      : "border-white/10"
                  }`}
                >
                  <ImageWithFallback
                    src={item.imageUrl}
                    alt={item.style}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${item.accent}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                  <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200">
                    <Play className="h-3 w-3" />
                    Style
                  </div>

                  <div className="absolute bottom-6 left-6 right-6 text-left">
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-semibold text-white">{item.style}</p>
                      <Badge className="bg-black/40 text-emerald-100">
                        {item.blocks.length} blocks
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-zinc-300">Default training flow</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-200">
                      {item.blocks.map((block, index) => (
                        <React.Fragment key={`${item.style}-${block}`}>
                          <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1">
                            {block}
                          </span>
                          {index < item.blocks.length - 1 && (
                            <ArrowRight className="h-3 w-3 text-zinc-500" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-zinc-400">
              Selected style: <span className="text-white">{selected}</span>
            </div>
            <Button
              className="rounded-2xl bg-emerald-400 text-black hover:bg-emerald-300"
              onClick={() => {
                const picked = styleBlocks.find((item) => item.style === selected) ?? styleBlocks[0];
                handleSelect(picked.style, picked.blocks);
              }}
            >
              Continue to Builder
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
