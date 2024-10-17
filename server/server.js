const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json()); // Parse JSON bodies

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/inputs/:directory", function (req, res, next) {
  const directory = req.params.directory;
  const inputPath = path.join("../public/inputs/", directory);

  // If input path was a file, then return file content.
  if (fs.lstatSync(inputPath).isFile()) {
    const data = require(inputPath);
    return res.send(data);
  }

  // result that holds all the files in directory, initiate a base folder to store files in the root.
  const result = {
    base: {},
  };

  try {
    const dirs = fs.readdirSync(inputPath);

    // For each directory found, save contents inside its files.
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const dirPath = path.join(inputPath, dir);

      // If a file exists in the root directory, store in the base key of results.
      if (fs.lstatSync(dirPath).isFile()) {
        const data = require(dirPath);
        result["base"][dir] = data;
        continue;
      }

      // If directory, then store files into that directory key.
      const files = fs.readdirSync(dirPath);
      result[dir] = {};

      files.forEach((file) => {
        const filePath = path.join(dirPath, file);
        const data = require(filePath);

        result[dir][file] = data;
      });
    }

    res.send(result);
  } catch (error) {
    res.status(500).json({
      error: "No such file or directory in public/inputs.",
      message: "No such file or directory in public/inputs.",
    });
  }
});

app.listen(4000, () => console.log("Example app listening on port 4000!"));
