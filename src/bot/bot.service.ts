import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { Context } from 'telegraf/typings/context';

@Injectable()
export class BotService {
  constructor(@InjectBot() private readonly bot: Telegraf<Context>) {}

  async start(ctx: Context) {

    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'К знакомствам',
              web_app: {
                url: process.env.CLIENT_URL ?? '',
              },
            },
          ],
        ],
      },
    };

    await ctx.reply('Welcome, go to the  our app', inlineKeyboard)

  }
}