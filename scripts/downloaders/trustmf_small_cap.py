"""
TrustMF Small Cap Fund - Downloader
Monthly portfolio disclosures API: https://www.trustmf.com/api/api/Trust/GetData
(One combined workbook per month; Small Cap holdings live in the 'TMFSCAP' sheet.)
"""

from pathlib import Path
from typing import Optional
import re

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "trustmf-small-cap"

CONFIG_URL = "https://www.trustmf.com/config.json"
FALLBACK_API_BASE = "https://www.trustmf.com/api/api/"


class TrustMFSmallCapDownloader(BaseFundDownloader):
    FUND_KEY = "trustmf_small_cap"
    FUND_DISPLAY_NAME = "TrustMF Small Cap Fund"
    BASE_DOMAIN = "https://www.trustmf.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "trustmf small cap",
    ]

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"TrustMFSmallCapFund-{month_name}-{year}.xlsx"

    def _api_base(self, session: requests.Session) -> str:
        try:
            r = session.get(CONFIG_URL, timeout=15)
            r.raise_for_status()
            cfg = r.json()
            return f"{cfg.get('PROTOCOL', 'https')}://{cfg['VITE_COSMOSAPIURL']}"
        except Exception as e:
            self.logger.warning(f"  Could not fetch config.json ({e}) — using fallback API base")
            return FALLBACK_API_BASE

    def find_download_link(
        self,
        session: requests.Session,
        year: int,
        month: int,
        page: int,
    ) -> Optional[str]:
        if page > 1:
            return None

        base = self._api_base(session)
        body = {
            "systemQueryFileName": "disclosuresweb.xml",
            "tagName": "GetDisclosureByType",
            "searchField": "",
            "searchValue": "",
            "sortField": "uploaddate",
            "sortDirection": "DESC",
            "replaceField": "_slug_",
            "replaceValue": "portfolio-monthly-disclosure",
        }
        try:
            r = session.post(
                base + "Trust/GetData",
                json=body,
                headers={"Content-type": "application/json; charset=UTF-8"},
                timeout=60,
            )
            r.raise_for_status()
            items = r.json().get("resultSetArray") or []
        except Exception as e:
            self.logger.error(f"  Could not fetch TrustMF disclosures API: {e}")
            return None

        for item in items if isinstance(items, list) else []:
            m = re.search(r"as on (\d{2})\.(\d{2})\.(\d{4})", item.get("title", ""))
            if not m:
                continue
            mm = int(m.group(2))
            yyyy = int(m.group(3))
            if yyyy == year and mm == month:
                url = (item.get("fileurl") or "").strip()
                if not url:
                    self.logger.info(f"  {MONTH_NAMES[month - 1]} {year} not yet published")
                    return None
                abs_url = make_absolute(url, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] {MONTH_NAMES[month - 1]} {year}: {abs_url}")
                return abs_url

        self.logger.info(f"  [NO MATCH] {MONTH_NAMES[month - 1]} {year} not found in API response")
        return None
