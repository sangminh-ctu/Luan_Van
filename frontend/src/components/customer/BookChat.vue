<template>
  <aside class="book-chat" aria-label="Tư vấn sách">
    <Transition name="chat-pop">
      <section v-show="open" id="book-chat-panel" class="chat-panel">
        <header class="chat-header">
          <div class="header-brand">
            <div class="bot-avatar-wrap">
              <img :src="chatImage" alt="" class="bot-avatar" />
              <span class="status-dot" aria-hidden="true"></span>
            </div>
            <div class="header-info">
              <h2>Tư vấn sách</h2>
              <span class="header-subtitle">Trợ lý nhà sách • Trực tuyến</span>
            </div>
          </div>
          <div class="header-actions">
            <button
              v-if="turns.length"
              type="button"
              class="icon-btn"
              title="Làm mới cuộc trò chuyện"
              aria-label="Làm mới cuộc trò chuyện"
              :disabled="busy"
              @click="resetChat"
            >
              <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="icon-btn"
              title="Thu gọn"
              aria-label="Thu gọn khung tư vấn"
              @click="open = false"
            >
              <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
        </header>

        <div ref="transcript" class="transcript" role="log" aria-live="polite">
          <div class="bot-row">
            <img :src="chatImage" alt="" class="msg-avatar" />
            <div class="bot-group">
              <p class="bot-bubble welcome-text">
                Xin chào! Bạn đang tìm sách gì?
              </p>
              <div v-if="!turns.length" class="quick-prompts" aria-label="Gợi ý câu hỏi">
                <button
                  v-for="sample in suggestions"
                  :key="sample"
                  type="button"
                  class="prompt-chip"
                  :disabled="busy"
                  @click="askSuggestion(sample)"
                >
                  {{ sample }}
                </button>
              </div>
            </div>
          </div>

          <div v-for="(turn, index) in turns" :key="index" class="turn-block">
            <div class="user-row">
              <p class="question">{{ turn.message }}</p>
            </div>

            <div v-if="turn.reply || turn.books?.length" class="bot-row">
              <img :src="chatImage" alt="" class="msg-avatar" />
              <div class="bot-group">
                <p v-if="turn.reply" class="bot-bubble">
                  <span v-if="turn.replySource === 'fallback'" class="fallback-tag">
                    Tra cứu danh mục tự động
                  </span>
                  <span class="chat-reply-text">{{ turn.reply }}</span>
                </p>
                <ul v-if="turn.sources?.length" class="list-unstyled small text-secondary mb-2">
                  <li v-for="source in turn.sources" :key="source.id + ':' + source.section">
                    Nguồn {{ source.name }} (phiên bản {{ source.version }})<template v-if="source.section"> · {{ source.section }}</template>
                  </li>
                </ul>
                <ul v-if="turn.books?.length" class="book-list">
                  <li v-for="book in turn.books" :key="book.id" class="book-card">
                    <div class="book-card-main">
                      <img
                        :src="formatImageUrl(book.image, book.title)"
                        :alt="book.title"
                        class="book-cover"
                        loading="lazy"
                      />
                      <div class="book-card-body">
                        <div class="book-card-top">
                          <strong class="book-title">{{ book.title }}</strong>
                          <span v-if="book.discountPercent > 0" class="discount-badge">
                            -{{ book.discountPercent }}%
                          </span>
                        </div>
                        <div v-if="book.authors || book.stockStatus || book.rating" class="book-meta-row">
                          <span v-if="book.authors" class="book-author">{{ book.authors }}</span>
                          <span
                            v-if="book.stockStatus && book.stockStatus !== 'unknown'"
                            class="stock-badge"
                            :class="`is-${book.stockStatus}`"
                          >
                            {{ stockLabel(book.stockStatus) }}
                          </span>
                          <span v-if="book.rating?.average" class="rating-badge">
                            <i class="bi bi-star-fill" aria-hidden="true"></i>
                            {{ book.rating.average }}
                          </span>
                        </div>
                        <div class="book-price-row">
                          <span class="book-price">{{ currency.format(book.price) }}</span>
                          <del v-if="book.originalPrice && book.originalPrice > book.price" class="book-original-price">
                            {{ currency.format(book.originalPrice) }}
                          </del>
                        </div>
                        <div class="book-reason">{{ book.reason }}</div>
                        <RouterLink
                          class="book-link"
                          :to="{ name: 'book-detail', params: { id: book.id } }"
                          @click="open = false"
                        >
                          <span>Xem chi tiết</span>
                          <i class="bi bi-arrow-right-short" aria-hidden="true"></i>
                        </RouterLink>
                      </div>
                    </div>
                  </li>
                </ul>
                <div
                  v-if="index === turns.length - 1 && turn.suggestions?.length"
                  class="quick-prompts"
                  aria-label="Gợi ý tiếp theo"
                >
                  <button
                    v-for="item in turn.suggestions"
                    :key="item.label"
                    type="button"
                    class="prompt-chip"
                    :disabled="busy"
                    @click="askSuggestion(item.message || item.label)"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="busy" class="bot-row">
            <img :src="chatImage" alt="" class="msg-avatar" />
            <p class="bot-bubble typing-bubble">
              <span class="typing-dots" aria-hidden="true">
                <span></span><span></span><span></span>
              </span>
              <span>Đang tìm sách…</span>
            </p>
          </div>

          <p v-if="error" class="error-banner">
            <i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i>
            <span>{{ error }}</span>
          </p>
        </div>

        <form class="chat-form" @submit.prevent="send">
          <div class="input-wrapper">
            <input
              v-model="draft"
              aria-label="Câu hỏi của bạn"
              maxlength="500"
              placeholder="Nhập câu hỏi..."
            />
          </div>
          <button type="submit" class="send-btn" :disabled="busy || !draft.trim()">
            <span>Gửi</span>
            <i class="bi bi-send-fill" aria-hidden="true"></i>
          </button>
        </form>
      </section>
    </Transition>

    <button
      class="chat-toggle"
      :class="{ 'is-open': open }"
      type="button"
      :aria-label="open ? 'Đóng tư vấn sách' : 'Mở tư vấn sách'"
      :aria-expanded="open"
      aria-controls="book-chat-panel"
      @click="toggle"
    >
      <img :src="chatImage" alt="" />
      <span v-if="!open" class="toggle-badge" aria-hidden="true">AI</span>
    </button>
  </aside>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import chatImage from '../../assets/images/logo/imgchat.jpg'
import { useBookChat } from './useBookChat'
import { formatImageUrl } from '../../utils/imageHelper'

const open = ref(false)
const transcript = ref(null)
const { draft, busy, error, turns, send, resetChat, askSuggestion } = useBookChat(scrollToLatest)
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

const suggestions = [
  'Sách trinh thám dưới 150.000đ',
  'Sách kỹ năng sống hay',
  'Gợi ý sách dưới 100.000đ',
]

async function scrollToLatest() {
  await nextTick()
  if (transcript.value) transcript.value.scrollTop = transcript.value.scrollHeight
}

function toggle() {
  open.value = !open.value
  if (open.value) scrollToLatest()
}

function stockLabel(status) {
  if (status === 'out') return 'Hết hàng'
  if (status === 'low') return 'Sắp hết'
  return 'Còn hàng'
}
</script>

<style scoped>
.book-chat {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  z-index: 1040;
  display: grid;
  justify-items: end;
  gap: 0.75rem;
  font-family: inherit;
}

.chat-panel {
  width: min(24.5rem, calc(100vw - 1.5rem));
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 1.15rem;
  box-shadow:
    0 20px 45px -12px rgba(15, 23, 42, 0.22),
    0 4px 16px -2px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Header */
.chat-header {
  background: linear-gradient(135deg, #c92127 0%, #a5161b 100%);
  color: #ffffff;
  padding: 0.875rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  box-shadow: 0 2px 10px rgba(201, 33, 39, 0.2);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

.bot-avatar-wrap {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
}

.bot-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  background: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.85);
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0.65rem;
  height: 0.65rem;
  background: #22c55e;
  border: 2px solid #ffffff;
  border-radius: 50%;
}

.header-info {
  min-width: 0;
}

.header-info h2 {
  font-size: 1.02rem;
  font-weight: 700;
  margin: 0;
  line-height: 1.25;
  color: #ffffff;
}

.header-subtitle {
  display: block;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.88);
  margin-top: 0.1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.icon-btn {
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
  padding: 0;
  font-size: 0.9rem;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

.icon-btn:active {
  transform: scale(0.94);
}

/* Transcript */
.transcript {
  height: min(24rem, 56dvh);
  overflow-y: auto;
  overflow-wrap: anywhere;
  padding: 1rem;
  background: #f8f9fb;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  scroll-behavior: smooth;
}

.transcript::-webkit-scrollbar {
  width: 5px;
}

.transcript::-webkit-scrollbar-track {
  background: transparent;
}

.transcript::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 999px;
}

.turn-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Bot message */
.bot-row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.msg-avatar {
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  object-fit: cover;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.bot-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: calc(100% - 2.5rem);
}

.bot-bubble {
  margin: 0;
  background: #ffffff;
  color: #1f2937;
  padding: 0.65rem 0.85rem;
  border-radius: 0.9rem;
  border-top-left-radius: 0.25rem;
  font-size: 0.9rem;
  line-height: 1.45;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  border: 1px solid #eef0f4;
}

/* Quick suggestion chips */
.quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.prompt-chip {
  background: #ffffff;
  color: #c92127;
  border: 1px solid rgba(201, 33, 39, 0.28);
  border-radius: 999px;
  padding: 0.32rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.prompt-chip:hover:not(:disabled) {
  background: #c92127;
  color: #ffffff;
  border-color: #c92127;
}

/* User message */
.user-row {
  display: flex;
  justify-content: flex-end;
}

.question {
  margin: 0;
  max-width: 82%;
  background: linear-gradient(135deg, #c92127 0%, #b01b20 100%);
  color: #ffffff;
  padding: 0.6rem 0.9rem;
  border-radius: 0.95rem;
  border-bottom-right-radius: 0.25rem;
  font-size: 0.9rem;
  line-height: 1.45;
  box-shadow: 0 2px 6px rgba(201, 33, 39, 0.2);
}

/* Book Cards */
.fallback-tag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  margin-bottom: 0.35rem;
}

.chat-reply-text {
  white-space: pre-line;
}

.bot-bubble .fallback-tag + span {
  display: block;
}

.book-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.book-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-left: 3px solid #c92127;
  border-radius: 0.75rem;
  padding: 0.65rem 0.75rem;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.book-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  border-color: #f3c4c6;
  border-left-color: #c92127;
}

.book-card-main {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}

.book-cover {
  width: 3.4rem;
  height: 4.75rem;
  object-fit: cover;
  border-radius: 0.4rem;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  flex-shrink: 0;
}

.book-card-body {
  flex: 1;
  min-width: 0;
}

.book-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.4rem;
}

.book-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #111827;
  line-height: 1.35;
}

.discount-badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: #ffffff;
  background: #c92127;
  padding: 0.12rem 0.42rem;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

.book-price-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.book-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.2rem;
  font-size: 0.74rem;
}

.book-author {
  color: #4b5563;
  font-weight: 500;
}

.stock-badge {
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.68rem;
}

.stock-badge.is-in_stock {
  background: #dcfce7;
  color: #15803d;
}

.stock-badge.is-low {
  background: #fef3c7;
  color: #b45309;
}

.stock-badge.is-out {
  background: #fee2e2;
  color: #b91c1c;
}

.rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  color: #d97706;
  font-weight: 600;
}

.book-price {
  font-size: 0.84rem;
  font-weight: 700;
  color: #c92127;
  white-space: nowrap;
}

.book-original-price {
  font-size: 0.76rem;
  color: #9ca3af;
  white-space: nowrap;
}

.book-reason {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 0.3rem;
  line-height: 1.35;
}

.book-link {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin-top: 0.45rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #c92127;
  text-decoration: none;
}

.book-link:hover {
  text-decoration: underline;
  color: #9f181d;
}

/* Typing state */
.typing-bubble {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: #4b5563;
  font-size: 0.85rem;
}

.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
}

.typing-dots span {
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 50%;
  background: #c92127;
  animation: chat-bounce 1.2s infinite ease-in-out;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes chat-bounce {
  0%, 80%, 100% {
    transform: scale(0.65);
    opacity: 0.45;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Error */
.error-banner {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  padding: 0.55rem 0.75rem;
  border-radius: 0.65rem;
  font-size: 0.82rem;
}

/* Input form */
.chat-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.85rem;
  background: #ffffff;
  border-top: 1px solid #eef0f4;
}

.input-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
}

.chat-form input {
  width: 100%;
  min-width: 0;
  padding: 0.58rem 0.9rem;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  font-size: 0.88rem;
  color: #111827;
  background: #f9fafb;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.chat-form input:focus {
  outline: none;
  background: #ffffff;
  border-color: #c92127;
  box-shadow: 0 0 0 3px rgba(201, 33, 39, 0.12);
}

.send-btn {
  background: linear-gradient(135deg, #c92127 0%, #a8181d 100%);
  color: #ffffff;
  border: 0;
  border-radius: 999px;
  padding: 0.58rem 1rem;
  font-size: 0.86rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  box-shadow: 0 3px 10px rgba(201, 33, 39, 0.25);
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 5px 14px rgba(201, 33, 39, 0.35);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* Floating toggle button */
.chat-toggle {
  position: relative;
  width: 4.5rem;
  height: 4.5rem;
  padding: 0;
  border: 3px solid #ffffff;
  border-radius: 50%;
  overflow: visible;
  background: #ffffff;
  box-shadow:
    0 10px 25px rgba(201, 33, 39, 0.28),
    0 4px 10px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
}

.chat-toggle:hover {
  transform: translateY(-3px) scale(1.03);
  box-shadow:
    0 14px 30px rgba(201, 33, 39, 0.36),
    0 6px 14px rgba(0, 0, 0, 0.12);
}

.chat-toggle img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.toggle-badge {
  position: absolute;
  top: -0.2rem;
  right: -0.2rem;
  background: #c92127;
  color: #ffffff;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.15rem 0.38rem;
  border-radius: 999px;
  border: 2px solid #ffffff;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* Panel transition */
.chat-pop-enter-active,
.chat-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: bottom right;
}

.chat-pop-enter-from,
.chat-pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

@media (max-width: 480px) {
  .book-chat { right: .75rem; bottom: .75rem; }
  .chat-panel { max-height: calc(100dvh - 6.75rem); }
  .chat-form input { font-size: 1rem; }
}
</style>
