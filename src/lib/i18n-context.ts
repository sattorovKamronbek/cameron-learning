import { createContext, useContext } from 'react';

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
    'nav.dashboard': 'Dashboard', 'nav.learn': 'Learn', 'nav.compete': 'Compete', 'nav.community': 'Platform status', 'nav.insights': 'Insights', 'nav.more': 'More',
    'nav.signIn': 'Sign in', 'nav.getStarted': 'Get started', 'nav.toggleMenu': 'Toggle menu',
    'nav.myAccount': 'My account', 'nav.myDashboard': 'My account', 'nav.myAnalytics': 'Contest analytics', 'nav.myBadges': 'Achievement status', 'nav.leaderboards': 'Leaderboards', 'nav.notifications': 'Notifications', 'nav.adminConsole': 'Admin console', 'nav.managePlan': 'Plan status', 'nav.signOut': 'Sign out',
    'footer.title': 'Explore the learning catalogue.', 'footer.description': 'Browse curated programming and academic course outlines, roadmaps, and resources.', 'footer.createAccount': 'Create free account', 'footer.browseCourses': 'Browse courses', 'footer.about': 'A curated catalogue of programming and academic course outlines, roadmaps, and resources.', 'footer.newsletter': 'Newsletter', 'footer.explore': 'Explore', 'footer.subjects': 'Subjects', 'footer.company': 'Company', 'footer.viewAll': 'View all', 'footer.rights': 'All rights reserved.', 'footer.privacy': 'Privacy Policy', 'footer.terms': 'Terms of Service', 'footer.cookies': 'Cookies',
    'footer.allCourses': 'All Courses', 'footer.learningRoadmaps': 'Learning Roadmaps', 'footer.resources': 'Articles & Resources', 'footer.pricing': 'Pricing Plans', 'footer.aboutUs': 'About Us', 'footer.mission': 'Our Mission', 'footer.instructors': 'Catalogue notes', 'footer.contact': 'Contact', 'footer.newsletterUnavailable': 'Email subscriptions are not available yet. Browse our latest resources instead.', 'footer.browseResources': 'Browse resources', 'footer.legalUnavailable': 'Privacy, terms, and cookie information are not published yet.', 'footer.legalContact': 'Contact us with a privacy or terms question',
    'home.eyebrow': 'Curated learning catalogue', 'home.titleStart': 'Explore programming &', 'home.titleHighlight': 'academic subjects', 'home.titleEnd': 'with clear next steps.', 'home.description': 'Browse curated course outlines, roadmaps, and resources — from coding foundations to mathematics and science. Catalogue browsing does not require an account.', 'home.exploreCourses': 'Explore courses', 'home.learningPaths': 'See learning paths', 'home.noCard': 'Browse without an account', 'home.freePreview': 'Course outlines available', 'home.learnPace': 'Guided roadmaps',
  },
  ru: {
    'language.label': 'Язык',
    'theme.label': 'Тема', 'theme.indigo': 'Индиго', 'theme.ocean': 'Океан', 'theme.sunset': 'Закат', 'theme.forest': 'Лес',
    'nav.dashboard': 'Главная', 'nav.learn': 'Обучение', 'nav.compete': 'Соревнования', 'nav.community': 'Статус платформы', 'nav.insights': 'Аналитика', 'nav.more': 'Ещё',
    'nav.signIn': 'Войти', 'nav.getStarted': 'Начать', 'nav.toggleMenu': 'Открыть меню',
    'nav.myAccount': 'Мой аккаунт', 'nav.myDashboard': 'Мой аккаунт', 'nav.myAnalytics': 'Аналитика соревнований', 'nav.myBadges': 'Статус достижений', 'nav.leaderboards': 'Рейтинги', 'nav.notifications': 'Уведомления', 'nav.adminConsole': 'Панель администратора', 'nav.managePlan': 'Статус тарифа', 'nav.signOut': 'Выйти',
    'footer.title': 'Изучайте каталог материалов.', 'footer.description': 'Просматривайте подобранные программы, учебные планы и материалы по программированию и академическим предметам.', 'footer.createAccount': 'Создать аккаунт', 'footer.browseCourses': 'Смотреть курсы', 'footer.about': 'Подобранный каталог программ, учебных планов и материалов по программированию и академическим предметам.', 'footer.newsletter': 'Рассылка', 'footer.explore': 'Обзор', 'footer.subjects': 'Предметы', 'footer.company': 'О компании', 'footer.viewAll': 'Смотреть все', 'footer.rights': 'Все права защищены.', 'footer.privacy': 'Политика конфиденциальности', 'footer.terms': 'Условия использования', 'footer.cookies': 'Cookie-файлы',
    'footer.allCourses': 'Все курсы', 'footer.learningRoadmaps': 'Учебные планы', 'footer.resources': 'Статьи и ресурсы', 'footer.pricing': 'Тарифы', 'footer.aboutUs': 'О нас', 'footer.mission': 'Наша миссия', 'footer.instructors': 'О каталоге', 'footer.contact': 'Контакты', 'footer.newsletterUnavailable': 'Подписка на email-рассылку пока недоступна. Вместо этого посмотрите наши свежие материалы.', 'footer.browseResources': 'Смотреть материалы', 'footer.legalUnavailable': 'Политика конфиденциальности, условия и информация о cookie пока не опубликованы.', 'footer.legalContact': 'Свяжитесь с нами по вопросам конфиденциальности или условий',
    'home.eyebrow': 'Подобранный каталог материалов', 'home.titleStart': 'Изучайте программирование и', 'home.titleHighlight': 'академические предметы', 'home.titleEnd': 'с понятными следующими шагами.', 'home.description': 'Просматривайте подобранные программы, учебные планы и материалы — от основ кода до математики и естественных наук. Каталог доступен без аккаунта.', 'home.exploreCourses': 'Смотреть курсы', 'home.learningPaths': 'Учебные планы', 'home.noCard': 'Просмотр без аккаунта', 'home.freePreview': 'Доступны планы курсов', 'home.learnPace': 'Учебные планы',
  },
  uz: {
    'language.label': 'Til',
    'theme.label': 'Mavzu', 'theme.indigo': 'Indigo', 'theme.ocean': 'Okean', 'theme.sunset': 'Quyosh botishi', 'theme.forest': "O'rmon",
    'nav.dashboard': 'Bosh sahifa', 'nav.learn': "O'rganish", 'nav.compete': 'Musobaqalar', 'nav.community': 'Platforma holati', 'nav.insights': 'Tahlillar', 'nav.more': 'Boshqa',
    'nav.signIn': 'Kirish', 'nav.getStarted': 'Boshlash', 'nav.toggleMenu': 'Menyuni ochish',
    'nav.myAccount': 'Mening hisobim', 'nav.myDashboard': 'Mening hisobim', 'nav.myAnalytics': 'Musobaqa tahlillari', 'nav.myBadges': 'Yutuqlar holati', 'nav.leaderboards': 'Reytinglar', 'nav.notifications': 'Bildirishnomalar', 'nav.adminConsole': 'Admin paneli', 'nav.managePlan': 'Tarif holati', 'nav.signOut': 'Chiqish',
    'footer.title': "O'rganish katalogini ko'ring.", 'footer.description': "Dasturlash va akademik fanlar bo'yicha saralangan kurs rejalari, yo'l xaritalari va manbalarni ko'ring.", 'footer.createAccount': 'Bepul hisob yaratish', 'footer.browseCourses': "Kurslarni ko'rish", 'footer.about': "Dasturlash va akademik fanlar bo'yicha saralangan kurs rejalari, yo'l xaritalari va manbalar katalogi.", 'footer.newsletter': 'Yangiliklar xati', 'footer.explore': "Ko'rib chiqish", 'footer.subjects': 'Fanlar', 'footer.company': 'Kompaniya', 'footer.viewAll': 'Barchasini ko‘rish', 'footer.rights': 'Barcha huquqlar himoyalangan.', 'footer.privacy': 'Maxfiylik siyosati', 'footer.terms': 'Foydalanish shartlari', 'footer.cookies': 'Cookie-fayllar',
    'footer.allCourses': 'Barcha kurslar', 'footer.learningRoadmaps': "O'rganish yo'llari", 'footer.resources': 'Maqolalar va manbalar', 'footer.pricing': 'Tariflar', 'footer.aboutUs': 'Biz haqimizda', 'footer.mission': 'Bizning maqsadimiz', 'footer.instructors': 'Katalog haqida', 'footer.contact': 'Aloqa', 'footer.newsletterUnavailable': 'Email orqali yangiliklar xatiga obuna hozircha mavjud emas. Uning o‘rniga so‘nggi manbalarimizni ko‘ring.', 'footer.browseResources': 'Manbalarni ko‘rish', 'footer.legalUnavailable': 'Maxfiylik, foydalanish shartlari va cookie-fayllar haqidagi ma’lumotlar hali e’lon qilinmagan.', 'footer.legalContact': 'Maxfiylik yoki shartlar bo‘yicha savol bilan bog‘laning',
    'home.eyebrow': "Saralangan o'rganish katalogi", 'home.titleStart': 'Dasturlash va', 'home.titleHighlight': 'akademik fanlarni', 'home.titleEnd': "aniq keyingi qadamlar bilan o'rganing.", 'home.description': "Saralangan kurs rejalari, yo'naltirilgan yo'l xaritalari va manbalarni ko'ring — kod asoslaridan matematika va tabiiy fanlargacha. Katalogni ko'rish uchun hisob kerak emas.", 'home.exploreCourses': "Kurslarni ko'rish", 'home.learningPaths': "O'rganish yo'llari", 'home.noCard': 'Hisobsiz ko‘rish mumkin', 'home.freePreview': 'Kurs rejalari mavjud', "home.learnPace": "Yo'l xaritalari mavjud",
  },
};

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function getInitialLanguage(): Language {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem('cameron-language') : null;
  return languages.some(({ code }) => code === saved) ? saved as Language : 'uz';
}

export function translate(language: Language, key: string): string {
  return translations[language][key] ?? translations.en[key] ?? key;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
}
