import { Action, Command, Ctx, Update } from 'nestjs-telegraf'
import fetch from 'node-fetch'
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

	@Action('support_ask')
	async onSupportAsk(@Ctx() ctx: any) {
		try {
			await ctx.answerCbQuery()
			await ctx.reply('✍️ Опишите вашу проблему одним сообщением. Я передам её в техподдержку.')
			ctx.session = ctx.session || {}
			ctx.session.waitingSupportText = true
		} catch (error) {
			console.error('Ошибка при переходе к вопросу поддержки:', error)
			await ctx.answerCbQuery('❌ Произошла ошибка')
		}
	}

	@Command('cancel')
	async onCancel(@Ctx() ctx: any) {
		ctx.session = ctx.session || {}
		ctx.session.waitingSupportText = false
		await ctx.reply('Отменено.')
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

	// Захват текста для отправки обращения в поддержку (создаст жалобу SUPPORT)
	@Action('text')
	async onAnyText(@Ctx() ctx: any) {
		try {
			if (ctx?.session?.waitingSupportText && ctx.message?.text) {
				const text = ctx.message.text
				const telegramId = ctx.from?.id?.toString()
				const apiUrl = process.env.API_URL || ''
				if (!apiUrl) {
					await ctx.reply('❌ API недоступен. Попробуйте позже.')
					return
				}
				await fetch(`${apiUrl}/complaints`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						fromUserId: telegramId,
						type: 'support, question',
						description: text,
					}),
				})
				ctx.session.waitingSupportText = false
				await ctx.reply('✅ Ваше сообщение передано в техподдержку. Мы ответим в ближайшее время.')
			}
		} catch (error) {
			console.error('Ошибка при отправке вопроса в саппорт:', error)
			await ctx.reply('❌ Не удалось отправить сообщение. Попробуйте позже.')
		}
	}
}
