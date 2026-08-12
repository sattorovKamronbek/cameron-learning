import type { ContestDifficulty, ContestStatus, ContestType } from '@/lib/contests';

export type FilterState = {
  search: string;
  subject: string | 'all';
  difficulty: ContestDifficulty | 'all';
  status: ContestStatus | 'all';
  type: ContestType | 'all';
  sortBy: 'start' | 'participants' | 'duration';
};

export const defaultFilters: FilterState = {
  search: '',
  subject: 'all',
  difficulty: 'all',
  status: 'all',
  type: 'all',
  sortBy: 'start',
};
