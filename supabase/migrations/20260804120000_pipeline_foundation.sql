CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_commit_sha TEXT NOT NULL,
  head_commit_sha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  current_stage TEXT,
  total_issues INTEGER NOT NULL DEFAULT 0 CHECK (total_issues >= 0),
  new_issues INTEGER NOT NULL DEFAULT 0 CHECK (new_issues >= 0),
  fixes_generated INTEGER NOT NULL DEFAULT 0 CHECK (fixes_generated >= 0),
  fixes_verified INTEGER NOT NULL DEFAULT 0 CHECK (fixes_verified >= 0),
  summary TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line_number INTEGER CHECK (line_number IS NULL OR line_number > 0),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'major', 'minor', 'advisory')),
  status TEXT NOT NULL DEFAULT 'open',
  is_regression BOOLEAN NOT NULL DEFAULT true,
  wcag_rule TEXT NOT NULL,
  wcag_rule_name TEXT,
  wcag_level TEXT CHECK (wcag_level IN ('A', 'AA', 'AAA')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  code_snippet TEXT,
  detected_by TEXT NOT NULL,
  raw_rule_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  pipeline_run_id UUID NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  before_code TEXT NOT NULL,
  after_code TEXT NOT NULL,
  diff_patch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generated',
  trust_score NUMERIC(5,2) CHECK (trust_score BETWEEN 0 AND 100),
  confidence NUMERIC(5,2) CHECK (confidence BETWEEN 0 AND 100),
  reasoning TEXT,
  iteration INTEGER NOT NULL DEFAULT 1 CHECK (iteration BETWEEN 1 AND 3),
  verification_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_project_created ON public.pipeline_runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_run ON public.pipeline_stages(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_issues_run ON public.issues(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_fixes_run ON public.fixes(pipeline_run_id);

ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own pipeline runs" ON public.pipeline_runs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access own pipeline stages" ON public.pipeline_stages FOR ALL
  USING (pipeline_run_id IN (SELECT id FROM public.pipeline_runs WHERE user_id = auth.uid()))
  WITH CHECK (pipeline_run_id IN (SELECT id FROM public.pipeline_runs WHERE user_id = auth.uid()));
CREATE POLICY "Users can access own pipeline issues" ON public.issues FOR ALL
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));
CREATE POLICY "Users can access own pipeline fixes" ON public.fixes FOR ALL
  USING (pipeline_run_id IN (SELECT id FROM public.pipeline_runs WHERE user_id = auth.uid()))
  WITH CHECK (pipeline_run_id IN (SELECT id FROM public.pipeline_runs WHERE user_id = auth.uid()));
