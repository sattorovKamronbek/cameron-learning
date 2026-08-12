-- Repair the public RPC signature used by the Programming management screen.
-- The NOTIFY makes PostgREST refresh its schema cache immediately after deploy.

CREATE OR REPLACE FUNCTION public.save_programming_problem(
  p_title text,
  p_statement text,
  p_input_description text,
  p_output_description text,
  p_constraints text,
  p_examples jsonb,
  p_time_limit_ms integer,
  p_memory_limit_mb integer,
  p_difficulty text,
  p_tags text[],
  p_editorial text,
  p_publication_scope text,
  p_test_cases jsonb,
  p_problem_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_problem_id uuid;
  v_test record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only active judges or admins can manage programming problems';
  END IF;

  IF char_length(trim(coalesce(p_title, ''))) < 3
    OR char_length(trim(coalesce(p_statement, ''))) < 1
    OR p_time_limit_ms NOT BETWEEN 50 AND 60000
    OR p_memory_limit_mb NOT BETWEEN 16 AND 1024
    OR p_difficulty NOT IN ('easy', 'medium', 'hard')
    OR p_publication_scope NOT IN ('site', 'contest')
    OR jsonb_typeof(coalesce(p_examples, 'null'::jsonb)) <> 'array'
    OR jsonb_typeof(coalesce(p_test_cases, 'null'::jsonb)) <> 'array'
    OR jsonb_array_length(CASE WHEN jsonb_typeof(p_test_cases) = 'array' THEN p_test_cases ELSE '[]'::jsonb END) < 1 THEN
    RAISE EXCEPTION 'Invalid programming problem data';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_examples) AS example(value)
    WHERE coalesce(jsonb_typeof(example.value -> 'input'), '') <> 'string'
       OR coalesce(jsonb_typeof(example.value -> 'output'), '') <> 'string'
       OR (example.value ? 'explanation' AND example.value -> 'explanation' <> 'null'::jsonb AND jsonb_typeof(example.value -> 'explanation') <> 'string')
  ) THEN
    RAISE EXCEPTION 'Problem examples must contain text input and output';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_test_cases) AS test_case(value)
    WHERE coalesce(jsonb_typeof(test_case.value -> 'input'), '') <> 'string'
       OR coalesce(jsonb_typeof(test_case.value -> 'output'), '') <> 'string'
       OR coalesce(
         CASE WHEN coalesce(test_case.value ->> 'weight', '') ~ '^[0-9]+$'
           THEN (test_case.value ->> 'weight')::integer
           ELSE 0
         END,
         0
       ) NOT BETWEEN 1 AND 100
  ) THEN
    RAISE EXCEPTION 'Every judge test requires input, output and a valid weight';
  END IF;

  IF p_problem_id IS NULL THEN
    INSERT INTO public.programming_problems (
      slug, title, statement, input_description, output_description, constraints,
      examples, time_limit_ms, memory_limit_mb, difficulty, tags, editorial,
      publication_scope, created_by
    ) VALUES (
      public.programming_problem_slug(p_title), trim(p_title), trim(p_statement),
      trim(coalesce(p_input_description, '')), trim(coalesce(p_output_description, '')),
      trim(coalesce(p_constraints, '')), p_examples, p_time_limit_ms, p_memory_limit_mb,
      p_difficulty, coalesce(p_tags, ARRAY[]::text[]), nullif(trim(p_editorial), ''),
      p_publication_scope, auth.uid()
    ) RETURNING id INTO v_problem_id;
  ELSE
    IF NOT public.can_manage_programming_problem(p_problem_id) THEN
      RAISE EXCEPTION 'Only the owner judge or an administrator can edit this problem';
    END IF;

    UPDATE public.programming_problems
    SET title = trim(p_title), statement = trim(p_statement),
        input_description = trim(coalesce(p_input_description, '')),
        output_description = trim(coalesce(p_output_description, '')),
        constraints = trim(coalesce(p_constraints, '')), examples = p_examples,
        time_limit_ms = p_time_limit_ms, memory_limit_mb = p_memory_limit_mb,
        difficulty = p_difficulty, tags = coalesce(p_tags, ARRAY[]::text[]),
        editorial = nullif(trim(p_editorial), ''), publication_scope = p_publication_scope
    WHERE id = p_problem_id
    RETURNING id INTO v_problem_id;

    IF v_problem_id IS NULL THEN RAISE EXCEPTION 'Programming problem not found'; END IF;
    DELETE FROM public.programming_problem_test_cases WHERE problem_id = v_problem_id;
  END IF;

  FOR v_test IN
    SELECT * FROM jsonb_to_recordset(p_test_cases)
      AS test_case(input text, output text, is_sample boolean, weight integer)
  LOOP
    INSERT INTO public.programming_problem_test_cases (problem_id, input, output, is_sample, weight)
    VALUES (v_problem_id, v_test.input, v_test.output, coalesce(v_test.is_sample, false), v_test.weight);
  END LOOP;

  PERFORM public.log_audit_action(
    CASE WHEN p_problem_id IS NULL THEN 'programming_problem.create' ELSE 'programming_problem.update' END,
    'programming_problem', v_problem_id,
    jsonb_build_object('publication_scope', p_publication_scope)
  );
  RETURN v_problem_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_programming_problem(text, text, text, text, text, jsonb, integer, integer, text, text[], text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_programming_problem(text, text, text, text, text, jsonb, integer, integer, text, text[], text, text, jsonb, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
