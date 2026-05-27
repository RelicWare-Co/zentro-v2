#!/usr/bin/env python3
"""Static checks for Maestro flow workspaces.

This script intentionally performs lightweight checks that do not require the
Maestro CLI. It is a preflight helper, not a replacement for `maestro test`.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    import yaml  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - optional dependency
    yaml = None


YAML_BOOL_WORDS = {
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "on",
    "On",
    "ON",
    "off",
    "Off",
    "OFF",
}

FLOW_EXTENSIONS = {".yaml", ".yml"}
REFERENCE_EXTENSIONS = {".yaml", ".yml", ".js", ".png", ".jpg", ".jpeg", ".gif", ".mp4"}
SKIPPED_DIRS = {".git", ".agents", ".github", ".vscode", "node_modules"}


@dataclass(frozen=True)
class Finding:
    severity: str
    path: Path
    line: int
    message: str

    def render(self) -> str:
        location = f"{self.path}:{self.line}" if self.line else str(self.path)
        return f"{self.severity}: {location}: {self.message}"


def iter_candidate_files(paths: Iterable[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            for child in path.rglob("*"):
                if any(part in SKIPPED_DIRS for part in child.parts):
                    continue
                if child.is_file() and child.suffix.lower() in FLOW_EXTENSIONS:
                    files.append(child)
        elif path.is_file() and path.suffix.lower() in FLOW_EXTENSIONS:
            files.append(path)
    return sorted(set(files))


def split_flow(text: str) -> tuple[str, str | None]:
    match = re.search(r"(?m)^---\s*$", text)
    if not match:
        return text, None
    return text[: match.start()], text[match.end() :]


def strip_inline_comment(value: str) -> str:
    in_single = False
    in_double = False
    for index, char in enumerate(value):
        if char == "'" and not in_double:
            in_single = not in_single
        elif char == '"' and not in_single:
            in_double = not in_double
        elif char == "#" and not in_single and not in_double:
            return value[:index].strip()
    return value.strip()


def is_quoted(value: str) -> bool:
    value = value.strip()
    return len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}


def find_bool_coercion_traps(path: Path, lines: list[str]) -> list[Finding]:
    findings: list[Finding] = []
    command_value_pattern = re.compile(r"^(\s*-\s*[A-Za-z][A-Za-z0-9]*\s*:\s*)([^#]+)")
    key_value_pattern = re.compile(r"^(\s*[A-Za-z][A-Za-z0-9_-]*\s*:\s*)([^#]+)")

    for number, line in enumerate(lines, start=1):
        for pattern in (command_value_pattern, key_value_pattern):
            match = pattern.match(line)
            if not match:
                continue
            raw_value = strip_inline_comment(match.group(2))
            if raw_value in YAML_BOOL_WORDS and not is_quoted(raw_value):
                findings.append(
                    Finding(
                        "WARN",
                        path,
                        number,
                        f"quote `{raw_value}` so YAML does not coerce it to a boolean",
                    )
                )
            break
    return findings


def find_literal_dollar_traps(path: Path, lines: list[str]) -> list[Finding]:
    findings: list[Finding] = []
    selector_pattern = re.compile(r"^\s*-\s*(assertVisible|assertNotVisible|tapOn)\s*:\s+(.+)$")
    for number, line in enumerate(lines, start=1):
        match = selector_pattern.match(line)
        if not match:
            continue
        value = strip_inline_comment(match.group(2))
        if "$" in value and "${" not in value and r"\$" not in value:
            findings.append(
                Finding(
                    "WARN",
                    path,
                    number,
                    "literal dollar signs in selectors should usually be escaped as `\\$`",
                )
            )
    return findings


def find_non_ascii_input_text(path: Path, lines: list[str]) -> list[Finding]:
    findings: list[Finding] = []
    input_pattern = re.compile(r"^\s*-\s*inputText\s*:\s*(.+)$")
    for number, line in enumerate(lines, start=1):
        match = input_pattern.match(line)
        if not match:
            continue
        value = strip_inline_comment(match.group(1))
        if any(ord(char) > 127 for char in value):
            findings.append(
                Finding(
                    "WARN",
                    path,
                    number,
                    "Android `inputText` supports ASCII only; use clipboard, fixtures, or platform-specific handling for Unicode",
                )
            )
    return findings


def find_possible_missing_separator(path: Path, text: str) -> list[Finding]:
    if path.name == "config.yaml":
        return []
    header, body = split_flow(text)
    if body is not None:
        return []
    if re.search(r"(?m)^\s*(appId|url|tags|name|env|onFlowStart|onFlowComplete)\s*:", header):
        return [
            Finding(
                "WARN",
                path,
                1,
                "flow-like file has header keys but no `---` command separator",
            )
        ]
    return []


def extract_references(path: Path, lines: list[str]) -> list[tuple[int, Path]]:
    refs: list[tuple[int, Path]] = []
    shorthand = re.compile(r"^\s*-\s*(runFlow|runScript)\s*:\s*([^#'{\"\\[]\S+)\s*$")
    key_file = re.compile(r"^\s*file\s*:\s*['\"]?([^'\"#]+?)['\"]?\s*(?:#.*)?$")
    media_item = re.compile(r"^\s*-\s*['\"]?([^'\"#]+?\.(?:png|jpe?g|gif|mp4))['\"]?\s*(?:#.*)?$", re.I)

    in_add_media = False
    add_media_indent = 0

    for number, line in enumerate(lines, start=1):
        short_match = shorthand.match(line)
        if short_match:
            refs.append((number, (path.parent / short_match.group(2).strip()).resolve()))

        file_match = key_file.match(line)
        if file_match:
            candidate = file_match.group(1).strip()
            if Path(candidate).suffix.lower() in REFERENCE_EXTENSIONS:
                refs.append((number, (path.parent / candidate).resolve()))

        if re.match(r"^\s*-\s*addMedia\s*:\s*$", line):
            in_add_media = True
            add_media_indent = len(line) - len(line.lstrip())
            continue

        if in_add_media:
            current_indent = len(line) - len(line.lstrip())
            if line.strip() and current_indent <= add_media_indent:
                in_add_media = False
            else:
                media_match = media_item.match(line)
                if media_match:
                    refs.append((number, (path.parent / media_match.group(1).strip()).resolve()))

    return refs


def find_missing_references(path: Path, lines: list[str]) -> list[Finding]:
    findings: list[Finding] = []
    for number, referenced_path in extract_references(path, lines):
        if not referenced_path.exists():
            findings.append(
                Finding(
                    "ERROR",
                    path,
                    number,
                    f"referenced file does not exist: {referenced_path}",
                )
            )
    return findings


def parse_yaml_if_available(path: Path, text: str) -> list[Finding]:
    if yaml is None:
        return [
            Finding(
                "INFO",
                path,
                0,
                "PyYAML is not installed; skipped full YAML parse",
            )
        ]
    try:
        list(yaml.safe_load_all(text))
    except Exception as error:
        return [Finding("ERROR", path, 0, f"YAML parser error: {error}")]
    return []


def check_file(path: Path) -> list[Finding]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    findings: list[Finding] = []
    findings.extend(parse_yaml_if_available(path, text))
    findings.extend(find_possible_missing_separator(path, text))
    findings.extend(find_bool_coercion_traps(path, lines))
    findings.extend(find_literal_dollar_traps(path, lines))
    findings.extend(find_non_ascii_input_text(path, lines))
    findings.extend(find_missing_references(path, lines))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="Run static checks for Maestro YAML flows.")
    parser.add_argument("paths", nargs="+", type=Path, help="Flow files or directories to check")
    parser.add_argument(
        "--warnings-as-errors",
        action="store_true",
        help="Exit non-zero when warnings are found",
    )
    args = parser.parse_args()

    files = iter_candidate_files(args.paths)
    if not files:
        print("No Maestro YAML files found.", file=sys.stderr)
        return 1

    findings: list[Finding] = []
    for file_path in files:
        findings.extend(check_file(file_path))

    visible_findings = [finding for finding in findings if finding.severity != "INFO"]
    for finding in findings:
        print(finding.render())

    error_count = sum(1 for finding in findings if finding.severity == "ERROR")
    warning_count = sum(1 for finding in findings if finding.severity == "WARN")
    info_count = sum(1 for finding in findings if finding.severity == "INFO")

    print(
        f"Checked {len(files)} file(s): {error_count} error(s), "
        f"{warning_count} warning(s), {info_count} info message(s)."
    )

    if error_count:
        return 1
    if args.warnings_as_errors and visible_findings:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
