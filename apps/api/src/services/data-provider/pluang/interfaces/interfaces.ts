export interface IPluangDescriptionResponse {
  data: {
    assetId: number;
    cryptoCurrencyName: string;
    cryptoCurrencySymbol: string;
  };
}

export interface IPluangHistoricalResponse {
  data: {
    currentPrice: {
      midPrice: number;
    };
    priceHistory: {
      candleStickTimeFrame: string;
      closeMidPrice: number;
      createdAt: string;
      cryptoCurrencyId: number;
      cryptoCurrencySymbol: string;
      endTime: string;
      highMidPrice: number;
      id: string;
      lowMidPrice: number;
      openMidPrice: number;
      priceStatDate: string;
      startTime: string;
      updatedAt: string;
      volume: number;
    }[];
  };
}

export interface IPluangSearchResponse {
  locale: string;
  pageProps: {
    pageData: {
      assets: {
        clickAction: {
          target: string;
          type: string;
        };
        tileInfo: {
          assetId: number;
          category: string;
          chartTicker: string;
          displaySymbol: string;
          group: string;
          icon: string;
          id: string;
          isMetal: boolean;
          isTradable: boolean;
          name: string;
          pricePrecision: number;
          recurringAssetType?: string;
          securityType?: string;
          sparkLine: string;
          subscriptionId: string;
          symbol: string;
          watchlistAssetCode: string;
          watchlistCode: string;
        };
      }[];
      page: number;
      pageSize: number;
      searchText: string;
      total: number;
      totalPageCount: number;
    } | null;
    query: string;
  };
}

export interface IPluangGoldPricingResponse {
  data: {
    currency: string;
    current: {
      midPrice: number;
      sell: number;
      buy: number;
      installment: number;
      updated_at: string;
    };
    history: {
      midPrice: number;
      sell: number;
      buy: number;
      installment: number;
      updated_at: string;
    }[];
  };
}
