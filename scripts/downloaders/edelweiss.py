"""
Edelweiss Large & Mid Cap Fund - Downloader
Factsheet URL: https://edelweissmf.com/downloads/factsheets
"""

from pathlib import Path
from typing import Optional

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES,
    fetch_page, excel_links_from_soup, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "edelweiss"


class EdelweissDownloader(BaseFundDownloader):
    FUND_KEY = "edelweiss"
    FUND_DISPLAY_NAME = "Edelweiss Large & Mid Cap Fund"
    BASE_DOMAIN = "https://www.edelweissmf.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = ["edelweiss", "large", "mid cap"]

    _PAGE_URL = "https://www.edelweissmf.com/downloads/factsheets?page={page}"

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"edelweiss-large-midcap-{month_name.lower()}-{year}.xlsx"

    def find_download_link(
        self,
        session: requests.Session,
        year: int,
        month: int,
        page: int,
    ) -> Optional[str]:
        url = self._PAGE_URL.format(page=page)
        soup = fetch_page(session, url, self.logger)
        if not soup:
            return None

        all_links = soup.find_all("a", href=True)
        excel_links = excel_links_from_soup(soup)
        self.logger.info(f"  Total links: {len(all_links)}, Excel links: {len(excel_links)}")

        month_name = MONTH_NAMES[month - 1].lower()
        month_abbr = month_name[:3]

        for link in all_links:
            href = link.get("href", "")
            combined = (link.get_text(strip=True) + " " + href).lower()
            is_fund = "edelweiss" in combined and "large" in combined and "mid" in combined
            has_month = month_abbr in combined or month_name in combined
            has_year = str(year) in combined
            if is_fund and has_month and has_year and href.lower().endswith((".xlsx", ".xls")):
                abs_url = make_absolute(href, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] {abs_url}")
                return abs_url

        for link in excel_links:
            href = link.get("href", "")
            combined = (link.get_text(strip=True) + " " + href).lower()
            if "edelweiss" in combined and "large" in combined and "mid" in combined:
                abs_url = make_absolute(href, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] Relaxed: {abs_url}")
                return abs_url

        self.logger.info("  [NO MATCH]")
        return None
