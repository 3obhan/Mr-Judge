# پرامپت ساخت اپلیکیشن Mr Judge برای Google AI Studio

## مقدمه

یک اپلیکیشن وب/موبایل به نام **Mr Judge** بساز — یک پلتفرم حل اختلاف با هوش مصنوعی که اختلاف بین دو نفر را به‌صورت بی‌طرفانه تحلیل می‌کند و حکم صادر می‌نماید. اپ باید کاملاً دوزبانه (انگلیسی و فارسی) باشد و از RTL برای فارسی پشتیبانی کند.

---

## ۱. هدف اپلیکیشن

کاربر دو بیانیه (متن) وارد می‌کند — یکی برای «شخص الف» و یکی برای «شخص ب». هوش مصنوعی هر دو طرف را بر اساس معیارهای منطقی ارزیابی می‌کند، به هر طرف امتیاز ۰ تا ۱۰۰ می‌دهد، حکم نهایی صادر می‌کند و توضیح تحلیلی ارائه می‌دهد.

---

## ۲. سیستم احراز هویت

- استفاده از اپ فقط برای کاربران **لاگین‌شده** ممکن است.
- اگر کاربر لاگین نکرده، به صفحه ورود هدایت شود.
- روش ورود: ایمیل/رمز عبور + Google Sign-In.
- هنگام اولین ورود (یا ثبت‌نام)، به کاربر **۲ کردیت رایگان** داده شود.
- هر بار تحلیل اختلاف، ۱ کردیت کسرت می‌شود.
- اگر کردیت صفر باشد، دکمه تحلیل غیرفعال و پیام خرید کردیت نمایش داده شود.

---

## ۳. سیستم کردیت با Google Play Billing

### موجودی کردیت
- هر کاربر یک رکورد کردیت دارد با فیلدهای:
  - `user_email` (کلید)
  - `remaining_credits` (پیش‌فرض ۲)
  - `total_purchased` (پیش‌فرض ۰)

### خرید کردیت از Google Play
- از **Google Play Billing Library** برای خرید درون‌برنامه‌ای استفاده کن.
- محصولاتی که در Google Play Console تعریف می‌شوند:
  - `credits_5` — ۵ کردیت (مثلاً ۰.۹۹ دلار)
  - `credits_20` — ۲۰ کردیت (مثلاً ۲.۹۹ دلار)
  - `credits_50` — ۵۰ کردیت (مثلاً ۵.۹۹ دلار)
- پس از تأیید خرید:
  ۱. خرید را با `acknowledgePurchase` تأیید کن.
  ۲. `remaining_credits` را به‌اندازه خرید اضافه کن.
  ۳. `total_purchased` را به‌اندازه خرید اضافه کن.
  ۴. تراکنش را در جدول `transactions` ذخیره کن.
- از `PurchasesUpdatedListener` برای دریافت رویداد خرید استفاده کن.
- از `BillingClient` با `enablePendingPurchases()` استفاده کن.
- خریدهای مصرفی (consumable) هستند — پس از تأیید، `consumeAsync` فراخوانی کن تا کاربر بتواند دوباره بخرد.

### جریان خرید
```
کاربر روی «خرید کردیت» کلیک می‌کند
  → BillingClient.launchBillingFlow(productDetails)
  → onPurchasesUpdated دریافت می‌شود
  → تأیید خرید (acknowledgePurchase)
  → به‌روزرسانی موجودی در دیتابیس
  → نمایش پیام موفقیت + به‌روزرسانی UI
```

---

## ۴. تحلیل اختلاف با هوش مصنوعی

### پرامپت انگلیسی
```
You are Judge, an AI dispute resolution system. Analyze the following dispute between two parties.

EVALUATION CRITERIA:
1. Logical Consistency: How coherent and logical is each party's argument?
2. Responsibility: Who bears more responsibility for the situation?
3. Proportionality: Are reactions and expectations proportional to the situation?
4. Clarity of Expectations: Were expectations clearly communicated?

RULES:
- Be completely neutral and analytical
- Do NOT make moral judgments
- Do NOT give advice
- Do NOT use psychology
- Focus only on facts and logic
- This works for ANY type of dispute (business, personal, legal, etc.)

PERSON A's STATEMENT:
{personA_statement}

PERSON B's STATEMENT:
{personB_statement}

Analyze this dispute and provide your verdict.
```

### پرامپت فارسی
```
شما داور هستید، یک سیستم حل اختلاف با هوش مصنوعی. اختلاف زیر را بین دو طرف تحلیل کنید.

معیارهای ارزیابی:
۱. سازگاری منطقی: استدلال هر طرف چقدر منسجم و منطقی است؟
۲. مسئولیت: چه کسی مسئولیت بیشتری در قبال وضعیت دارد؟
۳. تناسب: آیا واکنش‌ها و انتظارات متناسب با وضعیت است؟
۴. وضوح انتظارات: آیا انتظارات به وضوح بیان شده بود؟

قوانین:
- کاملاً بی‌طرف و تحلیلی باشید
- قضاوت اخلاقی نکنید
- نصیحت ندهید
- از روانشناسی استفاده نکنید
- فقط روی حقایق و منطق تمرکز کنید

بیانیه شخص الف:
{personA_statement}

بیانیه شخص ب:
{personB_statement}

این اختلاف را تحلیل کنید و حکم خود را ارائه دهید.
```

### خروجی مورد انتظار (JSON)
```json
{
  "personA_score": 0-100,
  "personB_score": 0-100,
  "verdict": "Person A is more justified | Person B is more justified | Both parties are partially justified | Neither party is justified",
  "explanation": "Concise, neutral, analytical explanation in max 6 sentences"
}
```

### مدل پیشنهادی
- از Gemini API استفاده کن (`gemini-2.0-flash` یا `gemini-1.5-pro`).
- پاسخ را با `responseMimeType: "application/json"` و `responseSchema` دریافت کن.

---

## ۵. ورودی صوتی (Voice-to-Text)

### انگلیسی
- از **Web Speech API** (`SpeechRecognition`) استفاده کن.
- `continuous: true`, `interimResults: true`, `lang: 'en-US'`.
- متن تشخیص‌داده‌شده به textarea اضافه شود (نه جایگزین).

### فارسی
- مرورگرها برای `fa-IR` از Web Speech API پشتیبانی نمی‌کنند.
- از **MediaRecorder** برای ضبط صدا استفاده کن.
- فایل صوتی را به سرور بفرست و با **Whisper API** (یا Google Speech-to-Text) به متن تبدیل کن.
- فرمت‌های پشتیبانی‌شده: webm, mp4, ogg, wav.
- حداقل مدت ضبط: ۱ ثانیه.
- متن تشخیص‌داده‌شده به textarea اضافه شود.

### دکمه صوتی
- دکمه با آیکن میکروفون.
- هنگام ضبط: قرمز با انیمیشن پالس و متن «در حال ضبط...».
- هنگام تبدیل: نمایش «در حال تبدیل...» با اسپینر.
- پیام خطا به زبان انتخاب‌شده نمایش داده شود.

---

## ۶. صفحات اپلیکیشن

### صفحه خانه (Home)
- لوگوی Mr Judge (ترازوی دادگستری، سبک مینیمال لوکس، رنگ سرمه‌ای و طلایی).
- تگ‌لاین: «Resolve disputes with intelligent, unbiased AI analysis».
- دکمه CTA: «Begin Resolution».
- سه ویژگی: AI-Powered Analysis, Neutral & Unbiased, Detailed Verdict.
- اگر کاربر لاگین است: نوار بالا با نمایش تعداد کردیت.
- انیمیشن‌های ورود با Framer Motion (یا معادل).

### صفحه اختلاف جدید (NewDispute)
- انتخاب زبان (انگلیسی/فارسی) — پیش‌فرض انگلیسی.
- دو textarea برای بیانیه شخص الف و شخص ب.
- دکمه صوتی کنار هر textarea.
- اگر کردیت صفر: پیام هشدار + دکمه «Buy Credits».
- دکمه «Analyze Dispute» — اگر کردیت صفر غیرفعال.
- overlay لودینگ هنگام تحلیل: «Analyzing Dispute — Judge is evaluating both perspectives...».
- برای فارسی: کل صفحه RTL شود.

### صفحه نتایج (Results)
- نمایش امتیاز هر طرف با گیج بصری.
- نمایش حکم نهایی.
- نمایش توضیح تحلیلی.
- دکمه «New Dispute» و «Download Results» (PDF).

### صفحه کردیت (Credits)
- نمایش موجودی فعلی.
- سه پلن خرید: ۵ / ۲۰ / ۵۰ کردیت.
- دکمه خرید با Google Play Billing.
- تاریخچه تراکنش‌ها.

---

## ۷. طراحی بصری

### پالت رنگ
- پس‌زمینه: گرادیان از `slate-50` به `white`.
- متن اصلی: `slate-800` (`#1e293b`).
- متن فرعی: `slate-500`.
- رنگ تأکید/طلایی: `#d4af37`.
- دکمه اصلی: `slate-800` با hover `slate-700`.
- خطا: `red-500`.
- هشدار: `amber-50` با border `amber-200`.

### تایپوگرافی
- فونت: Inter (یا system font).
- عنوان‌ها: font-medium تا font-semibold.
- بدنه: font-light تا font-normal.

### کامپوننت‌ها
- کارت‌ها: `rounded-lg` با `border` و `shadow-sm`.
- دکمه‌ها: `rounded-md` با سایه نرم.
- textarea: `rounded-md` با focus ring.
- انیمیشن: نرم و کوتاه (۳۰۰-۶۰۰ms).

### واکنش‌گرا
- موبایل: تک‌ستونه، فاصله مناسب.
- دسکتاپ: حداکثر عرض `max-w-4xl` یا `max-w-6xl` با `mx-auto`.

---

## ۸. دیتابیس (Schema)

### جدول users
- از سیستم احراز هویت خودی استفاده کن (Firebase Auth یا Google Identity).

### جدول credits
| فیلد | نوع | پیش‌فرض |
|------|------|---------|
| id | string (uuid) | auto |
| user_email | string (unique) | — |
| remaining_credits | number | 2 |
| total_purchased | number | 0 |
| created_at | timestamp | auto |
| updated_at | timestamp | auto |

### جدول disputes
| فیلد | نوع | پیش‌فرض |
|------|------|---------|
| id | string (uuid) | auto |
| user_email | string | — |
| personA_statement | text | — |
| personB_statement | text | — |
| personA_score | number | — |
| personB_score | number | — |
| verdict | string | — |
| explanation | text | — |
| language | enum (en/fa) | en |
| status | enum (pending/analyzed) | pending |
| created_at | timestamp | auto |

### جدول transactions
| فیلد | نوع |
|------|------|
| id | string (uuid) |
| user_email | string |
| product_id | string |
| purchase_token | string |
| credits_added | number |
| amount | number |
| status | string |
| created_at | timestamp |

---

## ۹. استک فنی پیشنهادی

- **فرانت‌اند**: React + Tailwind CSS + Framer Motion
- **بک‌اند**: Firebase (Auth + Firestore) یا Supabase
- **هوش مصنوعی**: Google Gemini API
- **صوت فارسی**: OpenAI Whisper API یا Google Speech-to-Text
- **خرید درون‌برنامه‌ای**: Google Play Billing Library (نسخه ۶+)
- **پلتفرم موبایل**: Capacitor یا React Native برای بیلد APK/AAB

---

## ۱۰. جریان کامل کاربر

```
۱. کاربر اپ را باز می‌کند
۲. اگر لاگین نیست → صفحه ورود
۳. پس از ورود → ۲ کردیت رایگان (اگر کاربر جدید)
۴. صفحه خانه با دکمه «Begin Resolution»
۵. کلیک → صفحه اختلاف جدید
۶. انتخاب زبان + وارد کردن دو بیانیه (متن یا صدا)
۷. کلیک «Analyze» → ۱ کردیت کسرت → فراخوانی AI
۸. نمایش نتایج (امتیاز + حکم + توضیح)
۹. اگر کردیت تمام شد → صفحه خرید → Google Play
۱۰. خرید → کردیت اضافه می‌شود → بازگشت به اپ
```

---

## ۱۱. نکات مهم

- **بی‌طرفی مطلق**: قاضی هرگز قضاوت اخلاقی نمی‌کند، فقط تحلیل منطقی.
- **حریم خصوصی**: بیانیه‌ها فقط برای صاحب اختلاف قابل مشاهده است (Row-Level Security).
- **RTL**: وقتی زبان فارسی انتخاب شد، کل layout به RTL تبدیل شود.
- **انیمیشن**: ورود نرم و حرفه‌ای، بدون اغراق.
- **مدیریت خطا**: پیام خطا به زبان کاربر، کوتاه و واضح.
- **آفلاین**: اگر اینترنت قطع باشد، پیام مناسب نمایش داده شود.
- **اعتبارسنجی**: هر دو بیانیه باید حداقل ۱۰ کاراکتر باشند قبل از فعال شدن دکمه تحلیل.

---

## ۱۲. دستورالعمل نهایی برای Google AI Studio

این اپلیکیشن را با تمام صفحات بالا، سیستم کردیت با Google Play Billing، احراز هویت، تحلیل AI با Gemini، ورودی صوتی دوزبانه، و طراحی لوکس مینیمال بساز. کد را تمیز و ماژولار نگه دار — هر کامپوننت در فایل جدا. از Tailwind CSS برای استایل و Framer Motion برای انیمیشن استفاده کن. اپ باید کاملاً واکنش‌گرا (موبایل و دسکتاپ) و دوزبانه (انگلیسی/فارسی با RTL) باشد.
