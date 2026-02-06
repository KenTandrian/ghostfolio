import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import {
  DataProviderInterface,
  GetDividendsParams,
  GetHistoricalParams,
  GetQuotesParams,
  GetSearchParams
} from '@ghostfolio/api/services/data-provider/interfaces/data-provider.interface';
import {
  DataProviderHistoricalResponse,
  DataProviderInfo,
  DataProviderResponse,
  LookupResponse
} from '@ghostfolio/common/interfaces';

import { Injectable, Logger } from '@nestjs/common';
import {
  AssetClass,
  AssetSubClass,
  DataSource,
  SymbolProfile
} from '@prisma/client';
import * as CryptoJS from 'crypto-js';

import {
  IBibitFRChartResponse,
  IBibitFRProductResponse,
  IBibitGenericResponse,
  IBibitRDChart,
  IBibitRDProduct,
  IBibitSearchResponse
} from './interfaces/interfaces';

@Injectable()
export class BibitService implements DataProviderInterface {
  private readonly apiUrl: string;
  private readonly assetClassMap: {
    [key: string]: AssetClass;
  } = {
    Obligasi: AssetClass.FIXED_INCOME,
    'Pasar Uang': AssetClass.FIXED_INCOME,
    Saham: AssetClass.EQUITY
  };
  private readonly assetSubClassMap: {
    [key: number]: AssetSubClass;
  } = {
    0: AssetSubClass.MUTUALFUND,
    1: AssetSubClass.BOND,
    2: AssetSubClass.STOCK
  };

  public constructor(
    private readonly configurationService: ConfigurationService
  ) {
    this.apiUrl = 'https://api.bibit.id';
  }

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
      assetClass: AssetClass.FIXED_INCOME,
      assetSubClass: AssetSubClass.BOND,
      countries: [{ code: 'ID', weight: 1 }],
      currency: 'IDR',
      dataSource: this.getName()
    };

    try {
      if (this.isFRBond(symbol)) {
        const { data } = await fetch(
          `${this.apiUrl}/bonds/fixed-rate/products/${symbol}`,
          {
            signal: AbortSignal.timeout(
              this.configurationService.get('REQUEST_TIMEOUT')
            )
          }
        ).then((res) => res.json() as Promise<IBibitFRProductResponse>);

        response.name = data.name;
        response.url = 'https://www.kemenkeu.go.id';
      } else {
        const { data } = await fetch(`${this.apiUrl}/products/${symbol}`, {
          signal: AbortSignal.timeout(
            this.configurationService.get('REQUEST_TIMEOUT')
          )
        }).then((res) => res.json() as Promise<IBibitGenericResponse>);
        const decryptedData = this.decrypt<IBibitRDProduct>(data);

        response.name = decryptedData.name;
        response.assetClass = this.assetClassMap[decryptedData.type];
        response.assetSubClass =
          this.assetSubClassMap[decryptedData.instrument_group];
      }
    } catch (error) {
      Logger.error(
        `Could not get asset profile for ${symbol} (${this.getName()}): [${error.name}] ${error.message}`,
        'BibitService'
      );
    }
    return response;
  }

  public getDataProviderInfo(): DataProviderInfo {
    return {
      dataSource: DataSource.BIBIT,
      isPremium: false,
      name: 'Bibit',
      url: 'https://bibit.id/'
    };
  }

  public async getDividends({}: GetDividendsParams) {
    return {};
  }

  public async getHistorical({
    requestTimeout = this.configurationService.get('REQUEST_TIMEOUT'),
    from,
    symbol
  }: GetHistoricalParams): Promise<{
    [symbol: string]: { [date: string]: DataProviderHistoricalResponse };
  }> {
    try {
      const period = this.getPeriod(from);
      if (this.isFRBond(symbol)) {
        const { data } = await fetch(
          `${this.apiUrl}/bonds/fixed-rate/products/${symbol}/charts?period=${period}`,
          {
            signal: AbortSignal.timeout(requestTimeout)
          }
        ).then((res) => res.json() as Promise<IBibitFRChartResponse>);
        const result = {
          [symbol]: data.prices.reduce((acc, item) => {
            acc[item.formated_date] = {
              marketPrice: item.sell_price.price_rate * 10000
            };
            return acc;
          }, {})
        };
        return result;
      } else {
        const { data } = await fetch(
          `${this.apiUrl}/products/${symbol}/chart?period=${period}`,
          {
            signal: AbortSignal.timeout(requestTimeout)
          }
        ).then((res) => res.json() as Promise<IBibitGenericResponse>);
        const decryptedData = this.decrypt<IBibitRDChart>(data);
        return {
          [symbol]: decryptedData.chart.reduce((acc, item) => {
            acc[item.formated_date] = {
              marketPrice: item.value
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
    return DataSource.BIBIT;
  }

  public async getQuotes({
    requestTimeout = this.configurationService.get('REQUEST_TIMEOUT'),
    symbols
  }: GetQuotesParams) {
    const response: { [symbol: string]: DataProviderResponse } = {};

    if (symbols.length <= 0) {
      return response;
    }

    try {
      const promises = symbols.map(async (symbol) => {
        if (this.isFRBond(symbol)) {
          const { data } = await fetch(
            `${this.apiUrl}/bonds/fixed-rate/products/${symbol}`,
            {
              signal: AbortSignal.timeout(requestTimeout)
            }
          ).then((res) => res.json() as Promise<IBibitFRProductResponse>);

          response[symbol] = {
            currency: 'IDR',
            dataProviderInfo: this.getDataProviderInfo(),
            dataSource: DataSource.BIBIT,
            marketPrice: data.sell_price.price_rate * 10000,
            marketState: 'open'
          };
        } else {
          const { data } = await fetch(`${this.apiUrl}/products/${symbol}`, {
            signal: AbortSignal.timeout(requestTimeout)
          }).then((res) => res.json() as Promise<IBibitGenericResponse>);
          const decryptedData = this.decrypt<{ nav: { value: number } }>(data);
          response[symbol] = {
            currency: 'IDR',
            dataProviderInfo: this.getDataProviderInfo(),
            dataSource: DataSource.BIBIT,
            marketPrice: decryptedData.nav.value,
            marketState: 'open'
          };
        }
      });
      await Promise.all(promises);
    } catch (error) {
      Logger.error(error, 'BibitService');
    }
    return response;
  }

  public getTestSymbol() {
    return 'FR0091';
  }

  public async search({ query }: GetSearchParams): Promise<LookupResponse> {
    try {
      const { data } = await fetch(
        `${this.apiUrl}/search?keyword=${query}&limit=10&page=1&v=3`,
        {
          signal: AbortSignal.timeout(
            this.configurationService.get('REQUEST_TIMEOUT')
          )
        }
      ).then((res) => res.json() as Promise<IBibitSearchResponse>);

      return {
        items: data.map((item) => ({
          name: item.name,
          symbol: item.symbol,
          assetClass: this.assetClassMap[item.type],
          assetSubClass: this.assetSubClassMap[item.instrument_group],
          currency: 'IDR',
          dataProviderInfo: this.getDataProviderInfo(),
          dataSource: this.getName()
        }))
      };
    } catch (error) {
      Logger.error(
        `Could not get search results for ${query} (${this.getName()}): [${error.name}] ${error.message}`,
        'BibitService'
      );
      return { items: [] };
    }
  }

  private decrypt<T>(data?: string) {
    if (!data) return {} as T;

    const iv = CryptoJS.enc.Hex.parse(data.slice(0, 32));
    const encryptedData = data.slice(32, -32);
    const secret = CryptoJS.enc.Utf8.parse(data.slice(-32));

    const bytes = CryptoJS.AES.decrypt(encryptedData, secret, {
      iv,
      mode: CryptoJS.mode.CBC,
      format: CryptoJS.format.Hex
    });

    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8)) as T;
  }

  private isFRBond(symbol: string) {
    return symbol.startsWith('FR') || symbol.startsWith('PBS');
  }

  private getPeriod(from: Date) {
    const now = new Date();
    const diff = now.getTime() - new Date(from).getTime();
    const diffDays = Math.ceil(diff / (1000 * 3600 * 24));

    let period = '1m';
    if (diffDays > 1825) period = 'all';
    else if (diffDays > 1095) period = '5y';
    else if (diffDays > 365) period = '3y';
    else if (diffDays > 90) period = '1y';
    else if (diffDays > 30) period = '3m';

    return period;
  }
}
