import { EventsModule } from '@ghostfolio/api/events/events.module';
import { ConfigurationModule } from '@ghostfolio/api/services/configuration/configuration.module';
import { CronService } from '@ghostfolio/api/services/cron.service';
import { DataProviderModule } from '@ghostfolio/api/services/data-provider/data-provider.module';
import { ExchangeRateDataModule } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';
import { PropertyModule } from '@ghostfolio/api/services/property/property.module';
import { DataGatheringModule } from '@ghostfolio/api/services/queues/data-gathering/data-gathering.module';
import { PortfolioSnapshotQueueModule } from '@ghostfolio/api/services/queues/portfolio-snapshot/portfolio-snapshot.module';
import { TwitterBotModule } from '@ghostfolio/api/services/twitter-bot/twitter-bot.module';
import {
  DEFAULT_LANGUAGE_CODE,
  SUPPORTED_LANGUAGE_CODES
} from '@ghostfolio/common/config';

import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { StatusCodes } from 'http-status-codes';
import { join } from 'path';

import { AccessModule } from './access/access.module';
import { AccountModule } from './account/account.module';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AssetModule } from './asset/asset.module';
import { AuthDeviceModule } from './auth-device/auth-device.module';
import { AuthModule } from './auth/auth.module';
import { BenchmarkModule } from './benchmark/benchmark.module';
import { CacheModule } from './cache/cache.module';
import { ApiKeysModule } from './endpoints/api-keys/api-keys.module';
import { GhostfolioModule } from './endpoints/data-providers/ghostfolio/ghostfolio.module';
import { MarketDataModule } from './endpoints/market-data/market-data.module';
import { PublicModule } from './endpoints/public/public.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';
import { ExportModule } from './export/export.module';
import { HealthModule } from './health/health.module';
import { ImportModule } from './import/import.module';
import { InfoModule } from './info/info.module';
import { LogoModule } from './logo/logo.module';
import { OrderModule } from './order/order.module';
import { PlatformModule } from './platform/platform.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { RedisCacheModule } from './redis-cache/redis-cache.module';
import { SitemapModule } from './sitemap/sitemap.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SymbolModule } from './symbol/symbol.module';
import { TagModule } from './tag/tag.module';
import { UserModule } from './user/user.module';

@Module({
  controllers: [AppController],
  imports: [
    AdminModule,
    AccessModule,
    AccountModule,
    ApiKeysModule,
    AssetModule,
    AuthDeviceModule,
    AuthModule,
    BenchmarkModule,
    BullModule.forRoot({
      redis: {
        db: parseInt(process.env.REDIS_DB ?? '0', 10),
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD
      }
    }),
    CacheModule,
    ConfigModule.forRoot(),
    ConfigurationModule,
    DataGatheringModule,
    DataProviderModule,
    EventEmitterModule.forRoot(),
    EventsModule,
    ExchangeRateModule,
    ExchangeRateDataModule,
    ExportModule,
    GhostfolioModule,
    HealthModule,
    ImportModule,
    InfoModule,
    LogoModule,
    MarketDataModule,
    OrderModule,
    PlatformModule,
    PortfolioModule,
    PortfolioSnapshotQueueModule,
    PrismaModule,
    PropertyModule,
    PublicModule,
    RedisCacheModule,
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      exclude: ['/api*', '/sitemap.xml'],
      rootPath: join(__dirname, '..', 'client'),
      serveStaticOptions: {
        setHeaders: (res) => {
          if (res.req?.path === '/') {
            let languageCode = DEFAULT_LANGUAGE_CODE;

            try {
              const code = res.req.headers['accept-language']
                .split(',')[0]
                .split('-')[0];

              if (SUPPORTED_LANGUAGE_CODES.includes(code)) {
                languageCode = code;
              }
            } catch {}

            res.set('Location', `/${languageCode}`);
            res.statusCode = StatusCodes.MOVED_PERMANENTLY;
          }
        }
      }
    }),
    SitemapModule,
    SubscriptionModule,
    SymbolModule,
    TagModule,
    TwitterBotModule,
    UserModule
  ],
  providers: [CronService]
})
export class AppModule {}
