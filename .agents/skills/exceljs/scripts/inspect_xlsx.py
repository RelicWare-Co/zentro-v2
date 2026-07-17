#!/usr/bin/env python3
"""Inspect an XLSX package using only the Python standard library."""

from __future__ import annotations

import argparse
import json
import posixpath
import sys
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree


RELATIONSHIP_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate and summarize workbook OOXML parts."
    )
    parser.add_argument("workbook", type=Path, help="Path to an .xlsx file")
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    parser.add_argument(
        "--require-sheet",
        action="append",
        default=[],
        metavar="NAME",
        help="Fail unless the named worksheet exists; repeat as needed",
    )
    return parser.parse_args()


def parse_xml(archive: zipfile.ZipFile, part: str) -> ElementTree.Element:
    try:
        return ElementTree.fromstring(archive.read(part))
    except KeyError as error:
        raise ValueError(f"Missing required OOXML part: {part}") from error
    except ElementTree.ParseError as error:
        raise ValueError(f"Invalid XML in {part}: {error}") from error


def resolve_part(base_part: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(base_part), target))


def relationship_map(
    archive: zipfile.ZipFile, rels_part: str, base_part: str
) -> dict[str, str]:
    root = parse_xml(archive, rels_part)
    result: dict[str, str] = {}
    for relationship in root.findall("{*}Relationship"):
        rel_id = relationship.get("Id")
        target = relationship.get("Target")
        if rel_id and target:
            result[rel_id] = resolve_part(base_part, target)
    return result


def part_count(names: set[str], prefix: str, suffix: str = ".xml") -> int:
    return sum(
        1
        for name in names
        if name.startswith(prefix)
        and name.endswith(suffix)
        and "/_rels/" not in name
    )


def inspect_sheet(
    archive: zipfile.ZipFile, part: str, name: str, state: str
) -> dict[str, Any]:
    root = parse_xml(archive, part)
    cells = root.findall(".//{*}c")
    formulas = [cell for cell in cells if cell.find("{*}f") is not None]
    validations = root.findall(".//{*}dataValidation")
    conditional_formats = root.findall(".//{*}conditionalFormatting")
    merge_cells = root.findall(".//{*}mergeCell")
    hyperlinks = root.findall(".//{*}hyperlink")
    tables = root.findall(".//{*}tablePart")
    drawings = root.findall(".//{*}drawing")
    legacy_drawings = root.findall(".//{*}legacyDrawing")
    dimension = root.find("{*}dimension")
    auto_filter = root.find("{*}autoFilter")

    return {
        "name": name,
        "state": state,
        "part": part,
        "dimension": dimension.get("ref") if dimension is not None else None,
        "rows": len(root.findall(".//{*}sheetData/{*}row")),
        "cells": len(cells),
        "formulas": len(formulas),
        "formulas_without_cached_value": sum(
            1 for cell in formulas if cell.find("{*}v") is None
        ),
        "error_cells": sum(1 for cell in cells if cell.get("t") == "e"),
        "merged_ranges": len(merge_cells),
        "data_validations": len(validations),
        "conditional_format_ranges": len(conditional_formats),
        "hyperlinks": len(hyperlinks),
        "table_relationships": len(tables),
        "drawing_relationships": len(drawings),
        "legacy_drawing_relationships": len(legacy_drawings),
        "auto_filter": auto_filter.get("ref") if auto_filter is not None else None,
    }


def inspect_workbook(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ValueError(f"Workbook does not exist: {path}")

    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as error:
        raise ValueError(f"Not a valid ZIP/XLSX package: {path}") from error

    with archive:
        corrupt_part = archive.testzip()
        if corrupt_part:
            raise ValueError(f"CRC failure in OOXML part: {corrupt_part}")

        names = set(archive.namelist())
        for required in (
            "[Content_Types].xml",
            "_rels/.rels",
            "xl/workbook.xml",
            "xl/_rels/workbook.xml.rels",
        ):
            if required not in names:
                raise ValueError(f"Missing required OOXML part: {required}")

        workbook_root = parse_xml(archive, "xl/workbook.xml")
        relationships = relationship_map(
            archive, "xl/_rels/workbook.xml.rels", "xl/workbook.xml"
        )

        sheets: list[dict[str, Any]] = []
        warnings: list[str] = []
        for sheet_node in workbook_root.findall(".//{*}sheets/{*}sheet"):
            sheet_name = sheet_node.get("name", "")
            state = sheet_node.get("state", "visible")
            rel_id = sheet_node.get(f"{{{RELATIONSHIP_NS}}}id")
            part = relationships.get(rel_id or "")
            if not part or part not in names:
                warnings.append(
                    f"Worksheet {sheet_name!r} points to a missing part via {rel_id!r}"
                )
                continue
            sheet = inspect_sheet(archive, part, sheet_name, state)
            if sheet["formulas_without_cached_value"]:
                warnings.append(
                    f"Worksheet {sheet_name!r} has "
                    f"{sheet['formulas_without_cached_value']} formula(s) without cached values"
                )
            sheets.append(sheet)

        defined_names = workbook_root.findall(".//{*}definedNames/{*}definedName")
        package = {
            "tables": part_count(names, "xl/tables/table"),
            "pivot_tables": part_count(names, "xl/pivotTables/pivotTable"),
            "pivot_cache_definitions": part_count(
                names, "xl/pivotCache/pivotCacheDefinition"
            ),
            "pivot_cache_records": part_count(
                names, "xl/pivotCache/pivotCacheRecords"
            ),
            "charts": part_count(names, "xl/charts/chart"),
            "drawings": part_count(names, "xl/drawings/drawing"),
            "images": sum(1 for name in names if name.startswith("xl/media/")),
            "comments": part_count(names, "xl/comments"),
            "vml_drawings": sum(
                1
                for name in names
                if name.startswith("xl/drawings/vmlDrawing") and name.endswith(".vml")
            ),
            "control_properties": part_count(names, "xl/ctrlProps/ctrlProp"),
            "shared_strings": 1 if "xl/sharedStrings.xml" in names else 0,
            "styles": 1 if "xl/styles.xml" in names else 0,
            "defined_names": len(defined_names),
            "zip_parts": len(names),
        }

        return {
            "path": str(path.resolve()),
            "size_bytes": path.stat().st_size,
            "worksheets": sheets,
            "package": package,
            "warnings": warnings,
        }


def print_human(report: dict[str, Any]) -> None:
    print(f"Workbook: {report['path']}")
    print(f"Size: {report['size_bytes']} bytes")
    print(f"Worksheets: {len(report['worksheets'])}")
    for sheet in report["worksheets"]:
        print(
            "  - "
            f"{sheet['name']} [{sheet['state']}] "
            f"dimension={sheet['dimension'] or '-'} rows={sheet['rows']} "
            f"cells={sheet['cells']} formulas={sheet['formulas']} "
            f"tables={sheet['table_relationships']} validations={sheet['data_validations']}"
        )
    package = report["package"]
    print(
        "Package: "
        f"tables={package['tables']} pivots={package['pivot_tables']} "
        f"charts={package['charts']} drawings={package['drawings']} "
        f"images={package['images']} comments={package['comments']} "
        f"controls={package['control_properties']} parts={package['zip_parts']}"
    )
    for warning in report["warnings"]:
        print(f"Warning: {warning}", file=sys.stderr)


def main() -> int:
    args = parse_args()
    try:
        report = inspect_workbook(args.workbook)
    except (OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    actual_sheets = {sheet["name"] for sheet in report["worksheets"]}
    missing = [name for name in args.require_sheet if name not in actual_sheets]

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True))
    else:
        print_human(report)

    if missing:
        print(f"Error: missing required sheet(s): {', '.join(missing)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
