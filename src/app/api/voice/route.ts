import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { speechToText, textToSpeech, type SarvamLanguage } from "@/lib/sarvam/client";

/** POST: Speech-to-Text or Text-to-Speech */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      action: "stt" | "tts";
      audioBase64?: string;
      text?: string;
      language?: SarvamLanguage;
    };

    const lang: SarvamLanguage = body.language ?? "en-IN";

    if (body.action === "stt") {
      if (!body.audioBase64) throw new Error("audioBase64 is required for speech-to-text.");

      const result = await speechToText(body.audioBase64, lang);
      return NextResponse.json({
        data: { transcript: result.transcript, language: result.language },
        error: null,
      });
    }

    if (body.action === "tts") {
      if (!body.text) throw new Error("text is required for text-to-speech.");

      const audioBase64 = await textToSpeech(body.text, lang);
      return NextResponse.json({
        data: { audioBase64, language: lang },
        error: null,
      });
    }

    throw new Error("action must be 'stt' or 'tts'.");
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Voice API request failed.";
    return NextResponse.json(
      { data: null, error: { message, code: "VOICE_FAILED" } },
      { status: 500 }
    );
  }
}
