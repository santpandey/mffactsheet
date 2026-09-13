"""
Single source of truth for fund configurations.
Consumed by extract_all_funds.py (extraction) and generate_manifest.py
(which forwards name/display_name to the frontend via data/manifest.json).

Add a new fund by appending an entry to the FUNDS dict below.

Keys:
  name            : Display name written into JSON
  display_name    : Short label used in the frontend fund selector
  normalized_name : Used as the JSON filename prefix (fund key in the frontend)
  excel_folder    : Folder containing source .xlsx files
  data_folder     : Destination folder for JSON output
  sheet_match     : (optional) lowercase substring selecting the scheme sheet
                    inside combined AMC workbooks
"""

FUNDS = {
    "canara": {
        "name": "Canara Robeco Large and Mid Cap Fund",
        "display_name": "Canara Robeco",
        "normalized_name": "CanaraRobecoLargeAndMidCapFund",
        "excel_folder": "excel-data/canara-robeco",
        "data_folder": "data",
    },
    "mirae": {
        "name": "Mirae Asset Large & Midcap Fund",
        "display_name": "Mirae Asset",
        "normalized_name": "MiraeAssetLargeAndMidcapFund",
        "excel_folder": "excel-data/mirae-asset",
        "data_folder": "data",
    },
    "sbi_childrens": {
        "name": "SBI Children's Fund - Investment Plan",
        "display_name": "SBI Children's",
        "normalized_name": "SBIChildrensFund",
        "excel_folder": "excel-data/sbi-childrens",
        "data_folder": "data",
    },
    "invesco_india_multicap": {
        "name": "Invesco India Multicap Fund",
        "display_name": "Invesco Multicap",
        "normalized_name": "InvescoIndiaMulticapFund",
        "excel_folder": "excel-data/invesco-india-multicap",
        "data_folder": "data",
    },
    "canara_robeco_small_cap": {
        "name": "Canara Robeco Small Cap Fund",
        "display_name": "Canara Small Cap",
        "normalized_name": "CanaraRobecoSmallCapFund",
        "excel_folder": "excel-data/canara-robeco-small-cap",
        "data_folder": "data",
    },
    "trustmf_small_cap": {
        "name": "TrustMF Small Cap Fund",
        "display_name": "TrustMF Small Cap",
        "normalized_name": "TrustMFSmallCapFund",
        "excel_folder": "excel-data/trustmf-small-cap",
        "data_folder": "data",
        "sheet_match": "trustmf small cap fund",
    },
    "quant_small_cap": {
        "name": "Quant Small Cap Fund",
        "display_name": "Quant Small Cap",
        "normalized_name": "QuantSmallCapFund",
        "excel_folder": "excel-data/quant-small-cap",
        "data_folder": "data",
    },
    "motilal_oswal_midcap": {
        "name": "Motilal Oswal Midcap Fund",
        "display_name": "Motilal Midcap",
        "normalized_name": "MotilalOswalMidcapFund",
        "excel_folder": "excel-data/motilal-oswal-midcap",
        "data_folder": "data",
    },
    "hdfc_multi_asset": {
        "name": "HDFC Multi-Asset Allocation Fund",
        "display_name": "HDFC Multi Asset",
        "normalized_name": "HDFCMultiAssetAllocationFund",
        "excel_folder": "excel-data/hdfc-multi-asset",
        "data_folder": "data",
    },
}
