import { jStat } from "jstat";
import { ResultObjOptions } from "../types";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

export function anovaF(groups: number[][]): {
  fVal: number;
  pVal: number;
} {
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
  const F = MSB / MSW;

  // Calculate P-value using jStat
  const P = jStat.anovaftest(...groups);

  return {
    fVal: F,
    pVal: P,
  };
}

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

export function sortObjectByKeys(obj: ResultObjOptions): ResultObjOptions {
  // Get the object keys and sort them alphanumerically.
  const sortedKeys = Object.keys(obj).sort(alphanumSort);

  // Create a new sorted object.
  const sortedObj: ResultObjOptions = {};
  sortedKeys.forEach((key) => {
    sortedObj[key] = obj[key];
  });

  return sortedObj;
}

export const readFiles = async (dir: string) => {
  const response = await fetch("http://localhost:4000/inputs/" + dir);
  const data = await response.json();
  return data;
};

export const convertToMp4 = async (
  webmFile: File,
  message: HTMLParagraphElement
) => {
  const ffmpeg = new FFmpeg();

  // Listen to progress event instead of log.
  ffmpeg.on("progress", ({ time }) => {
    message.innerHTML = `(transcoded time: ${time / 1000000} s)`;
  });
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  await ffmpeg.writeFile(
    "recorded.webm",
    await fetchFile(URL.createObjectURL(webmFile))
  );

  // Run FFmpeg command to convert WebM to MP4
  await ffmpeg.exec(["-i", "recorded.webm", "-r", "30", "output.mp4"]);
  console.log("reading file");

  // Read the result
  const fileData = await ffmpeg.readFile("output.mp4");
  const data = new Uint8Array(fileData as ArrayBuffer);

  console.log("creating blob");
  // Convert to Blob for saving
  const mp4Blob = new Blob([data.buffer], { type: "video/mp4" });
  return mp4Blob;
};
