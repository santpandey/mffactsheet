"""
SBI Children's Fund - Investment Plan - Downloader
Scheme URL: https://www.sbimf.com/sbimf-scheme-details/sbi-children%27s-fund---investment-plan-574
API endpoints discovered from https://www.sbimf.com/Content/Service/Constants.js
"""

import json
import random
import string
import time
import uuid
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

from .base_downloader import (
    BaseFundDownloader, MONTH_NAMES, make_absolute,
)

ROOT_DIR = Path(__file__).parent.parent.parent
EXCEL_DIR = ROOT_DIR / "excel-data" / "sbi-childrens"


class SBIChildrensFundDownloader(BaseFundDownloader):
    FUND_KEY = "sbi_childrens"
    FUND_DISPLAY_NAME = "SBI Children's Fund - Investment Plan"
    BASE_DOMAIN = "https://www.sbimf.com"
    DOWNLOAD_DIR = EXCEL_DIR
    FUND_NAME_KEYWORDS = [
        "sbi children's",
        "sbi children",
        "sbi magnum children",
    ]

    FUND_ID = 574
    TOKEN_API = "https://www.sbimf.com/api/GenerateToken/Post/"
    MONTHS_API = "https://www.sbimf.com/ajaxcall/CMS/GetMonthsbyYearbyFundID"
    SHEETS_API = "https://www.sbimf.com/ajaxcall/CMS/GetSchemePortfolioSheets"
    TOKEN_TTL_SECONDS = 600  # reuse token for 10 minutes

    def __init__(self):
        super().__init__()
        self._token: Optional[str] = None
        self._token_time: float = 0.0
        self._available_months_cache: dict = {}

    def get_output_filename(self, year: int, month: int) -> Path:
        month_name = MONTH_NAMES[month - 1]
        return EXCEL_DIR / f"SBIChildrensFund-{month_name}-{year}.xlsx"

    def _generate_session_id(self) -> str:
        """Generate a 30-char alphanumeric session ID like the site's JS."""
        return "".join(random.choices(string.ascii_letters + string.digits, k=30))

    def _get_token(self, session: requests.Session) -> Optional[str]:
        if self._token and time.time() - self._token_time < self.TOKEN_TTL_SECONDS:
            return self._token

        for attempt in range(3):
            try:
                payload = {
                    "Requestid": str(uuid.uuid4()),
                    "SessionId": self._generate_session_id(),
                }
                r = session.post(
                    self.TOKEN_API,
                    headers={
                        "Content-Type": "application/json; charset=utf-8",
                        "Accept": "application/json",
                    },
                    data=json.dumps(payload),
                    timeout=30,
                )
                r.raise_for_status()
                body = r.json()
                data = json.loads(body["Data"])
                self._token = data["CreateTokenResult"]["Data"]
                self._token_time = time.time()
                return self._token
            except Exception as e:
                self.logger.error(f"Token generation attempt {attempt + 1} failed: {e}")
                try:
                    self.logger.error(f"  status={r.status_code}, text={r.text[:200]!r}")
                except Exception:
                    pass
                if attempt < 2:
                    time.sleep(2 ** attempt)

        self._token = None
        self._token_time = 0.0
        return None

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

        token = self._get_token(session)
        if not token:
            return None

        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "Token": token,
        }

        # 1. Check which months are available for this year (cached per year)
        if year not in self._available_months_cache:
            try:
                months_resp = session.post(
                    self.MONTHS_API,
                    headers=headers,
                    data=json.dumps({
                        "FundID": self.FUND_ID,
                        "folder": "Scheme Portfolios",
                        "year": year,
                    }),
                    timeout=30,
                )
                months_resp.raise_for_status()
                self._available_months_cache[year] = months_resp.json()
                self.logger.info(f"  Available months for {year}: {self._available_months_cache[year]}")
            except Exception as e:
                self.logger.error(f"  Could not fetch month list: {e}")
                return None

        available_months = self._available_months_cache[year]
        if month_name not in available_months:
            self.logger.info(f"  {month_name} {year} not yet published")
            return None

        # 2. Get the Excel download URL for the selected month
        try:
            sheets_resp = session.post(
                self.SHEETS_API,
                headers=headers,
                data=json.dumps({
                    "FundId": self.FUND_ID,
                    "PSYear": year,
                    "PSMonth": month_name,
                    "PSFrequency": "Monthly",
                }),
                timeout=30,
            )
            sheets_resp.raise_for_status()
            soup = BeautifulSoup(sheets_resp.text, "html.parser")
            link = soup.find("a", attrs={"download": "true"}, href=True)
            if not link:
                # Fallback: any anchor whose href contains an .xlsx reference
                link = soup.find("a", href=lambda h: h and ".xlsx" in h.lower())
            if not link:
                self.logger.info("  [NO MATCH] No Excel link found in response")
                return None

            download_url = make_absolute(link["href"], self.BASE_DOMAIN)
            self.logger.info(f"  [MATCH] {month_name} {year}: {download_url}")
            return download_url
        except Exception as e:
            self.logger.error(f"  Could not fetch sheet URL: {e}")
            return None
