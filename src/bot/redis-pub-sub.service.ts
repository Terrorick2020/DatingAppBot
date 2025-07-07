import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
	private publisher: Redis
	private readonly CONTEXT = 'RedisPubSubService'

	constructor(private readonly configService: ConfigService) {
		this.publisher = new Redis({
			host: this.configService.get('REDIS_HOST', 'localhost'),
			port: parseInt(this.configService.get('REDIS_PORT', '6379')),
			password: this.configService.get('REDIS_PASSWORD', ''),
			db: parseInt(this.configService.get('REDIS_DB', '0')),
		})
	}

	async onModuleInit() {
		console.log('Redis Pub/Sub сервис инициализирован', this.CONTEXT)
	}

	async onModuleDestroy() {
		await this.publisher.quit()
		console.log('Redis Pub/Sub соединение закрыто', this.CONTEXT)
	}

	/**
	 * Публикация события в канал Redis
	 */
	async publish(channel: string, message: any): Promise<void> {
		try {
			// Проверка типа сообщения и преобразование в JSON если нужно
			const messageString =
				typeof message === 'string' ? message : JSON.stringify(message)

			await this.publisher.publish(channel, messageString)
			console.debug(`Событие опубликовано в канал ${channel}`, this.CONTEXT, {
				messageType: typeof message,
			})
		} catch (error: any) {
			console.error(
				`Ошибка при публикации события в канал ${channel}`,
				error?.stack,
				this.CONTEXT,
				{ error, channel }
			)
		}
	}

	/**
	 * Публикация уведомления для бота
	 */
	async publishBotNotify(data: {
		telegramId: string
		text: string
	}): Promise<void> {
		await this.publish('bot:notify', data)
	}
}
