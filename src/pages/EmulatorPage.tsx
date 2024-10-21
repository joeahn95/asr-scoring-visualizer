import { useState, useRef, useEffect } from "react";
import { readFiles, convertToMp4, formatTime } from "../utils/utils";
import { TranscriptLine } from "../types";
import html2canvas from "html2canvas";
import RecordRTC, { invokeSaveAsDialog } from "recordrtc";

const EmulatorPage = () => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null); // To store the audio source.
  const [transcriptSrc, setTranscriptSrc] = useState<TranscriptLine[] | null>(
    null
  );
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [prelimDisplay, setPrelimDisplay] = useState<string | null>(null);
  const [finalDisplay, setFinalDisplay] = useState<string | null>(null);
  const [finalOnly, setFinalOnly] = useState<Boolean>(false);
  const [numPrelimSkip, setNumPrelimSkip] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const messageRef = useRef<HTMLParagraphElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Function to keep text scroll at the bottom as transcriptions overflow. Does not auto-scroll if user is manually scrolling up.
  const scrollToBottom = () => {
    if (messagesEndRef.current && scrollRef.current) {
      const isUserAtBottom =
        scrollRef.current.scrollHeight - scrollRef.current.scrollTop <=
        scrollRef.current.clientHeight + 50;

      if (isUserAtBottom) {
        messagesEndRef.current?.scrollIntoView({
          behavior: "auto",
        });
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [prelimDisplay, finalDisplay]);

  // useEffect(() => {
  //   console.log(scrollRef.current?.scrollHeight);
  //   console.log(scrollRef.current?.scrollTop);
  //   console.log(scrollRef.current?.clientHeight);
  // }, [
  //   scrollRef.current?.scrollHeight,
  //   scrollRef.current?.scrollTop,
  //   scrollRef.current?.clientHeight,
  // ]);

  // Function to change number of prelim lines skipped
  const handlePrelimChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;

    // Validate the input to allow only whole numbers
    if (inputValue === "" || /^[0-9]+$/.test(inputValue)) {
      setNumPrelimSkip(Number(inputValue));
    }
  };

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
    // Update canvas display for recording.
    mirrorDivToCanvas();

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
      } else if (!finalOnly) {
        if (idx % numPrelimSkip === 0 || numPrelimSkip === 0)
          prelimResult = transcriptSrc[idx]["words"];
      }
      idx++;
    }

    setFinalDisplay(finalResult);
    setPrelimDisplay(prelimResult);
    setCurrentTime(ct);
  };

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
      const mp4Blob = await convertToMp4(blob, messageRef.current);
      const mp4File: File = new File([mp4Blob], "recording.mp4", {
        type: "video/mp4",
      });
      var url = URL.createObjectURL(mp4File);

      setVideoUrl(url);
      invokeSaveAsDialog(mp4File);
    });
  };

  const mirrorDivToCanvas = () => {
    const div = divRef.current;
    const canvas = canvasRef.current;

    if (div && canvas) {
      // Use html2canvas to capture the div and draw onto the canvas.
      html2canvas(div, { logging: false }).then((canvasDiv) => {
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

  return (
    <div
      style={{
        display: "flex",
      }}
    >
      <div
        className="audioPlayer"
        style={{
          border: "2px solid black",
          margin: "8px",
          padding: "8px",
        }}
      >
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
        <h2>Transcript Settings</h2>
        <span>Final Lines Only: </span>
        <input
          type="checkbox"
          checked={finalOnly === true}
          onChange={() => {
            setFinalOnly(!finalOnly);
          }}
        />
        <br />
        <span>{"Skip # Lines (Always Include Final):"}</span>
        <input
          type="number"
          step="1"
          value={numPrelimSkip}
          onChange={handlePrelimChange}
          min="0"
        />
      </div>
      <div className="recorder">
        <button onClick={handleRecording}>Start Recording</button>
        <button onClick={handleStopAndSave}>Stop and Save</button>
        <p ref={messageRef}></p>

        <div
          ref={divRef}
          style={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid black",
            margin: "8px",
            height: "530px",
            width: "251px",
            borderRadius: "20px",
            borderWidth: "6px",
          }}
        >
          <header
            style={{
              borderBottom: "1px solid grey",
              minHeight: "80px",
              backgroundColor: "#0d0c14",
              borderRadius: "13px 13px 0 0 ",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                color: "#949494",
                fontSize: "36px",
                marginLeft: "8px",
              }}
              className="material-icons"
            >
              account_circle
            </span>
            <div
              style={{
                color: "white",
                display: "flex",
                flexDirection: "column",
                margin: "0 8px 0 8px",
                alignItems: "flex-start",
                fontSize: "10px",
              }}
            >
              <h3
                style={{
                  margin: "0",
                  padding: "0",
                  fontSize: "16px",
                }}
              >
                (123) 456-7890
              </h3>
              {audioRef.current && <p>{formatTime(currentTime)}</p>}
              {!audioRef.current && <p>00:00</p>}
            </div>
            <span
              style={{
                color: "white",
                fontSize: "28px",
                marginLeft: "28px",
                backgroundColor: "#454343",
                borderRadius: "16px",
              }}
              className="material-icons"
            >
              more_vert
            </span>
          </header>
          <div
            ref={scrollRef}
            style={{
              height: "360px",
              maxHeight: "360px",
              backgroundColor: "#131217",
              color: "white",
              padding: "4px",
              textAlign: "left",
              overflowY: "auto",
              scrollbarWidth: "none",
              scrollbarColor: "darkgray #131217",
              fontSize: "12px",
            }}
          >
            <p>
              {finalDisplay}
              {prelimDisplay}
            </p>
            <div ref={messagesEndRef} />
          </div>
          <footer
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              minHeight: "84px",
              borderTop: "1px solid grey",
              backgroundColor: "#2d2e3d",
              borderRadius: "0 0 13px 13px",
            }}
          >
            <span
              style={{
                color: "white",
                fontSize: "18px",
                padding: "6px",
                backgroundColor: "#454343",
                borderRadius: "20px",
              }}
              className="material-icons"
            >
              mic_off
            </span>
            <span
              style={{
                color: "white",
                fontSize: "18px",
                padding: "6px",
                backgroundColor: "#454343",
                borderRadius: "20px",
              }}
              className="material-icons"
            >
              volume_up
            </span>
            <span
              style={{
                color: "white",
                fontSize: "36px",
                padding: "6px",
                backgroundColor: "red",
                borderRadius: "30px",
              }}
              className="material-icons"
            >
              call_end
            </span>
            <span
              style={{
                color: "white",
                fontSize: "18px",
                padding: "6px",
                backgroundColor: "#454343",
                borderRadius: "20px",
              }}
              className="material-icons"
            >
              star
            </span>
            <span
              style={{
                color: "white",
                fontSize: "18px",
                padding: "6px",
                backgroundColor: "#454343",
                borderRadius: "20px",
              }}
              className="material-icons"
            >
              dialpad
            </span>
          </footer>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }}></canvas>

        {/* {videoUrl && (
          <video
            src={videoUrl}
            controls
            autoPlay
            style={{ width: "700px", margin: "1em" }}
          />
        )} */}
      </div>
    </div>
  );
};

export default EmulatorPage;
