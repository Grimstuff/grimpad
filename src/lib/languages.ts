/** Map file extension → Monaco language id (VS Code-compatible ids). */
const EXTENSION_MAP: Record<string, string> = {
  txt: "plaintext",
  text: "plaintext",
  log: "plaintext",
  rtf: "plaintext",
  md: "markdown",
  markdown: "markdown",
  mdown: "markdown",
  mdx: "markdown",
  json: "json",
  jsonc: "json",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  html: "html",
  htm: "html",
  xhtml: "html",
  css: "css",
  scss: "scss",
  less: "less",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  py: "python",
  pyw: "python",
  pyi: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  cs: "csharp",
  fs: "fsharp",
  fsx: "fsharp",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  hxx: "cpp",
  m: "objective-c",
  mm: "objective-c",
  rb: "ruby",
  php: "php",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  psm1: "powershell",
  bat: "bat",
  cmd: "bat",
  sql: "sql",
  r: "r",
  lua: "lua",
  gd: "plaintext", // Godot GDScript — plain until grammar added
  gdscript: "plaintext",
  swift: "swift",
  dart: "dart",
  vue: "html",
  svelte: "html",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "dockerfile",
  makefile: "makefile",
  mk: "makefile",
  cmake: "cmake",
  diff: "diff",
  patch: "diff",
};

export function languageFromPath(path: string | null | undefined): string {
  if (!path) return "plaintext";
  const base = path.split(/[/\\]/).pop() ?? path;
  const lower = base.toLowerCase();

  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) {
    return "dockerfile";
  }
  if (lower === "makefile" || lower === "gnumakefile") {
    return "makefile";
  }
  if (lower === "cmakelists.txt") {
    return "cmake";
  }

  const dot = lower.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  const ext = lower.slice(dot + 1);
  return EXTENSION_MAP[ext] ?? "plaintext";
}

export function titleFromPath(path: string | null | undefined, fallback = "Untitled"): string {
  if (!path) return fallback;
  return path.split(/[/\\]/).pop() || fallback;
}

/** Common Monaco language ids for the status-bar picker (display order). */
export const SELECTABLE_LANGUAGES: { id: string; label: string }[] = [
  { id: "plaintext", label: "Plain Text" },
  { id: "markdown", label: "Markdown" },
  // RTF uses plain editing; kept as option for clarity when opening .rtf
  // (Monaco highlights as plain text via extension map)
  { id: "json", label: "JSON" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "scss", label: "SCSS" },
  { id: "less", label: "Less" },
  { id: "xml", label: "XML" },
  { id: "yaml", label: "YAML" },
  { id: "ini", label: "INI / TOML-like" },
  { id: "python", label: "Python" },
  { id: "rust", label: "Rust" },
  { id: "go", label: "Go" },
  { id: "java", label: "Java" },
  { id: "kotlin", label: "Kotlin" },
  { id: "csharp", label: "C#" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "ruby", label: "Ruby" },
  { id: "php", label: "PHP" },
  { id: "shell", label: "Shell" },
  { id: "powershell", label: "PowerShell" },
  { id: "bat", label: "Batch" },
  { id: "sql", label: "SQL" },
  { id: "lua", label: "Lua" },
  { id: "r", label: "R" },
  { id: "swift", label: "Swift" },
  { id: "dart", label: "Dart" },
  { id: "graphql", label: "GraphQL" },
  { id: "dockerfile", label: "Dockerfile" },
  { id: "makefile", label: "Makefile" },
  { id: "cmake", label: "CMake" },
  { id: "diff", label: "Diff" },
];

const LABEL_BY_ID = new Map(SELECTABLE_LANGUAGES.map((l) => [l.id, l.label]));

export function languageLabel(id: string | null | undefined): string {
  if (!id) return "Plain Text";
  return LABEL_BY_ID.get(id) ?? id;
}

/**
 * Document / note modes — no line numbers (basic notepad).
 * Everything else is treated as code.
 */
const NOTEPAD_LANGUAGES = new Set([
  "plaintext",
  "markdown",
  // Monaco has no dedicated RTF grammar; we map .rtf → plaintext
  "rtf",
  // common “notes” style ids if registered later
  "restructuredtext",
  "latex",
  "tex",
]);

export function isCodeLanguage(id: string | null | undefined): boolean {
  if (!id) return false;
  return !NOTEPAD_LANGUAGES.has(id);
}

/** Markdown and close relatives that support Formatted / Raw view. */
const MARKDOWN_LIKE = new Set(["markdown", "mdx", "gfm"]);

export function isMarkdownLike(id: string | null | undefined): boolean {
  if (!id) return false;
  return MARKDOWN_LIKE.has(id);
}

export type DocViewMode = "source" | "formatted";

/** Monaco registers many Freemarker2 dialect ids (tag-angle / interpolation-…). */
function isHiddenPickerLanguage(id: string): boolean {
  return id.toLowerCase().startsWith("freemarker2.");
}

/** Full picker list: curated first, then any extra Monaco-registered ids. */
export function languagesForPicker(registeredIds?: string[]): { id: string; label: string }[] {
  const curated = SELECTABLE_LANGUAGES;
  if (!registeredIds?.length) return curated;

  const known = new Set(curated.map((l) => l.id));
  const extras = registeredIds
    .filter((id) => id && !known.has(id) && !isHiddenPickerLanguage(id))
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, label: id }));

  return extras.length ? [...curated, ...extras] : curated;
}

/** Compact dialog filters — a few popular types, not every extension. */
export const FILE_FILTERS = [
  { name: "Text", extensions: ["txt"] },
  { name: "Markdown", extensions: ["md"] },
  { name: "JSON", extensions: ["json"] },
  {
    name: "Code",
    extensions: ["js", "ts", "tsx", "jsx", "css", "html", "py", "rs", "cs", "cpp", "c", "go", "java"],
  },
  { name: "All files", extensions: ["*"] },
];

/** Default save extension from Monaco language id. */
export function defaultExtensionForLanguage(language: string | null | undefined): string {
  switch (language) {
    case "markdown":
      return "md";
    case "json":
      return "json";
    case "javascript":
      return "js";
    case "typescript":
      return "ts";
    case "html":
      return "html";
    case "css":
    case "scss":
    case "less":
      return "css";
    case "python":
      return "py";
    case "rust":
      return "rs";
    case "csharp":
      return "cs";
    case "cpp":
      return "cpp";
    case "c":
      return "c";
    case "go":
      return "go";
    case "java":
      return "java";
    case "yaml":
      return "yml";
    case "xml":
      return "xml";
    case "shell":
      return "sh";
    case "powershell":
      return "ps1";
    case "sql":
      return "sql";
    case "lua":
      return "lua";
    default:
      return "txt";
  }
}

/**
 * Build a safe default filename from the first line of content.
 * Strips path-invalid characters and trims length.
 */
export function suggestedFilenameFromContent(
  content: string,
  language?: string | null,
  fallback = "Untitled",
): string {
  const firstLine = (content.split(/\r?\n/, 1)[0] ?? "").trim();
  let base = firstLine || fallback;

  // Drop markdown heading markers / list noise for nicer names
  base = base.replace(/^#{1,6}\s+/, "").replace(/^[-*+]\s+/, "").trim() || fallback;

  // Windows-illegal filename characters + control chars
  base = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();

  // Avoid trailing dots/spaces (Windows)
  base = base.replace(/[.\s]+$/g, "");

  if (!base) base = fallback;
  if (base.length > 64) base = base.slice(0, 64).trim();

  // If user already typed an extension on the first line, keep it
  if (/\.[a-z0-9]{1,8}$/i.test(base)) return base;

  const ext = defaultExtensionForLanguage(language);
  return `${base}.${ext}`;
}
