<template>
  <div class="notification-container">
    <transition-group name="notif">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="notif"
        :class="msg.type"
        @click="$emit('dismiss', msg.id)"
      >
        <span class="notif-icon">
          <svg v-if="msg.type === 'success'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <svg v-else-if="msg.type === 'error'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
        </span>
        <span class="notif-text">{{ msg.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
defineProps({ messages: Array })
defineEmits(['dismiss'])
</script>

<style scoped>
.notification-container {
  position: fixed;
  bottom: 70px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.notif {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  pointer-events: all;
  cursor: pointer;
  box-shadow: var(--shadow);
  min-width: 220px;
  max-width: 360px;
}

.notif.success {
  background: rgba(76, 175, 132, 0.15);
  border: 1px solid rgba(76, 175, 132, 0.35);
  color: var(--success);
}

.notif.error {
  background: rgba(224, 92, 109, 0.15);
  border: 1px solid rgba(224, 92, 109, 0.35);
  color: var(--danger);
}

.notif.info {
  background: rgba(79, 142, 247, 0.15);
  border: 1px solid rgba(79, 142, 247, 0.35);
  color: var(--accent);
}

.notif-icon {
  flex-shrink: 0;
}

.notif-text {
  flex: 1;
  word-break: break-all;
}

/* 动画 */
.notif-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.notif-leave-active {
  transition: all 0.2s ease-out;
}
.notif-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.notif-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
