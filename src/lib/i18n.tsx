import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export const languages = [
  { code: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'ru', label: 'Русский', shortLabel: 'RU' },
  { code: 'uz', label: "O'zbek", shortLabel: 'UZ' },
] as const;

export type Language = (typeof languages)[number]['code'];

const translations: Record<Language, Record<string, string>> = {
  en: {
    'language.label': 'Language',
    'theme.label': 'Theme', 'theme.indigo': 'Indigo', 'theme.ocean': 'Ocean', 'theme.sunset': 'Sunset', 'theme.forest': 'Forest',
    'nav.dashboard': 'Dashboard', 'nav.learn': 'Learn', 'nav.compete': 'Compete', 'nav.community': 'Community', 'nav.insights': 'Insights', 'nav.more': 'More',
    'nav.signIn': 'Sign in', 'nav.getStarted': 'Get started', 'nav.toggleMenu': 'Toggle menu',
    'nav.myAccount': 'My account', 'nav.myDashboard': 'My dashboard', 'nav.myAnalytics': 'My analytics', 'nav.myBadges': 'My badges', 'nav.leaderboards': 'Leaderboards', 'nav.notifications': 'Notifications', 'nav.adminConsole': 'Admin console', 'nav.managePlan': 'Manage plan', 'nav.signOut': 'Sign out',
    'footer.title': 'Start learning today — for free.', 'footer.description': 'Join over 850,000 learners exploring programming and academic subjects at their own pace.', 'footer.createAccount': 'Create free account', 'footer.browseCourses': 'Browse courses', 'footer.about': 'Free, structured learning for programming and academic subjects. Built for curious minds.', 'footer.newsletter': 'Newsletter', 'footer.explore': 'Explore', 'footer.subjects': 'Subjects', 'footer.company': 'Company', 'footer.viewAll': 'View all', 'footer.rights': 'All rights reserved.', 'footer.privacy': 'Privacy Policy', 'footer.terms': 'Terms of Service', 'footer.cookies': 'Cookies',
    'footer.allCourses': 'All Courses', 'footer.learningRoadmaps': 'Learning Roadmaps', 'footer.resources': 'Articles & Resources', 'footer.pricing': 'Pricing Plans', 'footer.aboutUs': 'About Us', 'footer.mission': 'Our Mission', 'footer.instructors': 'Instructors', 'footer.contact': 'Contact',
    'home.eyebrow': '850,000+ learners and counting', 'home.titleStart': 'Learn programming &', 'home.titleHighlight': 'academic subjects', 'home.titleEnd': 'the clear way.', 'home.description': 'Structured courses, guided roadmaps, and curated resources — from your first line of code to university-level math and science. Free to start, no account required.', 'home.exploreCourses': 'Explore courses', 'home.learningPaths': 'See learning paths', 'home.noCard': 'No credit card required', 'home.freePreview': 'Free preview lessons', 'home.learnPace': 'Learn at your own pace',
  },
  ru: {
    'language.label': 'Язык',
    'theme.label': 'Тема', 'theme.indigo': 'Индиго', 'theme.ocean': 'Океан', 'theme.sunset': 'Закат', 'theme.forest': 'Лес',
    'nav.dashboard': 'Главная', 'nav.learn': 'Обучение', 'nav.compete': 'Соревнования', 'nav.community': 'Сообщество', 'nav.insights': 'Аналитика', 'nav.more': 'Ещё',
    'nav.signIn': 'Войти', 'nav.getStarted': 'Начать', 'nav.toggleMenu': 'Открыть меню',
    'nav.myAccount': 'Мой аккаунт', 'nav.myDashboard': 'Моя панель', 'nav.myAnalytics': 'Моя аналитика', 'nav.myBadges': 'Мои значки', 'nav.leaderboards': 'Рейтинги', 'nav.notifications': 'Уведомления', 'nav.adminConsole': 'Панель администратора', 'nav.managePlan': 'Управление тарифом', 'nav.signOut': 'Выйти',
    'footer.title': 'Начните учиться сегодня — бесплатно.', 'footer.description': 'Присоединяйтесь к более чем 850 000 учащихся, изучающих программирование и академические предметы в своём темпе.', 'footer.createAccount': 'Создать аккаунт', 'footer.browseCourses': 'Смотреть курсы', 'footer.about': 'Бесплатное структурированное обучение программированию и академическим предметам. Для любознательных людей.', 'footer.newsletter': 'Рассылка', 'footer.explore': 'Обзор', 'footer.subjects': 'Предметы', 'footer.company': 'О компании', 'footer.viewAll': 'Смотреть все', 'footer.rights': 'Все права защищены.', 'footer.privacy': 'Политика конфиденциальности', 'footer.terms': 'Условия использования', 'footer.cookies': 'Cookie-файлы',
    'footer.allCourses': 'Все курсы', 'footer.learningRoadmaps': 'Учебные планы', 'footer.resources': 'Статьи и ресурсы', 'footer.pricing': 'Тарифы', 'footer.aboutUs': 'О нас', 'footer.mission': 'Наша миссия', 'footer.instructors': 'Преподаватели', 'footer.contact': 'Контакты',
    'home.eyebrow': 'Более 850 000 учащихся', 'home.titleStart': 'Изучайте программирование и', 'home.titleHighlight': 'академические предметы', 'home.titleEnd': 'понятно и эффективно.', 'home.description': 'Структурированные курсы, учебные планы и полезные материалы — от первой строки кода до университетской математики и естественных наук. Начните бесплатно, регистрация не нужна.', 'home.exploreCourses': 'Смотреть курсы', 'home.learningPaths': 'Учебные планы', 'home.noCard': 'Карта не требуется', 'home.freePreview': 'Бесплатные пробные уроки', 'home.learnPace': 'Учитесь в своём темпе',
  },
  uz: {
    'language.label': 'Til',
    'theme.label': 'Mavzu', 'theme.indigo': 'Indigo', 'theme.ocean': 'Okean', 'theme.sunset': 'Quyosh botishi', 'theme.forest': "O'rmon",
    'nav.dashboard': 'Bosh sahifa', 'nav.learn': "O'rganish", 'nav.compete': 'Musobaqalar', 'nav.community': 'Hamjamiyat', 'nav.insights': 'Tahlillar', 'nav.more': 'Boshqa',
    'nav.signIn': 'Kirish', 'nav.getStarted': 'Boshlash', 'nav.toggleMenu': 'Menyuni ochish',
    'nav.myAccount': 'Mening hisobim', 'nav.myDashboard': 'Mening panelim', 'nav.myAnalytics': 'Mening tahlillarim', 'nav.myBadges': 'Mening nishonlarim', 'nav.leaderboards': 'Reytinglar', 'nav.notifications': 'Bildirishnomalar', 'nav.adminConsole': 'Admin paneli', 'nav.managePlan': 'Tarifni boshqarish', 'nav.signOut': 'Chiqish',
    'footer.title': "Bugunoq o'rganishni boshlang — bepul.", 'footer.description': "Dasturlash va akademik fanlarni o'z tezligida o'rganayotgan 850 000 dan ortiq foydalanuvchiga qo'shiling.", 'footer.createAccount': 'Bepul hisob yaratish', 'footer.browseCourses': "Kurslarni ko'rish", 'footer.about': "Dasturlash va akademik fanlar uchun bepul, tizimli ta'lim. Izlanuvchanlar uchun yaratilgan.", 'footer.newsletter': 'Yangiliklar xati', 'footer.explore': "Ko'rib chiqish", 'footer.subjects': 'Fanlar', 'footer.company': 'Kompaniya', 'footer.viewAll': 'Barchasini ko‘rish', 'footer.rights': 'Barcha huquqlar himoyalangan.', 'footer.privacy': 'Maxfiylik siyosati', 'footer.terms': 'Foydalanish shartlari', 'footer.cookies': 'Cookie-fayllar',
    'footer.allCourses': 'Barcha kurslar', 'footer.learningRoadmaps': "O'rganish yo'llari", 'footer.resources': 'Maqolalar va manbalar', 'footer.pricing': 'Tariflar', 'footer.aboutUs': 'Biz haqimizda', 'footer.mission': 'Bizning maqsadimiz', 'footer.instructors': "O'qituvchilar", 'footer.contact': 'Aloqa',
    'home.eyebrow': "850 000+ o'quvchi va soni ortmoqda", 'home.titleStart': 'Dasturlash va', 'home.titleHighlight': 'akademik fanlarni', 'home.titleEnd': "oson yo'l bilan o'rganing.", 'home.description': "Tizimli kurslar, yo'naltirilgan yo'l xaritalari va saralangan manbalar — birinchi qator kodingizdan universitet matematikasi va tabiiy fanlargacha. Bepul boshlang, hisob kerak emas.", 'home.exploreCourses': "Kurslarni ko'rish", 'home.learningPaths': "O'rganish yo'llari", 'home.noCard': 'Karta talab qilinmaydi', 'home.freePreview': 'Bepul sinov darslari', "home.learnPace": "O'z tezligingizda o'rganing",
  },
};

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): Language {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem('cameron-language') : null;
  return languages.some(({ code }) => code === saved) ? saved as Language : 'uz';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem('cameron-language', language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key: string) => translations[language][key] ?? translations.en[key] ?? key,
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
}
