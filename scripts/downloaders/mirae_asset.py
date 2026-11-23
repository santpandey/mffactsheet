"""
Mirae Asset Large & Midcap Fund - Downloader
Factsheet URL: https://miraeassetmf.co.in/downloads/factsheet

NOTE: Mirae Asset's portfolio page is client-side JS-rendered, so link
discovery isn't possible. Two publish channels are probed instead:

1. AMC site:   /docs/default-source/portfolios/maebf-{mon}{year}.xlsx
2. CloudFront: d3hwtxj0w1i8v8.cloudfront.net/{pub_y}/{pub_m}/{day}/117/EB.xlsx
   (the KFintech mailer CDN; files land ~day 2 of the following month —
   discovered when Sept 2026 was missing on the AMC site but present here)
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

        # Fallback: KFintech mailer CDN — files land ~day 2 of the following
        # month (probe days 1-15). 403 = not uploaded yet.
        pub_y, pub_m = (year + 1, 1) if month == 12 else (year, month + 1)
        for day in range(1, 16):
            cf_url = (
                f"https://d3hwtxj0w1i8v8.cloudfront.net/"
                f"{pub_y}/{pub_m}/{day}/117/EB.xlsx"
            )
            try:
                r = session.get(cf_url, timeout=15, stream=True)
                ct = r.headers.get("Content-Type", "").lower()
                ok = r.ok and any(
                    t in ct
                    for t in ("excel", "spreadsheet", "octet-stream", "zip")
                )
                r.close()
                if ok:
                    self.logger.info(f"  [MATCH] CloudFront {cf_url}")
                    return cf_url
            except requests.exceptions.RequestException as exc:
                self.logger.info(f"  [MISS] {cf_url}: {exc}")

        self.logger.error("  No valid portfolio Excel URL found")
        return None
