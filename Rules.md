# Project Rules

## Tooling

- **Always use `uv`** — never `pip`, `venv`, or `pipx`. Environment is created
  with `uv sync` (pins from `pyproject.toml`/`uv.lock`) and scripts run via
  `uv run python scripts/<script>.py`.
- Python >= 3.11. Dependencies are pinned exactly — do not loosen pins.

## Architecture

- `scripts/downloaders/` — one `BaseFundDownloader` subclass per fund,
  auto-discovered by `sync_all_funds.py` via `FUND_KEY`. Only
  `find_download_link()` and `get_output_filename()` are per-fund.
- `scripts/funds_config.py` — single source of truth for fund metadata
  (display name, normalized filename prefix, excel folder, `sheet_match`).
- `scripts/extract_all_funds.py` — converts everything in `excel-data/` to
  per-month JSON in `data/` (`{NormalizedName}-{Month}-{Year}.json`).
- `scripts/generate_manifest.py` — rebuilds `data/manifest.json` for the
  frontend after extraction. Always run it after extracting.
- Frontend: vanilla JS + Chart.js, no build step (`index.html`, `js/`, `css/`).

## Sync workflow

- `uv run python scripts/sync_all_funds.py [--year Y --month M] [--months N]
  [--fund KEY] [--force] [--skip-extraction] [--skip-verification] [--list]`
- Default target = previous calendar month. Factsheets are typically published
  around the 5th–10th of the following month — a "not published yet" failure is
  normal early in the month; retry later rather than treating as a bug.
- Mirae Asset historically required manual download (JS-rendered site); save
  files to `excel-data/mirae-asset/` then re-run extraction.

## Data conventions

- `excel-data/` and `logs/` are gitignored — never commit them.
- Downloads are validated (min rows, fund-name keywords); files failing
  validation are deleted — do not bypass validation to force a file through.
- Company names are normalized during extraction (generic patterns, no
  hardcoded per-stock fixes). Keep it that way.

## Deferred markers

- Any `TODO`, `pending`, `review`, stub, or skipped input is an open item —
  resolve deterministically or disclose explicitly; never pass silently.
- Before finishing, grep the diff for leftover deferred markers.
