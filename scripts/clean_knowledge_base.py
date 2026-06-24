#!/usr/bin/env python3
"""
Knowledge Base Cleaner for Tartan Scotty
-----------------------------------------
Cleans all .txt files in the knowledge-base/ directory by:
  1. Validating required headers (TOPIC, SECTION, ---)
  2. Stripping trailing whitespace from every line
  3. Collapsing 3+ consecutive blank lines down to 1
  4. Removing exact duplicate lines within a document body
  5. Reporting a summary of every change made

Usage:
  python scripts/clean_knowledge_base.py              # preview changes (dry run)
  python scripts/clean_knowledge_base.py --apply      # apply changes to files
  python scripts/clean_knowledge_base.py --strict     # fail (exit 1) on header errors only
"""

import os
import re
import sys
import argparse
from pathlib import Path

KB_ROOT = Path(__file__).parent.parent / "knowledge-base"
REQUIRED_HEADER_FIELDS = ["TOPIC:", "SECTION:"]


def parse_file(content):
    """Split a KB file into header lines and body lines."""
    lines = content.splitlines()
    divider_idx = next((i for i, l in enumerate(lines) if l.strip() == "---"), None)
    if divider_idx is None:
        return lines[:8], lines[8:]
    return lines[: divider_idx + 1], lines[divider_idx + 1 :]


def validate_headers(header_lines, filepath):
    """Check that required fields are present. Returns list of warning strings."""
    warnings = []
    header_text = "\n".join(header_lines)
    for field in REQUIRED_HEADER_FIELDS:
        if field not in header_text:
            warnings.append(f"  ⚠️  Missing '{field}' header")
    if "---" not in header_text:
        warnings.append("  ⚠️  Missing '---' divider between header and body")
    return warnings


def clean_body(body_lines):
    """Apply all cleaning rules to the body. Returns (cleaned_lines, changes)."""
    changes = []

    # 1. Strip trailing whitespace
    stripped = [l.rstrip() for l in body_lines]
    trailing_fixed = sum(1 for a, b in zip(body_lines, stripped) if a != b)
    if trailing_fixed:
        changes.append(f"  ✂️  Stripped trailing whitespace from {trailing_fixed} line(s)")

    # 2. Collapse 3+ consecutive blank lines into 1
    collapsed = []
    blank_run = 0
    collapsed_count = 0
    for line in stripped:
        if line == "":
            blank_run += 1
            if blank_run <= 2:
                collapsed.append(line)
            else:
                collapsed_count += 1
        else:
            blank_run = 0
            collapsed.append(line)
    if collapsed_count:
        changes.append(f"  📋  Collapsed {collapsed_count} excess blank line(s)")

    # 3. Remove exact duplicate non-empty lines (keep first occurrence)
    seen = set()
    deduped = []
    dup_count = 0
    for line in collapsed:
        if line.strip() == "":
            deduped.append(line)
            continue
        if line in seen:
            dup_count += 1
        else:
            seen.add(line)
            deduped.append(line)
    if dup_count:
        changes.append(f"  🔁  Removed {dup_count} duplicate line(s)")

    # 4. Remove leading/trailing blank lines from the body
    while deduped and deduped[0].strip() == "":
        deduped.pop(0)
    while deduped and deduped[-1].strip() == "":
        deduped.pop()

    return deduped, changes


def process_file(filepath, apply=False):
    """Process one file. Returns (header_errors, had_format_issues, report_lines)."""
    report = [f"\n📄 {filepath.relative_to(KB_ROOT)}"]
    original = filepath.read_text(encoding="utf-8")

    header_lines, body_lines = parse_file(original)
    warnings = validate_headers(header_lines, filepath)
    cleaned_body, changes = clean_body(body_lines)

    report.extend(warnings)
    report.extend(changes)

    header_errors = len(warnings) > 0
    had_format_issues = len(changes) > 0

    if not header_errors and not had_format_issues:
        report.append("  ✅  Clean — no issues found")
        return header_errors, had_format_issues, report

    # Reconstruct cleaned file
    cleaned_header = [l.rstrip() for l in header_lines]
    cleaned_content = "\n".join(cleaned_header) + "\n" + "\n".join(cleaned_body) + "\n"

    if apply and cleaned_content != original:
        filepath.write_text(cleaned_content, encoding="utf-8")
        report.append("  💾  File updated")

    return header_errors, had_format_issues, report


def main():
    parser = argparse.ArgumentParser(description="Clean CMU-Q knowledge base files")
    parser.add_argument("--apply", action="store_true", help="Apply changes (default: dry run)")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with code 1 if any file is missing required headers (for kb:validate)",
    )
    args = parser.parse_args()

    if not KB_ROOT.exists():
        print(f"❌ Knowledge base directory not found: {KB_ROOT}")
        sys.exit(1)

    txt_files = sorted(KB_ROOT.rglob("*.txt"))
    if not txt_files:
        print("❌ No .txt files found in knowledge-base/")
        sys.exit(1)

    if args.strict:
        header_failures = []
        for filepath in txt_files:
            original = filepath.read_text(encoding="utf-8")
            header_lines, _ = parse_file(original)
            warnings = validate_headers(header_lines, filepath)
            if warnings:
                header_failures.append((filepath.relative_to(KB_ROOT), warnings))

        if header_failures:
            print(f"❌ {len(header_failures)} file(s) missing required headers:")
            for rel_path, warnings in header_failures:
                print(f"\n📄 {rel_path}")
                for w in warnings:
                    print(w)
            sys.exit(1)

        print(f"✓ All {len(txt_files)} knowledge-base files have valid headers")
        sys.exit(0)

    mode = "APPLYING CHANGES" if args.apply else "DRY RUN (use --apply to save changes)"
    print(f"\n{'='*55}")
    print(f"  Tartan Scotty — Knowledge Base Cleaner ({mode})")
    print(f"{'='*55}")
    print(f"  Found {len(txt_files)} files in {KB_ROOT}\n")

    total_issues = 0
    header_error_count = 0
    for filepath in txt_files:
        header_errors, had_format_issues, report = process_file(filepath, apply=args.apply)
        if header_errors or had_format_issues:
            total_issues += 1
        if header_errors:
            header_error_count += 1
        print("\n".join(report))

    print(f"\n{'='*55}")
    if total_issues == 0:
        print("  🎉  All files are clean!")
    else:
        print(f"  📊  {total_issues}/{len(txt_files)} file(s) had issues")
        if header_error_count:
            print(f"  ⚠️  {header_error_count} file(s) have header validation errors")
        if not args.apply:
            print("  👉  Run with --apply to fix formatting issues automatically")
    print(f"{'='*55}\n")

    if header_error_count:
        sys.exit(1)


if __name__ == "__main__":
    main()
