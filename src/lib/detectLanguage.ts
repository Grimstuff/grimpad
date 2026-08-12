/**
 * Cheap, conservative guess of language from buffer text.
 * Used only for untitled tabs until we lock a language.
 */

export interface DetectResult {
  id: string;
  /** 0–1; apply only when reasonably high. */
  score: number;
}

const MIN_CHARS = 8;
/** ATX heading like `# Title` / `## Subsection` — enough on its own. */
const ATX_HEADING = /^ {0,3}#{1,6}[ \t]+\S/;

function lineHits(text: string, re: RegExp): number {
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    if (re.test(line)) n++;
  }
  return n;
}

/**
 * Returns a guess or null if nothing is clear enough.
 * Never returns "plaintext" — caller keeps current language in that case.
 */
export function detectLanguageFromText(raw: string): DetectResult | null {
  const text = raw.replace(/^\uFEFF/, "");
  const trimmed = text.trimStart();
  const lines = text.split(/\r?\n/);
  const samples = lines.slice(0, 80).join("\n");

  const scores: Record<string, number> = {};
  const bump = (id: string, n: number) => {
    scores[id] = (scores[id] ?? 0) + n;
  };

  // Headings are short (`# Header`) — don't wait for a long buffer.
  const headingLines = lineHits(samples, ATX_HEADING);
  if (headingLines > 0) bump("markdown", 5 + Math.min(headingLines - 1, 3));

  if (trimmed.length < MIN_CHARS && headingLines === 0) return null;

  // JSON — parse is cheap and decisive
  if (/^[\[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      bump("json", 8);
    } catch {
      if (/^\{\s*"[^"]+"\s*:/.test(trimmed)) bump("json", 3);
    }
  }

  // Shebang
  if (trimmed.startsWith("#!")) {
    const first = lines[0] ?? "";
    if (/python/.test(first)) bump("python", 6);
    else if (/node|bun/.test(first)) bump("javascript", 5);
    else if (/bash|sh|zsh/.test(first)) bump("shell", 6);
    else if (/pwsh|powershell/.test(first)) bump("powershell", 6);
  }

  // Markdown (headings already scored)
  if (/^ {0,3}```/m.test(samples)) bump("markdown", 3);
  if (/^\s*[-*+]\s+\S/m.test(samples)) bump("markdown", 1.2);
  if (/\[.+\]\(.+\)/.test(samples)) bump("markdown", 2);
  if (/^\s*>\s+\S/m.test(samples)) bump("markdown", 1.5);

  // HTML / XML
  if (/<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    bump("html", 7);
  } else if (/<\/(div|span|p|body|head|script|style)>/i.test(samples)) {
    bump("html", 4);
  } else if (/^<\?xml\b/.test(trimmed) || /<\/[A-Za-z][\w:-]*>/.test(samples)) {
    bump("xml", 3);
  }

  // C / C++
  if (/^\s*#\s*include\s*[<"]/m.test(samples)) bump("c", 4);
  if (/\bint\s+main\s*\(/.test(samples)) bump("c", 3);
  if (/\b(std::|cout|cin|nullptr|template\s*<)/.test(samples)) bump("cpp", 5);
  if (/^\s*#\s*include\s*<iostream>/m.test(samples)) bump("cpp", 3);

  // Rust
  if (/\b(fn|let\s+mut|impl|pub\s+fn|use\s+[\w:]+::)/.test(samples)) bump("rust", 3);
  if (/\b(match\s+\w+\s*\{|println!\s*\()/.test(samples)) bump("rust", 3);

  // Python
  if (/^\s*(def|class|async\s+def)\s+\w+/m.test(samples)) bump("python", 4);
  if (/^\s*(import|from)\s+\w+/m.test(samples)) bump("python", 2);
  if (/if\s+__name__\s*==\s*['"]__main__['"]/.test(samples)) bump("python", 5);

  // Go
  if (/^\s*package\s+\w+/m.test(samples)) bump("go", 4);
  if (/^\s*func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/m.test(samples)) bump("go", 3);

  // C#
  if (/\b(namespace|using\s+System|Console\.Write)/.test(samples)) bump("csharp", 4);

  // Java
  if (/\b(public\s+class|System\.out\.println)/.test(samples)) bump("java", 4);

  // TypeScript vs JavaScript
  if (/\b(interface|type)\s+\w+\s*[=<{]/.test(samples) || /:\s*(string|number|boolean|unknown)\b/.test(samples)) {
    bump("typescript", 4);
  }
  if (/^\s*(export\s+)?(async\s+)?function\s+\w+/m.test(samples)) bump("javascript", 2);
  if (/^\s*(const|let|var)\s+\w+\s*=/.test(samples)) bump("javascript", 1.5);
  if (/\b(import\s+.+from\s+['"]|export\s+(default|const|function))/.test(samples)) {
    bump("javascript", 2);
  }
  if (/=>\s*[{(]/.test(samples)) bump("javascript", 1);

  // CSS
  if (lineHits(samples, /^[.#]?[\w-]+\s*\{/) >= 1 && /:\s*[^;]+;/.test(samples)) {
    bump("css", 3);
  }

  // Shell / PowerShell
  if (/^\s*(echo|export|if\s+\[\s)/m.test(samples)) bump("shell", 2);
  if (/^\s*\$\w+\s*=/.test(samples) && /\b(Write-Host|Get-\w+)/.test(samples)) {
    bump("powershell", 4);
  }

  // SQL
  if (/\b(SELECT|INSERT\s+INTO|CREATE\s+TABLE)\b/i.test(samples)) bump("sql", 3);

  // YAML
  if (/^---\s*$/m.test(samples) && /^\s*[\w-]+\s*:/m.test(samples)) bump("yaml", 3);

  let best: DetectResult | null = null;
  for (const [id, score] of Object.entries(scores)) {
    if (!best || score > best.score) best = { id, score };
  }
  if (!best) return null;

  // Prefer TS over JS if TS scored at all
  if (best.id === "javascript" && (scores.typescript ?? 0) >= 3) {
    best = { id: "typescript", score: scores.typescript! };
  }
  // Prefer cpp over c when both fire
  if (best.id === "c" && (scores.cpp ?? 0) >= 4) {
    best = { id: "cpp", score: scores.cpp! };
  }

  // Need a clear winner
  const second = Object.entries(scores)
    .filter(([id]) => id !== best!.id)
    .reduce((m, [, s]) => Math.max(m, s), 0);
  if (best.score < 3) return null;
  if (best.score < 5 && best.score - second < 1.5) return null;

  // Normalize score to 0–1-ish for lock decisions
  const confidence = Math.min(1, best.score / 8);
  return { id: best.id, score: confidence };
}

/**
 * True when it's safe to swap to the Formatted engine.
 * Avoids remounting mid-word (`# h` → `ello&#x20;`).
 */
export function readyForFormattedMarkdown(text: string): boolean {
  // Finished the heading line (Enter)
  if (/^ {0,3}#{1,6}[ \t]+\S[^\n]*\n/.test(text)) return true;
  const title = text.match(/^ {0,3}#{1,6}[ \t]+(\S[^\n]*)/)?.[1]?.trim() ?? "";
  // Idle caller already waited; need a real word, not `# h`
  if (title.length >= 4) return true;
  if (/^ {0,3}```/m.test(text)) return true;
  if (text.length >= 48) return true;
  return false;
}

/** Stop auto-detect after this much content once we have a language. */
export function shouldLockLanguage(text: string, consecutiveHits: number): boolean {
  const lines = text.split(/\r?\n/).length;
  if (consecutiveHits >= 3) return true;
  if (text.length >= 280 && lines >= 8) return true;
  if (lines >= 20) return true;
  return false;
}
