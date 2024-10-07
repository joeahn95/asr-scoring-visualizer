import React, { useState, ReactElement } from "react";
import "./App.css";
import Plot from "react-plotly.js";
import { jStat } from "jstat";
import { ResultObj, ResultObjOptions, AnovaData } from "./types";

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    // extends React's HTMLAttributes
    directory?: string;
    webkitdirectory?: string;
  }
}

function anovaF(groups: number[][]): number {
  // Calculate the total number of observations
  let totalN = 0;
  for (let group of groups) {
    totalN += group.length;
  }

  // Calculate the overall mean
  let overallSum = 0;
  for (let group of groups) {
    for (let value of group) {
      overallSum += value;
    }
  }
  let overallMean = overallSum / totalN;

  // Calculate the between-group sum of squares (SSB)
  let SSB = 0;
  for (let group of groups) {
    let groupMean = jStat.mean(group);
    SSB += group.length * Math.pow(groupMean - overallMean, 2);
  }

  // Calculate the within-group sum of squares (SSW)
  let SSW = 0;
  for (let group of groups) {
    for (let value of group) {
      SSW += Math.pow(value - jStat.mean(group), 2);
    }
  }

  // Calculate the degrees of freedom
  let dfBetween = groups.length - 1;
  let dfWithin = totalN - groups.length;

  // Calculate the mean squares
  let MSB = SSB / dfBetween;
  let MSW = SSW / dfWithin;

  // Calculate the F-statistic
  let F = MSB / MSW;
  return F;
}

const colors: string[] = [
  "#1f77b4", // muted blue
  "#ff7f0e", // safety orange
  "#2ca02c", // cooked asparagus green
  "#d62728", // brick red
  "#9467bd", // muted purple
  "#8c564b", // chestnut brown
  "#e377c2", // raspberry yogurt pink
  "#7f7f7f", // middle gray
  "#bcbd22", // curry yellow-green
  "#17becf", // blue-teal
];

function alphanumSort(a: string, b: string): number {
  // Split strings into parts of digits and non-digits
  const re = /(\d+|\D+)/g;
  const aParts = a.match(re);
  const bParts = b.match(re);

  if (!aParts || !bParts) return -1;

  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];

    // Compare numeric parts as numbers
    if (!isNaN(parseFloat(aPart)) && !isNaN(parseFloat(bPart))) {
      const diff = Number(aPart) - Number(bPart);
      if (diff !== 0) return diff;
    }
    // Compare non-numeric parts as strings (case-insensitive)
    else {
      const diff = aPart.localeCompare(bPart, undefined, {
        sensitivity: "base",
      });
      if (diff !== 0) return diff;
    }
  }

  // If all parts are equal, the shorter string comes first
  return aParts.length - bParts.length;
}

function sortObjectByKeys(obj: ResultObjOptions): ResultObjOptions {
  // Get the object keys and sort them alphanumerically.
  const sortedKeys = Object.keys(obj).sort(alphanumSort);

  // Create a new sorted object.
  const sortedObj: ResultObjOptions = {};
  sortedKeys.forEach((key) => {
    sortedObj[key] = obj[key];
  });

  return sortedObj;
}

const readFiles = async (folder: string) => {
  const response = await fetch("http://localhost:4000/inputs/" + folder);
  const data = await response.json();
  return data;
};

function App() {
  const [werPlotData, setWerPlotData] = useState<any[] | null>(null);
  const [delayPlotData, setDelayPlotData] = useState<any[] | null>(null);
  const [corrRatePlotData, setCorrRatePlotData] = useState<any[] | null>(null);
  const [diffPlotData, setDiffPlotData] = useState<any[] | null>(null);
  const [diffPlotLayout, setdiffPlotLayout] = useState<object | null>(null);
  const [plotMode, setPlotMode] = useState<string>("wer");
  const [error, setError] = useState<string | null>(null);
  const [plotColors, setPlotColors] = useState<string[]>(colors);
  const [tempPlotColors, setTempPlotColors] = useState<string[]>(colors);
  const [resultNames, setResultsNames] = useState<string[] | null>(null);
  const [fileOptions, setFileOptions] = useState<ResultObjOptions | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[] | null>(null);
  const [anovaData, setAnovaData] = useState<AnovaData | null>(null);

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
          marker: { color: colors[idx % colors.length] },
          name: key.slice(0, key.length - 10),
        });

        colorArr.push(colors[idx % colors.length]);
        nameArr.push(key.slice(0, key.length - 10));

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
          marker: { color: colors[idx % colors.length] },
          name: key.slice(0, key.length - 12),
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
          sortedCorrRateData[key]["results"]["char_correction_pct"]
        );

        corrRatePlotData.push({
          y: yData,
          x: Array(yData.length).fill(idx),
          boxpoints: "all",
          jitter: 0.3,
          pointpos: -1.8,
          type: "box",
          marker: { color: colors[idx % colors.length] },
          name: key.slice(0, key.length - 16),
        });
        idx++;
      }

      setCorrRatePlotData(corrRatePlotData);
    }

    // SAVE JSON FILES FOR COMPARISON
    let files = {};
    for (let key in data) {
      files = {
        ...files,
        ...data[key],
      };
    }
    console.log(files);

    // RESET FILE OPTIONS AND DIFF PLOTS
    setFileOptions(files);
    setSelectedFiles(null);
    setDiffPlotData(null);
    setdiffPlotLayout(null);
    setAnovaData(null);
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions).map(
      (opt) => opt.value
    );

    setSelectedFiles(selectedOptions);
  };

  const handleTTestCompare = () => {
    if (selectedFiles && selectedFiles.length !== 2) {
      return alert("2 Files Required for T-Test");
    }
    if (!fileOptions || !selectedFiles) return;

    const file0 = fileOptions[selectedFiles[0]];
    const file1 = fileOptions[selectedFiles[1]];
    let title = "";
    let yLabel = "";
    const yData = [];
    const plotData = [];
    let layout = {};

    if (file0["job_type"] !== file1["job_type"]) {
      return alert("Files must be same job type.");
    }

    if (file0["job_type"] === "wer") {
      title = `${selectedFiles[0]} vs ${selectedFiles[1]} WER Differential`;
      yLabel = "Percentage Differential (%)";
      const results0 = file0["results"]["wer"];
      const results1 = file1["results"]["wer"];

      for (let key in results0) {
        if (results1.hasOwnProperty(key)) {
          yData.push(results0[key] - results1[key]);
        }
      }

      plotData.push({
        y: yData,
        x: Array(yData.length).fill(0),
        boxpoints: "all",
        jitter: 0.3,
        pointpos: -1.8,
        type: "box",
        name: "Differential",
        boxmean: true,
      });
    }

    if (file0["job_type"] === "delay") {
      title = `${selectedFiles[0]} vs ${selectedFiles[1]} DELAY Differential`;
      yLabel = "Time Differential (s)";
      const results0 = file0["results"]["delays"];
      const results1 = file1["results"]["delays"];

      for (let key in results0) {
        // Only compare if results1 also has the same test number.
        if (results1.hasOwnProperty(key)) {
          // For each delay data in specific test for result 0, find in result 1.
          results0[key].forEach((delayData0) => {
            const delayData1 = results1[key].find(
              (data) =>
                data.word === delayData0.word &&
                data.truth_ms === delayData0.truth_ms
            );
            // If found, add to plotting data.
            if (delayData1) {
              yData.push(delayData0.delay_ms - delayData1.delay_ms);
            }
          });
        }
      }

      plotData.push({
        y: yData,
        x: Array(yData.length).fill(0),
        boxpoints: "all",
        jitter: 0.3,
        pointpos: -1.8,
        type: "box",
        name: "Differential",
        boxmean: true,
      });
    }

    if (file0["job_type"] === "corr_rate") {
      title = `${selectedFiles[0]} vs ${selectedFiles[1]} CHAR CORRECTION RATE Differential`;
      yLabel = "Percentage Differential (%)";
      const results0 = file0["results"]["char_correction_pct"];
      const results1 = file1["results"]["char_correction_pct"];

      for (let key in results0) {
        if (results1.hasOwnProperty(key)) {
          yData.push(results0[key] - results1[key]);
        }
      }

      plotData.push({
        y: yData,
        x: Array(yData.length).fill(0),
        boxpoints: "all",
        jitter: 0.3,
        pointpos: -1.8,
        type: "box",
        name: "Differential",
        boxmean: true,
      });
    }

    layout = {
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
          automargin: true, // Ensure enough space for the label
        },
        gridcolor: "gray", // Change the grid line color to light gray
        tickfont: {
          size: 24, // Increase Y-axis tick label font size
        },
        automargin: true, // Ensure that the margin automatically adjusts
      },
      legend: {
        font: {
          size: 12, // Change the font size of the legend
        },
      },
    };

    setDiffPlotData(plotData);
    setdiffPlotLayout(layout);
  };

  const handleAnovaCompare = () => {
    console.log("ANOVA COMPARE");
    if (!selectedFiles || !fileOptions) return;
    if (selectedFiles.length < 2) {
      return alert("ANOVA test requires at least 2 files");
    }

    const files: ResultObj[] = [];
    selectedFiles.forEach((selectedFile) => {
      files.push(fileOptions[selectedFile]);
    });

    const dataPoints = [];

    if (files[0]["job_type"] === "wer") {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file["job_type"] !== "wer") {
          return alert("Files must be same job type.");
        }

        dataPoints.push(Object.values(file["results"]["wer"]));
      }
    }

    if (files[0]["job_type"] === "delay") {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let delays: number[] = [];
        if (file["job_type"] !== "delay") {
          return alert("Files must be same job type.");
        }
        for (let test in file["results"]["delays"]) {
          delays = [
            ...delays,
            ...file["results"]["delays"][test].map(
              (data) => data.delay_ms * 1000.0
            ),
          ];
        }

        dataPoints.push(delays);
      }
    }

    if (files[0]["job_type"] === "corr_rate") {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file["job_type"] !== "corr_rate") {
          return alert("Files must be same job type.");
        }

        dataPoints.push(Object.values(file["results"]["char_correction_pct"]));
      }
    }

    const pVal = jStat.anovaftest(...dataPoints);
    const fVal = anovaF(dataPoints);
    const anovaResults: AnovaData = {
      pValue: pVal,
      fValue: fVal,
      files: selectedFiles,
    };

    setAnovaData(anovaResults);

    console.log("ANOVA F-test p-value:", pVal);
    console.log("ANOVA F-Test f-value", fVal);
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
    yData: any[],
    title: string,
    yLabel: string
  ): ReactElement => {
    return (
      <Plot
        data={yData}
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
          <button onClick={() => setPlotMode("settings")}>SETTINGS</button>
        </div>
      </header>

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
            "CHARACTER CORRECTION RATE",
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

        {plotMode === "compare" && fileOptions && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "80vw",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
              }}
            >
              <select
                multiple={true}
                onChange={handleSelectChange}
                style={{
                  height: "60vh",
                  width: "25vw",
                  marginTop: "8px",
                }}
              >
                {Object.keys(fileOptions).map((option, index) => (
                  <option key={index} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {anovaData && anovaData["files"] && (
                <div
                  style={{
                    border: "3px solid black",
                    marginLeft: "8px",
                    marginTop: "4px",
                    padding: "8px",
                  }}
                >
                  <h3>ANOVA Analysis</h3>
                  <p>F-Value: {anovaData["fValue"]}</p>
                  <p>P-Value: {anovaData["pValue"]}</p>
                  <p>
                    <strong>Files: </strong>
                    {anovaData["files"].map((file) => {
                      return <p>{file}</p>;
                    })}
                  </p>
                </div>
              )}
            </div>
            <div>
              <button onClick={handleTTestCompare}>T-Test Compare</button>
              <button onClick={handleAnovaCompare}>ANOVA Compare</button>
            </div>

            {diffPlotData && diffPlotLayout && (
              <Plot
                data={diffPlotData}
                layout={diffPlotLayout}
                style={{ width: "80%", height: "85vh" }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
