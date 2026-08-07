"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Skeleton } from "@/components/ui";
import styles from "./page.module.css";

type ExperienceMode = "standard" | "screen-reader" | "keyboard" | "protanopia" | "deuteranopia" | "tritanopia" | "monochrome";

interface Project { id: string; name: string; github_repo: string; }
interface RepositoryFile { path: string; type: string; }
interface AccessibleElement { tag: string; label: string; role: string; index: number; }

const MODES: Array<{ id: ExperienceMode; name: string; description: string; icon: string }> = [
  { id: "standard",      name: "Standard conditions",   description: "Original repository preview without simulation.", icon: "👁" },
  { id: "screen-reader", name: "Screen reader simulation", description: "Narrates accessible elements detected in the imported file.", icon: "🔊" },
  { id: "keyboard",      name: "Keyboard navigation",   description: "Highlights tab-stop order with numbered badges in preview.", icon: "⌨️" },
  { id: "protanopia",    name: "Protanopia",            description: "Red-vision-deficiency simulation applied to the preview.", icon: "🔴" },
  { id: "deuteranopia",  name: "Deuteranopia",          description: "Green-vision-deficiency simulation applied to the preview.", icon: "🟢" },
  { id: "tritanopia",    name: "Tritanopia",            description: "Blue-vision-deficiency simulation applied to the preview.", icon: "🔵" },
  { id: "monochrome",    name: "Monochrome",            description: "Removes all colour information from the preview.", icon: "⚫" },
];

const SVG_FILTERS = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0">
  <defs>
    <filter id="protanopia-filter">
      <feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0"/>
    </filter>
    <filter id="deuteranopia-filter">
      <feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0"/>
    </filter>
    <filter id="tritanopia-filter">
      <feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0"/>
    </filter>
    <filter id="monochrome-filter">
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
</svg>`;

export default function ExperienceModePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [filePath, setFilePath] = useState("");
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<ExperienceMode>("standard");
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [currentElementIndex, setCurrentElementIndex] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    void fetch("/api/projects").then(async (r) => {
      const p: unknown = await r.json();
      const data = isRecord(p) && Array.isArray(p.data) ? p.data : [];
      const imported = data.flatMap((item): Project[] => isProject(item) ? [item] : []);
      setProjects(imported);
      if (imported[0]) setProjectId(imported[0].id);
      if (!imported.length) setError("Import a GitHub repository before opening Experience Mode.");
    }).catch(() => setError("Unable to load your imported repositories."));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void fetch(`/api/projects/${projectId}/files`).then(async (r) => {
      const p: unknown = await r.json();
      const fileList = isRecord(p) && isRecord(p.data) && Array.isArray(p.data.files) ? p.data.files : [];
      // Support HTML, JSX, TSX, Vue, Svelte AND CSS files
      const uiFiles = fileList.flatMap((item): RepositoryFile[] =>
        isFile(item) && /\.(html|jsx|tsx|vue|svelte|css)$/i.test(item.path) ? [item] : []
      );
      setFiles(uiFiles);
      if (uiFiles[0]) setFilePath(uiFiles[0].path);
      else setError("This repository has no supported UI file to preview.");
    }).catch(() => setError("Unable to load repository files."));
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !filePath) return;
    void fetch(`/api/projects/${projectId}/files/content?path=${encodeURIComponent(filePath)}`).then(async (r) => {
      const p: unknown = await r.json();
      if (!r.ok || !isRecord(p) || !isRecord(p.data) || typeof p.data.content !== "string") throw new Error("Unable to load file.");
      setError(null);
      setSource(p.data.content);
      setCurrentElementIndex(0);
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load preview."));
  }, [filePath, projectId]);

  const elements = useMemo(() => extractAccessibleElements(source), [source]);
  const selectedProject = projects.find((p) => p.id === projectId);

  // Sarvam AI TTS playback function for Screen Reader Simulation
  const speakWithSarvam = async (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(true);

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tts", text: text.slice(0, 450), language: "en-IN" }),
      });
      const json = await res.json();
      if (json.data?.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${json.data.audioBase64}`);
        audio.onended = () => setSpeaking(false);
        await audio.play();
        return;
      }
    } catch {
      // Fallback to Web Speech API
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      utterance.rate = 0.9;
      utterance.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // When switching to 'screen-reader' mode or changing selected preview file, automatically analyze and narrate using Sarvam AI
  useEffect(() => {
    if (mode === "screen-reader" && source && selectedProject) {
      const buttons = (source.match(/<button\b/gi) ?? []).length;
      const links = (source.match(/<a\b/gi) ?? []).length;
      const inputs = (source.match(/<(input|select|textarea)\b/gi) ?? []).length;
      const h1Match = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const title = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : selectedProject.name;

      const analysisText = `Sarvam AI Accessibility Analysis for ${selectedProject.github_repo}, preview file ${filePath}. This webpage title is ${title}. It contains ${buttons} interactive buttons, ${links} navigation links, and ${inputs} form inputs. ${elements.length} accessible ARIA targets are detected for screen reading.`;
      
      void speakWithSarvam(analysisText);
    } else {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
  }, [mode, filePath, source, elements, selectedProject]);

  // Screen reader: speak current element via Sarvam AI
  const speakElement = (el: AccessibleElement) => {
    const text = `${el.role}: ${el.label}`;
    void speakWithSarvam(text);
  };

  const handleScreenReaderNext = () => {
    const next = (currentElementIndex + 1) % elements.length;
    setCurrentElementIndex(next);
    speakElement(elements[next]);
  };

  const handleScreenReaderPrev = () => {
    const prev = (currentElementIndex - 1 + elements.length) % elements.length;
    setCurrentElementIndex(prev);
    speakElement(elements[prev]);
  };

  const handleStartReading = () => {
    if (elements.length === 0) return;
    setCurrentElementIndex(0);
    speakElement(elements[0]);
  };

  const stopReading = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const iframeSrc = useMemo(() => source ? toPreviewDocument(source, filePath, mode) : "", [source, filePath, mode]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Imported repository preview</p>
          <h1>Accessibility Experience Mode</h1>
          <p>All simulations are limited to the selected repository preview. They never change the AccessDiff dashboard.</p>
        </div>
      </header>

      {error ? <Card className={styles.error}>{error}</Card> : null}

      <Card className={styles.controls}>
        <label>Imported repository
          <select value={projectId} onChange={(e) => { setSource(""); setFilePath(""); setProjectId(e.target.value); }}>
            <option value="">Select a repository</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.github_repo}</option>)}
          </select>
        </label>
        <label>Preview file
          <select value={filePath} onChange={(e) => setFilePath(e.target.value)} disabled={!files.length}>
            <option value="">Select a file</option>
            {files.map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}
          </select>
        </label>
      </Card>

      <section className={styles.modeGrid} aria-label="Experience modes">
        {MODES.map((item) => (
          <button key={item.id} type="button"
            className={mode === item.id ? styles.modeActive : styles.mode}
            onClick={() => setMode(item.id)}>
            <span className={styles.modeIcon}>{item.icon}</span>
            <strong>{item.name}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </section>

      <Card className={styles.previewCard}>
        <div className={styles.previewHeader}>
          <div>
            <p className={styles.eyebrow}>Live repository preview</p>
            <h2>{selectedProject?.github_repo ?? "Select an imported repository"}</h2>
            <span>{filePath || "No file selected"}</span>
          </div>
          <span className={styles.modeBadge}>{MODES.find((m) => m.id === mode)?.name}</span>
        </div>

        {source
          ? <iframe ref={iframeRef} title={`Preview of ${filePath}`} sandbox="allow-scripts"
              className={styles.preview} srcDoc={iframeSrc} />
          : <Skeleton height={420} />}
      </Card>

      {/* Screen Reader Panel */}
      {mode === "screen-reader" && source && (
        <Card className={styles.assistCard}>
          <h2>🔊 Screen Reader Simulation</h2>
          <p className={styles.srHint}>
            Navigates and narrates accessible elements using Sarvam AI voice.
            Found <strong>{elements.length}</strong> accessible elements.
          </p>

          {elements.length > 0 && (
            <>
              <div className={styles.srCurrent}>
                <span className={styles.srRole}>{elements[currentElementIndex]?.role}</span>
                <span className={styles.srLabel}>{elements[currentElementIndex]?.label}</span>
                <span className={styles.srCount}>{currentElementIndex + 1} / {elements.length}</span>
              </div>

              <div className={styles.srControls}>
                <button type="button" className={styles.srBtn} onClick={handleScreenReaderPrev}>← Previous</button>
                {speaking
                  ? <button type="button" className={`${styles.srBtn} ${styles.srBtnActive}`} onClick={stopReading}>⏸ Pause</button>
                  : <button type="button" className={`${styles.srBtn} ${styles.srBtnActive}`} onClick={handleStartReading}>▶ Speak</button>}
                <button type="button" className={styles.srBtn} onClick={handleScreenReaderNext}>Next →</button>
              </div>

              <ol className={styles.srList}>
                {elements.map((el, i) => (
                  <li key={i} className={`${styles.srItem} ${i === currentElementIndex ? styles.srItemActive : ""}`}
                    onClick={() => { setCurrentElementIndex(i); speakElement(el); }}>
                    <span className={styles.srItemRole}>{el.role}</span> {el.label}
                  </li>
                ))}
              </ol>
            </>
          )}
        </Card>
      )}

      {/* Dedicated Experience Mode Voice Assistant for Repository Preview Q&A */}
      <Card className={styles.assistCard} style={{ marginTop: "16px", border: "1px solid #3f3f46" }}>
        <h2>🎙️ Experience Voice Assistant (Repository Preview Q&A)</h2>
        <p className={styles.srHint}>
          Ask follow-up voice or text questions specifically about the live preview webpage of <strong>{selectedProject?.github_repo ?? "the selected repository"}</strong>.
        </p>

        <ExperienceVoiceQnA selectedProject={selectedProject} filePath={filePath} source={source} speakWithSarvam={speakWithSarvam} />
      </Card>

      {/* Keyboard Navigation Panel */}
      {mode === "keyboard" && source && (
        <Card className={styles.assistCard}>
          <h2>⌨️ Keyboard Tab Order</h2>
          <p className={styles.srHint}>Tab-stop order of interactive elements in the selected file.</p>
          <ol className={styles.tabList}>
            {elements.filter(e => ["button","link","input","select","textarea"].includes(e.role)).map((el, i) => (
              <li key={i} className={styles.tabItem}>
                <span className={styles.tabBadge}>#{i + 1}</span>
                <span className={styles.srItemRole}>{el.role}</span>
                {el.label}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function ExperienceVoiceQnA({ selectedProject, filePath, source, speakWithSarvam }: {
  selectedProject: any;
  filePath: string;
  source: string;
  speakWithSarvam: (t: string) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const startVoiceInputRef = useRef<() => void>(() => undefined);

  loadingRef.current = loading;

  const handleSendQuestion = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setAnswer(null);

    const repoName = selectedProject?.github_repo || selectedProject?.name || "Imported Repository";
    const textSnippet = source.slice(0, 1500);

    const contextPrompt = `[Live Webpage Preview Context for ${repoName}, file: ${filePath}]. Code/Text snippet: ${textSnippet}. Question about this webpage: ${text}`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: contextPrompt,
          language: "en-IN",
          mode: "preview_qa",
        }),
      });

      const json = await res.json();
      const replyText = json.data?.reply || json.error?.message || "I've analyzed the live preview for this webpage.";
      setAnswer(replyText);
      void speakWithSarvam(replyText);
    } catch {
      const fallback = "Unable to analyze the live preview follow-up. Please try again.";
      setAnswer(fallback);
      void speakWithSarvam(fallback);
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = "en-IN";
      rec.interimResults = false;

      rec.onstart = () => setRecording(true);
      rec.onresult = (e: any) => {
        const spokenText = e.results[0][0].transcript;
        setQuestion(spokenText);
        void handleSendQuestion(spokenText);
      };
      rec.onerror = () => setRecording(false);
      rec.onend = () => setRecording(false);

      rec.start();
    } catch {
      setRecording(false);
    }
  };

  startVoiceInputRef.current = startVoiceInput;

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (event.repeat || isTyping || event.ctrlKey || !event.altKey || event.key.toLowerCase() !== "v") return;

      event.preventDefault();
      if (!loadingRef.current) startVoiceInputRef.current();
    };

    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          type="button"
          onClick={startVoiceInput}
          disabled={loading}
          aria-keyshortcuts="Alt+V"
          title="Ask a voice question (Alt+V)"
          style={{
            background: recording ? "#ef4444" : "#f97316",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          🎤 {recording ? "Listening..." : "Ask Voice Question"} <kbd aria-hidden="true" style={{ fontSize: "0.7rem", opacity: 0.85, border: "1px solid currentColor", borderRadius: "4px", padding: "1px 4px" }}>Alt+V</kbd>
        </button>

        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Ask anything about ${selectedProject?.github_repo || "this webpage"} (e.g. "What is our company about?")`}
          style={{
            flex: 1,
            background: "#09090b",
            border: "1px solid #3f3f46",
            color: "#f4f4f5",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSendQuestion(question);
            }
          }}
        />

        <button
          type="button"
          onClick={() => void handleSendQuestion(question)}
          disabled={loading || !question.trim()}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            opacity: loading || !question.trim() ? 0.6 : 1,
          }}
        >
          {loading ? "Analyzing..." : "Ask"}
        </button>
      </div>

      {answer && (
        <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", padding: "12px", marginTop: "4px" }}>
          <strong style={{ color: "#f97316", fontSize: "0.85rem", display: "block", marginBottom: "4px" }}>
            🎙️ Sarvam AI Preview Explanation:
          </strong>
          <p style={{ color: "#e4e4e7", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

// Build iframe HTML with appropriate simulation applied inside it
function toPreviewDocument(source: string, filePath: string, mode: ExperienceMode): string {
  const isCss = /\.css$/i.test(filePath);
  const isReactOrTs = /\.(tsx|jsx)$/i.test(filePath);

  let bodyContent: string;

  if (isCss) {
    // Render CSS as a styled preview demo
    bodyContent = `
      <style>${source}</style>
      <div class="css-preview-notice" style="padding:12px;background:#1e1e2e;color:#cdd6f4;font-family:monospace;border-radius:8px;margin-bottom:16px;font-size:13px">
        🎨 CSS file preview — styles are applied to the demo elements below
      </div>
      <h1>Heading 1</h1><h2>Heading 2</h2><p>Sample paragraph text for styling preview.</p>
      <button>Primary Button</button><button class="secondary">Secondary Button</button>
      <a href="#">Sample Link</a>
      <input type="text" placeholder="Text input" /><input type="checkbox" /> Checkbox
      <select><option>Option 1</option><option>Option 2</option></select>
      <div class="card"><p>Card component</p></div>
      <nav><ul><li><a href="#">Nav Item 1</a></li><li><a href="#">Nav Item 2</a></li></ul></nav>`;
  } else if (isReactOrTs) {
    // Strip React/TS syntax and render the JSX structure as HTML
    const cleaned = source
      .replace(/import\s+.*?from\s+['"][^'"]+['"];?\n?/g, "")
      .replace(/export\s+default\s+function\s+\w+[^{]*\{/g, "")
      .replace(/export\s+(default\s+)?/g, "")
      .replace(/^\s*const\s+\w+\s*=\s*.*?;\s*$/gm, "")
      .replace(/className=/g, "class=")
      .replace(/htmlFor=/g, "for=")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\{`[^`]*`\}/g, "sample-text")
      .replace(/\{[^{}]*\}/g, "sample-value")
      .replace(/\son[A-Z][A-Za-z]*=(?:"[^"]*"|'[^']*'|\{[^}]*\})/g, "")
      .replace(/<>([\s\S]*?)<\/>/g, "<div>$1</div>")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[A-Z][A-Za-z]*[^>]*\/>/g, "<!-- component /-->")
      .replace(/<([A-Z][A-Za-z]*)[^>]*>([\s\S]*?)<\/\1>/g, "<div class=\"component\">$2</div>")
      .replace(/return\s*\(?\s*$/gm, "")
      .replace(/^\s*\);\s*$/gm, "")
      .trim();
    bodyContent = cleaned || "<p>No renderable HTML found in this React component.</p>";
  } else {
    // HTML — render as-is after removing scripts
    bodyContent = source.replace(/<script[\s\S]*?<\/script>/gi, "");
  }

  // SVG color-blindness filter to apply
  const filterMap: Record<string, string> = {
    protanopia: "url(#protanopia-filter)",
    deuteranopia: "url(#deuteranopia-filter)",
    tritanopia: "url(#tritanopia-filter)",
    monochrome: "url(#monochrome-filter)",
  };
  const filterStyle = filterMap[mode] ? `filter:${filterMap[mode]};` : "";

  // Keyboard mode: inject tab badge script
  const keyboardScript = mode === "keyboard" ? `
    <script>
      document.addEventListener('DOMContentLoaded', () => {
        const els = document.querySelectorAll('a,button,input,select,textarea,[tabindex]');
        els.forEach((el, i) => {
          const badge = document.createElement('span');
          badge.textContent = '#' + (i + 1);
          badge.style.cssText = 'position:absolute;top:-10px;left:-4px;background:#f97316;color:#fff;font:bold 11px/1 sans-serif;padding:2px 5px;border-radius:9px;z-index:999;pointer-events:none';
          el.style.position = 'relative';
          el.parentNode?.insertBefore(badge, el);
        });
      });
    </script>` : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>
  body{font:16px system-ui,sans-serif;padding:20px;color:#151515;background:#fff;${filterStyle}}
  *{box-sizing:border-box}
  button,input,a,select,textarea{margin:6px;padding:8px 14px;cursor:pointer}
  button{background:#f97316;color:#fff;border:none;border-radius:6px}
  input,select,textarea{border:1px solid #ccc;border-radius:6px}
  a{color:#3b82f6}
  img{max-width:100%;height:auto}
  pre{white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px}
  .component{border:1px dashed #ccc;padding:8px;margin:4px;border-radius:4px}
  .css-preview-notice{font-size:12px}
  nav ul{display:flex;gap:16px;list-style:none;padding:0}
</style>
${SVG_FILTERS}
</head><body>
${bodyContent}
${keyboardScript}
</body></html>`;
}

// Extract accessible elements from source
function extractAccessibleElements(source: string): AccessibleElement[] {
  const elements: AccessibleElement[] = [];
  let index = 0;

  const matchers: Array<{ pattern: RegExp; role: string }> = [
    { pattern: /<button[^>]*>([\s\S]*?)<\/button>/gi, role: "button" },
    { pattern: /<a\b[^>]*>([\s\S]*?)<\/a>/gi, role: "link" },
    { pattern: /<input\b[^>]*>/gi, role: "input" },
    { pattern: /<select\b[^>]*>/gi, role: "select" },
    { pattern: /<textarea\b[^>]*>/gi, role: "textarea" },
    { pattern: /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, role: "heading level 1" },
    { pattern: /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, role: "heading level 2" },
    { pattern: /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, role: "heading level 3" },
    { pattern: /<img\b[^>]*alt="([^"]+)"[^>]*>/gi, role: "image" },
    { pattern: /<nav\b[^>]*>/gi, role: "navigation landmark" },
    { pattern: /<main\b[^>]*>/gi, role: "main landmark" },
    { pattern: /<form\b[^>]*>/gi, role: "form" },
  ];

  for (const { pattern, role } of matchers) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source)) !== null) {
      const inner = match[1] ?? "";
      const label = inner.replace(/<[^>]+>/g, "").replace(/\{[^}]+\}/g, "").trim() || role;
      if (label.length > 0) {
        elements.push({ tag: role.split(" ")[0], role, label: label.slice(0, 80), index: index++ });
      }
    }
  }

  return elements.slice(0, 50);
}

function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }
function isProject(v: unknown): v is Project { return isRecord(v) && typeof v.id === "string" && typeof v.name === "string" && typeof v.github_repo === "string"; }
function isFile(v: unknown): v is RepositoryFile { return isRecord(v) && typeof v.path === "string" && typeof v.type === "string"; }
