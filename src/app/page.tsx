"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2 } from "lucide-react";

type Note = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    try {
      setLoading(true);
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        // Fallback for demo without DB
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching notes:", error.message);
      } else {
        setNotes(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    if (!newTitle.trim() && !newContent.trim()) return;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const optimisticNote: Note = {
        id: Date.now().toString(),
        title: newTitle,
        content: newContent,
        created_at: new Date().toISOString(),
      };
      setNotes([optimisticNote, ...notes]);
      setIsAdding(false);
      setNewTitle("");
      setNewContent("");
      return;
    }

    const { data, error } = await supabase
      .from("notes")
      .insert([{ title: newTitle, content: newContent }])
      .select();

    if (!error && data) {
      setNotes([data[0], ...notes]);
      setIsAdding(false);
      setNewTitle("");
      setNewContent("");
    }
  }

  async function deleteNote(id: string) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setNotes(notes.filter((n) => n.id !== id));
      return;
    }
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (!error) {
      setNotes(notes.filter((n) => n.id !== id));
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-4 md:p-8 flex flex-col max-w-3xl mx-auto w-full">
      <header className="flex items-center justify-between mb-8 pt-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Záznamník</h1>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-full transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus size={24} />
        </button>
      </header>

      {isAdding && (
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl mb-6 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <input
            type="text"
            placeholder="Nadpis poznámky..."
            className="w-full bg-transparent text-lg font-semibold outline-none mb-3 text-white placeholder-neutral-500"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            placeholder="Začněte psát..."
            className="w-full bg-transparent outline-none resize-none min-h-[120px] text-neutral-300 placeholder-neutral-600"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
            >
              Zrušit
            </button>
            <button
              onClick={addNote}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20"
            >
              Uložit
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-neutral-500">
          Načítání...
        </div>
      ) : notes.length === 0 && !isAdding ? (
        <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 mt-20">
          <p className="text-lg">Zatím žádné poznámky</p>
          <p className="text-sm mt-1">Klikněte na + pro přidání</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="group bg-neutral-900 border border-neutral-800/50 hover:border-neutral-700 p-5 rounded-2xl transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-white">
                  {note.title || "Bez nadpisu"}
                </h3>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-neutral-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <p className="text-neutral-400 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
              <div className="text-xs text-neutral-600 mt-4">
                {new Date(note.created_at).toLocaleDateString("cs-CZ", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
