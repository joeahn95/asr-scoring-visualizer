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

app.get("/inputs/:folder", function (req, res, next) {
  const folder = req.params.folder;
  const inputPath = path.join("../public/inputs/", folder);
  const result = {};

  try {
    const dirs = fs.readdirSync(inputPath);

    // For each directory found, save contents inside its files.
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const dirPath = path.join(inputPath, dir);
      if (dir === "total.json") continue;

      // Make sure only directories exist here.
      if (!fs.lstatSync(dirPath).isDirectory()) {
        res.status(500).json({
          error: "File found in directories. Check results folder.",
          message: "File found in directories. Check results folder.",
        });
      }

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
