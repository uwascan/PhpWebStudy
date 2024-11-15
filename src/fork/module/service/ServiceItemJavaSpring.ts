import type { AppHost } from '@shared/app'
import { ForkPromise } from '@shared/ForkPromise'
import { dirname, join } from 'path'
import { existsSync, mkdirp, readFile, writeFile } from 'fs-extra'
import { execPromiseRoot, execPromiseRootWhenNeed } from '@shared/Exec'
import { getHostItemEnv, ServiceItem } from './ServiceItem'
import { ProcessPidListByPid } from '@shared/Process'

export class ServiceItemJavaSpring extends ServiceItem {
  start(item: AppHost) {
    return new ForkPromise(async (resolve, reject) => {
      if (this.exit) {
        reject(new Error('Exit'))
        return
      }

      if (!item.jdkDir || !existsSync(item.jdkDir)) {
        reject(new Error(`JDK not exists: ${item.jdkDir}`))
        return
      }

      if (!item.jarDir || !existsSync(item.jarDir)) {
        reject(new Error(`JAR File not exists: ${item.jarDir}`))
        return
      }

      this.host = item
      await this.stop()
      const javaDir = join(global.Server.BaseDir!, 'java')
      await mkdirp(javaDir)
      const pid = join(javaDir, `${item.id}.pid`)
      const log = join(javaDir, `${item.id}.log`)
      if (existsSync(pid)) {
        try {
          await execPromiseRoot([`rm`, '-rf', pid])
        } catch (e) {}
      }
      const opt = await getHostItemEnv(item)
      const commands: string[] = ['#!/bin/zsh']
      if (opt && opt?.env) {
        for (const k in opt.env) {
          const v = opt.env[k]
          if (v.includes(' ')) {
            commands.push(`export ${k}="${v}"`)
          } else {
            commands.push(`export ${k}=${v}`)
          }
        }
      }
      commands.push(`export PATH="${dirname(item.jdkDir)}:$PATH"`)
      const startCommand = item?.startCommand?.replace(item.jdkDir, 'java')
      commands.push(`nohup ${startCommand} &>> ${log} &`)
      commands.push(`echo $! > ${pid}`)
      this.command = commands.join('\n')
      console.log('command: ', this.command)
      const sh = join(global.Server.Cache!, `service-${this.id}.sh`)
      await writeFile(sh, this.command)
      await execPromiseRoot([`chmod`, '777', sh])
      try {
        const res = await execPromiseRootWhenNeed(`zsh`, [sh], opt)
        console.log('start res: ', res)
        const pid = await this.checkPid()
        this.daemon()
        resolve({
          'APP-Service-Start-PID': pid
        })
      } catch (e) {
        console.log('start e: ', e)
        reject(e)
      }
    })
  }
  async checkState() {
    const id = this.host?.id
    if (!id) {
      return []
    }
    const baseDir = join(global.Server.BaseDir!, 'java')
    const pidFile = join(baseDir, `${id}.pid`)
    this.pidFile = pidFile
    if (!existsSync(pidFile)) {
      return []
    }
    const pid = (await readFile(pidFile, 'utf-8')).trim()
    return await ProcessPidListByPid(pid)
  }
}