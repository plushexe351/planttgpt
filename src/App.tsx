import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import * as plantumlEncoder from "plantuml-encoder";
import { GoogleGenAI } from "@google/genai";
import "./App.scss";
import { Settings, X } from "lucide-react";
import logo from "./assets/logo.png";

type Status = "idle" | "loading" | "error" | "done";
type Theme = "light" | "dark" | "system";
type Format = "svg" | "png";

function App() {
  const [apiKey, setApiKey] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [plantUML, setPlantUML] = useState<string>("");
  const [diagramUrl, setDiagramUrl] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [theme, setTheme] = useState<Theme>("system");
  const [format, setFormat] = useState<Format>("svg");
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [hasSavedKey, setHasSavedKey] = useState<boolean>(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setHasSavedKey(true);
    }

    const savedTheme = (localStorage.getItem("theme") as Theme) || "system";
    setTheme(savedTheme);

    const savedFormat = (localStorage.getItem("format") as Format) || "svg";
    setFormat(savedFormat);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("format", format);
  }, [format]);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    let mode = theme;
    if (theme === "system") {
      mode = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  };

  const handleSaveKey = () => {
    localStorage.setItem("gemini_api_key", apiKey);
    setHasSavedKey(true);
    setSettingsOpen(false);
  };

  const generateDiagram = async () => {
    if (!apiKey) {
      alert("Please enter your Gemini API key.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setPlantUML("");
    setDiagramUrl("");

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash";

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `Convert this into valid PlantUML code. 
Only output PlantUML, nothing else.
${input}`,
          },
        ],
      },
    ];

    try {
      const response = await ai.models.generateContentStream({
        model,
        contents,
      });

      let collected = "";
      for await (const chunk of response) {
        if (chunk.text) collected += chunk.text;
      }

      const cleaned = collected
        .replace(/```plantuml/g, "")
        .replace(/```/g, "")
        .trim();

      if (!cleaned.includes("@startuml") || !cleaned.includes("@enduml")) {
        throw new Error("Gemini did not return valid PlantUML");
      }

      setPlantUML(cleaned);

      const encoded = plantumlEncoder.encode(cleaned);
      const baseUrl = "https://www.plantuml.com/plantuml";
      setDiagramUrl(`${baseUrl}/${format}/${encoded}`);
      setStatus("done");
    } catch (err: any) {
      console.error("Gemini error:", err);
      setErrorMsg(err.message || "Failed to generate diagram.");
      setStatus("error");
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>
              <img src={logo} alt="plattgpt logo" className="logo" />
              PlanttGPT
            </h1>
            <p>Turn plain English into UML diagrams using Gemini 2.0 Flash</p>
          </div>
        </div>
      </header>

      <main>
        <section className="editor">
          {hasSavedKey && (
            <div className="settings-toggle">
              <button onClick={() => setSettingsOpen((prev) => !prev)}>
                {settingsOpen ? <X size={17} /> : <Settings size={17} />}
              </button>
            </div>
          )}

          {(!hasSavedKey || settingsOpen) && (
            <div className="card">
              <h2>API Key & Settings</h2>
              <div className="field-row">
                <input
                  type="password"
                  placeholder="Enter Gemini API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="field-row">
                <label>Diagram Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as Format)}
                >
                  <option value="svg">SVG</option>
                  <option value="png">PNG</option>
                </select>
                <button onClick={handleSaveKey} className="save">
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <h2>Describe your diagram</h2>
            <textarea
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Create a class diagram with User, Post, and Comment"
            />
            <button
              onClick={generateDiagram}
              disabled={status === "loading" || !input.trim()}
            >
              {status === "loading" ? (
                <span className="spinner"></span>
              ) : (
                "Generate"
              )}
            </button>
          </div>

          {status === "error" && (
            <div className="card error">
              <p>{errorMsg}</p>
            </div>
          )}

          {plantUML && (
            <div className="card">
              <h2>PlantUML Code</h2>
              <div className="editor-container">
                <Editor
                  height="200px"
                  defaultLanguage="plaintext"
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  value={plantUML}
                  onChange={(val) => setPlantUML(val || "")}
                  options={{ readOnly: false, minimap: { enabled: false } }}
                />
              </div>
            </div>
          )}
        </section>

        {diagramUrl && (
          <section className="preview">
            <div className="card">
              <h2>Diagram Preview</h2>
              <div className="preview-container">
                <img
                  src={diagramUrl}
                  alt="Generated diagram"
                  className="preview-img"
                />
              </div>
              <div className="actions">
                <a href={diagramUrl} download={`diagram.${format}`}>
                  <button>Download {format.toUpperCase()}</button>
                </a>
                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                    plantUML
                  )}`}
                  download="diagram.puml"
                >
                  <button>Download .puml</button>
                </a>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
