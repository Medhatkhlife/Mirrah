# دليل الإعداد والنشر

كل خدمة اختيارية: المنصة تعمل بدونها بوضع تجريبي، وكل خدمة تضيفها تفعّل جزءاً حقيقياً. اتبع الترتيب.
ضع كل متغير في `.env.local` محلياً، وفي **Vercel ← Project ← Settings ← Environment Variables** للإنتاج.

## 1. النشر على Vercel (10 دقائق)

1. ادخل vercel.com بحساب GitHub، واضغط **Add New ← Project**، واختر المستودع **Mirrah**.
2. اترك الإعدادات الافتراضية (Next.js) واضغط **Deploy**.
3. ضع `APP_URL` بعنوان موقعك (مثل `https://mirrah.vercel.app`) و`OPS_PASSWORD` بكلمة مرور قوية، ثم أعد النشر.

> بدون Supabase تستخدم المنصة ملفاً محلياً، وهذا لا يعمل بشكل دائم على Vercel. الخطوة 2 ضرورية للإنتاج.

## 2. قاعدة البيانات: Supabase

1. أنشئ مشروعاً في supabase.com.
2. افتح **SQL Editor** وشغّل الملفات بالترتيب: `supabase/migrations/0001_init.sql` ثم `0002_access_tokens.sql` ثم `0003_agent_and_billing.sql`.
3. من **Project Settings ← API** انسخ: `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` (مفتاح سري، لا تضعه في أي كود يصل المتصفح).

## 3. الذكاء الاصطناعي: Claude API

1. من console.anthropic.com أنشئ مفتاحاً وضعه في `ANTHROPIC_API_KEY`.
2. ضع حداً شهرياً للإنفاق من **Billing ← Limits** قبل الإطلاق.
3. اختيارياً: `MIRRAH_MODEL_SMART` و`MIRRAH_MODEL_FAST` لتغيير النماذج.

## 4. الجدولة: Inngest

1. أنشئ حساباً في inngest.com، ومن Vercel Marketplace اربط Inngest بالمشروع (يضيف `INNGEST_EVENT_KEY` و`INNGEST_SIGNING_KEY` تلقائياً)، أو أضفهما يدوياً.
2. في لوحة Inngest أضف التطبيق بعنوان `https://<موقعك>/api/inngest`.
3. ستظهر ثلاث دوال: `schedule-probes` و`watch-probe` و`recurring-scans` (يومياً 9 صباحاً بتوقيت فلسطين).

## 5. البريد: Postmark

1. أنشئ Server في postmarkapp.com، ووثّق نطاقك (DKIM وReturn-Path).
2. `POSTMARK_SERVER_TOKEN` من **Server ← API Tokens**.
3. `MAIL_FROM`: مرسل رسائل المالكين، مثل `مِرآة <reports@نطاقك>`.
4. **قناة البريد للزبون السري:** أنشئ مرسلاً موثقاً لا يكشف مِرآة، وضعه في `MAIL_PROBE_FROM`. من **Inbound stream** انسخ عنوان الاستقبال إلى `POSTMARK_INBOUND_ADDRESS`، واختر قيمة سرية لـ `INBOUND_WEBHOOK_SECRET`، وضع رابط الـ webhook:
   `https://<موقعك>/api/inbound/email?secret=<INBOUND_WEBHOOK_SECRET>`

## 6. الدفع: Lemon Squeezy

> حسب علمي Stripe لا يقبل التجار المسجلين في فلسطين. Lemon Squeezy يعمل كتاجر مسجل (Merchant of Record) ويدفع لك. تحقق من شروطه الحالية لدولتك قبل البدء.

1. أنشئ متجراً وثلاثة منتجات اشتراك شهري: النبض، النبض + المدرّب، النظام الكامل.
2. انسخ رابط الشراء (Checkout link) لكل منتج إلى `LEMONSQUEEZY_CHECKOUT_PULSE` و`LEMONSQUEEZY_CHECKOUT_PULSE_COACH` و`LEMONSQUEEZY_CHECKOUT_FULL`.
3. من **Settings ← Webhooks** أضف `https://<موقعك>/api/billing/webhook`، واختر أحداث `subscription_created` و`subscription_updated` و`subscription_expired`، وضع كلمة السر نفسها في `LEMONSQUEEZY_WEBHOOK_SECRET`.

حتى يُفعّل الدفع، غيّر خطط الشركات يدوياً من `/dashboard`.

## 7. وكيل الرد: WhatsApp Cloud API

1. أنشئ تطبيقاً في developers.facebook.com بنوع Business، وأضف منتج WhatsApp.
2. أنشئ System User في Business Manager بصلاحية على أرقام العملاء، وانسخ رمزه الدائم إلى `WHATSAPP_ACCESS_TOKEN`.
3. `WHATSAPP_APP_SECRET` من **App Settings ← Basic**، واختر أي نص لـ `WHATSAPP_VERIFY_TOKEN`.
4. في **WhatsApp ← Configuration** ضع الـ webhook `https://<موقعك>/api/whatsapp` مع رمز التحقق نفسه، واشترك في حقل `messages`.
5. لكل عميل: يُضاف رقمه في حسابك (أو يمنحك صلاحية عليه)، ثم يُكتب **Phone number ID** في قسم وكيل الرد في لوحته.

راجع سياسات Meta للرسائل التجارية قبل التشغيل.

## 8. قبل أول عميل حقيقي

- [ ] مراجعة محامٍ لصفحتي `/privacy` و`/terms` واستبدال ما بين الأقواس [ ].
- [ ] جوال وشريحة مخصصان للزبون السري على واتساب (إرسال يدوي من `/ops`).
- [ ] فحص 10 شركات تعرف أصحابها بموافقتهم، ومراجعة كل تقرير بنفسك.
- [ ] التأكد من أن كل الخدمات خضراء في رأس صفحة `/ops`.
