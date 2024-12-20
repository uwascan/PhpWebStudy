import IPC from '@/util/IPC'
import { BrewStore, type SoftInstalled } from '@/store/brew'
import { type AppHost, AppStore } from '@/store/app'
import { TaskStore } from '@/store/task'
import { I18nT } from '@shared/lang'
import { Service } from '@/components/ServiceManager/service'
import installedVersions from '@/util/InstalledVersions'
import type { AllAppModule } from '@/core/type'

const exec = (
  typeFlag: AllAppModule,
  version: SoftInstalled,
  fn: string
): Promise<string | boolean> => {
  return new Promise((resolve) => {
    if (version.running) {
      resolve(true)
      return
    }
    if (!version?.version) {
      resolve(I18nT('util.versionNoFound'))
      return
    }
    version.running = true
    const args = JSON.parse(JSON.stringify(version))
    const appStore = AppStore()
    const taskStore = TaskStore()
    const brewStore = BrewStore()
    const task = taskStore.module(typeFlag)
    task?.log?.splice(0)
    IPC.send(`app-fork:${typeFlag}`, fn, args).then((key: string, res: any) => {
      if (res.code === 0) {
        IPC.off(key)
        version.run = fn !== 'stopService'
        version.running = false
        if (typeFlag === 'php' && fn === 'startService') {
          const hosts = appStore.hosts
          if (hosts && hosts?.[0] && !hosts?.[0]?.phpVersion) {
            appStore.initHost().then()
          }
        }
        const pid = res?.data?.['APP-Service-Start-PID'] ?? ''
        if (pid) {
          brewStore.module(typeFlag).installed.forEach((i) => {
            i.pid = pid
          })
        } else {
          brewStore.module(typeFlag).installed.forEach((i) => {
            delete i?.pid
          })
        }
        resolve(true)
      } else if (res.code === 1) {
        IPC.off(key)
        task?.log?.push(res.msg)
        version.running = false
        resolve(task?.log?.join('\n') ?? '')
      } else if (res.code === 200) {
        task?.log?.push(res.msg)
      }
    })
  })
}

export const stopService = (typeFlag: AllAppModule, version: SoftInstalled) => {
  return exec(typeFlag, version, 'stopService')
}

export const startService = (typeFlag: AllAppModule, version: SoftInstalled) => {
  return exec(typeFlag, version, 'startService')
}

export const reloadService = (typeFlag: AllAppModule, version: SoftInstalled) => {
  return exec(typeFlag, version, 'reloadService')
}

export const reloadWebServer = (hosts?: Array<AppHost>) => {
  const brewStore = BrewStore()
  let useSeted = false

  const apacheRunning = brewStore.module('apache').installed.find((a) => a.run)
  const apacheTaskRunning = brewStore.module('apache').installed.some((a) => a.running)
  if (apacheRunning && !apacheTaskRunning) {
    startService('apache', apacheRunning).then()
    useSeted = true
  }

  const nginxRunning = brewStore.module('nginx').installed.find((a) => a.run)
  const nginxTaskRunning = brewStore.module('nginx').installed.some((a) => a.running)
  if (nginxRunning && !nginxTaskRunning) {
    startService('nginx', nginxRunning).then()
    useSeted = true
  }

  const caddyRunning = brewStore.module('caddy').installed.find((a) => a.run)
  const caddyTaskRunning = brewStore.module('caddy').installed.some((a) => a.running)
  if (caddyRunning && !caddyTaskRunning) {
    startService('caddy', caddyRunning).then()
    useSeted = true
  }

  const tomcatRunning = brewStore.module('tomcat').installed.find((a) => a.run)
  const tomcatTaskRunning = brewStore.module('tomcat').installed.some((a) => a.running)
  if (tomcatRunning && !tomcatTaskRunning) {
    startService('tomcat', tomcatRunning).then()
    useSeted = true
  }

  if (useSeted || !hosts || hosts?.length > 1) {
    return
  }

  if (hosts && hosts?.length === 1) {
    const appStore = AppStore()

    const currentApacheGet = () => {
      const current = appStore.config.server?.apache?.current
      const installed = brewStore.module('apache').installed
      if (!current) {
        return installed?.find((i) => !!i.path && !!i.version)
      }
      return installed?.find((i) => i.path === current?.path && i.version === current?.version)
    }

    const currentNginxGet = () => {
      const current = appStore.config.server?.nginx?.current
      const installed = brewStore.module('nginx').installed
      if (!current) {
        return installed?.find((i) => !!i.path && !!i.version)
      }
      return installed?.find((i) => i.path === current?.path && i.version === current?.version)
    }

    const currentCaddyGet = () => {
      const current = appStore.config.server?.caddy?.current
      const installed = brewStore.module('caddy').installed
      if (!current) {
        return installed?.find((i) => !!i.path && !!i.version)
      }
      return installed?.find((i) => i.path === current?.path && i.version === current?.version)
    }
    const caddy = currentCaddyGet()
    const nginx = currentNginxGet()
    const apache = currentApacheGet()
    if (caddy) {
      startService('caddy', caddy).then()
    } else if (nginx) {
      startService('nginx', nginx).then()
    } else if (apache) {
      startService('apache', apache).then()
    }

    const host = [...hosts].pop()
    if (host?.phpVersion) {
      const phpVersions = brewStore.module('php').installed
      const php = phpVersions?.find((p) => p.num === host.phpVersion)
      if (php) {
        startService('php', php).then()
      }
    }
  }
}

export const reGetInstalled = (type: AllAppModule) => {
  return new Promise((resolve) => {
    const service = Service[type]
    if (service?.fetching) {
      resolve(true)
      return
    }
    service.fetching = true
    const brewStore = BrewStore()
    const data = brewStore.module(type)
    data!.installedInited = false
    installedVersions.allInstalledVersions([type]).then(() => {
      service.fetching = false
      resolve(true)
    })
  })
}
