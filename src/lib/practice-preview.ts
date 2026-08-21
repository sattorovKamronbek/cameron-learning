import { supabase } from '@/lib/supabase';

export type PracticeLanguage = 'cpp17' | 'python3' | 'java17';
export type PracticeExample = { input: string; output: string };
export type PracticePreviewStatus = 'Accepted' | 'Wrong answer' | 'Runtime error' | 'Time limit' | 'Compilation error';
export type PracticePreviewResult = { status: PracticePreviewStatus; stdout: string; stderr: string };

export const practiceLanguageOptions: Array<{ value: PracticeLanguage; label: string }> = [
  { value: 'cpp17', label: 'C++17' },
  { value: 'python3', label: 'Python 3' },
  { value: 'java17', label: 'Java 17' },
];

export const practiceTemplates: Record<PracticeLanguage, string> = {
  cpp17: `#include <bits/stdc++.h>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  // Yechimingizni shu yerga yozing.
  return 0;
}
`,
  python3: `import sys

def solve() -> None:
    # Yechimingizni shu yerga yozing.
    pass

if __name__ == "__main__":
    solve()
`,
  java17: `import java.io.*;
import java.util.*;

public class Main {
  public static void main(String[] args) throws Exception {
    // Yechimingizni shu yerga yozing.
  }
}
`,
};

async function errorFrom(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (payload.error) return new Error(payload.error);
  if (response.status === 404) return new Error('Practice runner topilmadi. Judge serverni ishga tushiring yoki VITE_JUDGE_API_URL ni sozlang.');
  if (response.status === 401) return new Error('Samplelarda tekshirish uchun qayta kirish qiling.');
  return new Error('Samplelarda tekshirishni bajarib bo‘lmadi.');
}

/** Runs user code against public examples only; hidden tests are never sent to the browser. */
export async function previewPracticeSolution(source: string, language: PracticeLanguage, examples: PracticeExample[]): Promise<PracticePreviewResult[]> {
  const { data } = await supabase.auth.getSession();
  const apiBase = (import.meta.env.VITE_JUDGE_API_URL ?? '').replace(/\/$/, '');
  const response = await fetch(`${apiBase}/api/submissions/practice-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify({ source, language, examples }),
  });
  if (!response.ok) throw await errorFrom(response);
  const payload = await response.json() as { results?: PracticePreviewResult[] };
  return payload.results ?? [];
}
