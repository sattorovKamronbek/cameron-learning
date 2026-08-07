import { QuizWorkspacePage } from '@/pages/QuizWorkspacePage';

// Both legacy workspace URLs now use the same real, server-backed contest flow.
export function ContestWorkspacePage({ slug }: { slug: string }) {
  return <QuizWorkspacePage slug={slug} />;
}
