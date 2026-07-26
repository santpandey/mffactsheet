"""
Canara Robeco Large and Mid Cap Fund - Downloader
Factsheet URL: https://canararobeco.com/scheme-monthly-portfolio
"""

from pathlib import Path
from typing import Optional

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES,
    fetch_page, excel_links_from_soup, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "canara-robeco"


class CanaraRobecoDownloader(BaseFundDownloader):
    FUND_KEY = "canara_robeco"
    FUND_DISPLAY_NAME = "Canara Robeco Large and Mid Cap Fund"
    BASE_DOMAIN = "https://www.canararobeco.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "canara robeco large and mid cap",
        "canara robeco large & mid cap",
        "canara robeco emerging equities",
    ]

    # Canara Robeco uses filteryear/filtermonth query params for pagination
    _PAGE_URL = (
        "https://www.canararobeco.com/documents/statutory-disclosures/"
        "scheme-dashboard/scheme-monthly-portfolio/"
        "?filteryear={year}&filtermonth={month:02d}&pagination={page}"
    )

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"EQ-\u2013-Canara-Robeco-Large-and-Mid-Cap-Fund-\u2013-{month_name}-{year}.xlsx"

    def find_download_link(
        self,
        session: requests.Session,
        year: int,
        month: int,
        page: int,
    ) -> Optional[str]:
        url = self._PAGE_URL.format(year=year, month=month, page=page)
        soup = fetch_page(session, url, self.logger)
        if not soup:
            return None

        links = soup.find_all("a", href=True)
        excel_links = excel_links_from_soup(soup)
        self.logger.info(f"  Total links: {len(links)}, Excel links: {len(excel_links)}")

        def is_large_and_mid(text_href: str) -> bool:
            """Return True if text/href looks like the Large and Mid Cap fund."""
            c = text_href.lower()
            has_canara = "canara" in c and "robeco" in c
            if not has_canara:
                return False
            # New name variants: 'Large and Mid Cap' or 'Large & Midcap', etc.
            if "large" in c and ("mid" in c or "midcap" in c):
                return True
            # Old name
            if "emerging" in c and "equities" in c:
                return True
            return False

        # Pass 1: candidates where the visible text or href clearly names the fund
        for link in links:
            href = link.get("href", "")
            text = link.get_text(strip=True)
            if not href.lower().endswith((".xlsx", ".xls")):
                continue
            if is_large_and_mid(text + " " + href):
                abs_url = make_absolute(href, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] Pass-1: {text!r} -> {abs_url}")
                return abs_url

        # Pass 2: any Excel link with the right keywords (last-resort safety net)
        for link in excel_links:
            href = link.get("href", "")
            combined = link.get_text(strip=True) + " " + href
            if is_large_and_mid(combined):
                abs_url = make_absolute(href, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] Pass-2: {combined[:120]!r} -> {abs_url}")
                return abs_url

        self.logger.info("  [NO MATCH]")
        return None
