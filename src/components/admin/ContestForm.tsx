import { useState } from 'react';
import {
  Trophy, Calendar, Clock, Eye, Tag, FileText, Gift,
  Plus, X, ChevronRight, Check, Users,
} from 'lucide-react';
import {
  type ContestFormData,
  emptyContestForm,
  visibilityOptions,
} from '@/data/admin';
import {
  contestCategories,
  contestTypes,
  difficultyColors,
  type Difficulty,
  type ContestType,
} from '@/data/contests';

export function ContestForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
}: {
  initialData?: Partial<ContestFormData>;
  onSubmit: (data: ContestFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const [form, setForm] = useState<ContestFormData>({ ...emptyContestForm, ...initialData });
  const [ruleInput, setRuleInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = <K extends keyof ContestFormData>(key: K, value: ContestFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const addRule = () => {
    const rule = ruleInput.trim();
    if (!rule) return;
    update('rules', [...form.rules, rule]);
    setRuleInput('');
  };

  const removeRule = (idx: number) => {
    update('rules', form.rules.filter((_, i) => i !== idx));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || form.tags.includes(tag)) return;
    update('tags', [...form.tags, tag]);
    setTagInput('');
  };

  const removeTag = (idx: number) => {
    update('tags', form.tags.filter((_, i) => i !== idx));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (!form.startTime) errs.startTime = 'Start time is required';
    if (!form.endTime) errs.endTime = 'End time is required';
    if (form.startTime && form.endTime && new Date(form.startTime) >= new Date(form.endTime)) {
      errs.endTime = 'End time must be after start time';
    }
    if (form.durationMinutes < 1) errs.durationMinutes = 'Duration must be at least 1 minute';
    if (form.maxParticipants < 1) errs.maxParticipants = 'Max participants must be at least 1';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(form);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <FormField label="Contest Title" icon={Trophy} error={errors.title} required>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="e.g., Spring Code Sprint 2026"
          className="form-input"
        />
      </FormField>

      {/* Description */}
      <FormField label="Description" icon={FileText} error={errors.description} required>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
          placeholder="Describe the contest format, topics, and what participants can expect..."
          className="form-input resize-none"
        />
      </FormField>

      {/* Subject + Type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Subject" icon={Tag}>
          <select
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            className="form-input"
          >
            {contestCategories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Contest Type" icon={Trophy}>
          <select
            value={form.type}
            onChange={(e) => update('type', e.target.value as ContestType)}
            className="form-input"
          >
            {contestTypes.map((t) => (
              <option key={t.type} value={t.type}>{t.type}</option>
            ))}
          </select>
        </FormField>
      </div>

      {/* Difficulty + Visibility */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Difficulty" icon={Trophy}>
          <div className="flex gap-2">
            {(['Easy', 'Medium', 'Hard', 'Expert'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => update('difficulty', d)}
                className={`chip flex-1 justify-center py-2 transition-all ${
                  form.difficulty === d
                    ? difficultyColors[d] + ' ring-2'
                    : 'bg-slate-50 text-slate-400 ring-1 ring-slate-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Visibility" icon={Eye}>
          <select
            value={form.visibility}
            onChange={(e) => update('visibility', e.target.value as ContestFormData['visibility'])}
            className="form-input"
          >
            {visibilityOptions.map((v) => (
              <option key={v.value} value={v.value}>{v.label} — {v.description}</option>
            ))}
          </select>
        </FormField>
      </div>

      {/* Start time + End time */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start Time" icon={Calendar} error={errors.startTime} required>
          <input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => update('startTime', e.target.value)}
            className="form-input"
          />
        </FormField>

        <FormField label="End Time" icon={Calendar} error={errors.endTime} required>
          <input
            type="datetime-local"
            value={form.endTime}
            onChange={(e) => update('endTime', e.target.value)}
            className="form-input"
          />
        </FormField>
      </div>

      {/* Duration + Max participants */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Duration (minutes)" icon={Clock} error={errors.durationMinutes}>
          <input
            type="number"
            value={form.durationMinutes}
            onChange={(e) => update('durationMinutes', parseInt(e.target.value) || 0)}
            min={1}
            className="form-input"
          />
        </FormField>

        <FormField label="Max Participants" icon={Users} error={errors.maxParticipants}>
          <input
            type="number"
            value={form.maxParticipants}
            onChange={(e) => update('maxParticipants', parseInt(e.target.value) || 0)}
            min={1}
            className="form-input"
          />
        </FormField>
      </div>

      {/* Prize */}
      <FormField label="Prize (optional)" icon={Gift}>
        <input
          type="text"
          value={form.prize}
          onChange={(e) => update('prize', e.target.value)}
          placeholder="e.g., $500 + Pro Max 6 months"
          className="form-input"
        />
      </FormField>

      {/* Organizer */}
      <FormField label="Organizer" icon={Users}>
        <input
          type="text"
          value={form.organizer}
          onChange={(e) => update('organizer', e.target.value)}
          placeholder="e.g., Cameron Contest Team"
          className="form-input"
        />
      </FormField>

      {/* Rules */}
      <FormField label="Rules" icon={FileText}>
        <div className="flex gap-2">
          <input
            type="text"
            value={ruleInput}
            onChange={(e) => setRuleInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRule(); } }}
            placeholder="Add a rule and press Enter..."
            className="form-input flex-1"
          />
          <button
            onClick={addRule}
            type="button"
            className="btn-ghost flex-shrink-0 px-3"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {form.rules.length > 0 && (
          <div className="mt-3 space-y-2">
            {form.rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-bold text-indigo-600">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-slate-600">{rule}</span>
                <button
                  onClick={() => removeRule(i)}
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-error-500/10 hover:text-error-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </FormField>

      {/* Tags */}
      <FormField label="Tags" icon={Tag}>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="Add a tag and press Enter..."
            className="form-input flex-1"
          />
          <button
            onClick={addTag}
            type="button"
            className="btn-ghost flex-shrink-0 px-3"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {form.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {form.tags.map((tag, i) => (
              <span key={i} className="chip bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
                {tag}
                <button
                  onClick={() => removeTag(i)}
                  type="button"
                  className="ml-1 hover:text-error-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </FormField>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <button onClick={onCancel} type="button" className="btn-ghost px-5 py-2.5 text-sm">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          type="button"
          className="btn-primary px-6 py-2.5 text-sm"
        >
          <Check className="h-4 w-4" />
          {isEdit ? 'Save changes' : 'Create contest'}
        </button>
      </div>

      <style>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: rgb(15 23 42);
          outline: none;
          transition: all 0.2s;
        }
        .form-input:focus {
          border-color: rgb(99 102 241);
          box-shadow: 0 0 0 3px rgb(99 102 241 / 0.1);
        }
      `}</style>
    </div>
  );
}

/* ============ Form Field Wrapper ============ */

function FormField({
  label, icon: Icon, error, required, children,
}: {
  label: string;
  icon: typeof Trophy;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {label}
        {required && <span className="text-error-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs font-semibold text-error-500">{error}</p>
      )}
    </div>
  );
}
