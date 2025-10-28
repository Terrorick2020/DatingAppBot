import { Injectable } from '@nestjs/common'
import { InjectBot } from 'nestjs-telegraf'
import { Telegraf } from 'telegraf'
import { Context } from 'telegraf/typings/context'
import { faqData, previewText } from '../constant/content'

// Функция для base64 кодирования в Node.js
function btoa(str: string): string {
	return Buffer.from(str, 'utf8').toString('base64')
}

function atob(str: string): string {
	return Buffer.from(str, 'base64').toString('utf8')
}

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

			// Кодируем параметры для клиента
			const encodedCode = btoa(code)
			const encodedType = btoa('Psychologist')
			const paramsString = `code=${encodeURIComponent(encodedCode)}&type=${encodeURIComponent(encodedType)}`
			const finalEncoded = btoa(paramsString)

			// Показываем форму регистрации с кнопкой для открытия мини-приложения
			const inlineKeyboard = {
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: '📝 Заполнить форму регистрации',
								web_app: {
									url: `${process.env.CLIENT_URL}?startapp=${finalEncoded}`,
								},
							},
						],
						[
							{
								text: '💬 Заполнить в чате',
								callback_data: 'psychologist_form',
							},
						],
					],
				},
			}

			await ctx.reply(
				`🎉 Добро пожаловать! Код приглашения действителен.\n\n` +
				`Для завершения регистрации как психолог выберите способ:\n\n` +
				`📱 Откройте мини-приложение для удобной регистрации\n` +
				`💬 Или заполните форму прямо в чате`,
				inlineKeyboard
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

	async handleReferralLink(ctx: Context, encodedParams: string) {
		try {
			const clientUrl = process.env.CLIENT_URL || ''
			if (!clientUrl) {
				await ctx.reply('❌ Мини-приложение недоступно. Попробуйте позже.')
				return
			}

			// Декодируем параметры и проверяем их
			try {
				const decodedString = atob(decodeURIComponent(encodedParams))
				const searchParams = new URLSearchParams(decodedString)
				
				const encodedCode = searchParams.get('code')
				const encodedType = searchParams.get('type')
				
				if (!encodedCode || !encodedType) {
					await ctx.reply('❌ Неверная реферальная ссылка.')
					return
				}

				// Проверяем, что это реферальная ссылка пользователя
				const typeValue = atob(decodeURIComponent(encodedType))
				if (typeValue !== 'User') {
					await ctx.reply('❌ Неверная реферальная ссылка.')
					return
				}

				// Формируем URL с реферальными параметрами
				const referralUrl = `${clientUrl}?startapp=${encodedParams}`

				const inlineKeyboard = {
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: '🚀 Начать знакомства',
									web_app: {
										url: referralUrl,
									},
								},
							],
						],
					},
				}

				await ctx.reply(
					`👋 Добро пожаловать в 3date!\n\n` +
					`Вы перешли по реферальной ссылке. Нажмите кнопку ниже, чтобы открыть приложение и начать знакомства!`,
					inlineKeyboard
				)

			} catch (decodeError) {
				console.error('Ошибка при декодировании реферальной ссылки:', decodeError)
				await ctx.reply('❌ Неверная реферальная ссылка.')
			}

		} catch (error) {
			console.error('Ошибка при обработке реферальной ссылки:', error)
			await ctx.reply('❌ Произошла ошибка. Попробуйте позже.')
		}
	}

	async handleStartAppParam(ctx: Context, startParam: string) {
		try {
			const clientUrl = process.env.CLIENT_URL || ''
			if (!clientUrl) {
				await ctx.reply('❌ Мини-приложение недоступно. Попробуйте позже.')
				return
			}

			console.log('🔍 Bot: Обработка start параметра:', startParam)

			// Декодируем параметры и проверяем их
			try {
				const decodedString = atob(decodeURIComponent(startParam))
				const searchParams = new URLSearchParams(decodedString)
				
				console.log('🔍 Bot: Декодированная строка:', decodedString)
				console.log('🔍 Bot: Параметры поиска:', Object.fromEntries(searchParams))
				
				const encodedCode = searchParams.get('code')
				const encodedType = searchParams.get('type')
				
				console.log('🔍 Bot: encodedCode:', encodedCode)
				console.log('🔍 Bot: encodedType:', encodedType)
				
				if (!encodedCode || !encodedType) {
					console.log('🔍 Bot: Отсутствуют обязательные параметры')
					await ctx.reply('❌ Неверная ссылка приложения.')
					return
				}

				const typeValue = atob(decodeURIComponent(encodedType))
				const codeValue = atob(decodeURIComponent(encodedCode))
				
				console.log('🔍 Bot: Декодированный тип:', typeValue)
				console.log('🔍 Bot: Декодированный код:', codeValue)

				// Формируем URL с параметрами
				const appUrl = `${clientUrl}?startapp=${startParam}`

				let message = ''
				let buttonText = ''

				if (typeValue === 'Psych') {
					message = `👨‍⚕️ Добро пожаловать!\n\n` +
						`Вы перешли по ссылке для регистрации психолога. Нажмите кнопку ниже, чтобы открыть приложение и зарегистрироваться как специалист!`
					buttonText = '👨‍⚕️ Регистрация психолога'
				} else if (typeValue === 'User') {
					message = `👋 Добро пожаловать в 3date!\n\n` +
						`Вы перешли по реферальной ссылке. Нажмите кнопку ниже, чтобы открыть приложение и начать знакомства!`
					buttonText = '🚀 Начать знакомства'
				} else {
					await ctx.reply('❌ Неверный тип ссылки.')
					return
				}

				const inlineKeyboard = {
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: buttonText,
									web_app: {
										url: appUrl,
									},
								},
							],
						],
					},
				}

				await ctx.reply(message, inlineKeyboard)

			} catch (decodeError) {
				console.error('🔍 Bot: Ошибка при декодировании start параметра:', decodeError)
				await ctx.reply('❌ Неверная ссылка приложения.')
			}

		} catch (error) {
			console.error('🔍 Bot: Ошибка при обработке start параметра:', error)
			await ctx.reply('❌ Произошла ошибка. Попробуйте позже.')
		}
	}
}
