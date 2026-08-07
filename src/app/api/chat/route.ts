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
      mode?: string; // 'preview_qa' = bypass browser agent, answer directly about webpage content
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

    let finalResponse: string;
    let navigationTarget: string | undefined;
    let actionResults: unknown[] = [];

    if (body.mode === "preview_qa") {
      // Direct LLM Q&A mode — bypasses the browser agent entirely.
      // Used for Experience page follow-up questions about the live preview webpage.
      const systemPrompt = `You are a helpful accessibility assistant. The user is viewing a live preview of an imported website repository. Answer questions specifically about the webpage content provided in the user message. Be concise, accurate and speak in plain English. Do not navigate anywhere or run pipelines.`;
      finalResponse = await generateCompletion<string>(aiInput, { systemPrompt });
      navigationTarget = undefined;
      actionResults = [];
    } else {
      // Instantiate Sarvam AI Browser Agent to orchestrate application actions
      const { SarvamBrowserAgent } = await import("@/lib/sarvam/browser-agent");
      const browserAgent = new SarvamBrowserAgent();

      const agentResult = await browserAgent.planAndExecute(aiInput, {
        userId: user.id,
        projectId: body.projectId,
        currentPath: (body.context as any)?.currentPath,
        repoName: (body.context as any)?.repoName,
        pipelineRunId: (body.context as any)?.pipelineRunId,
      });

      finalResponse = agentResult.responseText;
      navigationTarget = agentResult.navigationTarget;
      actionResults = agentResult.actionResults ?? [];
    }

    // Translate response back to user's language if needed
    if (lang !== "en-IN") {
      try {
        finalResponse = await translateText(finalResponse, "en", lang.split("-")[0]);
      } catch {
        // keep original on translation failure
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
        context: navigationTarget ? { navigationTarget } : null,
      },
    ]);

    return NextResponse.json({
      data: {
        reply: finalResponse,
        language: lang,
        navigationTarget,
        actionResults,
      },
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
