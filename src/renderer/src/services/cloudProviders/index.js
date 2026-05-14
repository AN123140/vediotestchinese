/**
 * 云端识别服务商注册表
 * 统一管理所有云端 API 提供商，提供查找和调用接口
 */

import baidu from './baidu.js'
import xunfei from './xunfei.js'
import aliyun from './aliyun.js'
import azure from './azure.js'
import google from './google.js'

/** 所有可用的服务商 */
export const providers = {
  baidu,
  xunfei,
  aliyun,
  azure,
  google,
}

/** 获取服务商列表（用于设置面板展示） */
export function getProviderList() {
  return Object.values(providers).map(p => ({
    id: p.id,
    name: p.name,
    hasAuth: !!p.getAccessToken, // 是否需要鉴权
  }))
}

/**
 * 根据服务商 ID 获取实例
 * @param {string} providerId - 'baidu' | 'xunfei' | 'aliyun' | 'azure' | 'google'
 * @returns {Object|null}
 */
export function getProvider(providerId) {
  return providers[providerId] || null
}

/**
 * 调用指定服务商进行识别
 * @param {string} providerId - 服务商标识
 * @param {ArrayBuffer} audioData - PCM 音频数据 (16kHz, 16bit, mono)
 * @param {Object} config - 服务商配置 { apiKey, apiSecret/secretKey, language }
 * @returns {Promise<Array<{start, end, text}>}>}
 */
export async function callProvider(providerId, audioData, config) {
  const provider = getProvider(providerId)
  if (!provider) throw new Error(`未知的服务商: ${providerId}`)

  // 如果需要鉴权且未提供 token，先获取
  let authConfig = { ...config }
  if (provider.getAccessToken && !config.accessToken) {
    try {
      const tokenInfo = await provider.getAccessToken(config.apiKey || '', config.apiSecret || '')
      authConfig.accessToken = tokenInfo.token || tokenInfo.access_token || config.apiKey
    } catch (e) {
      throw new Error(`${provider.name} 鉴权失败: ${e.message}`)
    }
  }

  return provider.recognize(audioData, authConfig)
}

/**
 * 测试服务商连接是否可用
 * @param {string} providerId - 服务商标识
 * @param {Object} credentials - 鉴权凭据 { apiKey, apiSecret, ... }
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testConnection(providerId, credentials) {
  const provider = getProvider(providerId)
  if (!provider) return { success: false, message: `未知的服务商: ${providerId}` }

  try {
    if (provider.getAccessToken) {
      await provider.getAccessToken(credentials.apiKey || '', credentials.apiSecret || '')
      return { success: true, message: `${provider.name} 连接正常` }
    } else {
      return { success: true, message: `${provider.name} 已就绪` }
    }
  } catch (e) {
    return { success: false, message: `连接失败: ${e.message}` }
  }
}
