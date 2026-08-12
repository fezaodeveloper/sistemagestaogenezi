import { Extension } from "@tiptap/core";
import "@tiptap/extension-text-style";

// @tiptap/extension-font-size não existe como pacote oficial — esse é o
// padrão documentado pelo próprio Tiptap pra adicionar tamanho de fonte:
// uma extensão pequena que estende os atributos do mark "textStyle" (que
// negrito/sublinhado não usam, mas cor/fonte sim).
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (tamanho: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return { types: ["textStyle"] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (tamanho: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: tamanho }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).run(),
    };
  },
});
