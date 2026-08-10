import { Controller, Get } from '@nestjs/common'

import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  live() {
    return this.appService.live()
  }

  @Get('health/live')
  healthLive() {
    return this.appService.live()
  }

  @Get('health/ready')
  healthReady() {
    return this.appService.ready()
  }
}
