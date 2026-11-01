"use client";

import { useEffect, useMemo, useState } from "react";

type Repo = {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  archived: boolean;
};

export default function GitHubRepositoryPicker({
  onChoose,
}: {
  onChoose: (url: string, isPrivate: boolean) => void;
}) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [partial, setPartial] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/github/repositories", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load repositories");
        }

        return data as {
          repositories: Repo[];
          partial: boolean;
        };
      })
      .then((data) => {
        setRepos(data.repositories);
        setPartial(data.partial);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMessage(
            error instanceof Error ? error.message : "Repository lookup failed",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const visible = useMemo(
    () =>
      repos.filter((repo) =>
        repo.fullName.toLowerCase().includes(search.toLowerCase()),
      ),
    [repos, search],
  );

  return (
    <div
      className="forgex-repo-picker"
      style={{
        border: "1px solid #344953",
        borderRadius: 8,
        padding: 10,
      }}
    >
      <strong style={{ fontSize: 12 }}>Installed GitHub repositories</strong>

      {loading && <p>Loading repositories...</p>}

      {message && (
        <p role="status">{message} You can still paste a public URL below.</p>
      )}

      {!loading && !message && (
        <>
          <input
            aria-label="Filter GitHub repositories"
            placeholder="Filter repositories"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              width: "100%",
              marginTop: 8,
            }}
          />

          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              display: "grid",
              gap: 6,
              marginTop: 8,
            }}
          >
            {visible.map((repo) => {
const available = !repo.archived;

              return (
                <button
                  type="button"
                  key={repo.fullName}
                  disabled={!available}
         
onClick={() =>
  onChoose(
    `https://github.com/${repo.fullName}`,
    repo.private
  )
}

                  title={
                    available
                      ? `Select ${repo.fullName}`
: "Archived repository"
                  }
                  style={{
                    textAlign: "left",
                    padding: 8,
                  }}
                >
                  <strong>{repo.fullName}</strong>

                  <small style={{ display: "block" }}>
                    {repo.private
                     ? `Private · ${repo.defaultBranch}`
                      : repo.archived
                        ? "Archived"
                        : `Public · ${repo.defaultBranch}`}
                  </small>
                </button>
              );
            })}

            {!visible.length && (
              <p>No matching repositories. You can paste a public URL.</p>
            )}
          </div>

          {partial && (
            <p style={{ fontSize: 11 }}>
              Showing a limited set of repositories. Use a URL for others.
            </p>
          )}
        </>
      )}
    </div>
  );
}
