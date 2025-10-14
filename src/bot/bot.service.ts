import { Injectable } from '@nestjs/common'
import { InjectBot } from 'nestjs-telegraf'
import { Telegraf } from 'telegraf'
import { Context } from 'telegraf/typings/context'
import { faqData, previewText } from '../constant/content'

@Injectable()
export class BotService {
	constructor(@InjectBot() private readonly bot: Telegraf<Context>) {}

	async start(ctx: Context) {
		const inlineKeyboard = {
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: '👉 Начать общение',
							web_app: {
								url: process.env.CLIENT_URL ?? '',
							},
						},
					],
					[
						{
							text: '❓ Поддержка',
							callback_data: 'support',
						},
					],
				],
			},
		}

		await ctx.reply(previewText, inlineKeyboard)
	}

	async showSupportMenu(ctx: Context) {
		const questions = faqData.map((item, index) => ({
			text: `${index + 1}. ${item.question}`,
			callback_data: `faq_${item.id}`,
		}))

		// Разбиваем вопросы на группы по 2 для лучшего отображения
		const keyboard = []
		for (let i = 0; i < questions.length; i += 2) {
			const row = questions.slice(i, i + 2)
			keyboard.push(row)
		}

		// Добавляем кнопку "Задать свой вопрос" и "Назад"
		keyboard.push([
			{
				text: '✍️ Задать свой вопрос',
				callback_data: 'support_ask',
			},
			{
				text: '⬅️ Назад',
				callback_data: 'back_to_main',
			},
		])

		await ctx.editMessageText(
			'❓ Часто задаваемые вопросы\n\nВыберите интересующий вас вопрос:',
			{
				reply_markup: {
					inline_keyboard: keyboard,
				},
			}
		)
	}

	async showFaqAnswer(ctx: Context, faqId: string) {
		const faq = faqData.find(item => item.id === faqId)
		
		if (!faq) {
			await ctx.answerCbQuery('❌ Вопрос не найден')
			return
		}

		const keyboard = {
			inline_keyboard: [
				[
					{
						text: '⬅️ К списку вопросов',
						callback_data: 'support',
					},
				],
				[
					{
						text: '🏠 В главное меню',
						callback_data: 'back_to_main',
					},
				],
			],
		}

		await ctx.editMessageText(
			`❓ ${faq.question}\n\n💬 ${faq.answer}`,
			{
				reply_markup: keyboard,
			}
		)
	}

	async backToMain(ctx: Context) {
		const inlineKeyboard = {
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: '👉 Начать общение',
							web_app: {
								url: process.env.CLIENT_URL ?? '',
							},
						},
					],
					[
						{
							text: '❓ Поддержка',
							callback_data: 'support',
						},
					],
				],
			},
		}

		await ctx.editMessageText(previewText, inlineKeyboard)
	}

	async notifyUser(telegramId: number | string, text: string) {
		try {
			await this.bot.telegram.sendMessage(telegramId, text)
		} catch (error) {
			console.error(
				`Ошибка при отправке уведомления пользователю ${telegramId}:`,
				error
			)
		}
	}

	async handlePsychologistRegistration(ctx: Context, code: string) {
		try {
			const telegramId = ctx.from?.id?.toString()
			if (!telegramId) {
				await ctx.reply('❌ Ошибка: не удалось получить ID пользователя')
				return
			}

			// Проверяем валидность кода
			const apiUrl = process.env.API_URL || ''
			if (!apiUrl) {
				await ctx.reply('❌ API недоступен. Попробуйте позже.')
				return
			}

			// Проверяем код приглашения
			const validateResponse = await fetch(`${apiUrl}/psychologists/validate-invite-code`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code }),
			})

			const validateResult = await validateResponse.json()
			
			if (!validateResult.success || !validateResult.data.isValid) {
				await ctx.reply(
					`❌ Код приглашения недействителен: ${validateResult.data.message || 'Неизвестная ошибка'}`
				)
				return
			}

			// Показываем форму регистрации
			await ctx.reply(
				`🎉 Добро пожаловать! Код приглашения действителен.\n\n` +
				`Для завершения регистрации как психолог, пожалуйста, заполните форму:\n\n` +
				`📝 Отправьте ваше имя и описание в следующем формате:\n` +
				`Имя: [Ваше имя]\n` +
				`Описание: [Краткое описание о себе и вашем опыте]`
			)

			// Устанавливаем флаг ожидания данных психолога
			;(ctx as any).session = (ctx as any).session || {}
			;(ctx as any).session.waitingPsychologistData = true
			;(ctx as any).session.inviteCode = code

		} catch (error) {
			console.error('Ошибка при обработке регистрации психолога:', error)
			await ctx.reply('❌ Произошла ошибка. Попробуйте позже.')
		}
	}
}
