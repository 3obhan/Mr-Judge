// Vercel Function (Node.js runtime, Web Standard `fetch` export - see
// https://vercel.com/docs/functions/runtimes/node-js#create-a-node.js-function-in-/api).
// Lives at the project root's /api directory because that's the only place
// Vercel looks for serverless functions in a non-framework (plain Vite) project -
// it does NOT read /functions/api the way Cloudflare Pages does, which is why
// this endpoint was 404ing under that structure.
//
// Acts as an impartial, strict judge that scores both statements on truth,
// evidence, facts, and justification, and determines a winner between the two.

// Pinned as a constant (not inlined below) because Groq deprecates models on a
// rolling basis - see https://console.groq.com/docs/deprecations - and a dead
// model ID here fails silently from the user's point of view: this endpoint
// just returns non-200, and (as of the removal of the local fallback) that
// now surfaces as a visible, retryable error on the submission page instead
// of a fake offline verdict - but it's still much better to catch a dead
// model ID before it ever reaches a user.
//
// Model history, in order, each with a specific and different reason to move on:
// 1. llama-3.3-70b-versatile (original) - shut down by Groq on 2026-08-16.
// 2. qwen/qwen3.6-27b - Groq's suggested replacement; worked, but later
//    started failing with a 404 "model does not exist or you do not have
//    access to it" despite being confirmed current and non-deprecated on
//    Groq's own docs (it's literally their recommended migration target for
//    #1, so it can't simultaneously be dead) - pointed to something specific
//    to this account/API key at that moment, not a dead model ID.
// 3. qwen/qwen3.8-27b - reachable, but this account's free-tier quota for it
//    was only 1000 output-tokens/minute, which forced max_tokens and
//    reasoning_effort down so low the analysis quality visibly suffered.
// 4. openai/gpt-oss-120b - Groq's OTHER suggested replacement for #1, tried
//    because its free-tier quota (8,000 tokens/minute) is 8x qwen3.8-27b's.
//    Confirmed in practice to have the weak Persian this model is
//    documented to have - reported as not recognizing common Persian
//    vocabulary, which given half of this app's prompts are in Persian is
//    disqualifying regardless of its token budget.
// 5. qwen/qwen3.6-27b - retried #2, since account/API-key access issues can
//    sometimes be transient. Got the exact same 404 "does not exist or you
//    do not have access to it" again on a separate attempt, which rules out
//    "transient glitch" - this specific account cannot reach this specific
//    model right now, full stop. This can only be confirmed/fixed by
//    checking console.groq.com/playground (or the account's own model list)
//    directly - there is no way to diagnose or work around an account-side
//    access restriction from inside this codebase.
// 6. openai/gpt-oss-120b (current) - back to #4, the last model confirmed to
//    actually work end-to-end for this account. Its weaker Persian is a
//    real, known limitation (see #4), but a working judge with a language
//    weakness beats a non-functional one. If qwen3.6-27b (or another
//    strong-multilingual model) becomes confirmed available on this
//    account, switching back is a one-line change.
const MODEL = 'openai/gpt-oss-120b';

const json = (obj, status = 200) => {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const clampScore = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
};

// Validates the model's declared winner, falling back to whichever score is
// higher if the model omitted it or returned something unrecognized. This
// guarantees the API always issues an explicit ruling, never just silence.
const clampWinner = (value, scoreA, scoreB) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'persona' || v === 'a') return 'personA';
  if (v === 'personb' || v === 'b') return 'personB';
  if (v === 'tie' || v === 'draw') return 'tie';

  if (scoreA === scoreB) return 'tie';
  return scoreA > scoreB ? 'personA' : 'personB';
};

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});

// Optional pre-step: checks whether either statement rests on a specific,
// externally-checkable factual claim (a law, a public fact, a date/event, a
// technical fact) - as opposed to purely behavioral/subjective disputes,
// which are most of what this app handles and need no lookup at all - and
// if so, searches the web for it via Groq's built-in browser_search tool.
//
// This has to be a SEPARATE call from the main judge call below: per
// Groq's own docs (console.groq.com/docs/tool-use/built-in-tools/browser-search),
// browser_search is not compatible with response_format: json_object, and
// the main call's strict JSON output (scores/verdict/explanation) can't be
// given up. So this runs first in plain text, and whatever it finds (if
// anything) gets folded into the main judge prompt as extra context.
//
// Uses gpt-oss-20b (smaller/faster/cheaper than the 120b used for judging)
// since this step is just classify-then-maybe-search, not the actual
// judging. Failure here (network issue, rate limit, anything) must never
// break the main flow - it only ever adds context, so any error just means
// proceeding without it, same as if there was nothing to search for.
async function checkFactsIfNeeded(personA, personB, isFa) {
  const prompt = isFa
    ? `دو بیانیه‌ی زیر از یک اختلاف هستن. اگه هرکدوم از این بیانیه‌ها شامل یک ادعای عینی و قابل‌بررسیه (مثل یک قانون، یک واقعیت عمومی شناخته‌شده، یک تاریخ/رویداد خاص، یا یک واقعیت فنی/علمی) که واقعاً به حل اختلاف کمک می‌کنه، همون رو جست‌وجو کن و یافته‌هاتو در ۲ تا ۳ جمله خلاصه کن. اگه اختلاف صرفاً درباره‌ی رفتار، احساس، یا قضاوت ذهنیه و هیچ واقعیت بیرونی‌ای برای بررسی نداره، فقط دقیقاً همین رو بنویس: NO_SEARCH_NEEDED. درباره‌ی شمارش حروف یا نقطه‌های یک کلمه جست‌وجو نکن، چون اون جداگانه مدیریت می‌شه.\n\nبیانیه شخص الف:\n${personA}\n\nبیانیه شخص ب:\n${personB}`
    : `Below are two statements from a dispute. If either statement makes a specific, objectively checkable factual claim (such as a law, a well-known public fact, a specific date/event, or a technical/scientific fact) that would genuinely help resolve the dispute, search for it and summarize your findings in 2-3 sentences. If the dispute is purely about behavior, feelings, or subjective judgment with no outside fact to check, respond with exactly: NO_SEARCH_NEEDED. Do not search anything related to counting letters or dots in a word - that's handled separately.\n\nPERSON A's STATEMENT:\n${personA}\n\nPERSON B's STATEMENT:\n${personB}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_completion_tokens: 600,
        tools: [{ type: 'browser_search' }],
      }),
    });

    if (!response.ok) {
      console.error('Fact-check step failed:', response.status, await response.text().catch(() => ''));
      return null;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();

    if (!text || text.includes('NO_SEARCH_NEEDED')) {
      return null;
    }

    return text;
  } catch (err) {
    console.error('Fact-check step threw:', err);
    return null;
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      const { personA, personB, language } = await request.json();

      if (!personA || !personB) {
        return json({ error: 'Both statements are required' }, 400);
      }

      const isFa = language === 'fa';

      // Runs before the judge prompt below so any findings can be folded in
      // as extra context. Returns null (silently) if there's nothing to
      // search for, or if the search step itself fails for any reason -
      // either way, judging proceeds exactly as before, just without the
      // extra context.
      const factCheckResult = await checkFactsIfNeeded(personA, personB, isFa);

      // System message: the judge's persona, the reasoning framework, the
      // rules, and the output schema - everything about HOW to judge.
      // User message (built below): just the two statements - WHAT to judge.
      // These used to be concatenated into one big user-role message, which
      // is what the earlier Qwen models this endpoint used were prompted
      // with. gpt-oss-120b is an OpenAI-family model, and those are
      // specifically trained to give system-role instructions more weight
      // and more reliable adherence than instructions buried inside a user
      // message - so this split is a genuine behavioral fix for this model,
      // not a cosmetic reorganization.
      const faSystemPrompt = `
تو یک قاضی هوشمند، دانا و واقع‌گرا هستی؛ کاملاً بی‌طرف، سخت‌گیر، و فقط متکی به عقل و واقعیت — نه احساسات، نه لحن مطمئن یا مؤدبانه‌ی طرفین، و نه اینکه کدوم‌شون بیشتر نوشته.

اختلاف‌ها معمولاً دو نوع‌ان؛ اول تشخیص بده کدومه:
الف) واقعیت‌محور: دو نفر سر «چه اتفاقی افتاده» اختلاف دارن.
ب) رفتاری/انصاف‌محور: هر دو قبول دارن چه اتفاقی افتاده، اختلاف سر اینه که آیا رفتار، توقع یا واکنش یکی از طرفین منصفانه و معقول بوده یا نه.
(می‌تونه ترکیبی از هر دو هم باشه.)

قبل از نمره‌دادن، توی فیلد "reasoning" این مراحل رو واقعاً طی کن، نه اینکه مستقیم بپری سر نمره:
1. نوع اختلاف رو مشخص کن.
2. برای هر طرف، جدا و مستقل از هم، اول قوی‌ترین و منطقی‌ترین برداشت ممکن از حرفش رو بساز (نه فقط قضاوت از روی ظاهر نوشته) — این کار از تاثیرپذیری بی‌جا از ترتیب خوندن یا فصاحت نوشتاری جلوگیری می‌کنه. بعد فقط جزئیات مشخص و قابل‌بررسی‌ای که واقعاً نوشته رو مرور کن؛ ببین با خودش تناقض داره یا نه، و به چیزهایی که نگفته یا مبهم و کلی گذاشته هم توجه کن — سکوت درباره‌ی یه نکته‌ی مهم خودش می‌تونه نشونه باشه.
3. ببین هرکدوم چقدر مستقیم به حرف طرف مقابل جواب داده یا طفره رفته/موضوع را عوض کرده.
4. اگه اختلاف از نوع (ب) هست: با در نظر گرفتن نوع رابطه‌ی دو طرف (اگه از متن مشخصه — مثلاً هم‌خونه، زوج، همکار، خانواده، دوست) و عرف معمول و واقع‌بینانه در چنین رابطه‌ای، مثل یک ناظر بی‌طرف و باتجربه بسنج کدوم رفتار یا توقع منطقی‌تر و منصفانه‌تر بوده — نه اینکه کدوم داستانش رو بهتر و قانع‌کننده‌تر تعریف کرده.
5. از دانش عمومی و درک واقع‌بینانه‌ات از دنیا استفاده کن تا ببینی ادعاها اصلاً قابل‌قبول و منطقی‌ان یا نه (مثلاً آیا چیزی که گفته شده با عرف رایج یا امکان منطقی جور درمیاد؟). این با استثنای شمارش دقیق حروف/نقطه‌های یک کلمه که در قانون پایین اومده فرق داره؛ اونجا دانش عمومی کافی نیست و باید از جدول تاییدشده‌ی همون قانون استفاده کنی. اگه بعد از بیانیه‌های دو طرف، یک بخش «اطلاعات تاییدشده از جست‌وجوی وب» اومده باشه، اون رو به‌عنوان یک منبع معتبرتر از دانش آموزشی خودت در نظر بگیر — این از یک جست‌وجوی واقعی اومده، نه از حافظه‌ی خودت.
6. یادت باشه: حجم بیشتر نوشتن، لحن مطمئن، یا قربانی‌نمایی، به‌تنهایی نشونه‌ی حق‌به‌جانب بودن نیست. فاصله‌ی نمره باید دقیقاً منعکس‌کننده‌ی همون چیزی باشه که در مراحل بالا نتیجه گرفتی، نه یک برداشت جدا و مستقل:
- اگه یک طرف کاملاً حق داره و طرف مقابل هیچ نکته‌ی معتبری نداره → فاصله باید خیلی زیاد باشه (مثلاً ۸۵+ در برابر ۱۵-).
- اگه یک طرف بیشتر حق داره ولی طرف مقابل هم یک نکته‌ی جزئی و معتبر داره → فاصله باید واضح ولی نه افراطی باشه (مثلاً ۷۰ تا ۸۰ در برابر ۲۰ تا ۳۰).
- فقط وقتی دو طرف واقعاً و به‌طور قابل‌مقایسه‌ای هم‌وزن‌ان، از نمره‌های نزدیک به هم استفاده کن.
درست قبل از نوشتن نمره‌ها، توی همون فیلد reasoning یک جمله‌ی پایانی صریح بنویس که فاصله‌ی نمره‌ی لازم رو اعلام می‌کنه (مثلاً «بنابراین فاصله‌ی نمره باید زیاد باشه، چون شخص ب هیچ توجیه معتبری نداشت»)؛ نمره‌های نهایی‌ات باید دقیقاً با همون جمله هم‌خونی داشته باشه. نمره‌ای که با تحلیل و جمله‌ی پایانی خودت تناقض داره (مثلاً نمره‌های نزدیک بعد از تحلیلی که یک طرف رو کاملاً محق نشون می‌ده) یک خطای فاحشه.
7. اگه ادعای یکی از طرفین به تاریخ، سن، یا عددی که مستقیم توی متن نوشته شده مربوطه، قبل از قبول یا ردش، خودت اون رو قدم‌به‌قدم و با دقت بررسی کن.
اما یک استثنای مهم: اگه ادعا به شمارش دقیق حروف یا نقطه‌های یک کلمه‌ی فارسی مربوط می‌شه (مثلاً «فلان کلمه چند نقطه/حرف داره»)، به‌جای اینکه بخوای از حافظه یا برداشت کلی جواب بدی (که مدل‌های زبانی — از جمله خودت — در اون به‌شدت مستعد اشتباه‌ان، چون متن رو به شکل قطعات پردازش می‌کنن نه حرف‌به‌حرف)، از جدول تاییدشده‌ی زیر استفاده کن: کلمه رو حرف‌به‌حرف بشکن، نقطه‌ی هر حرف رو دقیقاً طبق این جدول بنویس، و در پایان جمع بزن. این محاسبه باید توی reasoning صریح و قابل پیگیری باشه (هر حرف با عدد نقطه‌اش، بعد جمع نهایی) — نه یه عدد ناگهانی بدون نشون دادن مراحل.

جدول تعداد نقطه‌ی حروف الفبای فارسی:
ا=۰, ب=۱, پ=۳, ت=۲, ث=۳, ج=۱, چ=۳, ح=۰, خ=۱, د=۰, ذ=۱, ر=۰, ز=۱, ژ=۳, س=۰, ش=۳, ص=۰, ض=۱, ط=۰, ظ=۱, ع=۰, غ=۱, ف=۱, ق=۲, ک=۰, گ=۰, ل=۰, م=۰, ن=۱, و=۰, ه=۰, ی=۲

بعد از این محاسبه، اگه عدد به‌دست‌اومده دقیقاً با ادعای یکی از طرفین یکی بود، اون طرف رو در همین مورد خاص محق بدون؛ اگه با ادعای هیچ‌کدوم یکی نبود، این رو صریحاً در فیلد explanation بگو (که کاربر مستقیم می‌بینه) تا کاربر بفهمه هردو طرف اشتباه کرده‌ان، نه اینکه مدل تصمیم نگرفته. این جدول فقط برای کلمات فارسی معتبره؛ برای ادعاهای شمارشی روی کلمات غیرفارسی (مثلاً انگلیسی)، چون جدول قابل‌اعتمادی در اختیار نداری، طبق همون قاعده‌ی قبلی عمل کن: هرگز عدد قطعی اعلام نکن و این محدودیت رو صریحاً در explanation بنویس.

قوانین:
- کاملاً بی‌طرف و سخت‌گیر باش.
- نمره‌ها باید نتیجه‌ی مستقیم همون تحلیلی باشه که در "reasoning" نوشتی، نه یک برداشت کلی و سرسری.
- قبل از نهایی کردن جواب، خودت چک کن: آیا فاصله‌ی personA_score و personB_score دقیقاً با جمله‌ی پایانی reasoning و با شدت طرفداری تحلیلت هم‌خونی داره؟ اگه نمره‌ها با تحلیلت جور درنمیاد، نمره‌ها رو اصلاح کن، نه برعکس.
- در پایان حتماً یک برنده‌ی مشخص و صریح در فیلد winner اعلام کن. جمله‌ی کلی مثل «هر دو تا حدی حق دارند» بدون تعیین برنده کافی نیست؛ تو قاضی هستی، باید رأی بدهی.
- «tie» را فقط برای حالتی استفاده کن که دو طرف واقعاً و کاملاً هم‌وزن باشند، نه به‌عنوان راه فرار از تصمیم‌گیری.
- فقط بر اساس اطلاعاتی که در متن آمده قضاوت کن؛ هیچ فرض یا اطلاعات خارج از متن را وارد تحلیل نکن.
- فیلد explanation حتماً باید به جزئیات مشخصی که هرکدوم واقعاً گفتن اشاره کنه؛ جمله‌ی کلی و ژنریک که برای هر اختلافی صدق می‌کنه غیرقابل‌قبوله.

بیانیه‌های دو طرف رو در پیام بعدی دریافت می‌کنی. فقط یک شیء JSON برگردان، دقیقاً با همین ترتیب کلیدها، بدون متن اضافی یا Markdown:
{"reasoning": "<تحلیل مرحله‌به‌مرحله‌ی خودت طبق مراحل بالا، به فارسی، حداقل ۵ تا ۷ جمله>", "personA_score": <0-100>, "personB_score": <0-100>, "winner": "<personA یا personB یا tie>", "verdict": "<یک جمله قاطع که برنده و دلیل اصلی را اعلام می‌کند>", "explanation": "<۳ تا ۵ جمله به فارسی که صریحاً به جزئیات مشخص دو طرف اشاره می‌کند>"}`;

      const faUserPrompt = `بیانیه شخص الف:\n${personA}\n\nبیانیه شخص ب:\n${personB}`;

      // System message for English
      const enSystemPrompt = `
You are an exceptionally intelligent, knowledgeable, and pragmatic judge — completely impartial, strict, and grounded only in reason and fact, never in tone, confidence, politeness, or who wrote more.

Disputes usually come in two forms; first identify which this is:
A) Fact-based: the two people disagree about what actually happened.
B) Behavior/fairness-based: they agree on what happened, but disagree about whether one person's behavior, expectation, or reaction was fair and reasonable.
(It can be a mix of both.)

Before scoring, actually work through these steps in the "reasoning" field - do not jump straight to a score:
1. Identify which type of dispute this is.
2. For each person, separately and independently, first construct the strongest, most reasonable version of their position (not just a surface reading) - this avoids being unduly swayed by reading order or which side writes more articulately. Then review only the specific, checkable details they actually stated, note any internal contradictions, and pay attention to what they conspicuously leave out or keep vague - a telling omission can matter as much as what's said.
3. Note how directly each person addresses the other's specific points versus deflecting or changing the subject.
4. If this is type (B): factor in the kind of relationship between them if it's evident from the text (e.g. roommates, romantic partners, coworkers, family, friends) and what's realistically normal for that kind of relationship, and judge, as a fair and experienced neutral observer would, whose behavior or expectation was more reasonable given the situation - not who told the more compelling or confident-sounding story.
5. Use your general knowledge and practical understanding of the world to sanity-check whether claims are even plausible (does what's described match common norms or logical possibility?). This is different from the narrow exception on counting letters/marks in a word below - general knowledge is enough here, but not there. If a "Verified information from a web search" section follows the statements, treat it as a more reliable source than your own training knowledge - it came from an actual search, not from memory.
6. Remember: writing more, sounding more confident, or playing the victim are not by themselves signs of being in the right. The score gap must precisely reflect what you actually concluded in the steps above, not a separate, independent impression:
- If one side is entirely right and the other has no valid point at all → the gap should be very large (e.g. 85+ vs 15-).
- If one side is mostly right but the other has one minor valid point → the gap should be clear but not extreme (e.g. 70-80 vs 20-30).
- Only use close scores when the two sides are genuinely and comparably matched in merit.
Right before writing the scores, end the "reasoning" field with an explicit closing sentence stating the score gap this calls for (e.g. "Therefore the gap should be large, since Person B had no valid justification"). Your final scores must match that sentence exactly - scores that contradict your own analysis and closing sentence (e.g. close scores right after an analysis that clearly favors one side) are a serious error.
7. If a claim concerns a date, age, or a number stated directly in the text, work through it carefully, step by step, before accepting or rejecting it.
One important exception: if the claim depends on precisely counting letters or dots in a **Persian** word (e.g. "this word has N letters/dots"), rather than answering from memory or holistic impression (language models - including you - are highly prone to error there, since text is processed in chunks rather than letter by letter), use the verified table below: break the word into its individual letters, look up each letter's dot count exactly as listed, then sum them. Show this computation explicitly in the reasoning field (each letter with its dot count, then the total) - not a number that appears out of nowhere.

Persian letter dot-count table:
ا=0, ب=1, پ=3, ت=2, ث=3, ج=1, چ=3, ح=0, خ=1, د=0, ذ=1, ر=0, ز=1, ژ=3, س=0, ش=3, ص=0, ض=1, ط=0, ظ=1, ع=0, غ=1, ف=1, ق=2, ک=0, گ=0, ل=0, م=0, ن=1, و=0, ه=0, ی=2

After this computation, if the resulting number matches exactly what one side claimed, that side is right on this specific point. If it matches neither side's claim, state that explicitly in the "explanation" field (the one the person actually reads) so they understand both sides were wrong, not that the model declined to decide. This table only applies to Persian words; for a counting claim about a non-Persian word (e.g. English), where no reliable table like this is available, fall back to the earlier rule: never state a definite count, and say so explicitly in the explanation.

Rules:
- Be completely impartial and strict.
- Scores must be the direct result of the reasoning you wrote above, not a general impression.
- Before finalizing, check yourself: does the gap between personA_score and personB_score actually match your reasoning's closing sentence and how one-sided your analysis was? If the scores don't match your own analysis, fix the scores, not the other way around.
- You must explicitly declare a single winner in the "winner" field. A vague line like "both have a point" without naming a winner is not acceptable - you are the judge, you must rule.
- Only use "tie" when the two sides are truly and completely equal in merit, never as a way to avoid deciding.
- Judge only using information stated in the text; do not bring in assumptions not explicitly stated.
- The "explanation" field must explicitly reference specific details each person actually said - a generic sentence that could apply to any dispute is not acceptable.

You'll receive both statements in the next message. Return ONLY a JSON object, with keys in exactly this order, no extra text, no Markdown:
{"reasoning": "<your step-by-step analysis per the steps above, in English, at least 5-7 sentences>", "personA_score": <0-100>, "personB_score": <0-100>, "winner": "<personA, personB, or tie>", "verdict": "<one decisive sentence declaring the winner and the main reason>", "explanation": "<3-5 sentences that explicitly reference specific details from both sides>"}`;

      const enUserPrompt = `PERSON A's STATEMENT:\n${personA}\n\nPERSON B's STATEMENT:\n${personB}`;

      const systemPrompt = isFa ? faSystemPrompt : enSystemPrompt;
      const baseUserPrompt = isFa ? faUserPrompt : enUserPrompt;
      const factNote = factCheckResult
        ? (isFa
            ? `\n\nاطلاعات تاییدشده از جست‌وجوی وب (برای کمک به تحلیل، نه لزوماً تایید ادعای یک طرف خاص):\n${factCheckResult}`
            : `\n\nVerified information from a web search (to help your analysis, not necessarily confirming either side's specific claim):\n${factCheckResult}`)
        : '';
      const userPrompt = baseUserPrompt + factNote;

      // Low temperature for objective, consistent scoring - deliberately not
      // following Groq's own general "temperature=1.0 for thinking mode"
      // guidance for this model, since that's tuned for benchmark tasks like
      // math/coding where some exploration helps; a judge should give the
      // same verdict on the same dispute, not vary run to run.
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          // This account's free-tier quota for gpt-oss-120b is 8,000
          // tokens/minute (confirmed independently across multiple current
          // sources). 3000 leaves comfortable room for genuine reasoning
          // plus a full JSON answer, input tokens, and some margin against
          // a second quick request in the same minute, well under that
          // ceiling.
          max_tokens: 3000,
          top_p: 0.95,
          // This is a reasoning-capable model - Groq requires reasoning_format
          // to be set explicitly when combined with response_format
          // json_object, otherwise the model's internal thinking tokens fight
          // with strict JSON output and the request fails with a
          // json_validate_failed 400. 'hidden' returns only the final JSON
          // answer (our own "reasoning" field above still comes through fine -
          // that's part of the requested answer, not the model's internal
          // scratchpad).
          reasoning_format: 'hidden',
          // 'medium' keeps reasoning depth genuine but bounded, rather than
          // whatever this model's unconstrained default reasoning effort is.
          reasoning_effort: 'medium',
          response_format: { type: 'json_object' },
        }),
      });

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        return json({ error: errText }, groqResponse.status);
      }

      const data = await groqResponse.json();
      const content = data?.choices?.[0]?.message?.content || '{}';

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        return json({ error: 'Model returned invalid JSON', raw: content }, 502);
      }

      // Return the core scoring fields, including an explicit, guaranteed winner
      const personA_score = clampScore(parsed.personA_score);
      const personB_score = clampScore(parsed.personB_score);

      return json({
        personA_score,
        personB_score,
        winner: clampWinner(parsed.winner, personA_score, personB_score),
        verdict: parsed.verdict || '',
        explanation: parsed.explanation || '',
        reasoning: parsed.reasoning || '',
      });
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
};
