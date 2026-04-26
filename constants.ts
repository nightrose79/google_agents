// iBonds ETF catalog – tickers, bond types, maturity years
export const BLACKROCK_API_BASE = "https://www.ishares.com/us/products";
export const BLACKROCK_FUND_API = "https://www.blackrock.com/us/individual/products";
export const CHARACTER_LIMIT = 50000;

export type BondType = "corporate" | "muni" | "treasury" | "tips";

export interface IBondsETF {
  ticker: string;
  name: string;
  maturityYear: number;
  bondType: BondType;
  productPageId: string; // BlackRock product page ID
  cusip?: string;
}

// Known iBonds ETF universe (US-listed)
export const IBONDS_CATALOG: IBondsETF[] = [
  // Corporate (Investment Grade)
  { ticker: "IBDP", name: "iShares iBonds Dec 2025 Term Corp ETF",     maturityYear: 2025, bondType: "corporate", productPageId: "271053" },
  { ticker: "IBDQ", name: "iShares iBonds Dec 2026 Term Corp ETF",     maturityYear: 2026, bondType: "corporate", productPageId: "271054" },
  { ticker: "IBDR", name: "iShares iBonds Dec 2027 Term Corp ETF",     maturityYear: 2027, bondType: "corporate", productPageId: "286453" },
  { ticker: "IBDS", name: "iShares iBonds Dec 2028 Term Corp ETF",     maturityYear: 2028, bondType: "corporate", productPageId: "298156" },
  { ticker: "IBDT", name: "iShares iBonds Dec 2029 Term Corp ETF",     maturityYear: 2029, bondType: "corporate", productPageId: "307449" },
  { ticker: "IBDU", name: "iShares iBonds Dec 2030 Term Corp ETF",     maturityYear: 2030, bondType: "corporate", productPageId: "313566" },
  { ticker: "IBDV", name: "iShares iBonds Dec 2031 Term Corp ETF",     maturityYear: 2031, bondType: "corporate", productPageId: "320372" },
  { ticker: "IBDW", name: "iShares iBonds Dec 2032 Term Corp ETF",     maturityYear: 2032, bondType: "corporate", productPageId: "326005" },
  { ticker: "IBDX", name: "iShares iBonds Dec 2033 Term Corp ETF",     maturityYear: 2033, bondType: "corporate", productPageId: "333125" },
  { ticker: "IBDY", name: "iShares iBonds Dec 2034 Term Corp ETF",     maturityYear: 2034, bondType: "corporate", productPageId: "341002" },

  // Municipal (Muni)
  { ticker: "IBMJ", name: "iShares iBonds Dec 2025 Term Muni Bond ETF", maturityYear: 2025, bondType: "muni", productPageId: "271861" },
  { ticker: "IBMK", name: "iShares iBonds Dec 2026 Term Muni Bond ETF", maturityYear: 2026, bondType: "muni", productPageId: "273174" },
  { ticker: "IBML", name: "iShares iBonds Dec 2027 Term Muni Bond ETF", maturityYear: 2027, bondType: "muni", productPageId: "286454" },
  { ticker: "IBMM", name: "iShares iBonds Dec 2028 Term Muni Bond ETF", maturityYear: 2028, bondType: "muni", productPageId: "298157" },
  { ticker: "IBMN", name: "iShares iBonds Dec 2029 Term Muni Bond ETF", maturityYear: 2029, bondType: "muni", productPageId: "307452" },
  { ticker: "IBMO", name: "iShares iBonds Dec 2030 Term Muni Bond ETF", maturityYear: 2030, bondType: "muni", productPageId: "313568" },
  { ticker: "IBMP", name: "iShares iBonds Dec 2031 Term Muni Bond ETF", maturityYear: 2031, bondType: "muni", productPageId: "320375" },
  { ticker: "IBMQ", name: "iShares iBonds Dec 2032 Term Muni Bond ETF", maturityYear: 2032, bondType: "muni", productPageId: "326007" },
  { ticker: "IBMR", name: "iShares iBonds Dec 2033 Term Muni Bond ETF", maturityYear: 2033, bondType: "muni", productPageId: "333126" },

  // Treasury
  { ticker: "IBTE", name: "iShares iBonds Dec 2025 Term Treasury ETF",  maturityYear: 2025, bondType: "treasury", productPageId: "312459" },
  { ticker: "IBTF", name: "iShares iBonds Feb 2026 Term Treasury ETF",  maturityYear: 2026, bondType: "treasury", productPageId: "312461" },
  { ticker: "IBTG", name: "iShares iBonds Dec 2026 Term Treasury ETF",  maturityYear: 2026, bondType: "treasury", productPageId: "312462" },
  { ticker: "IBTH", name: "iShares iBonds Dec 2027 Term Treasury ETF",  maturityYear: 2027, bondType: "treasury", productPageId: "312460" },
  { ticker: "IBTI", name: "iShares iBonds Dec 2028 Term Treasury ETF",  maturityYear: 2028, bondType: "treasury", productPageId: "312463" },
  { ticker: "IBTJ", name: "iShares iBonds Dec 2029 Term Treasury ETF",  maturityYear: 2029, bondType: "treasury", productPageId: "312464" },
  { ticker: "IBTK", name: "iShares iBonds Dec 2030 Term Treasury ETF",  maturityYear: 2030, bondType: "treasury", productPageId: "312465" },
  { ticker: "IBTL", name: "iShares iBonds Dec 2031 Term Treasury ETF",  maturityYear: 2031, bondType: "treasury", productPageId: "312466" },
  { ticker: "IBTM", name: "iShares iBonds Dec 2032 Term Treasury ETF",  maturityYear: 2032, bondType: "treasury", productPageId: "312467" },
  { ticker: "IBTN", name: "iShares iBonds Dec 2033 Term Treasury ETF",  maturityYear: 2033, bondType: "treasury", productPageId: "333127" },

  // TIPS (Treasury Inflation-Protected)
  { ticker: "IBIP", name: "iShares iBonds Dec 2025 Term TIPS ETF",      maturityYear: 2025, bondType: "tips", productPageId: "316903" },
  { ticker: "IBIQ", name: "iShares iBonds Dec 2026 Term TIPS ETF",      maturityYear: 2026, bondType: "tips", productPageId: "316904" },
  { ticker: "IBIR", name: "iShares iBonds Dec 2027 Term TIPS ETF",      maturityYear: 2027, bondType: "tips", productPageId: "316905" },
  { ticker: "IBIS", name: "iShares iBonds Dec 2028 Term TIPS ETF",      maturityYear: 2028, bondType: "tips", productPageId: "316906" },
  { ticker: "IBIT2", name: "iShares iBonds Dec 2029 Term TIPS ETF",    maturityYear: 2029, bondType: "tips", productPageId: "316907" },
];

export const BOND_TYPE_LABELS: Record<BondType, string> = {
  corporate: "Investment Grade Corporate",
  muni:      "Municipal Bond",
  treasury:  "US Treasury",
  tips:      "TIPS (Inflation-Protected)",
};

export const BOND_TYPE_TAX_NOTE: Record<BondType, string> = {
  corporate: "Interest taxable at federal and state level",
  muni:      "Interest generally federal-tax-exempt; may be state-tax-exempt",
  treasury:  "Interest taxable at federal level; state-tax-exempt",
  tips:      "Interest taxable at federal level; inflation adjustments taxable as income",
};
