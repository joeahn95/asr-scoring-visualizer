type HeaderProps = {
  handleDirectoryChange: (event: any) => Promise<void>;
  error: string | null;
  setPlotMode: React.Dispatch<React.SetStateAction<string>>;
};

const Header = ({ error, handleDirectoryChange, setPlotMode }: HeaderProps) => {
  return (
    <header
      className="App-header"
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "4px",
        padding: "8px",
      }}
    >
      <input
        id="directory-upload"
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleDirectoryChange}
      />
      {error && <p style={{ fontSize: "14px", color: "red" }}>{error}</p>}

      <div style={{ display: "flex", gap: "4px" }}>
        <button onClick={() => setPlotMode("wer")}>WER</button>
        <button onClick={() => setPlotMode("delay")}>DELAY</button>
        <button onClick={() => setPlotMode("corr_rate")}>
          CORRECTION RATE
        </button>
        <button onClick={() => setPlotMode("compare")}>COMPARE</button>
        <button onClick={() => setPlotMode("audio")}>AUDIO</button>
        <button onClick={() => setPlotMode("settings")}>SETTINGS</button>
      </div>
    </header>
  );
};

export default Header;
