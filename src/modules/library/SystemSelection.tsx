import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, X, Play, Info, Video, Fingerprint } from 'lucide-react';
import { systems } from '../../shared/data/systems';
import { ImageWithFallback } from '../../shared/components/figma/ImageWithFallback';

export function SystemSelection() {
  const [selectedSystem, setSelectedSystem] = useState<typeof systems[0] | null>(null);
  const navigate = useNavigate();
  
  // Ref for the auto-scrolling container
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInteracting = useRef(false);

  // Duplicated array to create a seamless infinite loop illusion
  const duplicatedSystems = [...systems, ...systems, ...systems];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animationId: number;
    const scrollSpeed = 0.8; // px per frame

    const animateScroll = () => {
      // Only auto-scroll if the user isn't interacting (hovering or touching)
      if (!isInteracting.current && el) {
        el.scrollLeft += scrollSpeed;
        
        // Seamless loop logic: if scrolled past 1/3 of total width (which is one full original set)
        // quietly reset back to start to keep the infinite loop.
        // The container holds 3 sets, so resetting at 1 set keeps things smooth.
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col overflow-hidden relative selection:bg-emerald-400/30">
      
      {/* Background Ambience (Game UI feel: Grid + Glow) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 pt-10 pb-6 px-6 sm:px-10 shrink-0 border-b border-zinc-800/50 bg-zinc-950/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <Link
                to="/"
                className="text-lg font-black uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Somatic Building
              </Link>
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Library Systems
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
              Choose Your<br />
              <span className="text-emerald-400 filter drop-shadow-[0_0_15px_rgba(163,230,53,0.4)]">Discipline</span>
            </h1>
          </div>
          <p className="text-zinc-400 font-medium tracking-wide text-sm max-w-xs border-l-2 border-zinc-800 pl-4 py-1">
            Select a combat/training module to unlock its core movements and masters gallery.
          </p>
        </div>
      </header>

      {/* Main Carousel Area (Auto-scrolling) */}
      <div className="relative z-10 flex-1 flex items-center mb-10 overflow-hidden">
        {/* Left/Right Vignettes to soften edges */}
        <div className="absolute left-0 top-0 w-16 sm:w-32 h-full bg-gradient-to-r from-zinc-950 to-transparent z-20 pointer-events-none"></div>
        <div className="absolute right-0 top-0 w-16 sm:w-32 h-full bg-gradient-to-l from-zinc-950 to-transparent z-20 pointer-events-none"></div>

        <div 
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto scrollbar-hide px-[10vw] py-8 w-full cursor-grab active:cursor-grabbing snap-y"
          onMouseEnter={() => isInteracting.current = true}
          onMouseLeave={() => isInteracting.current = false}
          onTouchStart={() => isInteracting.current = true}
          onTouchEnd={() => isInteracting.current = false}
        >
          {duplicatedSystems.map((system, idx) => (
            <motion.div
              key={`${system.id}-${idx}`}
              whileHover={{ y: -15, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedSystem(system)}
              className="shrink-0 w-[280px] sm:w-[320px] h-[450px] sm:h-[500px] bg-zinc-900 relative group overflow-hidden cursor-pointer shadow-2xl shadow-black/80"
              style={{
                // Sci-fi angled corners (Clip Path)
                clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)",
                border: "1px solid rgba(163,230,53,0.1)"
              }}
            >
              {/* Animated Inner Border Glow on Hover */}
              <div className="absolute inset-0 border-[2px] border-transparent group-hover:border-emerald-400/50 transition-colors duration-500 z-20 pointer-events-none" style={{ clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)" }}></div>
              
              <ImageWithFallback 
                src={system.imageUrl} 
                alt={system.name} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-80 group-hover:opacity-100"
              />
              
              {/* Scanline overlay for Game UI feel */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSJ0cmFuc3BhcmVudCI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwTDIgMloiIHN0cm9rZT0icmdiYSgwLDAsMCwwLjUpIiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')] opacity-30 z-10 mix-blend-overlay pointer-events-none"></div>

              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent z-10"></div>
              
              {/* HUD Elements */}
              <div className="absolute top-4 right-4 z-20 px-2 py-1 bg-black/60 backdrop-blur-sm border border-zinc-700/50 text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                LVL. {Math.floor(Math.random() * 50) + 10}
              </div>

              {/* Card Content */}
              <div className="absolute bottom-0 left-0 w-full p-6 flex flex-col gap-2 z-20">
                <div className="w-10 h-10 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center mb-2 border border-zinc-700 group-hover:bg-emerald-400 group-hover:text-zinc-950 group-hover:border-emerald-400 transition-all duration-300" style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}>
                  <Play className="w-5 h-5 ml-0.5" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{system.name}</h2>
                <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{system.shortDesc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal / Bottom Sheet for Selection Details */}
      <AnimatePresence>
        {selectedSystem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-6"
          >
            {/* Modal Backdrop click to close */}
            <div className="absolute inset-0" onClick={() => setSelectedSystem(null)}></div>

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-3xl bg-zinc-950 border-t sm:border border-zinc-800 sm:rounded-2xl rounded-t-3xl shadow-[0_0_80px_rgba(0,0,0,0.9)] max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Decorative Header Bar */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-zinc-800 via-emerald-400 to-zinc-800 z-30"></div>

              {/* Close Button (HUD Style) */}
              <button 
                onClick={() => setSelectedSystem(null)}
                className="absolute top-4 right-4 z-30 w-10 h-10 bg-black/60 backdrop-blur-md border border-zinc-700 flex items-center justify-center text-white hover:bg-zinc-800 hover:border-white transition-colors"
                style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Hero Image */}
              <div className="w-full h-56 sm:h-64 relative shrink-0 bg-zinc-900 border-b border-zinc-800">
                <ImageWithFallback 
                  src={selectedSystem.imageUrl} 
                  alt={selectedSystem.name} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] uppercase tracking-widest mb-2">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    Module Selected
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white drop-shadow-lg">{selectedSystem.name}</h2>
                </div>
              </div>

              {/* Content Area - Scrollable (Added generous pb-40 to prevent button overlap) */}
              <div className="p-6 sm:p-8 overflow-y-auto pb-40 flex-1 scrollbar-hide relative">
                <div className="flex flex-col gap-8 max-w-2xl mx-auto">
                  
                  {/* Overview Block */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 border-b border-zinc-800 pb-2">
                      <Info className="w-4 h-4 text-zinc-400" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Database Entry</h3>
                    </div>
                    <p className="text-zinc-200 text-sm sm:text-base leading-relaxed font-medium">
                      {selectedSystem.longDesc}
                    </p>
                  </div>

                  {/* Culture Block */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400 group-hover:w-2 transition-all duration-300"></div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 ml-2">Philosophy & Culture</h3>
                    <p className="text-zinc-300 text-sm leading-relaxed italic ml-2">
                      "{selectedSystem.culture}"
                    </p>
                  </div>

                  {/* Gallery: Representative Figures / Videos */}
                  <div>
                    <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
                      <Video className="w-4 h-4 text-zinc-400" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Masters & Demonstrations</h3>
                    </div>
                    
                    <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 snap-x">
                      {selectedSystem.gallery.map((media) => (
                        <div 
                          key={media.id} 
                          className="w-36 h-48 sm:w-40 sm:h-56 shrink-0 relative bg-zinc-900 border border-zinc-800 overflow-hidden snap-start group cursor-pointer"
                          style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                        >
                          <ImageWithFallback src={media.url} alt={media.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                          
                          {/* Play icon for videos */}
                          {media.type === 'video' && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur border border-white/20 flex items-center justify-center text-white group-hover:scale-110 group-hover:text-emerald-400 group-hover:border-emerald-400 transition-all">
                              <Play className="w-4 h-4 ml-0.5 fill-current" />
                            </div>
                          )}

                          <div className="absolute bottom-3 left-3 right-3 text-xs font-bold text-white leading-tight">
                            {media.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Sticky Action Button Background Gradient Overlay */}
              <div className="absolute bottom-0 left-0 w-full p-6 pt-12 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pointer-events-none">
                <div className="max-w-2xl mx-auto pointer-events-auto">
                  <button 
                    onClick={() => navigate(`/library/${selectedSystem.id}`)}
                    className="relative w-full py-4 bg-emerald-400 text-zinc-950 font-black text-sm uppercase tracking-widest hover:bg-emerald-300 transition-all duration-300 flex items-center justify-center gap-2 group overflow-hidden shadow-[0_0_30px_rgba(163,230,53,0.3)] hover:shadow-[0_0_40px_rgba(163,230,53,0.5)]"
                    style={{ clipPath: "polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)" }}
                  >
                    {/* Inner glowing hover effect */}
                    <div className="absolute inset-0 w-full h-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></div>
                    
                    <span className="relative z-10 flex items-center gap-2">
                      Initialize Library Module
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                    </span>
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

