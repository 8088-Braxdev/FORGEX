
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(
  __dirname,
  "../src/lib/githubPublishRetry.ts"
);

const source = fs.readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);

const {
  createOrReusePullRequest,
  PublishRecoveryError,
} = loaded.exports;

const BASE = "a".repeat(40);
const TREE = "b".repeat(40);
const HEAD = "c".repeat(40);

function options(github) {
  return {
    github,
    key: Buffer.alloc(32, 8),
    actor: "test-developer",
    fullName: "test-owner/test-repo",
    baseBranch: "main",
    baseSha: BASE,
    treeSha: TREE,
    title: "Test changes",
    previousPRNumber: null,
    changedPaths: ["app.js"],
  };
}

test("invalid commit SHA is rejected before GitHub calls", async () => {
  let calls = 0;
  const args = options(async () => {
    calls++;
    throw new Error("Should not call GitHub");
  });

  args.baseSha = "invalid";

  await assert.rejects(
    createOrReusePullRequest(args),
    /invalid commit or tree SHA/
  );

  assert.equal(calls, 0);
});

test("conflicting existing branch is rejected without writes", async () => {
  let writes = 0;

  const github = async (url, method = "GET") => {
    if (method !== "GET") writes++;

    if (url.startsWith("/git/ref/heads/")) {
      return {
        ref: `refs/heads/${url.slice("/git/ref/heads/".length)}`,
        object: { type: "commit", sha: HEAD },
      };
    }

    if (url === `/git/commits/${HEAD}`) {
      return {
        sha: HEAD,
        message: "Different commit",
        tree: { sha: TREE },
        parents: [{ sha: BASE }],
      };
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  await assert.rejects(
    createOrReusePullRequest(options(github)),
    PublishRecoveryError
  );

  assert.equal(writes, 0);
});

test("existing matching PR is reused without new writes", async () => {
  let writes = 0;
  let branch = "";

  const github = async (url, method = "GET") => {
    if (method !== "GET") writes++;

    if (url.startsWith("/git/ref/heads/")) {
      branch = url.slice("/git/ref/heads/".length);
      return {
        ref: `refs/heads/${branch}`,
        object: { type: "commit", sha: HEAD },
      };
    }

    if (url === `/git/commits/${HEAD}`) {
      return {
        sha: HEAD,
        message: "Test changes",
        tree: { sha: TREE },
        parents: [{ sha: BASE }],
      };
    }

    if (url.startsWith("/pulls?")) {
      return [{
        number: 7,
        head: {
          ref: branch,
          sha: HEAD,
          repo: { full_name: "test-owner/test-repo" },
        },
        base: { ref: "main" },
      }];
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await createOrReusePullRequest(options(github));

  assert.equal(result.reused, true);
  assert.equal(result.number, 7);
  assert.equal(writes, 0);
});

test("advanced base branch blocks publishing", async () => {
  let writes = 0;

  const github = async (url, method = "GET") => {
    if (method !== "GET") writes++;

    if (url.startsWith("/git/ref/heads/")) {
      return {
        ref: `refs/heads/${url.slice("/git/ref/heads/".length)}`,
        object: { type: "commit", sha: HEAD },
      };
    }

    if (url === `/git/commits/${HEAD}`) {
      return {
        sha: HEAD,
        message: "Test changes",
        tree: { sha: TREE },
        parents: [{ sha: BASE }],
      };
    }

    if (url.startsWith("/pulls?")) return [];

    if (url === "/branches/main") {
      return { commit: { sha: "d".repeat(40) } };
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  await assert.rejects(
    createOrReusePullRequest(options(github)),
    (error) =>
      error instanceof PublishRecoveryError &&
      error.status === 409 &&
      /advanced/.test(error.message)
  );

  assert.equal(writes, 0);
});

test("lost PR response recovers the existing PR", async () => {
  let lookups = 0;
  let writes = 0;
  let branch = "";

  const github = async (url, method = "GET") => {
    if (method !== "GET") writes++;

    if (url.startsWith("/git/ref/heads/")) {
      branch = url.slice("/git/ref/heads/".length);
      return {
        ref: `refs/heads/${branch}`,
        object: { type: "commit", sha: HEAD },
      };
    }

    if (url === `/git/commits/${HEAD}`) {
      return {
        sha: HEAD,
        message: "Test changes",
        tree: { sha: TREE },
        parents: [{ sha: BASE }],
      };
    }

    if (url.startsWith("/pulls?")) {
      lookups++;

      if (lookups === 1) return [];

      return [{
        number: 12,
        head: {
          ref: branch,
          sha: HEAD,
          repo: { full_name: "test-owner/test-repo" },
        },
        base: { ref: "main" },
      }];
    }

    if (url === "/branches/main") {
      return { commit: { sha: BASE } };
    }

    if (url === "/pulls" && method === "POST") {
      throw new Error("Response lost after PR creation");
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await createOrReusePullRequest(
    options(github)
  );

  assert.equal(result.reused, true);
  assert.equal(result.number, 12);
  assert.equal(lookups, 2);
  assert.equal(writes, 1);
});
