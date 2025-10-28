import { Action, Command, Ctx, On, Update } from 'nestjs-telegraf'
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
		// Проверяем, есть ли параметр в команде start
		const messageText = (ctx.message as any)?.text || ''
		const startParam = messageText.split(' ')[1]
		
		console.log('🔍 Bot: Получена команда /start с параметром:', startParam)
		
		if (startParam?.startsWith('psychologist_')) {
			// Обработка регистрации психолога
			const code = startParam.replace('psychologist_', '')
			console.log('🔍 Bot: Обработка регистрации психолога с кодом:', code)
			await this.botService.handlePsychologistRegistration(ctx, code)
		} else if (startParam?.startsWith('ref_')) {
			// Обработка реферальной ссылки
			const encodedParams = startParam.replace('ref_', '')
			console.log('🔍 Bot: Обработка реферальной ссылки:', encodedParams)
			await this.botService.handleReferralLink(ctx, encodedParams)
		} else if (startParam) {
			// Обработка startapp параметра (для Web App)
			console.log('🔍 Bot: Обработка startapp параметра:', startParam)
			await this.botService.handleStartAppParam(ctx, startParam)
		} else {
			// Обычная регистрация пользователя
			console.log('🔍 Bot: Обычная регистрация пользователя')
			await this.botService.start(ctx)
		}
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
			;(ctx as any).session = (ctx as any).session || {}
			;(ctx as any).session.waitingSupportText = true
		} catch (error) {
			console.error('Ошибка при переходе к вопросу поддержки:', error)
			await ctx.answerCbQuery('❌ Произошла ошибка')
		}
	}

	@Command('cancel')
	async onCancel(@Ctx() ctx: any) {
		;(ctx as any).session = (ctx as any).session || {}
		;(ctx as any).session.waitingSupportText = false
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

	@Action('psychologist_form')
	async onPsychologistForm(@Ctx() ctx: Context) {
		try {
			await ctx.answerCbQuery()
			await ctx.reply(
				`📝 Заполните форму регистрации психолога:\n\n` +
				`Отправьте ваше имя и описание в следующем формате:\n` +
				`Имя: [Ваше имя]\n` +
				`Описание: [Краткое описание о себе и вашем опыте]`
			)
		} catch (error) {
			console.error('Ошибка при показе формы психолога:', error)
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
			if ((ctx as any)?.session?.waitingSupportText && (ctx.message as any)?.text) {
				const text = (ctx.message as any).text
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
				;(ctx as any).session.waitingSupportText = false
				await ctx.reply('✅ Ваше сообщение передано в техподдержку. Мы ответим в ближайшее время.')
			}
		} catch (error) {
			console.error('Ошибка при отправке вопроса в саппорт:', error)
			await ctx.reply('❌ Не удалось отправить сообщение. Попробуйте позже.')
		}
	}

	// Захват текста для регистрации психолога
	@On('text')
	async onText(@Ctx() ctx: any) {
		try {
			// Обработка регистрации психолога
			if ((ctx as any)?.session?.waitingPsychologistData && (ctx.message as any)?.text) {
				const text = (ctx.message as any).text
				const telegramId = ctx.from?.id?.toString()
				const apiUrl = process.env.API_URL || ''
				
				if (!apiUrl) {
					await ctx.reply('❌ API недоступен. Попробуйте позже.')
					return
				}

				// Парсим данные из текста
				const nameMatch = text.match(/Имя:\s*(.+)/i)
				const descriptionMatch = text.match(/Описание:\s*(.+)/i)

				if (!nameMatch || !descriptionMatch) {
					await ctx.reply(
						'❌ Неверный формат. Пожалуйста, используйте формат:\n' +
						'Имя: [Ваше имя]\n' +
						'Описание: [Краткое описание о себе и вашем опыте]'
					)
					return
				}

				const name = nameMatch[1].trim()
				const about = descriptionMatch[1].trim()

				// Отправляем запрос на регистрацию
				const response = await fetch(`${apiUrl}/psychologists/register-by-invite`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						code: (ctx as any).session.inviteCode,
						telegramId,
						name,
						about,
					}),
				})

				const result = await response.json()

				if (result.success) {
					;(ctx as any).session.waitingPsychologistData = false
					;(ctx as any).session.inviteCode = null
					await ctx.reply(
						'🎉 Поздравляем! Вы успешно зарегистрированы как психолог.\n\n' +
						'Теперь вы можете:\n' +
						'• Получать уведомления о новых обращениях\n' +
						'• Отвечать на вопросы пользователей\n' +
						'• Управлять своим профилем\n\n' +
						'Добро пожаловать в команду! 🚀'
					)
				} else {
					await ctx.reply(`❌ Ошибка регистрации: ${result.message || 'Неизвестная ошибка'}`)
				}
				return
			}

			// Обработка обращения в поддержку (существующий код)
			if ((ctx as any)?.session?.waitingSupportText && (ctx.message as any)?.text) {
				const text = (ctx.message as any).text
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
				;(ctx as any).session.waitingSupportText = false
				await ctx.reply('✅ Ваше сообщение передано в техподдержку. Мы ответим в ближайшее время.')
			}
		} catch (error) {
			console.error('Ошибка при обработке текста:', error)
			await ctx.reply('❌ Произошла ошибка. Попробуйте позже.')
		}
	}
}
