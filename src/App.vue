<template>
  <div class="app-shell">
    <header class="hero card">
      <div>
        <p class="eyebrow">作者 Sakuta</p>
        <h1>楓之谷 - 羅密歐與茱麗葉 工具</h1>
        <p class="sub">AbySoul 公會副本小幫手，一起把試錯整理得更快一點 ✨</p>
      </div>
      <button
        v-if="showPipButton"
        class="ghost"
        type="button"
        @click="togglePiP"
        :disabled="!joinedSession"
      >
        {{ pipWindow ? '關閉懸浮視窗' : (joinedSession ? '懸浮視窗' : '先加入房間後可開啟') }}
      </button>
    </header>

    <section class="card controls">
      <div class="join-grid">
        <div class="field grow">
          <label>房號</label>
          <input
            v-model="sessionInput"
            type="text"
            maxlength="3"
            inputmode="numeric"
            placeholder="例如：123"
            @input="sessionInput = normalizeRoomId(sessionInput)"
            @keyup.enter="joinSession"
          >
          <p class="mini-hint">最多 3 位數，只接受數字。</p>
        </div>

        <div class="field grow">
          <label>房間密碼</label>
          <div class="inline">
            <input
              v-model="passwordInput"
              type="text"
              maxlength="4"
              inputmode="numeric"
              placeholder="建立房間可留空自動產生"
              @input="passwordInput = normalizePassword(passwordInput)"
              @keyup.enter="joinSession"
            >
            <button class="ghost" type="button" @click="fillRandomPassword">隨機產生</button>
          </div>
          <p class="mini-hint">加入既有房間時，房號與密碼都要正確。</p>
        </div>

        <div class="field grow">
          <label>建房 GUID</label>
          <input
            v-model="createGuidInput"
            type="text"
            placeholder="只有建立新房間才需要輸入"
            @keyup.enter="joinSession"
          >
          <p class="mini-hint">只在建立新房間時驗證；加入既有房間不需要。</p>
        </div>
      </div>

      <div class="join-actions">
        <button class="primary" @click="joinSession">加入 / 建立房間</button>
      </div>

      <div class="field room-picker">
        <label>我的房間</label>
        <div class="room-buttons">
          <button
            v-for="room in rooms"
            :key="room"
            :class="['room-btn', { active: myRoom === room }]"
            @click="setMyRoom(room)"
            :disabled="!joinedSession"
          >
            {{ room }} 號房
          </button>
        </div>
      </div>

      <div class="status-grid" v-if="joinedSession">
        <div class="status-box">
          <span class="status-label">目前房號</span>
          <strong>{{ sessionId }}</strong>
        </div>
        <div class="status-box">
          <span class="status-label">房間密碼</span>
          <div class="copy-line">
            <strong>{{ displayPassword }}</strong>
            <button class="tiny-btn" @click="copyRoomPassword" :disabled="!displayPassword">複製</button>
          </div>
        </div>
        <div class="status-box">
          <span class="status-label">你的顏色</span>
          <div class="color-chip-wrap">
            <span class="color-chip" :style="{ background: myColor?.color || '#ddd' }"></span>
            <strong>{{ myColor?.label || '尚未選房' }}</strong>
          </div>
        </div>
        <div class="status-box">
          <span class="status-label">你的身分</span>
          <strong>{{ isOwner ? '隊長' : '隊員' }}</strong>
        </div>
      </div>

      <div class="actions" v-if="joinedSession">
        <button class="ghost" @click="copyRoomId">複製房號</button>
        <button class="ghost" @click="copyRoomInfo" :disabled="!displayPassword">複製房號+密碼</button>
        <button class="ghost" @click="copyShareLink">複製房間連結</button>
        <button v-if="showPipButton" class="ghost" @click="togglePiP">{{ pipWindow ? '關閉懸浮視窗' : '懸浮視窗' }}</button>
        <button class="ghost" @click="leaveRoom">離開房間</button>
        <button class="danger" @click="handleClearMain" :disabled="!isOwner">清除全部</button>
      </div>

      <p class="hint" v-if="joinedSession && !myRoom">請先選擇你是哪一間房，才可以點台階。</p>
      <p class="hint" v-if="joinedSession && isOwner">隊長離開房間時，整個房間會一起刪除。</p>
      <p class="hint" v-if="joinedSession">房間連結只會帶房號，不會附上密碼。</p>
    </section>

    <section class="board card" v-if="joinedSession">
      <div class="board-head">
        <div>
          <h2>10 層台階</h2>
          <p>每層固定 4 個台階。每一間房在同一層只能標記一個台階，點同一格可取消，點別格會自動換過去。</p>
        </div>
      </div>

      <div class="legend">
        <div v-for="item in colorMap" :key="item.room" class="legend-item">
          <span class="color-chip" :style="{ background: item.color }"></span>
          <span>{{ item.room }} 號房</span>
        </div>
      </div>

      <div class="floors">
        <div v-for="floor in floors" :key="floor" class="floor-row">
          <div class="floor-label">第 {{ floor }} 層</div>
          <div class="steps">
            <button
              v-for="step in 4"
              :key="`${floor}-${step}`"
              class="step"
              :class="{ selected: isSelected(floor, step), mine: isMine(floor, step) }"
              :style="stepStyle(floor, step)"
              :disabled="!myRoom"
              @click="toggleStep(floor, step)"
            >
              <span class="step-index">{{ step }}</span>
              <span class="step-room" v-if="selectedBy(floor, step)">
                {{ selectedBy(floor, step) }} 號房
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="usage-pill">
      目前使用中：{{ usageStats.activeRooms }} 組 / {{ MAX_ACTIVE_ROOMS }} 組；{{ usageStats.activeUsers }} 人 / {{ MAX_ACTIVE_USERS }} 人
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { db, CREATE_ROOM_GUID } from './firebase'
import {
  get,
  onDisconnect,
  onValue,
  ref as dbRef,
  remove,
  runTransaction,
  set,
  update
} from 'firebase/database'

const floors = Array.from({ length: 10 }, (_, index) => 10 - index)
const rooms = [1, 2, 3, 4]
const colorMap = [
  { room: 1, color: '#ff6b6b', label: '紅色' },
  { room: 2, color: '#4dabf7', label: '藍色' },
  { room: 3, color: '#51cf66', label: '綠色' },
  { room: 4, color: '#fcc419', label: '黃色' }
]
const MAX_ACTIVE_ROOMS = 10
const MAX_ACTIVE_USERS = 40
const ROOM_EXPIRE_MS = 20 * 60 * 1000
const PIP_WINDOW_WIDTH = 420
const PIP_WINDOW_HEIGHT = 760

const clientId = getOrCreateClientId()
const hostKeyStoragePrefix = 'rjpq-host-key-'
const sessionInput = ref('')
const passwordInput = ref('')
const createGuidInput = ref(localStorage.getItem('rjpq-create-guid') || '')
const sessionId = ref('')
const joinedSession = computed(() => Boolean(sessionId.value))
const myRoom = ref(Number(localStorage.getItem('rjpq-my-room')) || 0)
const hostKey = ref('')
const sessionData = ref(defaultSessionData())
const usageStats = ref({ activeRooms: 0, activeUsers: 0 })
const showPipButton = ref(false)
const pipWindow = ref(null)

let unsubscribeSession = null
let unsubscribeStats = null
let participantDisconnect = null
let roomDisconnect = null
let joinedPresencePath = ''
let cleanupInterval = null
let pipCleanupFns = []
let pipMounted = false

const myColor = computed(() => colorMap.find((item) => item.room === myRoom.value))
const isOwner = computed(() => Boolean(hostKey.value) && hostKey.value === sessionData.value.hostKey)
const displayPassword = computed(() => sessionData.value.password || '')

function defaultSessionData() {
  return {
    password: '',
    hostKey: '',
    hostClientId: '',
    assignments: {},
    participants: {},
    updatedAt: 0,
    createdAt: 0
  }
}

function getOrCreateClientId() {
  const existing = localStorage.getItem('rjpq-client-id')
  if (existing) return existing
  const id = `c_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
  localStorage.setItem('rjpq-client-id', id)
  return id
}

function normalizeRoomId(value) {
  return (value || '').replace(/\D/g, '').slice(0, 3)
}

function normalizePassword(value) {
  return (value || '').replace(/\D/g, '').slice(0, 4)
}

function randomPassword() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function randomHostKey() {
  return `h_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
}

function fillRandomPassword() {
  passwordInput.value = randomPassword()
}

function sessionPath(id) {
  return dbRef(db, `rjpq-sessions/${id}`)
}

function participantPath(roomId, clientIdValue) {
  return dbRef(db, `rjpq-sessions/${roomId}/participants/${clientIdValue}`)
}

function storeHostKey(roomId, value) {
  localStorage.setItem(`${hostKeyStoragePrefix}${roomId}`, value)
}

function clearStoredHostKey(roomId) {
  localStorage.removeItem(`${hostKeyStoragePrefix}${roomId}`)
}

function loadHostKey(roomId) {
  return localStorage.getItem(`${hostKeyStoragePrefix}${roomId}`) || ''
}

function replaceUrlRoom(roomId) {
  const url = new URL(window.location.href)
  if (roomId) {
    url.searchParams.set('room', roomId)
  } else {
    url.searchParams.delete('room')
  }
  window.history.replaceState({}, '', url)
}

function isExpired(room) {
  const updatedAt = Number(room?.updatedAt || 0)
  if (!updatedAt) return false
  return Date.now() - updatedAt > ROOM_EXPIRE_MS
}

async function purgeExpiredRooms() {
  const snapshot = await get(dbRef(db, 'rjpq-sessions'))
  const sessions = snapshot.val() || {}
  await Promise.all(
    Object.entries(sessions)
      .filter(([, room]) => isExpired(room))
      .map(([roomId]) => remove(sessionPath(roomId)))
  )
}

async function leavePresence() {
  if (participantDisconnect) {
    try {
      await participantDisconnect.cancel()
    } catch {
      // ignore
    }
    participantDisconnect = null
  }
  if (roomDisconnect) {
    try {
      await roomDisconnect.cancel()
    } catch {
      // ignore
    }
    roomDisconnect = null
  }
  if (joinedPresencePath) {
    try {
      await remove(dbRef(db, joinedPresencePath))
    } catch {
      // ignore
    }
    joinedPresencePath = ''
  }
}

async function registerPresence(roomId) {
  await leavePresence()
  const targetRef = participantPath(roomId, clientId)
  await set(targetRef, {
    clientId,
    joinedAt: Date.now()
  })
  const disconnectHandler = onDisconnect(targetRef)
  disconnectHandler.remove()
  participantDisconnect = disconnectHandler
  joinedPresencePath = `rjpq-sessions/${roomId}/participants/${clientId}`
}

async function syncOwnerDisconnect(roomId) {
  if (roomDisconnect) {
    try {
      await roomDisconnect.cancel()
    } catch {
      // ignore
    }
    roomDisconnect = null
  }

  if (!roomId || !isOwner.value) return
  const disconnectHandler = onDisconnect(sessionPath(roomId))
  disconnectHandler.remove()
  roomDisconnect = disconnectHandler
}

async function joinSession() {
  await purgeExpiredRooms()

  const normalized = normalizeRoomId(sessionInput.value)
  const normalizedPassword = normalizePassword(passwordInput.value)

  if (!normalized) {
    alert('請先輸入房號。')
    return
  }

  if (sessionId.value && sessionId.value !== normalized) {
    const ok = window.confirm(`你目前在 ${sessionId.value} 房，確定要切換到 ${normalized} 房嗎？${isOwner.value ? '（隊長切換房間會刪除原本房間）' : ''}`)
    if (!ok) return
    await internalLeaveRoom(false)
  }

  sessionInput.value = normalized
  localStorage.setItem('rjpq-create-guid', createGuidInput.value)

  let snapshot = await get(sessionPath(normalized))
  if (snapshot.exists() && isExpired(snapshot.val())) {
    await remove(sessionPath(normalized))
    snapshot = await get(sessionPath(normalized))
  }

  const allSessionsSnapshot = await get(dbRef(db, 'rjpq-sessions'))
  const allSessions = allSessionsSnapshot.val() || {}
  const validSessions = Object.values(allSessions).filter((room) => !isExpired(room))
  const activeRooms = validSessions.filter((room) => room?.participants && Object.keys(room.participants).length > 0).length
  const activeUsers = validSessions.reduce((sum, room) => sum + Object.keys(room?.participants || {}).length, 0)

  if (!snapshot.exists()) {
    if (createGuidInput.value.trim() !== CREATE_ROOM_GUID) {
      alert('建房 GUID 不正確，無法建立新房間。')
      return
    }

    if (activeRooms >= MAX_ACTIVE_ROOMS) {
      alert(`目前使用中的小隊已達上限（${MAX_ACTIVE_ROOMS} 組）。`)
      return
    }

    if (activeUsers >= MAX_ACTIVE_USERS) {
      alert(`目前使用中的人數已達上限（${MAX_ACTIVE_USERS} 人）。`)
      return
    }

    const finalPassword = normalizedPassword || randomPassword()
    const newHostKey = randomHostKey()
    const result = await runTransaction(sessionPath(normalized), (current) => {
      if (current !== null) return current
      return {
        password: finalPassword,
        hostKey: newHostKey,
        hostClientId: clientId,
        assignments: {},
        participants: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    })

    if (!result.committed) {
      alert('建立房間失敗，請再試一次。')
      return
    }

    passwordInput.value = finalPassword
    hostKey.value = newHostKey
    storeHostKey(normalized, newHostKey)
  } else {
    const current = snapshot.val()
    const participantCount = Object.keys(current.participants || {}).length

    if (current.password !== normalizedPassword) {
      alert('房號或密碼錯誤。')
      return
    }

    if (!current.participants?.[clientId] && participantCount >= 4) {
      alert('這個房間已滿 4 人。')
      return
    }

    if (!current.participants?.[clientId] && activeUsers >= MAX_ACTIVE_USERS) {
      alert(`目前使用中的人數已達上限（${MAX_ACTIVE_USERS} 人）。`)
      return
    }

    hostKey.value = loadHostKey(normalized)
  }

  sessionId.value = normalized
  localStorage.setItem('rjpq-last-session', normalized)
  bindSession(normalized)
  await registerPresence(normalized)
  await syncOwnerDisconnect(normalized)
  await touchSession(normalized)
  replaceUrlRoom(normalized)
}

function bindSession(id) {
  if (unsubscribeSession) unsubscribeSession()
  unsubscribeSession = onValue(sessionPath(id), async (snapshot) => {
    if (!snapshot.exists()) {
      if (sessionId.value === id) {
        const wasOwner = isOwner.value
        await resetLocalSessionState(false)
        alert(wasOwner ? '你已離開房間，房間也一起刪除了。' : '這個房間已不存在或已過期。')
      }
      return
    }

    const value = snapshot.val()
    if (isExpired(value)) {
      await remove(sessionPath(id))
      return
    }

    sessionData.value = value
    if (!hostKey.value) {
      hostKey.value = loadHostKey(id)
    }
    await syncOwnerDisconnect(id)
  })
}

function bindUsageStats() {
  if (unsubscribeStats) unsubscribeStats()
  unsubscribeStats = onValue(dbRef(db, 'rjpq-sessions'), (snapshot) => {
    const sessions = Object.values(snapshot.val() || {}).filter((room) => !isExpired(room))
    usageStats.value = {
      activeRooms: sessions.filter((item) => Object.keys(item?.participants || {}).length > 0).length,
      activeUsers: sessions.reduce((sum, item) => sum + Object.keys(item?.participants || {}).length, 0)
    }
  })
}

function setMyRoom(room) {
  if (!joinedSession.value) return
  if (myRoom.value && myRoom.value !== room) {
    const ok = window.confirm(`你目前是 ${myRoom.value} 號房，確定要改成 ${room} 號房嗎？`)
    if (!ok) return
  }
  myRoom.value = room
  localStorage.setItem('rjpq-my-room', String(room))
}

function selectedBy(level, step) {
  const key = `${level}-${step}`
  return sessionData.value.assignments?.[key] || 0
}

function isSelected(level, step) {
  return Boolean(selectedBy(level, step))
}

function isMine(level, step) {
  return selectedBy(level, step) === myRoom.value
}

function stepStyle(level, step) {
  const room = selectedBy(level, step)
  const color = colorMap.find((item) => item.room === room)?.color
  return room ? { background: color, borderColor: color } : {}
}

async function touchSession(targetRoomId = sessionId.value) {
  if (!targetRoomId) return
  try {
    await update(sessionPath(targetRoomId), {
      updatedAt: Date.now()
    })
  } catch {
    // ignore missing room
  }
}

async function toggleStep(level, step) {
  if (!sessionId.value || !myRoom.value) return

  const result = await runTransaction(sessionPath(sessionId.value), (current) => {
    if (current === null) return current

    const assignments = { ...(current.assignments || {}) }
    const targetKey = `${level}-${step}`
    const currentOwner = assignments[targetKey]

    if (currentOwner && currentOwner !== myRoom.value) {
      return current
    }

    Object.keys(assignments).forEach((key) => {
      const [floorText] = key.split('-')
      if (Number(floorText) === level && assignments[key] === myRoom.value) {
        delete assignments[key]
      }
    })

    if (currentOwner !== myRoom.value) {
      assignments[targetKey] = myRoom.value
    }

    return {
      ...current,
      assignments,
      updatedAt: Date.now()
    }
  })

  if (!result.committed) {
    alert('同步失敗，請再試一次。')
  }
}

async function clearAssignmentsDirect() {
  if (!sessionId.value || !isOwner.value) return false
  await update(sessionPath(sessionId.value), {
    assignments: {},
    updatedAt: Date.now()
  })
  return true
}

async function handleClearMain() {
  if (!sessionId.value || !isOwner.value) return
  const ok = window.confirm('確定要清除這個房間的全部台階紀錄嗎？')
  if (!ok) return
  await clearAssignmentsDirect()
}

async function internalLeaveRoom(showAlert = true) {
  const currentRoomId = sessionId.value
  const currentIsOwner = isOwner.value

  if (!currentRoomId) return

  closePiP()

  if (currentIsOwner) {
    await leavePresence()
    try {
      await remove(sessionPath(currentRoomId))
    } catch {
      // ignore
    }
    clearStoredHostKey(currentRoomId)
  } else {
    await leavePresence()
    await touchSession(currentRoomId)
  }

  await resetLocalSessionState(showAlert)
}

async function leaveRoom() {
  if (!sessionId.value) return
  const message = isOwner.value
    ? '你是隊長。離開房間後，整個房間會一起刪除，確定要離開嗎？'
    : '確定要離開房間嗎？'
  const ok = window.confirm(message)
  if (!ok) return
  await internalLeaveRoom(true)
}

async function resetLocalSessionState(showAlert) {
  if (unsubscribeSession) {
    unsubscribeSession()
    unsubscribeSession = null
  }
  sessionId.value = ''
  sessionData.value = defaultSessionData()
  hostKey.value = ''
  replaceUrlRoom('')
  localStorage.removeItem('rjpq-last-session')
  if (showAlert) {
    alert('已離開房間。')
  }
}

async function writeClipboard(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text)
    alert(successMessage)
  } catch {
    alert('複製失敗，請手動複製。')
  }
}

function copyRoomId() {
  if (!sessionId.value) return
  writeClipboard(sessionId.value, `已複製房號：${sessionId.value}`)
}

function copyRoomPassword() {
  if (!displayPassword.value) return
  writeClipboard(displayPassword.value, `已複製密碼：${displayPassword.value}`)
}

function copyRoomInfo() {
  if (!sessionId.value || !displayPassword.value) return
  writeClipboard(`房號 ${sessionId.value}；密碼 ${displayPassword.value}`, '已複製房號與密碼。')
}

function copyShareLink() {
  if (!sessionId.value) return
  const url = new URL(window.location.href)
  url.searchParams.set('room', sessionId.value)
  writeClipboard(url.toString(), '已複製房間連結。')
}

function closePiP() {
  const target = pipWindow.value
  pipWindow.value = null
  pipMounted = false
  pipCleanupFns.forEach((fn) => fn())
  pipCleanupFns = []
  if (target && !target.closed) {
    target.close()
  }
}

function createPiPHtml() {
  const roomBadge = myRoom.value ? `${myRoom.value} 號房` : '未選房'
  const clearButton = isOwner.value
    ? '<button class="pip-clear" id="pip-clear-btn" type="button">清除全部</button>'
    : ''

  const rows = floors.map((floor) => {
    const stepButtons = [1, 2, 3, 4].map((step) => {
      const owner = selectedBy(floor, step)
      const color = colorMap.find((item) => item.room === owner)?.color || '#ffffff'
      const mineClass = owner === myRoom.value ? 'mine' : ''
      const label = owner ? `${owner} 號房` : '&nbsp;'
      return `
        <button class="pip-step ${mineClass}" data-floor="${floor}" data-step="${step}" style="background:${color};border-color:${owner ? color : '#d1d5db'};">
          <span class="pip-step-index">${step}</span>
          <span class="pip-step-room">${label}</span>
        </button>
      `
    }).join('')

    return `
      <div class="pip-row">
        <div class="pip-floor">${floor}</div>
        <div class="pip-steps">${stepButtons}</div>
      </div>
    `
  }).join('')

  return `
    <div class="pip-shell">
      <div class="pip-header">
        <div>
          <strong>R&J ${sessionId.value}</strong>
          <div class="pip-sub">${roomBadge}</div>
        </div>
        <div class="pip-actions">
          ${clearButton}
        </div>
      </div>
      <div class="pip-board">${rows}</div>
    </div>
  `
}

function mountPiPContents(targetWindow) {
  const doc = targetWindow.document

  if (!pipMounted) {
    doc.head.innerHTML = `
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>RJPQ 懸浮視窗</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
          background: rgba(245,247,251,0.98);
          color: #111827;
        }
        .pip-root {
          padding: 12px;
        }
        .pip-shell {
          padding: 0;
        }
        .pip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .pip-sub { color: #6b7280; font-size: 12px; margin-top: 2px; }
        .pip-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .pip-clear {
          border: 0;
          border-radius: 10px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: #fee2e2;
          color: #b91c1c;
        }
        .pip-board {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pip-row {
          display: grid;
          grid-template-columns: 26px 1fr;
          gap: 8px;
          align-items: center;
        }
        .pip-floor {
          font-size: 12px;
          font-weight: 700;
          color: #374151;
          text-align: center;
        }
        .pip-steps {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .pip-step {
          min-height: 52px;
          border: 2px solid #d1d5db;
          border-radius: 12px;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          cursor: pointer;
          color: #111827;
        }
        .pip-step.mine { box-shadow: inset 0 0 0 3px rgba(17, 24, 39, 0.35); }
        .pip-step-index { font-size: 16px; font-weight: 700; }
        .pip-step-room { font-size: 11px; font-weight: 700; min-height: 13px; }
      </style>
    `
    doc.body.innerHTML = '<div class="pip-root"></div>'

    const clickHandler = async (event) => {
      const stepButton = event.target.closest('.pip-step')
      if (!stepButton) return
      const floor = Number(stepButton.getAttribute('data-floor'))
      const step = Number(stepButton.getAttribute('data-step'))
      await toggleStep(floor, step)
    }

    const closeHandler = () => {
      pipWindow.value = null
      pipMounted = false
      pipCleanupFns.forEach((fn) => fn())
      pipCleanupFns = []
    }

    doc.body.addEventListener('click', clickHandler)
    targetWindow.addEventListener('pagehide', closeHandler)
    pipCleanupFns.push(() => doc.body.removeEventListener('click', clickHandler))
    pipCleanupFns.push(() => targetWindow.removeEventListener('pagehide', closeHandler))
    pipMounted = true
  }

  const root = doc.querySelector('.pip-root')
  if (root) {
    root.innerHTML = createPiPHtml()
    const clearBtn = root.querySelector('#pip-clear-btn')
    if (clearBtn) {
      clearBtn.onclick = async (event) => {
        event.preventDefault()
        event.stopPropagation()
        clearBtn.disabled = true
        try {
          if (typeof window !== 'undefined' && typeof window.__rjpqClearAssignmentsDirect === 'function') {
            await window.__rjpqClearAssignmentsDirect()
          } else {
            await clearAssignmentsDirect()
          }
        } finally {
          clearBtn.disabled = false
        }
      }
    }
  }
}

async function togglePiP() {
  if (!showPipButton.value || !joinedSession.value) return

  if (pipWindow.value && !pipWindow.value.closed) {
    closePiP()
    return
  }

  try {
    const targetWindow = await window.documentPictureInPicture.requestWindow({
      width: PIP_WINDOW_WIDTH,
      height: PIP_WINDOW_HEIGHT
    })
    pipWindow.value = targetWindow
    mountPiPContents(targetWindow)
  } catch {
    alert('目前無法開啟懸浮視窗，請確認你使用的是支援此功能的桌機瀏覽器。')
  }
}

function updatePiP() {
  if (!pipWindow.value || pipWindow.value.closed) return
  mountPiPContents(pipWindow.value)
}

function detectPipSupport() {
  const ua = navigator.userAgent || ''
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  showPipButton.value = !mobile && typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

function handleBeforeUnload() {
  if (isOwner.value && sessionId.value) {
    return
  }
  leavePresence()
}


watch([sessionData, myRoom, isOwner], () => {
  if (typeof window !== 'undefined') {
    window.__rjpqClearAssignmentsDirect = clearAssignmentsDirect
  }
  updatePiP()
}, { deep: true })

onMounted(async () => {
  const url = new URL(window.location.href)
  const queryRoom = normalizeRoomId(url.searchParams.get('room') || '')
  const lastSession = normalizeRoomId(localStorage.getItem('rjpq-last-session') || '')
  sessionInput.value = queryRoom || lastSession
  detectPipSupport()
  bindUsageStats()
  await purgeExpiredRooms()
  cleanupInterval = window.setInterval(purgeExpiredRooms, 60 * 1000)
  window.__rjpqClearAssignmentsDirect = clearAssignmentsDirect
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(async () => {
  if (unsubscribeSession) unsubscribeSession()
  if (unsubscribeStats) unsubscribeStats()
  closePiP()
  await leavePresence()
  if (cleanupInterval) {
    window.clearInterval(cleanupInterval)
    cleanupInterval = null
  }
  if (typeof window !== 'undefined') {
    delete window.__rjpqClearAssignmentsDirect
  }
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

</script>

<style scoped>
:global(*) { box-sizing: border-box; }
:global(body) {
  margin: 0;
  font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
  background: #f5f7fb;
  color: #1f2937;
}

.app-shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}

.card {
  background: white;
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  padding: 20px;
  margin-bottom: 18px;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 8px;
  color: #6366f1;
  font-weight: 700;
}

h1, h2 { margin: 0 0 10px; }

.sub {
  margin: 0;
  color: #4b5563;
  line-height: 1.7;
}

.controls .field { margin-bottom: 16px; }

.join-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.join-actions { margin-bottom: 18px; }

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 700;
}

.inline {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 16px;
}

button {
  border: 0;
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  transition: 0.15s ease;
}

button:hover { transform: translateY(-1px); }
button:disabled { cursor: not-allowed; opacity: 0.5; transform: none; }

.primary { background: #6366f1; color: white; }
.ghost { background: #eef2ff; color: #4338ca; }
.danger { background: #fee2e2; color: #b91c1c; }
.tiny-btn {
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 13px;
  background: #eef2ff;
  color: #4338ca;
}

.room-buttons, .actions, .legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.room-btn { background: #f3f4f6; color: #374151; }
.room-btn.active { background: #111827; color: white; }

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.status-box {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px;
}

.status-label {
  display: block;
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 6px;
}

.color-chip-wrap, .legend-item, .copy-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.color-chip {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.hint, .mini-hint {
  color: #6b7280;
  margin: 8px 0 0;
}

.mini-hint { font-size: 13px; }

.board-head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 12px;
  margin-bottom: 14px;
}

.board-head p {
  margin: 0;
  color: #6b7280;
}

.floors {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.floor-row {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 12px;
  align-items: center;
}

.floor-label {
  font-weight: 700;
  color: #374151;
}

.steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.step {
  min-height: 76px;
  background: #ffffff;
  border: 2px solid #d1d5db;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #111827;
}

.step.mine {
  box-shadow: inset 0 0 0 3px rgba(17, 24, 39, 0.35);
}

.step-index { font-size: 20px; }
.step-room { font-size: 13px; font-weight: 700; }

.usage-pill {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 15;
  background: rgba(17, 24, 39, 0.92);
  color: white;
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 13px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.24);
}

@media (max-width: 720px) {
  .app-shell { padding: 14px; }
  .hero { flex-direction: column; }
  .floor-row { grid-template-columns: 1fr; gap: 8px; }
  .usage-pill {
    left: 12px;
    right: 12px;
    bottom: 12px;
    border-radius: 14px;
    text-align: center;
  }
}
</style>
