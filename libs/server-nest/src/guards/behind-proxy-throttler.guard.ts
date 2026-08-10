import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class BehindProxyThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const tracker = req['ips'].length ? req['ips'][0] : req['ip'] // 提取IP以满足限流需求
      resolve(tracker)
    })
  }
}
