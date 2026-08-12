# Cameron Learning Center — email tekshiruvisiz signup

Ilova email/parol bilan ro‘yxatdan o‘tgan foydalanuvchini darhol tizimga
kiritadi; OTP yoki email tasdiqlash kodi ishlatilmaydi.

Hosted Supabase loyihasida quyidagilarni sozlang:

1. `Authentication` → `Providers` → `Email` bo‘limiga o‘ting.
2. **Allow new users to sign up** yoqilgan bo‘lsin.
3. **Confirm email** sozlamasini o‘chiring.

Mahalliy Supabase konfiguratsiyasida ham `[auth.email]` ostidagi
`enable_confirmations = false` qiymati shu oqimga mos keladi.

Email tasdiqlash o‘chirilganda kiritilgan email manzilining egasi
tasdiqlanmaydi. Shu sababli public loyiha uchun rate limit va CAPTCHA kabi
himoyalarni alohida ko‘rib chiqing.
