import React, { useState, ReactElement } from "react";
import "./App.css";
import Plot from "react-plotly.js";
import { sortObjectByKeys, readFiles } from "./utils/utils";
import { ResultObjOptions } from "./types";
import { Data } from "plotly.js";
import ComparePage from "./pages/ComparePage";
import EmulatorPage from "./pages/EmulatorPage";
import { COLORS } from "./constants";
import Header from "./components/Header";

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    // extends React's HTMLAttributes
    directory?: string;
    webkitdirectory?: string;
  }
}

function App() {
  const [werPlotData, setWerPlotData] = useState<Data[] | null>(null);
  const [delayPlotData, setDelayPlotData] = useState<Data[] | null>(null);
  const [corrRatePlotData, setCorrRatePlotData] = useState<Data[] | null>(null);
  const [plotMode, setPlotMode] = useState<string>("wer");
  const [error, setError] = useState<string | null>(null);
  const [plotColors, setPlotColors] = useState<string[]>(COLORS);
  const [tempPlotColors, setTempPlotColors] = useState<string[]>(COLORS);
  const [resultNames, setResultsNames] = useState<string[] | null>(null);
  const [fileOptions, setFileOptions] = useState<ResultObjOptions | null>(null);

  const handleColorChange = (idx: number, color: string) => {
    const currColors = [...tempPlotColors];
    currColors[idx] = color;
    setTempPlotColors(currColors);
  };

  const handleColorSave = () => {
    const newWerPlotData = JSON.parse(JSON.stringify(werPlotData));
    for (let i = 0; i < newWerPlotData.length; i++) {
      newWerPlotData[i]["marker"] = { color: tempPlotColors[i] };
    }
    const newDelayPlotData = JSON.parse(JSON.stringify(delayPlotData));
    for (let i = 0; i < newDelayPlotData.length; i++) {
      newDelayPlotData[i]["marker"] = { color: tempPlotColors[i] };
    }
    const newCorrRatePlotData = JSON.parse(JSON.stringify(corrRatePlotData));
    for (let i = 0; i < newCorrRatePlotData.length; i++) {
      newCorrRatePlotData[i]["marker"] = { color: tempPlotColors[i] };
    }

    setWerPlotData(newWerPlotData);
    setDelayPlotData(newDelayPlotData);
    setCorrRatePlotData(newCorrRatePlotData);
    setPlotColors(tempPlotColors);
    alert("saved");
  };

  const handleDirectoryChange = async (event: any) => {
    if (event.target.files.length === 0) {
      setError("No files");
      return;
    }
    const path = event.target.files[0].webkitRelativePath;
    const slashIdx = path.indexOf("/");
    const folder = path.substring(0, slashIdx + 1);

    // Check if input folder is valid
    const data = await readFiles(folder);
    if (data["error"]) {
      setError(data["error"]);
      return;
    }
    setError(null);

    // WER Processing + Setting names + Setting colors
    if (data["wer"]) {
      const werData = data["wer"];
      const sortedWerData = sortObjectByKeys(werData);
      const werPlotData: any[] = [];
      const colorArr = [];
      const nameArr = [];
      let idx = 0;

      // Use mod idx for colors, in case we get a new data and need a different length set of colors.
      for (let key in sortedWerData) {
        const yData = Object.values(sortedWerData[key]["results"]["wer"]);

        werPlotData.push({
          y: yData,
          x: Array(yData.length).fill(idx),
          boxpoints: "all",
          jitter: 0.3,
          pointpos: -1.8,
          type: "box",
          marker: { color: COLORS[idx % COLORS.length] },
          name: key,
        });

        colorArr.push(COLORS[idx % COLORS.length]);
        nameArr.push(key);

        idx++;
      }

      setWerPlotData(werPlotData);
      setPlotColors(colorArr);
      setTempPlotColors(colorArr);
      setResultsNames(nameArr);
    }

    // DELAY Processing
    if (data["delay"]) {
      const delayData = data["delay"];
      const sortedDelayData = sortObjectByKeys(delayData);
      const delayPlotData: any[] = [];
      let idx = 0;

      for (let key in sortedDelayData) {
        const yData = [];
        for (let test in sortedDelayData[key]["results"]["delays"]) {
          for (let delay in sortedDelayData[key]["results"]["delays"][test]) {
            yData.push(
              sortedDelayData[key]["results"]["delays"][test][delay][
                "delay_ms"
              ] / 1000.0
            );
          }
        }

        delayPlotData.push({
          y: yData,
          x: Array(yData.length).fill(idx),
          boxpoints: "all",
          jitter: 0.3,
          pointpos: -1.8,
          type: "box",
          marker: { color: COLORS[idx % COLORS.length] },
          name: key,
        });
        idx++;
      }

      setDelayPlotData(delayPlotData);
    }

    // CORRECTION RATE Processing
    if (data["corr_rate"]) {
      const corrRateData = data["corr_rate"];
      const sortedCorrRateData = sortObjectByKeys(corrRateData);
      const corrRatePlotData: any[] = [];
      let idx = 0;

      for (let key in sortedCorrRateData) {
        const yData = Object.values(
          sortedCorrRateData[key]["results"]["word_correction_pct"]
        );

        corrRatePlotData.push({
          y: yData,
          x: Array(yData.length).fill(idx),
          boxpoints: "all",
          jitter: 0.3,
          pointpos: -1.8,
          type: "box",
          marker: { color: COLORS[idx % COLORS.length] },
          name: key,
        });
        idx++;
      }

      setCorrRatePlotData(corrRatePlotData);
    }

    // SAVE JSON FILES FOR COMPARISON
    let files: ResultObjOptions | null = {};
    for (let key in data) {
      for (let fileKey in data[key]) {
        files[fileKey + "_" + key] = data[key][fileKey];
      }
    }
    console.log(files);

    // RESET FILE OPTIONS
    setFileOptions(files);
  };

  const ColorSettings = (): ReactElement => {
    if (!resultNames) return <></>;
    return (
      <>
        {tempPlotColors.map((color, idx) => {
          return (
            <div
              key={idx}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span>{resultNames[idx]}</span>
              <input
                value={color}
                onChange={(e) => handleColorChange(idx, e.target.value)}
              />
            </div>
          );
        })}
      </>
    );
  };

  const displayPlot = (
    data: Data[],
    title: string,
    yLabel: string
  ): ReactElement => {
    return (
      <Plot
        data={data}
        layout={{
          title: {
            text: title,
            font: {
              size: 24, // Increase title font size
            },
          },
          yaxis: {
            title: {
              text: yLabel,
              font: {
                size: 18, // Increase Y-axis title font size
              },
            },
            gridcolor: "gray", // Change the grid line color to light gray
            tickfont: {
              size: 18, // Increase Y-axis tick label font size
            },
            automargin: true, // Ensure that the margin automatically adjusts
          },
          legend: {
            font: {
              size: 12, // Change the font size of the legend
            },
          },
        }}
        style={{ width: "80%", height: "85vh" }}
      />
    );
  };

  return (
    <div className="App">
      <Header
        error={error}
        handleDirectoryChange={handleDirectoryChange}
        setPlotMode={setPlotMode}
      />

      {/* Pages below header. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        {werPlotData &&
          plotMode === "wer" &&
          displayPlot(werPlotData, "WER", "Percentage (%)")}

        {delayPlotData &&
          plotMode === "delay" &&
          displayPlot(delayPlotData, "DELAY", "Delay (s)")}

        {corrRatePlotData &&
          plotMode === "corr_rate" &&
          displayPlot(
            corrRatePlotData,
            "WORD CORRECTION RATE",
            "Percentage (%)"
          )}

        {plotColors && plotMode === "settings" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            {ColorSettings()}
            <button onClick={handleColorSave}>SAVE</button>
            <button onClick={() => setTempPlotColors(plotColors)}>
              CANCEL
            </button>
          </div>
        )}

        {plotMode === "compare" && { fileOptions } && (
          <ComparePage fileOptions={fileOptions} />
        )}

        {plotMode === "audio" && <EmulatorPage />}
      </div>
    </div>
  );
}

export default App;
