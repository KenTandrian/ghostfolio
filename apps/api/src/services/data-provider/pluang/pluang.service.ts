import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import {
  DataProviderInterface,
  GetDividendsParams,
  GetHistoricalParams,
  GetQuotesParams,
  GetSearchParams
} from '@ghostfolio/api/services/data-provider/interfaces/data-provider.interface';
import {
  IDataProviderHistoricalResponse,
  IDataProviderResponse
} from '@ghostfolio/api/services/interfaces/interfaces';
import {
  DataProviderInfo,
  LookupResponse
} from '@ghostfolio/common/interfaces';

import { Injectable, Logger } from '@nestjs/common';
import {
  AssetClass,
  AssetSubClass,
  DataSource,
  SymbolProfile
} from '@prisma/client';

import {
  IPluangDescriptionResponse,
  IPluangGoldPricingResponse,
  IPluangHistoricalResponse,
  IPluangSearchResponse
} from './interfaces/interfaces';

@Injectable()
export class PluangService implements DataProviderInterface {
  private readonly apiUrl = 'https://api-pluang.pluang.com/api';
  private readonly userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15';
  private readonly assetClassMap: {
    [key: string]: AssetClass;
  } = {
    cryptocurrency: AssetClass.LIQUIDITY,
    global_equity: AssetClass.EQUITY,
    gold: AssetClass.COMMODITY
  };
  private readonly assetSubClassMap: {
    [key: string]: AssetSubClass;
  } = {
    CRYPTO: AssetSubClass.CRYPTOCURRENCY,
    ETF: AssetSubClass.ETF,
    gold: AssetSubClass.PRECIOUS_METAL,
    STOCK: AssetSubClass.STOCK
  };

  public constructor(
    private readonly configurationService: ConfigurationService
  ) {}

  public canHandle() {
    return true;
  }

  public async getAssetProfile({
    symbol
  }: {
    symbol: string;
  }): Promise<Partial<SymbolProfile>> {
    const response: Partial<SymbolProfile> = {
      symbol,
      currency: 'IDR',
      dataSource: this.getName()
    };

    try {
      if (symbol === 'GOLD') {
        response.assetClass = AssetClass.COMMODITY;
        response.assetSubClass = AssetSubClass.PRECIOUS_METAL;
        response.name = 'Emas';
      } else {
        const { data } = await fetch(
          `${this.apiUrl}/v4/asset/cryptocurrency/description?cryptocurrency=${symbol}`,
          {
            headers: { 'User-Agent': this.userAgent },
            signal: AbortSignal.timeout(
              this.configurationService.get('REQUEST_TIMEOUT')
            )
          }
        ).then((res) => res.json() as Promise<IPluangDescriptionResponse>);

        response.assetClass = AssetClass.LIQUIDITY;
        response.assetSubClass = AssetSubClass.CRYPTOCURRENCY;
        response.name = data.cryptoCurrencyName;
      }
    } catch (error) {
      Logger.error(
        `Could not get asset profile for ${symbol} (${this.getName()}): [${error.name}] ${error.message}`,
        'PluangService'
      );
    }
    return response;
  }

  public getDataProviderInfo(): DataProviderInfo {
    return {
      dataSource: DataSource.PLUANG,
      isPremium: false,
      name: 'Pluang',
      url: 'https://pluang.com'
    };
  }

  public async getDividends({}: GetDividendsParams) {
    return {};
  }

  public async getHistorical({
    requestTimeout = this.configurationService.get('REQUEST_TIMEOUT'),
    symbol
  }: GetHistoricalParams): Promise<{
    [symbol: string]: { [date: string]: IDataProviderHistoricalResponse };
  }> {
    try {
      if (symbol === 'GOLD') {
        const { data } = await fetch(
          `${this.apiUrl}/v3/asset/gold/pricing?daysLimit=90`,
          {
            headers: { 'User-Agent': this.userAgent },
            signal: AbortSignal.timeout(requestTimeout)
          }
        ).then((res) => res.json() as Promise<IPluangGoldPricingResponse>);

        return {
          [symbol]: data.history.reduce((acc, item) => {
            acc[item.updated_at.split('T')[0]] = {
              marketPrice: item.midPrice
            };
            return acc;
          }, {})
        };
      } else {
        const { data } = await fetch(
          `${this.apiUrl}/v4/asset/cryptocurrency/price/price-stats-history?cryptocurrency=${symbol}&timeframe=3M`,
          {
            headers: { 'User-Agent': this.userAgent },
            signal: AbortSignal.timeout(requestTimeout)
          }
        ).then((res) => res.json() as Promise<IPluangHistoricalResponse>);

        return {
          [symbol]: data.priceHistory.reduce((acc, item) => {
            acc[item.priceStatDate.split('T')[0]] = {
              marketPrice: item.closeMidPrice
            };
            return acc;
          }, {})
        };
      }
    } catch (error) {
      throw new Error(
        `Could not get historical data for ${symbol} (${this.getName()}): [${error.name}] ${error.message}`
      );
    }
  }

  public getName(): DataSource {
    return DataSource.PLUANG;
  }

  public async getQuotes({
    requestTimeout = this.configurationService.get('REQUEST_TIMEOUT'),
    symbols
  }: GetQuotesParams) {
    const response: { [symbol: string]: IDataProviderResponse } = {};

    if (symbols.length <= 0) {
      return response;
    }
    try {
      const promises = symbols.map(async (symbol) => {
        if (symbol === 'GOLD') {
          const { data } = await fetch(
            'https://api-pluang.pluang.com/api/v3/asset/gold/pricing?daysLimit=1',
            {
              headers: { 'User-Agent': this.userAgent },
              signal: AbortSignal.timeout(requestTimeout)
            }
          ).then((res) => res.json() as Promise<IPluangGoldPricingResponse>);

          response[symbol] = {
            currency: data.currency,
            dataProviderInfo: this.getDataProviderInfo(),
            dataSource: DataSource.PLUANG,
            marketPrice: data.current.midPrice,
            marketState: 'open'
          };
        } else {
          const { data } = await fetch(
            `${this.apiUrl}/v4/asset/cryptocurrency/price/price-stats-history?cryptocurrency=${symbol}&timeframe=3M`,
            {
              headers: { 'User-Agent': this.userAgent },
              signal: AbortSignal.timeout(requestTimeout)
            }
          ).then((res) => res.json() as Promise<IPluangHistoricalResponse>);

          response[symbol] = {
            currency: 'IDR',
            dataProviderInfo: this.getDataProviderInfo(),
            dataSource: DataSource.PLUANG,
            marketPrice: data.currentPrice.midPrice,
            marketState: 'open'
          };
        }
      });
      await Promise.all(promises);
    } catch (error) {
      Logger.error(error, 'PluangService');
    }
    return response;
  }

  public getTestSymbol() {
    return 'BTC';
  }

  public async search({ query }: GetSearchParams): Promise<LookupResponse> {
    try {
      const { pageProps } = await fetch(
        `https://pluang.com/_next/data/${process.env.PLUANG_DASH_ID}/id/explore/search.json?query=${query}`,
        {
          signal: AbortSignal.timeout(
            this.configurationService.get('REQUEST_TIMEOUT')
          )
        }
      ).then((res) => res.json() as Promise<IPluangSearchResponse>);

      return {
        items: pageProps.pageData?.assetCategories
          .map((cat) =>
            cat.assetCategoryData
              .map((d) => d.tileInfo)
              .map((item) => ({
                name: item.name,
                symbol: item.symbol,
                assetClass: this.assetClassMap[item.group],
                assetSubClass:
                  this.assetSubClassMap[
                    item.securityType ?? item.recurringAssetType ?? item.group
                  ],
                currency: item.watchlistAssetCode.startsWith('USSTOCK:')
                  ? 'USD'
                  : 'IDR',
                dataProviderInfo: this.getDataProviderInfo(),
                dataSource: this.getName()
              }))
          )
          .flat()
      };
    } catch (error) {
      Logger.error(
        `Could not get search results for ${query} (${this.getName()}): [${error.name}] ${error.message}`,
        'PluangService'
      );
      return { items: [] };
    }
  }
}
