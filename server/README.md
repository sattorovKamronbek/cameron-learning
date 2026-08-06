Server README

This folder contains an Express + Prisma backend implementing authentication (register, login, logout, refresh), email verification, RBAC, and admin management.

Setup
1. Copy .env.example to .env and fill database, redis, jwt secrets and email provider keys.
2. Install dependencies: npm install
3. Generate Prisma client: npm run prisma:generate
4. Run migrations: npm run prisma:migrate
5. Start server in dev: npm run dev

Notes
- Admin allowlist is stored in AdminAllowlist table. Seed emails in DB or via ADMIN_BOOTSTRAP_EMAILS env at setup.
- Email sending uses SMTP if SMTP_* env vars are set; in dev emails are printed to console.
- Judge worker: a background judge worker is included (server/src/worker/judgeWorker.ts). It polls Redis key "judge:queue" for jobs and runs submissions inside Docker containers (gcc/openjdk/python images). In production, run the worker as a separate service for scalability and security.
- Learning Management System (LMS): Course and lesson models, quizzes, assignments, progress tracking, enrollments, categories and learning paths are implemented in the Prisma schema. Controllers and routes are available under server/src/controllers and server/src/routes (courses, progress, lesson). Admins and instructors can manage courses; students can enroll and track progress.
- Security: Added global request sanitization, rate limiting, and CSRF package included. Secure password hashing uses bcrypt. Use HTTPS and strong secrets in production.
- Notifications: Persistent notifications stored in DB (Notification model). Realtime delivery via Redis pub/sub and a Server-Sent Events endpoint at /api/notifications/subscribe. Email delivery via configured SMTP is supported.
- Analytics: Platform analytics endpoints are available at /api/analytics/* and use Redis caching for expensive queries.
