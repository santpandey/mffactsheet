"""
Invesco India Multicap Fund - Downloader
Monthly holdings API: https://www.invescomutualfund.com/api/CompleteMonthlyHoldings?year={year}&classification=equity
"""

from pathlib import Path
from typing import Optional
import xml.etree.ElementTree as ET

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "invesco-india-multicap"


class InvescoIndiaMulticapDownloader(BaseFundDownloader):
    FUND_KEY = "invesco_india_multicap"
    FUND_DISPLAY_NAME = "Invesco India Multicap Fund"
    BASE_DOMAIN = "https://www.invescomutualfund.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "invesco india multicap",
    ]

    API_URL = (
        "https://www.invescomutualfund.com/api/CompleteMonthlyHoldings"
        "?year={year}&classification=equity"
    )

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"InvescoIndiaMulticapFund-{month_name}-{year}.xlsx"

    def find_download_link(
        self,
        session: requests.Session,
        year: int,
        month: int,
        page: int,
    ) -> Optional[str]:
        if page > 1:
            return None

        try:
            url = self.API_URL.format(year=year)
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/123.0.0.0 Safari/537.36"
                ),
                "Accept": "application/json",
            }
            r = requests.get(url, headers=headers, timeout=30)
            r.raise_for_status()
            content_type = r.headers.get("content-type", "").lower()
            if "json" in content_type:
                items = r.json()
            else:
                root = ET.fromstring(r.text)
                items = []
                for el in root:
                    row = {}
                    for child in el:
                        tag = child.tag.split("}")[-1]
                        row[tag] = child.text or ""
                    items.append(row)
        except Exception as e:
            self.logger.error(f"  Could not fetch Invesco holdings API: {e}")
            return None

        month_key = MONTH_NAMES[month - 1][:3] + "Url"
        for item in items if isinstance(items, list) else []:
            name = (item.get("Name") or "").strip().lower()
            if name == "invesco india multicap fund":
                download_url = (item.get(month_key) or "").strip()
                if not download_url:
                    self.logger.info(f"  {MONTH_NAMES[month - 1]} {year} not yet published")
                    return None
                abs_url = make_absolute(download_url, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] {MONTH_NAMES[month - 1]} {year}: {abs_url}")
                return abs_url

        self.logger.info("  [NO MATCH] Invesco India Multicap Fund not found in API response")
        return None
