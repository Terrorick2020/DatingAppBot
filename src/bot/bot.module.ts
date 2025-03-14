import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TelegrafModule } from 'nestjs-telegraf'
import { BotService } from './bot.service'
import { BotUpdate } from './bot.update'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
          }),
        TelegrafModule.forRoot({
            token: process.env.BOT_TOKEN ?? '',
        }),
    ],
    providers: [BotService, BotUpdate],
})
export class BotModule {}
