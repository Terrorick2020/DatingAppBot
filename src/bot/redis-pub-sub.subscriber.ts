import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'
import { ConfigService } from '@nestjs/config'
import { BotService } from './bot.service'

@Injectable()
export class RedisPubSubSubscriber implements OnModuleInit, OnModuleDestroy {
	private subscriber: Redis
	private readonly channels = ['bot:notify']
	private readonly CONTEXT = 'RedisPubSubSubscriber'

	constructor(
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
				console.debug(
					`Получено сообщение в канале ${channel}`,
					this.CONTEXT
				)
				this.handleMessage(channel, data)
			} catch (error: any) {
				console.log(
					`Ошибка при обработке сообщения из Redis: ${error.message}`,
					error.stack,
					this.CONTEXT
				)
			}
		})

	}

	async onModuleDestroy() {
		await this.subscriber.unsubscribe(...this.channels)
		await this.subscriber.quit()
	}

	private handleMessage(channel: string, data: any) {
		switch (channel) {
			case 'bot:notify':
				this.handleBotNotify(data)
				break
			default:
				console.warn(`Неизвестный канал: ${channel}`, this.CONTEXT)
		}
	}

	private async handleBotNotify(data: any) {
		const { telegramId, text } = data

		if (!telegramId || !text) {
			console.warn(
				'bot:notify — отсутствуют telegramId или text',
				this.CONTEXT,
				data
			)
			return
		}

		try {
			await this.botService.notifyUser(telegramId, text)
			console.log(
				`Сообщение отправлено в Telegram для ${telegramId}`,
				this.CONTEXT
			)
		} catch (error: any) {
			console.log(
				`Ошибка при отправке в Telegram: ${error.message}`,
				error.stack,
				this.CONTEXT
			)
		}
	}
}
