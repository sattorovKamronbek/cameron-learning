# Cameron Learning Center — email orqali tasdiqlash kodi

Supabase Dashboard'da quyidagi sozlamalarni qo‘llang:

1. `Authentication` → `Providers` → `Email` ichida **Confirm email** yoqilgan bo‘lsin.
2. `Authentication` → `Email Templates` → **Confirm signup** shablonini quyidagicha yangilang.

Subject:

```text
Cameron Learning Center — ro‘yxatdan o‘tish kodi
```

Body (HTML):

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#172554">
  <h1 style="margin:0 0 16px;color:#1d4ed8">Cameron Learning Center</h1>
  <p>Ro‘yxatdan o‘tishni yakunlash uchun quyidagi tasdiqlash kodini kiriting:</p>
  <p style="margin:28px 0;padding:16px;background:#eff6ff;border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#1d4ed8">{{ .Token }}</p>
  <p>Bu kodni hech kim bilan ulashmang.</p>
  <p style="color:#64748b;font-size:14px">Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.</p>
</div>
```

`{{ .Token }}` Supabase yuboradigan 6 xonali bir martalik koddir. Ilova uni `verifyOtp` bilan tekshiradi.
