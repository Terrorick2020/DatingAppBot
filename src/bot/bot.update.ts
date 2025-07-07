import { Command, Ctx, Update } from 'nestjs-telegraf'
import { Context } from 'telegraf'
import { BotService } from './bot.service'
import { UnreadNotificationsService } from './unread-notifications.service'

@Update()
export class BotUpdate {
	constructor(
		private readonly botService: BotService,
		private readonly unreadNotificationsService: UnreadNotificationsService
	) {}

	@Command('start')
	async onStart(@Ctx() ctx: Context) {
		await this.botService.start(ctx)
	}

	@Command('send_notifications')
	async onSendNotifications(@Ctx() ctx: Context) {
		try {
			await ctx.reply(
				'🚀 Запуск отправки уведомлений о непрочитанных сообщениях...'
			)
			await this.unreadNotificationsService.sendManualNotification()
			await ctx.reply('✅ Уведомления отправлены!')
		} catch (error: any) {
			console.error('Ошибка при ручной отправке уведомлений:', error)
			await ctx.reply('❌ Ошибка при отправке уведомлений')
		}
	}
}
