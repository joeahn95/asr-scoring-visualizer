import React, { useState, ReactElement, useRef, useEffect } from "react";
import "./App.css";
import Plot from "react-plotly.js";
import {
  anovaF,
  sortObjectByKeys,
  readFiles,
  convertToMp4,
} from "./utils/utils";
import {
  ResultObj,
  ResultObjOptions,
  AnovaData,
  TranscriptLine,
} from "./types";
import { Data } from "plotly.js";
import ComparePage from "./pages/ComparePage";
import html2canvas from "html2canvas";
import RecordRTC, { invokeSaveAsDialog } from "recordrtc";

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    // extends React's HTMLAttributes
    directory?: string;
    webkitdirectory?: string;
  }
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

function App() {
  const [werPlotData, setWerPlotData] = useState<Data[] | null>(null);
  const [delayPlotData, setDelayPlotData] = useState<Data[] | null>(null);
  const [corrRatePlotData, setCorrRatePlotData] = useState<Data[] | null>(null);
  const [diffPlotData, setDiffPlotData] = useState<Data[] | null>(null);
  const [diffPlotLayout, setdiffPlotLayout] = useState<object | null>(null);
  const [plotMode, setPlotMode] = useState<string>("wer");
  const [error, setError] = useState<string | null>(null);
  const [plotColors, setPlotColors] = useState<string[]>(colors);
  const [tempPlotColors, setTempPlotColors] = useState<string[]>(colors);
  const [resultNames, setResultsNames] = useState<string[] | null>(null);
  const [fileOptions, setFileOptions] = useState<ResultObjOptions | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[] | null>(null);
  const [anovaData, setAnovaData] = useState<AnovaData | null>(null);

  ////////////// FOR AUDIO ///////////////
  const [audioSrc, setAudioSrc] = useState<string | null>(null); // To store the audio source.
  const [transcriptSrc, setTranscriptSrc] = useState<TranscriptLine[] | null>(
    null
  );
  const [prelimDisplay, setPrelimDisplay] = useState<string | null>(null);
  const [finalDisplay, setFinalDisplay] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Reference to the audio element.

  // Function to handle file selection.
  const handleAudioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const file = event.target.files[0]; // Get the selected file.
    if (file) {
      const fileUrl = URL.createObjectURL(file); // Create a URL for the file.
      setAudioSrc(fileUrl); // Set the file URL as the source for the audio player.
    }
  };

  const handleTranscriptChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) return;
    const file = event.target.files[0]; // Get the selected file.
    const data = await readFiles(file.name);
    if (data) {
      setTranscriptSrc(data); // Set complete transcript to transcriptSrc.
    }
  };

  const onPlaying = () => {
    // Get time in ms.
    if (!audioRef.current || !transcriptSrc) return;
    const ct = audioRef.current.currentTime * 1000.0;

    // Format new transcript display.
    let finalResult = "";
    let prelimResult = "";
    let idx = 0;
    while (idx < transcriptSrc.length) {
      if (ct < transcriptSrc[idx]["caption_ms"]) {
        break;
      }
      if (transcriptSrc[idx]["type"] === "final") {
        finalResult += transcriptSrc[idx]["words"] + " ";
        prelimResult = "";
      } else {
        prelimResult = transcriptSrc[idx]["words"];
      }
      idx++;
    }

    setFinalDisplay(finalResult);
    setPrelimDisplay(prelimResult);
  };

  const AudioPlayer = () => {
    return (
      <div>
        <h2>Select an Audio File</h2>
        <input type="file" accept="audio/*" onChange={handleAudioChange} />
        {audioSrc && (
          <audio ref={audioRef} controls onTimeUpdate={onPlaying}>
            <source src={audioSrc} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        )}

        <h2>Select an Transcript File</h2>
        <input type="file" accept=".json" onChange={handleTranscriptChange} />
        {transcriptSrc && (
          <div>
            <p>
              Display: <strong>{finalDisplay}</strong>
              {prelimDisplay}
            </p>
          </div>
        )}
      </div>
    );
  };

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLParagraphElement | null>(null);

  const mirrorDivToCanvas = () => {
    const div = divRef.current;
    const canvas = canvasRef.current;

    if (div && canvas) {
      // Use html2canvas to capture the div and draw onto the canvas.
      html2canvas(div).then((canvasDiv) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        // Resize the canvas to match the div's dimensions.
        canvas.width = canvasDiv.width;
        canvas.height = canvasDiv.height;
        // Draw the captured div onto the canvas.
        ctx.drawImage(canvasDiv, 0, 0);
      });
    } else {
      console.log("no context or div");
    }
  };

  // Update canvas every time display is updated.
  useEffect(() => {
    mirrorDivToCanvas();
  }, [prelimDisplay, finalDisplay]);

  const Recorder = () => {
    const handleRecording = async () => {
      const canvas = canvasRef.current;

      if (!canvas) return;

      // Capture stream from the canvas
      const canvasStream = canvas.captureStream();

      // Capture system audio (display media) with audio options
      const options = {
        audio: true,
        selfBrowserSurface: "include",
        preferCurrentTab: true,
      };
      const audioStream = await navigator.mediaDevices.getDisplayMedia(options);

      // Combine canvas stream (video) and system audio.
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);

      // Initialize RecordRTC with the stream.
      recorderRef.current = new RecordRTC(combinedStream, {
        // mimeType: "video/webm;codecs=h264",
      });
      recorderRef.current.startRecording();
    };

    const handleStopAndSave = async () => {
      if (!recorderRef.current) return;

      recorderRef.current.stopRecording(async () => {
        if (!recorderRef.current || !messageRef.current) return;
        var blob = recorderRef.current.getBlob();

        var webmFile: File = new File([blob], "file-name.webm", {
          type: "video/webm",
        });
        const mp4Blob = await convertToMp4(webmFile, messageRef.current);
        const mp4File: File = new File([mp4Blob], "recording.mp4", {
          type: "video/mp4",
        });
        var url = URL.createObjectURL(mp4File);

        setVideoUrl(url);
        invokeSaveAsDialog(mp4File);
      });
    };

    return (
      <div>
        <header>
          <button onClick={handleRecording}>start</button>
          <button onClick={handleStopAndSave}>stop</button>

          <div
            ref={divRef}
            style={{
              border: "2px solid black",
              backgroundColor: "blue",
              marginBottom: "20px",
              height: "480px",
              width: "600px",
            }}
          >
            <p>
              Display: <strong>{finalDisplay}</strong>
              {prelimDisplay}
            </p>
          </div>

          <p ref={messageRef}></p>

          <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

          {videoUrl && (
            <video
              src={videoUrl}
              controls
              autoPlay
              style={{ width: "700px", margin: "1em" }}
            />
          )}
        </header>
      </div>
    );
  };

  ////////////////////////

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
          sortedCorrRateData[key]["results"]["word_correction_pct"]
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
    const yData: number[] = [];
    const plotData: Data[] = [];
    let layout = {};

    if (file0["job_type"] !== file1["job_type"]) {
      return alert("Files must be same job type.");
    }

    if (file0["job_type"] === "wer") {
      const fileName0 = selectedFiles[0].slice(0, selectedFiles[0].length - 10);
      const fileName1 = selectedFiles[1].slice(0, selectedFiles[1].length - 10);
      title = `${fileName0} vs ${fileName1} WER Differential`;
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
      const fileName0 = selectedFiles[0].slice(0, selectedFiles[0].length - 12);
      const fileName1 = selectedFiles[1].slice(0, selectedFiles[1].length - 12);
      title = `${fileName0} vs ${fileName1} DELAY Differential`;
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
      const fileName0 = selectedFiles[0].slice(0, selectedFiles[0].length - 16);
      const fileName1 = selectedFiles[1].slice(0, selectedFiles[1].length - 16);
      title = `${fileName0} vs ${fileName1} WORD CORR RATE Differential`;
      yLabel = "Percentage Differential (%)";
      const results0 = file0["results"]["word_correction_pct"];
      const results1 = file1["results"]["word_correction_pct"];

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

    const stats = anovaF(dataPoints);
    const anovaResults: AnovaData = {
      pValue: stats.pVal,
      fValue: stats.fVal,
      files: selectedFiles,
    };

    setAnovaData(anovaResults);

    console.log("ANOVA F-test p-value:", stats.pVal);
    console.log("ANOVA F-Test f-value", stats.fVal);
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

        {plotMode === "compare" &&
          fileOptions &&
          ComparePage(
            fileOptions,
            anovaData,
            diffPlotData,
            diffPlotLayout,
            handleSelectChange,
            handleTTestCompare,
            handleAnovaCompare
          )}

        {plotMode === "audio" && (
          <>
            {AudioPlayer()}
            {Recorder()}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
