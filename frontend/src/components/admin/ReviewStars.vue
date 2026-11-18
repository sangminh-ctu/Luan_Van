<template>
  <span class="review-stars" role="img" :aria-label="`${rating} trên 5 sao`">
    <i v-for="star in 5" :key="star" class="bi"
      :class="star <= rating ? 'bi-star-fill' : 'bi-star'"
      aria-hidden="true"></i>
  </span>
</template>

<script setup>
defineProps({ rating: { type: Number, required: true } });
</script>

<style scoped>
.review-stars {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: #ab6600;
  white-space: nowrap;
}
</style>
