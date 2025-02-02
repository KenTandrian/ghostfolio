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
  IPluangHistoricalResponse,
  IPluangSearchResponse
} from './interfaces/interfaces';

@Injectable()
export class PluangService implements DataProviderInterface {
  private readonly apiUrl = 'https://api-pluang.pluang.com/api/v4';
  private readonly userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15';
  private readonly assetClassMap: {
    [key: string]: AssetClass;
  } = {
    global_equity: AssetClass.EQUITY,
    cryptocurrency: AssetClass.LIQUIDITY
  };
  private readonly assetSubClassMap: {
    [key: string]: AssetSubClass;
  } = {
    CRYPTO: AssetSubClass.CRYPTOCURRENCY,
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
      assetClass: AssetClass.LIQUIDITY,
      assetSubClass: AssetSubClass.CRYPTOCURRENCY,
      currency: 'IDR',
      dataSource: this.getName()
    };

    try {
      const { data } = await fetch(
        `${this.apiUrl}/asset/cryptocurrency/description?cryptocurrency=${symbol}`,
        {
          headers: { 'User-Agent': this.userAgent },
          signal: AbortSignal.timeout(
            this.configurationService.get('REQUEST_TIMEOUT')
          )
        }
      ).then((res) => res.json() as Promise<IPluangDescriptionResponse>);

      response.name = data.cryptoCurrencyName;
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
      const { data } = await fetch(
        `${this.apiUrl}/asset/cryptocurrency/price/price-stats-history?cryptocurrency=${symbol}&timeframe=3M`,
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
        const { data } = await fetch(
          `${this.apiUrl}/asset/cryptocurrency/price/price-stats-history?cryptocurrency=${symbol}&timeframe=3M`,
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
        `https://pluang.com/_next/data/dashboard_ZtScS88NtD/id/explore/search.json?query=${query}`,
        {
          signal: AbortSignal.timeout(
            this.configurationService.get('REQUEST_TIMEOUT')
          )
        }
      ).then((res) => res.json() as Promise<IPluangSearchResponse>);

      return {
        items: pageProps.pageData?.assetCategories[0].assetCategoryData
          .map((d) => d.tileInfo)
          .map((item) => ({
            name: item.name,
            symbol: item.symbol,
            assetClass: this.assetClassMap[item.group],
            assetSubClass:
              this.assetSubClassMap[
                item.securityType ?? item.recurringAssetType
              ],
            currency: 'IDR',
            dataProviderInfo: this.getDataProviderInfo(),
            dataSource: this.getName()
          }))
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
