"""
Quant Small Cap Fund - Downloader
Statutory disclosures PageMethods API:
POST https://quantmutual.com/statutorydisclosures.aspx/displaydisclouser2
Returns per-fund monthly portfolio Excel links.
"""

from pathlib import Path
from typing import Optional
import re

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "quant-small-cap"

DISCLOSURE_URL = "https://quantmutual.com/statutorydisclosures.aspx/displaydisclouser2"
CATEGORY = "MONTHLY PORTFOLIO - FUND - WISE"


class QuantSmallCapDownloader(BaseFundDownloader):
    FUND_KEY = "quant_small_cap"
    FUND_DISPLAY_NAME = "Quant Small Cap Fund"
    BASE_DOMAIN = "https://quantmutual.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "quant small cap",
    ]

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"QuantSmallCapFund-{month_name}-{year}.xlsx"

    def find_download_link(
        self,
        session: requests.Session,
        year: int,
        month: int,
        page: int,
    ) -> Optional[str]:
        if page > 1:
            return None

        body = "{id:'%d',cat:'%s',tab:'%d'}" % (month, CATEGORY, year)
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "X-Requested-With": "XMLHttpRequest",
        }
        try:
            r = session.post(DISCLOSURE_URL, data=body, headers=headers, timeout=60)
            r.raise_for_status()
            html = r.json().get("d", "") or ""
        except Exception as e:
            self.logger.error(f"  Could not fetch Quant disclosures API: {e}")
            return None

        m = re.search(r"href='([^']*Small_Cap_Fund[^']*\.xlsx?)'", html, re.I)
        if not m:
            self.logger.info(
                f"  [NO MATCH] {MONTH_NAMES[month - 1]} {year} not found in API response"
            )
            return None

        abs_url = make_absolute(m.group(1), self.BASE_DOMAIN)
        self.logger.info(f"  [MATCH] {MONTH_NAMES[month - 1]} {year}: {abs_url}")
        return abs_url
