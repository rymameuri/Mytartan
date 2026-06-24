import { useState } from "react";
import "./CanvasConnect.css";

function CanvasConnect({ connected, canvasUrl, connect, disconnect, loading, error }) {
  const [url, setUrl] = useState("https://canvas.cmu.edu");
  const [token, setToken] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await connect(url, token);
    if (result) {
      setToken("");
    }
  }

  if (connected) {
    return (
      <div className="canvas-connect canvas-connect--connected">
        <span className="canvas-connect__badge">Connected</span>
        <p className="canvas-connect__url">{canvasUrl}</p>
        <button type="button" className="canvas-connect__disconnect-btn" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <form className="canvas-connect" onSubmit={handleSubmit}>
      <label className="canvas-connect__label" htmlFor="canvas-url">
        Canvas base URL
      </label>
      <input
        id="canvas-url"
        type="url"
        className="canvas-connect__input"
        placeholder="https://canvas.cmu.edu"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        required
      />

      <label className="canvas-connect__label" htmlFor="canvas-token">
        API token
      </label>
      <input
        id="canvas-token"
        type="password"
        className="canvas-connect__input"
        value={token}
        onChange={(event) => setToken(event.target.value)}
        autoComplete="off"
        required
      />
      <p className="canvas-connect__hint">
        Generate in Canvas under Account → Settings → New Access Token
      </p>

      {error && <p className="canvas-connect__error">{error}</p>}

      <button type="submit" className="canvas-connect__connect-btn" disabled={loading || !token.trim()}>
        {loading ? "Connecting…" : "Connect"}
      </button>
    </form>
  );
}

export default CanvasConnect;
