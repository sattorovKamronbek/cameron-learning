/*
  Participant-controlled Listening completion and contest-attempt closure.

  Section timing used to be entirely contest-wide.  Persisting the Listening
  completion timestamp on each registration makes an early transition durable:
  refreshing the page or calling an old workspace URL can never reveal
  Listening again for that participant.
*/

ALTER TABLE public.contest_registrations
  ADD COLUMN IF NOT EXISTS listening_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.exam_section_window(
  p_contest_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  active_section text,
  section_starts_at timestamptz,
  section_ends_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_timing public.contest_exam_section_timings%ROWTYPE;
  v_registration public.contest_registrations%ROWTYPE;
  v_listening_end timestamptz;
  v_reading_start timestamptz;
  v_reading_end timestamptz;
  v_writing_end timestamptz;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  SELECT * INTO v_timing FROM public.contest_exam_section_timings WHERE contest_id = p_contest_id;
  SELECT * INTO v_registration
  FROM public.contest_registrations
  WHERE contest_id = p_contest_id AND user_id = p_user_id;

  IF NOT FOUND
    OR v_registration.completed_at IS NOT NULL
    OR now() < v_contest.start_at
    OR now() >= v_contest.end_at THEN
    RETURN;
  END IF;

  v_listening_end := v_contest.start_at + (v_timing.listening_minutes * interval '1 minute');
  IF v_registration.listening_completed_at IS NULL AND now() < v_listening_end THEN
    RETURN QUERY SELECT 'listening'::text, v_contest.start_at, v_listening_end;
    RETURN;
  END IF;

  /* An early Listening finish gives Reading its full configured duration while
     still keeping the participant's overall exam inside the contest window. */
  v_reading_start := coalesce(v_registration.listening_completed_at, v_listening_end);
  v_reading_end := v_reading_start + (v_timing.reading_minutes * interval '1 minute');
  IF now() < v_reading_end THEN
    RETURN QUERY SELECT 'reading'::text, v_reading_start, v_reading_end;
    RETURN;
  END IF;

  v_writing_end := v_reading_end + (v_timing.writing_minutes * interval '1 minute');
  IF now() < v_writing_end AND now() < v_contest.end_at THEN
    RETURN QUERY SELECT 'writing'::text, v_reading_end, least(v_writing_end, v_contest.end_at);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_exam_section(p_contest_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT active_section
  FROM public.exam_section_window(p_contest_id, auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.assert_exam_section_open(
  p_contest_id uuid,
  p_section text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_active_section text;
BEGIN
  SELECT active_section INTO v_active_section
  FROM public.exam_section_window(p_contest_id, auth.uid());

  IF v_active_section IS DISTINCT FROM p_section THEN
    RAISE EXCEPTION 'This exam section is closed';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_listening_section(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_completed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to complete Listening';
  END IF;

  SELECT * INTO v_contest
  FROM public.contests
  WHERE id = p_contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr')
    OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'Listening is not available for this exam at this time';
  END IF;
  IF v_contest.contest_type = 'rated'
    AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN
    RAISE EXCEPTION 'Contest managers cannot submit a rated exam';
  END IF;

  SELECT completed_at INTO v_completed_at
  FROM public.contest_registrations
  WHERE contest_id = p_contest_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF v_completed_at IS NOT NULL THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;

  PERFORM public.assert_exam_section_open(p_contest_id, 'listening');

  UPDATE public.contest_registrations
  SET listening_completed_at = now(), last_activity_at = now()
  WHERE contest_id = p_contest_id
    AND user_id = auth.uid()
    AND listening_completed_at IS NULL
  RETURNING listening_completed_at INTO v_completed_at;

  IF v_completed_at IS NULL THEN
    RAISE EXCEPTION 'Listening has already been completed';
  END IF;
  RETURN jsonb_build_object('listening_completed_at', v_completed_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_contest_attempt(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_completed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'An active account is required to end a contest attempt';
  END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL
    OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN
    RAISE EXCEPTION 'This contest attempt cannot be ended at this time';
  END IF;

  UPDATE public.contest_registrations
  SET completed_at = coalesce(completed_at, now()), last_activity_at = now()
  WHERE contest_id = p_contest_id AND user_id = auth.uid()
  RETURNING completed_at INTO v_completed_at;
  IF v_completed_at IS NULL THEN RAISE EXCEPTION 'Register for this contest before ending the attempt'; END IF;
  RETURN jsonb_build_object('completed_at', v_completed_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_contest_workspace(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'Sign in with an active account to enter a contest'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE slug = p_slug AND is_published AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before entering'; END IF;
  IF now() < v_contest.start_at THEN RAISE EXCEPTION 'Contest has not started'; END IF;
  IF now() >= v_contest.end_at THEN RAISE EXCEPTION 'Contest has finished'; END IF;

  SELECT jsonb_build_object(
    'contest', jsonb_build_object('id', contest.id, 'slug', contest.slug, 'title', contest.title, 'subject', contest.subject, 'start_at', contest.start_at, 'end_at', contest.end_at, 'contest_type', contest.contest_type, 'completed_at', registration.completed_at),
    'exam_timing', CASE WHEN contest.subject IN ('ielts', 'cefr') THEN (
      SELECT jsonb_build_object('listening_minutes', timing.listening_minutes, 'reading_minutes', timing.reading_minutes, 'writing_minutes', timing.writing_minutes, 'active_section', window.active_section, 'section_starts_at', window.section_starts_at, 'section_ends_at', window.section_ends_at)
      FROM public.contest_exam_section_timings timing
      CROSS JOIN LATERAL public.exam_section_window(contest.id, auth.uid()) window
      WHERE timing.contest_id = contest.id
    ) ELSE NULL END,
    'parts', coalesce((SELECT jsonb_agg(jsonb_build_object('id', part.id, 'position', part.position, 'section', part.section, 'title', part.title, 'instructions', part.instructions, 'content', part.content, 'audio_url', part.audio_url, 'image_url', part.image_url, 'max_points', part.max_points) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', question.id, 'exam_part_id', question.exam_part_id, 'position', question.position, 'prompt', question.prompt, 'options', question.options, 'answer_type', question.answer_type, 'word_limit', question.word_limit, 'points', question.points) ORDER BY question.position) FROM public.contest_questions question WHERE question.contest_id = contest.id AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'answers', coalesce((SELECT jsonb_agg(jsonb_build_object('question_id', answer.question_id, 'selected_option', answer.selected_option, 'selected_text', answer.selected_text) ORDER BY question.position) FROM public.contest_answers answer JOIN public.contest_questions question ON question.id = answer.question_id WHERE answer.contest_id = contest.id AND answer.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR EXISTS (SELECT 1 FROM public.contest_exam_parts part WHERE part.id = question.exam_part_id AND part.section = public.current_exam_section(contest.id)))), '[]'::jsonb),
    'gap_fill_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'blank_number', response.blank_number, 'answer', response.answer) ORDER BY response.exam_part_id, response.blank_number) FROM public.contest_gap_fill_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'matching_configs', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', part.id, 'options', coalesce((SELECT jsonb_agg(jsonb_build_object('position', option.option_position, 'label', option.label) ORDER BY option.option_position) FROM public.contest_matching_options option WHERE option.exam_part_id = part.id), '[]'::jsonb), 'speakers', coalesce((SELECT jsonb_agg(jsonb_build_object('speaker_number', speaker.speaker_number, 'label', speaker.label) ORDER BY speaker.speaker_number) FROM public.contest_matching_speakers speaker WHERE speaker.exam_part_id = part.id), '[]'::jsonb)) ORDER BY part.position) FROM public.contest_exam_parts part WHERE part.contest_id = contest.id AND part.section = public.current_exam_section(contest.id) AND contest.subject = 'cefr' AND ((part.section = 'listening' AND part.position IN (3, 4)) OR (part.section = 'reading' AND part.position IN (2, 3)))), '[]'::jsonb),
    'matching_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', response.exam_part_id, 'speaker_number', response.speaker_number, 'option_position', response.option_position) ORDER BY response.exam_part_id, response.speaker_number) FROM public.contest_matching_responses response JOIN public.contest_exam_parts part ON part.id = response.exam_part_id WHERE response.contest_id = contest.id AND response.user_id = auth.uid() AND part.section = public.current_exam_section(contest.id)), '[]'::jsonb),
    'writing_responses', coalesce((SELECT jsonb_agg(jsonb_build_object('part_id', submission.exam_part_id, 'content', submission.content, 'submitted_at', submission.submitted_at, 'updated_at', submission.updated_at) ORDER BY part.position) FROM public.contest_writing_submissions submission JOIN public.contest_exam_parts part ON part.id = submission.exam_part_id WHERE submission.contest_id = contest.id AND submission.user_id = auth.uid() AND (contest.subject NOT IN ('ielts', 'cefr') OR part.section = public.current_exam_section(contest.id))), '[]'::jsonb)
  ) INTO v_payload
  FROM public.contests contest
  JOIN public.contest_registrations registration ON registration.contest_id = contest.id AND registration.user_id = auth.uid()
  WHERE contest.id = v_contest.id;
  RETURN v_payload;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_contest_answer(p_question_id uuid, p_selected_option integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_section text;
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This contest attempt has already ended'; END IF;
  IF v_contest.subject IN ('ielts', 'cefr') THEN
    SELECT section INTO v_section FROM public.contest_exam_parts WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
    IF v_section NOT IN ('listening', 'reading') THEN RAISE EXCEPTION 'Question section timing is unavailable'; END IF;
    PERFORM public.assert_exam_section_open(v_contest.id, v_section);
  END IF;
  IF p_selected_option IS NULL OR p_selected_option < 0 OR p_selected_option >= jsonb_array_length(v_question.options) THEN RAISE EXCEPTION 'Invalid answer option'; END IF;
  v_correct := p_selected_option = v_question.correct_option;
  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), p_selected_option, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE SET selected_option = EXCLUDED.selected_option, selected_text = NULL, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_contest_text_answer(p_question_id uuid, p_selected_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_question public.contest_questions%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_section text;
  v_part_position integer;
  v_answer text := regexp_replace(trim(coalesce(p_selected_text, '')), '\s+', ' ', 'g');
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_question FROM public.contest_questions WHERE id = p_question_id;
  IF NOT FOUND OR v_question.answer_type <> 'text' THEN RAISE EXCEPTION 'Typed-answer question not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_question.contest_id;
  SELECT section, position INTO v_section, v_part_position FROM public.contest_exam_parts WHERE id = v_question.exam_part_id AND contest_id = v_contest.id;
  IF NOT (v_contest.subject = 'ielts' OR (v_contest.subject = 'cefr' AND v_section = 'reading' AND v_part_position = 5 AND v_question.position BETWEEN 30 AND 33)) OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_section NOT IN ('listening', 'reading') THEN RAISE EXCEPTION 'Question section timing is unavailable'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit answers to a rated contest'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this contest before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This contest attempt has already ended'; END IF;
  PERFORM public.assert_exam_section_open(v_contest.id, v_section);
  IF v_answer = '' THEN
    DELETE FROM public.contest_answers WHERE question_id = v_question.id AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'cleared', true, 'question_id', p_question_id);
  END IF;
  IF cardinality(regexp_split_to_array(v_answer, '\s+')) > v_question.word_limit THEN RAISE EXCEPTION 'This answer exceeds the word limit'; END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_question.accepted_answers) accepted(answer) WHERE lower(regexp_replace(trim(accepted.answer), '\s+', ' ', 'g')) = lower(v_answer)) INTO v_correct;
  INSERT INTO public.contest_answers (contest_id, question_id, user_id, selected_option, selected_text, is_correct, score)
  VALUES (v_contest.id, v_question.id, auth.uid(), NULL, v_answer, v_correct, CASE WHEN v_correct THEN v_question.points ELSE 0 END)
  ON CONFLICT (question_id, user_id) DO UPDATE SET selected_option = NULL, selected_text = EXCLUDED.selected_text, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'question_id', p_question_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_cefr_gap_fill_response(p_exam_part_id uuid, p_blank_number integer, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_key public.contest_gap_fill_answer_keys%ROWTYPE;
  v_answer text := lower(regexp_replace(trim(coalesce(p_answer, '')), '\s+', ' ', 'g'));
  v_correct boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (2, 6)) OR (v_part.section = 'reading' AND v_part.position IN (1, 5))) THEN RAISE EXCEPTION 'CEFR gap-fill part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF v_contest.subject <> 'cefr' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  PERFORM public.assert_exam_section_open(v_contest.id, v_part.section);
  SELECT * INTO v_key FROM public.contest_gap_fill_answer_keys WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid gap-fill blank'; END IF;
  IF v_answer = '' THEN
    DELETE FROM public.contest_gap_fill_responses WHERE exam_part_id = p_exam_part_id AND blank_number = p_blank_number AND user_id = auth.uid();
    RETURN jsonb_build_object('saved', true, 'cleared', true, 'part_id', p_exam_part_id, 'blank_number', p_blank_number);
  END IF;
  SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_key.accepted_answers) accepted(answer) WHERE lower(regexp_replace(trim(accepted.answer), '\s+', ' ', 'g')) = v_answer) INTO v_correct;
  INSERT INTO public.contest_gap_fill_responses (contest_id, exam_part_id, blank_number, user_id, answer, is_correct, score)
  VALUES (v_contest.id, p_exam_part_id, p_blank_number, auth.uid(), v_answer, v_correct, CASE WHEN v_correct THEN v_key.points ELSE 0 END)
  ON CONFLICT (exam_part_id, blank_number, user_id) DO UPDATE SET answer = EXCLUDED.answer, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'blank_number', p_blank_number);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_cefr_matching_response(p_exam_part_id uuid, p_speaker_number integer, p_option_position integer)
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
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR NOT ((v_part.section = 'listening' AND v_part.position IN (3, 4)) OR (v_part.section = 'reading' AND v_part.position IN (2, 3))) THEN RAISE EXCEPTION 'CEFR matching part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF v_contest.subject <> 'cefr' OR NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Answers are not accepted for this contest at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  PERFORM public.assert_exam_section_open(v_contest.id, v_part.section);
  SELECT * INTO v_speaker FROM public.contest_matching_speakers WHERE exam_part_id = p_exam_part_id AND speaker_number = p_speaker_number;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.contest_matching_options WHERE exam_part_id = p_exam_part_id AND option_position = p_option_position) THEN RAISE EXCEPTION 'Invalid matching item or option'; END IF;
  v_correct := p_option_position = v_speaker.correct_option_position;
  INSERT INTO public.contest_matching_responses (contest_id, exam_part_id, speaker_number, user_id, option_position, is_correct, score)
  VALUES (v_contest.id, p_exam_part_id, p_speaker_number, auth.uid(), p_option_position, v_correct, CASE WHEN v_correct THEN 1 ELSE 0 END)
  ON CONFLICT (exam_part_id, speaker_number, user_id) DO UPDATE SET option_position = EXCLUDED.option_position, is_correct = EXCLUDED.is_correct, score = EXCLUDED.score, submitted_at = now();
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'part_id', p_exam_part_id, 'speaker_number', p_speaker_number);
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_exam_writing_response(p_exam_part_id uuid, p_content text, p_submit boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_part public.contest_exam_parts%ROWTYPE;
  v_contest public.contests%ROWTYPE;
  v_submitted_at timestamptz;
  v_words integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit writing'; END IF;
  SELECT * INTO v_part FROM public.contest_exam_parts WHERE id = p_exam_part_id;
  IF NOT FOUND OR v_part.section <> 'writing' THEN RAISE EXCEPTION 'Writing part not found'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = v_part.contest_id;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'Writing is not accepted for this exam at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit writing to a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting writing'; END IF;
  IF EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = v_contest.id AND registration.user_id = auth.uid() AND registration.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'This exam has already been submitted'; END IF;
  PERFORM public.assert_exam_section_open(v_contest.id, 'writing');
  IF char_length(trim(coalesce(p_content, ''))) < 1 THEN RAISE EXCEPTION 'Writing response cannot be empty'; END IF;
  v_words := cardinality(regexp_split_to_array(trim(p_content), '\s+'));
  IF p_submit AND v_contest.subject = 'ielts' AND ((v_part.position = 8 AND v_words < 150) OR (v_part.position = 9 AND v_words < 250)) THEN
    RAISE EXCEPTION 'IELTS Writing Task % requires at least % words', CASE WHEN v_part.position = 8 THEN 1 ELSE 2 END, CASE WHEN v_part.position = 8 THEN 150 ELSE 250 END;
  END IF;
  SELECT submitted_at INTO v_submitted_at FROM public.contest_writing_submissions WHERE exam_part_id = p_exam_part_id AND user_id = auth.uid() FOR UPDATE;
  IF v_submitted_at IS NOT NULL THEN RAISE EXCEPTION 'This writing response has already been submitted'; END IF;
  INSERT INTO public.contest_writing_submissions (contest_id, exam_part_id, user_id, content, submitted_at)
  VALUES (v_contest.id, p_exam_part_id, auth.uid(), trim(p_content), CASE WHEN p_submit THEN now() ELSE NULL END)
  ON CONFLICT (exam_part_id, user_id) DO UPDATE SET content = EXCLUDED.content, submitted_at = CASE WHEN p_submit THEN now() ELSE NULL END, updated_at = now()
  RETURNING submitted_at INTO v_submitted_at;
  UPDATE public.contest_registrations SET last_activity_at = now() WHERE contest_id = v_contest.id AND user_id = auth.uid();
  RETURN jsonb_build_object('saved', true, 'submitted_at', v_submitted_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_exam_submission(p_contest_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_contest public.contests%ROWTYPE;
  v_question_count integer;
  v_answer_count integer;
  v_gap_fill_count integer;
  v_gap_fill_response_count integer;
  v_matching_count integer;
  v_matching_response_count integer;
  v_writing_count integer;
  v_writing_submitted_count integer;
  v_completed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.active_profile(auth.uid()) THEN RAISE EXCEPTION 'An active account is required to submit an exam'; END IF;
  SELECT * INTO v_contest FROM public.contests WHERE id = p_contest_id;
  IF NOT FOUND OR v_contest.subject NOT IN ('ielts', 'cefr') THEN RAISE EXCEPTION 'English exam not found'; END IF;
  IF NOT v_contest.is_published OR v_contest.archived_at IS NOT NULL OR now() < v_contest.start_at OR now() >= v_contest.end_at THEN RAISE EXCEPTION 'This exam cannot be submitted at this time'; END IF;
  IF v_contest.contest_type = 'rated' AND (v_contest.created_by = auth.uid() OR public.has_admin_access(auth.uid())) THEN RAISE EXCEPTION 'Contest managers cannot submit a rated exam'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contest_registrations registration WHERE registration.contest_id = p_contest_id AND registration.user_id = auth.uid()) THEN RAISE EXCEPTION 'Register for this exam before submitting'; END IF;
  SELECT completed_at INTO v_completed_at FROM public.contest_registrations WHERE contest_id = p_contest_id AND user_id = auth.uid() FOR UPDATE;
  IF v_completed_at IS NOT NULL THEN RETURN jsonb_build_object('completed_at', v_completed_at, 'already_completed', true); END IF;
  PERFORM public.assert_exam_section_open(p_contest_id, 'writing');
  SELECT count(*)::integer INTO v_question_count FROM public.contest_questions WHERE contest_id = p_contest_id;
  SELECT count(*)::integer INTO v_answer_count FROM public.contest_answers WHERE contest_id = p_contest_id AND user_id = auth.uid();
  IF v_answer_count <> v_question_count THEN RAISE EXCEPTION 'Answer every listening and reading question before submitting the exam'; END IF;
  SELECT count(*)::integer INTO v_gap_fill_count FROM public.contest_gap_fill_answer_keys WHERE contest_id = p_contest_id;
  SELECT count(*)::integer INTO v_gap_fill_response_count FROM public.contest_gap_fill_responses WHERE contest_id = p_contest_id AND user_id = auth.uid();
  IF v_gap_fill_response_count <> v_gap_fill_count THEN RAISE EXCEPTION 'Fill every CEFR gap-fill blank before submitting the exam'; END IF;
  SELECT count(*)::integer INTO v_matching_count FROM public.contest_matching_speakers WHERE contest_id = p_contest_id;
  SELECT count(*)::integer INTO v_matching_response_count FROM public.contest_matching_responses WHERE contest_id = p_contest_id AND user_id = auth.uid();
  IF v_matching_response_count <> v_matching_count THEN RAISE EXCEPTION 'Match every CEFR item before submitting the exam'; END IF;
  SELECT count(*)::integer INTO v_writing_count FROM public.contest_exam_parts WHERE contest_id = p_contest_id AND section = 'writing';
  SELECT count(*)::integer INTO v_writing_submitted_count FROM public.contest_writing_submissions submission JOIN public.contest_exam_parts part ON part.id = submission.exam_part_id WHERE submission.contest_id = p_contest_id AND submission.user_id = auth.uid() AND part.section = 'writing' AND submission.submitted_at IS NOT NULL;
  IF v_writing_submitted_count <> v_writing_count THEN RAISE EXCEPTION 'Submit every writing response before completing the exam'; END IF;
  UPDATE public.contest_registrations SET completed_at = now(), last_activity_at = now() WHERE contest_id = p_contest_id AND user_id = auth.uid() RETURNING completed_at INTO v_completed_at;
  RETURN jsonb_build_object('completed_at', v_completed_at, 'already_completed', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.exam_section_window(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_exam_section(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_exam_section_open(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_listening_section(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.end_contest_attempt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_contest_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_answer(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_contest_text_answer(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_gap_fill_response(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_exam_writing_response(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_exam_submission(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_exam_section(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_listening_section(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_contest_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contest_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_answer(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contest_text_answer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_gap_fill_response(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_cefr_matching_response(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_writing_response(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_exam_submission(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
