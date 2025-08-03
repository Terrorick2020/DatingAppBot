import { Command, Ctx, Update, Action } from 'nestjs-telegraf'
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

	@Action('support')
	async onSupport(@Ctx() ctx: Context) {
		try {
			await this.botService.showSupportMenu(ctx)
		} catch (error) {
			console.error('Ошибка при показе меню поддержки:', error)
			await ctx.answerCbQuery('❌ Произошла ошибка')
		}
	}

	@Action('back_to_main')
	async onBackToMain(@Ctx() ctx: Context) {
		try {
			await this.botService.backToMain(ctx)
		} catch (error) {
			console.error('Ошибка при возврате в главное меню:', error)
			await ctx.answerCbQuery('❌ Произошла ошибка')
		}
	}

	@Action(/^faq_(.+)$/)
	async onFaqQuestion(@Ctx() ctx: Context) {
		try {
			const match = (ctx as any).match
			if (match && match[1]) {
				const faqId = match[1]
				await this.botService.showFaqAnswer(ctx, faqId)
			}
		} catch (error) {
			console.error('Ошибка при показе ответа FAQ:', error)
			await ctx.answerCbQuery('❌ Произошла ошибка')
		}
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
