import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Phrases tuned for high-recall crisis screening. Word boundaries prevent
// false positives like "suicide prevention" matching benign discussion.
const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid(e|al)\b/i,
  /\bkill(ing)?\s+myself\b/i,
  /\b(end|ending|take)\s+my\s+(own\s+)?life\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\bi\s+want\s+to\s+die\b/i,
  /\b(self[\s-]?harm|cutting\s+myself|hurt(ing)?\s+myself)\b/i,
  /\bno\s+reason\s+to\s+(live|go on)\b/i,
  /\b(better\s+off|everyone.+better)\s+(without|dead)\b/i,
  /\bcan'?t\s+(go on|do this anymore|take it anymore)\b/i,
  /\b(overdose|jump off|hang myself)\b/i,
];

function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

export const analyzeCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ entry: z.string().min(3).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const entry = data.entry.trim();
    const isCrisis = detectCrisis(entry);

    if (isCrisis) {
      // SAFETY: skip AI task generation entirely. Crisis check-ins must not
      // be reduced to "micro-actions" — surface human help instead.
      const { data: row, error } = await supabase
        .from("checkins")
        .insert({
          user_id: userId,
          entry_text: entry,
          is_crisis: true,
          primary_emotion: "distress",
          ai_summary: "What you shared sounds really heavy, and we don't want you to face it alone.",
          ai_insight: "A trained human is better equipped than Reflex for this moment. The resources below are free, confidential, and available right now.",
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { checkin: row, tasks: [], crisis: true as const };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const { data: recent } = await supabase
      .from("checkins")
      .select("created_at, primary_emotion, stress_level, entry_text")
      .order("created_at", { ascending: false })
      .limit(5);

    const history = (recent ?? [])
      .map((c) => `- ${new Date(c.created_at).toLocaleDateString()}: ${c.primary_emotion ?? "?"} (stress ${c.stress_level ?? "?"}) — "${c.entry_text.slice(0, 120)}"`)
      .join("\n") || "(no prior check-ins)";

    const { generateText, Output } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");

    const AnalysisSchema = z.object({
      primary_emotion: z.string(),
      stress_level: z.number().min(1).max(10),
      energy_level: z.number().min(1).max(10),
      confidence_level: z.number().min(1).max(10),
      triggers: z.array(z.string()).max(5),
      summary: z.string(),
      insight: z.string(),
      micro_tasks: z.array(z.object({
        title: z.string(),
        description: z.string(),
        category: z.enum(["physical", "cognitive", "social", "productivity"]),
        duration_minutes: z.number().min(1).max(15),
      })).min(3).max(5),
    });

    const gateway = createLovableAiGatewayProvider(apiKey);
    const prompt = `You are Reflex, an emotional fitness companion. You are NOT a therapist. Help the user notice patterns and take small, doable actions.

Recent check-ins:
${history}

Today the user wrote:
"""${entry}"""

Return a JSON analysis of their state and 3-5 micro-tasks (under 15 min each) tailored to how they feel right now. Vary the tasks across physical, cognitive, social and productivity. Tone: warm, grounded, action-oriented. The "summary" should reflect back what they shared in one sentence. The "insight" should name a pattern or context worth noticing.`;

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
