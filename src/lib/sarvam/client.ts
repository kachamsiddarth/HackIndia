/**
 * Sarvam AI Client — Indian-language AI services
 * Base URL: https://api.sarvam.ai
 * Auth: api-subscription-key header
 */

const SARVAM_BASE_URL = "https://api.sarvam.ai";

function getApiKey(): string {
  return process.env.SARVAM_API_KEY || "";
}

function headers(): Record<string, string> {
  return {
    "api-subscription-key": getApiKey(),
    "Content-Type": "application/json",
  };
}

export type SarvamLanguage =
  | "en-IN"
  | "hi-IN"
  | "ta-IN"
  | "te-IN"
  | "kn-IN"
  | "ml-IN"
  | "bn-IN"
  | "gu-IN"
  | "mr-IN"
  | "pa-IN"
  | "or-IN";

export const LANGUAGE_LABELS: Record<SarvamLanguage, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi (हिन्दी)",
  "ta-IN": "Tamil (தமிழ்)",
  "te-IN": "Telugu (తెలుగు)",
  "kn-IN": "Kannada (ಕನ್ನಡ)",
  "ml-IN": "Malayalam (മലയാളം)",
  "bn-IN": "Bengali (বাংলা)",
  "gu-IN": "Gujarati (ગુજરાતી)",
  "mr-IN": "Marathi (मराठी)",
  "pa-IN": "Punjabi (ਪੰਜਾਬੀ)",
  "or-IN": "Odia (ଓଡ଼ିଆ)",
};

/** Translate text between Indian languages */
export async function translateText(
  input: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const res = await fetch(`${SARVAM_BASE_URL}/translate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      input,
      source_language_code: sourceLang,
      target_language_code: targetLang,
      mode: "formal",
      model: "mayura:v1",
      enable_preprocessing: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sarvam Translate Error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { translated_text: string };
  return data.translated_text;
}

/** Speech-to-Text: convert audio to text */
export async function speechToText(
  audioBase64: string,
  languageCode: SarvamLanguage = "en-IN"
): Promise<{ transcript: string; language: string }> {
  const res = await fetch(`${SARVAM_BASE_URL}/speech-to-text`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      input: audioBase64,
      language_code: languageCode,
      model: "saaras:v2",
      with_timestamps: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sarvam STT Error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { transcript: string; language_code: string };
  return { transcript: data.transcript, language: data.language_code };
}

/** Text-to-Speech: convert text to audio */
export async function textToSpeech(
  text: string,
  targetLang: SarvamLanguage = "en-IN"
): Promise<string> {
  const res = await fetch(`${SARVAM_BASE_URL}/text-to-speech`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      inputs: [text],
      target_language_code: targetLang,
      speaker: "meera",
      model: "bulbul:v1",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sarvam TTS Error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { audios: string[] };
  return data.audios?.[0] ?? "";
}
