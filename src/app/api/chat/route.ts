import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { generateCompletion } from "@/lib/ai/groq";
import { translateText, type SarvamLanguage } from "@/lib/sarvam/client";

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
      message: string;
      language?: SarvamLanguage;
      projectId?: string;
      context?: Record<string, unknown>;
    };

    if (!body.message?.trim()) throw new Error("Message is required.");

    const lang = body.language ?? "en-IN";
    const admin = createAdminClient();

    // Translate non-English messages to English for the AI
    let aiInput = body.message;
    if (lang !== "en-IN") {
      try {
        aiInput = await translateText(body.message, lang.split("-")[0], "en");
      } catch {
        aiInput = body.message; // fallback if translation fails
      }
    }

    // Build context from project data if projectId is provided
    let contextStr = "";
    if (body.projectId) {
      const { data: project } = await admin
        .from("projects")
        .select("name, github_repo, framework, accessibility_score, ai_summary")
        .eq("id", body.projectId)
        .single();

      if (project) {
        contextStr = `\nProject Context: ${project.name} (${project.github_repo}), Framework: ${project.framework || "Web"}, Accessibility Score: ${project.accessibility_score}%. AI Summary: ${project.ai_summary || "N/A"}.`;
      }

      // Get recent issues
      const { data: issues } = await admin
        .from("issues")
        .select("title, severity, wcag_rule, file_path")
        .eq("project_id", body.projectId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (issues && issues.length > 0) {
        contextStr += `\nRecent Issues: ${issues.map((i) => `${i.title} (${i.severity}, ${i.wcag_rule} in ${i.file_path})`).join("; ")}`;
      }
    }

    // Generate AI response using Groq
    const systemPrompt = `You are the AccessDiff AI Assistant powered by Sarvam AI. You help developers fix accessibility issues in their web applications following WCAG 2.2 AA standards.
You can explain accessibility violations, suggest fixes, interpret WCAG rules, and guide developers through remediation.
Be concise, practical, and provide code examples when relevant.${contextStr}`;

    const aiResponse = await generateCompletion<string>(aiInput, {
      systemPrompt,
      temperature: 0.4,
      maxTokens: 2048,
      useFastModel: true,
    });

    // Translate response back to user's language if needed
    let finalResponse = aiResponse;
    if (lang !== "en-IN") {
      try {
        finalResponse = await translateText(aiResponse, "en", lang.split("-")[0]);
      } catch {
        finalResponse = aiResponse; // fallback
      }
    }

    // Persist to chat_history
    await admin.from("chat_history").insert([
      {
        user_id: user.id,
        project_id: body.projectId || null,
        role: "user",
        content: body.message,
        language: lang,
        context: body.context || null,
      },
      {
        user_id: user.id,
        project_id: body.projectId || null,
        role: "assistant",
        content: finalResponse,
        language: lang,
        context: null,
      },
    ]);

    return NextResponse.json({
      data: { reply: finalResponse, language: lang },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Chat request failed.";
    return NextResponse.json(
      { data: null, error: { message, code: "CHAT_FAILED" } },
      { status: 500 }
    );
  }
}

/** GET: Fetch chat history */
export async function GET(request: Request): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const admin = createAdminClient();
  let query = admin
    .from("chat_history")
    .select("id, role, content, language, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (projectId) query = query.eq("project_id", projectId);

  const { data: messages } = await query;

  return NextResponse.json({
    data: { messages: messages ?? [] },
    error: null,
  });
}
