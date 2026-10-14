import { useState, useCallback, useRef, useEffect } from "react";
import { cleanNewsletterHtml } from "./lib/cleanHtml.js";
import {
  loadHistory,
  saveHistoryEntry,
  deleteHistoryEntry,
  clearHistory,
  createHistoryEntry,
} from "./lib/history.js";
import { SAMPLE_HTML } from "./lib/sampleHtml.js";
import { HistoryModal } from "./components/HistoryModal.jsx";
import "./App.css";

const DEFAULT_OPTIONS = {
  href: true,
  src: true,
  businessEmails: true,
  personalEmails: true,
  numbers: true,
};

const OPTION_LABELS = [
  { key: "href", label: "Hrefs", icon: "\u{1F517}", desc: "Strip domain from href links" },
  { key: "src", label: "Srcs", icon: "\u{1F4F7}", desc: "Strip domain from src images" },
  { key: "businessEmails", label: "Business Emails", icon: "\u{1F4E7}", desc: "Remove @ only" },
  { key: "personalEmails", label: "Personal Emails", icon: "\u{1F464}", desc: "Remove @ and dots" },
  { key: "numbers", label: "Numbers", icon: "\u{1F522}", desc: "Remove visible digits only" },
];

function HtmlTextarea({ value, onChange, placeholder, id }) {
  return (
    <textarea
      id={id}
      className="html-textarea"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      spellCheck={false}
      rows={10}
    />
  );
}

function App() {
  const [inputHtml, setInputHtml] = useState("");
  const [outputHtml, setOutputHtml] = useState("");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [stats, setStats] = useState({ hrefs: 0, srcs: 0, emails: 0, numbers: 0 });
  const [hasCleaned, setHasCleaned] = useState(false);
  const [message, setMessage] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const [viewMode, setViewMode] = useState("preview");
  const messageTimer = useRef(null);
  const iframeRef = useRef(null);

  const showMessage = useCallback((text, type = "success") => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage({ text, type });
    messageTimer.current = setTimeout(() => setMessage(null), 3500);
  }, []);

  const runClean = useCallback((html, opts, saveHist = false) => {
    if (!html.trim()) {
      setOutputHtml("");
      setStats({ hrefs: 0, srcs: 0, emails: 0, numbers: 0 });
      setHasCleaned(false);
      return;
    }
    const result = cleanNewsletterHtml(html, opts);
    setOutputHtml(result.html);
    setStats(result.stats);
    setHasCleaned(true);

    if (saveHist) {
      const entry = createHistoryEntry(html, result.html, result.stats, opts);
      const updated = saveHistoryEntry(entry);
      if (updated) setHistory(updated);
    }
  }, []);

  const handleClean = useCallback(() => {
    if (!inputHtml.trim()) {
      showMessage("Please paste some newsletter HTML to clean.", "error");
      return;
    }
    runClean(inputHtml, options, true);
    showMessage("HTML cleaned successfully!", "success");
  }, [inputHtml, options, runClean, showMessage]);

  const handleToggleOption = useCallback(
    (key) => {
      setOptions((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        if (inputHtml.trim()) {
          runClean(inputHtml, next, false);
        }
        return next;
      });
    },
    [inputHtml, runClean]
  );

  useEffect(() => {
    if (inputHtml.trim() && hasCleaned) {
      const timer = setTimeout(() => {
        runClean(inputHtml, options, false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [inputHtml, options, runClean, hasCleaned]);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        if (outputHtml) {
          doc.write(outputHtml);
        } else {
          doc.write(
            "<div style='color:#999;font-family:sans-serif;padding:40px;text-align:center'>Your cleaned newsletter preview will appear here...</div>"
          );
        }
        doc.close();
      }
    }
  }, [outputHtml, viewMode]);

  const handleCopy = useCallback(async () => {
    if (!outputHtml) {
      showMessage("Nothing to copy yet. Clean some HTML first.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(outputHtml);
      showMessage("Cleaned HTML copied to clipboard!", "success");
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = outputHtml;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        showMessage("Cleaned HTML copied to clipboard!", "success");
      } catch {
        showMessage("Failed to copy. Please try manually.", "error");
      }
    }
  }, [outputHtml, showMessage]);

  const handleDownload = useCallback(() => {
    if (!outputHtml) {
      showMessage("Nothing to download yet. Clean some HTML first.", "error");
      return;
    }
    try {
      const blob = new Blob([outputHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cleaned-newsletter.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage("HTML file downloaded!", "success");
    } catch {
      showMessage("Failed to download file.", "error");
    }
  }, [outputHtml, showMessage]);

  const handleClear = useCallback(() => {
    setInputHtml("");
    setOutputHtml("");
    setStats({ hrefs: 0, srcs: 0, emails: 0, numbers: 0 });
    setHasCleaned(false);
    showMessage("Input and output cleared.", "success");
  }, [showMessage]);

  const handleLoadSample = useCallback(() => {
    setInputHtml(SAMPLE_HTML);
    setOutputHtml("");
    setStats({ hrefs: 0, srcs: 0, emails: 0, numbers: 0 });
    setHasCleaned(false);
    showMessage("Sample newsletter loaded. Click Clean HTML to process.", "success");
  }, [showMessage]);

  const handleRestoreFromHistory = useCallback(
    (entry) => {
      setInputHtml(entry.original);
      setOutputHtml(entry.cleaned);
      setStats(entry.stats);
      if (entry.options) setOptions(entry.options);
      setHasCleaned(true);
      setShowHistory(false);
      showMessage("History entry restored.", "success");
    },
    [showMessage]
  );

  const handleDeleteHistory = useCallback((id) => {
    const updated = deleteHistoryEntry(id);
    if (updated) setHistory(updated);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  const activeOptionCount = Object.values(options).filter(Boolean).length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-wrap">
            <span className="logo-icon">&#9993;</span>
            <div>
              <h1>Newsletter Cleaner</h1>
              <p className="subtitle">Clean URLs, emails, and numbers from your newsletter HTML</p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => setShowHistory(true)}>
            View History ({history.length})
          </button>
        </div>
      </header>

      <main className="app-main">
        {message && (
          <div className={`alert alert-${message.type}`}>{message.text}</div>
        )}

        <div className="options-bar">
          <div className="options-header">
            <span className="options-title">Cleaning Options</span>
            <span className="options-hint">
              Toggle any option to instantly re-clean ({activeOptionCount} active)
            </span>
          </div>
          <div className="options-grid">
            {OPTION_LABELS.map((opt) => (
              <label
                key={opt.key}
                data-key={opt.key}
                className={`option-chip ${options[opt.key] ? "active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={options[opt.key]}
                  onChange={() => handleToggleOption(opt.key)}
                />
                <span className="option-icon">{opt.icon}</span>
                <span className="option-text">
                  <span className="option-label">{opt.label}</span>
                  <span className="option-desc">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon">&#128279;</span>
            <div>
              <span className="stat-value">{stats.hrefs}</span>
              <span className="stat-label">Hrefs Cleaned</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">&#128247;</span>
            <div>
              <span className="stat-value">{stats.srcs}</span>
              <span className="stat-label">Srcs Cleaned</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">&#9993;</span>
            <div>
              <span className="stat-value">{stats.emails}</span>
              <span className="stat-label">Emails Processed</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">&#128290;</span>
            <div>
              <span className="stat-value">{stats.numbers}</span>
              <span className="stat-label">Numbers Removed</span>
            </div>
          </div>
        </div>

        <div className="editor-grid">
          <div className="editor-panel">
            <div className="panel-header">
              <label htmlFor="input-html">Paste Newsletter HTML</label>
              <button className="btn btn-link" onClick={handleLoadSample}>
                Load Sample
              </button>
            </div>
            <HtmlTextarea
              id="input-html"
              value={inputHtml}
              onChange={(e) => setInputHtml(e.target.value)}
              placeholder="Paste your newsletter HTML here..."
            />
            <div className="panel-actions">
              <button className="btn btn-primary" onClick={handleClean}>
                Clean HTML
              </button>
              <button className="btn btn-secondary" onClick={handleClear}>
                Clear
              </button>
            </div>
          </div>

          <div className="editor-panel output-panel">
            <div className="panel-header">
              <label>Cleaned Output</label>
              <div className="view-toggle">
                <button
                  className={`toggle-btn ${viewMode === "preview" ? "active" : ""}`}
                  onClick={() => setViewMode("preview")}
                >
                  Preview
                </button>
                <button
                  className={`toggle-btn ${viewMode === "code" ? "active" : ""}`}
                  onClick={() => setViewMode("code")}
                >
                  Code
                </button>
              </div>
            </div>

            {viewMode === "preview" ? (
              <div className="preview-container">
                <iframe
                  ref={iframeRef}
                  title="Newsletter Preview"
                  className="preview-iframe"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <textarea
                className="html-textarea code-output"
                placeholder="Your cleaned HTML code will appear here..."
                value={outputHtml}
                readOnly
                spellCheck={false}
              />
            )}

            <div className="panel-actions">
              <button
                className="btn btn-primary"
                onClick={handleCopy}
                disabled={!hasCleaned}
              >
                Copy Cleaned HTML
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleDownload}
                disabled={!hasCleaned}
              >
                Download HTML
              </button>
            </div>
          </div>
        </div>

        {!hasCleaned && !inputHtml && (
          <div className="empty-state">
            <span className="empty-icon">&#9993;</span>
            <h3>Get Started</h3>
            <p>Paste your newsletter HTML on the left, or click "Load Sample" to try it out.</p>
          </div>
        )}
      </main>

      {showHistory && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestoreFromHistory}
          onDelete={handleDeleteHistory}
          onClearAll={handleClearHistory}
        />
      )}
    </div>
  );
}

export default App;
