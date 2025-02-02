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
  pageProps: {
    pageData: {
      assetCategories: {
        assetCategory: string;
        assetCategoryData: {
          tileInfo: {
            assetId: number;
            category: string;
            displaySymbol: string;
            group: string;
            icon: string;
            id: string;
            isTradable: boolean;
            name: string;
            pricePrecision: number;
            recurringAssetType: string;
            securityType?: string;
            sparkLine: string;
            subscriptionId: string;
            symbol: string;
            watchlistAssetCode: string;
            watchlistCode: string;
          };
        }[];
        priceAlertCategory: string;
        title: string;
      }[];
    } | null;
    query: string;
  };
}
