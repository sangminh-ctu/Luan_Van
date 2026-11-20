import { computed, ref, watch } from 'vue'
import api from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

export function useBookChat(onTurnChange) {
  const auth = useAuthStore()
  const storageKey = computed(() => 'misa-chat:v2:' + (auth.user?.user_id ?? auth.user?.id ?? 'guest'))
  const draft = ref('')
  const busy = ref(false)
  const error = ref('')
  const session = readSession()
  const turns = ref(session.turns)
  let context = session.context
  let credentials = session.credentials
  let generation = 0

  watch(storageKey, () => {
    generation += 1
    const saved = readSession()
    turns.value = saved.turns
    context = saved.context
    credentials = saved.credentials
    draft.value = ''
    error.value = ''
    busy.value = false
    onTurnChange()
  }, { flush: 'sync' })

  function readSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey.value))
      if (Array.isArray(saved?.turns) && saved.context && typeof saved.context === 'object') return saved
    } catch {
      // Chat still works when browser storage is unavailable.
    }
    return { turns: [], context: {} }
  }

  function saveSession() {
    try {
      sessionStorage.setItem(storageKey.value, JSON.stringify({ turns: turns.value.slice(-30), context, credentials }))
    } catch {
      // Chat still works when browser storage is unavailable.
    }
  }

  function resetChat() {
    if (busy.value) return
    turns.value = []
    draft.value = ''
    error.value = ''
    context = {}
    credentials = undefined
    saveSession()
  }

  function askSuggestion(text) {
    if (busy.value) return
    draft.value = text
    return send()
  }

  async function send() {
    const message = draft.value.trim()
    if (!message || busy.value) return
    busy.value = true
    error.value = ''
    draft.value = ''
    turns.value.push({ message })
    onTurnChange()
    const requestGeneration = generation
    const options = { timeout: 35000 }
    try {
      let response
      try {
        response = await api.post('/chat/messages', credentials ? { message, ...credentials } : { message, context }, options)
      } catch (requestError) {
        if (requestGeneration !== generation) return
        if (!credentials || ![404, 410].includes(requestError.response?.status)) throw requestError
        response = await api.post('/chat/messages', { message, context }, options)
      }
      if (requestGeneration !== generation) return
      const { data } = response
      context = data.context
      credentials = { conversationId: data.conversationId, conversationToken: data.conversationToken }
      Object.assign(turns.value.at(-1), {
        reply: data.reply,
        replySource: data.replySource,
        intent: data.intent,
        books: data.books,
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        sources: data.sources,
      })
      saveSession()
    } catch (requestError) {
      if (requestGeneration !== generation) return
      turns.value.pop()
      if (!draft.value) draft.value = message
      error.value = requestError.response?.status === 429
        ? 'Bạn đã gửi nhiều câu hỏi. Hãy chờ một lúc rồi thử lại.'
        : 'Chưa gửi được câu hỏi. Bạn có thể thử lại.'
    } finally {
      if (requestGeneration === generation) {
        busy.value = false
        onTurnChange()
      }
    }
  }

  return { draft, busy, error, turns, send, resetChat, askSuggestion }
}
