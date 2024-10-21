import Plot from "react-plotly.js";
import { useState } from "react";
import { AnovaData, ResultObjOptions } from "../types";
import { Data } from "plotly.js";
import { ResultObj } from "../types";
import { anovaF } from "../utils/utils";

type ComparePageProps = {
  fileOptions: ResultObjOptions | null;
};

const ComparePage = ({ fileOptions }: ComparePageProps) => {
  const [selectedFiles, setSelectedFiles] = useState<string[] | null>(null);
  const [diffPlotData, setDiffPlotData] = useState<Data[] | null>(null);
  const [diffPlotLayout, setdiffPlotLayout] = useState<object | null>(null);
  const [anovaData, setAnovaData] = useState<AnovaData | null>(null);

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

  const fileList = (fileOptions: ResultObjOptions | null) => {
    if (!fileOptions) return <></>;
    return Object.keys(fileOptions).map((option, index) => (
      <option key={index} value={option}>
        {option}
      </option>
    ));
  };

  return (
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
          {fileList(fileOptions)}
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
            <div>
              <strong>Files: </strong>
              {anovaData["files"].map((file, idx) => {
                return <p key={idx}>{file}</p>;
              })}
            </div>
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
  );
};

export default ComparePage;
