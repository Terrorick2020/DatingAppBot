import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as cron from 'node-cron'
import { BotService } from './bot.service'
import { RedisPubSubService } from './redis-pub-sub.service'

@Injectable()
export class UnreadNotificationsService
	implements OnModuleInit, OnModuleDestroy
{
	private readonly CONTEXT = 'UnreadNotificationsService'
	private notificationTask: cron.ScheduledTask | null = null

	constructor(
		private readonly configService: ConfigService,
		private readonly botService: BotService,
		private readonly redisPubSubService: RedisPubSubService
	) {}

	async onModuleInit() {
		// Запускаем задачу каждые 3 часа (в 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
		this.notificationTask = cron.schedule('0 */3 * * *', async () => {
			try {
				await this.sendUnreadNotifications()
			} catch (error: any) {
				console.error(
					'Ошибка при отправке уведомлений о непрочитанных сообщениях:',
					error?.stack || error
				)
			}
		})

		console.log(
			'Задача отправки уведомлений о непрочитанных сообщениях инициализирована',
			this.CONTEXT
		)
	}

	onModuleDestroy() {
		if (this.notificationTask) {
			this.notificationTask.stop()
			console.log(
				'Задача отправки уведомлений о непрочитанных сообщениях остановлена',
				this.CONTEXT
			)
		}
	}

	/**
	 * Отправка уведомлений о непрочитанных сообщениях
	 */
	async sendUnreadNotifications(): Promise<void> {
		try {
			console.log(
				'Начинаем отправку уведомлений о непрочитанных сообщениях',
				this.CONTEXT
			)

			// Получаем API URL из конфигурации
			const apiUrl = this.configService.get<string>('API_URL')
			if (!apiUrl) {
				console.error('API_URL не настроен в конфигурации', this.CONTEXT)
				return
			}

			// Выполняем запрос к API для получения пользователей с непрочитанными сообщениями
			const response = await fetch(`${apiUrl}/chats/users-with-unread`)

			if (!response.ok) {
				console.error(
					`Ошибка при получении пользователей с непрочитанными сообщениями: ${response.status} ${response.statusText}`,
					this.CONTEXT
				)
				return
			}

			const result = await response.json()

			if (!result.success || !result.data) {
				console.error('Неверный формат ответа от API', this.CONTEXT, { result })
				return
			}

			const usersWithUnread: { telegramId: string; unreadCount: number }[] =
				result.data

			console.log(
				`Найдено ${usersWithUnread.length} пользователей с непрочитанными сообщениями`,
				this.CONTEXT
			)

			// Отправляем уведомления каждому пользователю
			for (const user of usersWithUnread) {
				try {
					const message = this.formatUnreadMessage(user.unreadCount)

					// Отправляем уведомление через Redis Pub/Sub
					await this.redisPubSubService.publishBotNotify({
						telegramId: user.telegramId,
						text: message,
					})

					console.log(
						`Уведомление отправлено пользователю ${user.telegramId} (${user.unreadCount} непрочитанных)`,
						this.CONTEXT
					)

					// Небольшая задержка между отправками, чтобы не перегружать систему
					await new Promise(resolve => setTimeout(resolve, 100))
				} catch (error: any) {
					console.error(
						`Ошибка при отправке уведомления пользователю ${user.telegramId}:`,
						error?.stack || error,
						this.CONTEXT
					)
				}
			}

			console.log(
				`Завершена отправка уведомлений о непрочитанных сообщениях. Обработано пользователей: ${usersWithUnread.length}`,
				this.CONTEXT
			)
		} catch (error: any) {
			console.error(
				'Ошибка при отправке уведомлений о непрочитанных сообщениях:',
				error?.stack || error,
				this.CONTEXT
			)
		}
	}

	/**
	 * Форматирование сообщения о непрочитанных сообщениях
	 */
	private formatUnreadMessage(unreadCount: number): string {
		if (unreadCount === 1) {
			return '💬 У вас есть 1 непрочитанное сообщение! Загляните в чаты, чтобы не пропустить важное.'
		} else if (unreadCount >= 2 && unreadCount <= 4) {
			return `💬 У вас есть ${unreadCount} непрочитанных сообщения! Загляните в чаты, чтобы не пропустить важное.`
		} else {
			return `💬 У вас есть ${unreadCount} непрочитанных сообщений! Загляните в чаты, чтобы не пропустить важное.`
		}
	}

	/**
	 * Ручная отправка уведомлений (для тестирования)
	 */
	async sendManualNotification(): Promise<void> {
		console.log('Запуск ручной отправки уведомлений', this.CONTEXT)
		await this.sendUnreadNotifications()
	}
}
