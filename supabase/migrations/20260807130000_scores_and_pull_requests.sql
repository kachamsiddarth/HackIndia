-- Migration to create missing accessibility_scores and pull_requests tables

CREATE TABLE IF NOT EXISTS public.accessibility_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pipeline_run_id UUID REFERENCES public.pipeline_runs(id) ON DELETE SET NULL,
  commit_sha TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  total_issues INTEGER DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,
  major_issues INTEGER DEFAULT 0,
  minor_issues INTEGER DEFAULT 0,
  advisory_issues INTEGER DEFAULT 0,
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, commit_sha)
);

CREATE INDEX IF NOT EXISTS idx_scores_project_id ON public.accessibility_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_scores_measured_at ON public.accessibility_scores(project_id, measured_at DESC);

CREATE TABLE IF NOT EXISTS public.pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES public.pipeline_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  github_pr_number INTEGER NOT NULL,
  github_pr_url TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT DEFAULT 'open',
  files_modified INTEGER DEFAULT 0,
  issues_addressed INTEGER DEFAULT 0,
  score_improvement NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pull_requests_pipeline_run_id ON public.pull_requests(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_pull_requests_project_id ON public.pull_requests(project_id);

ALTER TABLE public.accessibility_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own scores"
  ON public.accessibility_scores FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access own PRs"
  ON public.pull_requests FOR ALL
  USING (auth.uid() = user_id);
