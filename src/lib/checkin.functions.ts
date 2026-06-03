import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";

const CRISIS_KEYWORDS = [
  "suicide", "suicidal", "kill myself", "end my life", "want to die",
  "self harm", "self-harm", "hurt myself", "no reason to live",
];

const AnalysisSchema = z.object({
  primary_emotion: z.string().describe("Single word: stress, anxiety, joy, sadness, frustration, calm, motivated, etc"),
  stress_level: z.number().min(1).max(10),
  energy_level: z.number().min(1).max(10),
  confidence_level: z.number().min(1).max(10),
  triggers: z.array(z.string()).max(5),
  summary: z.string().describe("One warm, validating sentence reflecting back what the user shared"),
  insight: z.string().describe("One observation about a pattern or context worth noticing"),
  micro_tasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(["physical", "cognitive", "social", "productivity"]),
    duration_minutes: z.number().min(1).max(15),
  })).min(3).max(5).describe("Actionable micro-tasks under 15 min each, tailored to current emotional state"),
});

export const analyzeCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ entry: z.string().min(3).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const entry = data.entry.trim();

    // Crisis detection (rule-based first pass)
    const lower = entry.toLowerCase();
    const isCrisis = CRISIS_KEYWORDS.some((k) => lower.includes(k));

    if (isCrisis) {
      const { data: row, error } = await supabase
        .from("checkins")
        .insert({
          user_id: userId,
          entry_text: entry,
          is_crisis: true,
          ai_summary: "We noticed something serious in what you shared.",
          ai_insight: "Please reach out to a trained professional who can support you right now.",
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { checkin: row, tasks: [], crisis: true as const };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    // Pull recent context
    const { data: recent } = await supabase
      .from("checkins")
      .select("created_at, primary_emotion, stress_level, entry_text")
      .order("created_at", { ascending: false })
      .limit(5);

    const history = (recent ?? [])
      .map((c) => `- ${new Date(c.created_at).toLocaleDateString()}: ${c.primary_emotion ?? "?"} (stress ${c.stress_level ?? "?"}) — "${c.entry_text.slice(0, 120)}"`)
      .join("\n") || "(no prior check-ins)";

    const gateway = createLovableAiGatewayProvider(apiKey);

    const prompt = `You are Reflex, an emotional fitness companion. NOT a therapist. Help the user notice patterns and take small actions.

Recent check-ins:
${history}

Today the user wrote:
"""${entry}"""

Analyze their emotional state and generate 3-5 micro-tasks (each under 15 minutes) that fit how they feel right now. Tasks should be practical and varied across physical, cognitive, social, and productivity categories. Be warm but action-oriented.`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: AnalysisSchema }),
      prompt,
    });

    const analysis = experimental_output;

    const { data: checkin, error: cErr } = await supabase
      .from("checkins")
      .insert({
        user_id: userId,
        entry_text: entry,
        primary_emotion: analysis.primary_emotion,
        stress_level: analysis.stress_level,
        energy_level: analysis.energy_level,
        confidence_level: analysis.confidence_level,
        triggers: analysis.triggers,
        ai_summary: analysis.summary,
        ai_insight: analysis.insight,
      })
      .select()
      .single();
    if (cErr) throw new Error(cErr.message);

    const taskRows = analysis.micro_tasks.map((t) => ({
      checkin_id: checkin.id,
      user_id: userId,
      title: t.title,
      description: t.description,
      category: t.category,
      duration_minutes: t.duration_minutes,
    }));

    const { data: tasks, error: tErr } = await supabase
      .from("microtasks")
      .insert(taskRows)
      .select();
    if (tErr) throw new Error(tErr.message);

    return { checkin, tasks: tasks ?? [], crisis: false as const };
  });

function createLovableAiGatewayProvider(key: string) {
  // dynamic import keeps server-only module isolated from client bundle
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createLovableAiGatewayProvider: f } = require("./ai-gateway.server");
  return f(key);
}
