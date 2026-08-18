import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  frontmatterPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { useTabsStore } from "../store/tabsStore";
import { useSettingsStore } from "../store/settingsStore";
import { getCachedWheelScroll, wheelNotches } from "../lib/wheelScroll";

interface Props {
  tabId: string;
}

/**
 * Live formatted markdown (Obsidian / Discord style) backed by the tab's Monaco model text.
 */
export function MarkdownFormattedEditor({ tabId }: Props) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const resolvedTheme = useSettingsStore((s) => s.resolvedTheme);

  const initialMarkdown = useMemo(() => {
    return useTabsStore.getState().getModel(tabId)?.getValue() ?? "";
  }, [tabId]);

  // After engine swap (auto-detect → Formatted), keep caret so typing doesn't die
  useEffect(() => {
    let cancelled = false;
    const tryFocus = (attempt: number) => {
      if (cancelled) return;
      editorRef.current?.focus(undefined, { defaultSelection: "rootEnd" });
      const el = document.querySelector<HTMLElement>(".md-formatted-content");
      if (el && document.activeElement !== el && attempt < 8) {
        window.setTimeout(() => tryFocus(attempt + 1), 40);
      }
    };
    const t = window.setTimeout(() => tryFocus(0), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [tabId]);

  // If the underlying model changes externally (e.g. file reload), push into MDXEditor
  useEffect(() => {
    const model = useTabsStore.getState().getModel(tabId);
    if (!model) return;

    const sub = model.onDidChangeContent(() => {
      const value = model.getValue();
      if (value === lastEmitted.current) return;
      // Avoid stomping while focused if we were the source — only apply if different from editor
      const current = editorRef.current?.getMarkdown() ?? "";
      if (current !== value) {
        editorRef.current?.setMarkdown(value);
      }
    });

    return () => sub.dispose();
  }, [tabId]);

  const onChange = useCallback(
    (md: string) => {
      lastEmitted.current = md;
      const model = useTabsStore.getState().getModel(tabId);
      if (model && !model.isDisposed() && model.getValue() !== md) {
        model.setValue(md);
      }
    },
    [tabId],
  );

  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      frontmatterPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          js: "JavaScript",
          ts: "TypeScript",
          tsx: "TypeScript",
          css: "CSS",
          html: "HTML",
          json: "JSON",
          py: "Python",
          rs: "Rust",
          txt: "Plain Text",
          markdown: "Markdown",
        },
      }),
    ],
    [],
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.defaultPrevented) return;
      const notches = wheelNotches(e);
      if (notches === 0) return;
      const scroll = getCachedWheelScroll();
      const linePx = fontSize * 1.55;
      const step =
        scroll.mode === "none"
          ? 0
          : scroll.mode === "page"
            ? el.clientHeight
            : scroll.lines * linePx;
      if (step === 0) return;
      e.preventDefault();
      el.scrollTop += notches * step;
    };
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel, true);
    };
  }, [fontSize]);

  return (
    <div
      ref={hostRef}
      className={`md-formatted-host${resolvedTheme === "dark" ? " dark-editor" : ""}`}
      style={{ ["--md-font-size" as string]: `${fontSize}px` }}
    >
      <MDXEditor
        key={tabId}
        ref={editorRef}
        markdown={initialMarkdown}
        autoFocus={{ defaultSelection: "rootEnd", preventScroll: true }}
        onChange={onChange}
        plugins={plugins}
        contentEditableClassName="md-formatted-content"
        className="md-formatted-editor"
      />
    </div>
  );
}
