"use client";

import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Hardcoded de propósito (TAREFA 2D) — sem biblioteca externa de emoji.
const EMOJI_CATEGORIAS: Record<string, string[]> = {
  "😀 Rostos": [
    "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊",
    "😋", "😎", "😍", "😘", "🥰", "😗", "😙", "😚", "🙂", "🤗",
    "🤔", "😐", "😑", "😶", "🙄", "😏", "😣", "😥", "😮", "🤐",
    "😴", "🥱", "😢", "😭", "😡", "😱", "🥳", "😇", "🤩", "🤯",
  ],
  "❤️ Símbolos": [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
    "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "✨",
    "⭐", "🌟", "💫", "🔥", "💯", "✅", "❌", "⚠️", "❗", "❓",
    "💡", "🔔", "📌", "📍", "🎉", "🎊", "🎁", "🏆", "🥇", "👏",
  ],
  "👍 Gestos": [
    "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👊", "✊", "🤝",
    "🙏", "👋", "🤚", "✋", "🖐️", "🙌", "👐", "🤲", "💪", "🫡",
    "👉", "👈", "👆", "👇", "☝️", "✍️", "🤙", "🫰", "🤌", "👀",
  ],
  "🎓 Educação": [
    "🎓", "📚", "📖", "✏️", "🖊️", "📝", "📒", "📓", "📔", "📕",
    "📗", "📘", "📙", "🔬", "🔭", "🧮", "🖥️", "💻", "🏫", "🎒",
    "📐", "📏", "🧠", "💡", "🗂️", "📅", "🥇", "🎯", "🧑‍🏫", "🧑‍🎓",
  ],
};

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="icon" aria-label="Inserir emoji">
            <Smile />
          </Button>
        }
      />
      <PopoverContent className="w-72 p-3" side="top" align="start">
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {Object.entries(EMOJI_CATEGORIAS).map(([categoria, emojis]) => (
            <div key={categoria} className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">{categoria}</span>
              <div className="grid grid-cols-8 gap-0.5">
                {emojis.map((emoji, indice) => (
                  <button
                    key={`${categoria}-${indice}`}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                    className="hover:bg-muted rounded p-1 text-lg leading-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
