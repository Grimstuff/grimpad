import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Grimpad UI crash:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "Segoe UI, system-ui, sans-serif",
            color: "#e0e0e0",
            background: "#1e1e1e",
            height: "100%",
            boxSizing: "border-box",
            overflow: "auto",
          }}
        >
          <h1 style={{ marginTop: 0, fontSize: 18 }}>Grimpad failed to render</h1>
          <pre
            style={{ whiteSpace: "pre-wrap", color: "#ff99a4", userSelect: "text" }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            style={{
              marginTop: 12,
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #454545",
              background: "#2d2d2d",
              color: "#e0e0e0",
              cursor: "pointer",
            }}
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
