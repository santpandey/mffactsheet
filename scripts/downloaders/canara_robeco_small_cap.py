"""
Canara Robeco Small Cap Fund - Downloader
Factsheet URL: https://www.canararobeco.com/documents/statutory-disclosures/scheme-dashboard/scheme-monthly-portfolio/
"""

from pathlib import Path
from typing import Optional

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES,
    fetch_page, excel_links_from_soup, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "canara-robeco-small-cap"


class CanaraRobecoSmallCapDownloader(BaseFundDownloader):
    FUND_KEY = "canara_robeco_small_cap"
    FUND_DISPLAY_NAME = "Canara Robeco Small Cap Fund"
    BASE_DOMAIN = "https://www.canararobeco.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "canara robeco small cap",
    ]

    _PAGE_URL = (
        "https://www.canararobeco.com/documents/statutory-disclosures/"
        "scheme-dashboard/scheme-monthly-portfolio/"
        "?filteryear={year}&filtermonth={month:02d}&pagination={page}"
    )

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"CanaraRobecoSmallCapFund-{month_name}-{year}.xlsx"

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

        def is_small_cap(text_href: str) -> bool:
            c = text_href.lower()
            return (
                "canara" in c
                and "robeco" in c
                and "small" in c
                and "cap" in c
                and "fund" in c
            )

        # Pass 1: candidates where the visible text or href clearly names the fund
        for link in links:
            href = link.get("href", "")
            text = link.get_text(strip=True)
            if not href.lower().endswith((".xlsx", ".xls")):
                continue
            if is_small_cap(text + " " + href):
                abs_url = make_absolute(href, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] Pass-1: {text!r} -> {abs_url}")
                return abs_url

        # Pass 2: any Excel link with the right keywords (last-resort safety net)
        for link in excel_links:
            href = link.get("href", "")
            combined = link.get_text(strip=True) + " " + href
            if is_small_cap(combined):
                abs_url = make_absolute(href, self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] Pass-2: {combined[:120]!r} -> {abs_url}")
                return abs_url

        self.logger.info("  [NO MATCH]")
        return None
