"""
Mirae Asset Large & Midcap Fund - Downloader
Factsheet URL: https://miraeassetmf.co.in/downloads/factsheet

NOTE: Mirae Asset's portfolio page uses client-side JavaScript rendering,
so direct scraping is not reliable. This downloader attempts static HTML
scraping but will likely require manual download.
Manual path: excel-data/mirae-asset/maebf_{mon}{year}.xlsx
"""

from pathlib import Path
from typing import Optional

import requests

from .base_downloader import BaseFundDownloader, MONTH_NAMES

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "mirae-asset"


class MiraeAssetDownloader(BaseFundDownloader):
    FUND_KEY = "mirae_asset"
    FUND_DISPLAY_NAME = "Mirae Asset Large & Midcap Fund"
    BASE_DOMAIN = "https://www.miraeassetmf.co.in"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = ["mirae asset", "large", "midcap", "maebf"]

    def get_output_filename(self, year: int, month: int) -> Path:
        month_abbr = MONTH_NAMES[month - 1][:3].lower()
        return EXCEL_DIR / f"maebf-{month_abbr}{year}.xlsx"

    def find_download_link(
        self,
        session: requests.Session,
        year: int,
        month: int,
        page: int,
    ) -> Optional[str]:
        if page > 1:
            return None

        month_abbr = MONTH_NAMES[month - 1][:3].lower()
        month_full = MONTH_NAMES[month - 1].lower()
        candidate_names = [
            f"maebf-{month_abbr}{year}.xlsx",
            f"maebf_{month_full}{year}.xlsx",
            f"maebf-{month_full}{year}.xlsx",
            f"maebf_{month_abbr}{year}.xlsx",
            f"maebf-{month_full}-{year}.xlsx",
        ]

        for filename in candidate_names:
            direct_url = f"{self.BASE_DOMAIN}/docs/default-source/portfolios/{filename}"
            self.logger.info(f"  Trying direct URL: {direct_url}")

            try:
                response = session.get(direct_url, timeout=30)
                response.raise_for_status()
                content_type = response.headers.get("Content-Type", "").lower()

                if any(
                    token in content_type
                    for token in ("excel", "spreadsheet", "octet-stream", "zip")
                ):
                    self.logger.info(f"  [MATCH] {direct_url}")
                    return direct_url

                self.logger.info(
                    f"  [SKIP] Non-Excel Content-Type at {filename}: {content_type}"
                )
            except requests.exceptions.RequestException as exc:
                self.logger.info(f"  [MISS] {filename}: {exc}")

        self.logger.error("  No valid portfolio Excel URL found")
        return None
