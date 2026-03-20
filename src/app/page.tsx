"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Check, Circle, LogIn, Lock, Mail, GripVertical } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Reorder, AnimatePresence, motion } from "framer-motion";

type Note = {
  id: string;
  content: string;
  created_at: string;
  order_index?: number;
  deleting?: boolean;
};

// Pomocná funkce na parsování #hashtagů
const extractTags = (text: string): string[] => {
  const matches = text.match(/#[\p{L}\d_-]+/gu);
  return matches ? Array.from(matches) : [];
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const CATEGORIES = useMemo(() => [
    { tag: "#osobní", colorClass: "bg-blue-50/90 border-blue-200 hover:border-blue-300", dotClass: "bg-blue-400 focus:bg-blue-500" },
    { tag: "#práce", colorClass: "bg-emerald-50/90 border-emerald-200 hover:border-emerald-300", dotClass: "bg-emerald-400 focus:bg-emerald-500" },
    { tag: "#nákup", colorClass: "bg-orange-50/90 border-orange-200 hover:border-orange-300", dotClass: "bg-orange-400 focus:bg-orange-500" },
    { tag: "#hlavní", colorClass: "bg-rose-50/90 border-rose-200 hover:border-rose-300", dotClass: "bg-rose-400 focus:bg-rose-500" },
    { tag: "#finance", colorClass: "bg-amber-50/90 border-amber-200 hover:border-amber-300", dotClass: "bg-amber-400 focus:bg-amber-500" },
    { tag: "#ostatní", colorClass: "bg-slate-100/90 border-slate-200 hover:border-slate-300", dotClass: "bg-slate-400 focus:bg-slate-500" },
  ], []);

  // Všechny unikátní tagy ze všech poznámek
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(n => extractTags(n.content).forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [notes]);

  // Filtrované poznámky pro zobrazení
  const displayedNotes = useMemo(() => {
    if (!filterTag) return notes;
    return notes.filter(n => extractTags(n.content).includes(filterTag as string));
  }, [notes, filterTag]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      setSession({} as Session);
      fetchNotes(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchNotes(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchNotes(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || isUpdatingOrder) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      return;
    }

    const channel = supabase
      .channel('realtime_notes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          fetchNotes(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, isUpdatingOrder]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("Špatné přihlašovací údaje.");
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setNotes([]);
  }

  async function fetchNotes(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
        if (showLoading) setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (!error && data) setNotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function addNote(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newContent.trim()) return;

    let contentToAdd = newContent.trim();

    if (selectedCategory && !contentToAdd.includes(selectedCategory)) {
        contentToAdd += ` ${selectedCategory}`;
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      const optimisticNote: Note = {
        id: Date.now().toString(),
        content: contentToAdd,
        created_at: new Date().toISOString(),
      };
      setNotes([optimisticNote, ...notes]);
      setNewContent("");
      setSelectedCategory(null);
      return;
    }

    setNewContent("");
    setSelectedCategory(null);
    
    // Nové položky dáme systematicky na začátek seznamu posunutím order_indexu
    const minOrder = notes.length > 0 ? Math.min(...notes.map(n => n.order_index ?? 0)) : 0;
    const newOrderIndex = minOrder - 1000;

    const { data, error } = await supabase
      .from("notes")
      .insert([{ content: contentToAdd, order_index: newOrderIndex }])
      .select();

    if (!error && data) {
      setNotes((prev) => [data[0], ...prev].sort((a,b) => (a.order_index??0) - (b.order_index??0)));
    }
  }

  async function completeTask(id: string) {
    setNotes((prev) => prev.map(n => n.id === id ? { ...n, deleting: true } : n));
    setTimeout(async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        return;
      }
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (!error) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    }, 400);
  }

  async function handleReorderItems(newOrder: Note[]) {
    // 1. Změníme UI okamžitě
    setNotes(newOrder);
    setIsUpdatingOrder(true);
    
    // 2. Pošleme nový pořadní index (1, 2, 3...) do databáze (zpožděně/na pozadí)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      const updates = newOrder.map((note, index) => ({
        id: note.id,
        order_index: index * 100 // indexování po 100 pro lepší plynulost
      }));
      
      // Updatovat každý řádek (pro jednoduchost iterací)
      for (const update of updates) {
        await supabase.from("notes").update({ order_index: update.order_index }).eq("id", update.id);
      }
    }
    
    setIsUpdatingOrder(false);
  }

  // Získání barvy podle tagu
  const getTagColor = (tag: string | null) => {
    if (!tag) return "bg-white border-slate-100 hover:border-white";
    
    const matchedCategory = CATEGORIES.find(c => c.tag === tag);
    if (matchedCategory) return matchedCategory.colorClass;

    // Paleta pastelových barev pro poznámky
    const colors = [
      "bg-red-50/90 border-red-200 hover:border-red-300",
      "bg-orange-50/90 border-orange-200 hover:border-orange-300",
      "bg-amber-50/90 border-amber-200 hover:border-amber-300",
      "bg-emerald-50/90 border-emerald-200 hover:border-emerald-300",
      "bg-cyan-50/90 border-cyan-200 hover:border-cyan-300",
      "bg-blue-50/90 border-blue-200 hover:border-blue-300",
      "bg-indigo-50/90 border-indigo-200 hover:border-indigo-300",
      "bg-violet-50/90 border-violet-200 hover:border-violet-300",
      "bg-fuchsia-50/90 border-fuchsia-200 hover:border-fuchsia-300",
      "bg-rose-50/90 border-rose-200 hover:border-rose-300",
    ];
    
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/70 via-white/40 to-transparent pointer-events-none" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/20 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="bg-white/70 backdrop-blur-xl border border-white p-8 rounded-3xl shadow-sm w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-100 to-sky-50 rounded-2xl flex items-center justify-center border border-white shadow-sm">
              <Lock size={28} className="text-slate-700" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Váš Záznamník</h1>
          <p className="text-slate-500 text-center text-sm mb-8 leading-relaxed">Přihlaste se pouze svými údaji pro zabezpečený přístup.</p>
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {authError && <div className="p-3 bg-red-50 text-red-500 rounded-xl text-sm font-medium border border-red-100">{authError}</div>}
            
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                placeholder="E-mail"
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-[3px] focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-700"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                placeholder="Heslo"
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-[3px] focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="mt-2 w-full bg-slate-900 text-white font-medium py-3 rounded-xl disabled:opacity-50 hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {authLoading ? "Ověřování..." : <> Vstoupit <LogIn size={18} /> </>}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 relative overflow-hidden flex flex-col items-center">
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/70 via-white/40 to-transparent pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-2xl mx-auto p-4 md:p-8 pt-8 md:pt-14 relative z-10 w-full flex flex-col h-screen">
        
        {!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") && (
          <div className="flex justify-end mb-4 shrink-0">
             <button onClick={handleLogout} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-colors bg-white/50 px-3 py-1.5 rounded-full border border-slate-200/60 shadow-sm backdrop-blur-md">Uzamknout</button>
          </div>
        )}

        {/* Filtr Štítků */}
        <div className="shrink-0 mb-6">
          <AnimatePresence>
            {allTags.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide my-1"
              >
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(t => t === tag ? null : tag)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold font-mono tracking-wide transition-all duration-200 border shadow-sm ${
                      filterTag === tag 
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/20' 
                        : 'bg-white text-slate-500 border-slate-200/80 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {tag.replace('#', '')}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Vstupní pole */}
        <form onSubmit={addNote} className="relative mb-8 group shrink-0">
          <input
            type="text"
            placeholder="Přidejte úkol..."
            className="w-full text-lg pr-14 pl-6 py-4 rounded-t-3xl rounded-b-xl bg-white/80 backdrop-blur-xl border border-white/90 outline-none focus:ring-[3px] focus:ring-indigo-500/20 focus:border-indigo-300 transition-all shadow-sm hover:shadow-md placeholder:text-slate-400 text-slate-800 font-medium"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newContent.trim()}
            className="absolute right-2 top-2 bottom-12 w-12 h-11 flex items-center justify-center bg-slate-900 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-0 disabled:-translate-x-3 transition-all duration-300 z-10"
            aria-label="Uložit"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>

          {/* Výběr barvy - Kuličky */}
          <div className="flex items-center gap-3 px-6 pt-2 pb-1 bg-white/40 backdrop-blur-md rounded-b-3xl border-x border-b border-white/90 shadow-sm mt-[1px]">
            <span className="text-[11px] text-slate-400 font-semibold tracking-wider uppercase mr-1">Téma:</span>
            {CATEGORIES.map(c => (
              <button
                key={c.tag}
                type="button"
                onClick={() => setSelectedCategory(c.tag === selectedCategory ? null : c.tag)}
                className={`w-5 h-5 rounded-full transition-all duration-200 outline-none ${c.dotClass} ${
                  selectedCategory === c.tag 
                    ? 'ring-2 ring-offset-2 ring-slate-800 scale-110 shadow-md' 
                    : 'hover:scale-110 opacity-70 hover:opacity-100 hover:shadow-sm'
                }`}
                aria-label={c.tag.replace('#', '')}
                title={c.tag.replace('#', '')}
              />
            ))}
          </div>
        </form>

        {/* Drag & Drop Reorder Líst */}
        <div className="flex-1 overflow-y-auto pb-10 scrollbar-hide -mx-2 px-2">
          {loading && notes.length === 0 ? (
            <div className="text-center text-slate-400 mt-12 animate-pulse font-medium">Načítání úkolů...</div>
          ) : notes.length === 0 ? (
            <div className="text-center mt-20 text-slate-400/80">
              <p className="text-lg font-medium">Nic tu není.</p>
              <p className="text-sm mt-1">Užívejte si čistou mysl.</p>
            </div>
          ) : filterTag && displayedNotes.length === 0 ? (
           <div className="text-center mt-12 text-slate-400">
              <p>Žádné úkoly pro tento štítek.</p>
            </div>
          ) : (
            <Reorder.Group 
              axis="y" 
              values={filterTag ? displayedNotes : notes} 
              onReorder={filterTag ? () => {} : handleReorderItems} 
              className="flex flex-col gap-3"
            >
              <AnimatePresence>
                {displayedNotes.map((note) => {
                  const primaryTag = extractTags(note.content)[0] || null;
                  const colorClass = getTagColor(primaryTag);
                  const cleanContent = note.content.replace(/#[\p{L}\d_-]+/gu, '').replace(/\s+/g, ' ').trim() || (primaryTag ? `[${primaryTag.replace('#', '')}]` : '');

                  return (
                  <Reorder.Item
                    key={note.id}
                    value={note}
                    id={note.id}
                    dragListener={!filterTag} // Zákaz tažení pokud je aktivní filtr
                    className={`group relative flex items-center gap-3 py-3 px-4 md:px-5 backdrop-blur-md rounded-2xl hover:shadow-md transition-shadow cursor-default border
                      ${colorClass}
                      ${note.deleting ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}
                    `}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, height: 0, margin: 0, padding: 0 }}
                    whileDrag={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)", zIndex: 50, cursor: 'grabbing' }}
                  >
                    
                    {/* Drag Handle (Grip) */}
                    {!filterTag && (
                      <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 -ml-2 p-1 touch-none">
                        <GripVertical size={18} />
                      </div>
                    )}

                    <button
                      onClick={() => completeTask(note.id)}
                      className="flex-shrink-0 text-slate-400 hover:text-indigo-500 hover:scale-110 active:scale-90 transition-all focus:outline-none bg-white/50 hover:bg-white rounded-full p-[2px]"
                    >
                      {note.deleting ? (
                        <Check size={26} className="text-indigo-500 animate-in zoom-in" strokeWidth={3} />
                      ) : (
                        <Circle size={26} strokeWidth={2.5} />
                      )}
                    </button>

                    <div className="flex-1 overflow-hidden">
                      <p 
                        className={`text-slate-800 whitespace-pre-wrap leading-relaxed text-[16px] transition-all duration-300 ease-out font-medium
                          ${note.deleting ? "text-slate-400 line-through decoration-slate-400 decoration-2" : ""}
                        `}
                      >
                        {cleanContent}
                      </p>
                    </div>
                  </Reorder.Item>
                )})}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </div>

      </div>
    </main>
  );
}
