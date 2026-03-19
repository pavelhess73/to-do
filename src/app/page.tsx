"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Check, Circle } from "lucide-react";

type Note = {
  id: string;
  content: string;
  created_at: string;
  deleting?: boolean; // Pro animaci odškrtnutí
};

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    try {
      setLoading(true);
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Chyba při stahování:", error.message);
      } else {
        setNotes(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function addNote(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newContent.trim()) return;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      const optimisticNote: Note = {
        id: Date.now().toString(),
        content: newContent,
        created_at: new Date().toISOString(),
      };
      setNotes([optimisticNote, ...notes]);
      setNewContent("");
      return;
    }

    const contentToAdd = newContent;
    setNewContent(""); 

    const { data, error } = await supabase
      .from("notes")
      .insert([{ title: "", content: contentToAdd }])
      .select();

    if (!error && data) {
      setNotes((prev) => [data[0], ...prev]);
    }
  }

  async function completeTask(id: string) {
    // 1. Spustíme animaci přeškrtnutí
    setNotes((prev) => prev.map(n => n.id === id ? { ...n, deleting: true } : n));
    
    // 2. Počkáme 400ms na dokončení UI animace před skutečným smazáním
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 relative overflow-hidden">
      
      {/* Decentní ambientní pozadí na vrchu stránky */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/70 via-white/40 to-transparent pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-[10%] right-[-5%] w-[30%] h-[30%] bg-sky-200/20 blur-[80px] rounded-full pointer-events-none" />

      <div className="max-w-xl mx-auto p-5 md:p-8 pt-16 md:pt-24 relative z-10 w-full">
        
        {/* Vstupní pole - Glassmorphism efekt */}
        <form onSubmit={addNote} className="relative mb-8 group">
          <input
            type="text"
            placeholder="Co je potřeba udělat?"
            className="w-full text-lg pr-14 pl-6 py-5 rounded-3xl bg-white/70 backdrop-blur-xl border border-white/80 outline-none focus:ring-[3px] focus:ring-indigo-500/20 focus:border-indigo-300 transition-all shadow-sm hover:shadow-md placeholder:text-slate-400 text-slate-700"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <button
            type="submit"
            disabled={!newContent.trim()}
            className="absolute right-2.5 top-2.5 bottom-2.5 w-12 flex items-center justify-center bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 disabled:opacity-0 disabled:-translate-x-4 transition-all duration-300"
            aria-label="Uložit"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </form>

        {/* Seznam ala Premium To-Do */}
        <div className="flex flex-col gap-2.5">
          {loading ? (
            <div className="text-center text-slate-400 mt-12 animate-pulse font-medium">Načítání...</div>
          ) : notes.length === 0 ? (
            <div className="text-center mt-24 text-slate-400">
              <p className="text-lg">Vše splněno.</p>
              <p className="text-sm mt-1 opacity-70">Užívejte si čistou hlavu.</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className={`group flex items-center gap-4 py-3.5 px-4 bg-white/60 backdrop-blur-md border border-white rounded-2xl hover:bg-white hover:shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2
                  ${note.deleting ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}
                `}
              >
                {/* Přepínač (Checkbox) pro dokoncení */}
                <button
                  onClick={() => completeTask(note.id)}
                  className="flex-shrink-0 text-slate-300 hover:text-indigo-500 hover:scale-110 active:scale-90 transition-all focus:outline-none"
                  aria-label="Dokončit úkol"
                >
                  {note.deleting ? (
                    <Check size={26} className="text-indigo-500 animate-in zoom-in" strokeWidth={3} />
                  ) : (
                    <Circle size={26} strokeWidth={2} />
                  )}
                </button>

                {/* Obsah úkolu */}
                <div className="flex-1 overflow-hidden">
                  <p 
                    className={`text-slate-700 whitespace-pre-wrap leading-relaxed text-[16px] transition-all duration-300 ease-out font-medium
                      ${note.deleting ? "text-slate-300 line-through decoration-slate-300 decoration-2" : ""}
                    `}
                  >
                    {note.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </main>
  );
}
