export interface ResultObj {
  job: string;
  job_type: string;
  results: {
    delays: {
      [key: string]: {
        word: string;
        caption_ms: number;
        truth_ms: number;
        delay_ms: number;
      }[];
    };
    wer: {
      [key: string]: number;
    };
    word_correction_pct: {
      [key: string]: number;
    };
    char_correction_pct: {
      [key: string]: number;
    };
    word_correction_per_sec: {
      [key: string]: number;
    };
    char_correciton_per_sec: {
      [key: string]: number;
    };
  };
}

export interface ResultObjOptions {
  [key: string]: ResultObj;
}

export interface AnovaData {
  pValue: number;
  fValue: number;
  files: string[] | null;
}
