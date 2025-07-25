import { OrderService } from '@ghostfolio/api/app/order/order.service';
import { environment } from '@ghostfolio/api/environments/environment';
import { BenchmarkService } from '@ghostfolio/api/services/benchmark/benchmark.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { DataProviderService } from '@ghostfolio/api/services/data-provider/data-provider.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data/market-data.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { PropertyService } from '@ghostfolio/api/services/property/property.service';
import { SymbolProfileService } from '@ghostfolio/api/services/symbol-profile/symbol-profile.service';
import {
  PROPERTY_CURRENCIES,
  PROPERTY_IS_READ_ONLY_MODE,
  PROPERTY_IS_USER_SIGNUP_ENABLED
} from '@ghostfolio/common/config';
import {
  getAssetProfileIdentifier,
  getCurrencyFromSymbol,
  isCurrency
} from '@ghostfolio/common/helper';
import {
  AdminData,
  AdminMarketData,
  AdminMarketDataDetails,
  AdminMarketDataItem,
  AdminUsers,
  AssetProfileIdentifier,
  EnhancedSymbolProfile,
  Filter
} from '@ghostfolio/common/interfaces';
import { Sector } from '@ghostfolio/common/interfaces/sector.interface';
import { MarketDataPreset, UserWithSettings } from '@ghostfolio/common/types';

import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger
} from '@nestjs/common';
import {
  AssetClass,
  AssetSubClass,
  DataSource,
  Prisma,
  PrismaClient,
  Property,
  SymbolProfile
} from '@prisma/client';
import { differenceInDays } from 'date-fns';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import { groupBy } from 'lodash';

@Injectable()
export class AdminService {
  public constructor(
    private readonly benchmarkService: BenchmarkService,
    private readonly configurationService: ConfigurationService,
    private readonly dataProviderService: DataProviderService,
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly marketDataService: MarketDataService,
    private readonly orderService: OrderService,
    private readonly prismaService: PrismaService,
    private readonly propertyService: PropertyService,
    private readonly symbolProfileService: SymbolProfileService
  ) {}

  public async addAssetProfile({
    currency,
    dataSource,
    symbol
  }: AssetProfileIdentifier & { currency?: string }): Promise<
    SymbolProfile | never
  > {
    try {
      if (dataSource === 'MANUAL') {
        return this.symbolProfileService.add({
          currency,
          dataSource,
          symbol
        });
      }

      const assetProfiles = await this.dataProviderService.getAssetProfiles([
        { dataSource, symbol }
      ]);

      if (!assetProfiles[symbol]?.currency) {
        throw new BadRequestException(
          `Asset profile not found for ${symbol} (${dataSource})`
        );
      }

      return this.symbolProfileService.add(
        assetProfiles[symbol] as Prisma.SymbolProfileCreateInput
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Asset profile of ${symbol} (${dataSource}) already exists`
        );
      }

      throw error;
    }
  }

  public async deleteProfileData({
    dataSource,
    symbol
  }: AssetProfileIdentifier) {
    await this.marketDataService.deleteMany({ dataSource, symbol });

    const currency = getCurrencyFromSymbol(symbol);
    const customCurrencies =
      await this.propertyService.getByKey<string[]>(PROPERTY_CURRENCIES);

    if (customCurrencies.includes(currency)) {
      const updatedCustomCurrencies = customCurrencies.filter(
        (customCurrency) => {
          return customCurrency !== currency;
        }
      );

      await this.putSetting(
        PROPERTY_CURRENCIES,
        JSON.stringify(updatedCustomCurrencies)
      );
    } else {
      await this.symbolProfileService.delete({ dataSource, symbol });
    }
  }

  public async get({ user }: { user: UserWithSettings }): Promise<AdminData> {
    const dataSources = await this.dataProviderService.getDataSources({
      user,
      includeGhostfolio: true
    });

    const [settings, transactionCount, userCount] = await Promise.all([
      this.propertyService.get(),
      this.prismaService.order.count(),
      this.countUsersWithAnalytics()
    ]);

    const dataProviders = await Promise.all(
      dataSources.map(async (dataSource) => {
        const dataProviderInfo = this.dataProviderService
          .getDataProvider(dataSource)
          .getDataProviderInfo();

        const assetProfileCount = await this.prismaService.symbolProfile.count({
          where: {
            dataSource
          }
        });

        return {
          ...dataProviderInfo,
          assetProfileCount
        };
      })
    );

    return {
      dataProviders,
      settings,
      transactionCount,
      userCount,
      version: environment.version
    };
  }

  public async getMarketData({
    filters,
    presetId,
    sortColumn,
    sortDirection,
    skip,
    take = Number.MAX_SAFE_INTEGER
  }: {
    filters?: Filter[];
    presetId?: MarketDataPreset;
    skip?: number;
    sortColumn?: string;
    sortDirection?: Prisma.SortOrder;
    take?: number;
  }): Promise<AdminMarketData> {
    let orderBy: Prisma.Enumerable<Prisma.SymbolProfileOrderByWithRelationInput> =
      [{ symbol: 'asc' }];
    const where: Prisma.SymbolProfileWhereInput = {};

    if (presetId === 'BENCHMARKS') {
      const benchmarkAssetProfiles =
        await this.benchmarkService.getBenchmarkAssetProfiles();

      where.id = {
        in: benchmarkAssetProfiles.map(({ id }) => {
          return id;
        })
      };
    } else if (presetId === 'CURRENCIES') {
      return this.getMarketDataForCurrencies();
    } else if (
      presetId === 'ETF_WITHOUT_COUNTRIES' ||
      presetId === 'ETF_WITHOUT_SECTORS'
    ) {
      filters = [{ id: 'ETF', type: 'ASSET_SUB_CLASS' }];
    }

    const searchQuery = filters.find(({ type }) => {
      return type === 'SEARCH_QUERY';
    })?.id;

    const { ASSET_SUB_CLASS: filtersByAssetSubClass } = groupBy(
      filters,
      ({ type }) => {
        return type;
      }
    );

    const marketDataItems = await this.prismaService.marketData.groupBy({
      _count: true,
      by: ['dataSource', 'symbol']
    });

    if (filtersByAssetSubClass) {
      where.assetSubClass = AssetSubClass[filtersByAssetSubClass[0].id];
    }

    if (searchQuery) {
      where.OR = [
        { id: { mode: 'insensitive', startsWith: searchQuery } },
        { isin: { mode: 'insensitive', startsWith: searchQuery } },
        { name: { mode: 'insensitive', startsWith: searchQuery } },
        { symbol: { mode: 'insensitive', startsWith: searchQuery } }
      ];
    }

    if (sortColumn) {
      orderBy = [{ [sortColumn]: sortDirection }];

      if (sortColumn === 'activitiesCount') {
        orderBy = {
          activities: {
            _count: sortDirection
          }
        };
      }
    }

    const extendedPrismaClient = this.getExtendedPrismaClient();

    try {
      const symbolProfileResult = await Promise.all([
        extendedPrismaClient.symbolProfile.findMany({
          orderBy,
          skip,
          take,
          where,
          select: {
            _count: {
              select: {
                activities: true,
                watchedBy: true
              }
            },
            activities: {
              orderBy: [{ date: 'asc' }],
              select: { date: true },
              take: 1
            },
            assetClass: true,
            assetSubClass: true,
            comment: true,
            countries: true,
            currency: true,
            dataSource: true,
            id: true,
            isActive: true,
            isUsedByUsersWithSubscription: true,
            name: true,
            scraperConfiguration: true,
            sectors: true,
            symbol: true,
            SymbolProfileOverrides: true
          }
        }),
        this.prismaService.symbolProfile.count({ where })
      ]);
      const assetProfiles = symbolProfileResult[0];
      let count = symbolProfileResult[1];

      const lastMarketPrices = await this.prismaService.marketData.findMany({
        distinct: ['dataSource', 'symbol'],
        orderBy: { date: 'desc' },
        select: {
          dataSource: true,
          marketPrice: true,
          symbol: true
        },
        where: {
          dataSource: {
            in: assetProfiles.map(({ dataSource }) => {
              return dataSource;
            })
          },
          symbol: {
            in: assetProfiles.map(({ symbol }) => {
              return symbol;
            })
          }
        }
      });

      const lastMarketPriceMap = new Map<string, number>();

      for (const { dataSource, marketPrice, symbol } of lastMarketPrices) {
        lastMarketPriceMap.set(
          getAssetProfileIdentifier({ dataSource, symbol }),
          marketPrice
        );
      }

      let marketData: AdminMarketDataItem[] = await Promise.all(
        assetProfiles.map(
          async ({
            _count,
            activities,
            assetClass,
            assetSubClass,
            comment,
            countries,
            currency,
            dataSource,
            id,
            isActive,
            isUsedByUsersWithSubscription,
            name,
            sectors,
            symbol,
            SymbolProfileOverrides
          }) => {
            let countriesCount = countries ? Object.keys(countries).length : 0;

            const lastMarketPrice = lastMarketPriceMap.get(
              getAssetProfileIdentifier({ dataSource, symbol })
            );

            const marketDataItemCount =
              marketDataItems.find((marketDataItem) => {
                return (
                  marketDataItem.dataSource === dataSource &&
                  marketDataItem.symbol === symbol
                );
              })?._count ?? 0;

            let sectorsCount = sectors ? Object.keys(sectors).length : 0;

            if (SymbolProfileOverrides) {
              assetClass = SymbolProfileOverrides.assetClass ?? assetClass;
              assetSubClass =
                SymbolProfileOverrides.assetSubClass ?? assetSubClass;

              if (
                (
                  SymbolProfileOverrides.countries as unknown as Prisma.JsonArray
                )?.length > 0
              ) {
                countriesCount = (
                  SymbolProfileOverrides.countries as unknown as Prisma.JsonArray
                ).length;
              }

              name = SymbolProfileOverrides.name ?? name;

              if (
                (SymbolProfileOverrides.sectors as unknown as Sector[])
                  ?.length > 0
              ) {
                sectorsCount = (
                  SymbolProfileOverrides.sectors as unknown as Prisma.JsonArray
                ).length;
              }
            }

            return {
              assetClass,
              assetSubClass,
              comment,
              currency,
              countriesCount,
              dataSource,
              id,
              isActive,
              lastMarketPrice,
              name,
              symbol,
              marketDataItemCount,
              sectorsCount,
              activitiesCount: _count.activities,
              date: activities?.[0]?.date,
              isUsedByUsersWithSubscription:
                await isUsedByUsersWithSubscription,
              watchedByCount: _count.watchedBy
            };
          }
        )
      );

      if (presetId) {
        if (presetId === 'ETF_WITHOUT_COUNTRIES') {
          marketData = marketData.filter(({ countriesCount }) => {
            return countriesCount === 0;
          });
        } else if (presetId === 'ETF_WITHOUT_SECTORS') {
          marketData = marketData.filter(({ sectorsCount }) => {
            return sectorsCount === 0;
          });
        }

        count = marketData.length;
      }

      return {
        count,
        marketData
      };
    } finally {
      await extendedPrismaClient.$disconnect();

      Logger.debug('Disconnect extended prisma client', 'AdminService');
    }
  }

  public async getMarketDataBySymbol({
    dataSource,
    symbol
  }: AssetProfileIdentifier): Promise<AdminMarketDataDetails> {
    let activitiesCount: EnhancedSymbolProfile['activitiesCount'] = 0;
    let currency: EnhancedSymbolProfile['currency'] = '-';
    let dateOfFirstActivity: EnhancedSymbolProfile['dateOfFirstActivity'];

    if (isCurrency(getCurrencyFromSymbol(symbol))) {
      currency = getCurrencyFromSymbol(symbol);
      ({ activitiesCount, dateOfFirstActivity } =
        await this.orderService.getStatisticsByCurrency(currency));
    }

    const [[assetProfile], marketData] = await Promise.all([
      this.symbolProfileService.getSymbolProfiles([
        {
          dataSource,
          symbol
        }
      ]),
      this.marketDataService.marketDataItems({
        orderBy: {
          date: 'asc'
        },
        where: {
          dataSource,
          symbol
        }
      })
    ]);

    if (assetProfile) {
      assetProfile.dataProviderInfo = this.dataProviderService
        .getDataProvider(assetProfile.dataSource)
        .getDataProviderInfo();
    }

    return {
      marketData,
      assetProfile: assetProfile ?? {
        activitiesCount,
        currency,
        dataSource,
        dateOfFirstActivity,
        symbol,
        isActive: true
      }
    };
  }

  public async getUsers({
    skip,
    take = Number.MAX_SAFE_INTEGER
  }: {
    skip?: number;
    take?: number;
  }): Promise<AdminUsers> {
    const [count, users] = await Promise.all([
      this.countUsersWithAnalytics(),
      this.getUsersWithAnalytics({ skip, take })
    ]);

    return { count, users };
  }

  public async patchAssetProfileData(
    { dataSource, symbol }: AssetProfileIdentifier,
    {
      assetClass,
      assetSubClass,
      comment,
      countries,
      currency,
      dataSource: newDataSource,
      holdings,
      isActive,
      name,
      scraperConfiguration,
      sectors,
      symbol: newSymbol,
      symbolMapping,
      url
    }: Prisma.SymbolProfileUpdateInput
  ) {
    if (
      newSymbol &&
      newDataSource &&
      (newSymbol !== symbol || newDataSource !== dataSource)
    ) {
      const [assetProfile] = await this.symbolProfileService.getSymbolProfiles([
        {
          dataSource: DataSource[newDataSource.toString()],
          symbol: newSymbol as string
        }
      ]);

      if (assetProfile) {
        throw new HttpException(
          getReasonPhrase(StatusCodes.CONFLICT),
          StatusCodes.CONFLICT
        );
      }

      try {
        Promise.all([
          await this.symbolProfileService.updateAssetProfileIdentifier(
            {
              dataSource,
              symbol
            },
            {
              dataSource: DataSource[newDataSource.toString()],
              symbol: newSymbol as string
            }
          ),
          await this.marketDataService.updateAssetProfileIdentifier(
            {
              dataSource,
              symbol
            },
            {
              dataSource: DataSource[newDataSource.toString()],
              symbol: newSymbol as string
            }
          )
        ]);

        return this.symbolProfileService.getSymbolProfiles([
          {
            dataSource: DataSource[newDataSource.toString()],
            symbol: newSymbol as string
          }
        ])?.[0];
      } catch {
        throw new HttpException(
          getReasonPhrase(StatusCodes.BAD_REQUEST),
          StatusCodes.BAD_REQUEST
        );
      }
    } else {
      const symbolProfileOverrides = {
        assetClass: assetClass as AssetClass,
        assetSubClass: assetSubClass as AssetSubClass,
        name: name as string,
        url: url as string
      };

      const updatedSymbolProfile: Prisma.SymbolProfileUpdateInput = {
        comment,
        countries,
        currency,
        dataSource,
        holdings,
        isActive,
        scraperConfiguration,
        sectors,
        symbol,
        symbolMapping,
        ...(dataSource === 'MANUAL'
          ? { assetClass, assetSubClass, name, url }
          : {
              SymbolProfileOverrides: {
                upsert: {
                  create: symbolProfileOverrides,
                  update: symbolProfileOverrides
                }
              }
            })
      };

      await this.symbolProfileService.updateSymbolProfile(
        {
          dataSource,
          symbol
        },
        updatedSymbolProfile
      );

      return this.symbolProfileService.getSymbolProfiles([
        {
          dataSource: dataSource as DataSource,
          symbol: symbol as string
        }
      ])?.[0];
    }
  }

  public async putSetting(key: string, value: string) {
    let response: Property;

    if (value) {
      response = await this.propertyService.put({ key, value });
    } else {
      response = await this.propertyService.delete({ key });
    }

    if (key === PROPERTY_IS_READ_ONLY_MODE && value === 'true') {
      await this.putSetting(PROPERTY_IS_USER_SIGNUP_ENABLED, 'false');
    } else if (key === PROPERTY_CURRENCIES) {
      await this.exchangeRateDataService.initialize();
    }

    return response;
  }

  private async countUsersWithAnalytics() {
    let where: Prisma.UserWhereInput;

    if (this.configurationService.get('ENABLE_FEATURE_SUBSCRIPTION')) {
      where = {
        NOT: {
          analytics: null
        }
      };
    }

    return this.prismaService.user.count({
      where
    });
  }

  private getExtendedPrismaClient() {
    Logger.debug('Connect extended prisma client', 'AdminService');

    const symbolProfileExtension = Prisma.defineExtension((client) => {
      return client.$extends({
        result: {
          symbolProfile: {
            isUsedByUsersWithSubscription: {
              compute: async ({ id }) => {
                const { _count } =
                  await this.prismaService.symbolProfile.findUnique({
                    select: {
                      _count: {
                        select: {
                          activities: {
                            where: {
                              user: {
                                subscriptions: {
                                  some: {
                                    expiresAt: {
                                      gt: new Date()
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    },
                    where: {
                      id
                    }
                  });

                return _count.activities > 0;
              }
            }
          }
        }
      });
    });

    return new PrismaClient().$extends(symbolProfileExtension);
  }

  private async getMarketDataForCurrencies(): Promise<AdminMarketData> {
    const currencyPairs = this.exchangeRateDataService.getCurrencyPairs();

    const [lastMarketPrices, marketDataItems] = await Promise.all([
      this.prismaService.marketData.findMany({
        distinct: ['dataSource', 'symbol'],
        orderBy: { date: 'desc' },
        select: {
          dataSource: true,
          marketPrice: true,
          symbol: true
        },
        where: {
          dataSource: {
            in: currencyPairs.map(({ dataSource }) => {
              return dataSource;
            })
          },
          symbol: {
            in: currencyPairs.map(({ symbol }) => {
              return symbol;
            })
          }
        }
      }),
      this.prismaService.marketData.groupBy({
        _count: true,
        by: ['dataSource', 'symbol']
      })
    ]);

    const lastMarketPriceMap = new Map<string, number>();

    for (const { dataSource, marketPrice, symbol } of lastMarketPrices) {
      lastMarketPriceMap.set(
        getAssetProfileIdentifier({ dataSource, symbol }),
        marketPrice
      );
    }

    const marketDataPromise: Promise<AdminMarketDataItem>[] = currencyPairs.map(
      async ({ dataSource, symbol }) => {
        let activitiesCount: EnhancedSymbolProfile['activitiesCount'] = 0;
        let currency: EnhancedSymbolProfile['currency'] = '-';
        let dateOfFirstActivity: EnhancedSymbolProfile['dateOfFirstActivity'];

        if (isCurrency(getCurrencyFromSymbol(symbol))) {
          currency = getCurrencyFromSymbol(symbol);
          ({ activitiesCount, dateOfFirstActivity } =
            await this.orderService.getStatisticsByCurrency(currency));
        }

        const lastMarketPrice = lastMarketPriceMap.get(
          getAssetProfileIdentifier({ dataSource, symbol })
        );

        const marketDataItemCount =
          marketDataItems.find((marketDataItem) => {
            return (
              marketDataItem.dataSource === dataSource &&
              marketDataItem.symbol === symbol
            );
          })?._count ?? 0;

        return {
          activitiesCount,
          currency,
          dataSource,
          lastMarketPrice,
          marketDataItemCount,
          symbol,
          assetClass: AssetClass.LIQUIDITY,
          assetSubClass: AssetSubClass.CASH,
          countriesCount: 0,
          date: dateOfFirstActivity,
          id: undefined,
          isActive: true,
          name: symbol,
          sectorsCount: 0,
          watchedByCount: 0
        };
      }
    );

    const marketData = await Promise.all(marketDataPromise);
    return { marketData, count: marketData.length };
  }

  private async getUsersWithAnalytics({
    skip,
    take
  }: {
    skip?: number;
    take?: number;
  }): Promise<AdminUsers['users']> {
    let orderBy: Prisma.UserOrderByWithRelationInput = {
      createdAt: 'desc'
    };
    let where: Prisma.UserWhereInput;

    if (this.configurationService.get('ENABLE_FEATURE_SUBSCRIPTION')) {
      orderBy = {
        analytics: {
          lastRequestAt: 'desc'
        }
      };
      where = {
        NOT: {
          analytics: null
        }
      };
    }

    const usersWithAnalytics = await this.prismaService.user.findMany({
      orderBy,
      skip,
      take,
      where,
      select: {
        _count: {
          select: { accounts: true, activities: true }
        },
        analytics: {
          select: {
            activityCount: true,
            country: true,
            dataProviderGhostfolioDailyRequests: true,
            updatedAt: true
          }
        },
        createdAt: true,
        id: true,
        role: true,
        subscriptions: {
          orderBy: {
            expiresAt: 'desc'
          },
          take: 1,
          where: {
            expiresAt: {
              gt: new Date()
            }
          }
        }
      }
    });

    return usersWithAnalytics.map(
      ({ _count, analytics, createdAt, id, role, subscriptions }) => {
        const daysSinceRegistration =
          differenceInDays(new Date(), createdAt) + 1;
        const engagement = analytics
          ? analytics.activityCount / daysSinceRegistration
          : undefined;

        const subscription =
          this.configurationService.get('ENABLE_FEATURE_SUBSCRIPTION') &&
          subscriptions?.length > 0
            ? subscriptions[0]
            : undefined;

        return {
          createdAt,
          engagement,
          id,
          role,
          subscription,
          accountCount: _count.accounts || 0,
          activityCount: _count.activities || 0,
          country: analytics?.country,
          dailyApiRequests: analytics?.dataProviderGhostfolioDailyRequests || 0,
          lastActivity: analytics?.updatedAt
        };
      }
    );
  }
}
