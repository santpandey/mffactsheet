"""
HDFC Multi-Asset Allocation Fund - Downloader

HDFC publishes per-scheme monthly portfolios on its CDN (files.hdfcfund.com,
not behind the main site's WAF):

    /s3fs-public/{publish_yyyy-mm}/Monthly HDFC {Scheme Name} - {last_day} {Month} {Year}.xlsx

- {publish_yyyy-mm} is usually the month AFTER the portfolio month
  (e.g. July 2026 portfolio lives under /2026-08/), occasionally later.
- The scheme was renamed "HDFC Multi-Asset Allocation Fund" starting with
  the December 2025 portfolio; older files use "HDFC Multi-Asset Fund".
- Starting with the August 2026 portfolio, HDFC dropped the hyphen:
  "HDFC Multi Asset Allocation Fund" — without it every probe 403s.

find_download_link expands each known name through punctuation_variants()
(hyphen<->space/none, &<->and) so cosmetic renames self-heal, and probes
every variant across the likely publish folders.
"""

import calendar
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES, punctuation_variants,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "hdfc-multi-asset"

CDN_BASE = "https://files.hdfcfund.com/s3fs-public"

# Canonical names only — punctuation_variants() derives the rest at runtime.
SCHEME_NAME_VARIANTS = [
    "HDFC Multi Asset Allocation Fund",  # Aug 2026 onwards (hyphen dropped)
    "HDFC Multi-Asset Allocation Fund",  # Dec 2025 – Jul 2026
    "HDFC Multi-Asset Fund",             # older files
]

# Every spelling permutation of every known name, deduped, originals first.
ALL_SCHEME_NAMES = list(
    dict.fromkeys(
        v for name in SCHEME_NAME_VARIANTS for v in punctuation_variants(name)
    )
)


class HDFCMultiAssetDownloader(BaseFundDownloader):
    FUND_KEY = "hdfc_multi_asset"
    FUND_DISPLAY_NAME = "HDFC Multi-Asset Allocation Fund"
    BASE_DOMAIN = "https://files.hdfcfund.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "hdfc multi asset",   # Aug 2026+ (hyphen dropped)
        "hdfc multi-asset",   # Dec 2025 – Jul 2026 and older
    ]

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"HDFCMultiAssetAllocationFund-{month_name}-{year}.xlsx"

    def find_download_link(
        self,
        session: requests.Session,
        year: int,
        month: int,
        page: int,
    ) -> Optional[str]:
        if page > 1:
            return None

        month_name = MONTH_NAMES[month - 1]
        for url in self._candidate_urls(year, month):
            try:
                # NOTE: this CDN 403s on HEAD — use a streamed GET and
                # close without reading the body.
                r = session.get(url, timeout=30, stream=True)
                ok = r.ok
                r.close()
                if ok:
                    self.logger.info(f"  [MATCH] {url}")
                    return url
            except requests.exceptions.RequestException as e:
                self.logger.error(f"  Probe failed for {url}: {e}")

        self.logger.info(f"  [NO MATCH] {month_name} {year} not found on CDN")
        return None

    def _candidate_urls(self, year: int, month: int) -> list:
        """All constructed CDN URLs for this portfolio month."""
        month_name = MONTH_NAMES[month - 1]
        last_day = calendar.monthrange(year, month)[1]
        urls = []
        for pub in self._publish_folders(year, month):
            for scheme in ALL_SCHEME_NAMES:
                fname = (
                    f"Monthly {scheme} - {last_day} {month_name} {year}.xlsx"
                )
                urls.append(f"{CDN_BASE}/{pub}/{quote(fname)}")
        return urls

    @staticmethod
    def _publish_folders(year: int, month: int) -> list:
        # Portfolio is uploaded into the folder of the publish month —
        # normally month+1, occasionally month+2.
        folders = []
        for offset in (1, 2):
            py, pm = year, month + offset
            while pm > 12:
                pm -= 12
                py += 1
            folders.append(f"{py}-{pm:02d}")
        return folders

    def archived_url_candidates(self, year: int, month: int) -> list:
        return self._candidate_urls(year, month)
