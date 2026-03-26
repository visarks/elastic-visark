import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { ref } from 'vue'

export interface UpdateInfo {
  available: boolean
  version?: string
  date?: string
  body?: string
}

export const updateAvailable = ref(false)
export const updateInfo = ref<UpdateInfo | null>(null)
export const downloading = ref(false)
export const downloadProgress = ref(0)
export const updateError = ref<string | null>(null)

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    updateError.value = null
    const update = await check()

    console.log('Update check result:', update)

    // 检查 update 对象是否存在且有可用更新
    // update 可能存在但 available 可能为 false
    if (update && update.version) {
      updateAvailable.value = true
      updateInfo.value = {
        available: true,
        version: update.version,
        date: update.date || undefined,
        body: update.body || undefined
      }
      console.log('Update available set to true, updateInfo:', updateInfo.value)
      return updateInfo.value
    } else {
      updateAvailable.value = false
      updateInfo.value = { available: false }
      return null
    }
  } catch (error) {
    console.error('Failed to check for updates:', error)
    updateError.value = error instanceof Error ? error.message : '检查更新失败'
    return null
  }
}

export async function downloadAndInstall(
  onProgress?: (progress: number) => void
): Promise<boolean> {
  try {
    const update = await check()

    if (!update) {
      return false
    }

    downloading.value = true
    downloadProgress.value = 0
    updateError.value = null

    let downloaded = 0
    let contentLength = 0

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength || 0
          break
        case 'Progress':
          downloaded += event.data.chunkLength
          if (contentLength > 0) {
            const progress = Math.round((downloaded / contentLength) * 100)
            downloadProgress.value = progress
            onProgress?.(progress)
          }
          break
        case 'Finished':
          downloading.value = false
          break
      }
    })

    return true
  } catch (error) {
    console.error('Failed to download update:', error)
    updateError.value = error instanceof Error ? error.message : '下载更新失败'
    downloading.value = false
    return false
  }
}

export async function installAndRestart(): Promise<void> {
  try {
    await relaunch()
  } catch (error) {
    console.error('Failed to restart:', error)
    updateError.value = error instanceof Error ? error.message : '重启应用失败'
  }
}