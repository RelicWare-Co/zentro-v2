import { execFileSync } from "node:child_process";

const runGit = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

const runGitInherit = (args) => {
  execFileSync("git", args, { stdio: "inherit" });
};

console.log("Setting core.autocrlf=false for this repository…");
runGitInherit(["config", "core.autocrlf", "false"]);

console.log("Re-normalizing line endings from .gitattributes…");
runGitInherit(["add", "--renormalize", "."]);

const porcelain = runGit(["status", "--porcelain"]);
let restored = 0;

for (const line of porcelain.split("\n")) {
  if (!line.trim()) {
    continue;
  }

  const indexStatus = line.slice(0, 2);
  if (indexStatus.includes("?")) {
    continue;
  }

  const file = line.slice(3).trim();
  const unstagedDiff = runGit(["diff", "--", file]);
  const stagedDiff = runGit(["diff", "--cached", "--", file]);

  if (unstagedDiff || stagedDiff) {
    continue;
  }

  runGitInherit(["restore", "--staged", "--worktree", "--", file]);
  restored += 1;
}

console.log(
  restored > 0
    ? `Restored ${restored} file(s) with line-ending-only noise.`
    : "No line-ending-only files to restore."
);
runGitInherit(["status", "--short"]);
