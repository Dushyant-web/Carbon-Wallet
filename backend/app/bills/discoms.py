"""Distribution-company fingerprints and per-discom label hints.

Fingerprints pick the discom from the bill text; each template adds the label wording that discom
uses (with a priority boost) on top of the generic dictionaries in `fields.py`. Templates are
starting points tuned against real bills in `private-bills/` (see `bench.py`).
"""

import re
from dataclasses import dataclass, field

from rapidfuzz import fuzz


@dataclass(frozen=True)
class Discom:
    id: str
    name: str
    state: str
    region: str
    cycle: str = "monthly"  # or "bimonthly"
    fingerprints: tuple[str, ...] = ()
    unit_labels: tuple[str, ...] = ()
    amount_labels: tuple[str, ...] = ()
    notes: tuple[str, ...] = field(default=())


DISCOMS: tuple[Discom, ...] = (
    # Delhi
    Discom("bses_rajdhani", "BSES Rajdhani Power", "DL", "Delhi", fingerprints=("bses rajdhani", "brpl", "rajdhani power"),
           unit_labels=("units consumed", "billed units"), amount_labels=("net amount payable", "amount payable")),
    Discom("bses_yamuna", "BSES Yamuna Power", "DL", "Delhi", fingerprints=("bses yamuna", "bypl", "yamuna power"),
           unit_labels=("units consumed", "billed units"), amount_labels=("net amount payable", "amount payable")),
    Discom("tpddl", "Tata Power Delhi Distribution", "DL", "Delhi",
           fingerprints=("tata power-ddl", "tata power ddl", "tpddl", "tata power delhi"),
           unit_labels=("units billed", "billed units"), amount_labels=("total amount payable", "amount payable")),
    Discom("ndmc", "NDMC", "DL", "Delhi", fingerprints=("new delhi municipal council", "ndmc")),
    # UP + Haryana
    Discom("npcl", "Noida Power Company", "UP", "UP + Haryana", fingerprints=("noida power company", "npcl"),
           unit_labels=("billed units", "units consumed")),
    Discom("pvvnl", "Paschimanchal Vidyut Vitran Nigam", "UP", "UP + Haryana",
           fingerprints=("paschimanchal", "pvvnl"), unit_labels=("billed units", "consumption")),
    Discom("mvvnl", "Madhyanchal Vidyut Vitran Nigam", "UP", "UP + Haryana", fingerprints=("madhyanchal", "mvvnl")),
    Discom("dvvnl", "Dakshinanchal Vidyut Vitran Nigam", "UP", "UP + Haryana", fingerprints=("dakshinanchal", "dvvnl")),
    Discom("puvvnl", "Purvanchal Vidyut Vitran Nigam", "UP", "UP + Haryana", fingerprints=("purvanchal", "puvvnl")),
    Discom("kesco", "Kanpur Electricity Supply Company", "UP", "UP + Haryana", fingerprints=("kesco", "kanpur electricity")),
    Discom("uppcl", "UPPCL (Uttar Pradesh)", "UP", "UP + Haryana", fingerprints=("uppcl", "uttar pradesh power corporation")),
    Discom("dhbvn", "Dakshin Haryana Bijli Vitran Nigam", "HR", "UP + Haryana",
           fingerprints=("dakshin haryana", "dhbvn"), unit_labels=("units billed", "consumption"), amount_labels=("amount payable",)),
    Discom("uhbvn", "Uttar Haryana Bijli Vitran Nigam", "HR", "UP + Haryana",
           fingerprints=("uttar haryana", "uhbvn"), unit_labels=("units billed", "consumption")),
    # Maharashtra + Gujarat
    Discom("msedcl", "MSEDCL (Mahavitaran)", "MH", "Maharashtra + Gujarat",
           fingerprints=("maharashtra state electricity distribution", "msedcl", "mahavitaran"),
           unit_labels=("consumption (units)", "units consumed", "total consumption"),
           amount_labels=("bill amount", "current bill amount", "total bill amount")),
    Discom("aeml", "Adani Electricity Mumbai", "MH", "Maharashtra + Gujarat",
           fingerprints=("adani electricity", "aeml"), unit_labels=("units consumed (kwh)", "units consumed"),
           amount_labels=("total amount payable", "amount payable")),
    Discom("tata_mumbai", "Tata Power Mumbai", "MH", "Maharashtra + Gujarat", fingerprints=("tata power company", "tata power mumbai")),
    Discom("best", "BEST Undertaking", "MH", "Maharashtra + Gujarat", fingerprints=("brihanmumbai electric", "best undertaking")),
    Discom("torrent", "Torrent Power", "GJ", "Maharashtra + Gujarat", fingerprints=("torrent power",),
           unit_labels=("units consumed", "consumption"), amount_labels=("bill amount", "amount payable")),
    Discom("gujarat_state", "Gujarat discom (UGVCL/MGVCL/DGVCL/PGVCL)", "GJ", "Maharashtra + Gujarat", cycle="bimonthly",
           fingerprints=("ugvcl", "mgvcl", "dgvcl", "pgvcl", "gujarat vij")),
    # South
    Discom("bescom", "BESCOM", "KA", "South", fingerprints=("bescom", "bangalore electricity supply"),
           unit_labels=("units consumed", "consumption"), amount_labels=("net amt due", "net amount due", "amount payable")),
    Discom("karnataka_escom", "Karnataka ESCOM (HESCOM/GESCOM/MESCOM/CESC)", "KA", "South",
           fingerprints=("hescom", "gescom", "mescom", "chamundeshwari")),
    Discom("tangedco", "TANGEDCO / TNPDCL", "TN", "South", cycle="bimonthly",
           fingerprints=("tangedco", "tnpdcl", "tamil nadu power distribution", "tamil nadu generation and distribution", "tneb"),
           unit_labels=("units", "consumption"), amount_labels=("total amount", "net amount", "amount payable")),
    Discom("kseb", "Kerala State Electricity Board", "KL", "South", cycle="bimonthly",
           fingerprints=("kseb", "kerala state electricity"), unit_labels=("consumption", "units")),
    Discom("tgspdcl", "TGSPDCL / TSSPDCL (Telangana)", "TS", "South",
           fingerprints=("tsspdcl", "tgspdcl", "southern power distribution company of telangana", "tsnpdcl", "tgnpdcl"),
           unit_labels=("units", "consumption")),
    Discom("ap_discom", "Andhra Pradesh discom (APSPDCL/APEPDCL/APCPDCL)", "AP", "South",
           fingerprints=("apspdcl", "apepdcl", "apcpdcl")),
)

GENERIC = Discom("generic", "Unknown discom", "", "Other")


def detect(full_text: str) -> Discom:
    """Exact fingerprint hits anywhere in the bill; if none, a fuzzy match on the header lines, where OCR
    on photos most often drops or garbles a bold word of the company name."""
    low = re.sub(r"\s+", " ", full_text.lower())
    best, best_hits = GENERIC, 0.0
    for d in DISCOMS:
        hits = sum(1 for f in d.fingerprints if f in low)
        if hits > best_hits:
            best, best_hits = d, hits
    if best_hits:
        return best
    header = " ".join(full_text.lower().splitlines()[:8])
    for d in DISCOMS:
        score = max((fuzz.partial_ratio(f, header) for f in d.fingerprints if len(f) >= 8), default=0)
        if score >= 90 and score > best_hits:
            best, best_hits = d, score
    return best
