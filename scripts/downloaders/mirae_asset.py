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

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES,
    fetch_page, excel_links_from_soup, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "mirae-asset"


class MiraeAssetDownloader(BaseFundDownloader):
    FUND_KEY = "mirae_asset"
    FUND_DISPLAY_NAME = "Mirae Asset Large & Midcap Fund"
    BASE_DOMAIN = "https://www.miraeassetmf.co.in"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = ["mirae asset", "large", "midcap", "maebf"]

    _PAGE_URL = "https://www.miraeassetmf.co.in/downloads/portfolio-holdings?page={page}"

    def get_output_filename(self, year: int, month: int) -> Path:
        month_abbr = MONTH_NAMES[month - 1][:3].lower()
        return EXCEL_DIR / f"maebf_{month_abbr}{year}.xlsx"

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

        excel_links = excel_links_from_soup(soup)
        self.logger.info(f"  Excel links found: {len(excel_links)}")

        month_abbr = MONTH_NAMES[month - 1][:3].lower()
        month_full = MONTH_NAMES[month - 1].lower()

        for link in excel_links:
            href = link.get("href", "")
            combined = (link.get_text(strip=True) + " " + href).lower()
            # Match fund identifier + month + year
            is_fund = "maebf" in combined or ("large" in combined and "mid" in combined)
            has_month = month_abbr in combined or month_full in combined
            has_year = str(year) in combined
            if is_fund and has_month and has_year:
                abs_url = make_absolute(href, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] {abs_url}")
                return abs_url

        # Relaxed: just month + year + any Excel link
        for link in excel_links:
            href = link.get("href", "")
            combined = (link.get_text(strip=True) + " " + href).lower()
            if (month_abbr in combined or month_full in combined) and str(year) in combined:
                abs_url = make_absolute(href, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] Relaxed: {abs_url}")
                return abs_url

        self.logger.info("  [NO MATCH] (site may require JS rendering — manual download needed)")
        return None
