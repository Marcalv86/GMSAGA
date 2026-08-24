import { StrictMode, Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Global listener to automatically reload once if a dynamic script/chunk fails to fetch
window.addEventListener("vite:preloadError", (event) => {
  console.warn(
    "Chunk load error detected. Reloading page to fetch latest version...",
    event,
  );
  window.location.reload();
});

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled app error:", error, errorInfo);
    // If it's a dynamic module import failure (e.g. GitHub Pages old chunk after deploy), auto reload once
    if (
      error?.message?.includes("dynamically imported module") ||
      error?.message?.includes("Failed to fetch") ||
      error?.message?.includes("Loading chunk")
    ) {
      const lastReload = sessionStorage.getItem("last_chunk_reload");
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("last_chunk_reload", now.toString());
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#121212",
            color: "#e5e5e5",
            padding: "20px",
            fontFamily: "Cinzel, serif",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "500px",
              backgroundColor: "#1e1e1e",
              border: "1px solid #8b0000",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            <h1
              style={{
                color: "#e57373",
                fontSize: "20px",
                marginBottom: "12px",
              }}
            >
              Ocurrió una interrupción en el Tomo
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#a0a0a0",
                marginBottom: "16px",
                fontFamily: "sans-serif",
              }}
            >
              {this.state.error?.message ||
                "Error inesperado al renderizar el tomo de campaña."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                backgroundColor: "#8b0000",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              Recargar Tomo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
