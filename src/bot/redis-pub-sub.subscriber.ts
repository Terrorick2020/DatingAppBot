import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'
import { ConfigService } from '@nestjs/config'
import { AppLogger } from '../logger/logger.service'
import { BotService } from './bot.service'

@Injectable()
export class RedisPubSubSubscriber implements OnModuleInit, OnModuleDestroy {
	private subscriber: Redis
	private readonly channels = ['bot:notify']
	private readonly CONTEXT = 'RedisPubSubSubscriber'

	constructor(
		private readonly logger: AppLogger,
		private readonly configService: ConfigService,
		private readonly botService: BotService
	) {
		this.subscriber = new Redis({
			host: this.configService.get('REDIS_HOST', 'localhost'),
			port: parseInt(this.configService.get('REDIS_PORT', '6379')),
			password: this.configService.get('REDIS_PASSWORD', ''),
			db: parseInt(this.configService.get('REDIS_DB', '0')),
		})
	}

	async onModuleInit() {
		// Подписываемся на каналы
		await this.subscriber.subscribe(...this.channels)

		// Обработчик сообщений
		this.subscriber.on('message', (channel, message) => {
			try {
				const data = JSON.parse(message)
				this.logger.debug(
					`Получено сообщение в канале ${channel}`,
					this.CONTEXT
				)
				this.handleMessage(channel, data)
			} catch (error: any) {
				this.logger.error(
					`Ошибка при обработке сообщения из Redis: ${error.message}`,
					error.stack,
					this.CONTEXT
				)
			}
		})

		this.logger.log('Redis Pub/Sub подписчик инициализирован', this.CONTEXT)
	}

	async onModuleDestroy() {
		await this.subscriber.unsubscribe(...this.channels)
		await this.subscriber.quit()
		this.logger.log('Redis Pub/Sub подписчик остановлен', this.CONTEXT)
	}

	private handleMessage(channel: string, data: any) {
		switch (channel) {
			case 'bot:notify':
				this.handleBotNotify(data)
				break
			default:
				this.logger.warn(`Неизвестный канал: ${channel}`, this.CONTEXT)
		}
	}

	private async handleBotNotify(data: any) {
		const { telegramId, text } = data

		if (!telegramId || !text) {
			this.logger.warn(
				'bot:notify — отсутствуют telegramId или text',
				this.CONTEXT,
				data
			)
			return
		}

		try {
			await this.botService.notifyUser(telegramId, text)
			this.logger.debug(
				`Сообщение отправлено в Telegram для ${telegramId}`,
				this.CONTEXT
			)
		} catch (error: any) {
			this.logger.error(
				`Ошибка при отправке в Telegram: ${error.message}`,
				error.stack,
				this.CONTEXT
			)
		}
	}
}
