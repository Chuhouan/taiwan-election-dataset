"""Count token and literal style values in checked-in CSS and inline styles."""

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DECLARATION = re.compile(r"(?:^|[;{])\s*([a-z-]+)\s*:\s*([^;{}]+)", re.I)
VALUE = re.compile(
    r"var\(\s*(--[\w-]+)(?:\s*,[^()]*)?\s*\)"
    r"|#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|oklch)\([^()]*\)"
    r"|(?<![\w.-])-?(?:\d*\.)?\d+(?:px|rem|em)\b|\b(?:white|black)\b",
    re.I,
)
INLINE_STYLE = re.compile(r"""\bstyle=(["'])(.*?)\1""", re.S)
CSS_COMMENT = re.compile(r"/\*.*?\*/", re.S)
GROUPS = ("color", "fontSize", "spacing", "radius")


def property_group(prop):
    if prop in {"font", "font-size"}:
        return "fontSize"
    if prop.endswith("radius"):
        return "radius"
    if prop.endswith("gap") or prop.startswith(("padding", "margin")):
        return "spacing"
    if prop in {"fill", "stroke", "filter", "background", "outline"} or (
        "color" in prop or prop.startswith(("background-", "border", "outline-"))
        or prop.endswith("shadow")
    ):
        return "color"
    return None


def token_group(name):
    if name.startswith(("--font-", "--text-")) and name not in {
        "--font-stack", "--font-ui", "--font-data", "--text-filter",
        "--text-highlight", "--text-label", "--text-secondary", "--text-subtle",
    }:
        return "fontSize"
    if name.startswith("--space-"):
        return "spacing"
    if name.startswith("--radius-"):
        return "radius"
    return "color"


def audit(root):
    css_files = sorted((root / "src/styles").glob("*.css"))
    token_names = set(re.findall(r"(--[\w-]+)\s*:", (root / "src/styles/tokens.css").read_text(encoding="utf-8")))
    sources = []
    for path in css_files:
        if path.name != "tokens.css":
            css = path.read_text(encoding="utf-8")
            sources.append((path, CSS_COMMENT.sub(lambda m: "\n" * m[0].count("\n"), css), 0))

    skipped_dynamic = 0
    for path in [root / "index.html", *sorted((root / "src").rglob("*.js"))]:
        source = path.read_text(encoding="utf-8")
        for match in INLINE_STYLE.finditer(source):
            inline = match[2]
            if any(part in inline for part in ("${", "' +", '" +', "\\")):
                skipped_dynamic += 1
            else:
                sources.append((path, inline, source.count("\n", 0, match.start(2))))

    references = Counter()
    literals = defaultdict(Counter)
    locations = defaultdict(list)
    for path, source, line_offset in sources:
        for declaration in DECLARATION.finditer(source):
            prop, value = declaration.groups()
            group = property_group(prop)
            if not group or prop.startswith("--"):
                continue
            for match in VALUE.finditer(value):
                name = match[1]
                if name:
                    if name in token_names and token_group(name) == group:
                        references[group] += 1
                        if prop == "font":
                            break
                    continue
                literal = match[0].lower()
                is_length = bool(re.match(r"-?(?:\d*\.)?\d", literal))
                if (group == "color") == is_length or (is_length and not float(re.sub(r"[a-z]+$", "", literal))):
                    continue
                literals[group][literal] += 1
                if len(locations[group, literal]) < 3:
                    line = line_offset + source.count("\n", 0, declaration.start(1)) + 1
                    locations[group, literal].append(f"{path.relative_to(root).as_posix()}:{line}")
                if prop == "font":
                    break

    summary = {}
    for group in GROUPS:
        count = literals[group].total()
        total = count + references[group]
        summary[group] = {
            "tokenValues": references[group],
            "literalValues": count,
            "coveragePct": round(100 * references[group] / total, 1) if total else None,
            "frequentLiterals": [
                {"value": value, "count": n, "examples": locations[group, value]}
                for value, n in literals[group].most_common(8)
            ],
        }
    return {
        "scope": "src/styles CSS and static inline style attributes in index.html and src JavaScript",
        "excluded": "Token definitions, geometry dimensions, unitless/zero/percentage lengths, dynamic inline values and SVG attributes",
        "skippedDynamicInlineStyles": skipped_dynamic,
        "categories": summary,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = json.dumps(audit(ROOT), ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(report, encoding="utf-8")
    else:
        print(report, end="")
