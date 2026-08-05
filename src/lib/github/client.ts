export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
}

export interface GitHubDiffFile {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  raw_url: string;
}

export interface GitHubDiffResponse {
  files: GitHubDiffFile[];
  commits: GitHubCommit[];
  status: string;
  ahead_by: number;
  behind_by: number;
}

export interface GitHubPullRequest {
  number: number;
  html_url: string;
  state: "open" | "closed";
  title: string;
}

export class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "AccessDiff-App",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`GitHub API Error (${res.status}): ${errorText}`);
    }

    return res.json() as Promise<T>;
  }

  /** Fetch repositories accessible to the user */
  async getUserRepos(sort: "updated" | "pushed" | "full_name" = "updated"): Promise<GitHubRepo[]> {
    return this.request<GitHubRepo[]>(`/user/repos?sort=${sort}&per_page=100`);
  }

  /** Fetch details of a single repository */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  /** Fetch recent commits of a repository */
  async getCommits(owner: string, repo: string, perPage = 20): Promise<GitHubCommit[]> {
    return this.request<GitHubCommit[]>(`/repos/${owner}/${repo}/commits?per_page=${perPage}`);
  }

  /** Fetch diff between two commits or branches */
  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<GitHubDiffResponse> {
    return this.request<GitHubDiffResponse>(`/repos/${owner}/${repo}/compare/${base}...${head}`);
  }

  /** Fetch repository file tree recursively */
  async getFileTree(owner: string, repo: string, branch = "main"): Promise<{ path: string; type: string }[]> {
    try {
      const res = await this.request<{ tree: { path: string; type: string }[] }>(
        `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      );
      return res.tree || [];
    } catch {
      // Fallback if branch is master or different
      const res = await this.request<{ tree: { path: string; type: string }[] }>(
        `/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
      );
      return res.tree || [];
    }
  }

  /** Fetch content of a specific file */
  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const query = ref ? `?ref=${ref}` : "";
    const res = await this.request<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${path}${query}`
    );
    if (res.encoding === "base64") {
      return Buffer.from(res.content, "base64").toString("utf-8");
    }
    return res.content;
  }

  /** Create a pull request from a branch containing approved fixes. */
  async createPullRequest(
    owner: string,
    repo: string,
    input: { title: string; body: string; head: string; base: string }
  ): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
}
