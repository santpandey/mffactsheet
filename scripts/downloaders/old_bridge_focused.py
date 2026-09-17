"""
Old Bridge Focused Fund - Downloader

Monthly portfolios are published on the Statutory Disclosures page:
    https://oldbridgemf.com/statutory-disclosures.html
under the "Monthly Portfolio" tab pane (div#v-pills-tabContent2) as
< li > entries titled "Old Bridge Focused Fund - <Month> <Year>" with a
Download anchor to /uploads/*.xlsx.

The same page also carries "Notice-Upload of Monthly Portfolio ..." PDF
addendums and a separate "Half Yearly Portfolio Statement" pane — scoping
the search to the monthly tab pane and requiring an .xlsx href avoids both.
"""

import re
from pathlib import Path
from typing import Optional

import requests

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES, fetch_page, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "old-bridge-focused"

DISCLOSURES_URL = "https://oldbridgemf.com/statutory-disclosures.html"
MONTHLY_PANE_ID = "v-pills-tabContent2"


class OldBridgeFocusedDownloader(BaseFundDownloader):
    FUND_KEY = "old_bridge_focused"
    FUND_DISPLAY_NAME = "Old Bridge Focused Fund"
    BASE_DOMAIN = "https://oldbridgemf.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "old bridge focused",
    ]

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"OldBridgeFocusedFund-{month_name}-{year}.xlsx"

    def find_download_link(
        self,
        session: requests.Session,
        year: int,
        month: int,
        page: int,
    ) -> Optional[str]:
        if page > 1:
            return None

        soup = fetch_page(session, DISCLOSURES_URL, self.logger)
        if soup is None:
            return None

        pane = soup.find(id=MONTHLY_PANE_ID)
        search_root = pane if pane is not None else soup
        if pane is None:
            self.logger.warning(
                f"  Monthly Portfolio pane '{MONTHLY_PANE_ID}' not found "
                "— searching whole page"
            )

        month_name = MONTH_NAMES[month - 1]
        target = re.compile(
            rf"old\s*bridge\s*focused\s*fund\s*[-–—]\s*{month_name}\s*{year}",
            re.IGNORECASE,
        )

        for h2 in search_root.find_all("h2"):
            if not target.search(h2.get_text(" ", strip=True)):
                continue
            li = h2.find_parent("li")
            anchor = (li or h2.parent).find("a", href=True) if (li or h2.parent) else None
            if anchor and anchor["href"].lower().endswith((".xlsx", ".xls")):
                url = make_absolute(anchor["href"], self.BASE_DOMAIN)
                self.logger.info(f"  [MATCH] {month_name} {year}: {url}")
                return url

        self.logger.info(
            f"  [NO MATCH] {month_name} {year} not found on disclosures page"
        )
        return None
