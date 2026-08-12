-- Draft preview is an owner-only rehearsal.  It deliberately never flips
-- contests.is_published and never creates a contest registration, so the
-- same contest can still be published normally after the check is complete.

CREATE OR REPLACE FUNCTION public.get_contest_preview_workspace(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'Sign in with an active account to open a preview';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE slug = p_slug
    AND is_published = false
    AND archived_at IS NULL;

  IF NOT FOUND OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'Draft contest preview not found';
  END IF;

  SELECT jsonb_build_object(
    'contest', jsonb_build_object(
      'id', contest.id,
      'slug', contest.slug,
      'title', contest.title,
      'subject', contest.subject,
      'start_at', contest.start_at,
      'end_at', contest.end_at,
      'contest_type', contest.contest_type,
      'completed_at', null
    ),
    -- Preview intentionally has no clock or section lock: the organizer must
    -- be able to inspect every part before setting the real exam live.
    'exam_timing', null,
    'parts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', part.id,
        'position', part.position,
        'section', part.section,
        'title', part.title,
        'instructions', part.instructions,
        'content', part.content,
        'audio_url', part.audio_url,
        'image_url', part.image_url,
        'max_points', part.max_points
      ) ORDER BY
        CASE part.section WHEN 'listening' THEN 1 WHEN 'reading' THEN 2 ELSE 3 END,
        part.position)
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = contest.id
    ), '[]'::jsonb),
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', question.id,
        'exam_part_id', question.exam_part_id,
        'position', question.position,
        'prompt', question.prompt,
        'options', question.options,
        'answer_type', question.answer_type,
        'word_limit', question.word_limit,
        'points', question.points
      ) ORDER BY question.exam_part_id, question.position)
      FROM public.contest_questions AS question
      WHERE question.contest_id = contest.id
    ), '[]'::jsonb),
    'answers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', answer.question_id,
        'selected_option', answer.selected_option,
        'selected_text', answer.selected_text
      ) ORDER BY question.exam_part_id, question.position)
      FROM public.contest_answers AS answer
      JOIN public.contest_questions AS question ON question.id = answer.question_id
      WHERE answer.contest_id = contest.id
        AND answer.user_id = auth.uid()
    ), '[]'::jsonb),
    'gap_fill_responses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', response.exam_part_id,
        'blank_number', response.blank_number,
        'answer', response.answer
      ) ORDER BY response.exam_part_id, response.blank_number)
      FROM public.contest_gap_fill_responses AS response
      WHERE response.contest_id = contest.id
        AND response.user_id = auth.uid()
    ), '[]'::jsonb),
    'matching_configs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', part.id,
        'options', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'position', option.option_position,
            'label', option.label
          ) ORDER BY option.option_position)
          FROM public.contest_matching_options AS option
          WHERE option.exam_part_id = part.id
        ), '[]'::jsonb),
        -- Correct answers are purposefully not exposed in preview either.
        'speakers', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'speaker_number', speaker.speaker_number,
            'label', speaker.label,
            'image_url', speaker.image_url
          ) ORDER BY speaker.speaker_number)
          FROM public.contest_matching_speakers AS speaker
          WHERE speaker.exam_part_id = part.id
        ), '[]'::jsonb)
      ) ORDER BY
        CASE part.section WHEN 'listening' THEN 1 WHEN 'reading' THEN 2 ELSE 3 END,
        part.position)
      FROM public.contest_exam_parts AS part
      WHERE part.contest_id = contest.id
        AND exists (
          SELECT 1 FROM public.contest_matching_options option
          WHERE option.exam_part_id = part.id
        )
    ), '[]'::jsonb),
    'matching_responses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', response.exam_part_id,
        'speaker_number', response.speaker_number,
        'option_position', response.option_position
      ) ORDER BY response.exam_part_id, response.speaker_number)
      FROM public.contest_matching_responses AS response
      WHERE response.contest_id = contest.id
        AND response.user_id = auth.uid()
    ), '[]'::jsonb),
    'writing_responses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'part_id', submission.exam_part_id,
        'content', submission.content,
        'submitted_at', submission.submitted_at,
        'updated_at', submission.updated_at
      ) ORDER BY
        CASE part.section WHEN 'listening' THEN 1 WHEN 'reading' THEN 2 ELSE 3 END,
        part.position)
      FROM public.contest_writing_submissions AS submission
      JOIN public.contest_exam_parts AS part ON part.id = submission.exam_part_id
      WHERE submission.contest_id = contest.id
        AND submission.user_id = auth.uid()
    ), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests AS contest
  WHERE contest.id = v_contest.id;

  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_contest_preview_answer(
  p_question_id uuid,
  p_selected_option integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to save a preview answer';
  END IF;

  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'choice' THEN
    RAISE EXCEPTION 'Choice question not found';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT FOUND OR v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;
  IF p_selected_option IS NULL OR p_selected_option < 0
    OR p_selected_option >= jsonb_array_length(v_question.options) THEN
    RAISE EXCEPTION 'Invalid answer option';
  END IF;

  v_correct := coalesce(p_selected_option = v_question.correct_option, false);
  INSERT INTO public.contest_answers (
    contest_id, question_id, user_id, selected_option, selected_text, is_correct, score
  ) VALUES (
    v_contest.id, v_question.id, auth.uid(), p_selected_option, null,
    v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END
  ) ON CONFLICT (question_id, user_id) DO UPDATE
  SET selected_option = excluded.selected_option,
      selected_text = null,
      is_correct = excluded.is_correct,
      score = excluded.score,
      submitted_at = now();

  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_contest_preview_text_answer(
  p_question_id uuid,
  p_selected_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_answer text := regexp_replace(trim(coalesce(p_selected_text, '')), '\\s+', ' ', 'g');
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to save a preview answer';
  END IF;

  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'text' THEN
    RAISE EXCEPTION 'Typed-answer question not found';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT FOUND OR v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;

  IF v_answer = '' THEN
    DELETE FROM public.contest_answers
    WHERE question_id = v_question.id AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'cleared', true, 'question_id', p_question_id);
  END IF;
  IF cardinality(regexp_split_to_array(v_answer, '\\s+')) > v_question.word_limit THEN
    RAISE EXCEPTION 'This answer exceeds the word limit';
  END IF;

  SELECT exists (
    SELECT 1
    FROM jsonb_array_elements_text(v_question.accepted_answers) AS accepted(answer)
    WHERE lower(regexp_replace(trim(accepted.answer), '\\s+', ' ', 'g')) = lower(v_answer)
  ) INTO v_correct;

  INSERT INTO public.contest_answers (
    contest_id, question_id, user_id, selected_option, selected_text, is_correct, score
  ) VALUES (
    v_contest.id, v_question.id, auth.uid(), null, v_answer,
    v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END
  ) ON CONFLICT (question_id, user_id) DO UPDATE
  SET selected_option = null,
      selected_text = excluded.selected_text,
      is_correct = excluded.is_correct,
      score = excluded.score,
      submitted_at = now();

  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_cefr_preview_gap_fill_response(
  p_exam_part_id uuid,
  p_blank_number integer,
  p_answer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_key public.contest_gap_fill_answer_keys%ROWTYPE;
  v_answer text := trim(coalesce(p_answer, ''));
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to save a preview answer';
  END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT FOUND OR v_contest.subject <> 'cefr' OR v_contest.is_published
    OR v_contest.archived_at IS NOT NULL OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;
  SELECT * INTO v_key
  FROM public.contest_gap_fill_answer_keys
  WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'This blank is not configured'; END IF;

  IF v_answer = '' THEN
    DELETE FROM public.contest_gap_fill_responses
    WHERE exam_part_id = p_exam_part_id
      AND blank_number = p_blank_number
      AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'cleared', true);
  END IF;
  IF char_length(v_answer) > 120 THEN
    RAISE EXCEPTION 'An answer may contain at most 120 characters';
  END IF;

  SELECT exists (
    SELECT 1
    FROM jsonb_array_elements_text(v_key.accepted_answers) AS accepted(answer)
    WHERE public.normalize_gap_fill_answer(accepted.answer) = public.normalize_gap_fill_answer(v_answer)
  ) INTO v_correct;

  INSERT INTO public.contest_gap_fill_responses (
    contest_id, exam_part_id, blank_number, user_id, answer, is_correct, score
  ) VALUES (
    v_contest.id, p_exam_part_id, p_blank_number, auth.uid(), v_answer,
    v_correct, CASE WHEN v_correct THEN v_key.points ELSE 0 END
  ) ON CONFLICT (exam_part_id, blank_number, user_id) DO UPDATE
  SET answer = excluded.answer,
      is_correct = excluded.is_correct,
      score = excluded.score,
      submitted_at = now();

  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'blank_number', p_blank_number);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_cefr_preview_matching_response(
  p_exam_part_id uuid,
  p_speaker_number integer,
  p_option_position integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_speaker public.contest_matching_speakers%ROWTYPE;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to save a preview answer';
  END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT FOUND OR v_contest.subject <> 'cefr' OR v_contest.is_published
    OR v_contest.archived_at IS NOT NULL OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;
  SELECT * INTO v_speaker
  FROM public.contest_matching_speakers
  WHERE exam_part_id = p_exam_part_id AND speaker_number = p_speaker_number;
  IF NOT FOUND OR NOT exists (
    SELECT 1 FROM public.contest_matching_options
    WHERE exam_part_id = p_exam_part_id AND option_position = p_option_position
  ) THEN
    RAISE EXCEPTION 'Invalid matching item or option';
  END IF;

  v_correct := coalesce(p_option_position = v_speaker.correct_option_position, false);
  INSERT INTO public.contest_matching_responses (
    contest_id, exam_part_id, speaker_number, user_id, option_position, is_correct, score
  ) VALUES (
    v_contest.id, p_exam_part_id, p_speaker_number, auth.uid(), p_option_position,
    v_correct, CASE WHEN v_correct THEN 1 ELSE 0 END
  ) ON CONFLICT (exam_part_id, speaker_number, user_id) DO UPDATE
  SET option_position = excluded.option_position,
      is_correct = excluded.is_correct,
      score = excluded.score,
      submitted_at = now();

  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'speaker_number', p_speaker_number);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_contest_preview_writing_response(
  p_exam_part_id uuid,
  p_content text,
  p_submit boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_submitted_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to save preview writing';
  END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR v_part.section <> 'writing' THEN
    RAISE EXCEPTION 'Writing part not found';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT FOUND OR v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;
  IF char_length(trim(coalesce(p_content, ''))) < 1 THEN
    RAISE EXCEPTION 'Writing response cannot be empty';
  END IF;

  SELECT submitted_at INTO v_submitted_at
  FROM public.contest_writing_submissions
  WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid()
  FOR UPDATE;
  IF v_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This writing response has already been submitted. Clear preview responses to test it again.';
  END IF;

  INSERT INTO public.contest_writing_submissions (
    contest_id, exam_part_id, user_id, content, submitted_at
  ) VALUES (
    v_contest.id, p_exam_part_id, auth.uid(), trim(p_content),
    CASE WHEN p_submit THEN now() ELSE null END
  ) ON CONFLICT (exam_part_id, user_id) DO UPDATE
  SET content = excluded.content,
      submitted_at = CASE WHEN p_submit THEN now() ELSE null END,
      updated_at = now()
  RETURNING submitted_at INTO v_submitted_at;

  RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_contest_preview_responses(p_contest_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to clear a preview';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id FOR UPDATE;
  IF NOT FOUND OR v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR NOT public.can_manage_contest(v_contest.id) THEN
    RAISE EXCEPTION 'This draft preview is not available';
  END IF;

  DELETE FROM public.contest_answers
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  DELETE FROM public.contest_gap_fill_responses
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  DELETE FROM public.contest_matching_responses
  WHERE contest_id = v_contest.id AND user_id = auth.uid();
  DELETE FROM public.contest_writing_submissions
  WHERE contest_id = v_contest.id AND user_id = auth.uid();

  PERFORM public.log_audit_action(
    'contest.preview.clear',
    'contest',
    v_contest.id,
    jsonb_build_object('user_id', auth.uid())
  );
END;
$function$;

-- Preview never creates registrations.  Drop every pre-publication response
-- without a registration at the last possible moment of a successful publish,
-- so a submitted draft Writing answer can never block grading or finalization.
DO $migration$
DECLARE
  v_sql text;
  v_original text := 'UPDATE public.contests SET is_published = true WHERE id = p_contest_id;';
  v_replacement text := $replacement$
  DELETE FROM public.contest_answers AS preview
  WHERE preview.contest_id = p_contest_id
    AND NOT EXISTS (
      SELECT 1 FROM public.contest_registrations AS registration
      WHERE registration.contest_id = preview.contest_id
        AND registration.user_id = preview.user_id
    );
  DELETE FROM public.contest_gap_fill_responses AS preview
  WHERE preview.contest_id = p_contest_id
    AND NOT EXISTS (
      SELECT 1 FROM public.contest_registrations AS registration
      WHERE registration.contest_id = preview.contest_id
        AND registration.user_id = preview.user_id
    );
  DELETE FROM public.contest_matching_responses AS preview
  WHERE preview.contest_id = p_contest_id
    AND NOT EXISTS (
      SELECT 1 FROM public.contest_registrations AS registration
      WHERE registration.contest_id = preview.contest_id
        AND registration.user_id = preview.user_id
    );
  DELETE FROM public.contest_writing_submissions AS preview
  WHERE preview.contest_id = p_contest_id
    AND NOT EXISTS (
      SELECT 1 FROM public.contest_registrations AS registration
      WHERE registration.contest_id = preview.contest_id
        AND registration.user_id = preview.user_id
    );
  UPDATE public.contests SET is_published = true WHERE id = p_contest_id;$replacement$;
BEGIN
  SELECT pg_get_functiondef('public.publish_contest(uuid)'::regprocedure) INTO v_sql;
  IF position(v_original IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Could not add draft-preview cleanup to publish_contest';
  END IF;
  EXECUTE replace(v_sql, v_original, v_replacement);
END;
$migration$;

REVOKE ALL ON FUNCTION public.get_contest_preview_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_contest_preview_answer(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_contest_preview_text_answer(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_preview_gap_fill_response(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_preview_matching_response(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_contest_preview_writing_response(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_contest_preview_responses(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_contest_preview_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_preview_answer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_preview_text_answer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_preview_gap_fill_response(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_preview_matching_response(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_contest_preview_writing_response(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_contest_preview_responses(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
