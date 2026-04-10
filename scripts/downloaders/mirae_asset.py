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
        direct_url = f"{self.BASE_DOMAIN}/docs/default-source/portfolios/maebf-{month_abbr}{year}.xlsx"
        
        self.logger.info(f"  Trying direct URL: {direct_url}")
        return direct_url
