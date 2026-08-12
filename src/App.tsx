import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { RouterProvider, useRouter } from '@/router';
import { AuthProvider } from '@/lib/auth';
import { useAccessControl } from '@/lib/access';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { LoadingState } from '@/components/LoadingState';
import { NotificationCenterPage } from '@/components/NotificationBell';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';

function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  type PageComponent = M[K] extends ComponentType<infer Props> ? ComponentType<Props> : never;
  return lazy(async () => ({ default: (await load())[name] as PageComponent }));
}

const HomePage = page(() => import('@/pages/HomePage'), 'HomePage');
const CoursesPage = page(() => import('@/pages/CoursesPage'), 'CoursesPage');
const CourseDetailPage = page(() => import('@/pages/CourseDetailPage'), 'CourseDetailPage');
const SubjectsPage = page(() => import('@/pages/SubjectsPage'), 'SubjectsPage');
const SubjectDetailPage = page(() => import('@/pages/SubjectDetailPage'), 'SubjectDetailPage');
const RoadmapsPage = page(() => import('@/pages/RoadmapsPage'), 'RoadmapsPage');
const RoadmapDetailPage = page(() => import('@/pages/RoadmapDetailPage'), 'RoadmapDetailPage');
const ResourcesPage = page(() => import('@/pages/ResourcesPage'), 'ResourcesPage');
const ArticleDetailPage = page(() => import('@/pages/ArticleDetailPage'), 'ArticleDetailPage');
const AboutPage = page(() => import('@/pages/AboutPage'), 'AboutPage');
const PricingPage = page(() => import('@/pages/PricingPage'), 'PricingPage');
const ProfilePage = page(() => import('@/pages/ProfilePage'), 'ProfilePage');
const AuthPage = page(() => import('@/pages/AuthPage'), 'AuthPage');
const NotFoundPage = page(() => import('@/pages/NotFoundPage'), 'NotFoundPage');
const ContestLandingPage = page(() => import('@/pages/ContestLandingPage'), 'ContestLandingPage');
const ContestDetailPage = page(() => import('@/pages/ContestDetailPage'), 'ContestDetailPage');
const ContestWorkspacePage = page(() => import('@/pages/ContestWorkspacePage'), 'ContestWorkspacePage');
const QuizWorkspacePage = page(() => import('@/pages/QuizWorkspacePage'), 'QuizWorkspacePage');
const ContestManagementPage = page(() => import('@/pages/ContestManagementPage'), 'ContestManagementPage');
const ProgrammingManagementPage = page(() => import('@/pages/ProgrammingManagementPage'), 'ProgrammingManagementPage');
const ProblemsPage = page(() => import('@/pages/ProblemsPage'), 'ProblemsPage');
const ProblemDetailPage = page(() => import('@/pages/ProblemDetailPage'), 'ProblemDetailPage');
const LeaderboardPage = page(() => import('@/pages/LeaderboardPage'), 'LeaderboardPage');
const AnalyticsDashboard = page(() => import('@/pages/AnalyticsDashboard'), 'AnalyticsDashboard');
const AchievementsPage = page(() => import('@/pages/AchievementsPage'), 'AchievementsPage');
const AdminDashboard = page(() => import('@/pages/AdminDashboard'), 'AdminDashboard');

function Routes() {
  const { path } = useRouter();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [path]);

  // Auth pages render full-screen without navbar/footer
  if (path === '/login' || path === '/signup') {
    return <AuthPage mode={path === '/signup' ? 'signup' : 'login'} />;
  }

  // Workspace routes must be resolved before the generic contest-detail route.
  const workspaceMatch = path.match(/^\/contests\/([^/]+)\/(workspace|quiz|preview)$/);
  if (workspaceMatch) {
    const [, slug, mode] = workspaceMatch;
    return mode === 'workspace'
      ? <ContestWorkspacePage slug={slug} />
      : <QuizWorkspacePage slug={slug} preview={mode === 'preview'} />;
  }

  let page: React.ReactNode;

  if (path === '/') {
    page = <HomePage />;
  } else if (path === '/courses') {
    page = <CoursesPage />;
  } else if (path.startsWith('/courses/')) {
    page = <CourseDetailPage slug={path.replace('/courses/', '')} />;
  } else if (path === '/subjects') {
    page = <SubjectsPage />;
  } else if (path.startsWith('/subjects/')) {
    page = <SubjectDetailPage slug={path.replace('/subjects/', '')} />;
  } else if (path === '/roadmaps') {
    page = <RoadmapsPage />;
  } else if (path.startsWith('/roadmaps/')) {
    page = <RoadmapDetailPage slug={path.replace('/roadmaps/', '')} />;
  } else if (path === '/resources') {
    page = <ResourcesPage />;
  } else if (path.startsWith('/resources/')) {
    page = <ArticleDetailPage slug={path.replace('/resources/', '')} />;
  } else if (path === '/pricing') {
    page = <PricingPage />;
  } else if (path === '/profile') {
    page = <ProfilePage />;
  } else if (path === '/about') {
    page = <AboutPage />;
  } else if (path === '/contest-management') {
    page = <ContestManagementGate />;
  } else if (path === '/programming-management') {
    page = <ProgrammingManagementGate />;
  } else if (path === '/problems') {
    page = <ProblemsPage />;
  } else if (path.startsWith('/problems/')) {
    page = <ProblemDetailPage slug={path.replace('/problems/', '')} />;
  } else if (path === '/contests') {
    page = <ContestLandingPage />;
  } else if (path.startsWith('/contests/')) {
    page = <ContestDetailPage slug={path.replace('/contests/', '')} />;
  } else if (path === '/leaderboards') {
    page = <LeaderboardPage />;
  } else if (path === '/analytics') {
    page = <AnalyticsDashboard />;
  } else if (path === '/achievements') {
    page = <AchievementsPage />;
  } else if (path === '/notifications') {
    page = <NotificationCenterPage />;
  } else if (path.startsWith('/admin')) {
    return <AdminGate />;
  } else {
    page = <NotFoundPage />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{page}</main>
      <Footer />
    </div>
  );
}

function ContestManagementGate() {
  const { canManageContests, loading } = useAccessControl();

  if (loading) {
    return <LoadingState variant="page" message="Kirish ruxsati tekshirilmoqda" />;
  }

  // This keeps the management UI out of regular accounts. The contest RPCs
  // remain the source of truth and enforce the same authorization server-side.
  if (!canManageContests) {
    return <NotFoundPage />;
  }

  return <ContestManagementPage />;
}

function ProgrammingManagementGate() {
  const { canManageContests, loading } = useAccessControl();

  if (loading) {
    return <LoadingState variant="page" message="Kirish ruxsati tekshirilmoqda" />;
  }

  if (!canManageContests) {
    return <NotFoundPage />;
  }

  return <ProgrammingManagementPage />;
}

function AdminGate() {
  const { adminAccess, loading } = useAccessControl();

  if (loading) {
    return <LoadingState variant="page" message="Kirish ruxsati tekshirilmoqda" />;
  }
  if (!adminAccess) return <NotFoundPage />;
  return <AdminDashboard />;
}

function App() {
  return (
    <Suspense fallback={<LoadingState variant="page" message="Sahifa tayyorlanmoqda" />}>
      <AuthProvider>
        <ThemeProvider>
          <I18nProvider>
            <RouterProvider>
              <Routes />
            </RouterProvider>
          </I18nProvider>
        </ThemeProvider>
      </AuthProvider>
    </Suspense>
  );
}

export default App;
