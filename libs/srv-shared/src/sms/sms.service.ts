import type { SmsConfig } from '@libs/server-kernel'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import Client, * as $Dysmsapi from '@alicloud/dysmsapi20170525'
import * as OpenApi from '@alicloud/openapi-client'

@Injectable()
export class SmsService {
  client: Client
  signName: string

  constructor(configService: ConfigService) {
    const { accessKeyId, accessKeySecret, signName } = configService.get<SmsConfig>('sms') as SmsConfig
    const config = new OpenApi.Config({
      accessKeyId,
      accessKeySecret
    })
    // Endpoint 请参考 https://api.aliyun.com/product/Dysmsapi
    config.endpoint = `dysmsapi.aliyuncs.com`
    this.client = new Client(config as any)
    this.signName = signName
  }

  // templateParam本质上object，通过一个JSON.stringify后得到类似于`{"code":"1111"}`，然后code去铁环templateCode中的变量的值
  // templateCode是短信模板的ID，可以由业务测自行定义常量，然后从环境变量中读取，封装一个专门的发送服务
  async send(phoneNumbers: string, templateCode: string, templateParam: string) {
    const request = new $Dysmsapi.SendSmsRequest({})
    request.phoneNumbers = phoneNumbers
    request.signName = this.signName
    request.templateCode = templateCode
    request.templateParam = templateParam
    return this.client.sendSms(request)
  }
}
