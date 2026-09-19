"""
Parag Parikh Flexi Cap Fund - Downloader

PPFAS publishes per-scheme monthly portfolio workbooks at deterministic
URLs under the Portfolio Disclosure section:

    /downloads/portfolio-disclosure/{yyyy}/PPFCF_PPFAS_Monthly_Portfolio_Report_{Month}_{last_day}_{Year}.xlsx

The disclosures page (amc.ppfas.com/downloads/portfolio-disclosure/) also
links each file with a cache-busting query suffix that can be omitted —
the bare path resolves to the same workbook.
"""

import calendar
from pathlib import Path
from typing import Optional

import requests

from .base_downloader import BaseFundDownloader, MONTH_NAMES

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "ppfas-flexi-cap"

CDN_BASE = "https://amc.ppfas.com/downloads/portfolio-disclosure"


class PPFASFlexiCapDownloader(BaseFundDownloader):
    FUND_KEY = "ppfas_flexi_cap"
    FUND_DISPLAY_NAME = "Parag Parikh Flexi Cap Fund"
    BASE_DOMAIN = "https://amc.ppfas.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "parag parikh flexi cap",
    ]

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"PPFASFlexiCapFund-{month_name}-{year}.xlsx"

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
        last_day = calendar.monthrange(year, month)[1]
        url = (
            f"{CDN_BASE}/{year}/"
            f"PPFCF_PPFAS_Monthly_Portfolio_Report_{month_name}_{last_day}_{year}.xlsx"
        )
        try:
            r = session.get(url, timeout=30, stream=True)
            ok = r.ok
            r.close()
            if ok:
                self.logger.info(f"  [MATCH] {month_name} {year}: {url}")
                return url
        except requests.exceptions.RequestException as e:
            self.logger.error(f"  Probe failed for {url}: {e}")

        self.logger.info(f"  [NO MATCH] {month_name} {year} not published yet")
        return None
