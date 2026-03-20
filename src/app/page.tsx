"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Check, Circle, LogIn, Lock, Mail } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

type Note = {
  id: string;
  content: string;
  created_at: string;
  deleting?: boolean;
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

  useEffect(() => {
    // 1. Zkontrolujeme, jestli existuje klíč na DB, pokud ne, povolíme přístup jako DEMO
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
      setSession({} as Session); // Dummy session pro localhost bez DB
      fetchNotes(true);
      return;
    }

    // 2. Skutečná autentizace Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchNotes(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchNotes(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
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
  }, [session]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setAuthError("Špatné přihlašovací údaje.");
    }
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
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Chyba:", error.message);
      } else {
        setNotes(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
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
      .insert([{ content: contentToAdd }])
      .select();

    if (!error && data) {
      setNotes((prev) => [data[0], ...prev]);
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

  // --- LOGIN OBRAZOVKA ---
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
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-700"
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
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-700"
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

  // --- HLAVNÍ APLIKACE ---
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/70 via-white/40 to-transparent pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-[10%] right-[-5%] w-[30%] h-[30%] bg-sky-200/20 blur-[80px] rounded-full pointer-events-none" />

      <div className="max-w-xl mx-auto p-5 md:p-8 pt-12 md:pt-20 relative z-10 w-full flex flex-col h-screen">
        
        {/* Hlavička s odhlášením (elegantní a tichá) */}
        {!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder") && (
          <div className="flex justify-end mb-6">
             <button onClick={handleLogout} className="text-xs font-medium text-slate-400 hover:text-slate-600 uppercase tracking-wider transition-colors">Uzamknout</button>
          </div>
        )}

        {/* Vstupní pole */}
        <form onSubmit={addNote} className="relative mb-8 group shrink-0">
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

        {/* Seznam */}
        <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto pb-10 scrollbar-hide">
          {loading && notes.length === 0 ? (
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
                className={`group flex items-center gap-4 py-3.5 px-4 bg-white/60 backdrop-blur-md border border-white rounded-2xl hover:bg-white hover:shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2
                  ${note.deleting ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}
                `}
              >
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
