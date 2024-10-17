import Plot from "react-plotly.js";
import { ResultObjOptions, AnovaData } from "../types";
import { Data } from "plotly.js";

const ComparePage = (
  fileOptions: ResultObjOptions,
  anovaData: null | AnovaData,
  diffPlotData: Data[] | null,
  diffPlotLayout: object | null,
  handleSelectChange: (event: React.ChangeEvent<HTMLSelectElement>) => void,
  handleTTestCompare: () => void,
  handleAnovaCompare: () => void
) => {
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
  );
};

export default ComparePage;
