import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TelegrafModule } from 'nestjs-telegraf'
import { BotService } from './bot.service'
import { BotUpdate } from './bot.update'
import { RedisPubSubSubscriber } from './redis-pub-sub.subscriber'
import { UnreadNotificationsService } from './unread-notifications.service'
import { RedisPubSubService } from './redis-pub-sub.service'

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		TelegrafModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => {
				const botToken = configService.get<string>('BOT_TOKEN')
				console.log('Bot Token:', botToken)
				return { token: botToken ?? '' }
			},
		})
	],
	providers: [
		BotService, 
		BotUpdate, 
		RedisPubSubSubscriber, 
		UnreadNotificationsService,
		RedisPubSubService
	],
	exports: [BotService],
})
export class BotModule {}
