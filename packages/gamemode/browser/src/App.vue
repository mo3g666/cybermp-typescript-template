<template>
  <div class="hud">
    <h1>CyberMP Starter</h1>
    <p>CEF UI with Vue 3 & Vite</p>
  </div>
</template>

<style scoped>
.hud {
  position: fixed;
  bottom: 24px;
  left: 24px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #fff;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.65);
  border-left: 4px solid #fcee0a;
  border-radius: 4px;
  user-select: none;
  backdrop-filter: blur(4px);
  z-index: 9999;
}

h1 {
  margin: 0 0 4px 0;
  font-size: 24px;
  color: #fcee0a;
  text-transform: uppercase;
  letter-spacing: 1px;
}

p {
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
}
</style>
