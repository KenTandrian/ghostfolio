export interface IBibitFRProductResponse {
  message: string;
  data: IBibitFRProduct;
}

export interface IBibitSearchResponse {
  message: string;
  data: IBibitSearchProduct[];
}

export interface IBibitFRChartResponse {
  message: string;
  data: {
    prices: {
      date: number;
      formated_date: string;
      xlabel: number;
      basis_point: number;
      basis_percent: number;
      buy_price: {
        price_rate: number;
        yield: number;
      };
      sell_price: {
        price_rate: number;
        yield: number;
      };
      performance_price: {
        price_rate: number;
        buy_price_rate: number;
        yield: number;
      };
    }[];
    xaxisopt: string;
  };
}

export interface IBibitGenericResponse {
  message: string;
  data: string;
}

export interface IBibitRDProduct {
  id: number;
  symbol: string;
  name: string;
  type: string;
  profile: string;
  instrument_group: number;
  tradeable: number;
  notbuyable: number;
  status: number;
  dividend_date: string;
  robocategory: string;
  bank_redeem: {
    id: number;
    name: string;
    color: string;
    icon_url: string;
  };
  released_date: string;
  is_top_product: number;
  currency_exchange: {
    exchange_rate: number;
    currency: string;
  };
  is_has_dividend: boolean;
  min_asset: number;
  minsell: number;
  minbuy: number;
  min_buy_next_purchase: number;
  min_buy_after_sell_all: number;
  fee: Record<
    string,
    { value: number; max_value: number; type: string; currency: string }
  >;
  asset: { name: string; percentage: number }[];
  holding: {
    symbol: string;
    name: string;
    annualDividend: number;
    date: string;
    clickable: number;
    company_id: number;
    product_type: string;
    serie_id: number;
  }[];
  bank: {
    id: number;
    bank: string;
    account: string;
    name: string;
  }[];
  investment_manager: { name: string; ojkCode: string };
  custodian_bank: { name: string; ojkCode: string };
  sharia: boolean;
  etf: boolean;
  index: boolean;
  is_instant_redemption: boolean;
  aum: { value: number; date: string };
  expenseratio: { percentage: number };
  avg_yield: { date: string; percentage: number };
  cagr: Record<string, number | null>;
  cagr_adjusted: Record<string, number | null>;
  simplereturn: Record<string, number | null>;
  changesvalue: Record<string, number | null>;
  riskprofile: string;
  maxdrawdown: Record<string, number>;
  maxdrawdown_adjusted: Record<string, number>;
  nav: { date: string; first_date: string; value: number };
}

interface IBibitFRProduct {
  id: number;
  name: string;
  serie_code: string;
  serie_type: string;
  serie_status: string;
  instrument_group: number;
  buy_price: {
    price_rate: number;
    yield: number;
  };
  sell_price: {
    price_rate: number;
    yield: number;
  };
  performance_price: {
    price_rate: number;
    buy_price_rate: number;
    yield: number;
  };
  coupon_rate: number;
  prev_coupon_returned_schedule: string;
  coupon_returned_schedule: string;
  settlement_date: string;
  recording_date: string;
  coupon_distribution: string;
  min_order: number;
  order_multiples: number;
  publish_date: string;
  publisher: string;
  due_at: string;
  icon_url: string;
  memo_url: string;
  chart_periods: string[];
  is_sharia: number;
  is_tradable: boolean;
  is_transactable: boolean;
  is_highest_yield: boolean;
  is_top_short_term: boolean;
  is_highest_yield_over_the_last_month: boolean;
  is_highest_yield_over_the_last_three_months: boolean;
}

interface IBibitSearchProduct {
  id: number;
  symbol: string;
  name: string;
  type: string;
  instrument_group: number;
  serie_status: string;
  serie_type: string;
  icon_url: string;
  is_sharia: boolean;
}

export interface IBibitRDChart {
  change: number;
  percent: number;
  chart: {
    date: number;
    formated_date: string;
    xlabel: number;
    value: number;
    value_adjusted: number;
  }[];
  xaxisopt: string;
}
