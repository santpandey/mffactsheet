"""
Motilal Oswal Midcap Fund - Downloader

MOMF publishes per-scheme monthly portfolios as Excel files in the AEM DAM:
    /content/dam/motilal-mf/sheets/fund-csvs/Month_End_Portfolio_{Month}_{Year}/{SCHEME_CODE}.xlsx

The Midcap Fund's scheme code is YO07 (confirmed from the fund page's
embedded `portfolioUrl` field). The URL is constructed directly; if it 404s,
the fund page is scraped for the live `portfolioUrl` as a fallback (only
usable when it points at the requested month).

This DAM layout exists for 2026 onwards — older months were published under
a different path and are not available here.
"""

from pathlib import Path
from typing import Optional
import re

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES, make_absolute, fetch_page,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "motilal-oswal-midcap"

BASE_DOMAIN = "https://www.motilaloswalmf.com"
FUND_PAGE_URL = f"{BASE_DOMAIN}/mutual-funds/motilal-oswal-midcap-fund"
SCHEME_CODE = "YO07"

PORTFOLIO_URL_TEMPLATE = (
    BASE_DOMAIN
    + "/content/dam/motilal-mf/sheets/fund-csvs/"
    + "Month_End_Portfolio_{month_name}_{year}/{code}.xlsx"
)


class MotilalOswalMidcapDownloader(BaseFundDownloader):
    FUND_KEY = "motilal_oswal_midcap"
    FUND_DISPLAY_NAME = "Motilal Oswal Midcap Fund"
    BASE_DOMAIN = BASE_DOMAIN
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "motilal oswal midcap",
    ]
    # Single-scheme sheets are compact (~12-20KB) — the global 50KB floor
    # rejects them. AEM error pages are <1KB so this still catches failures.
    MIN_FILE_SIZE_BYTES = 8 * 1024

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"MotilalOswalMidcapFund-{month_name}-{year}.xlsx"

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

        # 1) Construct the deterministic DAM URL and verify it exists.
        url = PORTFOLIO_URL_TEMPLATE.format(
            month_name=month_name, year=year, code=SCHEME_CODE
        )
        try:
            r = session.head(url, timeout=30, allow_redirects=True)
            if r.ok:
                self.logger.info(f"  [MATCH] {month_name} {year}: {url}")
                return url
            self.logger.info(f"  DAM URL returned {r.status_code}: {url}")
        except requests.exceptions.RequestException as e:
            self.logger.error(f"  DAM URL check failed: {e}")

        # 2) Fallback: scrape the fund page for the live portfolioUrl — covers
        # the latest published month if the path scheme or code ever changes.
        soup = fetch_page(session, FUND_PAGE_URL, self.logger)
        if soup:
            m = re.search(
                r'"portfolioUrl"\s*:\s*"([^"]+\.xlsx)"', str(soup), re.I
            )
            if m:
                live_url = make_absolute(m.group(1), self.BASE_DOMAIN)
                if f"Month_End_Portfolio_{month_name}_{year}" in live_url:
                    self.logger.info(
                        f"  [MATCH via fund page] {month_name} {year}: {live_url}"
                    )
                    return live_url
                self.logger.info(
                    f"  Fund page portfolioUrl is for a different month: {live_url}"
                )

        self.logger.info(f"  [NO MATCH] {month_name} {year} not found")
        return None
